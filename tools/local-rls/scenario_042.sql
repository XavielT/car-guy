\set ON_ERROR_STOP 1
-- sql/042 (IMP 03112026 Phase 1, ADR-66): the AI gateway's tables and RPCs. A and B are Car Guy accounts of the earlier
-- scenarios, E is the admin. Runs before scenario_028 (which deletes A).
create or replace function public.t_service() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role":"service_role"}', false);
  execute 'set role service_role';
end $$;
grant execute on function public.t_service() to anon, authenticated, service_role;

reset role;
-- ------------------------------------------------------------------ seeds ----
select t_ok('42a. the five ai_* keys are seeded, none public',
  (select count(*) from carguy.app_config where key in ('ai_enabled', 'ai_limit_user_hour', 'ai_cap_user_day_usd',
     'ai_cap_global_day_usd', 'ai_limit_places_user_day') and not public) = 5);

-- an admin edit survives a re-run of sql/042 (on conflict do nothing)
select t_admin();
select carguy.set_app_config('ai_cap_user_day_usd', '1.25'::jsonb, false);
reset role;
\i sql/042_ai_gateway.sql
select t_ok('42b. re-running 042 keeps the admin''s edit',
  (select (value)::text from carguy.app_config where key = 'ai_cap_user_day_usd') = '1.25');
select t_admin();
select carguy.set_app_config('ai_cap_user_day_usd', '0.50'::jsonb, false);
reset role;

-- ---------------------------------------------------------------- consent ----
select t_as('b');
select t_ok('42c. B starts without consent', not carguy.my_ai_consent());
select t_ok('42d. B accepts', carguy.set_ai_consent(true, '1'));
select t_ok('42e. B now has consent', carguy.my_ai_consent());
select t_ok('42f. B cannot write the table directly',
  t_denied($q$insert into carguy.ai_consent (user_id, version) values ('00000000-0000-0000-0000-00000000000b', 'x')$q$));
select t_ok('42g. B cannot delete the row directly (no grant)', t_denied($q$delete from carguy.ai_consent$q$));
reset role;
select t_as('a');
select t_ok('42h. A does not see B''s consent', (select count(*) from carguy.ai_consent) = 0);
select t_ok('42i. A is not consented because B is', not carguy.my_ai_consent());
reset role;
select t_as('anon');
select t_ok('42j. anon cannot set consent', t_denied('select carguy.set_ai_consent(true, ''1'')'));
select t_ok('42k. anon cannot read consent', t_denied('select 1 from carguy.ai_consent'));
reset role;

-- ------------------------------------------------------------------ usage ----
select t_as('a');
select t_ok('42l. a client cannot insert usage (it could erase its own spend)',
  t_denied($q$insert into carguy.ai_usage (user_id, function, ok) values ('00000000-0000-0000-0000-00000000000a', 'cg-ai-ping', true)$q$));
reset role;

select t_service();
insert into carguy.ai_usage (user_id, function, model, input_tokens, output_tokens, cost_usd, ok)
  values ('00000000-0000-0000-0000-00000000000a', 'cg-ai-read', 'claude-haiku-5-5', 1500, 300, 0.30, true),
         ('00000000-0000-0000-0000-00000000000a', 'cg-ai-read', 'claude-haiku-5-5', 1500, 0, 0.10, false),
         ('00000000-0000-0000-0000-00000000000b', 'cg-ai-ping', 'claude-haiku-5-5', 20, 5, 0.01, true);
