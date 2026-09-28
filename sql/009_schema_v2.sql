-- 009_schema_v2.sql — the cloud mirror of local migration v2 (IMP 28092026, ADR-17).
--
-- Source of truth: lib/db/migrationV2.ts (= docs/imp-28092026/02-specs/01-data-model-v2.md §1)
-- and 02-cloud-v2.md §1. Same rules as 002:
--   · additive and idempotent — `if not exists` everywhere; nothing outside `carguy`
--     except foreign keys *to* auth.users (on delete cascade, as 007 set up for v1);
--   · `user_id uuid not null default auth.uid()`, `server_updated_at` + the shared
--     carguy.before_write() trigger (002/005: stamps the cursor and rejects stale writes);
--   · no local foreign keys between tables (a child may arrive before its parent);
--   · no `synced_at`, no `thumb_blob` (device-local), and no `dtc_code` (bundled data);
--   · `mod_category` and `venue` are per-user keyed like the catalogues (008), because
--     their seeded slug ids are identical on every device;
--   · `updated_by uuid` on the new vehicle-scoped tables, for the shared garage
--     (PROMPT-07). Nothing writes it yet; the v1 tables get it in PROMPT-07.
--
-- `vehicle.garage_role` is deliberately absent: it is this device's mirror of *my*
-- role on a shared vehicle and would be wrong for every other member.
--
-- `vehicle_member` is the shape 02-cloud-v2.md §5 gives it (primary key vehicle + user),
-- plus a generated `id` so the pull can address it like every other row. Clients only
-- read it (010 grants select, no writes); PROMPT-07's RPCs write it.
--
-- Apply: node tools/apply-sql.mjs sql/009_schema_v2.sql   (no --shared: the only
-- statements naming auth.users are column references).

-- --------------------------------------------------- existing tables -------

alter table carguy.vehicle add column if not exists nickname       text;
alter table carguy.vehicle add column if not exists status         text not null default 'activo';
alter table carguy.vehicle add column if not exists chassis_code   text;
alter table carguy.vehicle add column if not exists chassis_number text;
alter table carguy.vehicle add column if not exists engine_code    text;
alter table carguy.vehicle add column if not exists transmission   text;
alter table carguy.vehicle add column if not exists drivetrain     text;
alter table carguy.vehicle add column if not exists origin         text;
alter table carguy.vehicle add column if not exists imported_year  integer;
alter table carguy.vehicle add column if not exists story          text not null default '';
alter table carguy.vehicle add column if not exists hero_media_id  text;

alter table carguy.media add column if not exists taken_at          timestamptz;
alter table carguy.media add column if not exists date_precision    text not null default 'day';
alter table carguy.media add column if not exists source            text not null default 'camera';
alter table carguy.media add column if not exists remote_thumb_path text;
alter table carguy.media add column if not exists thumb_rel_path    text;
alter table carguy.media add column if not exists blurhash          text;
alter table carguy.media add column if not exists caption           text not null default '';
alter table carguy.media add column if not exists is_favorite       boolean not null default false;

alter table carguy.service_record add column if not exists contact_id text;

-- `updated_by` on the v1 tables is deferred to PROMPT-07, which is the first
-- phase that writes it. A 2.0.0 install pulls with `select *` and cannot store a
-- column it does not know, so every column added to a v1 table parks that table's
-- pull on old installs until they update. vehicle, media and service_record have
-- to pay that now; fuel_log — the regression canary — and the rest do not.

-- ---------------------------------------------------------- new tables -----

create table if not exists carguy.vehicle_ownership (
  id                text primary key,
  user_id           uuid not null default auth.uid() references auth.users(id) on delete cascade,
  vehicle_id        text not null,
  acquired_at       timestamptz,
  acquired_km       double precision,
  acquired_price    double precision,
  acquired_from     text,
  sold_at           timestamptz,
  sold_km           double precision,
  sold_price        double precision,
  sold_to           text,
  reason            text,
  is_current        boolean not null default true,
  created_at        timestamptz not null,
  updated_at        timestamptz not null,
  deleted_at        timestamptz,
  updated_by        uuid,
  server_updated_at timestamptz not null default now()
);

create table if not exists carguy.album_item (
  id                text primary key,
  user_id           uuid not null default auth.uid() references auth.users(id) on delete cascade,
  vehicle_id        text not null,
  media_id          text not null,
  milestone_id      text,
  mod_id            text,
  track_event_id    text,
  sort_order        integer not null default 0,
  created_at        timestamptz not null,
  updated_at        timestamptz not null,
  deleted_at        timestamptz,
  updated_by        uuid,
  server_updated_at timestamptz not null default now()
);

