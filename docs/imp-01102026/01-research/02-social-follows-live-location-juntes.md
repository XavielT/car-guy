# Car Guy: Social layer, follows, live location and "juntes"

Research report 02. Scope: public profiles and the follow graph, what followers can see, live location during group drives ("juntes"), the junte data model, chat (later stage), basic abuse controls, and how all of this fits with sync. Stack assumptions: Expo SDK 57, Supabase project `x-core` (shared with another app), schema `carguy`, RLS on every table, supabase-js auth, local-first SQLite with LWW sync, public pages served by a Vercel function.

Verification legend. Claims taken from the fetched docs are marked with their source. Anything else is marked **unverified (from knowledge)**. Table and column names of existing Car Guy tables (`profiles`, `vehicle`, `trip`, `milestone`, `album_item`, `garage_invite`, `submit_feedback`) are **assumptions**. Rename them to match the real schema before applying.

---

## 0. Executive summary (the decisions)

| Topic | Decision |
|---|---|
| Profile exposure | Private columns never leave through a table. Other users' profiles are read **only through `security definer` RPCs** that return a fixed, safe column set. A `security_invoker` view is used only for the user's own data (`my_friends`). |
| Follow model | `follow(follower_id, followee_id, status)`. A public account accepts follows instantly. A private account gets `pending` requests it approves. "Friends" = mutual accepted follows, exposed as a view. |
| Counts | Computed on the fly with indexed `count(*)`. No materialized view: 20–30 users makes it pointless, and a materialized view can't have RLS. |
| Blocking | `block` table. A trigger deletes follows in both directions. Every read RPC and policy checks blocks in both directions through one helper. |
| Search | `pg_trgm` + `unaccent`. Both are available on Supabase (verified). Database-wide, so they go in `--shared`. |
| Trips | Never public. A share is a separate `trip_share` row holding a **client-trimmed** polyline. The raw trip RLS never opens. |
| Live location | Private Realtime channel `carguy:junte:<id>`. **Broadcast** carries positions, **Presence** carries who is online. No Postgres Changes, no persistence. |
| Cost | 10 cars × 1 msg / 4 s × 2 h ≈ **180k Realtime messages** (about 9% of the Free 2M/month). The per-second limit, not the monthly one, is the first ceiling you hit as the group grows. |
| Chat | Ship it after follows and juntes. Persist in `junte_message` and fan out with Broadcast from the database (`realtime.send`), not Postgres Changes. |
| Sync | Rows owned by one user that make sense offline (`privacy_zone`, `trip_share`) sync through SQLite with LWW. Anything that involves another user's state (`follow`, `block`, `junte*`, `report`, messages) is cloud-only, with a read-only local cache. |

---

## 1. Public profiles and the follow graph

### 1.1 Why "RLS on columns" is not a thing, and what to do instead

RLS in Postgres decides **which rows** a role can see, never which columns. A policy like "others can read my profile row" exposes every column of that row: email-like fields, role, push token, premium flags, and anything you add later. Postgres has **column privileges** (`grant select (col1, col2)`), but they apply per role for every row, so `authenticated` would lose those columns on its *own* row too. They also make `select *` fail. Supabase explicitly says it does not recommend column-level privileges for most users (source: Supabase Column Level Security docs).

There are two standard patterns:

1. **View that runs with the owner's rights.** The view selects only the safe columns and filters `is_public`. A view created by `postgres` bypasses RLS by default (source: Supabase RLS docs). That bypass is what makes it work, but the Supabase linter flags it as `security_definer_view`, and it is easy to widen by accident later. If you use a view for **your own** rows, set `with (security_invoker = true)` so it respects the table's RLS (source: Supabase RLS docs, Postgres 15+).
2. **`security definer` function (RPC)** with a fixed `returns table(...)` or `jsonb`, `search_path = ''`, and fully qualified names (source: Supabase RLS docs). This is the **recommended** pattern here. The column set is fixed by the signature, the block check and `is_public` check live in one place, and you already use this pattern for `submit_feedback`.

On "don't put security definer functions in exposed schemas": that warning is about *helpers* used inside policies, which callers should not be able to invoke over the Data API. RPCs that are **meant** to be called (`get_public_profile`, `search_profiles`, `join_junte`) must live in the exposed schema `carguy` and must check permissions themselves. Helpers go in a non-exposed schema, `carguy_private`.

### 1.2 Profile columns

- `handle`: lowercase, 3–20 characters, `[a-z0-9._]`, starts and ends with a letter or digit, no `..`. Unique. Checked against a reserved-words table.
- `bio`: up to 160 characters.
- `is_public`, default **false** (privacy by default). The owner (the influencer) switches it on at onboarding.
- Per-block visibility flags, all default false: `show_vehicles`, `show_stats_tires`, `show_stats_km`, `show_badges`, `show_mods`.
- `handle_changed_at`: allows one handle change every 30 days, which limits squatting and impersonation churn.

Private accounts still appear in search with handle, display name and avatar (Instagram behaviour), so followers can find and request them. Nothing else is shown for a private account.

### 1.3 Handle search and accent folding

`pg_trgm` and `unaccent` are both preinstalled and available. Most extensions go into the `extensions` schema (source: Supabase Extensions docs). `unaccent()` is only `STABLE`, so it can't appear in an index expression. The usual workaround is an `IMMUTABLE` wrapper that pins the dictionary (**unverified (from knowledge)**, standard Postgres idiom). With 30 users a sequential scan is instant. The GIN index is cheap insurance and can be skipped.

Search matches on `handle` and `display_name`, so "jose" finds "José Pérez".

### 1.4 Deep link `car-guy.vercel.app/u/<handle>`

Reuse the `/c/<slug>` Vercel function:

- Add the route `api/u/[handle].ts` and a rewrite `/u/:handle -> /api/u/:handle`.
- Call `rpc('get_public_profile', { p_handle })` with the **anon** key. The RPC grants execute to `anon`, and for anonymous callers it returns data only if `is_public`. For a private or unknown handle, render a generic "Perfil privado / Ábrelo en Car Guy" page with no avatar, so a private profile reveals nothing on the open web.
- OG tags: `og:title` = "Display Name (@handle) · Car Guy", `og:description` = the bio (or "N carros en su garaje" if `show_vehicles`), `og:image` = avatar or the first public vehicle's cover (public storage URL or signed URL, as `/c/` does), `og:url`, `twitter:card=summary_large_image`. Header: `Cache-Control: s-maxage=300, stale-while-revalidate=86400`.
- App open: extend the existing Android intent filter / App Links `assetlinks.json` with `/u/*` and `/j/*`, and the `carguy://u/<handle>` scheme (**unverified (from knowledge)** that the current setup is App Links rather than scheme-only. Check `app.json`).

### 1.5 SQL: profiles, follows, blocks, search (schema `carguy`)

