# PROMPT 09 — Local-first cloud sync (push/pull, LWW, tombstones, media)

**Depends on:** Phase 8 · **Branch:** `imp-17092026/phase-9-sync` · **ADRs:** 03, 05, 06, 10
**Goal:** G7 part 2 — D3 in Xaviel's words: "si reinstalas, al volver a iniciar sesión podrás seguir
viendo tus datos, o si accedes desde un nuevo dispositivo".

> **How to run:** `cd /home/xaviel/dev2/tu-gasolina-rd && claude`, paste below the line.

---

```
Phase 9 of IMP 17092026: implement the sync engine between SQLite and x-core schema carguy.

Read first:
- docs/imp-17092026/02-specs/02-supabase-carguy.md §5 (protocol — authoritative), §6
- docs/imp-17092026/00-context/03-architecture-decisions.md (ADR-03 dirty rows, ADR-05, ADR-10 media)
- docs/imp-17092026/04-tracking/PROGRESS.md (Phase 2 repo API, Phase 8 client + types)
- lib/db/repos/*, lib/cloud/*

Branch: imp-17092026/phase-9-sync

Requirements:

1. ENGINE — lib/sync/engine.ts (+ lib/sync/tables.ts declaring the table list in dependency order
   with column mappers local↔cloud, and which columns are local-only: synced_at, blob).
   - `sync({ reason })`: guard (signed in, FEATURE_SYNC, not already running) → push → pull →
     media → update setting.last_sync_at; emits progress/status events for the UI.
   - Push: dirty rows (synced_at IS NULL OR updated_at > synced_at), batches of 200, upsert
     onConflict 'id' incl. tombstones; on success set synced_at. Map camelCase↔snake_case with the
     table declarations, never by hand per screen.
   - Pull: per table cursor setting.sync_cursor.<table> on server_updated_at, page 500, apply LWW
     (spec §5 rules: newer wins, equal keeps local, local dirty+newer keeps local), tombstones as
     tombstones; vehicles first so FKs hold (PRAGMA foreign_keys is ON — if a child arrives before
     its parent within the same pull because of ordering across tables, buffer and retry once;
     document the approach).
   - Media: push metadata, then upload bytes (native: File at Paths.document/rel_path; web: blob)
     to carguy-media/<user_id>/<id>.<ext> with upsert; set remote_path. Pull: metadata now, bytes
     lazily via useMediaUri (download on first display; cache to rel_path/blob).
   - Failure handling per spec §5 (network → retry next trigger with backoff; 401 → refresh once;
     PGRST106 → developer message; never delete local rows because the server lacks them).
   - Triggers: AppState active, after any local write (debounce 5 s; repos emit a "dirty" event
     from the write queue), manual button. Web: same, plus `online` event.
   - Tests (__tests__/sync/*.test.ts) on the pure parts: dirty selection predicate, LWW apply
     matrix (6 cases), column mappers round-trip for every table (use the fixture rows), cursor
     advancing, batch splitting. The Supabase client is injected (interface) so tests use a fake.

2. FIRST SIGN-IN MERGE (spec §5): after sign-in, run sync immediately with reason 'first-login';
   show a blocking-but-cancellable sheet "Sincronizando tu garaje…" with counts; when the account
   already had data, list "Se agregaron N vehículos desde la nube". Do NOT auto-merge look-alike
   vehicles; log the hint in PROGRESS.md as future work.

3. UI — app/cuenta.tsx: last sync time + result, "Sincronizar ahora", pending count ("3 cambios sin
   subir"), error line; header sync icon (small, only when signed in: idle/spinning/error);
   Más → Cuenta → danger zone "Borrar datos en la nube" (double confirm; deletes user rows per table
   + Storage objects; clears cursors; local stays). Remove the FEATURE_SYNC flag (set true) or keep
   it as an env switch for emergencies — your call, report it.

4. MULTI-DEVICE VERIFICATION (this is the acceptance test of D3):
   a) Web (Chrome, signed in as a test user) create a vehicle + fuel + service + inspection with a
      photo → sync.
   b) Android (Expo Go, same account) → sign in → everything appears incl. photo (lazy) → edit the
      vehicle name offline (airplane mode) → back online → sync → web shows the new name.
   c) Delete the service record on web → Android pulls the tombstone → record gone, not resurrected
      after Android pushes.
   d) Conflict: edit the same record on both while offline; the later updated_at wins on both.
   e) "Borrar datos locales" on Android → sign in again → pull restores everything.
   Record each step's result in PROGRESS.md. Also confirm RLS in practice: a second test user sees
   nothing of the first.

5. tsc/lint/test/build green; fuel flow verified signed-out (sync must be invisible when there is
   no account). Report, merge, push.
```

---

## Acceptance criteria

- [ ] Engine with declarative table mappers; push/pull/media/failure handling per spec; unit tests on pure parts.
- [ ] Sync runs on foreground, after writes (debounced), manual; status visible; errors in Spanish.
- [ ] First sign-in merge pushes local data; account data merges without loss.
- [ ] Multi-device scenario a–e passes and is recorded; RLS confirmed in practice.
- [ ] Signed-out users see no sync UI; the app never blocks on the network.
- [ ] "Borrar datos en la nube" works and is guarded.
- [ ] lint/tsc/test/build green.

## Watch for

- `upsert` with `onConflict: 'id'` requires `id` to be the PK — it is; with `user_id` default `auth.uid()` the client must **still send user_id** for RLS `with check` to pass on update paths — send it explicitly.
- Timestamps: compare ISO strings only if both are UTC `Z` — normalise on write (`new Date().toISOString()`), and treat Postgres `timestamptz` output by parsing to `Date`.
- Web BLOB upload: `new Blob([bytes], { type: mime })`; native: `fetch(fileUri)` → `arrayBuffer()` or the Supabase `FileSystem` guidance for RN.
- Never wipe cursors on sign-out unless the *account* changes (different user_id).
