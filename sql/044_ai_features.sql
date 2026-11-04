-- 044_ai_features.sql — IMP 03112026 Phase 6 (SPEC-G §G10): a runtime off-switch PER AI FEATURE.
--
-- The kill switch (ai_enabled) stops everything; the admin also needs to switch ONE workflow off when it disappoints (album, accident
-- photos, checklist photos, sale sheet, smart search, nearby places) without touching the rest. The list lives in ONE app_config key:
--   ai_features_off   jsonb array of feature ids, e.g. ["album","places"]   (missing or [] = every feature on)
-- It is written through the existing set_app_config() (admin only) and read by carguy.ai_gate(), which every cg-* function already calls:
-- the gateway then refuses a call for a switched-off feature with ai_disabled BEFORE any provider is reached, so a stale app cannot spend.
-- Purely additive: ai_gate keeps every field it returned; 'features_off' is one more. Safe to apply twice (create or replace).
--
-- ORDER MATTERS: sql/042 also defines ai_gate(). Re-running 042 AFTER this file puts the old definition back (no features_off), so after
-- any re-run of 042 apply this file again. (It is idempotent.)
--
-- apply:    node tools/apply-sql.mjs sql/044_ai_features.sql
-- rollback: re-apply the ai_gate definition from sql/042_ai_gateway.sql, then
--           delete from carguy.app_config where key = 'ai_features_off';

create or replace function carguy.ai_gate(p_user uuid, p_function text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  cfg jsonb;
  day0 timestamptz := carguy.ai_day_start();
begin
  select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) into cfg
    from carguy.app_config where key in
      ('ai_enabled', 'ai_limit_user_hour', 'ai_cap_user_day_usd', 'ai_cap_global_day_usd', 'ai_limit_places_user_day', 'ai_features_off');
  return jsonb_build_object(
    'enabled', coalesce((cfg ->> 'ai_enabled')::boolean, true),
    'consent', exists (select 1 from carguy.ai_consent c where c.user_id = p_user),
    -- Only a JSON array counts; anything else (a typo, an object) reads as "nothing switched off" rather than breaking the gate.
    'features_off', case when jsonb_typeof(cfg -> 'ai_features_off') = 'array' then cfg -> 'ai_features_off' else '[]'::jsonb end,
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