```sql
-- ===== carguy: 0xx_social_profiles.sql (additive) =====
create schema if not exists carguy_private;          -- see "--shared" note in section 8
grant usage on schema carguy_private to authenticated, anon;

-- Reserved handles
create table if not exists carguy.reserved_handle (handle text primary key);
insert into carguy.reserved_handle(handle) values
 ('admin'),('administrator'),('root'),('support'),('soporte'),('help'),('ayuda'),
 ('carguy'),('car_guy'),('car.guy'),('official'),('oficial'),('staff'),('moderator'),
 ('api'),('app'),('www'),('u'),('c'),('j'),('t'),('login'),('signup'),('settings'),
 ('terms'),('privacy'),('null'),('undefined'),('me'),('juntes'),('junte')
on conflict do nothing;
alter table carguy.reserved_handle enable row level security;   -- no policies: RPC/trigger only

-- Profile columns
alter table carguy.profiles
  add column if not exists handle text,
  add column if not exists bio text,
  add column if not exists is_public boolean not null default false,
  add column if not exists show_vehicles boolean not null default false,
  add column if not exists show_stats_tires boolean not null default false,
  add column if not exists show_stats_km boolean not null default false,
  add column if not exists show_badges boolean not null default false,
  add column if not exists show_mods boolean not null default false,
  add column if not exists handle_changed_at timestamptz;

do $$ begin
  alter table carguy.profiles add constraint profiles_handle_format
    check (handle is null or (handle ~ '^[a-z0-9][a-z0-9._]{1,18}[a-z0-9]$' and handle !~ '\.\.'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table carguy.profiles add constraint profiles_bio_len check (bio is null or char_length(bio) <= 160);
exception when duplicate_object then null; end $$;
create unique index if not exists profiles_handle_uq on carguy.profiles(handle) where handle is not null;

create or replace function carguy_private.profiles_handle_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.handle is distinct from old.handle and new.handle is not null then
    new.handle := lower(new.handle);
    if exists (select 1 from carguy.reserved_handle r where r.handle = new.handle)
       and not coalesce((select p.role = 'admin' from carguy.profiles p where p.id = (select auth.uid())), false) then
      raise exception 'handle_reserved' using errcode = 'P0001';
    end if;
    if old.handle is not null and old.handle_changed_at > now() - interval '30 days' then
      raise exception 'handle_change_cooldown' using errcode = 'P0001';
    end if;
    new.handle_changed_at := now();
  end if;
  return new;
end $$;
drop trigger if exists trg_profiles_handle_guard on carguy.profiles;
create trigger trg_profiles_handle_guard before insert or update of handle on carguy.profiles
  for each row execute function carguy_private.profiles_handle_guard();
-- NOTE: for INSERT, OLD is null; the cooldown check short-circuits on "old.handle is not null".
-- If plpgsql complains about OLD on insert, split into two triggers (insert / update).

-- ===== Blocks =====
create table if not exists carguy.block (
  blocker_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index if not exists block_blocked_idx on carguy.block(blocked_id);
alter table carguy.block enable row level security;
drop policy if exists block_select_own on carguy.block;
create policy block_select_own on carguy.block for select to authenticated
  using (blocker_id = (select auth.uid()));
drop policy if exists block_insert_own on carguy.block;
create policy block_insert_own on carguy.block for insert to authenticated
  with check (blocker_id = (select auth.uid()));
drop policy if exists block_delete_own on carguy.block;
create policy block_delete_own on carguy.block for delete to authenticated
  using (blocker_id = (select auth.uid()));
grant select, insert, delete on carguy.block to authenticated;

-- Helper: block in either direction (definer, so it sees the other user's block rows)
create or replace function carguy_private.is_blocked_pair(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select a is not null and b is not null and exists (
    select 1 from carguy.block
    where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a));
$$;
grant execute on function carguy_private.is_blocked_pair(uuid, uuid) to authenticated, anon;

-- ===== Follows =====
create table if not exists carguy.follow (
  follower_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  followee_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);
create index if not exists follow_followee_idx on carguy.follow(followee_id, status);
alter table carguy.follow enable row level security;

drop policy if exists follow_select_party on carguy.follow;
create policy follow_select_party on carguy.follow for select to authenticated
  using (follower_id = (select auth.uid()) or followee_id = (select auth.uid()));
drop policy if exists follow_insert_self on carguy.follow;
create policy follow_insert_self on carguy.follow for insert to authenticated
  with check (follower_id = (select auth.uid()));
drop policy if exists follow_update_followee on carguy.follow;   -- accept a request
create policy follow_update_followee on carguy.follow for update to authenticated
  using (followee_id = (select auth.uid())) with check (followee_id = (select auth.uid()));
drop policy if exists follow_delete_party on carguy.follow;      -- unfollow or remove follower
create policy follow_delete_party on carguy.follow for delete to authenticated
  using (follower_id = (select auth.uid()) or followee_id = (select auth.uid()));
grant select, insert, update (status, accepted_at), delete on carguy.follow to authenticated;

create or replace function carguy_private.follow_before_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_public boolean;
begin
  if carguy_private.is_blocked_pair(new.follower_id, new.followee_id) then
    raise exception 'blocked' using errcode = 'P0001';
  end if;
  select p.is_public into v_public from carguy.profiles p where p.id = new.followee_id;
  if v_public is null then raise exception 'profile_not_found' using errcode = 'P0001'; end if;
  -- rate limit: 100 new follows per 24 h
  if (select count(*) from carguy.follow f
      where f.follower_id = new.follower_id and f.created_at > now() - interval '24 hours') >= 100 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  new.status := case when v_public then 'accepted' else 'pending' end;   -- client can't self-accept
  new.accepted_at := case when v_public then now() end;
  new.created_at := now();
  return new;
end $$;
drop trigger if exists trg_follow_before_insert on carguy.follow;
create trigger trg_follow_before_insert before insert on carguy.follow
  for each row execute function carguy_private.follow_before_insert();

-- Blocking removes follows both ways
create or replace function carguy_private.block_after_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from carguy.follow
   where (follower_id = new.blocker_id and followee_id = new.blocked_id)
      or (follower_id = new.blocked_id and followee_id = new.blocker_id);
  update carguy.junte_member set status = 'left'          -- remove blocked user from blocker's juntes
   where user_id = new.blocked_id
     and junte_id in (select id from carguy.junte where owner_id = new.blocker_id and status <> 'ended');
  return null;
end $$;
-- create the trigger AFTER the junte tables exist (section 4 file):
-- create trigger trg_block_after_insert after insert on carguy.block
--   for each row execute function carguy_private.block_after_insert();

create or replace function carguy_private.is_accepted_follower(follower uuid, followee uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from carguy.follow
                 where follower_id = follower and followee_id = followee and status = 'accepted');
$$;
create or replace function carguy_private.is_friend(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select carguy_private.is_accepted_follower(a, b) and carguy_private.is_accepted_follower(b, a);
$$;
grant execute on function carguy_private.is_accepted_follower(uuid, uuid), carguy_private.is_friend(uuid, uuid) to authenticated;

-- Friends of the caller (invoker view: the follow RLS applies, which is exactly right)
create or replace view carguy.my_friends with (security_invoker = true) as
  select f1.followee_id as friend_id, greatest(f1.accepted_at, f2.accepted_at) as friends_since
  from carguy.follow f1
  join carguy.follow f2 on f2.follower_id = f1.followee_id and f2.followee_id = f1.follower_id
  where f1.follower_id = (select auth.uid()) and f1.status = 'accepted' and f2.status = 'accepted';
grant select on carguy.my_friends to authenticated;

-- ===== Search (needs extensions: see --shared file) =====
create or replace function carguy_private.f_unaccent(text)
returns text language sql immutable parallel safe strict set search_path = '' as $$
  select extensions.unaccent('extensions.unaccent'::regdictionary, $1);
$$;
create index if not exists profiles_search_trgm on carguy.profiles using gin
  ((carguy_private.f_unaccent(lower(coalesce(handle,'') || ' ' || coalesce(display_name,'')))) extensions.gin_trgm_ops);

create or replace function carguy.search_profiles(q text, lim int default 20)
returns table (id uuid, handle text, display_name text, avatar_path text, is_public boolean, i_follow text)
language sql stable security definer set search_path = '' as $$
  with me as (select (select auth.uid()) as uid),
       qq as (select carguy_private.f_unaccent(lower(trim(q))) as t)
  select p.id, p.handle, p.display_name, p.avatar_path, p.is_public,
         (select f.status from carguy.follow f, me where f.follower_id = me.uid and f.followee_id = p.id)
  from carguy.profiles p, me, qq
  where char_length(qq.t) >= 2 and p.handle is not null and p.id <> me.uid
    and not carguy_private.is_blocked_pair(me.uid, p.id)
    and ( carguy_private.f_unaccent(lower(p.handle || ' ' || coalesce(p.display_name,''))) operator(extensions.%) qq.t
          or p.handle like qq.t || '%' )
  order by (p.handle = qq.t) desc,
           extensions.similarity(carguy_private.f_unaccent(lower(p.handle || ' ' || coalesce(p.display_name,''))), qq.t) desc
  limit least(lim, 50);
$$;
revoke all on function carguy.search_profiles(text, int) from public, anon;
grant execute on function carguy.search_profiles(text, int) to authenticated;
```

