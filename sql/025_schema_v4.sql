-- 025_schema_v4.sql — schema v8's cloud mirror (IMP 30092026 Phase 2, 02-cloud-v4.md §025).
--
-- Mirrors lib/db/migrationV8.ts column for column (docs/imp-30092026/02-specs/01-data-model-v8.md):
--   · carguy.fuel_price        the user's own price history (synced, own rows — 026)
--   · carguy.milestone         + the event columns (1.2), backfill accidente → moderado
--   · carguy.vehicle_specsheet + "what I buy" (1.3)
--   · carguy.vehicle_fact      key/value memory of a car (synced, member-readable like torque_spec — 026)
--   · carguy.legal_acceptance  terms accepted per device (synced, own rows — 026)
--   · carguy.profiles          + avatar_id, avatar_path, locale (display_name exists since 002)
--   · carguy.vehicle_share     + show_tires; public_dossier() gains `tires` only with it on
--   · carguy.trip              + diagnostics
--
-- Types, where the local TEXT could go two ways:
--   · fuel_price.valid_from is `date`: the local value is a bare ISO date ('2026-08-15') and
--     PostgREST returns a `date` exactly as written, so the pull hands the phone back the same
--     string. A timestamptz would come back as '2026-08-15T00:00:00+00:00' and the board's
--     string comparison against fuel_price_ref.week_start would drift.
--   · trip.diagnostics is `text` holding JSON, as trip.speed_buckets / trip.bbox and
--     vehicle_share.costs_summary already are: a jsonb column would come back from PostgREST as
--     an object, and the local TEXT column would store "[object Object]".
--
-- Additive only, every statement guarded, `carguy` only — no --shared. 2.3.x clients drop the
-- unknown columns on pull and push rows without them (every new column is nullable or defaulted).
--
-- Apply: node tools/apply-sql.mjs sql/025_schema_v4.sql   (then 026_rls_v4.sql)

-- ---------------------------------------------------------- fuel_price ----
create table if not exists carguy.fuel_price (
  id                text primary key,
  user_id           uuid not null default auth.uid() references auth.users(id) on delete cascade,
  fuel_type         text not null,
  price             double precision not null,
  valid_from        date not null,
  source            text not null default 'manual',
  station           text not null default '',
  note              text not null default '',
  created_at        timestamptz not null,
  updated_at        timestamptz not null,
  deleted_at        timestamptz,
  updated_by        uuid,
  schema_hint       text,
  server_updated_at timestamptz not null default now()
);

create index if not exists idx_fuel_price_user_type_from on carguy.fuel_price (user_id, fuel_type, valid_from desc);

-- ----------------------------------------------------------- milestone ----
alter table carguy.milestone add column if not exists event_type text not null default 'hito';
alter table carguy.milestone add column if not exists severity text;
alter table carguy.milestone add column if not exists cost_dop double precision;
alter table carguy.milestone add column if not exists pending text not null default '';
alter table carguy.milestone add column if not exists resolved_at timestamptz;
alter table carguy.milestone add column if not exists linked_service_id text;
alter table carguy.milestone add column if not exists linked_mod_id text;
alter table carguy.milestone add column if not exists linked_inspection_id text;
alter table carguy.milestone add column if not exists location_label text not null default '';

-- The same backfill the local migration runs. Only rows still at the default, so a re-run (or a
-- row a 2.4 phone already classified) is left alone. updated_at is not touched: the phones make
-- the same change locally, and bumping it would make every accident re-sync for nothing.
update carguy.milestone set event_type = 'accidente', severity = 'moderado'
 where kind = 'accidente' and event_type = 'hito';

