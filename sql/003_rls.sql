-- 003_rls.sql — row level security: a row belongs to exactly one account.
--
-- Idempotent: policies are dropped by name and recreated, so re-running this
-- file is safe and is the way to change a policy.
--
-- `setting` gets the same four policies as everything else even though it has
-- no `id` column — RLS cares about `user_id`, not about the primary key.

do $$
declare
  t text;
  tables text[] := array[
    'profiles', 'vehicle', 'vehicle_spec', 'odometer_reading', 'fuel_log',
    'service_type', 'service_record', 'service_record_item', 'part', 'expense',
    'reminder', 'inspection_template', 'inspection_item', 'inspection',
    'inspection_result', 'task', 'document', 'media', 'setting'
  ];
begin
  foreach t in array tables
  loop
    execute format('alter table carguy.%I enable row level security', t);

    execute format('drop policy if exists %I on carguy.%I', t || '_own_select', t);
    execute format('drop policy if exists %I on carguy.%I', t || '_own_insert', t);
    execute format('drop policy if exists %I on carguy.%I', t || '_own_update', t);
    execute format('drop policy if exists %I on carguy.%I', t || '_own_delete', t);

    execute format(
      'create policy %I on carguy.%I for select to authenticated using (user_id = auth.uid())',
      t || '_own_select', t);
    execute format(
      'create policy %I on carguy.%I for insert to authenticated with check (user_id = auth.uid())',
      t || '_own_insert', t);
    -- Both `using` and `with check`: `using` decides which rows may be updated,
    -- `with check` stops an update from handing a row to another account.
    execute format(
      'create policy %I on carguy.%I for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())',
      t || '_own_update', t);
    execute format(
      'create policy %I on carguy.%I for delete to authenticated using (user_id = auth.uid())',
      t || '_own_delete', t);
  end loop;
end
$$;

grant select, insert, update, delete on all tables in schema carguy to authenticated;

-- So a table added by a later migration is reachable without re-granting.
alter default privileges in schema carguy
  grant select, insert, update, delete on tables to authenticated;

-- anon is never granted anything in this schema. Without a grant the API
-- answers 401/42501 before RLS is even consulted.
revoke all on all tables in schema carguy from anon;
revoke usage on schema carguy from anon;


-- rollback:
-- do $$
-- declare t text;
-- begin
--   foreach t in array array[
--     'profiles','vehicle','vehicle_spec','odometer_reading','fuel_log','service_type',
--     'service_record','service_record_item','part','expense','reminder',
--     'inspection_template','inspection_item','inspection','inspection_result',
--     'task','document','media','setting'
--   ]
--   loop
--     execute format('alter table carguy.%I disable row level security', t);
--   end loop;
-- end $$;