create table if not exists carguy.milestone (
  id                text primary key,
  user_id           uuid not null default auth.uid() references auth.users(id) on delete cascade,
  vehicle_id        text not null,
  kind              text not null,
  occurred_at       timestamptz not null,
  odometer_km       double precision,
  title             text not null,
  story             text not null default '',
  cover_media_id    text,
  created_at        timestamptz not null,
  updated_at        timestamptz not null,
  deleted_at        timestamptz,
  updated_by        uuid,
  server_updated_at timestamptz not null default now()
);

create table if not exists carguy.mod_category (
  id                text not null,
  user_id           uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name              text not null,
  icon              text,
  sort_order        integer not null default 0,
  is_seeded         boolean not null default false,
  created_at        timestamptz not null,
  updated_at        timestamptz not null,
  deleted_at        timestamptz,
  server_updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists carguy.mod (
  id                text primary key,
  user_id           uuid not null default auth.uid() references auth.users(id) on delete cascade,
  vehicle_id        text not null,
  category_id       text not null,
  name              text not null,
  brand             text,
  part_number       text,
  variant           text,
  status            text not null default 'instalado',
  installed_at      timestamptz,
  installed_km      double precision,
  removed_at        timestamptz,
  removed_km        double precision,
  installer_type    text not null default 'yo',
  contact_id        text,
  cost_part_dop     double precision not null default 0,
  cost_labor_dop    double precision not null default 0,
  cost_shipping_dop double precision not null default 0,
  cost_customs_dop  double precision not null default 0,
  price_foreign     double precision,
  currency          text,
  fx_rate_to_dop    double precision,
  vendor            text,
  vendor_url        text,
  replaces_mod_id   text,
  affects_specs     boolean not null default false,
  spec_effects      text not null default '{}',
  service_record_id text,
  sold_price_dop    double precision,
  sold_to           text,
  tags              text not null default '[]',
  notes             text not null default '',
  created_at        timestamptz not null,
  updated_at        timestamptz not null,
  deleted_at        timestamptz,
  updated_by        uuid,
  server_updated_at timestamptz not null default now()
);

create table if not exists carguy.mod_media (
  id                text primary key,
  user_id           uuid not null default auth.uid() references auth.users(id) on delete cascade,
  mod_id            text not null,
  media_id          text not null,
  role              text not null default 'foto',
  created_at        timestamptz not null,
  updated_at        timestamptz not null,
  deleted_at        timestamptz,
  updated_by        uuid,
  server_updated_at timestamptz not null default now()
);

create table if not exists carguy.vehicle_specsheet (
  id                    text primary key,
  user_id               uuid not null default auth.uid() references auth.users(id) on delete cascade,
  vehicle_id            text not null,
  preset_id             text,
  stock                 text not null default '{}',
  overrides             text not null default '{}',
  field_sources         text not null default '{}',
  verified_fields       text not null default '[]',
  oil_capacity_l        double precision,
  oil_capacity_filter_l double precision,
  oil_grade             text,
  oil_spec              text,
  oil_filter_pn         text,
  coolant_capacity_l    double precision,
  coolant_type          text,
  trans_oil_l           double precision,
  trans_oil_spec        text,
  diff_oil_l            double precision,
  diff_oil_spec         text,
  brake_fluid           text,
  ps_fluid              text,
  spark_plug_pn         text,
  plug_gap_mm           double precision,
  battery_spec          text,
  tire_size_oem_f       text,
  tire_size_oem_r       text,
  psi_oem_f             double precision,
  psi_oem_r             double precision,
  bolt_pattern          text,
  center_bore_mm        double precision,
  lug_torque_nm         double precision,
  lug_thread            text,
  fuel_tank_l           double precision,
  fuel_octane           integer,
  created_at            timestamptz not null,
  updated_at            timestamptz not null,
  deleted_at            timestamptz,
  updated_by            uuid,
  server_updated_at     timestamptz not null default now()
);

create table if not exists carguy.spec_snapshot (
  id                text primary key,
  user_id           uuid not null default auth.uid() references auth.users(id) on delete cascade,
  vehicle_id        text not null,
  label             text not null,
  as_of             timestamptz not null,
  specs             text not null default '{}',
  cover_media_id    text,
  created_at        timestamptz not null,
  updated_at        timestamptz not null,
  deleted_at        timestamptz,
  updated_by        uuid,
  server_updated_at timestamptz not null default now()
);

create table if not exists carguy.torque_spec (
  id                text primary key,
  user_id           uuid not null default auth.uid() references auth.users(id) on delete cascade,
  vehicle_id        text not null,
  item              text not null,
  value_nm          double precision not null,
  stage             text,
  source            text,
  media_id          text,
  notes             text not null default '',
  created_at        timestamptz not null,
  updated_at        timestamptz not null,
  deleted_at        timestamptz,
  updated_by        uuid,
  server_updated_at timestamptz not null default now()
);

create table if not exists carguy.wishlist_item (
  id                text primary key,
  user_id           uuid not null default auth.uid() references auth.users(id) on delete cascade,
  vehicle_id        text not null,
  category_id       text,
  name              text not null,
  brand             text,
  part_number       text,
  priority          integer not null default 2,
  est_price_foreign double precision,
  currency          text,
  est_shipping_dop  double precision,
  est_customs_dop   double precision,
  est_total_dop     double precision,
  url               text,
  vendor            text,
  target_date       timestamptz,
  status            text not null default 'idea',
  converted_mod_id  text,
  notes             text not null default '',
  created_at        timestamptz not null,
  updated_at        timestamptz not null,
  deleted_at        timestamptz,
  updated_by        uuid,
  server_updated_at timestamptz not null default now()
);

create table if not exists carguy.inventory_item (
  id                text primary key,
  user_id           uuid not null default auth.uid() references auth.users(id) on delete cascade,
  owner_vehicle_id  text,
  kind              text not null,
  name              text not null,
  brand             text,
  part_number       text,
  qty               double precision not null default 1,
  unit              text,
  condition         text not null default 'usado',
  location          text,
  cost_dop          double precision,
  acquired_at       timestamptz,
  fits_vehicle_ids  text not null default '[]',
  media_id          text,
  notes             text not null default '',
  created_at        timestamptz not null,
  updated_at        timestamptz not null,
  deleted_at        timestamptz,
  updated_by        uuid,
  server_updated_at timestamptz not null default now()
);

create table if not exists carguy.wheel_set (
  id                text primary key,
  user_id           uuid not null default auth.uid() references auth.users(id) on delete cascade,
  vehicle_id        text not null,
  name              text not null,
  brand             text,
  model             text,
  width_in          double precision,
  diam_in           integer,
  offset_mm         integer,
  bolt_pattern      text,
  center_bore_mm    double precision,
  qty               integer not null default 4,
  position_pref     text not null default 'any',
  status            text not null default 'montado',
  media_id          text,
  notes             text not null default '',
  created_at        timestamptz not null,
  updated_at        timestamptz not null,
  deleted_at        timestamptz,
  updated_by        uuid,
  server_updated_at timestamptz not null default now()
);

create table if not exists carguy.tire (
  id                text primary key,
  user_id           uuid not null default auth.uid() references auth.users(id) on delete cascade,
  vehicle_id        text not null,
  wheel_set_id      text,
  brand             text,
  model             text,
  size              text,
  width_mm          integer,
  aspect            integer,
  rim_in            integer,
  load_index        text,
  speed_rating      text,
  dot_code          text,
  dot_week          integer,
  dot_year          integer,
  compound          text,
  treadwear         integer,
  position          text not null default 'unmounted',
  tread_mm_new      double precision,
  tread_mm_current  double precision,
  heat_cycles       integer not null default 0,
  purchased_at      timestamptz,
  cost_dop          double precision,
  status            text not null default 'en_uso',
  created_at        timestamptz not null,
  updated_at        timestamptz not null,
  deleted_at        timestamptz,
  updated_by        uuid,
  server_updated_at timestamptz not null default now()
);

create table if not exists carguy.vehicle_dtc_event (
  id                text primary key,
  user_id           uuid not null default auth.uid() references auth.users(id) on delete cascade,
  vehicle_id        text not null,
  code              text not null,
  seen_at           timestamptz not null,
  odometer_km       double precision,
  cleared_at        timestamptz,
  repair_record_id  text,
  notes             text not null default '',
  created_at        timestamptz not null,
  updated_at        timestamptz not null,
  deleted_at        timestamptz,
  updated_by        uuid,
  server_updated_at timestamptz not null default now()
);

create table if not exists carguy.contact (
  id                text primary key,
  user_id           uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name              text not null,
  kind              text not null,
  phone             text,
  whatsapp          text,
  address           text,
  notes             text not null default '',
  rating            integer,
  created_at        timestamptz not null,
  updated_at        timestamptz not null,
  deleted_at        timestamptz,
  server_updated_at timestamptz not null default now()
);

create table if not exists carguy.fluid_guide_item (
  id                text primary key,
  user_id           uuid not null default auth.uid() references auth.users(id) on delete cascade,
  vehicle_id        text not null,
  kind              text not null,
  media_id          text,
  how               text not null default '',
  notes             text not null default '',
  sort_order        integer not null default 0,
  created_at        timestamptz not null,
  updated_at        timestamptz not null,
  deleted_at        timestamptz,
  updated_by        uuid,
  server_updated_at timestamptz not null default now()
);

create table if not exists carguy.venue (
  id                text not null,
  user_id           uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name              text not null,
  city              text,
  type              text not null default 'circuito',
  layout            text,
  length_m          integer,
  lat               double precision,
  lng               double precision,
  is_seeded         boolean not null default false,
  notes             text not null default '',
  created_at        timestamptz not null,
  updated_at        timestamptz not null,
  deleted_at        timestamptz,
  server_updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists carguy.track_event (
  id                text primary key,
  user_id           uuid not null default auth.uid() references auth.users(id) on delete cascade,
  vehicle_id        text not null,
  venue_id          text,
  occurred_at       timestamptz not null,
  title             text not null default '',
  organizer         text,
  discipline        text not null default 'drift',
  weather           text,
  ambient_c         double precision,
  track_temp_c      double precision,
  track_condition   text,
  odometer_start_km double precision,
  odometer_end_km   double precision,
  entry_fee_dop     double precision,
  fuel_cost_dop     double precision,
  other_cost_dop    double precision,
  notes             text not null default '',
  created_at        timestamptz not null,
  updated_at        timestamptz not null,
  deleted_at        timestamptz,
  updated_by        uuid,
  server_updated_at timestamptz not null default now()
);

create table if not exists carguy.track_session (
  id                    text primary key,
  user_id               uuid not null default auth.uid() references auth.users(id) on delete cascade,
  event_id              text not null,
  seq                   integer not null,
  kind                  text not null default 'practica',
  started_at            timestamptz,
  duration_min          integer,
  laps                  integer,
  runs                  integer,
  best_lap_ms           integer,
  second_best_ms        integer,
  sectors_ms            text not null default '[]',
  zero_100_ms           integer,
  quarter_mile_ms       integer,
  quarter_mile_trap_kmh double precision,
  sixty_foot_ms         integer,
  fuel_load_l           double precision,
  ballast_kg            double precision,
  driver                text,
  passenger             boolean not null default false,
  car_feel              text,
  rating                integer,
  notes                 text not null default '',
  incident              text,
  video_url             text,
  created_at            timestamptz not null,
  updated_at            timestamptz not null,
  deleted_at            timestamptz,
  updated_by            uuid,
  server_updated_at     timestamptz not null default now()
);

create table if not exists carguy.setup_sheet (
  id                    text primary key,
  user_id               uuid not null default auth.uid() references auth.users(id) on delete cascade,
  session_id            text not null,
  tire_set_f_id         text,
  tire_set_r_id         text,
  psi_cold_fl           double precision,
  psi_cold_fr           double precision,
  psi_cold_rl           double precision,
  psi_cold_rr           double precision,
  psi_hot_fl            double precision,
  psi_hot_fr            double precision,
  psi_hot_rl            double precision,
  psi_hot_rr            double precision,
  camber_fl             double precision,
  camber_fr             double precision,
  camber_rl             double precision,
  camber_rr             double precision,
  toe_f_mm              double precision,
  toe_r_mm              double precision,
  caster_l              double precision,
  caster_r              double precision,
  rh_fl_mm              double precision,
  rh_fr_mm              double precision,
  rh_rl_mm              double precision,
  rh_rr_mm              double precision,
  spring_f              double precision,
  spring_r              double precision,
  spring_unit           text not null default 'kgf_mm',
  bump_f                integer,
  rebound_f             integer,
  bump_r                integer,
  rebound_r             integer,
  clicks_total          integer,
  swaybar_f             text,
  swaybar_r             text,
  pad_f                 text,
  pad_r                 text,
  brake_bias            text,
  steering_angle_deg    double precision,
  hydro                 boolean not null default false,
  lsd_type              text,
  lsd_preload           text,
  tire_size_f           text,
  tire_size_r           text,
  compound_f            text,
  compound_r            text,
  two_step_rpm          integer,
  rev_limit_rpm         integer,
  changed_from_previous text not null default '[]',
  created_at            timestamptz not null,
  updated_at            timestamptz not null,
  deleted_at            timestamptz,
  updated_by            uuid,
  server_updated_at     timestamptz not null default now()
);

create table if not exists carguy.consumable_usage (
  id                text primary key,
  user_id           uuid not null default auth.uid() references auth.users(id) on delete cascade,
  event_id          text not null,
  session_id        text,
  tire_id           text,
  wheel_set_id      text,
  kind              text not null,
  qty               double precision,
  unit              text,
  pad_thickness_mm  double precision,
  tread_mm          double precision,
  notes             text not null default '',
  created_at        timestamptz not null,
  updated_at        timestamptz not null,
  deleted_at        timestamptz,
  updated_by        uuid,
  server_updated_at timestamptz not null default now()
);

create table if not exists carguy.vehicle_share (
  id                text primary key,
  user_id           uuid not null default auth.uid() references auth.users(id) on delete cascade,
  vehicle_id        text not null,
  slug              text,
  visibility        text not null default 'private',
  show_plate        boolean not null default false,
  show_vin          boolean not null default false,
  show_costs        boolean not null default false,
  show_location     boolean not null default false,
  show_odometer     boolean not null default true,
  show_maintenance  boolean not null default true,
  show_mods         boolean not null default true,
  show_track        boolean not null default true,
  show_docs         boolean not null default false,
  show_story        boolean not null default true,
  og_media_id       text,
  published_at      timestamptz,
  revoked_at        timestamptz,
  created_at        timestamptz not null,
  updated_at        timestamptz not null,
  deleted_at        timestamptz,
  updated_by        uuid,
  server_updated_at timestamptz not null default now()
);

create table if not exists carguy.vehicle_member (
  id                text generated always as (vehicle_id || ':' || user_id::text) stored,
  user_id           uuid not null references auth.users(id) on delete cascade,
  vehicle_id        text not null,
  role              text not null check (role in ('owner', 'editor', 'viewer')),
  display_name      text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,
  server_updated_at timestamptz not null default now(),
  primary key (vehicle_id, user_id),
  unique (id)
);

-- ------------------------------------------------- triggers and indexes -----

do $$
declare t text;
begin
  foreach t in array array[
    'vehicle_ownership', 'album_item', 'milestone', 'mod_category', 'mod',
    'mod_media', 'vehicle_specsheet', 'spec_snapshot', 'torque_spec', 'wishlist_item',
    'inventory_item', 'wheel_set', 'tire', 'vehicle_dtc_event', 'contact',
    'fluid_guide_item', 'venue', 'track_event', 'track_session', 'setup_sheet',
    'consumable_usage', 'vehicle_share', 'vehicle_member'
  ]
  loop
    execute format('drop trigger if exists %I on carguy.%I', t || '_before_write', t);
    execute format(
      'create trigger %I before update on carguy.%I
         for each row execute function carguy.before_write()',
      t || '_before_write', t);

    execute format(
      'create index if not exists %I on carguy.%I (user_id, server_updated_at)',
      'idx_' || t || '_user_cursor', t);
  end loop;

  foreach t in array array[
    'vehicle_ownership', 'album_item', 'milestone', 'mod', 'vehicle_specsheet',
    'spec_snapshot', 'torque_spec', 'wishlist_item', 'wheel_set', 'tire',
    'vehicle_dtc_event', 'fluid_guide_item', 'track_event', 'vehicle_share', 'vehicle_member'
  ]
  loop
    execute format(
      'create index if not exists %I on carguy.%I (user_id, vehicle_id)',
      'idx_' || t || '_user_vehicle', t);
  end loop;
end
$$;

grant select, insert, update, delete on all tables in schema carguy to authenticated;


-- rollback:
-- (the new tables hold user data once clients sync — dump before dropping)
-- do $$ declare t text; begin
--   foreach t in array array['vehicle_ownership', 'album_item', 'milestone', 'mod_category', 'mod', 'mod_media', 'vehicle_specsheet', 'spec_snapshot', 'torque_spec', 'wishlist_item', 'inventory_item', 'wheel_set', 'tire', 'vehicle_dtc_event', 'contact', 'fluid_guide_item', 'venue', 'track_event', 'track_session', 'setup_sheet', 'consumable_usage', 'vehicle_share', 'vehicle_member']
--   loop execute format('drop table if exists carguy.%I', t); end loop;
-- end $$;
-- alter table carguy.vehicle drop column if exists nickname, drop column if exists status,
--   drop column if exists chassis_code, drop column if exists chassis_number, drop column if exists engine_code,
--   drop column if exists transmission, drop column if exists drivetrain, drop column if exists origin,
--   drop column if exists imported_year, drop column if exists story, drop column if exists hero_media_id;
-- alter table carguy.media drop column if exists taken_at, drop column if exists date_precision,
--   drop column if exists source, drop column if exists remote_thumb_path, drop column if exists thumb_rel_path,
--   drop column if exists blurhash, drop column if exists caption, drop column if exists is_favorite;
-- alter table carguy.service_record drop column if exists contact_id;
