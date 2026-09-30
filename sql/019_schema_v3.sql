-- 019_schema_v3.sql — schema v6's cloud mirror (IMP 29092026 Phase 2, 02-cloud-v3.md).
--
-- The package calls this file 018; 018 went to 2.1.3's Car Guy-only accounts
-- (018_app_membership.sql), so everything here moved up one.
--
-- Additive only, every statement guarded, `carguy` only — no --shared.
--
-- Units: the cloud does NOT convert. `fuel_log.volume`, `price_per_unit` and
-- `vehicle.tank_volume` stay gallons (2.1.x devices read and write them); 2.2
-- pushes liters into the new `volume_l`, `price_per_l`, `tank_l` alongside and
-- stamps `schema_hint = 'v6'` (lib/sync/unitBridge.ts). 2.1.3's gate skips a
-- hinted row. Converting here would corrupt rows mid-flight for a device that
-- has not updated yet.
--
-- Apply: node tools/apply-sql.mjs sql/019_schema_v3.sql   (then 020_rls_v3.sql)

-- ------------------------------------------------------------- vehicle ----
alter table carguy.vehicle add column if not exists volume_unit text not null default 'gal';
alter table carguy.vehicle add column if not exists economy_unit text not null default 'km_gal';
alter table carguy.vehicle add column if not exists reserve_volume_l double precision;
alter table carguy.vehicle add column if not exists tank_l double precision;
alter table carguy.vehicle add column if not exists tank_volume_entered double precision;
alter table carguy.vehicle add column if not exists status_note text not null default '';
alter table carguy.vehicle add column if not exists status_since timestamptz;
alter table carguy.vehicle add column if not exists body_type text;
alter table carguy.vehicle add column if not exists color_id text;
alter table carguy.vehicle add column if not exists interior_color_id text;
alter table carguy.vehicle add column if not exists interior_material text;
alter table carguy.vehicle add column if not exists make_id text;
alter table carguy.vehicle add column if not exists model_id text;
alter table carguy.vehicle add column if not exists limit_kmh integer not null default 120;
alter table carguy.vehicle add column if not exists trip_mode text not null default 'auto';
alter table carguy.vehicle add column if not exists schema_hint text;

-- ---------------------------------------------------------- album_item ----
alter table carguy.album_item add column if not exists role text not null default 'album';

-- ------------------------------------------------------------ fuel_log ----
alter table carguy.fuel_log add column if not exists gauge_before_eighths smallint;
alter table carguy.fuel_log add column if not exists gauge_after_eighths smallint;
alter table carguy.fuel_log add column if not exists in_reserve boolean not null default false;
alter table carguy.fuel_log add column if not exists volume_l double precision;
alter table carguy.fuel_log add column if not exists price_per_l double precision;
alter table carguy.fuel_log add column if not exists volume_entered double precision;
alter table carguy.fuel_log add column if not exists volume_entered_unit text;
alter table carguy.fuel_log add column if not exists schema_hint text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'fuel_log_gauge_eighths') then
    alter table carguy.fuel_log add constraint fuel_log_gauge_eighths check (
      (gauge_before_eighths is null or gauge_before_eighths between 0 and 8) and
      (gauge_after_eighths is null or gauge_after_eighths between 0 and 8));
  end if;
end $$;

-- ------------------------------------------------- service_record_item ----
alter table carguy.service_record_item add column if not exists oil_viscosity text;
alter table carguy.service_record_item add column if not exists oil_type text;
alter table carguy.service_record_item add column if not exists oil_spec text;
alter table carguy.service_record_item add column if not exists oil_brand text;

-- ---------------------------------------------------------------- trip ----
-- Same columns as the local table (lib/db/migrationV6.ts), plus the cloud's
-- own user_id / updated_by / server_updated_at and the schema hint. The points
-- (trip_point) never leave the phone.
create table if not exists carguy.trip (
  id                  text primary key,
  user_id             uuid not null default auth.uid() references auth.users(id) on delete cascade,
  vehicle_id          text not null,
  source              text not null,
  status              text not null,
  role                text not null default 'conductor',
  started_at          timestamptz not null,
  ended_at            timestamptz,
  start_lat           double precision,
  start_lng           double precision,
  end_lat             double precision,
  end_lng             double precision,
  start_label         text not null default '',
  end_label           text not null default '',
  distance_m          double precision not null default 0,
  duration_s          integer not null default 0,
  moving_s            integer not null default 0,
  avg_kmh             double precision,
  avg_moving_kmh      double precision,
  max_kmh             double precision,
  speed_buckets       text not null default '[0,0,0,0,0]',
  polyline            text,
  bbox                text,
  segments            integer not null default 1,
  odometer_reading_id text,
  notes               text not null default '',
  created_at          timestamptz not null,
  updated_at          timestamptz not null,
  deleted_at          timestamptz,
  updated_by          uuid,
  schema_hint         text,
  server_updated_at   timestamptz not null default now()
);

-- The before_write trigger (cursor stamp + stale-write guard, 002/005) and the
-- sync cursor index, exactly as 009 gives every v2 table.
drop trigger if exists trip_before_write on carguy.trip;
create trigger trip_before_write before update on carguy.trip
  for each row execute function carguy.before_write();
create index if not exists idx_trip_user_cursor on carguy.trip (user_id, server_updated_at);
create index if not exists idx_trip_user_vehicle_started on carguy.trip (user_id, vehicle_id, started_at desc);

-- rollback (nothing else depends on these; 2.1.x never reads them):
-- drop table if exists carguy.trip;
-- alter table carguy.fuel_log drop constraint if exists fuel_log_gauge_eighths;
-- alter table carguy.<table> drop column if exists <each column above>;
