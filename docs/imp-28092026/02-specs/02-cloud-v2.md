# Spec — Cloud v2: schema mirror, storage v2, public page, shared garage, sync changes

Authoritative for PROMPT-01 (§1–2), PROMPT-02 (§3), PROMPT-07 (§4–6). Applies ADR-17, 22, 23.
`x-core` is shared production — every file idempotent, additive in `carguy`, with a rollback block.

## 1. `sql/009_schema_v2.sql` — mirror of migration v2

Every new table from `01-data-model-v2.md` §1 as `carguy.<table>` with: `id text primary key`,
`user_id uuid not null default auth.uid()`, the snake_case columns, `created_at/updated_at/
deleted_at timestamptz`, `server_updated_at timestamptz not null default now()` + the existing
`before update` trigger (`005_lww.sql` pattern — reuse the function), indexes on
`(user_id, server_updated_at)` and `(user_id, vehicle_id)`. New `vehicle` and `media` and
`service_record` columns via `alter table … add column if not exists`. `dtc_code` is **not**
mirrored. `mod_category` and `venue` are per-user keyed like the catalogues (`primary key
(user_id, id)`, see `008_catalog_per_user_keys.sql`). Add `updated_by uuid` to every vehicle-scoped
table (nullable, set by the client from `auth.uid()` on push) — used by the shared garage UI.

## 2. `sql/010_rls_v2.sql` — own-rows policies for the new tables (same template as `003_rls.sql`);
PROMPT-07 later replaces the vehicle-scoped policies with `is_member` (§5). Also:

```sql
alter table carguy.profiles add column if not exists media_quota_bytes bigint not null default 314572800; -- 300 MB
create or replace function carguy.storage_usage_bytes() returns bigint
language sql stable security definer set search_path = '' as $$
  select coalesce(sum((o.metadata->>'size')::bigint), 0)
  from storage.objects o
  where o.bucket_id = 'carguy-media'
    and ((storage.foldername(o.name))[1] = (select auth.uid())::text
      or ((storage.foldername(o.name))[1] = 'v' and exists (
            select 1 from carguy.vehicle_member m
            where m.vehicle_id = (storage.foldername(o.name))[2] and m.user_id = (select auth.uid()) and m.role = 'owner')));
$$;
revoke all on function carguy.storage_usage_bytes() from public;
grant execute on function carguy.storage_usage_bytes() to authenticated;
```

## 3. `sql/011_storage_v2.sql` — thumbs, quota, vehicle paths (PROMPT-02)

- Objects: full `carguy-media/<user_id>/<media_id>.jpg` (existing) and thumb
  `carguy-media/<user_id>/<media_id>.thumb.jpg`; from PROMPT-07 new uploads use
  `carguy-media/v/<vehicle_id>/<media_id>[.thumb].jpg`.
- Insert policy on `storage.objects` for `carguy-media` extended with the quota check:
  `carguy.storage_usage_bytes() + coalesce((metadata->>'size')::bigint, 0) <= (select
  media_quota_bytes from carguy.profiles where user_id = auth.uid())`.
- `--shared` is required for this file (it touches `storage.objects` policies); the prompt lists
  the exact statements.

## 4. Public page (PROMPT-07)

```sql
alter table carguy.vehicle add column if not exists share_enabled boolean not null default false;
alter table carguy.vehicle add column if not exists public_slug text unique;
create or replace view carguy.public_vehicle with (security_invoker = true) as
  select v.public_slug as slug, v.make, v.model, v.year, v.nickname, v.color, v.chassis_code, v.engine_code,
         v.story, v.hero_media_id, v.updated_at,
         s.show_plate, s.show_vin, s.show_costs, s.show_odometer, s.show_maintenance, s.show_mods, s.show_track, s.show_story,
         case when s.show_plate then v.plate end as plate
  from carguy.vehicle v join carguy.vehicle_share s on s.vehicle_id = v.id
  where v.share_enabled and v.public_slug is not null and s.visibility in ('link','public') and s.revoked_at is null;
grant select on carguy.public_vehicle to anon, authenticated;
create policy "public share read" on carguy.vehicle for select to anon using (share_enabled and public_slug is not null);
create policy "public share read" on carguy.vehicle_share for select to anon using (visibility in ('link','public') and revoked_at is null);
-- plus anon select policies on mod, milestone, track_event, service_record limited to vehicles where share_enabled,
-- each gated by the matching show_* flag through a join on vehicle_share; costs columns excluded via views
-- carguy.public_mod / public_service / public_track (security_invoker) that project only safe columns.
```

