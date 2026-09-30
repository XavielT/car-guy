-- 026_rls_v4.sql — row-level security for schema v4's three tables (IMP 30092026 Phase 2, 02-cloud-v4.md §026).
--
-- Copied, not invented:
--   · fuel_price, legal_acceptance — own rows, the 010 template exactly (a price someone saw at
--     the pump and the terms they accepted are the account's, not the car's). No member access.
--   · vehicle_fact — torque_spec's policies (the `else` arm of sql/013's swap, as 020 did for
--     trip): members of the car read it, owners and editors write it, a viewer only reads.
--     Plus keep_creator, as 013 put on every member-scoped table.
--   · carguy_app_only (sql/018) on all three: its loop covered the tables that existed then, so a
--     new table needs its own copy, or a Music Hub account could read it.
--
-- The public dossier does not expose any of the three (its `tires` block is sql/025's).
-- Nothing here for fuel_price_ref: that table is Phase 5's sql/027.
--
-- Everything in carguy; no --shared.
-- Apply: node tools/apply-sql.mjs sql/026_rls_v4.sql

-- ------------------------------------------ own rows: fuel_price, legal_acceptance ----
do $$
declare t text;
begin
  foreach t in array array['fuel_price', 'legal_acceptance']
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
    execute format(
      'create policy %I on carguy.%I for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())',
      t || '_own_update', t);
    execute format(
      'create policy %I on carguy.%I for delete to authenticated using (user_id = auth.uid())',
      t || '_own_delete', t);
  end loop;
end
$$;

-- ------------------------------------------------------- vehicle_fact (members) ----
alter table carguy.vehicle_fact enable row level security;

drop policy if exists vehicle_fact_own_select on carguy.vehicle_fact;
drop policy if exists vehicle_fact_own_insert on carguy.vehicle_fact;
drop policy if exists vehicle_fact_own_update on carguy.vehicle_fact;
drop policy if exists vehicle_fact_own_delete on carguy.vehicle_fact;
drop policy if exists vehicle_fact_member_select on carguy.vehicle_fact;
drop policy if exists vehicle_fact_member_insert on carguy.vehicle_fact;
drop policy if exists vehicle_fact_member_update on carguy.vehicle_fact;
drop policy if exists vehicle_fact_member_delete on carguy.vehicle_fact;

create policy vehicle_fact_member_select on carguy.vehicle_fact for select to authenticated
  using (carguy.can_see(vehicle_id, user_id));
create policy vehicle_fact_member_insert on carguy.vehicle_fact for insert to authenticated
  with check (user_id = (select auth.uid()) and carguy.can_edit(vehicle_id, user_id));
create policy vehicle_fact_member_update on carguy.vehicle_fact for update to authenticated
  using (carguy.can_edit(vehicle_id, user_id)) with check (carguy.can_edit(vehicle_id, user_id));
create policy vehicle_fact_member_delete on carguy.vehicle_fact for delete to authenticated
  using (carguy.can_edit(vehicle_id, user_id));

drop trigger if exists keep_creator on carguy.vehicle_fact;
create trigger keep_creator before update on carguy.vehicle_fact
  for each row execute function carguy.keep_creator();

-- ------------------------------------------------------------ Car Guy only ----
do $$
declare t text;
begin
  foreach t in array array['fuel_price', 'vehicle_fact', 'legal_acceptance']
  loop
    execute format('drop policy if exists carguy_app_only on carguy.%I', t);
    execute format(
      'create policy carguy_app_only on carguy.%I as restrictive for all to authenticated '
      'using ((select carguy.is_app_user())) with check ((select carguy.is_app_user()))', t);
    execute format('revoke all on carguy.%I from anon', t);
  end loop;
end
$$;

-- rollback:
-- do $$ declare t text; begin
--   foreach t in array array['fuel_price', 'vehicle_fact', 'legal_acceptance'] loop
--     execute format('drop policy if exists carguy_app_only on carguy.%I', t);
--   end loop;
--   foreach t in array array['fuel_price', 'legal_acceptance'] loop
--     execute format('drop policy if exists %I on carguy.%I', t || '_own_select', t);   (… _insert, _update, _delete)
--   end loop; end $$;
-- drop policy if exists vehicle_fact_member_select on carguy.vehicle_fact;  (… _insert, _update, _delete)
-- drop trigger if exists keep_creator on carguy.vehicle_fact;
-- (with RLS on and no policy left, the tables read as empty — nothing leaks while rolled back)