-- --------------------------------------------------- vehicle_specsheet ----
alter table carguy.vehicle_specsheet add column if not exists oil_brand text;
alter table carguy.vehicle_specsheet add column if not exists oil_product text;
alter table carguy.vehicle_specsheet add column if not exists oil_filter_brand text;
alter table carguy.vehicle_specsheet add column if not exists air_filter_pn text;
alter table carguy.vehicle_specsheet add column if not exists cabin_filter_pn text;
alter table carguy.vehicle_specsheet add column if not exists fuel_filter_pn text;
alter table carguy.vehicle_specsheet add column if not exists wiper_sizes text;
alter table carguy.vehicle_specsheet add column if not exists bulb_low text;
alter table carguy.vehicle_specsheet add column if not exists bulb_high text;
alter table carguy.vehicle_specsheet add column if not exists tire_current_f text;
alter table carguy.vehicle_specsheet add column if not exists tire_current_r text;
alter table carguy.vehicle_specsheet add column if not exists battery_brand text;
alter table carguy.vehicle_specsheet add column if not exists where_bought text not null default '';

-- -------------------------------------------------------- vehicle_fact ----
-- torque_spec's cloud shape (sql/009): per-vehicle, member-scoped.
create table if not exists carguy.vehicle_fact (
  id                text primary key,
  user_id           uuid not null default auth.uid() references auth.users(id) on delete cascade,
  vehicle_id        text not null,
  label             text not null,
  value             text not null,
  group_name        text not null default 'otros',
  sort_order        integer not null default 0,
  created_at        timestamptz not null,
  updated_at        timestamptz not null,
  deleted_at        timestamptz,
  updated_by        uuid,
  server_updated_at timestamptz not null default now()
);

create index if not exists idx_vehicle_fact_user_vehicle on carguy.vehicle_fact (user_id, vehicle_id);

-- ---------------------------------------------------- legal_acceptance ----
create table if not exists carguy.legal_acceptance (
  id                text primary key,
  user_id           uuid not null default auth.uid() references auth.users(id) on delete cascade,
  version           text not null,
  accepted_at       timestamptz not null,
  locale            text not null,
  platform          text not null,
  device_id         text not null,
  created_at        timestamptz not null,
  updated_at        timestamptz not null,
  deleted_at        timestamptz,
  updated_by        uuid,
  server_updated_at timestamptz not null default now()
);

-- The before_write trigger (cursor stamp + stale-write guard, 002/005) and the sync cursor
-- index, exactly as 009 gives every v2 table and 019 gave trip.
do $$
declare t text;
begin
  foreach t in array array['fuel_price', 'vehicle_fact', 'legal_acceptance']
  loop
    execute format('drop trigger if exists %I on carguy.%I', t || '_before_write', t);
    execute format(
      'create trigger %I before update on carguy.%I
         for each row execute function carguy.before_write()',
      t || '_before_write', t);
    execute format(
      'create index if not exists %I on carguy.%I (user_id, server_updated_at)',
      'idx_' || t || '_user_cursor', t);
    -- 003's default privileges already cover a new table; stated anyway, and anon gets nothing.
    execute format('grant select, insert, update, delete on carguy.%I to authenticated', t);
    execute format('revoke all on carguy.%I from anon', t);
  end loop;
end
$$;

-- ------------------------------------------------------------ profiles ----
alter table carguy.profiles add column if not exists display_name text;
alter table carguy.profiles add column if not exists avatar_id text;
alter table carguy.profiles add column if not exists avatar_path text;
alter table carguy.profiles add column if not exists locale text;

-- ---------------------------------------------------------------- trip ----
alter table carguy.trip add column if not exists diagnostics text;

-- ------------------------------------------------------- vehicle_share ----
alter table carguy.vehicle_share add column if not exists show_tires boolean not null default false;

