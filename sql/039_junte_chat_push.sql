-- sql/039 — junte chat by @handle + push notifications (next cycle, carried from 2.5: "Junte chat + push").
--
--   · junte_messages(junte, after)  the chat list: authors by @handle / name / drawn avatar, never a user id. The
--                                   direct table read the 2.5 screen used (FEATURE_JUNTE_CHAT was off, so no phone
--                                   ever ran it) is closed: SELECT on carguy.junte_message is revoked.
--   · junte_member.muted            per junte, set by the member (set_junte_muted).
--   · carguy.push_token             one row per device (Expo push token); written only through
--                                   register_push_token / unregister_push_token. No client reads it.
--   · junte_push_claim(msg, caller) service_role only (api/junte-push.ts after it verifies the caller's token):
--                                   marks the message pushed ONCE and returns who to tell. A burst in one junte
--                                   becomes one notification (15 s). drop_push_tokens(tokens) forgets the tokens
--                                   Expo answered DeviceNotRegistered for.
--
-- carguy schema only (ADR-06). No extension. Re-runnable.

-- ------------------------------------------------------------- columns ----
alter table carguy.junte_message add column if not exists pushed_at timestamptz;
alter table carguy.junte_member add column if not exists muted boolean not null default false;

revoke select on carguy.junte_message from authenticated;

-- ---------------------------------------------------------- push tokens ----
create table if not exists carguy.push_token (
  token      text primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  platform   text not null check (platform in ('android', 'ios')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint push_token_format check (token ~ '^Expo(nent)?PushToken\[[A-Za-z0-9_-]{10,64}\]$')
);
create index if not exists push_token_user_idx on carguy.push_token (user_id);
alter table carguy.push_token enable row level security;   -- no policies: RPCs and service_role only
revoke all on carguy.push_token from anon, authenticated;

-- A device's token belongs to whoever signed in on it last (a re-login moves it). 10 devices per account.
create or replace function carguy.register_push_token(p_token text, p_platform text) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  if me is null or not carguy.is_app_user() then raise exception 'forbidden' using errcode = '42501'; end if;
  insert into carguy.push_token (token, user_id, platform) values (p_token, me, p_platform)
  on conflict (token) do update set user_id = excluded.user_id, platform = excluded.platform, updated_at = now();
  delete from carguy.push_token where user_id = me and token in (
    select token from carguy.push_token where user_id = me order by updated_at desc offset 10);
end $$;

create or replace function carguy.unregister_push_token(p_token text) returns void
language sql volatile security definer set search_path = '' as $$
  delete from carguy.push_token where token = p_token and user_id = auth.uid();
$$;

-- ----------------------------------------------------------------- mute ----
create or replace function carguy.set_junte_muted(p_junte uuid, p_muted boolean) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  if not carguy.junte_is_member(p_junte, auth.uid()) then raise exception 'not_member' using errcode = 'P0001'; end if;
  update carguy.junte_member set muted = coalesce(p_muted, false), updated_at = now()
   where junte_id = p_junte and user_id = auth.uid();
end $$;

-- ------------------------------------------------------------ the list ----
-- The newest 200 (or those after p_after), oldest first. Members only; deleted messages and blocked authors (either
-- way) never come back. 'mine' and 'can_delete' instead of ids; 'muted' is the caller's own switch.
create or replace function carguy.junte_messages(p_junte uuid, p_after timestamptz default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare me uuid := auth.uid(); owner uuid;
begin
  if not carguy.junte_is_member(p_junte, me) then return null; end if;
  select owner_id into owner from carguy.junte where id = p_junte;
  return jsonb_build_object(
    'muted', coalesce((select muted from carguy.junte_member where junte_id = p_junte and user_id = me), false),
    'messages', coalesce((
      select jsonb_agg(x.o order by x.created_at, x.id)
        from (select m.created_at, m.id, jsonb_build_object(
                       'id', m.id, 'body', m.body, 'created_at', m.created_at,
                       'mine', m.user_id = me, 'can_delete', m.user_id = me or owner = me,
                       'author', jsonb_build_object('handle', p.handle, 'display_name', p.display_name, 'avatar_id', p.avatar_id)) o
                from carguy.junte_message m join carguy.profiles p on p.user_id = m.user_id
               where m.junte_id = p_junte and m.deleted_at is null
                 and (p_after is null or m.created_at > p_after)
                 and not carguy.social_blocked(me, m.user_id)
               order by m.created_at desc, m.id desc
               limit 200) x), '[]'::jsonb));
end $$;

-- ------------------------------------------------------- the push claim ----
-- service_role only. p_caller is the uid api/junte-push.ts verified from the caller's own token: only the author may
-- trigger the push for their message, only within 5 minutes, only once. Recipients: members who count (invited,
-- going, live), not the author, not muted, not blocked by/with the author (junte_is_member also drops anyone the
-- owner blocked). The body is cut to 140 characters.
create or replace function carguy.junte_push_claim(p_message uuid, p_caller uuid) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare m carguy.junte_message%rowtype; j carguy.junte%rowtype; recent boolean;
begin
  update carguy.junte_message set pushed_at = now()
   where id = p_message and user_id = p_caller and deleted_at is null and pushed_at is null
     and created_at > now() - interval '5 minutes'
  returning * into m;
  if not found then return null; end if;
  select * into j from carguy.junte where id = m.junte_id;
  if not found or j.status = 'ended' or not carguy.junte_is_member(j.id, p_caller) then return null; end if;
  select exists (select 1 from carguy.junte_message x
                  where x.junte_id = j.id and x.id <> m.id and x.pushed_at > now() - interval '15 seconds') into recent;
  if recent then return jsonb_build_object('skipped', 'burst'); end if;
  return jsonb_build_object(
    'junte_id', j.id, 'title', j.title,
    'author', (select coalesce(nullif(p.display_name, ''), '@' || p.handle) from carguy.profiles p where p.user_id = p_caller),
    'body', left(m.body, 140),
    'tokens', coalesce((
      select jsonb_agg(t.token order by t.token)
        from carguy.junte_member mm join carguy.push_token t on t.user_id = mm.user_id
       where mm.junte_id = j.id and mm.user_id <> p_caller and not mm.muted
         and carguy.junte_is_member(j.id, mm.user_id)
         and not carguy.social_blocked(p_caller, mm.user_id)), '[]'::jsonb));
end $$;

create or replace function carguy.drop_push_tokens(p_tokens text[]) returns integer
language sql volatile security definer set search_path = '' as $$
  with d as (delete from carguy.push_token where token = any(p_tokens) returning 1) select count(*)::int from d;
$$;

-- ---------------------------------------------------------------- grants ----
do $$ declare f text; begin
  foreach f in array array[
    'register_push_token(text, text)', 'unregister_push_token(text)', 'set_junte_muted(uuid, boolean)',
    'junte_messages(uuid, timestamptz)'] loop
    execute format('revoke all on function carguy.%s from public, anon', f);
    execute format('grant execute on function carguy.%s to authenticated', f);
  end loop;
  foreach f in array array['junte_push_claim(uuid, uuid)', 'drop_push_tokens(text[])'] loop
    execute format('revoke all on function carguy.%s from public, anon, authenticated', f);
    execute format('grant execute on function carguy.%s to service_role', f);
  end loop;
end $$;

-- ---------------------------------------------------------------- rollback ----
-- drop function if exists carguy.junte_push_claim(uuid, uuid), carguy.drop_push_tokens(text[]),
--   carguy.junte_messages(uuid, timestamptz), carguy.set_junte_muted(uuid, boolean),
--   carguy.register_push_token(text, text), carguy.unregister_push_token(text);
-- drop table if exists carguy.push_token;
-- alter table carguy.junte_member drop column if exists muted;
-- alter table carguy.junte_message drop column if exists pushed_at;
-- grant select on carguy.junte_message to authenticated;
