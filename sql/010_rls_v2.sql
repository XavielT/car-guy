-- 010_rls_v2.sql — row-level security for the schema v2 tables, the media quota
-- column and the storage-usage RPC (IMP 28092026, 02-cloud-v2.md §2, ADR-23).
--
-- Own-rows policies, the 003 template exactly: a row is visible and writable only
-- by the account whose user_id it carries. PROMPT-07 later swaps the vehicle-scoped
-- tables to is_member(); until then a shared garage does not exist.
--
-- `vehicle_member` is the exception: select only (my own memberships). No insert,
-- update or delete policy — a client that could write it could make itself a member
-- of any vehicle. PROMPT-07's security-definer RPCs are its only writers.
--
-- Everything here lives in `carguy`. storage_usage_bytes() *reads* storage.objects
-- through security definer; it changes nothing there, so no --shared.
--
-- Apply: node tools/apply-sql.mjs sql/010_rls_v2.sql

do $$
declare
  t text;
  tables text[] := array[
    'vehicle_ownership', 'album_item', 'milestone', 'mod_category', 'mod',
    'mod_media', 'vehicle_specsheet', 'spec_snapshot', 'torque_spec', 'wishlist_item',
    'inventory_item', 'wheel_set', 'tire', 'vehicle_dtc_event', 'contact',
    'fluid_guide_item', 'venue', 'track_event', 'track_session', 'setup_sheet',
    'consumable_usage', 'vehicle_share'
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
    execute format(
      'create policy %I on carguy.%I for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())',
      t || '_own_update', t);
    execute format(
      'create policy %I on carguy.%I for delete to authenticated using (user_id = auth.uid())',
      t || '_own_delete', t);
  end loop;
end
$$;

alter table carguy.vehicle_member enable row level security;
drop policy if exists vehicle_member_own_select on carguy.vehicle_member;
create policy vehicle_member_own_select on carguy.vehicle_member
  for select to authenticated using (user_id = auth.uid());
revoke insert, update, delete on carguy.vehicle_member from authenticated;

revoke all on all tables in schema carguy from anon;

-- ------------------------------------------------------------ media quota --

alter table carguy.profiles add column if not exists media_quota_bytes bigint not null default 314572800; -- 300 MB

create or replace function carguy.storage_usage_bytes() returns bigint
language sql stable security definer set search_path = '' as $$
  select coalesce(sum((o.metadata->>'size')::bigint), 0)
  from storage.objects o
  where o.bucket_id = 'carguy-media'
    and ((storage.foldername(o.name))[1] = (select auth.uid())::text
      or ((storage.foldername(o.name))[1] = 'v' and exists (
            select 1 from carguy.vehicle_member m
            where m.vehicle_id = (storage.foldername(o.name))[2] and m.user_id = (select auth.uid()) and m.role = 'owner')));
$$;
revoke all on function carguy.storage_usage_bytes() from public;
grant execute on function carguy.storage_usage_bytes() to authenticated;


-- rollback:
-- drop function if exists carguy.storage_usage_bytes();
-- alter table carguy.profiles drop column if exists media_quota_bytes;
-- do $$ declare t text; begin
--   foreach t in array array['vehicle_ownership', 'album_item', 'milestone', 'mod_category', 'mod',
--     'mod_media', 'vehicle_specsheet', 'spec_snapshot', 'torque_spec', 'wishlist_item',
--     'inventory_item', 'wheel_set', 'tire', 'vehicle_dtc_event', 'contact',
--     'fluid_guide_item', 'venue', 'track_event', 'track_session', 'setup_sheet',
--     'consumable_usage', 'vehicle_share']
--   loop
--     execute format('drop policy if exists %I on carguy.%I', t || '_own_select', t);
--     execute format('drop policy if exists %I on carguy.%I', t || '_own_insert', t);
--     execute format('drop policy if exists %I on carguy.%I', t || '_own_update', t);
--     execute format('drop policy if exists %I on carguy.%I', t || '_own_delete', t);
--   end loop;
-- end $$;
-- drop policy if exists vehicle_member_own_select on carguy.vehicle_member;
