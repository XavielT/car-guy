# PROMPT 02 — SQLite data layer, full schema v1, legacy import, backup v2

**Depends on:** Phase 1 · **Branch:** `imp-17092026/phase-2-sqlite` · **ADRs:** 02, 03, 04, 10 (table only)
**Goal:** the foundation every feature stands on. After this phase the app behaves the same as
before (fuel, expenses, reminders, prices, backup), but everything lives in SQLite with the complete
Car Guy schema, and a Tu Combustible RD backup can be imported.

> **Before running:** Phase 1 merged. Xaviel's real backup at
> `docs/imp-17092026/fixtures/tu-combustible-rd-backup.real.json` (gitignored) if available; the
> sample fixture from Phase 0 otherwise.
>
> **How to run:** `cd /home/xaviel/dev2/tu-gasolina-rd && claude`, paste below the line.

---

```
Phase 2 of IMP 17092026: move persistence from the AsyncStorage JSON blob to SQLite with the full
Car Guy schema, keep every existing feature working, and implement the Tu Combustible RD importer.

Read first:
- CLAUDE.md → AGENTS.md — then READ https://docs.expo.dev/versions/v57.0.0/sdk/sqlite/ in full,
  including the web section and the Metro config diff it links.
- docs/imp-17092026/02-specs/01-data-model.md   ← the schema and rules; authoritative
- docs/imp-17092026/00-context/03-architecture-decisions.md (ADR-02, 03, 04, 10)
- docs/imp-17092026/01-research/03-expo57-technical.md §1 (storage: web worker/OPFS, async-only,
  pitfalls, migration snippet)
- lib/store.tsx, lib/storage.ts, lib/types.ts, lib/backup.ts (the code being replaced)
- docs/imp-17092026/00-context/04-conventions.md

Branch: imp-17092026/phase-2-sqlite

Requirements:

1. SQLITE SETUP (ADR-02)
   - npx expo install expo-sqlite (already a dep; make sure it is the SDK-57 version). Metro:
     create metro.config.js from expo/metro-config, push 'wasm' to resolver.assetExts, add the
     dev-server COOP/COEP middleware from the docs diff (dev only; production does not need it
     because we use the async API only).
   - lib/db/client.ts: `openDatabaseAsync('carguy.db', { enableChangeListener: true })` once;
     export `getDb()`; a `writeQueue` that serialises every mutation (`enqueue(fn)` running
     `withTransactionAsync` one at a time). NEVER use *Sync methods or withExclusiveTransactionAsync
     (throws on web).
   - lib/db/migrations.ts: `MIGRATIONS: { version: number; up: string[] }[]` applied with PRAGMA
     user_version in a transaction; v1 = the complete schema in 01-data-model.md §1 (all tables,
     indexes, the history_feed view, PRAGMAs). Write the SQL exactly; add nothing, drop nothing.
   - app/_layout.tsx: wrap the tree in <SQLiteProvider databaseName="carguy.db" onInit={migrate}
     options={{ enableChangeListener: true }} useSuspense> inside <Suspense fallback={<Splash/>}>.
     Keep StoreProvider for now but make it read/write through repos (step 3).
   - Web verification is mandatory: `npx expo start --web`, create a vehicle, reload → it persists
     (OPFS). Then `npm run build` and serve dist/ locally (npx serve dist or a tiny node server) to
     confirm the exported worker + wasm load without COOP/COEP headers. Check public/sw.js: the
     SQLite worker and .wasm under /_expo/ must not be served cache-first from an old cache — use
     network-first or stale-while-revalidate for /_expo/static/js/web/*.js that contain "worker",
     and never fall back to index.html for them. Document the rule in a comment.

2. REPOSITORIES (lib/db/repos/*.ts) — typed, promise-based, no SQL outside this folder
   vehicles, vehicleSpecs, odometer, fuel, serviceTypes, serviceRecords (+items, +parts), expenses,
   reminders, inspectionTemplates (+items), inspections (+results), tasks, documents, media, settings.
   Each: list(vehicleId?, opts), getById, upsert(input) (sets id if missing via lib/format id(),
   created_at on insert, updated_at ALWAYS, synced_at = null), softDelete(id), and where needed
   restore(id). All reads filter deleted_at IS NULL. `settings.get<T>(key, fallback)` / `set`.
   fuel.upsert and serviceRecords.upsert also upsert the matching odometer_reading (source, source_id)
   when odometer_km is present (01-data-model.md §3.1). history.feed(vehicleId, {kinds, from, to, q})
   reads the view.
   Types: lib/db/types.ts mirrors the tables (snake_case columns → camelCase TS via small mappers in
   each repo). Keep lib/types.ts exporting FuelType/FUEL_TYPES etc.; mark Vehicle/FillUp/Expense/
   MaintenanceReminder/AppData there as `Legacy*` types used only by the importer.

3. STORE REWIRE — same hooks, new engine
   Rewrite lib/store.tsx so `useStore()` keeps its current surface (ready, data-like selectors,
   activeVehicle, vehicleFillups, vehicleExpenses, vehicleReminders, upsert*/delete*, updateSettings,
   restoreData, resetAll, setActiveVehicle) but is backed by repos: state is loaded from SQLite on
   mount and refreshed after each mutation and on addDatabaseChangeListener. Legacy `Expense` with
   category maintenance/repair now come from service_record (kind mantenimiento/reparacion) — keep
   the gastos.tsx screen working by adapting the mapping inside the store (the screen is replaced in
   Phase 4 anyway). `deleteX` → softDelete. `resetAll` → hard delete everything + media files (this
   is the only hard delete in the app). Remove lib/storage.ts's save/load usage; keep the KEY constant
   exported for the importer.

4. SEEDING (01-data-model.md §3.4, §3.5, §3.3)
   lib/domain/catalog.ts: SERVICE_TYPES (the table in §3.4 with ids, names, categories, intervals,
   applies_to, seedReminder), INSPECTION_TEMPLATES (§3.5 — take items/how/warning/cold-engine from
   docs/imp-17092026/01-research/02-maintenance-checklists-dr.md §A.2, A.4, A.5, faithfully),
   EXPENSE_CATEGORIES (§3.6). lib/db/seed.ts: idempotent `seedCatalog()` (insert seeded service
   types/templates/items where missing, is_seeded=1) run after migrations; and
   `seedVehicleDefaults(vehicleId)` creating the default recurring reminders + DR legal reminders
   per §3.3 (marbete due next 31 Jan, seguro/licencia with null due → sin_datos, revisión técnica
   disabled). Call seedVehicleDefaults from vehicles.upsert on INSERT (not update) and from the
   importer. Tests: __tests__/domain/catalog.test.ts asserts ids are unique and every seedReminder
   has at least one interval.

5. LEGACY IMPORTER (01-data-model.md §2) — lib/import/tucombustible.ts
   `importTuCombustible(payload, { source: 'file' | 'asyncstorage' })` accepts the wrapped backup
   or raw AppData, validates shape (reject with a Spanish message otherwise), maps per the table in
   §2 (ids preserved, updated_at = createdAt, odometer readings created, Expense→service_record or
   expense by category, reminders mapped, settings), runs in ONE transaction, idempotent
   (re-import = no duplicates: upsert by id), returns counts. Then seedVehicleDefaults for each
   imported vehicle, skipping titles already present. Store `legacy_import_done` with exportedAt.
   - On web only: at first launch, if AsyncStorage has 'tu-combustible-rd/v1' and no vehicles exist
     in SQLite, import it silently and show a one-time toast "Importamos tus datos de Tu Combustible RD".
   - UI: in app/onboarding.tsx add a second action "Importar respaldo de Tu Combustible RD" (document
     picker → importer → summary alert with counts → go to tabs); the same action lives in Más →
     Datos. Web: file input via expo-document-picker web (user gesture).
   - Tests: __tests__/import/tucombustible.test.ts with the Phase 0 fixture (in-memory sqlite is not
     available under jest-expo — test the pure mapping functions: map fixture → row arrays, assert
     counts, categories, metrics, idempotency of the mapper). If Xaviel's real backup exists at
     docs/imp-17092026/fixtures/tu-combustible-rd-backup.real.json, ALSO run a manual import of it in
     the web app and report the counts vs the file's array lengths.

6. BACKUP v2 (lib/backup.ts)
   Export: { app: 'car-guy', version: 2, exportedAt, tables: { vehicle: [...], fuel_log: [...],
   ... every table incl. tombstones, setting } } — media bytes excluded (rel_path/ids only; note it
   in the file). Android: expo-file-system File + expo-sharing (existing); WEB: build a Blob and
   trigger a download with an <a download> (expo-file-system is a stub on web — the current export
   silently does nothing there; fix that). Import: detect version 1 (→ legacy importer) or 2 (→
   upsert by id with LWW on updated_at = MERGE, never wipe; offer "Reemplazar todo" as a separate
   destructive option). Show counts after import.

7. VERIFY on web AND Android (Expo Go): onboarding → vehicle → several cargas (full + partial) →
   km/gal identical to the pre-migration behaviour (compare with the tests) → gastos + recordatorio
   → precios → export v2 → "Borrar todo" → import v2 → everything back → import the legacy fixture →
   counts match → reload persists. `npx tsc --noEmit`, `npx expo lint`, `npm test`, `npm run build`
   green. Record OPFS persistence proof (reload after data) and the served-dist check.

8. Update README.md "Datos al actualizar" for SQLite (carguy.db; backups v2; legacy import).
   Report in PROGRESS.md (block), commit small, merge to main, push.
```

