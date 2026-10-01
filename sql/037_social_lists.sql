-- 037_social_lists.sql — IMP 01102026 Phase 5 (ADR-54…56): what the social screens need beyond 034.
--
--   · profiles.photo_public_jpeg — a small (≈128 px) JPEG data URI the owner writes when "foto pública" is on and
--     clears when off. Others' photos in carguy-media are private, and the private path carries the user id
--     (ADR-54: the app never holds someone else's id); this copy needs no storage policy and no shared change.
--   · get_public_profile / junte_detail re-issued: 'photo' (that copy) instead of 'avatar_path'.
--   · is_handle_free(handle) → 'free' | 'mine' | 'taken' | 'reserved' | 'format'   (signed-in only)
--   · list_follows(kind)     → followers | following | friends | requests_sent, by handle, never an id
--   · admin_reports() / admin_set_report_status(id, status) — Admin → Reportes (admin only)
--
-- carguy only, no --shared. Re-runnable. Apply after 034 and 035.
-- Apply: node tools/apply-sql.mjs sql/037_social_lists.sql

alter table carguy.profiles add column if not exists photo_public_jpeg text;
do $$ begin
  alter table carguy.profiles add constraint profiles_photo_public_jpeg
    check (photo_public_jpeg is null or (char_length(photo_public_jpeg) <= 60000 and photo_public_jpeg like 'data:image/jpeg;base64,%'));
exception when duplicate_object then null; end $$;

create or replace function carguy.get_public_profile(p_handle text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  p carguy.profiles%rowtype;
  can_see boolean;
  out jsonb;
begin
  select * into p from carguy.profiles where handle = lower(trim(p_handle)) and deletion_requested_at is null;
  if not found or carguy.social_blocked(me, p.user_id) then return null; end if;
  -- coalesce: for anon `me` is null, and `p.user_id = me` would make can_see NULL — then `if not can_see` would not
  -- stop, and a private account's bio and cars would leak (local-rls 34g caught it).
  can_see := coalesce(p.is_public or p.user_id = me or carguy.social_follows(me, p.user_id), false);
  out := jsonb_build_object(
    'handle', p.handle,
    'display_name', p.display_name,
    'avatar_id', p.avatar_id,
    -- 037: the small public copy, never the private bucket path (it carries the user id).
    'photo', case when p.photo_public then p.photo_public_jpeg end,
    'is_public', p.is_public,
    'is_me', coalesce(p.user_id = me, false),
    'premium', p.role = 'premium',
    'followers', (select count(*) from carguy.follow f where f.followee_id = p.user_id and f.status = 'accepted'),
    'following', (select count(*) from carguy.follow f where f.follower_id = p.user_id and f.status = 'accepted'),
    'my_follow', (select f.status from carguy.follow f where f.follower_id = me and f.followee_id = p.user_id),
    'follows_me', carguy.social_follows(p.user_id, me),
    'can_see', can_see);
  if not can_see then return out; end if;
  out := out || jsonb_build_object('bio', p.bio, 'instagram', p.instagram);
  if p.show_cars then
    out := out || jsonb_build_object('cars', coalesce((
      select jsonb_agg(jsonb_build_object(
               'name', v.name, 'nickname', v.nickname, 'make', v.make, 'model', v.model, 'year', v.year,
               'status', v.status,
               -- only a page the owner made public (not an unlisted link)
               'slug', (select s.slug from carguy.vehicle_share s
                         where s.vehicle_id = v.id and s.user_id = v.user_id and s.visibility = 'public'
                           and s.revoked_at is null and s.deleted_at is null and s.published_at is not null limit 1))
             order by v.sort_order nulls last, v.created_at)
        from carguy.vehicle v
       where v.user_id = p.user_id and v.deleted_at is null and coalesce(v.is_archived, false) = false), '[]'::jsonb));
  end if;
  if p.show_stats then
    out := out || jsonb_build_object('stats', jsonb_build_object(
      'km_trips', (select round(coalesce(sum(t.distance_m), 0) / 1000.0) from carguy.trip t
                    where t.user_id = p.user_id and t.deleted_at is null and t.status = 'done'),
      'tires_burned', (select count(*) from carguy.tire t where t.user_id = p.user_id and t.deleted_at is null and t.status = 'quemada'),
      'mods', (select count(*) from carguy.mod m where m.user_id = p.user_id and m.deleted_at is null and m.status = 'instalado'),
      'cars', (select count(*) from carguy.vehicle v where v.user_id = p.user_id and v.deleted_at is null)));
  end if;
  return out;
end $$;
revoke all on function carguy.get_public_profile(text) from public;
grant execute on function carguy.get_public_profile(text) to anon, authenticated;

create or replace function carguy.junte_detail(p_junte uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare me uuid := auth.uid(); j carguy.junte%rowtype;
begin
  select * into j from carguy.junte where id = p_junte;
  if not found or not (j.owner_id = me or carguy.junte_is_member(p_junte, me)) then return null; end if;
  return jsonb_build_object(
    'id', j.id, 'title', j.title, 'starts_at', j.starts_at, 'ends_at', j.ends_at,
    'meet', case when j.meet_lat is not null then jsonb_build_object('lat', j.meet_lat, 'lng', j.meet_lng, 'label', j.meet_label) end,
    'visibility', j.visibility, 'status', j.status, 'is_owner', j.owner_id = me,
    'code', case when j.owner_id = me or carguy.junte_is_member(p_junte, me) then j.code end,
    'live_window', carguy.junte_live_window(j),
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
               'handle', p.handle, 'display_name', p.display_name, 'avatar_id', p.avatar_id,
               'photo', case when p.photo_public then p.photo_public_jpeg end,
               'role', m.role, 'status', m.status, 'is_me', m.user_id = me,
               'route', (select jsonb_build_object('polyline', s.polyline_trimmed, 'distance_m', s.distance_m)
                           from carguy.trip_share s where s.id = m.trip_share_id and s.user_id = m.user_id and s.deleted_at is null))
             order by m.role desc, m.joined_at)
        from carguy.junte_member m join carguy.profiles p on p.user_id = m.user_id
       where m.junte_id = p_junte and m.status in ('invited', 'going', 'live')
         and not carguy.social_blocked(me, m.user_id)), '[]'::jsonb),
    'photos', (select count(*) from carguy.junte_photo ph where ph.junte_id = p_junte));
