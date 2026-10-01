\set ON_ERROR_STOP 1
-- sql/027 (fuel_price_ref + upsert_fuel_price_ref + carguy_importer), after scenario.sql's helpers
-- (t_as, t_ok, t_denied). Run by run.sh after both 027 files.

create or replace function public.t_as_importer() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role":"carguy_importer"}', false);
  execute 'set role carguy_importer';
end $$;
grant execute on function public.t_as_importer() to carguy_importer;
grant usage on schema public to carguy_importer;
grant execute on function public.t_ok(text, boolean, text), public.t_denied(text) to carguy_importer;

-- 27a: the importer writes a week through the RPC
select t_as_importer();
select t_ok('27a. importer: upsert_fuel_price_ref writes a week (5 rows)',
  carguy.upsert_fuel_price_ref('[
    {"week_start":"2026-09-19","week_end":"2026-09-25","fuel_type":"premium","price":350.10,"pdf_url":"https://micm.gob.do/a.pdf","raw_text":"Gasolina Premium …"},
    {"week_start":"2026-09-19","week_end":"2026-09-25","fuel_type":"regular","price":315.50,"pdf_url":"https://micm.gob.do/a.pdf"},
    {"week_start":"2026-09-19","week_end":"2026-09-25","fuel_type":"gasoil_regular","price":267.80},
    {"week_start":"2026-09-19","week_end":"2026-09-25","fuel_type":"gasoil_optimo","price":302.10},
    {"week_start":"2026-09-19","week_end":"2026-09-25","fuel_type":"glp","price":135.20}
  ]'::jsonb) = 5);
select t_ok('27b. importer: cannot insert into the table directly',
  t_denied($q$insert into carguy.fuel_price_ref (week_start, week_end, fuel_type, price) values ('2026-01-03', '2026-01-09', 'glp', 1)$q$));
reset role;

-- 27c: anon reads
select t_as('anon');
select t_ok('27c. anon reads fuel_price_ref',
  (select count(*) from carguy.fuel_price_ref where week_start = '2026-09-19') = 5
  and (select price from carguy.fuel_price_ref where week_start = '2026-09-19' and fuel_type = 'premium') = 350.10);
select t_ok('27d. anon cannot insert, update or delete',
  t_denied($q$insert into carguy.fuel_price_ref (week_start, week_end, fuel_type, price) values ('2026-10-03', '2026-10-09', 'premium', 1)$q$)
  and t_denied($q$update carguy.fuel_price_ref set price = 1$q$)
  and t_denied($q$delete from carguy.fuel_price_ref$q$));
select t_ok('27e. anon cannot execute the importer RPC',
  t_denied($q$select carguy.upsert_fuel_price_ref('[{"week_start":"2026-10-03","week_end":"2026-10-09","fuel_type":"premium","price":1}]'::jsonb)$q$));
reset role;

-- 27f: a signed-in user reads, cannot write, cannot call the RPC
select t_as('a');
select t_ok('27f. authenticated reads; cannot insert or call the RPC',
  (select count(*) from carguy.fuel_price_ref) = 5
  and t_denied($q$insert into carguy.fuel_price_ref (week_start, week_end, fuel_type, price) values ('2026-10-03', '2026-10-09', 'premium', 1)$q$)
  and t_denied($q$select carguy.upsert_fuel_price_ref('[{"week_start":"2026-10-03","week_end":"2026-10-09","fuel_type":"premium","price":1}]'::jsonb)$q$));
reset role;

-- 27g: the importer upserts (same week+fuel = update), marks stale keeping raw_text, then a fresh week clears it
select t_as_importer();
select t_ok('27g. upsert on (week_start, fuel_type) updates instead of duplicating',
  carguy.upsert_fuel_price_ref('[{"week_start":"2026-09-19","week_end":"2026-09-25","fuel_type":"premium","price":351.00}]'::jsonb) = 1);
select t_ok('27h. the stale mark keeps price source and raw text',
  carguy.upsert_fuel_price_ref('[{"week_start":"2026-09-19","week_end":"2026-09-25","fuel_type":"premium","price":351.00,"stale":true}]'::jsonb) = 1);
select t_ok('27i. bad input raises and writes nothing',
  t_denied($q$select carguy.upsert_fuel_price_ref('[{"week_start":"2026-09-26","week_end":"2026-10-02","fuel_type":"kerosene","price":383.70}]'::jsonb)$q$)
  and t_denied($q$select carguy.upsert_fuel_price_ref('{}'::jsonb)$q$)
  and t_denied($q$select carguy.upsert_fuel_price_ref('[{"week_start":"2026-09-26","week_end":"2026-10-30","fuel_type":"glp","price":135}]'::jsonb)$q$)
  and t_denied($q$select carguy.upsert_fuel_price_ref('[{"week_start":"2026-09-26","week_end":"2026-10-02","fuel_type":"glp","price":135,"source":"manual"}]'::jsonb)$q$));
select t_ok('27j. a fresh week clears the older week''s stale flag',
  carguy.upsert_fuel_price_ref('[{"week_start":"2026-09-26","week_end":"2026-10-02","fuel_type":"premium","price":353.10}]'::jsonb) = 1);
reset role;

select t_as('anon');
select t_ok('27k. what anon sees after the upserts',
  (select count(*) from carguy.fuel_price_ref) = 6
  and (select price from carguy.fuel_price_ref where week_start = '2026-09-19' and fuel_type = 'premium') = 351.00
  and (select raw_text from carguy.fuel_price_ref where week_start = '2026-09-19' and fuel_type = 'premium') = 'Gasolina Premium …'
  and (select pdf_url from carguy.fuel_price_ref where week_start = '2026-09-19' and fuel_type = 'premium') = 'https://micm.gob.do/a.pdf'
  and not (select stale from carguy.fuel_price_ref where week_start = '2026-09-19' and fuel_type = 'premium')
  and (select count(*) from carguy.fuel_price_ref where stale) = 0);
reset role;

-- 27l: only carguy_importer (and service_role, the fallback) may execute it
select t_ok('27l. EXECUTE on the RPC: carguy_importer and service_role only',
  has_function_privilege('carguy_importer', 'carguy.upsert_fuel_price_ref(jsonb)', 'execute')
  and has_function_privilege('service_role', 'carguy.upsert_fuel_price_ref(jsonb)', 'execute')
  and not has_function_privilege('anon', 'carguy.upsert_fuel_price_ref(jsonb)', 'execute')
  and not has_function_privilege('authenticated', 'carguy.upsert_fuel_price_ref(jsonb)', 'execute')
  and not has_table_privilege('carguy_importer', 'carguy.fuel_price_ref', 'insert')
  and pg_has_role('authenticator', 'carguy_importer', 'member'));
