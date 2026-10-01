-- 028_delete_account.sql — "Eliminar cuenta" (IMP 30092026 Phase 6, note 15, ADR-47, 02-cloud-v4.md §028).
--
-- carguy.delete_my_account()  — the caller deletes their own Car Guy data:
--   · refuses a session with no carguy.profiles row (a Music Hub / other x-core account: not ours,
--     nothing of it is touched) and an anonymous call;
--   · deletes every row the caller created in every carguy table (user_id = caller), children before
--     parents (the cloud mirrors no foreign keys between carguy tables — 002 — so the order is for the
--     reader and for any FK a later file adds), plus the invites they made and their feedback;
--   · ends other people's memberships in the cars the caller owned (deleted_at, so their phones learn
--     the car is gone, exactly as a removal does — 013); their own rows stay theirs;
--   · Storage: a SQL function cannot delete objects (storage.protect_delete), so it LISTS them —
--     carguy-media <uid>/… and v/<vehicle_id>/… of the cars they owned, every object their media rows
--     point at, the avatar; carguy-public <slug>/… of their shares; carguy-feedback screenshots of
--     their feedback — and keeps that list on the profile (deletion_objects) until the auth user is
--     gone. api/eliminar-cuenta.ts removes those objects with the service role, then the auth user,
--     whose deletion cascades the profile row (002) away;
--   · marks carguy.profiles.deletion_requested_at and clears display name and avatar.
--   Re-callable: a second call deletes nothing new and returns the same object list (merged).
--
-- carguy.admin_pending_deletions()  — the admin panel's "Cuentas por eliminar": profiles that asked
--   and whose auth user is still there (the function was not configured, or failed). is_admin() only.
--
-- Everything is inside carguy; storage.objects and auth.users are only READ (no --shared).
-- Re-running the file is safe.
-- Apply: node tools/apply-sql.mjs sql/028_delete_account.sql

alter table carguy.profiles add column if not exists deletion_requested_at timestamptz;
-- [{ "bucket": "carguy-media", "name": "<uid>/m1.jpg" }, …] — what api/eliminar-cuenta.ts still has to remove.
alter table carguy.profiles add column if not exists deletion_objects jsonb;

create or replace function carguy.delete_my_account() returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  owned text[];
  slugs text[];
  found_objects jsonb;
  kept jsonb;
  all_objects jsonb;
  deleted jsonb := '{}'::jsonb;
  n bigint;
  t text;
  requested timestamptz;
  -- Children first, the vehicle last. Every other table with a user_id column is swept after these.
  ordered text[] := array[
    'setup_sheet', 'track_session', 'consumable_usage', 'track_event',
    'inspection_result', 'inspection',
    'part', 'service_record_item', 'service_record',
    'mod_media', 'mod', 'mod_category',
    'album_item', 'media',
    'fuel_log', 'odometer_reading', 'expense', 'reminder', 'task', 'document',
    'milestone', 'vehicle_fact', 'vehicle_dtc_event', 'tire', 'wheel_set',
    'torque_spec', 'fluid_guide_item', 'spec_snapshot', 'vehicle_specsheet', 'vehicle_spec',
    'wishlist_item', 'inventory_item', 'vehicle_ownership', 'vehicle_share',
    'trip', 'fuel_price', 'legal_acceptance', 'setting',
    'service_type', 'inspection_item', 'inspection_template', 'venue', 'contact'];
