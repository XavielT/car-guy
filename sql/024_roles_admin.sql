-- 024_roles_admin.sql — roles (admin · member · premium) and the admin panel's data (2.3).
--
-- carguy.profiles.role: 'member' for everyone by default; 'premium' exists but unlocks nothing yet
-- (no payments — Xaviel, 2026-09-30); 'admin' is Xaviel's Car Guy account. A role changes only
-- through carguy.admin_set_role() — a trigger keeps it as it was on any other update, so nobody
-- can promote themselves with a plain profile update.
--
-- carguy.is_admin() replaces 021's hard-coded admin email in the feedback policies (and in the
-- storage policy: 024_roles_admin_storage.shared.sql). The admin panel reads only through
-- security-definer functions that refuse anyone who is not admin: counts per user, never the
-- contents of anyone's garage.
--
-- Everything in carguy; the storage half is its own --shared file.
-- Apply: node tools/apply-sql.mjs sql/024_roles_admin.sql
--        node tools/apply-sql.mjs sql/024_roles_admin_storage.shared.sql --shared

alter table carguy.profiles add column if not exists role text not null default 'member';
alter table carguy.profiles drop constraint if exists profiles_role_check;
alter table carguy.profiles add constraint profiles_role_check check (role in ('admin', 'member', 'premium'));

-- A role is not the user's to change.
create or replace function carguy.protect_role() returns trigger
language plpgsql set search_path = '' as $$
begin
  if coalesce(auth.role(), '') = 'service_role' or current_user in ('postgres', 'supabase_admin') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.role := 'member';
  else
    new.role := old.role;
  end if;
  return new;
end $$;

drop trigger if exists protect_role on carguy.profiles;
create trigger protect_role before insert or update on carguy.profiles
  for each row execute function carguy.protect_role();

create or replace function carguy.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from carguy.profiles p where p.user_id = (select auth.uid()) and p.role = 'admin')
$$;
revoke all on function carguy.is_admin() from public;
grant execute on function carguy.is_admin() to authenticated;

-- Xaviel's Car Guy account (the one he signed up with in Car Guy).
update carguy.profiles set role = 'admin'
 where user_id = (select u.id from auth.users u where lower(u.email) = 'xavieljoseterrerocuevas9@gmail.com');

-- Feedback: the admin is a role now, not an email (021).
drop policy if exists feedback_select_own on carguy.feedback;
create policy feedback_select_own on carguy.feedback for select to authenticated
  using (user_id = (select auth.uid()) or (select carguy.is_admin()));
drop policy if exists feedback_update_admin on carguy.feedback;
create policy feedback_update_admin on carguy.feedback for update to authenticated
  using ((select carguy.is_admin()))
  with check ((select carguy.is_admin()));

-- The admin panel ------------------------------------------------------------

create or replace function carguy.admin_stats() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not carguy.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'users', (select count(*) from carguy.profiles),
    'users_new_7d', (select count(*) from carguy.profiles where created_at > now() - interval '7 days'),
    'users_new_30d', (select count(*) from carguy.profiles where created_at > now() - interval '30 days'),
    'users_active_7d', (select count(*) from carguy.profiles p join auth.users u on u.id = p.user_id
                         where u.last_sign_in_at > now() - interval '7 days'),
    'roles', (select coalesce(jsonb_object_agg(role, n), '{}'::jsonb)
                from (select role, count(*) as n from carguy.profiles group by role) r),
    'vehicles', (select count(*) from carguy.vehicle where deleted_at is null),
    'fuel_logs', (select count(*) from carguy.fuel_log where deleted_at is null),
    'fuel_logs_30d', (select count(*) from carguy.fuel_log where deleted_at is null and created_at > now() - interval '30 days'),
    'trips', (select count(*) from carguy.trip where deleted_at is null and status = 'done'),
    'trip_km', (select coalesce(round(sum(distance_m) / 1000), 0) from carguy.trip where deleted_at is null and status = 'done'),
    'shares_published', (select count(*) from carguy.vehicle_share
                          where deleted_at is null and revoked_at is null and published_at is not null and slug is not null),
    'feedback_new', (select count(*) from carguy.feedback where status = 'new'),
    'feedback_total', (select count(*) from carguy.feedback),
    'at', now()
  );
end $$;
revoke all on function carguy.admin_stats() from public;
grant execute on function carguy.admin_stats() to authenticated;

create or replace function carguy.admin_users(p_limit integer default 200)
returns table (
  user_id uuid, email text, role text, created_at timestamptz, last_sign_in_at timestamptz,
  vehicles bigint, fuel_logs bigint, trips bigint, last_activity timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not carguy.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select p.user_id, u.email::text, p.role, p.created_at, u.last_sign_in_at,
           (select count(*) from carguy.vehicle v where v.user_id = p.user_id and v.deleted_at is null),
           (select count(*) from carguy.fuel_log f where f.user_id = p.user_id and f.deleted_at is null),
           (select count(*) from carguy.trip t where t.user_id = p.user_id and t.deleted_at is null and t.status = 'done'),
           greatest(u.last_sign_in_at, (select max(v.updated_at) from carguy.vehicle v where v.user_id = p.user_id))
      from carguy.profiles p join auth.users u on u.id = p.user_id
     order by p.created_at desc
     limit least(greatest(coalesce(p_limit, 200), 1), 1000);
end $$;
revoke all on function carguy.admin_users(integer) from public;
grant execute on function carguy.admin_users(integer) to authenticated;

create or replace function carguy.admin_set_role(p_user uuid, p_role text) returns text
language plpgsql volatile security definer set search_path = '' as $$
begin
  if not carguy.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_role not in ('admin', 'member', 'premium') then
    raise exception 'role' using errcode = '22023';
  end if;
  -- The panel must never lock its only way in: an admin does not demote themselves here.
  if p_user = (select auth.uid()) and p_role <> 'admin' then
    raise exception 'self_demote' using errcode = 'P0001';
  end if;
  update carguy.profiles set role = p_role, updated_at = now() where user_id = p_user;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  return p_role;
end $$;
revoke all on function carguy.admin_set_role(uuid, text) from public;
grant execute on function carguy.admin_set_role(uuid, text) to authenticated;

-- rollback:
-- drop function if exists carguy.admin_set_role(uuid, text), carguy.admin_users(integer), carguy.admin_stats();
-- re-run 021's two feedback policies (email predicate); drop function if exists carguy.is_admin();
-- drop trigger if exists protect_role on carguy.profiles; drop function if exists carguy.protect_role();
-- alter table carguy.profiles drop constraint if exists profiles_role_check, drop column if exists role;
