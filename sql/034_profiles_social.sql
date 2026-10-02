-- 034_profiles_social.sql — IMP 01102026 Phase 2: public profiles, follows, blocks, reports, shared trips, privacy
-- zones (02-specs/01-data-model-v10.md §2; ADR-54 … 56).
--
-- Rules this file keeps:
--   · Other people's profile data is reachable ONLY through the security-definer functions below, each with a fixed,
--     safe column list (ADR-54). `profiles` RLS stays own-row; nothing here widens it.
--   · The social graph is written ONLY through RPCs keyed by @handle (follow_user, accept_follow, block_user…), so a
--     client never needs — and never sees — another person's user id. No direct insert/update/delete grants.
--   · Trips are never public by default: a trip_share is a separate, trimmed object its owner creates (ADR-56);
--     others read shares only through list_trip_shares(handle), gated by visibility and blocks.
--   · No extension and no new schema: the handle format is lowercase by its CHECK (no citext), search folds accents
--     with translate() (no unaccent/pg_trgm — ~30 users), and the helpers live in `carguy` with client EXECUTE
--     revoked (only the definer RPCs call them). So this file is carguy-only: no --shared.
--
-- Re-runnable. Apply: node tools/apply-sql.mjs sql/034_profiles_social.sql

-- ------------------------------------------------------------ profiles ----
alter table carguy.profiles add column if not exists handle text;
alter table carguy.profiles add column if not exists bio text;
alter table carguy.profiles add column if not exists instagram text;
alter table carguy.profiles add column if not exists is_public boolean not null default true;
alter table carguy.profiles add column if not exists photo_public boolean not null default false;
alter table carguy.profiles add column if not exists show_cars boolean not null default true;
alter table carguy.profiles add column if not exists show_stats boolean not null default false;
alter table carguy.profiles add column if not exists show_fichas boolean not null default false;
alter table carguy.profiles add column if not exists handle_changed_at timestamptz;
do $$ begin
  alter table carguy.profiles add constraint profiles_handle_format check (handle is null or handle ~ '^[a-z0-9_]{3,20}$');
exception when duplicate_object then null; end $$;
do $$ begin
  alter table carguy.profiles add constraint profiles_bio_len check (bio is null or char_length(bio) <= 160);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table carguy.profiles add constraint profiles_instagram_format check (instagram is null or instagram ~ '^[A-Za-z0-9._]{1,30}$');
exception when duplicate_object then null; end $$;
create unique index if not exists profiles_handle_uq on carguy.profiles (handle) where handle is not null;

create table if not exists carguy.reserved_handles (handle text primary key);
insert into carguy.reserved_handles (handle) values
  ('admin'), ('administrator'), ('root'), ('support'), ('soporte'), ('help'), ('ayuda'), ('carguy'), ('car_guy'),
  ('official'), ('oficial'), ('staff'), ('moderator'), ('moderador'), ('api'), ('app'), ('www'), ('login'),
  ('signup'), ('settings'), ('ajustes'), ('terms'), ('terminos'), ('privacy'), ('privacidad'), ('null'),
  ('undefined'), ('juntes'), ('junte'), ('xaviel'), ('xavieldev'), ('perfil'), ('cuenta'), ('instalar')
on conflict do nothing;
alter table carguy.reserved_handles enable row level security;   -- no policies: read by the trigger only
revoke all on carguy.reserved_handles from anon, authenticated;

-- A handle: reserved words only for the admin, one change per 30 days, empty string → null.
create or replace function carguy.profiles_handle_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.handle = '' then new.handle := null; end if;
  if tg_op = 'UPDATE' and new.handle is not distinct from old.handle then return new; end if;
  if new.handle is not null then
    if exists (select 1 from carguy.reserved_handles r where r.handle = new.handle) and not carguy.is_admin()
       and coalesce(auth.role(), '') <> 'service_role' then
      raise exception 'handle_reserved' using errcode = 'P0001';
    end if;
    if tg_op = 'UPDATE' and old.handle is not null and old.handle_changed_at > now() - interval '30 days'
       and coalesce(auth.role(), '') <> 'service_role' then
      raise exception 'handle_cooldown' using errcode = 'P0001';
    end if;
  end if;
  new.handle_changed_at := now();
  return new;