end $$;
revoke all on function carguy.junte_detail(uuid) from public, anon;
grant execute on function carguy.junte_detail(uuid) to authenticated;

create or replace function carguy.is_handle_free(p_handle text) returns text
language plpgsql stable security definer set search_path = '' as $$
declare h text := lower(trim(coalesce(p_handle, ''))); owner uuid;
begin
  if auth.uid() is null or not carguy.is_app_user() then raise exception 'forbidden' using errcode = '42501'; end if;
  if h !~ '^[a-z0-9_]{3,20}$' then return 'format'; end if;
  select p.user_id into owner from carguy.profiles p where p.handle = h;
  if owner = auth.uid() then return 'mine'; end if;
  if owner is not null then return 'taken'; end if;
  if exists (select 1 from carguy.reserved_handles r where r.handle = h) and not carguy.is_admin() then return 'reserved'; end if;
  return 'free';
end $$;

-- People around me, by handle. Blocked pairs never appear. 'requests' (incoming) stays in my_social().
create or replace function carguy.list_follows(p_kind text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  if me is null or not carguy.is_app_user() then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_kind not in ('followers', 'following', 'friends', 'requests_sent') then raise exception 'status' using errcode = '22023'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'handle', p.handle, 'display_name', p.display_name, 'avatar_id', p.avatar_id,
             'photo', case when p.photo_public then p.photo_public_jpeg end,
             'follows_me', carguy.social_follows(x.uid, me), 'i_follow', carguy.social_follows(me, x.uid),
             'since', x.since)
           order by x.since desc)
      from (
        select f.follower_id as uid, coalesce(f.accepted_at, f.created_at) as since from carguy.follow f
         where p_kind = 'followers' and f.followee_id = me and f.status = 'accepted'
        union all
        select f.followee_id, coalesce(f.accepted_at, f.created_at) from carguy.follow f
         where p_kind = 'following' and f.follower_id = me and f.status = 'accepted'
        union all
        select f.followee_id, greatest(coalesce(f.accepted_at, f.created_at), coalesce(g.accepted_at, g.created_at)) from carguy.follow f
          join carguy.follow g on g.follower_id = f.followee_id and g.followee_id = me and g.status = 'accepted'
         where p_kind = 'friends' and f.follower_id = me and f.status = 'accepted'
        union all
        select f.followee_id, f.created_at from carguy.follow f
         where p_kind = 'requests_sent' and f.follower_id = me and f.status = 'requested'
      ) x
      join carguy.profiles p on p.user_id = x.uid
     where p.handle is not null and p.deletion_requested_at is null and not carguy.social_blocked(me, x.uid)), '[]'::jsonb);
end $$;

create or replace function carguy.admin_reports(p_limit integer default 100) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not carguy.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', r.id, 'target_type', r.target_type, 'target_id', r.target_id, 'reason', r.reason, 'status', r.status,
             'created_at', r.created_at, 'reporter', rp.handle, 'reporter_name', rp.display_name)
           order by (r.status = 'new') desc, r.created_at desc)
      from (select * from carguy.report order by created_at desc limit least(greatest(coalesce(p_limit, 100), 1), 500)) r
      left join carguy.profiles rp on rp.user_id = r.reporter_id), '[]'::jsonb);
end $$;

create or replace function carguy.admin_set_report_status(p_id uuid, p_status text) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  if not carguy.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_status not in ('new', 'seen', 'done') then raise exception 'status' using errcode = '22023'; end if;
  update carguy.report set status = p_status where id = p_id;
end $$;

do $$ declare f text; begin
  foreach f in array array['is_handle_free(text)', 'list_follows(text)', 'admin_reports(integer)', 'admin_set_report_status(uuid, text)'] loop
    execute format('revoke all on function carguy.%s from public, anon', f);
    execute format('grant execute on function carguy.%s to authenticated', f);
  end loop;
end $$;

-- rollback:
-- drop function if exists carguy.admin_set_report_status(uuid, text); drop function if exists carguy.admin_reports(integer);
-- drop function if exists carguy.list_follows(text); drop function if exists carguy.is_handle_free(text);
-- (re-run 034 + 035 to restore get_public_profile / junte_detail with 'avatar_path')
-- alter table carguy.profiles drop constraint if exists profiles_photo_public_jpeg, drop column if exists photo_public_jpeg;