-- public_dossier() exactly as sql/022 left it, plus one block: `tires` (how many tire rows the
-- car has, and how many in each status) only when show_tires is on. Nothing else changes.
create or replace function carguy.public_dossier(p_slug text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  s carguy.vehicle_share%rowtype;
  v carguy.vehicle%rowtype;
  out jsonb;
begin
  if p_slug is null or length(p_slug) < 6 then return null; end if;

  select * into s from carguy.vehicle_share
   where slug = p_slug and visibility in ('link', 'public')
     and revoked_at is null and deleted_at is null and published_at is not null;
  if not found then return null; end if;

  select * into v from carguy.vehicle
   where id = s.vehicle_id and user_id = s.user_id and deleted_at is null;
  if not found then return null; end if;

  out := jsonb_build_object(
    'slug', s.slug,
    'visibility', s.visibility,
    'published_at', s.published_at,
    'show', jsonb_build_object(
      'plate', s.show_plate, 'vin', s.show_vin, 'costs', s.show_costs, 'odometer', s.show_odometer,
      'maintenance', s.show_maintenance, 'mods', s.show_mods, 'track', s.show_track, 'story', s.show_story,
      'status', s.show_status),
    'vehicle', jsonb_build_object(
      'name', v.name, 'type', v.type, 'make', v.make, 'model', v.model, 'year', v.year, 'trim', v.trim,
      'color', v.color, 'nickname', v.nickname, 'status', v.status, 'chassis_code', v.chassis_code,
      'engine_code', v.engine_code, 'transmission', v.transmission, 'drivetrain', v.drivetrain,
      'origin', v.origin, 'imported_year', v.imported_year, 'hero_media_id', v.hero_media_id,
      'updated_at', v.updated_at,
      'plate', case when s.show_plate then v.plate
                    when v.plate is not null and v.plate <> '' then left(v.plate, 3) || '••••' end,
      'vin', case when s.show_vin then v.vin
                  when v.vin is not null and v.vin <> '' then left(v.vin, 3) || '••••' end,
      'story', case when s.show_story then v.story end,
      'status_note', case when s.show_status then nullif(v.status_note, '') end,
      'status_since', case when s.show_status then v.status_since end)
  );

  if s.show_odometer then
    out := out || jsonb_build_object('odometer_km',
      (select max(o.value_km) from carguy.odometer_reading o where o.vehicle_id = v.id and o.deleted_at is null));
  end if;

  -- "Lo que me ha costado": the figure the owner's phone computed and published (never recomputed here,
  -- so the page, the book and Cifras show one number). A malformed summary is simply left out.
  if s.show_costs and s.costs_summary is not null then
    begin
      out := out || jsonb_build_object('costs', s.costs_summary::jsonb);
    exception when others then
      null;
    end;
  end if;

  if s.show_mods then
    out := out || jsonb_build_object(
      'specsheet', (select jsonb_build_object('stock', sp.stock, 'overrides', sp.overrides)
                      from carguy.vehicle_specsheet sp where sp.vehicle_id = v.id and sp.deleted_at is null limit 1),
      'mods', coalesce((select jsonb_agg(jsonb_build_object(
          'id', m.id, 'name', m.name, 'brand', m.brand, 'variant', m.variant, 'category_id', m.category_id,
          'category', c.name, 'status', m.status, 'installed_at', m.installed_at, 'removed_at', m.removed_at,
          'affects_specs', m.affects_specs, 'spec_effects', m.spec_effects, 'tags', m.tags,
          'service_record_id', m.service_record_id,
          'cost_dop', case when s.show_costs
                           then m.cost_part_dop + m.cost_labor_dop + m.cost_shipping_dop + m.cost_customs_dop end)
          order by m.installed_at nulls last, m.created_at)
        from carguy.mod m
        left join carguy.mod_category c on c.user_id = m.user_id and c.id = m.category_id
        where m.vehicle_id = v.id and m.deleted_at is null and m.status <> 'planeado' and m.status <> 'pedido'), '[]'::jsonb));
  end if;

  if s.show_maintenance then
    out := out || jsonb_build_object('services', coalesce((select jsonb_agg(jsonb_build_object(
          'kind', r.kind, 'occurred_at', r.occurred_at, 'title', r.title,
          'odometer_km', case when s.show_odometer then r.odometer_km end,
          'total_dop', case when s.show_costs then r.total_dop end)
          order by r.occurred_at desc)
        from carguy.service_record r
        where r.vehicle_id = v.id and r.deleted_at is null and r.kind in ('mantenimiento', 'reparacion', 'mejora')), '[]'::jsonb));
  end if;

  if s.show_track then
    out := out || jsonb_build_object('track', coalesce((select jsonb_agg(jsonb_build_object(
          'id', e.id, 'occurred_at', e.occurred_at, 'title', e.title, 'discipline', e.discipline,
          'venue_id', e.venue_id, 'venue', vn.name, 'layout', e.layout,
          'sessions', (select count(*) from carguy.track_session ts where ts.event_id = e.id and ts.deleted_at is null),
          'runs', (select sum(ts.runs) from carguy.track_session ts where ts.event_id = e.id and ts.deleted_at is null),
          'best_lap_ms', (select min(ts.best_lap_ms) from carguy.track_session ts
                           where ts.event_id = e.id and ts.deleted_at is null and ts.best_lap_ms > 0))
          order by e.occurred_at desc)
        from carguy.track_event e
        left join carguy.venue vn on vn.user_id = e.user_id and vn.id = e.venue_id
        where e.vehicle_id = v.id and e.deleted_at is null), '[]'::jsonb));
  end if;

  if s.show_story then
    out := out || jsonb_build_object('milestones', coalesce((select jsonb_agg(jsonb_build_object(
          'kind', ms.kind, 'occurred_at', ms.occurred_at, 'title', ms.title, 'story', ms.story)
          order by ms.occurred_at)
        from carguy.milestone ms where ms.vehicle_id = v.id and ms.deleted_at is null), '[]'::jsonb));
  end if;

  -- 025: the tire history (ADR-45), counts only — never brands, DOTs or costs. `badges` is one
  -- entry per status (nueva | en_uso | guardada | quemada | vendida), most tires first.
  if s.show_tires then
    out := out || jsonb_build_object('tires', jsonb_build_object(
      'count', (select count(*) from carguy.tire t where t.vehicle_id = v.id and t.deleted_at is null),
      'badges', coalesce((select jsonb_agg(jsonb_build_object('status', x.status, 'count', x.n) order by x.n desc, x.status)
        from (select t.status, count(*) as n from carguy.tire t
               where t.vehicle_id = v.id and t.deleted_at is null group by t.status) x), '[]'::jsonb)));
  end if;

  -- The favourites (≤ 24), newest first: the same list the app copied to carguy-public.
  out := out || jsonb_build_object('photos', coalesce((select jsonb_agg(x.id) from (
        select md.id from carguy.album_item a join carguy.media md on md.id = a.media_id
         where a.vehicle_id = v.id and a.deleted_at is null and md.deleted_at is null and md.is_favorite
         order by md.taken_at desc nulls last, md.created_at desc limit 24) x), '[]'::jsonb));

  return out;
end $$;

revoke all on function carguy.public_dossier(text) from public;
grant execute on function carguy.public_dossier(text) to anon, authenticated;

-- rollback (the three new tables hold user data once 2.4 clients sync — dump before dropping):
-- re-run sql/022_dossier_status_costs.sql (its public_dossier() without `tires`), then:
-- alter table carguy.vehicle_share drop column if exists show_tires;
-- alter table carguy.trip drop column if exists diagnostics;
-- alter table carguy.profiles drop column if exists avatar_id, drop column if exists avatar_path, drop column if exists locale;
--   (display_name is 002's — leave it)
-- drop table if exists carguy.legal_acceptance;
-- drop table if exists carguy.vehicle_fact;
-- drop table if exists carguy.fuel_price;
-- alter table carguy.vehicle_specsheet drop column if exists oil_brand, … (each column above), drop column if exists where_bought;
-- alter table carguy.milestone drop column if exists event_type, drop column if exists severity, drop column if exists cost_dop,
--   drop column if exists pending, drop column if exists resolved_at, drop column if exists linked_service_id,
--   drop column if exists linked_mod_id, drop column if exists linked_inspection_id, drop column if exists location_label;
