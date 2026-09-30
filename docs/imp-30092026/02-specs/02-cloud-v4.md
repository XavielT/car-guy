# Cloud v4 — x-core, schema `carguy` (IMP 30092026)

Additive only; `node tools/apply-sql.mjs`; `--shared` only where listed; `local-rls` first.
Existing numbering: 018 membership, 019–020 schema v3, 021 feedback, 022 share, 023 inventory,
024 roles. New:

## `sql/025_schema_v4.sql` (Phase 2)

- `carguy.fuel_price` (user rows, `user_id`, `updated_by`, `schema_hint`), index `(user_id, fuel_type, valid_from desc)`.
- `carguy.milestone` + event columns (1.2).
- `carguy.vehicle_specsheet` + "what I buy" columns (1.3); `carguy.vehicle_fact` (member-readable like torque_spec).
- `carguy.profiles` + `avatar_id text`, `avatar_path text`, `locale text` (check `display_name` exists; add if not).
- `carguy.legal_acceptance` (owner-only).
- `carguy.vehicle_share` + `show_tires boolean default false`; `public_dossier()` gains `tires` (count, badges) when on.
- `carguy.trip` + `diagnostics jsonb`.

## `sql/026_rls_v4.sql` (Phase 2)

Owner policies for `fuel_price`, `vehicle_fact`, `legal_acceptance`; member read (editor write)
for `vehicle_fact` copying `torque_spec`'s policies; nothing for `fuel_price_ref` here.
`local-rls` checks: owner CRUD ×3, member read/write on facts, viewer denied, outsider nothing,
public dossier shows tires only with the switch.

## `sql/027_fuel_price_ref.sql` (Phase 5) — read before approving

```sql
create table carguy.fuel_price_ref (
  week_start date not null, week_end date not null, fuel_type text not null,
  price numeric not null, source text not null default 'micm', pdf_url text, raw_text text,
  imported_at timestamptz not null default now(), stale boolean not null default false,
  primary key (week_start, fuel_type)
);
alter table carguy.fuel_price_ref enable row level security;
create policy fuel_price_ref_read on carguy.fuel_price_ref for select to anon, authenticated using (true);
-- writer: a dedicated role used only by api/precios.ts
create role carguy_importer nologin;                       -- --shared (roles are cluster-wide)
grant usage on schema carguy to carguy_importer;
create or replace function carguy.upsert_fuel_price_ref(rows jsonb) returns integer
language plpgsql security definer set search_path = carguy, pg_temp as $$ … insert … on conflict (week_start, fuel_type) do update … $$;
revoke all on function carguy.upsert_fuel_price_ref(jsonb) from public;
grant execute on function carguy.upsert_fuel_price_ref(jsonb) to carguy_importer;
```

How the function authenticates: PostgREST maps a JWT `role` claim to a Postgres role; mint a
long-lived JWT with `role: 'carguy_importer'` using the project's JWT secret (**Xaviel does this
once** in the Supabase dashboard → Settings → API → JWT secret → any JWT tool locally; the token
goes to Vercel env `CARGUY_IMPORTER_JWT`). `carguy_importer` must be granted to `authenticator`
(`grant carguy_importer to authenticator;` — `--shared`). If Xaviel prefers not to touch roles,
fallback = `SUPABASE_SERVICE_ROLE_KEY` in Vercel for this function only (ADR-38). Either way the
web bundle must not contain it (`check-bundle-env` asserts).

`verify-x-core` additions: anon can read `fuel_price_ref`; anon cannot insert; the importer RPC
inserts and upserts; the public dossier `tires` block obeys the switch.

## `sql/028_delete_account.sql` (Phase 6) — read before approving

`carguy.delete_my_account()` security definer: deletes the caller's rows in every `carguy` table
(order by FKs), their Storage objects (`carguy-media/<uid>/…`, avatars, feedback screenshots by
user_id), the `carguy.profiles` row, then `auth.users` via `auth.admin`? — **No**: deleting from
`auth.users` inside SQL needs the `supabase_auth_admin` role; instead the RPC marks
`profiles.deletion_requested_at` and deletes all `carguy` data + objects; the auth user itself is
removed by a Vercel function `api/eliminar-cuenta.ts` (service role, Vercel env) called by the app
right after, or by Xaviel from the admin panel ("Cuentas por eliminar"). Music Hub untouched: the
function refuses if the user has no `carguy.profiles` row (not a Car Guy account). `local-rls`:
a user deleting sees their rows gone and another user's intact.

## Sync

`fuel_price`, `vehicle_fact`, `legal_acceptance` join `SYNC_TABLES`; `milestone` new columns in
`BOOLEAN_COLUMNS`? none boolean; `fuel_price_ref` pulled by a dedicated fetch (not the sync
engine); `verify-sync` 21–23 for the three new tables.
