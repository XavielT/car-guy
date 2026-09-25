-- 008_catalog_per_user_keys.sql — the seeded catalogue tables are keyed per account.
--
-- Found by tools/verify-shared-ids.mjs (2026-09-25). Every device seeds
-- `service_type`, `inspection_template` and `inspection_item` from
-- lib/domain/catalog.ts with the same slug ids — `aceite_motor`,
-- `carro_semanal`, `carro_semanal__0`. sql/002 gave every table
-- `id text primary key`, so the first account to push `aceite_motor` owns that
-- row for everyone. A second account's upsert then conflicts with a row its
-- update policy cannot see:
--
--   403 42501 new row violates row-level security policy (USING expression)
--
-- and because a push error aborts the whole sync, that account never syncs
-- again. It never showed because only one account had ever synced.
--
-- The fix is the one `setting` already uses: the key is (user_id, id). Each
-- account has its own `aceite_motor`, which is also what lets Más → Catálogo
-- de servicios edit an interval without reaching anyone else.
--
-- The client pushes these three tables with `onConflict: 'user_id,id'`
-- (lib/sync/tables.ts `keyedBy: 'user_id'`). Apply this and ship that client
-- together: an old client's `on_conflict=id` has no matching constraint once
-- this runs, and fails for these three tables until it reloads.
--
-- Every other table keeps `id`: their ids are UUIDs, or derived from one
-- (`odo_<uuid>`, `<template>@<vehicle uuid>`), and cannot collide.
--
-- Idempotent: each key is dropped by name and recreated.

do $$
declare
  t text;
begin
  foreach t in array array['service_type', 'inspection_template', 'inspection_item']
  loop
    execute format('alter table carguy.%I drop constraint if exists %I', t, t || '_pkey');
    execute format('alter table carguy.%I add constraint %I primary key (user_id, id)', t, t || '_pkey');
  end loop;
end
$$;

-- Verify: all three should show (user_id, id).
select tc.table_name, string_agg(kcu.column_name, ', ' order by kcu.ordinal_position) as key
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on kcu.constraint_name = tc.constraint_name and kcu.table_schema = tc.table_schema
where tc.table_schema = 'carguy'
  and tc.constraint_type = 'PRIMARY KEY'
  and tc.table_name in ('service_type', 'inspection_template', 'inspection_item')
group by tc.table_name
order by tc.table_name;

-- rollback (only possible while no two accounts share an id in these tables):
-- do $$
-- declare t text;
-- begin
--   foreach t in array array['service_type', 'inspection_template', 'inspection_item']
--   loop
--     execute format('alter table carguy.%I drop constraint if exists %I', t, t || '_pkey');
--     execute format('alter table carguy.%I add constraint %I primary key (id)', t, t || '_pkey');
--   end loop;
-- end
-- $$;
