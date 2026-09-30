-- 020_rls_v3.sql — row-level security for carguy.trip (IMP 29092026 Phase 2).
--
-- The package calls this file 019 (see 019_schema_v3.sql for the renumbering).
--
-- Copied, not invented: the policy shape is the one sql/013 gives track_event
-- (the `else` arm of its policy swap) — members see a trip on a car they
-- belong to, editors and owners write it, a viewer only reads it. Plus two
-- things that did not exist when 013 ran:
--   · keep_creator, as 013 put on every member-scoped table;
--   · carguy_app_only (sql/018): its loop covered the tables that existed then,
--     so a new table needs its own copy, or a Music Hub account could read it.
--
-- The public dossier (sql/012/017) does not expose trips.
--
-- Everything in carguy; no --shared.
-- Apply: node tools/apply-sql.mjs sql/020_rls_v3.sql

alter table carguy.trip enable row level security;

drop policy if exists trip_own_select on carguy.trip;
drop policy if exists trip_own_insert on carguy.trip;
drop policy if exists trip_own_update on carguy.trip;
drop policy if exists trip_own_delete on carguy.trip;
drop policy if exists trip_member_select on carguy.trip;
drop policy if exists trip_member_insert on carguy.trip;
drop policy if exists trip_member_update on carguy.trip;
drop policy if exists trip_member_delete on carguy.trip;

create policy trip_member_select on carguy.trip for select to authenticated
  using (carguy.can_see(vehicle_id, user_id));
create policy trip_member_insert on carguy.trip for insert to authenticated
  with check (user_id = (select auth.uid()) and carguy.can_edit(vehicle_id, user_id));
create policy trip_member_update on carguy.trip for update to authenticated
  using (carguy.can_edit(vehicle_id, user_id)) with check (carguy.can_edit(vehicle_id, user_id));
create policy trip_member_delete on carguy.trip for delete to authenticated
  using (carguy.can_edit(vehicle_id, user_id));

drop trigger if exists keep_creator on carguy.trip;
create trigger keep_creator before update on carguy.trip
  for each row execute function carguy.keep_creator();

drop policy if exists carguy_app_only on carguy.trip;
create policy carguy_app_only on carguy.trip as restrictive for all to authenticated
  using ((select carguy.is_app_user())) with check ((select carguy.is_app_user()));

revoke all on carguy.trip from anon;

-- rollback:
-- drop policy if exists carguy_app_only on carguy.trip;
-- drop policy if exists trip_member_select on carguy.trip;  (… _insert, _update, _delete)
-- drop trigger if exists keep_creator on carguy.trip;
