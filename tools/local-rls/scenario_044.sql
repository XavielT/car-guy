\set ON_ERROR_STOP 1
-- sql/044 (IMP 03112026 Phase 6, SPEC-G §G10): the per-feature off-switch the gate reports. E is the admin, B a Car Guy account.
reset role;
-- scenario_042 re-ran sql/042 (its re-run test), which restores the old ai_gate(); 044 is applied again, as an operator would.
\i sql/044_ai_features.sql
delete from carguy.app_config where key = 'ai_features_off';

select t_ok('44a. with no key the gate reports an empty list',
  (select carguy.ai_gate('00000000-0000-0000-0000-00000000000b', 'cg-ai-read')) -> 'features_off' = '[]'::jsonb);

select t_admin();
select carguy.set_app_config('ai_features_off', '["album","places"]'::jsonb, false);
reset role;
select t_ok('44b. the admin''s list reaches the gate',
  (select carguy.ai_gate('00000000-0000-0000-0000-00000000000b', 'cg-ai-read')) -> 'features_off' = '["album","places"]'::jsonb);

select t_as('b');
select t_ok('44c. a Car Guy account cannot write the key', t_denied($q$select carguy.set_app_config('ai_features_off', '[]'::jsonb, false)$q$));
select t_ok('44d. nor call the gate itself (service role only)', t_denied($q$select carguy.ai_gate('00000000-0000-0000-0000-00000000000b', 'cg-ai-read')$q$));
reset role;

select t_admin();
select carguy.set_app_config('ai_features_off', '"album"'::jsonb, false);
reset role;
select t_ok('44e. a value that is not an array reads as nothing off, never breaks the gate',
  (select carguy.ai_gate('00000000-0000-0000-0000-00000000000b', 'cg-ai-read')) -> 'features_off' = '[]'::jsonb);

select t_ok('44f. every field 042 returned is still there',
  (select carguy.ai_gate('00000000-0000-0000-0000-00000000000b', 'cg-ai-read')) ?& array['enabled', 'consent', 'limits', 'used', 'day_start']);

select t_admin();
select carguy.set_app_config('ai_features_off', null, false);
reset role;
select t_ok('44g. deleting the key switches every feature back on',
  (select carguy.ai_gate('00000000-0000-0000-0000-00000000000b', 'cg-ai-read')) -> 'features_off' = '[]'::jsonb);
