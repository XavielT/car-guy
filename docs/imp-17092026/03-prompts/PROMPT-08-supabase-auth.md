# PROMPT 08 — `x-core` schema `carguy`, app-aware signup trigger, optional account

**Depends on:** Phase 2 (schema), ideally Phase 7 · **Branch:** `imp-17092026/phase-8-cuenta` · **ADRs:** 05, 06
**Goal:** G7 part 1 — the account exists and is optional; the cloud schema exists with RLS; Music
Hub is untouched except the one `IF`.

> **Before running (manual, Xaviel):** Supabase dashboard → project `x-core` → SQL editor open;
> Project Settings → API → have the URL and anon key ready and put them in `.env.local` as
> `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY`. Claude Code cannot run SQL on
> `x-core` by itself unless `npx supabase login` + `supabase link` are set up; the prompt writes the
> SQL files and asks you to run them, then verifies through the API.
>
> **How to run:** `cd /home/xaviel/dev2/tu-gasolina-rd && claude`, paste below the line.

---

```
Phase 8 of IMP 17092026: cloud foundation on Supabase project x-core — schema carguy with RLS, the
app-aware signup trigger, Storage bucket, and the optional account UI in the app.

Read first:
- docs/imp-17092026/02-specs/02-supabase-carguy.md  ← authoritative for every SQL statement
- docs/imp-17092026/00-context/03-architecture-decisions.md (ADR-05, ADR-06)
- /home/xaviel/improvements/imps xaviel-web/september 2026/imp 11092026/04-tracking/PROGRESS.md
  (x-core facts: email confirmation OFF, detectSessionInUrl false, public.profiles select using(true),
  the invite-only blocker, the tucombustible probe schema)
- /home/xaviel/improvements/imps music hub/imp mh 03092026/00-context.md (Music Hub on x-core)
- docs/imp-17092026/00-context/04-conventions.md (secrets; never touch Music Hub beyond the IF)

Branch: imp-17092026/phase-8-cuenta

Requirements:

1. DISCOVERY SQL (read-only) — write sql/000_inspect.sql with the queries from the spec §2 (function
   definition of enforce_invite_only, its trigger, Music Hub's profile trigger, existing schemas,
   exposed schemas cannot be read via SQL — note it). Ask me to run it in the SQL editor and paste
   the output into docs/imp-17092026/04-tracking/x-core-inspect.txt (gitignored). Wait for that
   file before writing 001 — this is the one legitimate pause in the cycle, because the trigger
   body must be copied exactly. While waiting, do steps 4–5 (client + UI) which do not depend on it.

2. MIGRATIONS (repo folder sql/, applied by me in the SQL editor in order; each file idempotent
   and with a "-- rollback:" block at the end):
   - sql/001_invite_trigger_app_aware.sql: CREATE OR REPLACE of public.enforce_invite_only() =
     original body with the single `if coalesce(new.raw_user_meta_data->>'app','') = 'carguy' then
     return new; end if;` inserted at the top (spec §2). The original body goes in a comment block
     as rollback.
   - sql/002_schema_carguy.sql: schema, grants, profiles + handle_new_user trigger, every table from
     01-data-model.md §1 mirrored per spec §3 (text ids, user_id default auth.uid(), timestamptz,
     server_updated_at + trigger, no synced_at, setting keyed (user_id,key), media without blob),
     indexes.
   - sql/003_rls.sql: RLS + four policies per table + grants + default privileges (spec §3).
   - sql/004_storage.sql: bucket carguy-media (private) + per-user folder policies.
   - sql/005_lww.sql: before-update trigger per table keeping the row with the greater updated_at
     (spec §5 "server-side LWW").
   - sql/rollback.sql (spec §6).
   - Also generate database types after I apply them: `npx supabase gen types typescript --project-id
     <ref> --schema carguy > lib/cloud/database.types.ts` (write via temp file, fail loudly — the
     xaviel-web PROGRESS notes why). If the CLI is not logged in, hand-write minimal types for the
     tables the client uses and note it.

3. VERIFY THE TRIGGER BOTH WAYS (spec §2) with curl against https://<ref>.supabase.co/auth/v1/signup
   using the anon key: (a) data.app='carguy' → 200 + session; (b) no data → the same P0001 message as
   before. Record both responses (redact tokens) in PROGRESS.md. Then delete the test users with a
   SQL statement I run. Check whether Music Hub's profile trigger created public.profiles rows for
   the test user and report.

4. CLIENT — npx expo install @supabase/supabase-js (and react-native-url-polyfill if the SDK 57 docs
   for Supabase in Expo still require it; check https://supabase.com/docs/guides/getting-started/tutorials/with-expo-react-native).
   lib/cloud/supabase.ts per spec §4 (schema 'carguy', kv-store/AsyncStorage adapter on native,
   localStorage on web, persistSession, autoRefreshToken, detectSessionInUrl false). .env.example
   with both EXPO_PUBLIC_ vars and comments. lib/cloud/auth.ts: signUp (with options.data.app =
   'carguy' and display_name), signIn, signOut (keeps local data; clears setting.auth_user_id),
   resetPassword (email — note email confirmation/reset templates are shared project-level; report
   what the reset email looks like), useSession().

5. UI — app/cuenta.tsx (from Más → Cuenta and onboarding card): state signed-out (copy from
   05-design-identity.md voice: "Sin cuenta la app funciona igual…"), forms sign in / crear cuenta
   (email, password ≥ 8, show/hide), errors in Spanish (map Supabase messages: invalid credentials,
   user exists, weak password, network), signed-in state (email, "Última sincronización: —" until
   Phase 9, "Cerrar sesión", danger zone "Borrar datos locales"). Onboarding: dismissible card after
   the first vehicle. Más → Cuenta row shows the state.
   Phase 8 does NOT sync data; after sign-in show "Tus datos se sincronizarán en la próxima
   actualización" only in dev; in prod hide the sync line until Phase 9 ships (feature flag
   FEATURE_SYNC=false in lib/flags.ts).

6. RLS NEGATIVE TESTS (spec §3): with two throwaway users via the API, insert a vehicle as A, select
   as B → 0 rows; B inserts with user_id = A → 42501; anon select → 401/42501. Record in PROGRESS.md;
   delete the users.

7. Optional cleanup: drop schema tucombustible (only the probe table exists per imp 11092026) —
   include it as sql/006_drop_tucombustible_probe.sql, clearly optional; I decide when to run it.

8. tsc/lint/test/build green (web build must not embed the anon key anywhere unexpected — it is fine
   in the bundle). Fuel flow verified. Report (include the exact manual steps performed and their
   results), merge, push.
```

---

## Acceptance criteria

- [ ] `sql/000…006` written; 001 contains the original trigger body as rollback; applied by Xaviel.
- [ ] Car Guy signup succeeds; bare signup still fails with the same error; recorded.
- [ ] Schema `carguy` with all tables, RLS, grants, LWW trigger, Storage bucket + policies; negative tests recorded.
- [ ] `carguy` added to exposed schemas (manual) and confirmed via a `select` through the API (no `PGRST106`).
- [ ] Client + auth module + Cuenta screen; account fully optional; sign-out keeps local data.
- [ ] Types generated or hand-written with a note.
- [ ] Music Hub sign-in and invite behaviour unchanged (Xaviel confirms by signing in to Music Hub once).
- [ ] lint/tsc/test/build green.

## Watch for

- `x-core` is production for Music Hub: **no `drop`, no `alter` on `public.*`** beyond `create or replace function public.enforce_invite_only()`.
- If the function is `security definer`, keep it so, and keep `search_path` pinned.
- Supabase `raw_user_meta_data` is set from `options.data` at signup; it is user-controlled, which is fine here (it only opens signup, never grants privileges).
- Do not turn email confirmation on; it would change Music Hub's flow.
- Web: `localStorage` may throw in private mode — wrap the storage adapter.