end $$;
drop trigger if exists profiles_handle_guard on carguy.profiles;
create trigger profiles_handle_guard before insert or update of handle on carguy.profiles
  for each row execute function carguy.profiles_handle_guard();

-- ------------------------------------------------- follow · block · report ----
create table if not exists carguy.follow (
  follower_id uuid not null references auth.users(id) on delete cascade,
  followee_id uuid not null references auth.users(id) on delete cascade,
  status      text not null default 'accepted' check (status in ('accepted', 'requested')),
  created_at  timestamptz not null default now(),
  accepted_at timestamptz,
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);
create index if not exists follow_followee_idx on carguy.follow (followee_id, status);

create table if not exists carguy.block (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index if not exists block_blocked_idx on carguy.block (blocked_id);

create table if not exists carguy.report (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  target_type text not null check (target_type in ('profile', 'trip_share', 'junte', 'junte_message')),
  target_id   text not null check (char_length(target_id) <= 80),
  reason      text not null default '' check (char_length(reason) <= 500),
  status      text not null default 'new' check (status in ('new', 'seen', 'done')),
  created_at  timestamptz not null default now()
);

-- RLS: you see the follows you are part of, your own blocks, your own reports (the admin sees reports).
-- Writes only through the RPCs below: no insert/update/delete grants.
alter table carguy.follow enable row level security;
alter table carguy.block enable row level security;
alter table carguy.report enable row level security;
drop policy if exists follow_party on carguy.follow;
create policy follow_party on carguy.follow for select to authenticated
  using (follower_id = (select auth.uid()) or followee_id = (select auth.uid()));
drop policy if exists block_own on carguy.block;
create policy block_own on carguy.block for select to authenticated using (blocker_id = (select auth.uid()));
drop policy if exists report_own on carguy.report;
create policy report_own on carguy.report for select to authenticated
  using (reporter_id = (select auth.uid()) or (select carguy.is_admin()));
do $$ declare t text; begin
  foreach t in array array['follow', 'block', 'report'] loop
    execute format('drop policy if exists carguy_app_only on carguy.%I', t);
    execute format('create policy carguy_app_only on carguy.%I as restrictive for all to authenticated '
                   'using ((select carguy.is_app_user())) with check ((select carguy.is_app_user()))', t);
    execute format('revoke all on carguy.%I from anon, authenticated', t);
    execute format('grant select on carguy.%I to authenticated', t);
  end loop;
end $$;

-- ------------------------------------------------------------- helpers ----
-- Internal (definer, client EXECUTE revoked): only the RPCs below call them.
create or replace function carguy.social_blocked(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select a is not null and b is not null and exists (
    select 1 from carguy.block where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a));
$$;
create or replace function carguy.social_follows(follower uuid, followee uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select follower is not null and exists (
    select 1 from carguy.follow f where f.follower_id = follower and f.followee_id = followee and f.status = 'accepted');
$$;
create or replace function carguy.social_friends(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select carguy.social_follows(a, b) and carguy.social_follows(b, a);
$$;
-- The profile behind a handle (only Car Guy accounts have a profiles row — sql/018).
create or replace function carguy.social_uid(p_handle text) returns uuid
language sql stable security definer set search_path = '' as $$
  select p.user_id from carguy.profiles p where p.handle = lower(trim(p_handle)) and p.deletion_requested_at is null;
$$;
revoke all on function carguy.social_blocked(uuid, uuid) from public, anon, authenticated;
revoke all on function carguy.social_follows(uuid, uuid) from public, anon, authenticated;
revoke all on function carguy.social_friends(uuid, uuid) from public, anon, authenticated;
revoke all on function carguy.social_uid(text) from public, anon, authenticated;

-- ---------------------------------------------------------------- RPCs ----
-- A public profile by @handle (ADR-54, ADR-56). anon may call it (the /u/<handle> page): `me` is null then, so
-- only a public account shows more than its card. Never: plate, VIN, costs, fuel, maintenance, documents, raw
-- trips, members, a speed, a position. The photo only with photo_public; the drawn avatar always.
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
    'avatar_path', case when p.photo_public then p.avatar_path end,
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

-- Search by handle or name, accent-folded (translate: enough for Spanish at this size). Signed-in only.
create or replace function carguy.search_profiles(q text, lim integer default 20)
returns table (handle text, display_name text, avatar_id text, is_public boolean, my_follow text)
language sql stable security definer set search_path = '' as $$
  with me as (select auth.uid() as uid),
       qq as (select translate(lower(trim(q)), 'áéíóúüñ', 'aeiouun') as t)
  select p.handle, p.display_name, p.avatar_id, p.is_public,
         (select f.status from carguy.follow f, me where f.follower_id = me.uid and f.followee_id = p.user_id)
    from carguy.profiles p, me, qq
   where char_length(qq.t) >= 2 and p.handle is not null and p.deletion_requested_at is null
     and p.user_id <> me.uid and not carguy.social_blocked(me.uid, p.user_id)
     and (p.handle like qq.t || '%'
          or translate(lower(coalesce(p.display_name, '')), 'áéíóúüñ', 'aeiouun') like '%' || qq.t || '%')
   order by (p.handle = qq.t) desc, (p.handle like qq.t || '%') desc, p.handle
   limit least(greatest(coalesce(lim, 20), 1), 50);
$$;
revoke all on function carguy.search_profiles(text, integer) from public, anon;
grant execute on function carguy.search_profiles(text, integer) to authenticated;

-- Follow: accepted at once for a public account, a request for a private one. 100 new follows per 24 h.
create or replace function carguy.follow_user(p_handle text) returns text
language plpgsql volatile security definer set search_path = '' as $$
declare me uuid := auth.uid(); target uuid := carguy.social_uid(p_handle); pub boolean; st text;
begin
  if me is null or not carguy.is_app_user() then raise exception 'forbidden' using errcode = '42501'; end if;
  if target is null or target = me then raise exception 'not_found' using errcode = 'P0002'; end if;
  if carguy.social_blocked(me, target) then raise exception 'blocked' using errcode = 'P0001'; end if;
  select f.status into st from carguy.follow f where f.follower_id = me and f.followee_id = target;
  if st is not null then return st; end if;
  if (select count(*) from carguy.follow f where f.follower_id = me and f.created_at > now() - interval '24 hours') >= 100 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  select p.is_public into pub from carguy.profiles p where p.user_id = target;
  st := case when pub then 'accepted' else 'requested' end;
  insert into carguy.follow (follower_id, followee_id, status, accepted_at)
  values (me, target, st, case when pub then now() end);
  return st;
end $$;

create or replace function carguy.unfollow_user(p_handle text) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  delete from carguy.follow where follower_id = auth.uid() and followee_id = carguy.social_uid(p_handle);
end $$;

-- The followee accepts a request, or removes / declines a follower.
create or replace function carguy.accept_follow(p_handle text) returns boolean
language plpgsql volatile security definer set search_path = '' as $$
begin
  update carguy.follow set status = 'accepted', accepted_at = now()
   where follower_id = carguy.social_uid(p_handle) and followee_id = auth.uid() and status = 'requested';
  return found;
end $$;
create or replace function carguy.remove_follower(p_handle text) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  delete from carguy.follow where follower_id = carguy.social_uid(p_handle) and followee_id = auth.uid();
end $$;

-- Block: removes follows both ways and hides both profiles from each other (get_public_profile, search).
-- 035 extends this to the juntes the blocker owns.
create or replace function carguy.block_user(p_handle text) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare me uuid := auth.uid(); target uuid := carguy.social_uid(p_handle);
begin
  if me is null or not carguy.is_app_user() then raise exception 'forbidden' using errcode = '42501'; end if;
  if target is null or target = me then raise exception 'not_found' using errcode = 'P0002'; end if;
  insert into carguy.block (blocker_id, blocked_id) values (me, target) on conflict do nothing;
  delete from carguy.follow where (follower_id = me and followee_id = target) or (follower_id = target and followee_id = me);
end $$;
create or replace function carguy.unblock_user(p_handle text) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  delete from carguy.block where blocker_id = auth.uid() and blocked_id = carguy.social_uid(p_handle);
end $$;

-- My counts + who asked to follow me + whom I blocked, by handle only.
create or replace function carguy.my_social() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'followers', (select count(*) from carguy.follow f where f.followee_id = auth.uid() and f.status = 'accepted'),
    'following', (select count(*) from carguy.follow f where f.follower_id = auth.uid() and f.status = 'accepted'),
    'friends', (select count(*) from carguy.follow f join carguy.follow g on g.follower_id = f.followee_id and g.followee_id = f.follower_id
                 where f.follower_id = auth.uid() and f.status = 'accepted' and g.status = 'accepted'),
    'requests', coalesce((select jsonb_agg(jsonb_build_object('handle', p.handle, 'display_name', p.display_name, 'avatar_id', p.avatar_id) order by f.created_at desc)
                  from carguy.follow f join carguy.profiles p on p.user_id = f.follower_id
                 where f.followee_id = auth.uid() and f.status = 'requested'), '[]'::jsonb),
    'blocked', coalesce((select jsonb_agg(p.handle order by b.created_at desc) from carguy.block b
                  join carguy.profiles p on p.user_id = b.blocked_id where b.blocker_id = auth.uid() and p.handle is not null), '[]'::jsonb));
$$;

-- A report: 10 per hour per account (the feedback RPC's pattern, sql/021).
create or replace function carguy.report_target(p_type text, p_target text, p_reason text default '') returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare me uuid := auth.uid(); new_id uuid;
begin
  if me is null or not carguy.is_app_user() then raise exception 'forbidden' using errcode = '42501'; end if;
  if (select count(*) from carguy.report r where r.reporter_id = me and r.created_at > now() - interval '1 hour') >= 10 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  insert into carguy.report (reporter_id, target_type, target_id, reason)
  values (me, p_type, left(coalesce(p_target, ''), 80), left(coalesce(p_reason, ''), 500))
  returning id into new_id;
  return new_id;
end $$;

do $$ declare f text; begin
  foreach f in array array['follow_user(text)', 'unfollow_user(text)', 'accept_follow(text)', 'remove_follower(text)',
                           'block_user(text)', 'unblock_user(text)', 'my_social()', 'report_target(text, text, text)'] loop
    execute format('revoke all on function carguy.%s from public, anon', f);
    execute format('grant execute on function carguy.%s to authenticated', f);
  end loop;
end $$;

-- ------------------------------------------- trip_share · privacy_zone ----
-- Owned, synced rows (the 010/026 template): the owner's phone pushes and pulls them; RLS is own-row only, so
-- a follower's phone never pulls someone else's share. Others read shares through list_trip_shares(handle).
create table if not exists carguy.trip_share (
  id                text primary key,
  user_id           uuid not null default auth.uid() references auth.users(id) on delete cascade,
  trip_id           text not null,
  visibility        text not null check (visibility in ('followers', 'friends', 'public')),
  polyline_trimmed  text not null,
  distance_m        integer,
  duration_s        integer,
  started_day       date,
  title             text,
  created_at        timestamptz not null,
  updated_at        timestamptz not null,
  deleted_at        timestamptz,
  updated_by        uuid,
  schema_hint       text,
  server_updated_at timestamptz not null default now()
);
create table if not exists carguy.privacy_zone (
  id                text primary key,
  user_id           uuid not null default auth.uid() references auth.users(id) on delete cascade,
  label             text,
  lat               double precision not null,
  lng               double precision not null,
  radius_m          integer not null default 300 check (radius_m between 100 and 5000),
  created_at        timestamptz not null,
  updated_at        timestamptz not null,
  deleted_at        timestamptz,
  updated_by        uuid,
  schema_hint       text,
  server_updated_at timestamptz not null default now()
);
do $$ declare t text; begin
  foreach t in array array['trip_share', 'privacy_zone'] loop
    execute format('alter table carguy.%I enable row level security', t);
    execute format('drop policy if exists %I on carguy.%I', t || '_own_select', t);
    execute format('drop policy if exists %I on carguy.%I', t || '_own_insert', t);
    execute format('drop policy if exists %I on carguy.%I', t || '_own_update', t);
    execute format('drop policy if exists %I on carguy.%I', t || '_own_delete', t);
    execute format('create policy %I on carguy.%I for select to authenticated using (user_id = auth.uid())', t || '_own_select', t);
    execute format('create policy %I on carguy.%I for insert to authenticated with check (user_id = auth.uid())', t || '_own_insert', t);
    execute format('create policy %I on carguy.%I for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t || '_own_update', t);
    execute format('create policy %I on carguy.%I for delete to authenticated using (user_id = auth.uid())', t || '_own_delete', t);
    execute format('drop policy if exists carguy_app_only on carguy.%I', t);
    execute format('create policy carguy_app_only on carguy.%I as restrictive for all to authenticated '
                   'using ((select carguy.is_app_user())) with check ((select carguy.is_app_user()))', t);
    execute format('drop trigger if exists %I on carguy.%I', t || '_before_write', t);
    execute format('create trigger %I before update on carguy.%I for each row execute function carguy.before_write()', t || '_before_write', t);
    execute format('create index if not exists %I on carguy.%I (user_id, server_updated_at)', 'idx_' || t || '_user_cursor', t);
    execute format('grant select, insert, update, delete on carguy.%I to authenticated', t);
    execute format('revoke all on carguy.%I from anon', t);
  end loop;
end $$;

-- The shares a viewer may see on someone's profile: public ones; followers' ones to an accepted follower; friends'
-- ones to a friend; all of them to the owner. Never to a blocked pair; never the raw trip.
create or replace function carguy.list_trip_shares(p_handle text, lim integer default 30) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare me uuid := auth.uid(); owner uuid := carguy.social_uid(p_handle);
begin
  if owner is null or carguy.social_blocked(me, owner) then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', s.id, 'title', s.title, 'visibility', s.visibility,
             'polyline', s.polyline_trimmed, 'distance_m', s.distance_m, 'duration_s', s.duration_s, 'day', s.started_day)
           order by s.started_day desc nulls last, s.created_at desc)
      from (select * from carguy.trip_share s
             where s.user_id = owner and s.deleted_at is null
               and (owner = me
                    or s.visibility = 'public'
                    or (s.visibility = 'followers' and carguy.social_follows(me, owner))
                    or (s.visibility = 'friends' and carguy.social_friends(me, owner)))
             order by s.started_day desc nulls last, s.created_at desc
             limit least(greatest(coalesce(lim, 30), 1), 100)) s), '[]'::jsonb);
end $$;
revoke all on function carguy.list_trip_shares(text, integer) from public;
grant execute on function carguy.list_trip_shares(text, integer) to anon, authenticated;

-- rollback (reverse order):
-- drop function if exists carguy.list_trip_shares(text, integer); drop table if exists carguy.privacy_zone, carguy.trip_share;
-- drop function if exists carguy.report_target(text, text, text), carguy.my_social(), carguy.unblock_user(text),
--   carguy.block_user(text), carguy.remove_follower(text), carguy.accept_follow(text), carguy.unfollow_user(text),
--   carguy.follow_user(text), carguy.search_profiles(text, integer), carguy.get_public_profile(text),
--   carguy.social_uid(text), carguy.social_friends(uuid, uuid), carguy.social_follows(uuid, uuid), carguy.social_blocked(uuid, uuid);
-- drop table if exists carguy.report, carguy.block, carguy.follow, carguy.reserved_handles;
-- drop trigger if exists profiles_handle_guard on carguy.profiles; drop function if exists carguy.profiles_handle_guard();
-- alter table carguy.profiles drop column if exists handle … handle_changed_at (and the three constraints, the index).
