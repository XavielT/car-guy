# Cloud v3 — x-core, schema `carguy` (IMP 29092026)

> **Renumbered (Phase 2, 2026-09-29).** 2.1.3 used `sql/018` for Car Guy-only accounts
> (`018_app_membership.sql`). Everything below moved up one: **§018 → `019_schema_v3.sql`,
> §019 → `020_rls_v3.sql`, §020 → `021_feedback.sql`** (Phase 6). Any new carguy table also needs
> 018's restrictive `carguy_app_only` policy (020 gives it to `trip`).

Additive only. `node tools/apply-sql.mjs sql/0NN_*.sql` is the only write path; `--shared` only
for the statements listed here (storage bucket for feedback). Music Hub (`public`) untouched.
After every file: `node tools/verify-x-core.mjs`, `node tools/verify-sync.mjs`,
`tools/local-rls/run.sh` (add the new checks there first — it runs without touching x-core).

## `sql/018_schema_v3.sql` (Phase 2)

- `carguy.vehicle`: `volume_unit`, `economy_unit`, `reserve_volume_l`, `tank_l`, `tank_volume_entered`,
  `status_note`, `status_since`, `body_type`, `color_id`, `interior_color_id`, `interior_material`,
  `make_id`, `model_id`, `limit_kmh`, `trip_mode`, `schema_hint text`.
- `carguy.album_item`: `role text not null default 'album'`.
- `carguy.fuel_log`: `gauge_before_eighths smallint check (between 0 and 8)`, `gauge_after_eighths`,
  `in_reserve boolean default false`, `volume_l numeric`, `price_per_l numeric`, `volume_entered`,
  `volume_entered_unit`, `schema_hint`.
- `carguy.service_record_item`: `oil_viscosity`, `oil_type`, `oil_spec`, `oil_brand`.
- `carguy.trip` (same columns as local minus nothing; `user_id`, `updated_by`, `schema_hint`),
  index `(user_id, vehicle_id, started_at desc)`.
- `carguy.vehicle_status_change`? **No** — status changes are `milestone` rows (kind `estado`), already synced.
- Triggers: the existing `set_updated_at` / `set_updated_by` pattern applied to `trip`.

## `sql/019_rls_v3.sql` (Phase 2)

- `trip`: the four owner policies + member read/write via `is_member(vehicle_id, 'editor')`,
  same shape as `track_event` (copy, do not invent). The public dossier (`sql/012` view) **does
  not** expose trips; a later option "mostrar km por viajes" is out of scope.
- `local-rls` checks: owner CRUD on trip, editor member can insert a trip on a shared car, viewer
  cannot, outsider sees nothing, public view has no `trip` column.

## `sql/020_feedback.sql` (Phase 6) — read before approving

```sql
create table carguy.feedback (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  kind text not null check (kind in ('bug','idea','otro')),
  message text not null check (char_length(message) between 5 and 4000),
  app_version text, build text, platform text, os_version text, device text,
  screen text,                         -- route the user was on
  diagnostics jsonb,                   -- flags, db version, sync state; never secrets
  device_id text not null,             -- random uuid stored on the device
  user_id uuid references auth.users(id) on delete set null,
  email text,                          -- optional, typed by the user
  screenshot_path text,                -- carguy-feedback/<device_id>/<id>.jpg
  status text not null default 'new' check (status in ('new','seen','done')),
  admin_note text
);
alter table carguy.feedback enable row level security;
-- nobody inserts directly; the RPC does
create or replace function carguy.submit_feedback(p jsonb) returns void
language plpgsql security definer set search_path = carguy, pg_temp as $$
begin
  if (select count(*) from carguy.feedback
      where device_id = p->>'device_id' and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'rate_limited';
  end if;
  insert into carguy.feedback (kind, message, app_version, build, platform, os_version, device, screen,
                               diagnostics, device_id, user_id, email)
  values (p->>'kind', p->>'message', p->>'app_version', p->>'build', p->>'platform', p->>'os_version',
          p->>'device', p->>'screen', p->'diagnostics', p->>'device_id', auth.uid(), nullif(p->>'email',''));
end $$;
revoke all on function carguy.submit_feedback(jsonb) from public;
grant execute on function carguy.submit_feedback(jsonb) to anon, authenticated;
-- read: own rows, or admin
create policy feedback_select_own on carguy.feedback for select to authenticated
  using (user_id = auth.uid() or lower(auth.jwt() ->> 'email') = 'tecnologia@constructorasd.com');
create policy feedback_update_admin on carguy.feedback for update to authenticated
  using (lower(auth.jwt() ->> 'email') = 'tecnologia@constructorasd.com')
  with check (lower(auth.jwt() ->> 'email') = 'tecnologia@constructorasd.com');
```

`--shared` part (storage): bucket `carguy-feedback` (private, `file_size_limit` 2 MB,
`allowed_mime_types` image/jpeg), policy: insert for `anon, authenticated` where
`bucket_id = 'carguy-feedback'` and the path's first folder equals the `device_id` sent in the
object metadata? Storage policies cannot read the RPC payload — simpler: **insert allowed for
anyone into `carguy-feedback/<uuid>/…` with size ≤ 2 MB**, no select except the admin
(`lower(auth.jwt()->>'email') = …`). Abuse surface is bounded by the size limit and by the app
only uploading after a successful RPC. Statements listed verbatim in PROMPT-06.

`verify-x-core` additions: 24 anon RPC insert ok, 25 sixth insert in an hour → `rate_limited`,
26 anon cannot select, 27 owner sees own row, 28 admin email sees all (uses a throwaway user with
the admin email? **No** — never create an account with Xaviel's email; the admin check is
covered by `local-rls` with a shimmed JWT claim, and live only by Xaviel signing in).

## `sql/021_trip_odometer.sql` — not needed

`odometer_reading.source` is text; `'trip_estimate'` needs no DDL. Listed so nobody looks for it.

## Sync protocol changes (`lib/sync/engine.ts`, `merge.ts`)

1. **Schema gate (ships in 2.1.3, Phase 1):** on pull, a row with `schema_hint` newer than the
   client's `SCHEMA_HINT` constant is skipped and counted; the Cuenta screen shows "Hay N cambios
   de una versión más nueva. Actualiza la app." Push is unaffected.
2. **Unit bridge (Phase 2):** 2.2 writes `volume_l`/`tank_l`/`price_per_l` **and** the legacy
   columns in gallons (so a 2.1.3 device still sees sane numbers if it ignores the hint — it
   won't, but belt and braces), reads `volume_l` when present else converts.
3. `trip` joins the ordered table list after `track_session`; `trip_point` never leaves the phone.
4. `verify-sync` 18–20: hinted row skipped by an old client (simulated by setting the constant),
   liters round-trip, trip row LWW.