> Note: the two match conditions (trigram `%` OR handle prefix) are parenthesized so the block check applies to both. Without the parentheses, blocked users would leak through the `or` branch. Keep the parentheses if you edit this.

### 1.6 Counts and the public profile RPC

At this scale the counts come from `count(*)` over the `follow_followee_idx` / PK indexes, which is microseconds. A materialized view would need a refresh schedule (`pg_cron`), would always be a little stale, and **can't carry RLS**. Revisit only past roughly 10k users.

```sql
create or replace function carguy.get_public_profile(p_handle text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare me uuid := (select auth.uid()); p carguy.profiles; can_see boolean; out jsonb;
begin
  select * into p from carguy.profiles where handle = lower(p_handle);
  if p.id is null or carguy_private.is_blocked_pair(me, p.id) then return null; end if;
  can_see := p.is_public or p.id = me or carguy_private.is_accepted_follower(me, p.id);
  out := jsonb_build_object(
    'id', p.id, 'handle', p.handle, 'display_name', p.display_name,
    'avatar_path', p.avatar_path, 'is_public', p.is_public,
    'bio', case when can_see then p.bio end,
    'followers', (select count(*) from carguy.follow where followee_id = p.id and status = 'accepted'),
    'following', (select count(*) from carguy.follow where follower_id = p.id and status = 'accepted'),
    'my_follow', (select status from carguy.follow where follower_id = me and followee_id = p.id),
    'follows_me', carguy_private.is_accepted_follower(p.id, me));
  if not can_see then return out; end if;
  if p.show_vehicles then   -- ASSUMED table/columns; never plate/VIN
    out := out || jsonb_build_object('vehicles', coalesce((
      select jsonb_agg(jsonb_build_object('id', v.id, 'name', v.name, 'make', v.make,
               'model', v.model, 'year', v.year, 'cover_path', v.cover_photo_path, 'slug', v.public_slug)
               order by v.created_at)
      from carguy.vehicle v where v.owner_id = p.id and v.deleted_at is null
        and coalesce(v.show_on_profile, true)), '[]'::jsonb));
  end if;
  if p.show_stats_km then
    out := out || jsonb_build_object('km_trips',
      (select round(coalesce(sum(t.distance_m),0)/1000.0) from carguy.trip t where t.owner_id = p.id and t.deleted_at is null));
  end if;
  -- show_stats_tires / show_badges / show_mods: same shape against the real tables
  return out;
end $$;
revoke all on function carguy.get_public_profile(text) from public;
grant execute on function carguy.get_public_profile(text) to authenticated, anon;
-- anon: me is null -> can_see only when is_public; follower/blocked checks return false.

alter table carguy.vehicle add column if not exists show_on_profile boolean not null default true;
```

Follower and following lists of *other* users come from an RPC `list_follows(p_handle, kind)` with the same `can_see` gate. Accepting a request is a plain `update follow set status='accepted', accepted_at=now()` under the followee policy.

Client sketch:

```ts
const { data } = await supabase.schema('carguy').rpc('get_public_profile', { p_handle: handle });
await supabase.schema('carguy').from('follow').insert({ followee_id: data.id }); // status set server-side
const { data: hits } = await supabase.schema('carguy').rpc('search_profiles', { q: text });
```

---

## 2. What a follower sees (privacy by default)

**Visible on a public profile:** avatar, handle, display name, bio. Plus, only if the owner turned each one on: the vehicle list (name, make, model, year, cover photo, link to `/c/<slug>`), tires burned, km in trips, badges, mods count.

**Never shown:** plate, VIN, fuel log, costs, maintenance records, documents, raw trips, garage members.

**Trips:** never public by default. Sharing creates a separate object.

### 2.1 `trip_share` and `privacy_zone`

The trim runs **on the device**, from the local raw points or the polyline. The server receives only the trimmed geometry, so the raw `trip` table's owner-only RLS never has to change. Storage is `text[]` of encoded polylines, one per segment, because cutting zones splits a route into pieces.

```sql
create table if not exists carguy.privacy_zone (
  id uuid primary key,                                   -- client-generated (local-first)
  owner_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  label text not null check (char_length(label) between 1 and 40),   -- "Casa", "Trabajo"
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  radius_m int not null default 300 check (radius_m between 200 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
alter table carguy.privacy_zone enable row level security;
drop policy if exists pz_owner_all on carguy.privacy_zone;
create policy pz_owner_all on carguy.privacy_zone for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
grant select, insert, update, delete on carguy.privacy_zone to authenticated;

create table if not exists carguy.trip_share (
  id uuid primary key,                                   -- client-generated
  owner_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  trip_id uuid not null,                                 -- references carguy.trip(id); FK optional for sync order
  vehicle_id uuid,
  visibility text not null default 'followers'
    check (visibility in ('followers','friends','public','junte')),
  junte_id uuid,                                         -- FK added in section 4
  title text check (char_length(title) <= 80),
  segments text[] not null check (cardinality(segments) between 1 and 50),
  distance_m int check (distance_m >= 0),                -- of the trimmed geometry
  duration_s int,
  started_on date,                                       -- day only, never exact start time
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists trip_share_owner_idx on carguy.trip_share(owner_id);
create index if not exists trip_share_junte_idx on carguy.trip_share(junte_id) where junte_id is not null;
alter table carguy.trip_share enable row level security;
drop policy if exists ts_owner_all on carguy.trip_share;
create policy ts_owner_all on carguy.trip_share for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
-- the read-by-others policy is created in section 4 (needs junte helpers)
grant select, insert, update, delete on carguy.trip_share to authenticated;
```