-- a row from yesterday (one minute before today's start in Santo Domingo) and one from 200 days ago
insert into carguy.ai_usage (user_id, function, cost_usd, ok, created_at)
  values ('00000000-0000-0000-0000-00000000000a', 'cg-ai-read', 3.00, true, carguy.ai_day_start() - interval '1 minute'),
         ('00000000-0000-0000-0000-00000000000a', 'cg-ai-read', 9.00, true, now() - interval '200 days');
select t_ok('42m. the service role can insert usage', (select count(*) from carguy.ai_usage) = 5);
reset role;

select t_as('a');
select t_ok('42n. A sees only their own usage', (select count(*) from carguy.ai_usage where user_id <> '00000000-0000-0000-0000-00000000000a') = 0
  and (select count(*) from carguy.ai_usage) = 4);
select t_ok('42o. A cannot call the admin summary', t_raises('select carguy.admin_ai_usage()', '%forbidden%'));
select t_ok('42p. A cannot call the gate', t_denied('select carguy.ai_gate(''00000000-0000-0000-0000-00000000000a'', ''x'')'));
select t_ok('42q. A cannot prune', t_raises('select carguy.ai_usage_prune(90)', '%forbidden%'));
reset role;
select t_as('anon');
select t_ok('42r. anon reads no usage', t_denied('select 1 from carguy.ai_usage'));
reset role;
select t_admin();
select t_ok('42s. the admin sees everyone''s usage', (select count(*) from carguy.ai_usage) = 5);
select t_ok('42t. admin summary: today = A 0.40 + B 0.01 (yesterday''s 3.00 is out)',
  (carguy.admin_ai_usage() -> 'today' ->> 'cost_usd')::numeric = 0.41
  and (carguy.admin_ai_usage() -> 'today' ->> 'calls')::int = 3
  and (carguy.admin_ai_usage() -> 'today' ->> 'errors')::int = 1);
select t_ok('42u. admin summary: 7 days includes yesterday, 30 days excludes the 200-day row',
  (carguy.admin_ai_usage() -> 'd7' ->> 'cost_usd')::numeric = 3.41
  and (carguy.admin_ai_usage() -> 'd30' ->> 'cost_usd')::numeric = 3.41);
select t_ok('42v. by_user is led by A', (carguy.admin_ai_usage() -> 'by_user' -> 0 ->> 'user_id') = '00000000-0000-0000-0000-00000000000a');
reset role;

-- ------------------------------------------------------------------- gate ----
select t_service();
select t_ok('42w. gate for A: enabled, no consent, 2 calls this hour, 0.40 today, 0.41 global',
  (carguy.ai_gate('00000000-0000-0000-0000-00000000000a', 'cg-ai-read') ->> 'enabled')::boolean
  and not (carguy.ai_gate('00000000-0000-0000-0000-00000000000a', 'cg-ai-read') ->> 'consent')::boolean
  and (carguy.ai_gate('00000000-0000-0000-0000-00000000000a', 'cg-ai-read') -> 'used' ->> 'user_hour')::int >= 2
  and (carguy.ai_gate('00000000-0000-0000-0000-00000000000a', 'cg-ai-read') -> 'used' ->> 'user_day_usd')::numeric = 0.40
  and (carguy.ai_gate('00000000-0000-0000-0000-00000000000a', 'cg-ai-read') -> 'used' ->> 'global_day_usd')::numeric = 0.41
  and (carguy.ai_gate('00000000-0000-0000-0000-00000000000a', 'cg-ai-read') -> 'used' ->> 'function_user_day')::int = 2);
select t_ok('42x. gate for B: consent true',
  (carguy.ai_gate('00000000-0000-0000-0000-00000000000b', 'cg-ai-ping') ->> 'consent')::boolean);
select t_ok('42y. the limits come from app_config',
  (carguy.ai_gate('00000000-0000-0000-0000-00000000000a', 'x') -> 'limits' ->> 'user_hour')::numeric = 30
  and (carguy.ai_gate('00000000-0000-0000-0000-00000000000a', 'x') -> 'limits' ->> 'global_day_usd')::numeric = 5.00);
reset role;

-- kill switch and a lowered cap flow through the gate
select t_admin();
select carguy.set_app_config('ai_enabled', 'false'::jsonb, false);
select carguy.set_app_config('ai_limit_user_hour', '0'::jsonb, false);
reset role;
select t_service();
select t_ok('42z. kill switch off → gate says disabled; hour limit 0',
  not (carguy.ai_gate('00000000-0000-0000-0000-00000000000a', 'x') ->> 'enabled')::boolean
  and (carguy.ai_gate('00000000-0000-0000-0000-00000000000a', 'x') -> 'limits' ->> 'user_hour')::numeric = 0);
reset role;
select t_admin();
select carguy.set_app_config('ai_enabled', 'true'::jsonb, false);
select carguy.set_app_config('ai_limit_user_hour', '30'::jsonb, false);
reset role;

-- ------------------------------------------------------------------ prune ----
select t_admin();
select t_ok('42aa. prune deletes the 200-day row only', carguy.ai_usage_prune(90) = 1);
select t_ok('42ab. prune keeps the rest', (select count(*) from carguy.ai_usage) = 4);
select t_ok('42ac. prune never goes below 7 days', carguy.ai_usage_prune(0) = 0);
reset role;

-- ---------------------------------------------------- withdraw / cascade ----
select t_as('b');
select t_ok('42ad. B withdraws', not carguy.set_ai_consent(false));
select t_ok('42ae. consent is gone', not carguy.my_ai_consent());
reset role;
