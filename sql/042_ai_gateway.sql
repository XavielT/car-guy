-- 042_ai_gateway.sql — IMP 03112026 Phase 1 (SPEC-A §A4; ADR-65, ADR-66).
--
-- The tables and RPCs behind the AI gateway (Edge Functions `cg-*`, supabase/functions/_shared/gate.ts):
--   · carguy.ai_consent  — one row per person who accepted the AI terms (version-stamped). Read through
--                          my_ai_consent(); written ONLY through set_ai_consent(). The Edge Function checks it
--                          server-side (403 sin_consentimiento_ia), never the client alone (SGC pattern).
--   · carguy.ai_usage    — one row per provider call: function, model, tokens, cost, ok / error_code. INSERT only by
--                          the service role (the Edge Function). A person reads their own rows; the admin reads all.
--                          Never holds a prompt, a transcript, a photo or a document number — counts and cost only.
--   · app_config keys    — ai_enabled (the KILL SWITCH), ai_limit_user_hour, ai_cap_user_day_usd,
--                          ai_cap_global_day_usd, ai_limit_places_user_day. Seeded once (on conflict do nothing: a
--                          re-run never overwrites what the admin changed); edited through the existing
--                          set_app_config() from Admin → Uso y costos.
--   · ai_gate(user, fn)  — ONE round trip for the gate: kill switch, consent, caps and the counters, with the day
--                          cut in America/Santo_Domingo (UTC-4, no DST), not UTC (an SGC lesson). service_role only.
--   · admin_ai_usage()   — spend today / 7 d / 30 d, by function and by person, for the Admin screen.
--   · ai_usage_prune()   — admin button: delete usage older than N days (default 90).
--
-- carguy only, additive, re-runnable, no --shared. Touches nothing Music Hub owns.
-- Apply: node tools/apply-sql.mjs sql/042_ai_gateway.sql   (BEFORE deploying the cg-* functions)

-- ------------------------------------------------------------------- consent ----
create table if not exists carguy.ai_consent (
  user_id     uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  accepted_at timestamptz not null default now(),
  version     text not null default '1'
);
alter table carguy.ai_consent enable row level security;
drop policy if exists ai_consent_select_own on carguy.ai_consent;
create policy ai_consent_select_own on carguy.ai_consent for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists carguy_app_only on carguy.ai_consent;
create policy carguy_app_only on carguy.ai_consent as restrictive for all to authenticated
  using ((select carguy.is_app_user())) with check ((select carguy.is_app_user()));
-- No insert/update/delete grant at all: the only door is set_ai_consent().
revoke all on carguy.ai_consent from anon, authenticated;
grant select on carguy.ai_consent to authenticated;
grant select on carguy.ai_consent to service_role;

create or replace function carguy.my_ai_consent()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from carguy.ai_consent c where c.user_id = (select auth.uid()))
$$;
revoke all on function carguy.my_ai_consent() from public;
grant execute on function carguy.my_ai_consent() to authenticated;

-- p_on = true records (or re-stamps) the acceptance of terms version p_version; false withdraws it (row deleted).
create or replace function carguy.set_ai_consent(p_on boolean, p_version text default '1')
returns boolean language plpgsql volatile security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
begin
  if me is null or not carguy.is_app_user() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if coalesce(p_on, false) then
    insert into carguy.ai_consent (user_id, accepted_at, version)
    values (me, now(), left(coalesce(nullif(btrim(p_version), ''), '1'), 20))
    on conflict (user_id) do update set accepted_at = now(), version = excluded.version;
    return true;
  end if;
  delete from carguy.ai_consent where user_id = me;
  return false;
end $$;
revoke all on function carguy.set_ai_consent(boolean, text) from public;
grant execute on function carguy.set_ai_consent(boolean, text) to authenticated;

-- --------------------------------------------------------------------- usage ----
create table if not exists carguy.ai_usage (
  id            bigint generated always as identity primary key,
  user_id       uuid not null references auth.users(id) on delete cascade,
  function      text not null check (function ~ '^[a-z0-9_-]{2,40}$'),
  model         text,
  input_tokens  integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  cost_usd      numeric(10, 6) not null default 0 check (cost_usd >= 0),
  vehicle_id    text,
  ok            boolean not null,
  error_code    text,
  created_at    timestamptz not null default now()
);
create index if not exists idx_ai_usage_user_created on carguy.ai_usage (user_id, created_at);
create index if not exists idx_ai_usage_function_created on carguy.ai_usage (function, created_at);

alter table carguy.ai_usage enable row level security;
drop policy if exists ai_usage_select on carguy.ai_usage;
create policy ai_usage_select on carguy.ai_usage for select to authenticated
  using (user_id = (select auth.uid()) or (select carguy.is_admin()));
drop policy if exists carguy_app_only on carguy.ai_usage;
create policy carguy_app_only on carguy.ai_usage as restrictive for all to authenticated
  using ((select carguy.is_app_user())) with check ((select carguy.is_app_user()));
-- A client can never write usage (it could erase its own spend): select only; the service role inserts.
revoke all on carguy.ai_usage from anon, authenticated;
grant select on carguy.ai_usage to authenticated;
grant select, insert on carguy.ai_usage to service_role;

-- -------------------------------------------------------------------- config ----
-- Seeded once. `on conflict do nothing` so a re-run never undoes an admin edit. Not public: the app learns the state
-- through cg-ai-status, and the admin edits through set_app_config().
insert into carguy.app_config (key, value, public) values
  ('ai_enabled', 'true'::jsonb, false),
  ('ai_limit_user_hour', '30'::jsonb, false),
  ('ai_cap_user_day_usd', '0.50'::jsonb, false),
  ('ai_cap_global_day_usd', '5.00'::jsonb, false),
  ('ai_limit_places_user_day', '20'::jsonb, false)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------- gate ----