### 2.2 Trimming a polyline (pure function)

Rules: (1) cut the first and last **300 m + a deterministic jitter of 0–200 m** (seeded by `trip_id`), (2) remove every point inside any privacy zone, (3) **densify to ≤ 20 m before the zone test**, so a long straight segment between two outside points can't cut through a zone, (4) split into segments at every gap and never reconnect across a zone, (5) drop segments shorter than 100 m.

Why the jitter and seed matter: if every shared trip ends exactly 300 m from home, the endpoints of many trips sit on a 300 m circle, and their geometric centre is the house. Random jitter blurs that circle. Seeding it by `trip_id` means sharing the same trip twice gives the same cut, so re-sharing doesn't reveal the union. Named zones are the real fix for home and work. The endpoint trim covers places the user never registered. Strava-style privacy zones that also offset the zone centre add more protection (**unverified (from knowledge)**). Optional: store each zone's centre with a random 50–100 m offset at creation and make the radius at least 400 m.

```ts
// lib/privacy/trim.ts — pure, no I/O
export type P = { lat: number; lng: number };
export type Zone = { lat: number; lng: number; radius_m: number };
const R = 6371008.8;
const rad = (d: number) => (d * Math.PI) / 180;
export function dist(a: P, b: P): number {
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
const lerp = (a: P, b: P, t: number): P => ({ lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t });
function seeded(seed: string): () => number {           // mulberry32 over a string hash
  let h = 2166136261; for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => { h += 0x6d2b79f5; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function densify(pts: P[], maxStep = 20): P[] {
  const out: P[] = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const d = dist(pts[i - 1], pts[i]); const n = Math.ceil(d / maxStep);
    for (let k = 1; k <= n; k++) out.push(lerp(pts[i - 1], pts[i], k / n));
  }
  return out;
}
const segLen = (s: P[]) => s.reduce((acc, p, i) => (i ? acc + dist(s[i - 1], p) : 0), 0);

export function trimForShare(raw: P[], zones: Zone[], seed: string,
  opts = { endTrimM: 300, jitterM: 200, minSegM: 100 }): P[][] {
  if (raw.length < 2) return [];
  const pts = densify(raw);
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum[i] = cum[i - 1] + dist(pts[i - 1], pts[i]);
  const total = cum[cum.length - 1];
  const rnd = seeded(seed);
  const from = opts.endTrimM + rnd() * opts.jitterM;
  const to = total - (opts.endTrimM + rnd() * opts.jitterM);
  if (to - from < opts.minSegM) return [];
  // 1) endpoint trim with interpolation at the exact cut distance
  const mid: P[] = [];
  for (let i = 1; i < pts.length; i++) {
    const d0 = cum[i - 1], d1 = cum[i];
    if (d1 < from || d0 > to) continue;
    const L = d1 - d0 || 1;
    const a = d0 < from ? lerp(pts[i - 1], pts[i], (from - d0) / L) : pts[i - 1];
    const b = d1 > to ? lerp(pts[i - 1], pts[i], (to - d0) / L) : pts[i];
    if (!mid.length) mid.push(a);
    mid.push(b);
  }
  // 2) zone cut -> split into segments, never bridge a zone
  const segs: P[][] = []; let cur: P[] = [];
  for (const p of mid) {
    if (zones.some((z) => dist(p, z) <= z.radius_m)) { if (cur.length > 1) segs.push(cur); cur = []; }
    else cur.push(p);
  }
  if (cur.length > 1) segs.push(cur);
  return segs.filter((s) => segLen(s) >= opts.minSegM);
}
// then: simplify (Douglas-Peucker, ~5 m) and encode each segment with the existing polyline encoder.
```

---

## 3. Live location during a junte (Supabase Realtime)

### 3.1 Broadcast vs Presence vs Postgres Changes

| | Broadcast | Presence | Postgres Changes |
|---|---|---|---|
| What it is | Ephemeral client-to-client messages through the server | Shared state per key, synced to everyone on change | Row changes from the WAL, filtered per subscriber |
| Persistence | None (unless sent from the DB, kept 3 days) | None | The row is the persistence |
| Cost per update | 1 send + N deliveries | Re-sync to **all** subscribers on every change | 1 DB write + an RLS check **per subscriber** |
| Docs say | Use for rapid updates | "Calling track() rapidly … will flood the channel"; use for slow-changing state | Single-threaded; per-subscriber auth; switch to Broadcast at scale |
| Use in a junte | **Positions (~every 4 s)** | **Who is online, avatar, vehicle, "en vivo" on/off** | No |

Sources: Supabase Broadcast, Presence and Postgres Changes docs. Postgres Changes would also write 1 row per position (about 18k rows per 2 h junte) for data you don't want to keep. Rejected.

### 3.2 Channel and authorization

- Topic: **`carguy:junte:<uuid>`** (and `carguy:junte:<uuid>:chat` later). The `carguy:` prefix matters because `x-core` is shared: policies on `realtime.messages` are **project-wide**, so every policy must start with a topic-prefix guard. Otherwise it applies to the other app's channels too, and a `::uuid` cast on a foreign topic would throw.
- Client: `supabase.channel(topic, { config: { private: true } })`. Authorization is checked when the client joins, using RLS on `realtime.messages`. `realtime.topic()` gives the topic, and `realtime.messages.extension` is `'broadcast'` or `'presence'`. SELECT policies control receiving, INSERT policies control sending (source: Supabase Realtime Authorization).
- **Caveat (verified):** policies are cached per connection and only re-evaluated on reconnect or when a new JWT is sent. A member removed mid-drive keeps receiving until their JWT is refreshed (up to the JWT expiry, 1 h by default). Mitigations: the owner's "remove" also sends a broadcast `kick` event that the client honours, and the app calls `supabase.realtime.setAuth()` after token refresh.
- **Project setting:** the docs pair private channels with turning off "Allow public access" in Realtime settings. Because `x-core` is shared, **don't turn it off** unless the other app also uses only private channels. `private: true` channels are still authorized with the toggle on (**unverified (from knowledge)**; test with a non-member account before relying on it).
- Liveness without cron: the helper only allows join/send inside the live window `[starts_at − 30 min, least(coalesce(ends_at, starts_at + 6 h), starts_at + 6 h)]` and `status not in ('ended','cancelled')`. Nothing needs to "expire" on the server: no rows are stored, and new joins are refused after the window. The client also stops publishing at the window end.

SQL for this (realtime policies are in the `--shared` file, section 8) is in section 4.3.

### 3.3 Payload and client

Broadcast event `pos` (about 120 bytes JSON):

```json
{ "u": "<user uuid>", "v": "<vehicle uuid>", "lat": 18.47861, "lng": -69.93121,
  "spd": 13.4, "hdg": 271, "acc": 8, "ts": 1759339200123 }
```

