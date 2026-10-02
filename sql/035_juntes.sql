-- 035_juntes.sql — IMP 01102026 Phase 2: juntes (02-specs/01-data-model-v10.md §3; ADR-57).
--
--   · carguy.junte          the event: title, when, a meeting point the owner chose (a public place), visibility, code
--   · carguy.junte_member   who is in it and as what (owner/member) and how (invited · going · live · left · kicked)
--   · carguy.junte_photo    album photos a member linked to it
--   · carguy.junte_message  chat — created now, UI behind FEATURE_JUNTE_CHAT = false
--   · RPCs                  create/join (by code)/leave/kick/end/set_status/link trip/detail/my_juntes/send_message
--   · carguy.junte_topic_allowed(topic) — what 036's realtime.messages policies call
--
-- Live positions are NEVER stored here (conventions §3): they travel only as Realtime Broadcast on the private
-- channel `carguy:junte:<id>` (036), and nothing in this file has a position column except the meeting point.
-- Members are read by handle; no user id leaves these functions.
--
-- carguy only, no --shared (the realtime policies are 036). Re-runnable.
-- Apply: node tools/apply-sql.mjs sql/035_juntes.sql

create table if not exists carguy.junte (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users(id) on delete cascade,
  title       text not null check (char_length(title) between 1 and 60),
  starts_at   timestamptz not null,
  ends_at     timestamptz,
  meet_lat    double precision,
  meet_lng    double precision,
  meet_label  text check (meet_label is null or char_length(meet_label) <= 80),
  visibility  text not null default 'invite' check (visibility in ('invite', 'followers', 'public')),
  code        text not null unique check (code ~ '^[a-z0-9]{8}$'),
  status      text not null default 'planned' check (status in ('planned', 'live', 'ended')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (ends_at is null or ends_at >= starts_at)  -- = when cancelled before it started (end_junte)
);
create table if not exists carguy.junte_member (
  junte_id      uuid not null references carguy.junte(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  role          text not null default 'member' check (role in ('owner', 'member')),
  status        text not null default 'going' check (status in ('invited', 'going', 'live', 'left', 'kicked')),
  trip_share_id text,
  joined_at     timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  primary key (junte_id, user_id)
);
create index if not exists junte_member_user_idx on carguy.junte_member (user_id, status);
create table if not exists carguy.junte_photo (
  junte_id   uuid not null references carguy.junte(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  media_id   text not null,
  created_at timestamptz not null default now(),
  primary key (junte_id, media_id)
);
create table if not exists carguy.junte_message (
  id         uuid primary key default gen_random_uuid(),
  junte_id   uuid not null references carguy.junte(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists junte_message_junte_idx on carguy.junte_message (junte_id, created_at);

-- --------------------------------------------------------------- helpers ----
-- In it right now as a member that counts (not left/kicked), and not blocked by the owner. Internal.
create or replace function carguy.junte_is_member(j uuid, u uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select u is not null and exists (
    select 1 from carguy.junte_member m join carguy.junte jj on jj.id = m.junte_id
     where m.junte_id = j and m.user_id = u and m.status in ('invited', 'going', 'live')
       and not carguy.social_blocked(jj.owner_id, u));
$$;
revoke all on function carguy.junte_is_member(uuid, uuid) from public, anon, authenticated;

-- The same, for the caller only — what the RLS policies call (they run as the client, so it must be granted; it
-- takes no user id, so nobody can probe someone else's membership with it).
create or replace function carguy.junte_mine(j uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select carguy.junte_is_member(j, auth.uid());
$$;
revoke all on function carguy.junte_mine(uuid) from public, anon;
grant execute on function carguy.junte_mine(uuid) to authenticated;

-- Policy helper: has the caller and this author blocked each other? (Caller-scoped; social_blocked stays internal.)
create or replace function carguy.junte_blocked_author(author uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select carguy.social_blocked(auth.uid(), author);
$$;
revoke all on function carguy.junte_blocked_author(uuid) from public, anon;
grant execute on function carguy.junte_blocked_author(uuid) to authenticated;

-- The live window: from 30 min before the start to the end (or 6 h after the start), while not ended.
create or replace function carguy.junte_live_window(j carguy.junte) returns boolean
language sql stable set search_path = '' as $$
  select j.status <> 'ended' and now() >= j.starts_at - interval '30 minutes'
     and now() <= coalesce(j.ends_at, j.starts_at + interval '6 hours');
$$;
revoke all on function carguy.junte_live_window(carguy.junte) from public, anon, authenticated;

-- For 036's realtime.messages policies (they run as the client, so this one is granted): may the caller use the
-- Realtime topic `carguy:junte:<uuid>` now? The prefix and the uuid shape are checked BEFORE any cast, so a Music
-- Hub topic (or garbage) can never raise — it is simply false. Reveals only the caller's own membership.
create or replace function carguy.junte_topic_allowed(p_topic text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare j carguy.junte%rowtype; jid uuid;
begin
  if p_topic is null or p_topic !~ '^carguy:junte:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  jid := substr(p_topic, 14)::uuid;
  select * into j from carguy.junte where id = jid;
  if not found or not carguy.junte_live_window(j) then return false; end if;
  return exists (select 1 from carguy.junte_member m
                  where m.junte_id = jid and m.user_id = auth.uid() and m.status in ('going', 'live'))
     and not carguy.social_blocked(j.owner_id, auth.uid());
end $$;
revoke all on function carguy.junte_topic_allowed(text) from public, anon;
grant execute on function carguy.junte_topic_allowed(text) to authenticated;

-- ------------------------------------------------------------------- RLS ----
-- Members read their juntes, the members list (through junte_detail), photos, messages. All writes are RPCs.
alter table carguy.junte enable row level security;
alter table carguy.junte_member enable row level security;
alter table carguy.junte_photo enable row level security;
alter table carguy.junte_message enable row level security;
drop policy if exists junte_member_read on carguy.junte;
create policy junte_member_read on carguy.junte for select to authenticated
  using (owner_id = (select auth.uid()) or carguy.junte_mine(id));
drop policy if exists junte_member_self on carguy.junte_member;
create policy junte_member_self on carguy.junte_member for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists junte_photo_member on carguy.junte_photo;
create policy junte_photo_member on carguy.junte_photo for select to authenticated
  using (carguy.junte_mine(junte_id));
drop policy if exists junte_message_member on carguy.junte_message;
create policy junte_message_member on carguy.junte_message for select to authenticated
  using (deleted_at is null and carguy.junte_mine(junte_id) and not carguy.junte_blocked_author(user_id));
do $$ declare t text; begin
  foreach t in array array['junte', 'junte_member', 'junte_photo', 'junte_message'] loop
    execute format('drop policy if exists carguy_app_only on carguy.%I', t);
    execute format('create policy carguy_app_only on carguy.%I as restrictive for all to authenticated '
                   'using ((select carguy.is_app_user())) with check ((select carguy.is_app_user()))', t);
    execute format('revoke all on carguy.%I from anon, authenticated', t);
    execute format('grant select on carguy.%I to authenticated', t);
  end loop;
end $$;

-- ------------------------------------------------------------------ RPCs ----
create or replace function carguy.create_junte(
  p_title text, p_starts_at timestamptz, p_ends_at timestamptz default null,
  p_meet_lat double precision default null, p_meet_lng double precision default null, p_meet_label text default null,
  p_visibility text default 'invite'
) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare me uuid := auth.uid(); new_id uuid; new_code text; tries int := 0;
begin
  if me is null or not carguy.is_app_user() then raise exception 'forbidden' using errcode = '42501'; end if;
  -- 10 juntes a day is plenty for a person; a script is not.
  if (select count(*) from carguy.junte where owner_id = me and created_at > now() - interval '24 hours') >= 10 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  -- The table allows ends_at = starts_at only for a junte cancelled before it started (end_junte).
  if p_ends_at is not null and p_ends_at <= p_starts_at then raise exception 'bad_window' using errcode = '22023'; end if;
  loop
    new_code := lower(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    exit when not exists (select 1 from carguy.junte where code = new_code);
    tries := tries + 1;
    if tries > 5 then raise exception 'code_collision' using errcode = 'P0001'; end if;
  end loop;
  insert into carguy.junte (owner_id, title, starts_at, ends_at, meet_lat, meet_lng, meet_label, visibility, code)
  values (me, trim(p_title), p_starts_at, p_ends_at, p_meet_lat, p_meet_lng, nullif(trim(coalesce(p_meet_label, '')), ''),
          coalesce(p_visibility, 'invite'), new_code)
  returning id into new_id;
  insert into carguy.junte_member (junte_id, user_id, role, status) values (new_id, me, 'owner', 'going');
  return jsonb_build_object('id', new_id, 'code', new_code);
end $$;

-- Join by code. A blocked pair cannot join each other's juntes; kicked stays kicked; an ended junte is closed.
create or replace function carguy.join_junte(p_code text) returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare me uuid := auth.uid(); j carguy.junte%rowtype; prev text;
begin
  if me is null or not carguy.is_app_user() then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into j from carguy.junte where code = lower(trim(p_code));
  if not found or j.status = 'ended' then raise exception 'not_found' using errcode = 'P0002'; end if;
  if carguy.social_blocked(j.owner_id, me) then raise exception 'not_found' using errcode = 'P0002'; end if;
  select status into prev from carguy.junte_member where junte_id = j.id and user_id = me;
  if prev = 'kicked' then raise exception 'kicked' using errcode = 'P0001'; end if;
  if (select count(*) from carguy.junte_member where junte_id = j.id and status in ('invited', 'going', 'live')) >= 100 then
    raise exception 'full' using errcode = 'P0001';
  end if;
  insert into carguy.junte_member (junte_id, user_id, role, status) values (j.id, me, 'member', 'going')
  on conflict (junte_id, user_id) do update set status = 'going', updated_at = now()
    where carguy.junte_member.status in ('left', 'invited');
  return j.id;
end $$;

-- "Voy" / "En vivo" / leaving. The owner cannot leave (they end it instead).
create or replace function carguy.set_junte_status(p_junte uuid, p_status text) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  if p_status not in ('going', 'live', 'left') then raise exception 'status' using errcode = '22023'; end if;
  if p_status = 'left' and exists (select 1 from carguy.junte where id = p_junte and owner_id = me) then
    raise exception 'owner_cannot_leave' using errcode = 'P0001';
  end if;
  update carguy.junte_member set status = p_status, updated_at = now()
   where junte_id = p_junte and user_id = me and status in ('invited', 'going', 'live', 'left');
  if not found then raise exception 'not_member' using errcode = 'P0001'; end if;
end $$;

-- The owner removes someone. Realtime authorisation is cached per connection, so the app also broadcasts a
-- `kick` (ADR-57); the policy refuses the next subscription.
create or replace function carguy.kick_junte_member(p_junte uuid, p_handle text) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  if not exists (select 1 from carguy.junte where id = p_junte and owner_id = auth.uid()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update carguy.junte_member set status = 'kicked', updated_at = now()
   where junte_id = p_junte and user_id = carguy.social_uid(p_handle) and role <> 'owner';
end $$;

create or replace function carguy.end_junte(p_junte uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  update carguy.junte set status = 'ended', ends_at = greatest(starts_at, least(coalesce(ends_at, now()), now())), updated_at = now()
   where id = p_junte and owner_id = auth.uid() and status <> 'ended';
  if not found then raise exception 'forbidden' using errcode = '42501'; end if;
  update carguy.junte_member set status = case when status = 'live' then 'going' else status end, updated_at = now()
   where junte_id = p_junte;
end $$;

-- After the junte: a member links the trimmed route they shared (their own trip_share).
create or replace function carguy.link_junte_trip(p_junte uuid, p_trip_share text) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  if p_trip_share is not null and not exists (
       select 1 from carguy.trip_share s where s.id = p_trip_share and s.user_id = auth.uid() and s.deleted_at is null) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  update carguy.junte_member set trip_share_id = p_trip_share, updated_at = now()
   where junte_id = p_junte and user_id = auth.uid() and status in ('going', 'live');
  if not found then raise exception 'not_member' using errcode = 'P0001'; end if;
end $$;

-- Everything a member sees about one junte: no user ids, no positions; members by handle with their status and,
-- after it, their linked (already trimmed) route.
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
               'avatar_path', case when p.photo_public then p.avatar_path end,
               'role', m.role, 'status', m.status, 'is_me', m.user_id = me,
               'route', (select jsonb_build_object('polyline', s.polyline_trimmed, 'distance_m', s.distance_m)
                           from carguy.trip_share s where s.id = m.trip_share_id and s.user_id = m.user_id and s.deleted_at is null))
             order by m.role desc, m.joined_at)
        from carguy.junte_member m join carguy.profiles p on p.user_id = m.user_id
       where m.junte_id = p_junte and m.status in ('invited', 'going', 'live')
         and not carguy.social_blocked(me, m.user_id)), '[]'::jsonb),
    'photos', (select count(*) from carguy.junte_photo ph where ph.junte_id = p_junte));
end $$;

create or replace function carguy.my_juntes() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', j.id, 'title', j.title, 'starts_at', j.starts_at, 'ends_at', j.ends_at, 'status', j.status,
           'is_owner', j.owner_id = auth.uid(), 'my_status', m.status,
           'members', (select count(*) from carguy.junte_member x where x.junte_id = j.id and x.status in ('invited', 'going', 'live')))
         order by j.starts_at desc), '[]'::jsonb)
    from carguy.junte j join carguy.junte_member m on m.junte_id = j.id and m.user_id = auth.uid()
   where m.status in ('invited', 'going', 'live');
$$;

-- Chat (FEATURE_JUNTE_CHAT = false): 30 messages a minute per member; blocked pairs never see each other.
create or replace function carguy.send_junte_message(p_junte uuid, p_body text) returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare me uuid := auth.uid(); new_id uuid;
begin
  if not carguy.junte_is_member(p_junte, me) then raise exception 'not_member' using errcode = 'P0001'; end if;
  if (select count(*) from carguy.junte_message where user_id = me and created_at > now() - interval '1 minute') >= 30 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  insert into carguy.junte_message (junte_id, user_id, body) values (p_junte, me, left(trim(p_body), 500)) returning id into new_id;
  return new_id;
end $$;
create or replace function carguy.delete_junte_message(p_message uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  update carguy.junte_message m set deleted_at = now()
   where m.id = p_message and m.deleted_at is null
     and (m.user_id = auth.uid() or exists (select 1 from carguy.junte j where j.id = m.junte_id and j.owner_id = auth.uid()));
end $$;

do $$ declare f text; begin
  foreach f in array array[
    'create_junte(text, timestamptz, timestamptz, double precision, double precision, text, text)',
    'join_junte(text)', 'set_junte_status(uuid, text)', 'kick_junte_member(uuid, text)', 'end_junte(uuid)',
    'link_junte_trip(uuid, text)', 'junte_detail(uuid)', 'my_juntes()', 'send_junte_message(uuid, text)',
    'delete_junte_message(uuid)'] loop
    execute format('revoke all on function carguy.%s from public, anon', f);
    execute format('grant execute on function carguy.%s to authenticated', f);
  end loop;
end $$;

-- Block (034) now also removes the blocked person from the blocker's open juntes (ADR-55).
create or replace function carguy.block_user(p_handle text) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare me uuid := auth.uid(); target uuid := carguy.social_uid(p_handle);
begin
  if me is null or not carguy.is_app_user() then raise exception 'forbidden' using errcode = '42501'; end if;
  if target is null or target = me then raise exception 'not_found' using errcode = 'P0002'; end if;
  insert into carguy.block (blocker_id, blocked_id) values (me, target) on conflict do nothing;
  delete from carguy.follow where (follower_id = me and followee_id = target) or (follower_id = target and followee_id = me);
  update carguy.junte_member set status = 'kicked', updated_at = now()
   where user_id = target and role <> 'owner'
     and junte_id in (select id from carguy.junte where owner_id = me and status <> 'ended');
end $$;

-- Uso y costos (033) gains the juntes: how many, how many live members right now.
create or replace function carguy.admin_usage()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not carguy.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'at', now(),
    'db_bytes', pg_database_size(current_database()),
    'storage_bytes', (select coalesce(sum((o.metadata->>'size')::bigint), 0) from storage.objects o where o.bucket_id like 'carguy%'),
    'storage_objects', (select count(*) from storage.objects o where o.bucket_id like 'carguy%'),
    'mau', (select count(*) from carguy.profiles p join auth.users u on u.id = p.user_id
             where u.last_sign_in_at > now() - interval '30 days'),
    'users', (select count(*) from carguy.profiles),
    'juntes_30d', (select count(*) from carguy.junte where created_at > now() - interval '30 days'),
    'live_members', (select count(*) from carguy.junte_member where status = 'live'),
    'limits', jsonb_build_object('db_bytes', 500 * 1024 * 1024, 'storage_bytes', 1024 * 1024 * 1024, 'mau', 50000,
                                 'realtime_messages', 2000000)
  );
end $$;

-- rollback: drop the RPCs above, then
-- drop table if exists carguy.junte_message, carguy.junte_photo, carguy.junte_member, carguy.junte;
-- drop function if exists carguy.junte_topic_allowed(text), carguy.junte_live_window(carguy.junte), carguy.junte_is_member(uuid, uuid);
-- and re-run 034's block_user and 033's admin_usage.
