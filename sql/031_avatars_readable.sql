-- 031_avatars_readable.sql — other people's avatars in the member and admin lists (docs/NEXT.md, from 2.4).
--
-- 2.4.0 draws the signed-in person's own avatar everywhere, but the profiles policies (sql/013, 025) let a
-- person read only their own row, so Garaje → Miembros and Admin → Usuarios fall back to initials for
-- everyone else. Two read paths, both SECURITY DEFINER and both narrow:
--
--   · carguy.member_avatars(vehicle) — display_name + avatar_id of that car's live members, only for a
--     caller who is a member of the car (is_member, viewer and up). Never the photo path: a custom photo
--     stays private (carguy-media/<uid>/avatar.jpg is owner-only); others see the drawing or initials.
--   · carguy.admin_users() — the same two columns added to sql/024's list (admins only, as before). The
--     return type changes, so the function is dropped and re-created; the grants are restated.
--
-- Re-runnable. Apply: node tools/apply-sql.mjs sql/031_avatars_readable.sql   (carguy only)

create or replace function carguy.member_avatars(p_vehicle text)
returns table (user_id uuid, display_name text, avatar_id text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not carguy.is_member(p_vehicle, 'viewer') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select m.user_id, coalesce(nullif(p.display_name, ''), m.display_name), p.avatar_id
      from carguy.vehicle_member m
      left join carguy.profiles p on p.user_id = m.user_id
     where m.vehicle_id = p_vehicle and m.deleted_at is null;
end $$;
revoke all on function carguy.member_avatars(text) from public;
grant execute on function carguy.member_avatars(text) to authenticated;

drop function if exists carguy.admin_users(integer);
create function carguy.admin_users(p_limit integer default 200)
returns table (
  user_id uuid, email text, role text, created_at timestamptz, last_sign_in_at timestamptz,
  vehicles bigint, fuel_logs bigint, trips bigint, last_activity timestamptz,
  display_name text, avatar_id text
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
           greatest(u.last_sign_in_at, (select max(v.updated_at) from carguy.vehicle v where v.user_id = p.user_id)),
           nullif(p.display_name, ''), p.avatar_id
      from carguy.profiles p join auth.users u on u.id = p.user_id
     order by p.created_at desc
     limit least(greatest(coalesce(p_limit, 200), 1), 1000);
end $$;
revoke all on function carguy.admin_users(integer) from public;
grant execute on function carguy.admin_users(integer) to authenticated;

-- rollback: drop function carguy.member_avatars(text); then re-run admin_users from sql/024 (after a drop).
