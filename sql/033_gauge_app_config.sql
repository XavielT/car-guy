-- 033_gauge_app_config.sql — IMP 01102026 Phase 2 (02-specs/01-data-model-v10.md §1, §4; ADR-51, ADR-53).
--
--   · carguy.vehicle   + gauge_type / gauge_segments / gauge_reserve_at / gauge_calibration (the local v10 columns:
--                        vehicle syncs, so the cloud must carry them — the spec listed them only locally)
--   · carguy.fuel_log  + gauge_before_frac / gauge_after_frac / gauge_before_raw / gauge_after_raw, backfilled from
--                        the eighths like the local migration (only rows still null; updated_at untouched)
--   · carguy.app_config(key, value jsonb, public) — what the admin publishes (support links/text, min_version);
--                        everyone signed in reads the public keys, only the admin writes (RPC)
--   · carguy.admin_usage() — Uso y costos: DB size, Car Guy storage bytes, MAU vs the Free limits (admin only)
--
-- carguy only, no --shared. Re-runnable.
-- Apply: node tools/apply-sql.mjs sql/033_gauge_app_config.sql

-- ---------------------------------------------------------------- gauge ----
alter table carguy.vehicle add column if not exists gauge_type text not null default 'needle8';
alter table carguy.vehicle add column if not exists gauge_segments integer;
alter table carguy.vehicle add column if not exists gauge_reserve_at integer;
alter table carguy.vehicle add column if not exists gauge_calibration text;
do $$ begin
  alter table carguy.vehicle add constraint vehicle_gauge_type check (gauge_type in ('needle8', 'segments', 'percent'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table carguy.vehicle add constraint vehicle_gauge_segments check (gauge_segments is null or gauge_segments between 3 and 20);
exception when duplicate_object then null; end $$;

alter table carguy.fuel_log add column if not exists gauge_before_frac double precision;
alter table carguy.fuel_log add column if not exists gauge_after_frac double precision;
alter table carguy.fuel_log add column if not exists gauge_before_raw text;
alter table carguy.fuel_log add column if not exists gauge_after_raw text;
do $$ begin
  alter table carguy.fuel_log add constraint fuel_log_gauge_frac
    check ((gauge_before_frac is null or gauge_before_frac between 0 and 1) and (gauge_after_frac is null or gauge_after_frac between 0 and 1));
exception when duplicate_object then null; end $$;

-- The same backfill the phones run (v10). Only rows not yet filled, so a re-run or a row a 2.5 phone already
-- wrote is left alone; updated_at untouched (the phones make the same change, a bump would re-sync everything).
update carguy.fuel_log set gauge_before_frac = gauge_before_eighths / 8.0, gauge_before_raw = gauge_before_eighths || '/8'
 where gauge_before_eighths is not null and gauge_before_frac is null;
update carguy.fuel_log set gauge_after_frac = gauge_after_eighths / 8.0, gauge_after_raw = gauge_after_eighths || '/8'
 where gauge_after_eighths is not null and gauge_after_frac is null;

-- ----------------------------------------------------------- app_config ----
create table if not exists carguy.app_config (
  key        text primary key check (key ~ '^[a-z0-9_]{2,40}$'),
  value      jsonb not null,
  -- public keys are read by every Car Guy account (support_links, support_text, min_version); others admin only
  public     boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
alter table carguy.app_config enable row level security;
drop policy if exists app_config_read on carguy.app_config;
create policy app_config_read on carguy.app_config for select to authenticated
  using (public or (select carguy.is_admin()));
drop policy if exists carguy_app_only on carguy.app_config;
create policy carguy_app_only on carguy.app_config as restrictive for all to authenticated
  using ((select carguy.is_app_user())) with check ((select carguy.is_app_user()));
-- Writes only through set_app_config (admin): no insert/update/delete grant at all.
revoke all on carguy.app_config from anon, authenticated;
grant select on carguy.app_config to authenticated;

create or replace function carguy.set_app_config(p_key text, p_value jsonb, p_public boolean default false)
returns void language plpgsql volatile security definer set search_path = '' as $$
begin
  if not carguy.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_value is null then
    delete from carguy.app_config where key = p_key;
    return;
  end if;
  insert into carguy.app_config (key, value, public, updated_at, updated_by)
  values (p_key, p_value, coalesce(p_public, false), now(), auth.uid())
  on conflict (key) do update set value = excluded.value, public = excluded.public, updated_at = now(), updated_by = auth.uid();
end $$;
revoke all on function carguy.set_app_config(text, jsonb, boolean) from public;
grant execute on function carguy.set_app_config(text, jsonb, boolean) to authenticated;

-- ---------------------------------------------------------- admin_usage ----
-- The Free plan's limits as of 2026-10 (research 01 §4): 500 MB DB, 1 GB storage, 50 000 MAU,
-- 2 M Realtime messages. The DB size is the whole x-core database (shared with Music Hub): that is
-- the number the plan counts. Storage is Car Guy's buckets only. Junte message counters arrive with 035.
create or replace function carguy.admin_usage()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not carguy.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'at', now(),
    'db_bytes', pg_database_size(current_database()),
    'storage_bytes', (select coalesce(sum((o.metadata->>'size')::bigint), 0)
                        from storage.objects o where o.bucket_id like 'carguy%'),
    'storage_objects', (select count(*) from storage.objects o where o.bucket_id like 'carguy%'),
    'mau', (select count(*) from carguy.profiles p join auth.users u on u.id = p.user_id
             where u.last_sign_in_at > now() - interval '30 days'),
    'users', (select count(*) from carguy.profiles),
    'limits', jsonb_build_object('db_bytes', 500 * 1024 * 1024, 'storage_bytes', 1024 * 1024 * 1024, 'mau', 50000,
                                 'realtime_messages', 2000000)
  );
end $$;
revoke all on function carguy.admin_usage() from public;
grant execute on function carguy.admin_usage() to authenticated;

-- rollback:
-- drop function if exists carguy.admin_usage(); drop function if exists carguy.set_app_config(text, jsonb, boolean);
-- drop table if exists carguy.app_config;
-- alter table carguy.fuel_log drop constraint if exists fuel_log_gauge_frac, drop column if exists gauge_before_frac,
--   drop column if exists gauge_after_frac, drop column if exists gauge_before_raw, drop column if exists gauge_after_raw;
-- alter table carguy.vehicle drop constraint if exists vehicle_gauge_type, drop constraint if exists vehicle_gauge_segments,
--   drop column if exists gauge_type, drop column if exists gauge_segments, drop column if exists gauge_reserve_at,
--   drop column if exists gauge_calibration;