---

## Acceptance criteria

- [ ] `carguy.db` created with schema v1 exactly as the spec; `PRAGMA user_version = 1`.
- [ ] Async API only; a grep for `Sync(` on `expo-sqlite` calls and `withExclusiveTransactionAsync` finds nothing.
- [ ] Works on web (OPFS) in dev **and** from the static export served locally; SW rule documented.
- [ ] Repos for every table; no SQL in screens/components; every read excludes tombstones; `updated_at` set on every write.
- [ ] `useStore()` surface unchanged; every legacy screen works as before; economy numbers identical.
- [ ] Catalog + templates seeded idempotently; a new vehicle gets its default reminders and DR legal items.
- [ ] Legacy importer: wrapped/raw formats, idempotent, counts reported, odometer readings created, categories mapped; onboarding + Más entry points; web AsyncStorage auto-import.
- [ ] Backup v2 export works on Android and **web**; import merges (v2) or delegates (v1); "Reemplazar todo" separate.
- [ ] Tests for economy (existing), catalog, import mapping; lint/tsc/build green.
- [ ] Real backup import (if provided) counts match the file.

## Watch for

- `expo-sqlite` web needs **bundle splitting** (default) — do not set `EXPO_NO_METRO_LAZY`.
- OPFS requires a secure context: `localhost` and HTTPS are fine; a LAN IP over HTTP is **not** (expected error, not a bug).
- `withTransactionAsync` includes any concurrent query — hence the write queue. Do not run reads inside the queue that await UI state.
- Legacy ids like `id_1723_ab12` are valid `TEXT` keys; never re-key imported rows.
- Local-noon ISO for day inputs (`isoFromDateInput`) — keep; SQLite string comparison of ISO works because of the fixed format.
- BLOB inserts on web need `Uint8Array`, not `ArrayBuffer`.
- Safari can evict OPFS → the v2 export on web is not optional.

## Notes for later phases

Record: repo API names, the mapper functions, the write-queue location, the SW rule, and how to add a migration (v2 template).
