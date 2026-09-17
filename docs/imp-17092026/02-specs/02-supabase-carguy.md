# Spec — Cloud: `x-core` schema `carguy`, auth, RLS, sync protocol

Authoritative for PROMPT-08 (schema + auth) and PROMPT-09 (sync). Applies ADR-03, ADR-05, ADR-06.
**`x-core` is prod and dev at once** (there is no staging project) — every statement here is
written to be additive and reversible, and to leave Music Hub untouched.

## 1. Facts about `x-core` (from `imp 11092026/04-tracking/PROGRESS.md`, verified 2026-09)

- Auth: email + password; **email confirmation OFF** (`/auth/v1/signup` returns a session
  immediately). Leaked-password protection disabled (project-level; not ours to change).
- `auth.users` has Music Hub's trigger **`enforce_invite_only`** → raises
  `P0001 'Sign-ups are invite-only…'` unless the email is in `public.allowed_emails`.
- Music Hub owns `public.profiles` (SELECT `using (true)` for authenticated — do not put anything
  private there), `public.is_admin()`, `public.allowed_emails`, a profile-creating signup trigger.
- xaviel-web owns `public.site_admins`, `public.is_site_admin()`, and the empty schema
  `tucombustible` (one probe table `schema_check`, "Phase 5 may drop it").
- Exposed schemas today: `public` and `tucombustible`. `carguy` must be added by hand
  (Project Settings → API → Exposed schemas) — the API returns `PGRST106` until then.

## 2. Signup trigger — the one change to shared code (ADR-06)

Before writing anything: `select pg_get_functiondef(oid) from pg_proc where proname = 'enforce_invite_only';`
and `select tgname, tgrelid::regclass, tgenabled from pg_trigger where tgname ilike '%invite%';` —
copy the **current function body into the migration file as the rollback**.

Target behaviour, expressed as the minimal diff to the existing function:

```sql
create or replace function public.enforce_invite_only()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- Car Guy (and any future app that sets raw_user_meta_data.app) has open signup.
  if coalesce(new.raw_user_meta_data->>'app', '') = 'carguy' then
    return new;
  end if;
  -- ===== existing body, unchanged from here =====
  ...
end $$;
```

Keep everything after the `if` byte-for-byte identical to the current body (same error message,
same `allowed_emails` lookup). The client sends the flag as
`supabase.auth.signUp({ email, password, options: { data: { app: 'carguy' } } })`.

Verification (both, from `curl` against `/auth/v1/signup` with the anon key):
1. `{"email": "<random>@example.com", "password": "…", "data": {"app": "carguy"}}` → **200 with a
   session**.
2. Same email pattern **without** `data` → **the same P0001 error as today**.
3. Delete the test users afterwards (SQL `delete from auth.users where email like 'carguy-test-%'`).

Also check whether Music Hub's profile trigger inserted a `public.profiles` row for the test user
in (1). If it did, that is acceptable (report it) unless it errors — in which case guard *that*
trigger with the same `app` check and report it as a second shared-code change.

## 3. Schema `carguy`

```sql
create schema if not exists carguy;
grant usage on schema carguy to authenticated;
-- anon gets nothing.

create table carguy.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create or replace function carguy.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(new.raw_user_meta_data->>'app','') = 'carguy' then
    insert into carguy.profiles(user_id) values (new.id) on conflict do nothing;
  end if;
  return new;
end $$;
create trigger carguy_on_auth_user_created after insert on auth.users
  for each row execute function carguy.handle_new_user();
```

Every synced table mirrors the local one with these differences: `user_id uuid not null default
auth.uid()`, `id text primary key` (legacy ids are not UUIDs), timestamps `timestamptz` (client
sends ISO), **no** `synced_at`, plus `server_updated_at timestamptz not null default now()`
maintained by a `before update` trigger (used for pull cursors). Tables:

`vehicle, vehicle_spec, odometer_reading, fuel_log, service_type, service_record,
service_record_item, part, expense, reminder, inspection_template, inspection_item, inspection,
inspection_result, task, document, media, setting`.

- `setting` in the cloud is `(user_id, key) primary key, value jsonb, updated_at` and only carries
  `reference_prices`, `price_week_label`, `theme` — never `active_vehicle_id` (device-local).
- `media` in the cloud has no `blob`; bytes live in Storage: bucket **`carguy-media`** (private),
  object path `<user_id>/<media_id>.<ext>`; policies: `authenticated` can `select/insert/update/
  delete` where `(storage.foldername(name))[1] = auth.uid()::text`.
- Seeded `service_type` / `inspection_template` / `inspection_item` rows are **per user** too
  (they are editable), so they carry `user_id` like everything else.

RLS template (apply to every table, generated by a small `do $$` loop or written out):

