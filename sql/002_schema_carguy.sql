-- 002_schema_carguy.sql — the cloud mirror of schema v1.
--
-- Additive and idempotent: every statement is `if not exists` or `or replace`,
-- and nothing outside the `carguy` schema is touched except one trigger on
-- auth.users, which is created under its own name beside Music Hub's.
--
-- Differences from the local SQLite schema, per 02-supabase-carguy.md §3:
--   · `user_id uuid not null default auth.uid()` on every row.
--   · `id text primary key` — the legacy ids from Tu Combustible RD are not UUIDs.
--   · timestamps are `timestamptz`; the client sends ISO strings.
--   · no `synced_at` — that is a device-local bookkeeping column (ADR-03).
--   · `server_updated_at` maintained by a trigger, for the pull cursor.
--   · `media` carries no bytes; those live in Storage (see 004).
--   · foreign keys are NOT mirrored. A client syncs tables one at a time and a
--     child can legitimately arrive before its parent; the local database is
--     what enforces referential integrity, and a server-side FK would only
--     turn an ordering detail into a failed sync.

create schema if not exists carguy;

grant usage on schema carguy to authenticated;
-- anon gets nothing at all: Car Guy has no public data.

-- ---------------------------------------------------------------- profiles --

create table if not exists carguy.profiles (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create or replace function carguy.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Only Car Guy's own signups. A Music Hub user must not get a Car Guy profile.
  if coalesce(new.raw_user_meta_data->>'app', '') = 'carguy' then
    insert into carguy.profiles (user_id, display_name)
    values (new.id, new.raw_user_meta_data->>'display_name')
    on conflict (user_id) do nothing;
  end if;
  return new;
end
$$;

drop trigger if exists carguy_on_auth_user_created on auth.users;
create trigger carguy_on_auth_user_created
  after insert on auth.users
  for each row execute function carguy.handle_new_user();

-- --------------------------------------------------- server_updated_at ------
--
-- ONE before-update trigger per table, not two. Postgres fires before-triggers
-- in name order and feeds each the row the previous one returned, so a second
-- trigger could undo the first — and with the LWW guard that 005 adds to this
-- same function, a separate "touch" trigger running afterwards would stamp a
-- new cursor onto a write that had just been rejected, making every other
-- device pull a row that never changed. Keeping both jobs in one function
-- removes the ordering question instead of relying on the names sorting the
-- right way, which they do not on `media`, `task`, `setting` or `vehicle`.
--
-- Inserts need no trigger: `server_updated_at` defaults to now().

create or replace function carguy.before_write()
returns trigger
language plpgsql
as $$
begin
  new.server_updated_at := now();
  return new;
end
$$;

-- ------------------------------------------------------------- the tables ---

create table if not exists carguy.vehicle (
  id                  text primary key,
  user_id             uuid not null default auth.uid(),
  name                text not null,
  type                text not null default 'carro',
  make                text,
  model               text,
  year                integer,
  trim                text,
  color               text,
  plate               text,
  vin                 text,
  default_fuel_type   text not null,
  tank_volume         double precision,
  initial_odometer_km double precision,
  purchase_date       timestamptz,
  purchase_price      double precision,
  sold_date           timestamptz,
  sold_price          double precision,
  photo_media_id      text,
  notes               text not null default '',
  is_archived         boolean not null default false,
  sort_order          integer not null default 0,
  created_at          timestamptz not null,
  updated_at          timestamptz not null,
  deleted_at          timestamptz,
  server_updated_at   timestamptz not null default now()
);

create table if not exists carguy.vehicle_spec (
  id                text primary key,
  user_id           uuid not null default auth.uid(),
  vehicle_id        text not null,
  name              text not null,
  value             text not null,
  sort_order        integer not null default 0,
  created_at        timestamptz not null,
  updated_at        timestamptz not null,
  deleted_at        timestamptz,
  server_updated_at timestamptz not null default now()
);

create table if not exists carguy.odometer_reading (
  id                text primary key,
  user_id           uuid not null default auth.uid(),
  vehicle_id        text not null,
  occurred_at       timestamptz not null,
  value_km          double precision not null,
  source            text not null,
  source_id         text,
  created_at        timestamptz not null,
  updated_at        timestamptz not null,
  deleted_at        timestamptz,
  server_updated_at timestamptz not null default now()
);

create table if not exists carguy.fuel_log (
  id                text primary key,
  user_id           uuid not null default auth.uid(),
  vehicle_id        text not null,
  occurred_at       timestamptz not null,
  odometer_km       double precision not null,
  volume            double precision not null,
  price_per_unit    double precision not null,
  total_dop         double precision not null,
  fuel_type         text not null,
  is_full_tank      boolean not null default true,
  missed_previous   boolean not null default false,
  station           text not null default '',
  notes             text not null default '',
  created_at        timestamptz not null,
  updated_at        timestamptz not null,
  deleted_at        timestamptz,
  server_updated_at timestamptz not null default now()
);

-- Seeded catalogues are per user: they are editable, so two accounts can
-- diverge and neither is "the" catalogue.
create table if not exists carguy.service_type (
  id                      text primary key,
  user_id                 uuid not null default auth.uid(),
  name                    text not null,
  category                text not null,
  default_interval_km     integer,
  default_interval_months integer,
  applies_to              text not null default 'all',
  is_seeded               boolean not null default false,
  sort_order              integer not null default 0,
  created_at              timestamptz not null,
  updated_at              timestamptz not null,
  deleted_at              timestamptz,
  server_updated_at       timestamptz not null default now()
);

create table if not exists carguy.service_record (
  id                   text primary key,
  user_id              uuid not null default auth.uid(),
  vehicle_id           text not null,
  kind                 text not null,
  occurred_at          timestamptz not null,
  odometer_km          double precision,
  title                text not null,
  description          text not null default '',
  cost_parts_dop       double precision not null default 0,
  cost_labor_dop       double precision not null default 0,
  total_dop            double precision not null default 0,
  shop                 text not null default '',
  warranty_until_date  timestamptz,
  warranty_until_km    double precision,
  source_inspection_id text,
  source_task_id       text,
  created_at           timestamptz not null,
  updated_at           timestamptz not null,
  deleted_at           timestamptz,
  server_updated_at    timestamptz not null default now()
);

create table if not exists carguy.service_record_item (
  id                text primary key,
  user_id           uuid not null default auth.uid(),
  service_record_id text not null,
  service_type_id   text not null,
  notes             text not null default '',
  created_at        timestamptz not null,
  updated_at        timestamptz not null,
  deleted_at        timestamptz,
  server_updated_at timestamptz not null default now()
);

create table if not exists carguy.part (
  id                text primary key,
  user_id           uuid not null default auth.uid(),
  service_record_id text not null,
  name              text not null,
  part_number       text,
  brand             text,
  quantity          double precision not null default 1,
  unit_cost_dop     double precision,
  created_at        timestamptz not null,
  updated_at        timestamptz not null,
  deleted_at        timestamptz,
  server_updated_at timestamptz not null default now()
);

create table if not exists carguy.expense (
  id                text primary key,
  user_id           uuid not null default auth.uid(),
  vehicle_id        text not null,
  occurred_at       timestamptz not null,
  odometer_km       double precision,
  category          text not null,
  amount_dop        double precision not null,
  description       text not null default '',
  vendor            text not null default '',
  created_at        timestamptz not null,
  updated_at        timestamptz not null,
  deleted_at        timestamptz,
  server_updated_at timestamptz not null default now()
);

create table if not exists carguy.reminder (
  id                      text primary key,
  user_id                 uuid not null default auth.uid(),
  vehicle_id              text not null,
  title                   text not null,
  service_type_id         text,
  legal_kind              text,
  metric                  text not null,
  due_date                timestamptz,
  due_km                  double precision,
  is_recurring            boolean not null default false,
  interval_months         integer,
  interval_days           integer,
  interval_km             integer,
  fixed_interval          boolean not null default false,
  threshold_days          integer,
  threshold_km            integer,
  notes                   text not null default '',
  last_completed_at       timestamptz,
  last_completed_km       double precision,
  last_completed_record_id text,
  snoozed_until           timestamptz,
  is_enabled              boolean not null default true,
  created_at              timestamptz not null,
  updated_at              timestamptz not null,
  deleted_at              timestamptz,
  server_updated_at       timestamptz not null default now()
);

create table if not exists carguy.inspection_template (
  id                text primary key,
  user_id           uuid not null default auth.uid(),
  vehicle_id        text,
  name              text not null,
  cadence           text not null,
  vehicle_type      text not null default 'carro',
  is_seeded         boolean not null default false,
  is_enabled        boolean not null default true,
  created_at        timestamptz not null,
  updated_at        timestamptz not null,
  deleted_at        timestamptz,
  server_updated_at timestamptz not null default now()
);

create table if not exists carguy.inspection_item (
  id                      text primary key,
  user_id                 uuid not null default auth.uid(),
  template_id             text not null,
  group_name              text not null,
  label                   text not null,
  how                     text not null default '',
  warning                 text not null default '',
  requires_cold_engine    boolean not null default false,
  on_fail                 text not null default 'task',
  related_service_type_id text,
  sort_order              integer not null default 0,
  created_at              timestamptz not null,
  updated_at              timestamptz not null,
  deleted_at              timestamptz,
  server_updated_at       timestamptz not null default now()
);

create table if not exists carguy.inspection (
  id                text primary key,
  user_id           uuid not null default auth.uid(),
  vehicle_id        text not null,
  template_id       text not null,
  occurred_at       timestamptz not null,
  odometer_km       double precision,
  status            text not null,
  duration_sec      integer,
  notes             text not null default '',
  created_at        timestamptz not null,
  updated_at        timestamptz not null,
  deleted_at        timestamptz,
  server_updated_at timestamptz not null default now()
);

create table if not exists carguy.inspection_result (
  id                text primary key,
  user_id           uuid not null default auth.uid(),
  inspection_id     text not null,
  item_id           text not null,
  label_snapshot    text not null,
  result            text not null,
  note              text not null default '',
  media_id          text,
  created_at        timestamptz not null,
  updated_at        timestamptz not null,
  deleted_at        timestamptz,
  server_updated_at timestamptz not null default now()
);

create table if not exists carguy.task (
  id                          text primary key,
  user_id                     uuid not null default auth.uid(),
  vehicle_id                  text not null,
  title                       text not null,
  kind                        text not null default 'reparacion',
  priority                    text not null default 'normal',
  status                      text not null default 'pendiente',
  estimated_cost_dop          double precision,
  notes                       text not null default '',
  source_inspection_result_id text,
  done_record_id              text,
  created_at                  timestamptz not null,
  updated_at                  timestamptz not null,
  deleted_at                  timestamptz,
  server_updated_at           timestamptz not null default now()
);

create table if not exists carguy.document (
  id                text primary key,
  user_id           uuid not null default auth.uid(),
  vehicle_id        text not null,
  kind              text not null,
  title             text not null,
  issued_at         timestamptz,
  expires_at        timestamptz,
  reminder_id       text,
  media_id          text,
  notes             text not null default '',
  created_at        timestamptz not null,
  updated_at        timestamptz not null,
  deleted_at        timestamptz,
  server_updated_at timestamptz not null default now()
);

-- No `blob`: the bytes go to Storage (004). `remote_path` is the object key.
create table if not exists carguy.media (
  id                text primary key,
  user_id           uuid not null default auth.uid(),
  owner_table       text not null,
  owner_id          text not null,
  kind              text not null,
  mime              text not null,
  rel_path          text,
  width             integer,
  height            integer,
  size_bytes        integer,
  remote_path       text,
  created_at        timestamptz not null,
  updated_at        timestamptz not null,
  deleted_at        timestamptz,
  server_updated_at timestamptz not null default now()
);

-- Keyed by (user_id, key) rather than by id: settings are one row per key per
-- account. `active_vehicle_id` is deliberately never synced — which vehicle is
-- on screen is a fact about a device, not about a person.
create table if not exists carguy.setting (
  user_id           uuid not null default auth.uid(),
  key               text not null,
  value             jsonb not null,
  updated_at        timestamptz not null,
  server_updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

-- ------------------------------------------------- triggers and indexes -----

do $$
declare t text;
begin
  foreach t in array array[
    'vehicle', 'vehicle_spec', 'odometer_reading', 'fuel_log', 'service_type',
    'service_record', 'service_record_item', 'part', 'expense', 'reminder',
    'inspection_template', 'inspection_item', 'inspection', 'inspection_result',
    'task', 'document', 'media', 'setting'
  ]
  loop
    execute format('drop trigger if exists %I on carguy.%I', t || '_before_write', t);
    execute format(
      'create trigger %I before update on carguy.%I
         for each row execute function carguy.before_write()',
      t || '_before_write', t);

    -- The pull cursor reads (user_id, server_updated_at) on every table.
    execute format(
      'create index if not exists %I on carguy.%I (user_id, server_updated_at)',
      'idx_' || t || '_user_cursor', t);
  end loop;

  -- The child tables are almost always read by vehicle.
  foreach t in array array[
    'vehicle_spec', 'odometer_reading', 'fuel_log', 'service_record', 'expense',
    'reminder', 'inspection', 'task', 'document'
  ]
  loop
    execute format(
      'create index if not exists %I on carguy.%I (user_id, vehicle_id)',
      'idx_' || t || '_user_vehicle', t);
  end loop;
end
$$;


-- rollback:
-- drop trigger if exists carguy_on_auth_user_created on auth.users;
-- drop function if exists carguy.handle_new_user();
-- drop schema if exists carguy cascade;