begin
  if me is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  -- Only a Car Guy account (sql/018's marker). Another app's account is refused before anything runs.
  select p.deletion_requested_at, p.deletion_objects into requested, kept
    from carguy.profiles p where p.user_id = me;
  if not found then
    raise exception 'not_carguy' using errcode = '42501';
  end if;

  select coalesce(array_agg(v.id), '{}') into owned from carguy.vehicle v where v.user_id = me;
  select coalesce(array_agg(s.slug), '{}') into slugs from carguy.vehicle_share s
   where s.slug is not null and (s.user_id = me or s.vehicle_id = any(owned));

  -- The objects, listed before the rows that point at them are gone.
  select coalesce(jsonb_agg(jsonb_build_object('bucket', o.bucket_id, 'name', o.name) order by o.bucket_id, o.name), '[]'::jsonb)
    into found_objects
    from storage.objects o
   where (o.bucket_id = 'carguy-media' and (
            split_part(o.name, '/', 1) = me::text
            or o.owner = me
            or (split_part(o.name, '/', 1) = 'v' and split_part(o.name, '/', 2) = any(owned))
            or o.name in (select m.remote_path from carguy.media m where m.user_id = me and m.remote_path is not null)
            or o.name in (select m.remote_thumb_path from carguy.media m where m.user_id = me and m.remote_thumb_path is not null)
            or o.name in (select p.avatar_path from carguy.profiles p where p.user_id = me and p.avatar_path is not null)))
      or (o.bucket_id = 'carguy-public' and split_part(o.name, '/', 1) = any(slugs))
      or (o.bucket_id = 'carguy-feedback'
          and o.name in (select f.screenshot_path from carguy.feedback f where f.user_id = me and f.screenshot_path is not null));

  -- Merged with what an earlier call listed (its rows are gone, its objects may still be there).
  select coalesce(jsonb_agg(distinct x), '[]'::jsonb) into all_objects
    from (select jsonb_array_elements(coalesce(kept, '[]'::jsonb)) as x
          union select jsonb_array_elements(found_objects)) s;

  -- The rows ------------------------------------------------------------------
  foreach t in array ordered loop
    if exists (select 1 from information_schema.columns c
                where c.table_schema = 'carguy' and c.table_name = t and c.column_name = 'user_id') then
      execute format('delete from carguy.%I where user_id = $1', t) using me;
      get diagnostics n = row_count;
      if n > 0 then deleted := deleted || jsonb_build_object(t, n); end if;
    end if;
  end loop;

  -- Any other carguy table with a user_id column (one a later file adds), except the ones handled below.
  for t in
    select c.table_name from information_schema.columns c
      join information_schema.tables tb on tb.table_schema = c.table_schema and tb.table_name = c.table_name
     where c.table_schema = 'carguy' and c.column_name = 'user_id' and tb.table_type = 'BASE TABLE'
       and c.table_name not in ('profiles', 'vehicle', 'vehicle_member', 'feedback')
       and c.table_name <> all(ordered)
     order by c.table_name
  loop
    execute format('delete from carguy.%I where user_id = $1', t) using me;
    get diagnostics n = row_count;
    if n > 0 then deleted := deleted || jsonb_build_object(t, n); end if;
  end loop;

  delete from carguy.vehicle_invite i where i.created_by = me or i.vehicle_id = any(owned);
  get diagnostics n = row_count;
  if n > 0 then deleted := deleted || jsonb_build_object('vehicle_invite', n); end if;

  -- Other members of the cars I owned: their membership ends (their rows stay theirs).
  update carguy.vehicle_member m set deleted_at = now(), updated_at = now()
   where m.vehicle_id = any(owned) and m.user_id <> me and m.deleted_at is null;
  delete from carguy.vehicle_member m where m.user_id = me;
  get diagnostics n = row_count;
  if n > 0 then deleted := deleted || jsonb_build_object('vehicle_member', n); end if;

  delete from carguy.feedback f where f.user_id = me;
  get diagnostics n = row_count;
  if n > 0 then deleted := deleted || jsonb_build_object('feedback', n); end if;

  delete from carguy.vehicle v where v.user_id = me;
  get diagnostics n = row_count;
  if n > 0 then deleted := deleted || jsonb_build_object('vehicle', n); end if;

  -- The profile stays (it is the Car Guy marker the function checks, and the admin list's row) until
  -- the auth user is deleted; what identified the person goes now.
  requested := coalesce(requested, now());
  update carguy.profiles p
     set deletion_requested_at = requested, deletion_objects = all_objects,
         display_name = null, avatar_id = null, avatar_path = null, updated_at = now()
   where p.user_id = me;

  return jsonb_build_object('user_id', me, 'requested_at', requested, 'deleted', deleted, 'objects', all_objects);
end $$;
revoke all on function carguy.delete_my_account() from public, anon;
grant execute on function carguy.delete_my_account() to authenticated;

-- The admin panel: accounts that asked to be deleted and still have a login.
create or replace function carguy.admin_pending_deletions()
returns table (user_id uuid, email text, requested_at timestamptz, objects integer, last_sign_in_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not carguy.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select p.user_id, u.email::text, p.deletion_requested_at,
           coalesce(jsonb_array_length(p.deletion_objects), 0)::integer, u.last_sign_in_at
      from carguy.profiles p join auth.users u on u.id = p.user_id
     where p.deletion_requested_at is not null
     order by p.deletion_requested_at;
end $$;
revoke all on function carguy.admin_pending_deletions() from public, anon;
grant execute on function carguy.admin_pending_deletions() to authenticated;

-- rollback:
-- drop function if exists carguy.admin_pending_deletions();
-- drop function if exists carguy.delete_my_account();
-- alter table carguy.profiles drop column if exists deletion_objects, drop column if exists deletion_requested_at;
-- (Rows already deleted by a call are not restored by a rollback — a deletion is final by design.)
