-- 016_member_service_types.sql — the last per-user catalogues a shared car needs (2.1.2).
--
-- Like 015 for venues and mod categories: a member may READ the owner's
-- service_type rows the shared car's service items and reminders point at, and
-- the inspection_template rows its checks point at (the check's items travel as
-- inspection_result.label_snapshot, so inspection_item stays private). Without
-- them a member's copy of a service item with a custom type could not be
-- written locally (service_record_item.service_type_id is a local foreign key)
-- and sat parked in sync, and a custom check had no name. Writes stay own-rows.
--
-- Everything in carguy; no --shared.
-- Apply: node tools/apply-sql.mjs sql/016_member_service_types.sql

drop policy if exists service_type_own_select on carguy.service_type;
drop policy if exists service_type_member_select on carguy.service_type;
create policy service_type_member_select on carguy.service_type for select to authenticated using (
  user_id = (select auth.uid())
  -- Seeded rows exist for everyone under the same id: a member keeps its own copy.
  or not service_type.is_seeded and (exists (select 1 from carguy.service_record_item i join carguy.service_record r on r.id = i.service_record_id
              where i.service_type_id = service_type.id and i.user_id = service_type.user_id and i.deleted_at is null
                and carguy.can_see(r.vehicle_id, r.user_id))
  or exists (select 1 from carguy.reminder m
              where m.service_type_id = service_type.id and m.user_id = service_type.user_id and m.deleted_at is null
                and carguy.can_see(m.vehicle_id, m.user_id))));

drop policy if exists inspection_template_own_select on carguy.inspection_template;
drop policy if exists inspection_template_member_select on carguy.inspection_template;
create policy inspection_template_member_select on carguy.inspection_template for select to authenticated using (
  user_id = (select auth.uid())
  -- Seeded rows exist for everyone under the same id: a member keeps its own copy.
  or not inspection_template.is_seeded and exists (select 1 from carguy.inspection x
              where x.template_id = inspection_template.id and x.user_id = inspection_template.user_id and x.deleted_at is null
                and carguy.can_see(x.vehicle_id, x.user_id)));

-- rollback:
-- drop policy if exists service_type_member_select on carguy.service_type;
-- create policy service_type_own_select on carguy.service_type for select to authenticated using (user_id = auth.uid());
-- drop policy if exists inspection_template_member_select on carguy.inspection_template;
-- create policy inspection_template_own_select on carguy.inspection_template for select to authenticated using (user_id = auth.uid());