-- Start of "today" in the person's country, as a timestamptz. Santo Domingo is UTC-4 all year.
create or replace function carguy.ai_day_start()
returns timestamptz language sql stable set search_path = '' as $$
  select date_trunc('day', now() at time zone 'America/Santo_Domingo') at time zone 'America/Santo_Domingo'
$$;

create or replace function carguy.ai_gate(p_user uuid, p_function text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  cfg jsonb;
  day0 timestamptz := carguy.ai_day_start();
begin
  select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) into cfg
    from carguy.app_config where key in
      ('ai_enabled', 'ai_limit_user_hour', 'ai_cap_user_day_usd', 'ai_cap_global_day_usd', 'ai_limit_places_user_day');
  return jsonb_build_object(
    'enabled', coalesce((cfg ->> 'ai_enabled')::boolean, true),
    'consent', exists (select 1 from carguy.ai_consent c where c.user_id = p_user),
    'limits', jsonb_build_object(
      'user_hour', coalesce((cfg ->> 'ai_limit_user_hour')::numeric, 30),
      'user_day_usd', coalesce((cfg ->> 'ai_cap_user_day_usd')::numeric, 0.50),
      'global_day_usd', coalesce((cfg ->> 'ai_cap_global_day_usd')::numeric, 5.00),
      'places_user_day', coalesce((cfg ->> 'ai_limit_places_user_day')::numeric, 20)),
    'used', jsonb_build_object(
      'user_hour', (select count(*) from carguy.ai_usage u
                     where u.user_id = p_user and u.created_at >= now() - interval '1 hour'),
      'user_day_usd', (select coalesce(sum(u.cost_usd), 0) from carguy.ai_usage u
                        where u.user_id = p_user and u.created_at >= day0),
      'global_day_usd', (select coalesce(sum(u.cost_usd), 0) from carguy.ai_usage u where u.created_at >= day0),
      'function_user_day', (select count(*) from carguy.ai_usage u
                             where u.user_id = p_user and u.function = p_function and u.created_at >= day0)),
    'day_start', day0);
end $$;
revoke all on function carguy.ai_gate(uuid, text) from public, anon, authenticated;
grant execute on function carguy.ai_gate(uuid, text) to service_role;

-- --------------------------------------------------------------------- admin ----
create or replace function carguy.admin_ai_usage()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  day0 timestamptz := carguy.ai_day_start();
begin
  if not carguy.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'at', now(),
    'today', (select jsonb_build_object('calls', count(*), 'errors', count(*) filter (where not ok),
                'cost_usd', coalesce(sum(cost_usd), 0)) from carguy.ai_usage where created_at >= day0),
    'd7', (select jsonb_build_object('calls', count(*), 'errors', count(*) filter (where not ok),
                'cost_usd', coalesce(sum(cost_usd), 0)) from carguy.ai_usage where created_at >= day0 - interval '6 days'),
    'd30', (select jsonb_build_object('calls', count(*), 'errors', count(*) filter (where not ok),
                'cost_usd', coalesce(sum(cost_usd), 0)) from carguy.ai_usage where created_at >= day0 - interval '29 days'),
    'by_function', coalesce((select jsonb_agg(r order by r.cost_usd desc) from (
        select function, count(*) as calls, count(*) filter (where not ok) as errors,
               coalesce(sum(cost_usd), 0) as cost_usd
          from carguy.ai_usage where created_at >= day0 - interval '29 days' group by function) r), '[]'::jsonb),
    'by_user', coalesce((select jsonb_agg(r order by r.cost_usd desc) from (
        select u.user_id, p.display_name, count(*) as calls, coalesce(sum(u.cost_usd), 0) as cost_usd
          from carguy.ai_usage u left join carguy.profiles p on p.user_id = u.user_id
         where u.created_at >= day0 - interval '29 days'
         group by u.user_id, p.display_name order by coalesce(sum(u.cost_usd), 0) desc limit 20) r), '[]'::jsonb),
    'consented_users', (select count(*) from carguy.ai_consent));
end $$;
revoke all on function carguy.admin_ai_usage() from public;
grant execute on function carguy.admin_ai_usage() to authenticated;

create or replace function carguy.ai_usage_prune(p_days integer default 90)
returns integer language plpgsql volatile security definer set search_path = '' as $$
declare
  n integer;
begin
  if not carguy.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  delete from carguy.ai_usage where created_at < now() - make_interval(days => greatest(coalesce(p_days, 90), 7));
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function carguy.ai_usage_prune(integer) from public;
grant execute on function carguy.ai_usage_prune(integer) to authenticated;

-- rollback:
-- drop function if exists carguy.ai_usage_prune(integer); drop function if exists carguy.admin_ai_usage();
-- drop function if exists carguy.ai_gate(uuid, text); drop function if exists carguy.ai_day_start();
-- drop function if exists carguy.set_ai_consent(boolean, text); drop function if exists carguy.my_ai_consent();
-- delete from carguy.app_config where key in ('ai_enabled', 'ai_limit_user_hour', 'ai_cap_user_day_usd',
--   'ai_cap_global_day_usd', 'ai_limit_places_user_day');
-- drop table if exists carguy.ai_usage; drop table if exists carguy.ai_consent;