Public bucket `carguy-public` (public read; no `select` policy on `storage.objects` for anon so
the bucket can't be listed; `insert/delete` for `authenticated` where `(storage.foldername(name))[1]
in (select public_slug from carguy.vehicle where user_id = auth.uid() or is_member(id,'owner'))`).
Enable = copy chosen photos (`share_media` list ≤ 24 + hero) to `carguy-public/<slug>/…`, write
`published_at`; revoke = delete objects, `revoked_at = now()`, `public_slug = null` (re-enable
mints a new slug).

Web: `api/c/[slug].ts` (Vercel Node function; `vercel.json` rewrite `{"source": "/c/:slug",
"destination": "/api/c/:slug"}` placed **before** the SPA rules) fetches `public_vehicle` and the
public views with the anon key, renders a self-contained dark HTML dossier (inline CSS, the JDM
tokens, Saira/Rajdhani via Google Fonts link) with `<meta property="og:title|og:description|
og:image|og:url">` and `twitter:card summary_large_image`; `og:image` = hero from
`carguy-public`. Cache `s-maxage=300, stale-while-revalidate=86400`. 404 page for unknown/revoked
slugs. The app's share sheet sends `https://car-guy.vercel.app/c/<slug>`.

## 5. Shared garage (PROMPT-07)

```sql
create table if not exists carguy.vehicle_member (
  vehicle_id text not null, user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','editor','viewer')), display_name text,
  created_at timestamptz default now(), updated_at timestamptz default now(), deleted_at timestamptz,
  server_updated_at timestamptz not null default now(),
  primary key (vehicle_id, user_id));
create table if not exists carguy.vehicle_invite (
  code text primary key, vehicle_id text not null, role text not null default 'editor', email text,
  expires_at timestamptz not null default now() + interval '7 days', created_by uuid not null, used_by uuid, used_at timestamptz);
create or replace function carguy.is_member(v text, min_role text default 'viewer') returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from carguy.vehicle_member m
    where m.vehicle_id = v and m.user_id = (select auth.uid()) and m.deleted_at is null
      and case min_role when 'viewer' then true when 'editor' then m.role in ('owner','editor') else m.role = 'owner' end);
$$;
-- backfill: every existing vehicle gets an owner row for its user_id
insert into carguy.vehicle_member (vehicle_id, user_id, role)
  select id, user_id, 'owner' from carguy.vehicle on conflict do nothing;
-- redeem_invite(code) security definer RPC: validates code/expiry/email, inserts member, marks used.
-- RLS swap on every vehicle-scoped table: select using (is_member(vehicle_id)); insert/update/delete
-- with check (is_member(vehicle_id,'editor')); vehicle itself: delete only owner. Tables without
-- vehicle_id (contact, inventory_item with null owner, mod_category, venue, setting) stay own-rows.
```

Sync engine changes (`lib/sync/*`): pull predicate drops the client-side `user_id` filter (RLS
filters); a pulled `vehicle_member` row for me with `created_at > last_pull` triggers a
**vehicle-scoped full pull** (cursor reset for that vehicle_id across tables); push sends
`user_id` (creator) and `updated_by` explicitly; local `vehicle.garage_role` mirrors my role and
the UI disables editing for `viewer`; removed membership → local purge of that vehicle's rows
(prompted). Media: new uploads to `v/<vehicle_id>/…`; `mediaBytes.ts` resolves by `remote_path`
prefix so old paths keep working; storage select/insert policies accept both layouts.

## 6. Verification additions

- `tools/verify-x-core.mjs`: +checks for the v2 tables, `storage_usage_bytes()`, `public_vehicle`
  view exists and anon can `select` only when `share_enabled`, `is_member()` denies non-members.
- `tools/verify-sync.mjs`: +new tables in the parity list, +a two-account member scenario (A owns,
  B editor: B pulls A's vehicle; B edits; A sees; A removes B; B stops seeing).
- `sql/999_cleanup_test_users.sql` extended to remove test members/invites/public objects
  (objects via `tools/cleanup-probe-media.mjs`).