5 decimals ≈ 1 m. `spd` in m/s, `hdg` in degrees, `acc` = GPS accuracy in m. The avatar and handle go in **Presence** metadata once (`track({ handle, avatar_path, vehicle_name, live: true })`), never in each position.

Downsampling gate. Publish when **(Δt ≥ 4 s and moved ≥ 20 m) or Δt ≥ 15 s** (heartbeat so a parked car doesn't look disconnected). Drop fixes with `acc > 50`. As the group grows, scale the interval: `T = max(4, n² / 60)` seconds (see 3.5).

```ts
const topic = `carguy:junte:${junteId}`;
const ch = supabase.channel(topic, {
  config: { private: true, broadcast: { self: false, ack: false }, presence: { key: userId } },
});
ch.on('broadcast', { event: 'pos' }, ({ payload }) => markers.upsert(payload))
  .on('broadcast', { event: 'kick' }, ({ payload }) => payload.u === userId && leave())
  .on('presence', { event: 'sync' }, () => setMembers(ch.presenceState()))
  .subscribe(async (s) => {
    if (s === 'SUBSCRIBED') await ch.track({ handle, avatar_path, vehicle_name, live: liveSwitch });
    if (s === 'CHANNEL_ERROR') showNotAllowed(); // policy refused: not a member / window closed
  });

let last: { t: number; p: P } | null = null;
export function maybePublish(fix: { lat: number; lng: number; speed: number; heading: number; accuracy: number }) {
  if (!liveSwitch || fix.accuracy > 50 || Date.now() > liveWindowEnd) return;
  const now = Date.now(), p = { lat: fix.lat, lng: fix.lng };
  const T = Math.max(4000, (memberCount ** 2 / 60) * 1000);
  if (last && !((now - last.t >= T && dist(last.p, p) >= 20) || now - last.t >= 15000)) return;
  last = { t: now, p };
  ch.send({ type: 'broadcast', event: 'pos', payload: {
    u: userId, v: vehicleId, lat: +p.lat.toFixed(5), lng: +p.lng.toFixed(5),
    spd: +fix.speed.toFixed(1), hdg: Math.round(fix.heading), acc: Math.round(fix.accuracy), ts: now } });
}
```

### 3.4 Battery and platforms

- Publish **only while the member's "En vivo" switch is on** and inside the window. Turning it off calls `untrack()` and stops location updates.
- **Android (APK):** `expo-location` `startLocationUpdatesAsync` with a TaskManager task, `accuracy: Balanced`/`High`, `timeInterval: 4000`, `distanceInterval: 20`, and a `foregroundService` notification ("Car Guy: compartiendo ubicación en el junte"). This needs background permission, `isAndroidBackgroundLocationEnabled`, and the `FOREGROUND_SERVICE_LOCATION` permission (source: Expo Location docs). The headless task may not hold the WebSocket reliably, so from the background task publish with **REST Broadcast** (`channel.httpSend()` in supabase-js ≥ 2.107, or `POST /realtime/v1/api/broadcast` with the user JWT and `private: true`) (source: Supabase Broadcast docs). It costs the same message, no socket required. Expect about 5–10% battery per hour with GPS high accuracy and screen off (**unverified (from knowledge)**). Recommend plugging in. Most car drives are plugged in anyway.
- **iOS (PWA):** web has no background location (source: Expo Location docs: only `getCurrentPositionAsync`/`watchPositionAsync` on web). The member must keep the PWA open in the foreground. Use the Screen Wake Lock API to stop the screen sleeping (**unverified (from knowledge)** that Safari supports it in installed PWAs, iOS 16.4+). Say this in the UI: "En iPhone, deja Car Guy abierto en pantalla".

### 3.5 Quotas and cost

Free plan (sources: Supabase Realtime Quotas, Pricing): **200 concurrent connections**, **100 messages/s**, 100 channel joins/s, 100 channels per connection, **20 presence messages/s**, 10 presence keys per object, Broadcast payload 256 KB, **2M messages/month**. Pro: 500 connections, 500 msg/s, 5M messages/month then $2.50 per million. A message is counted as "a WebSocket message delivered to, or sent from a client" (Quotas page). So a broadcast counts once for the send and once **per recipient**.

**10 cars, 1 msg per 4 s, 2 h:**
- Sends: 10 × 7,200 s / 4 s = 18,000
- Deliveries: 18,000 × 9 recipients = 162,000
- **Total ≈ 180,000 messages per junte (n² × duration / T)**, plus a few hundred presence events. That is about 9% of the Free monthly 2M, so about 10 such juntes a month before anything else.
- Rate: 10² / 4 = **25 msg/s**, well under the 100/s limit. Connections: 10.

**The ceiling is per second, not per month.** At 20 cars with T = 4 s you get 20² / 4 = 100 msg/s, exactly the Free limit, and you'd see `tenant_events` disconnects. Hence the adaptive `T = max(4, n²/60)`: 20 cars → 6.7 s, 30 cars → 15 s. Don't add live **spectators** (followers watching a public junte) on Free: each spectator adds n/T deliveries per second. If you want it later, give spectators a separate channel fed with one aggregated snapshot every 10–15 s.

---

## 4. Junte model

### 4.1 Tables and flow

- Create (cloud-only) → owner gets a member row with `role='owner', status='going'`.
- Invite via the code `ABCD2345` (Crockford-style base32, no I/O/0/1), shown as a QR / link `car-guy.vercel.app/j/<code>` and `carguy://junte/<code>`. **Reuse the shared-garage invite flow**: same Vercel route shape, same app route handler, a `join_junte(code)` RPC that mirrors the garage-invite RPC.
- Visibility: `invite` (code only), `followers` (accepted followers of the owner can see it in a feed and join without a code), `public` (any authenticated user).
- During: `status` `going → live` (switch on) → `done`.
- After: each member links **their own `trip_share`** (visibility `junte`, trimmed by *their own* zones on *their* device). The spec said `trip_id`. I link `trip_share_id` instead and keep `trip_id` only as the member's own reference, so other members can never reach an untrimmed trip. The client then creates a local `milestone` (`event_type='junte'`, `ref_id=junte_id`) on the member's car through normal sync. If `milestone.event_type` has a CHECK constraint, add `'junte'` to it. Photos: `album_item.junte_id` (new nullable synced column) plus `share_to_junte` boolean.

```sql
-- ===== carguy: 0xx_juntes.sql =====
create or replace function carguy_private.gen_code(len int default 8)
returns text language sql volatile set search_path = '' as $$
  select string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + floor(random()*31)::int, 1), '')
  from generate_series(1, len);
$$;

create table if not exists carguy.junte (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  title text not null check (char_length(title) between 3 and 80),
  description text check (char_length(description) <= 1000),
  starts_at timestamptz not null,
  ends_at timestamptz,
  meeting_lat double precision, meeting_lng double precision,
  meeting_label text check (char_length(meeting_label) <= 120),
  visibility text not null default 'invite' check (visibility in ('invite','followers','public')),
  code text not null unique default carguy_private.gen_code(8),
  status text not null default 'scheduled' check (status in ('scheduled','live','ended','cancelled')),
  max_members int not null default 30 check (max_members between 2 and 50),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or (ends_at > starts_at and ends_at <= starts_at + interval '24 hours'))
);
create index if not exists junte_owner_idx on carguy.junte(owner_id);
create index if not exists junte_starts_idx on carguy.junte(starts_at);

create table if not exists carguy.junte_member (
  junte_id uuid not null references carguy.junte(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','member')),
  status text not null default 'invited' check (status in ('invited','going','live','done','left')),
  vehicle_id uuid,
  trip_id uuid,                         -- member's own reference only
  trip_share_id uuid references carguy.trip_share(id) on delete set null,
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (junte_id, user_id)
);
create index if not exists junte_member_user_idx on carguy.junte_member(user_id);

do $$ begin
  alter table carguy.trip_share add constraint trip_share_junte_fk
    foreign key (junte_id) references carguy.junte(id) on delete set null;
exception when duplicate_object then null; end $$;

-- Helpers (definer: avoids recursive RLS on junte_member)
create or replace function carguy_private.is_junte_member(j uuid, u uuid default null)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from carguy.junte_member m
                 where m.junte_id = j and m.user_id = coalesce(u, (select auth.uid()))
                   and m.status in ('invited','going','live','done'));
$$;
create or replace function carguy_private.junte_live_window(j uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from carguy.junte x where x.id = j
    and x.status not in ('ended','cancelled')
    and now() >= x.starts_at - interval '30 minutes'
    and now() <= least(coalesce(x.ends_at, x.starts_at + interval '6 hours'), x.starts_at + interval '6 hours'));
$$;
create or replace function carguy_private.can_see_junte(j uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from carguy.junte x where x.id = j
    and not carguy_private.is_blocked_pair((select auth.uid()), x.owner_id)
    and ( x.owner_id = (select auth.uid())
       or carguy_private.is_junte_member(x.id)
       or x.visibility = 'public'
       or (x.visibility = 'followers' and carguy_private.is_accepted_follower((select auth.uid()), x.owner_id))));
$$;
grant execute on function carguy_private.is_junte_member(uuid, uuid), carguy_private.junte_live_window(uuid),
  carguy_private.can_see_junte(uuid) to authenticated;

alter table carguy.junte enable row level security;
drop policy if exists junte_select on carguy.junte;
create policy junte_select on carguy.junte for select to authenticated using (carguy_private.can_see_junte(id));
drop policy if exists junte_insert on carguy.junte;
create policy junte_insert on carguy.junte for insert to authenticated with check (owner_id = (select auth.uid()));
drop policy if exists junte_update on carguy.junte;
create policy junte_update on carguy.junte for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
drop policy if exists junte_delete on carguy.junte;
create policy junte_delete on carguy.junte for delete to authenticated using (owner_id = (select auth.uid()));
grant select, insert, update, delete on carguy.junte to authenticated;
-- NOTE: junte_select exposes `code` to followers/public viewers. For 'followers'/'public' that is fine
-- (they can join anyway). For 'invite' only members/owner pass the policy.

alter table carguy.junte_member enable row level security;
drop policy if exists jm_select on carguy.junte_member;
create policy jm_select on carguy.junte_member for select to authenticated
  using (user_id = (select auth.uid()) or carguy_private.is_junte_member(junte_id)
         or exists (select 1 from carguy.junte x where x.id = junte_id and x.owner_id = (select auth.uid())));
drop policy if exists jm_update_self on carguy.junte_member;
create policy jm_update_self on carguy.junte_member for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists jm_owner_manage on carguy.junte_member;   -- owner invites/removes
create policy jm_owner_manage on carguy.junte_member for all to authenticated
  using (exists (select 1 from carguy.junte x where x.id = junte_id and x.owner_id = (select auth.uid())))
  with check (exists (select 1 from carguy.junte x where x.id = junte_id and x.owner_id = (select auth.uid())));
grant select, insert, delete on carguy.junte_member to authenticated;
grant update (status, vehicle_id, trip_id, trip_share_id, updated_at) on carguy.junte_member to authenticated;
-- column grant stops a member from promoting their own role.

-- Join by code (mirror of the garage-invite RPC)
create or replace function carguy.join_junte(p_code text)
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare me uuid := (select auth.uid()); j carguy.junte;
begin
  if me is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  select * into j from carguy.junte where code = upper(trim(p_code));
  if j.id is null or j.status in ('ended','cancelled') then raise exception 'invalid_code' using errcode = 'P0001'; end if;
  if carguy_private.is_blocked_pair(me, j.owner_id) then raise exception 'invalid_code' using errcode = 'P0001'; end if;
  if (select count(*) from carguy.junte_member where junte_id = j.id and status <> 'left') >= j.max_members then
    raise exception 'junte_full' using errcode = 'P0001';
  end if;
  insert into carguy.junte_member(junte_id, user_id, role, status)
  values (j.id, me, case when j.owner_id = me then 'owner' else 'member' end, 'going')
  on conflict (junte_id, user_id) do update set status = 'going', updated_at = now()
    where carguy.junte_member.status in ('invited','left');
  return j.id;
end $$;
revoke all on function carguy.join_junte(text) from public, anon;
grant execute on function carguy.join_junte(text) to authenticated;

-- Owner auto-membership
create or replace function carguy_private.junte_after_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into carguy.junte_member(junte_id, user_id, role, status) values (new.id, new.owner_id, 'owner', 'going')
  on conflict do nothing;
  return null;
end $$;
drop trigger if exists trg_junte_after_insert on carguy.junte;
create trigger trg_junte_after_insert after insert on carguy.junte
  for each row execute function carguy_private.junte_after_insert();

drop trigger if exists trg_block_after_insert on carguy.block;      -- from section 1
create trigger trg_block_after_insert after insert on carguy.block
  for each row execute function carguy_private.block_after_insert();

-- trip_share read-by-others policy (needs helpers above)
drop policy if exists ts_read_shared on carguy.trip_share;
create policy ts_read_shared on carguy.trip_share for select to authenticated using (
  deleted_at is null
  and not carguy_private.is_blocked_pair((select auth.uid()), owner_id)
  and ( visibility = 'public'
     or (visibility = 'followers' and carguy_private.is_accepted_follower((select auth.uid()), owner_id))
     or (visibility = 'friends'   and carguy_private.is_friend((select auth.uid()), owner_id))
     or (visibility = 'junte' and junte_id is not null and carguy_private.is_junte_member(junte_id))));

-- Album photos linked to a junte (synced columns; also add to SQLite schema)
alter table carguy.album_item add column if not exists junte_id uuid references carguy.junte(id) on delete set null;
alter table carguy.album_item add column if not exists share_to_junte boolean not null default false;
```

### 4.2 The junte page

One RPC `get_junte_page(junte_id)` (security definer, gated by `can_see_junte`) returns: junte header, members (handle, avatar, vehicle name), each member's linked `trip_share.segments` (already trimmed by **that member's** zones, because the member's device produced it), total km = `sum(trip_share.distance_m)`, and `album_item` paths where `junte_id = j and share_to_junte`. Photos are read with signed URLs created in the RPC caller's context. Album storage policies probably restrict reads to the owner, so add a storage policy allowing junte members to read objects whose `album_item.share_to_junte` is true, or proxy them through the Vercel function with the service key (**unverified (from knowledge)** how your current album bucket policies are written; check them).

### 4.3 Realtime authorization policies (`--shared`, they live in schema `realtime`)

```sql
-- ===== SHARED: realtime policies for Car Guy juntes =====
create or replace function carguy_private.junte_id_from_topic(t text)
returns uuid language sql immutable set search_path = '' as $$
  select case when t ~ '^carguy:junte:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(:chat)?$'
              then split_part(t, ':', 3)::uuid end;
$$;
create or replace function carguy_private.can_use_junte_topic(t text, ext text, sending boolean)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((
    select carguy_private.junte_live_window(j)
       and exists (select 1 from carguy.junte_member m
                   where m.junte_id = j and m.user_id = (select auth.uid())
                     and m.status in ('going','live'))
       and (not sending or ext = 'presence' or t like '%:chat'
            or exists (select 1 from carguy.junte_member m
                       where m.junte_id = j and m.user_id = (select auth.uid()) and m.status = 'live'))
    from (select carguy_private.junte_id_from_topic(t) as j) s where s.j is not null), false);
$$;
grant execute on function carguy_private.junte_id_from_topic(text),
  carguy_private.can_use_junte_topic(text, text, boolean) to authenticated;

drop policy if exists "carguy junte receive" on realtime.messages;
create policy "carguy junte receive" on realtime.messages for select to authenticated using (
  (select realtime.topic()) like 'carguy:junte:%'
  and realtime.messages.extension in ('broadcast','presence')
  and carguy_private.can_use_junte_topic((select realtime.topic()), realtime.messages.extension, false));

drop policy if exists "carguy junte send" on realtime.messages;
create policy "carguy junte send" on realtime.messages for insert to authenticated with check (
  (select realtime.topic()) like 'carguy:junte:%'
  and realtime.messages.extension in ('broadcast','presence')
  and carguy_private.can_use_junte_topic((select realtime.topic()), realtime.messages.extension, true));
```

Only members with status `live` may broadcast positions. `going` members may watch and appear in Presence. Chat (`:chat`) is written by the DB (section 5), so clients don't need an insert path there.

---

## 5. Chat in a junte (later stage)

Recommendation: **ship after follows and juntes**, as agreed. Juntes are fully usable without chat (the group already has WhatsApp), and chat is where most moderation work comes from.

- Storage: `junte_message(id uuid, junte_id, sender_id, body text check 1..1000, created_at, deleted_at, deleted_by)`. RLS: select if `is_junte_member(junte_id)` and the sender isn't blocked by the reader. Insert only through an RPC `send_junte_message(junte_id, body)` (membership check, 20 msgs/min rate limit). The sender soft-deletes their own messages, and the owner can delete any.
- Fan-out: **Broadcast from the database.** An `after insert` trigger calls `realtime.send(payload, 'msg', 'carguy:junte:<id>:chat', true)` (source: Supabase Broadcast docs mention `realtime.send()`; argument order **unverified (from knowledge)**, so check the docs signature). Those broadcasts are kept in `realtime.messages` for 3 days and support **Broadcast Replay** on private channels (up to 25 messages) (source: Broadcast docs). The table stays the source of truth for history. Postgres Changes would also work at 30 users, but it needs the table in the `supabase_realtime` publication, grants on the custom schema, and an RLS check per subscriber (source: Postgres Changes docs). Broadcast reuses the junte channel authorization you already have.
- Block handling: the client filters messages from users it blocked (it knows its own block list). The RPC refuses sends from a user blocked by the owner (`block_after_insert` already sets them `left`).
- Moderation: "Reportar" on each message → `report` (section 6). The owner deletes. An admin can soft-delete anything.
- Push: `expo-notifications` + Expo push service. This needs a **development/production build, not Expo Go**, a `projectId` passed to `getExpoPushTokenAsync`, an Android notification channel created before asking permission, and **FCM V1 credentials** (Firebase service-account key uploaded to EAS + `googleServicesFile` in `app.json`) (sources: Expo push setup and FCM credentials docs). **Sideloaded APK:** the Expo docs don't mention Play-Store distribution as a requirement. FCM delivery depends on Google Play **services** on the device, not on the app being installed from the Play Store, so an APK outside Play works on normal Android phones and fails on devices without Google services (for example recent Huawei) (**unverified (from knowledge)**). One verified gotcha: if the Firebase API key is restricted, allow the FCM Registration API and Firebase Installations API. **iOS PWA** users get no Expo push. Web Push on installed iOS PWAs (16.4+) is a separate later project (**unverified (from knowledge)**).
- Push triggers to start with: follow request / new follower, junte invite, "junte empieza en 30 min", new chat message (collapsed, max 1 push per junte per 5 min). Store tokens in `push_token(user_id, token, platform, updated_at)` (owner-only RLS) and send from an Edge Function or the Vercel function with the server key.

---

## 6. Abuse basics for a small community

```sql
create table if not exists carguy.report (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  target_type text not null check (target_type in ('profile','vehicle','junte','junte_message','trip_share','album_item')),
  target_id uuid not null,
  reason text not null check (reason in ('spam','harassment','impersonation','inappropriate','dangerous_driving','other')),
  note text check (char_length(note) <= 500),
  status text not null default 'open' check (status in ('open','reviewed','actioned','dismissed')),
  created_at timestamptz not null default now()
);
alter table carguy.report enable row level security;
drop policy if exists report_admin_read on carguy.report;
create policy report_admin_read on carguy.report for select to authenticated using (
  exists (select 1 from carguy.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));
drop policy if exists report_admin_update on carguy.report;
create policy report_admin_update on carguy.report for update to authenticated using (
  exists (select 1 from carguy.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));
grant select, update (status) on carguy.report to authenticated;   -- no insert grant: RPC only

create or replace function carguy.report_content(p_type text, p_target uuid, p_reason text, p_note text default null)
returns void language plpgsql volatile security definer set search_path = '' as $$
declare me uuid := (select auth.uid());
begin
  if me is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if (select count(*) from carguy.report where reporter_id = me and created_at > now() - interval '24 hours') >= 10 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  if exists (select 1 from carguy.report where reporter_id = me and target_type = p_type
             and target_id = p_target and status = 'open') then return; end if;   -- idempotent
  insert into carguy.report(reporter_id, target_type, target_id, reason, note)
  values (me, p_type, p_target, p_reason, left(p_note, 500));
end $$;
revoke all on function carguy.report_content(text, uuid, text, text) from public, anon;
grant execute on function carguy.report_content(text, uuid, text, text) to authenticated;
```

- **Rate limits** follow the `submit_feedback` pattern: a definer RPC counts recent rows for the caller and raises `rate_limited`. `submit_feedback` limits per *device*. Social actions should limit per **user** (`auth.uid()`), because these require login. Limits in this design: follows 100/day (trigger), reports 10/day, junte creation 5/day (add the same count check in a `before insert` trigger on `junte`), chat 20/min, handle change once every 30 days.
- **Handle squatting / impersonation:** reserved list (above). **Pre-claim the owner's handle(s)** (for example his Instagram/TikTok handle) with an admin insert before opening sign-ups. Admins can bypass the reserved check and reassign handles. The Terms must say handles are not property and can be reclaimed for impersonation or after 12 months of inactivity. Optional `verified boolean` on profiles (admin-set) to show a badge on the owner's profile so followers find the real one.
- **Notify admins:** a `pg_net`/Edge Function webhook on new `report` rows is overkill at 30 users. The admin screen lists open reports, and a weekly glance is enough.
- **Terms (they exist; check they cover these):** (1) public-profile content is visible to other users and, if public, on the web at `/u/<handle>`; (2) live location is shared only during a junte, only while "En vivo" is on, only with members, and isn't stored; (3) shared routes are trimmed but the user is responsible for what they share; (4) prohibited: harassment, impersonation, spam, and **organising or promoting illegal street racing or dangerous driving**. Juntes are social drives that obey traffic law, and Car Guy is not responsible for conduct on the road; (5) the right to remove content, reassign handles and suspend accounts; (6) the minimum age your Terms already set. Product note, said plainly: showing other members' **speed** live, or ranking "tires burned", encourages exactly the behaviour item (4) prohibits. Keep `spd` in the payload for the heading arrow and smoothing, but **don't display other people's speed**, and never build a speed leaderboard.

---

## 7. Sync implications (the rule)

**Rule:** a table is **local-first (SQLite + LWW sync)** when every row has a single owner who is the only writer, and the user needs to create or use it offline. A table is **cloud-only** when a row's validity depends on another user's state (their consent, their blocks, membership, a unique code, a quota). Those writes go through RLS/RPC online. The app keeps a **read-only cache** (replaced on fetch, never pushed, no LWW) for offline display.

| Table | Mode | Why |
|---|---|---|
| `privacy_zone` | **Local-first, synced** | Needed offline at share/record time. Single owner. Syncing it keeps zones across reinstalls. Storing home coordinates in the cloud is no worse than the trip polylines already synced, which start at home. Owner-only RLS. |
| `trip_share` | **Local-first, synced** | Created after a drive, often offline. Single owner. Trimming happens locally. LWW is fine. Visibility edits are owner-only. Needs `updated_at`/`deleted_at` per the sync convention. |
| `album_item.junte_id`, `share_to_junte` | Synced (existing table) | Owner's own rows. Add the columns to the SQLite migration. |
| `milestone` (event_type `junte`) | Synced (existing table) | Owner's car history. |
| `profiles` (handle, bio, flags) | Existing profile sync / online edit | Handle change must be online (uniqueness, cooldown). Bio and flags can follow the current profile path. |
| `follow`, `block` | **Cloud-only** + cache | Needs the other side's consent and blocks. Cache: my following/followers/blocked ids for offline UI and client-side chat filtering. |
| `junte`, `junte_member` | **Cloud-only** + cache | Codes, membership, capacity. Cache upcoming juntes I belong to (title, time, meeting point) so the meeting point works offline. |
| `junte_message` | Cloud-only + cache of the last N per junte | Multi-writer. |
| `report`, `push_token`, `reserved_handle` | Cloud-only, no cache | Never needed offline. |
| Live positions | **Never stored** anywhere | Ephemeral Broadcast. Each member's own raw points are still recorded locally as their normal trip. |

Edge case: a member records the drive offline, then shares. The `trip_share` row syncs later, and the `junte_member.trip_share_id` link is a cloud-only RPC call queued until online. Its FK requires the `trip_share` row to have synced first, so order the outbox: synced tables push before queued RPCs.

---

## 8. Applying with `tools/apply-sql.mjs`

Split into files so the additive `carguy` part and the database-wide part are separate. All statements are idempotent (`if not exists`, `create or replace`, `drop policy if exists` + `create policy`, `duplicate_object` guards).

1. **`--shared` file (database-wide, affects the other app's database too):**
   ```sql
   create extension if not exists pg_trgm with schema extensions;
   create extension if not exists unaccent with schema extensions;
   create schema if not exists carguy_private;
   grant usage on schema carguy_private to authenticated, anon;
   ```
   plus **all policies on `realtime.messages`** (section 4.3), which are project-wide and guarded by the `carguy:` topic prefix. `carguy_private` is a new schema outside `carguy`, so treat it as shared if the tool only allows `carguy` writes. Don't add it to the API's exposed schemas.
2. `0xx_social_profiles.sql` (section 1), 3. `0xx_trip_share_privacy_zone.sql` (section 2), 4. `0xx_juntes.sql` (section 4, including the `block` trigger and the `trip_share` read policy), 5. `0xx_reports.sql` (section 6). Chat later.

Order: shared → 1 → 2 → 4 → realtime policies (shared, they need the junte helpers) → 5. If `apply-sql.mjs` runs each file in one transaction, the `do $$ … exception … $$` guards keep re-runs safe.

Pre-flight checks before applying: real names of `profiles.role`, `vehicle` columns (`cover_photo_path`, `public_slug`), `trip.distance_m`, and `album_item`. Whether `carguy` grants are already given by default privileges (if so, the `grant` lines are harmless). In the `profiles_handle_guard` trigger, `OLD` is null on insert. plpgsql allows reading fields of a null record in a trigger, but if it errors, split it into insert and update triggers.

Test plan (minimum): with two test accounts, A follows public B → `accepted`. A follows private C → `pending`, C accepts. C blocks A → follow rows gone and `get_public_profile('c')` returns null for A. Anon `get_public_profile` for a private user returns only the basic fields (and the Vercel page shows the generic page). A non-member subscribing to `carguy:junte:<id>` gets `CHANNEL_ERROR`. A `going` member can't send `pos` while a `live` member can. After `starts_at + 6h` a fresh join is refused.

---

## Sources

Fetched and used:
- Supabase: Realtime Authorization — https://supabase.com/docs/guides/realtime/authorization
- Supabase: Realtime Quotas — https://supabase.com/docs/guides/realtime/quotas
- Supabase: Pricing (Realtime connections and messages) — https://supabase.com/pricing
- Supabase: Broadcast — https://supabase.com/docs/guides/realtime/broadcast
- Supabase: Presence — https://supabase.com/docs/guides/realtime/presence
- Supabase: Postgres Changes — https://supabase.com/docs/guides/realtime/postgres-changes
- Supabase: Postgres Extensions (pg_trgm, unaccent, `extensions` schema) — https://supabase.com/docs/guides/database/extensions
- Supabase: Row Level Security (views and `security_invoker`, security definer, performance) — https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase: Column Level Security — https://supabase.com/docs/guides/database/postgres/column-level-security
- Expo: Push notifications setup — https://docs.expo.dev/push-notifications/push-notifications-setup/
- Expo: FCM V1 credentials — https://docs.expo.dev/push-notifications/fcm-credentials/
- Expo: Location (background updates, web limits) — https://docs.expo.dev/versions/latest/sdk/location/

Marked "unverified (from knowledge)" in the text: the `IMMUTABLE` unaccent wrapper idiom; `realtime.send` argument order; private channels still authorized with "Allow public access" on; FCM working for sideloaded APKs (depends on Google Play services, not the store); battery figures; Screen Wake Lock and Web Push on iOS PWAs; privacy-zone centre offsetting; App Links setup in the current app.
