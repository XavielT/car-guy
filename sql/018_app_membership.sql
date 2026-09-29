-- 018 — Car Guy accounts are Car Guy's own (2.1.3, Xaviel 2026-09-29).
--
-- x-core has ONE auth.users for every app on it (Music Hub, xaviel-web, Car
-- Guy). Until now any x-core account could sign in to Car Guy with its Music
-- Hub email and password. Xaviel's rule: an account made in one app must not
-- open another, even though they share the backend.
--
-- The marker already exists and is not user-controlled: `carguy.profiles` gets
-- a row only from `carguy.handle_new_user()` (sql/002), the AFTER INSERT
-- trigger on auth.users that fires for signups carrying
-- `raw_user_meta_data.app = 'carguy'` — i.e. signups made from Car Guy. A
-- Music Hub signup never gets one. So "is a Car Guy account" = "has a
-- carguy.profiles row", and this file:
--
--   1. closes the one way a user could create that row themselves: 003's
--      `profiles_own_insert` policy (the app never inserts profiles; only the
--      trigger does, as security definer);
--   2. adds carguy.is_app_user(), callable by the client right after sign-in;
--   3. adds a RESTRICTIVE policy to every carguy table and to the two Car Guy
--      buckets, so a non-Car Guy session reads and writes nothing even if a
--      client skipped the check;
--   4. makes redeem_invite refuse a non-Car Guy session (security definer
--      functions bypass RLS, and this is the one that inserts on the caller's
--      behalf).
--
-- Nothing here touches auth.*, public.* or Music Hub's buckets: the storage
-- policy passes every row whose bucket is not carguy-media / carguy-public.
-- Re-running the file is safe.

create or replace function carguy.is_app_user() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from carguy.profiles p where p.user_id = (select auth.uid()))
$$;
revoke all on function carguy.is_app_user() from public;
grant execute on function carguy.is_app_user() to authenticated;

-- 1 — profiles are created by the signup trigger only.
drop policy if exists profiles_own_insert on carguy.profiles;
revoke insert on carguy.profiles from authenticated, anon;

-- 3 — every table with RLS in the schema, present and future-proofed by name.
-- `(select …)` makes Postgres evaluate the check once per statement, not per row.
do $$
declare t text;
begin
  for t in
    select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'carguy' and c.relkind = 'r' and c.relrowsecurity
  loop
    execute format('drop policy if exists carguy_app_only on carguy.%I', t);
    execute format(
      'create policy carguy_app_only on carguy.%I as restrictive for all to authenticated '
      'using ((select carguy.is_app_user())) with check ((select carguy.is_app_user()))', t);
  end loop;
end $$;

drop policy if exists "carguy_app_only" on storage.objects;
create policy "carguy_app_only" on storage.objects as restrictive for all to authenticated
  using (bucket_id not in ('carguy-media', 'carguy-public') or (select carguy.is_app_user()))
  with check (bucket_id not in ('carguy-media', 'carguy-public') or (select carguy.is_app_user()));

-- 4 — redeem_invite as in 013, plus the membership guard on the second line.
create or replace function carguy.redeem_invite(p_code text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare inv carguy.vehicle_invite%rowtype; me uuid := (select auth.uid()); my_email text;
begin
  if me is null then raise exception 'sign in first' using errcode = '42501'; end if;
  if not carguy.is_app_user() then raise exception 'not a Car Guy account' using errcode = '42501'; end if;
  select * into inv from carguy.vehicle_invite where code = lower(trim(p_code)) for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  if inv.used_at is not null then return jsonb_build_object('ok', false, 'reason', 'used'); end if;
  if inv.expires_at < now() then return jsonb_build_object('ok', false, 'reason', 'expired'); end if;
  select lower(u.email) into my_email from auth.users u where u.id = me;
  if inv.email is not null and inv.email <> coalesce(my_email, '') then return jsonb_build_object('ok', false, 'reason', 'email'); end if;
  if carguy.vehicle_role(inv.vehicle_id) = 'owner' then return jsonb_build_object('ok', false, 'reason', 'owner'); end if;

  insert into carguy.vehicle_member (vehicle_id, user_id, role, display_name)
  values (inv.vehicle_id, me, inv.role, my_email)
  on conflict (vehicle_id, user_id) do update set role = excluded.role, deleted_at = null, updated_at = now(), display_name = excluded.display_name;
  update carguy.vehicle_invite set used_by = me, used_at = now() where code = inv.code;
  return jsonb_build_object('ok', true, 'vehicle_id', inv.vehicle_id, 'role', inv.role);
end $$;

-- rollback:
-- do $$ declare t text; begin
--   for t in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
--             where n.nspname = 'carguy' and c.relkind = 'r'
--   loop execute format('drop policy if exists carguy_app_only on carguy.%I', t); end loop; end $$;
-- drop policy if exists "carguy_app_only" on storage.objects;
-- grant insert on carguy.profiles to authenticated;
-- create policy profiles_own_insert on carguy.profiles for insert to authenticated with check (user_id = auth.uid());
-- then re-run redeem_invite from sql/013 and: drop function if exists carguy.is_app_user();
