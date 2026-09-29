-- 014_is_member_null_fix.sql — security fix for 013 (IMP 28092026 Phase 7).
--
-- carguy.vehicle_role(v) is NULL for a vehicle the caller has no part in, so
-- 013's is_member() returned NULL, not false. create_invite / set_member_role
-- guard with `if not carguy.is_member(v, 'owner') then raise`, and `not NULL`
-- is NULL — the guard never fired. Any signed-in account could mint an invite
-- to any vehicle id it knew and redeem it itself. Found by the local Postgres
-- scenario run (docs/imp-28092026/04-tracking/PROGRESS.md, Phase 7), before
-- any real account existed in the cloud.
--
-- Only this function changes; policies that call it get the fix with it.
-- Apply: node tools/apply-sql.mjs sql/014_is_member_null_fix.sql

create or replace function carguy.is_member(v text, min_role text default 'viewer') returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(case min_role
           when 'owner' then carguy.vehicle_role(v) = 'owner'
           when 'editor' then carguy.vehicle_role(v) in ('owner', 'editor')
           else carguy.vehicle_role(v) in ('owner', 'editor', 'viewer') end, false);
$$;
revoke all on function carguy.is_member(text, text) from public;
grant execute on function carguy.is_member(text, text) to authenticated;

-- Invites minted through the hole, if any: an invite whose creator is not the
-- vehicle's owner is void.
delete from carguy.vehicle_invite i
 where not exists (select 1 from carguy.vehicle_member m
                    where m.vehicle_id = i.vehicle_id and m.user_id = i.created_by and m.role = 'owner' and m.deleted_at is null);

-- rollback: re-run the is_member definition from sql/013 (not recommended).