```sql
alter table carguy.<t> enable row level security;
create policy "<t>_own_select" on carguy.<t> for select to authenticated using (user_id = auth.uid());
create policy "<t>_own_insert" on carguy.<t> for insert to authenticated with check (user_id = auth.uid());
create policy "<t>_own_update" on carguy.<t> for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "<t>_own_delete" on carguy.<t> for delete to authenticated using (user_id = auth.uid());
grant select, insert, update, delete on all tables in schema carguy to authenticated;
alter default privileges in schema carguy grant select, insert, update, delete on tables to authenticated;
```

Indexes: `(user_id, server_updated_at)` on every table (pull cursor), `(user_id, vehicle_id)` where
applicable.

Negative tests (as a second throwaway user): selecting the first user's vehicles returns 0 rows;
inserting with a foreign `user_id` fails `42501`; anon `select` on any `carguy` table fails.

## 4. Client

- `lib/cloud/supabase.ts`: one client, `createClient(url, anon, { db: { schema: 'carguy' }, auth: {
  storage: <kv-store adapter on native | localStorage on web>, persistSession: true,
  autoRefreshToken: true, detectSessionInUrl: false } })`. `EXPO_PUBLIC_SUPABASE_URL`,
  `EXPO_PUBLIC_SUPABASE_ANON_KEY` from `.env` (Expo inlines `EXPO_PUBLIC_*`).
- `lib/cloud/auth.ts`: `signUp`, `signIn`, `signOut`, `useSession()` hook (`onAuthStateChange`).
  Sign-out keeps local data (ADR-05) and clears `setting.auth_user_id` + `last_sync_at`.
- Screens: *Más → Cuenta* (state, sign in / create account / sign out, last sync, "Sincronizar
  ahora", "Borrar datos locales" separate and red); onboarding shows a dismissible "Con cuenta tus
  datos te siguen" card.

## 5. Sync protocol (PROMPT-09) — offline-first, LWW, tombstones

Runs on: app foreground, after any local write (debounced 5 s), manual "Sincronizar ahora". Never
blocks the UI; status in *Más → Cuenta* and a small icon in the header.

**Push.** For each table in dependency order (`vehicle` → specs/readings/fuel/records → items/parts
→ reminders/templates/items → inspections/results → tasks → documents → media metadata → setting):
rows where `synced_at IS NULL OR updated_at > synced_at`, in batches of 200, `upsert(rows, {
onConflict: 'id' })` **including tombstones** (`deleted_at` set). Server-side LWW: a `before update`
trigger keeps the incoming row only if `new.updated_at >= old.updated_at`, otherwise returns `old`
(so a stale client cannot overwrite). On success set `synced_at = now()` locally.

**Pull.** Per table: `select * where server_updated_at > :cursor order by server_updated_at limit
500`, loop; cursor per table in `setting.sync_cursor.<table>`. Apply with LWW against the local
row (`incoming.updated_at > local.updated_at` → replace; equal → keep local; local dirty and newer →
keep local, it will push next). Tombstones apply as tombstones. Vehicles referenced by pulled
children are pulled first (order above).

**First sign-in with local data.** Nothing special: push runs first (everything is dirty), then
pull merges what the account already had. Two vehicles with different ids but the same name are
**both kept**; the UI surfaces a one-time "Tienes vehículos parecidos: ¿unir?" hint in PROGRESS as
a future item — do not auto-merge.

**Media.** Push metadata first; then upload bytes (`Paths.document/<rel_path>` or the `blob`) to
`carguy-media/<user_id>/<id>.<ext>` with `upsert: true`; set `remote_path`. Pull downloads lazily on
first display (web: fetch into `blob`; Android: into `Paths.document/media/...`), with a placeholder
while loading. Cap uploads to Wi-Fi? No — files are ≤ 300 KB after compression; upload anywhere.

**Failure handling.** Network errors → retry with backoff on the next trigger; `401` → refresh
session then retry once, then mark "Sesión expirada, inicia sesión de nuevo" (data stays local);
`PGRST106` → "El schema carguy no está expuesto" (a manual-step message for Xaviel, not the user).
Never delete local rows because the server lacks them.

**Reset.** "Borrar datos locales" wipes SQLite and media files but not the account; "Borrar datos en
la nube" (danger zone, double confirm) deletes the user's rows via `delete … where user_id =
auth.uid()` per table plus Storage objects, then clears cursors.

## 6. Rollback

`drop schema carguy cascade; drop trigger carguy_on_auth_user_created on auth.users; drop function
carguy.handle_new_user();` and restore `public.enforce_invite_only()` from the saved body. Keep
`sql/` in the repo: `sql/001_invite_trigger_app_aware.sql` (with the saved original as a comment
block), `sql/002_schema_carguy.sql`, `sql/003_rls.sql`, `sql/004_storage.sql`, `sql/rollback.sql`.
