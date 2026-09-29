-- 013_members.sql — the shared garage (IMP 28092026, 02-cloud-v2.md §5, ADR-22).
--
-- The riskiest change of the cycle: every vehicle-scoped policy is swapped from
-- "my rows" to "rows of a vehicle I am a member of". Applied as ONE transaction
-- that ends with a self-check: for every account that owns rows, the rows it can
-- see as itself (set role authenticated + its JWT sub) must equal the rows it
-- owns, table by table. Any mismatch raises and the whole file rolls back.
--
-- Access model — carguy.vehicle_role(v) for the caller:
--   'owner' | 'editor' | 'viewer'  a live vehicle_member row (or the vehicle's creator)
--   'free'                          no vehicle id, or no such vehicle in the cloud yet
--                                   (a child pushed before its parent, a personal shelf)
--   null                            someone else's vehicle, not shared with me
-- can_see(v, row_user) = member of any role, or 'free' and my own row.
-- can_edit(v, row_user) = owner/editor, or 'free' and my own row.
-- Inserts additionally require user_id = auth.uid(): user_id is the creator.
-- A trigger pins user_id on update, so an editor's upsert (which sends its own
-- user_id) never takes a row over; ownership lives in vehicle_member.
--
-- Children without vehicle_id reach it through carguy.vehicle_of(table, id).
-- Per-user catalogues (service_type, inspection_template, inspection_item,
-- mod_category, venue), setting, profiles and contact stay own-rows.
-- vehicle_share: members read it, only the owner writes it.
--
-- --shared: it replaces the carguy-media policies on storage.objects (scoped to
-- that bucket by name) and storage_usage_bytes(). Statements touching storage:
--   drop/create policy carguy_media_own_select|insert|update|delete on storage.objects
--   (renamed carguy_media_member_*), reading storage.objects in storage_usage_bytes()
--
-- Apply: node tools/apply-sql.mjs sql/013_members.sql --shared

begin;

-- ------------------------------------------------------------ columns --

do $$
declare t text;
begin
  foreach t in array array['vehicle', 'vehicle_spec', 'odometer_reading', 'fuel_log', 'service_record',
    'service_record_item', 'part', 'expense', 'reminder', 'inspection', 'inspection_result', 'task',
    'document', 'media']
  loop
    execute format('alter table carguy.%I add column if not exists updated_by uuid', t);
  end loop;
end $$;

create table if not exists carguy.vehicle_invite (
  code        text primary key,
  vehicle_id  text not null,
  role        text not null default 'editor' check (role in ('editor', 'viewer')),
  email       text,
  expires_at  timestamptz not null default now() + interval '7 days',
  created_by  uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  used_by     uuid references auth.users(id) on delete set null,
  used_at     timestamptz
);
create index if not exists vehicle_invite_vehicle on carguy.vehicle_invite (vehicle_id);
create index if not exists vehicle_member_user on carguy.vehicle_member (user_id);

-- ------------------------------------------------------------ helpers --

create or replace function carguy.vehicle_role(v text) returns text
language plpgsql stable security definer set search_path = '' as $$
declare r text; creator uuid;
begin
  if v is null then return 'free'; end if;
  select m.role into r from carguy.vehicle_member m
   where m.vehicle_id = v and m.user_id = (select auth.uid()) and m.deleted_at is null;
  if r is not null then return r; end if;
  select x.user_id into creator from carguy.vehicle x where x.id = v;
  if not found then return 'free'; end if;
  if creator = (select auth.uid()) then return 'owner'; end if;
  return null;
end $$;

create or replace function carguy.is_member(v text, min_role text default 'viewer') returns boolean
language sql stable security definer set search_path = '' as $$
  select case min_role
           when 'owner' then carguy.vehicle_role(v) = 'owner'
           when 'editor' then carguy.vehicle_role(v) in ('owner', 'editor')
           else carguy.vehicle_role(v) in ('owner', 'editor', 'viewer') end;
$$;

create or replace function carguy.can_see(v text, row_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select case carguy.vehicle_role(v)
           when 'owner' then true when 'editor' then true when 'viewer' then true
           when 'free' then row_user = (select auth.uid())
           else false end;
$$;

create or replace function carguy.can_edit(v text, row_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select case carguy.vehicle_role(v)
           when 'owner' then true when 'editor' then true
           when 'free' then row_user = (select auth.uid())
           else false end;
$$;

create or replace function carguy.can_own(v text, row_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select case carguy.vehicle_role(v)
           when 'owner' then true
           when 'free' then row_user = (select auth.uid())
           else false end;
$$;

-- The vehicle a child row belongs to (null when its parent is not in the cloud).
create or replace function carguy.vehicle_of(tbl text, row_id text) returns text
language plpgsql stable security definer set search_path = '' as $$
begin
  if row_id is null then return null; end if;
  case tbl
    when 'vehicle' then return row_id;
    when 'service_record' then return (select vehicle_id from carguy.service_record where id = row_id);
    when 'inspection' then return (select vehicle_id from carguy.inspection where id = row_id);
    when 'inspection_result' then return (select i.vehicle_id from carguy.inspection_result r join carguy.inspection i on i.id = r.inspection_id where r.id = row_id);
    when 'mod' then return (select vehicle_id from carguy.mod where id = row_id);
    when 'track_event' then return (select vehicle_id from carguy.track_event where id = row_id);
    when 'track_session' then return (select e.vehicle_id from carguy.track_session s join carguy.track_event e on e.id = s.event_id where s.id = row_id);
    when 'document' then return (select vehicle_id from carguy.document where id = row_id);
    when 'milestone' then return (select vehicle_id from carguy.milestone where id = row_id);
    when 'torque_spec' then return (select vehicle_id from carguy.torque_spec where id = row_id);
    when 'fluid_guide_item' then return (select vehicle_id from carguy.fluid_guide_item where id = row_id);
    when 'wheel_set' then return (select vehicle_id from carguy.wheel_set where id = row_id);
    when 'spec_snapshot' then return (select vehicle_id from carguy.spec_snapshot where id = row_id);
    when 'fuel_log' then return (select vehicle_id from carguy.fuel_log where id = row_id);
    when 'expense' then return (select vehicle_id from carguy.expense where id = row_id);
    when 'task' then return (select vehicle_id from carguy.task where id = row_id);
    when 'vehicle_ownership' then return (select vehicle_id from carguy.vehicle_ownership where id = row_id);
    when 'inventory_item' then return (select owner_vehicle_id from carguy.inventory_item where id = row_id);
    else return null;
  end case;
end $$;

-- A Storage object of carguy-media the caller may read under the old
-- `<user_id>/…` layout: some media row points at it and its vehicle is shared with me.
create or replace function carguy.can_read_media_object(object_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from carguy.media m
    where (m.remote_path = object_name or m.remote_thumb_path = object_name) and m.deleted_at is null
      and carguy.can_see(carguy.vehicle_of(m.owner_table, m.owner_id), m.user_id));
$$;

do $$
declare f text;
begin
  foreach f in array array['vehicle_role(text)', 'is_member(text, text)', 'can_see(text, uuid)', 'can_edit(text, uuid)',
    'can_own(text, uuid)', 'vehicle_of(text, text)', 'can_read_media_object(text)']
  loop
    execute format('revoke all on function carguy.%s from public', f);
    execute format('grant execute on function carguy.%s to authenticated', f);
  end loop;
end $$;

-- --------------------------------------------------------- the triggers --

create or replace function carguy.keep_creator() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.user_id := old.user_id;
  return new;
end $$;

create or replace function carguy.vehicle_owner_member() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into carguy.vehicle_member (vehicle_id, user_id, role, display_name)
  values (new.id, new.user_id, 'owner', (select u.email from auth.users u where u.id = new.user_id))
  on conflict (vehicle_id, user_id) do nothing;
  return new;
end $$;

drop trigger if exists vehicle_owner_member on carguy.vehicle;
create trigger vehicle_owner_member after insert on carguy.vehicle
  for each row execute function carguy.vehicle_owner_member();

-- Backfill: every existing vehicle gets its creator as owner.
insert into carguy.vehicle_member (vehicle_id, user_id, role, display_name)
select v.id, v.user_id, 'owner', u.email from carguy.vehicle v left join auth.users u on u.id = v.user_id
on conflict (vehicle_id, user_id) do nothing;

-- ------------------------------------------------------ the policy swap --

do $$
declare
  spec record;
  t text;
  v text;
begin
  for spec in
    select * from (values
      ('vehicle', 'id'),
      ('vehicle_spec', 'vehicle_id'), ('odometer_reading', 'vehicle_id'), ('fuel_log', 'vehicle_id'),
      ('service_record', 'vehicle_id'), ('expense', 'vehicle_id'), ('reminder', 'vehicle_id'),
      ('inspection', 'vehicle_id'), ('task', 'vehicle_id'), ('document', 'vehicle_id'),
      ('vehicle_ownership', 'vehicle_id'), ('album_item', 'vehicle_id'), ('milestone', 'vehicle_id'),
      ('mod', 'vehicle_id'), ('vehicle_specsheet', 'vehicle_id'), ('spec_snapshot', 'vehicle_id'),
      ('torque_spec', 'vehicle_id'), ('wishlist_item', 'vehicle_id'), ('wheel_set', 'vehicle_id'),
      ('tire', 'vehicle_id'), ('vehicle_dtc_event', 'vehicle_id'), ('fluid_guide_item', 'vehicle_id'),
      ('track_event', 'vehicle_id'), ('vehicle_share', 'vehicle_id'),
      ('service_record_item', 'carguy.vehicle_of(''service_record'', service_record_id)'),
      ('part', 'carguy.vehicle_of(''service_record'', service_record_id)'),
      ('inspection_result', 'carguy.vehicle_of(''inspection'', inspection_id)'),
      ('mod_media', 'carguy.vehicle_of(''mod'', mod_id)'),
      ('track_session', 'carguy.vehicle_of(''track_event'', event_id)'),
      ('setup_sheet', 'carguy.vehicle_of(''track_session'', session_id)'),
      ('consumable_usage', 'carguy.vehicle_of(''track_event'', event_id)'),
      ('media', 'carguy.vehicle_of(owner_table, owner_id)'),
      ('inventory_item', 'owner_vehicle_id')
    ) as x(tbl, expr)
  loop
    t := spec.tbl;
    v := spec.expr;
    execute format('alter table carguy.%I enable row level security', t);
    execute format('drop policy if exists %I on carguy.%I', t || '_own_select', t);
    execute format('drop policy if exists %I on carguy.%I', t || '_own_insert', t);
    execute format('drop policy if exists %I on carguy.%I', t || '_own_update', t);
    execute format('drop policy if exists %I on carguy.%I', t || '_own_delete', t);
    execute format('drop policy if exists %I on carguy.%I', t || '_member_select', t);
    execute format('drop policy if exists %I on carguy.%I', t || '_member_insert', t);
    execute format('drop policy if exists %I on carguy.%I', t || '_member_update', t);
    execute format('drop policy if exists %I on carguy.%I', t || '_member_delete', t);

    execute format('create policy %I on carguy.%I for select to authenticated using (carguy.can_see(%s, user_id))',
      t || '_member_select', t, v);

    if t = 'vehicle' then
      execute format('create policy %I on carguy.%I for insert to authenticated with check (user_id = (select auth.uid()))', t || '_member_insert', t);
      execute format('create policy %I on carguy.%I for update to authenticated using (carguy.can_edit(id, user_id)) with check (carguy.can_edit(id, user_id))', t || '_member_update', t);
      execute format('create policy %I on carguy.%I for delete to authenticated using (carguy.can_own(id, user_id))', t || '_member_delete', t);
    elsif t = 'vehicle_share' then
      execute format('create policy %I on carguy.%I for insert to authenticated with check (user_id = (select auth.uid()) and carguy.can_own(vehicle_id, user_id))', t || '_member_insert', t);
      execute format('create policy %I on carguy.%I for update to authenticated using (carguy.can_own(vehicle_id, user_id)) with check (carguy.can_own(vehicle_id, user_id))', t || '_member_update', t);
      execute format('create policy %I on carguy.%I for delete to authenticated using (carguy.can_own(vehicle_id, user_id))', t || '_member_delete', t);
    else
      execute format('create policy %I on carguy.%I for insert to authenticated with check (user_id = (select auth.uid()) and carguy.can_edit(%s, user_id))', t || '_member_insert', t, v);
      execute format('create policy %I on carguy.%I for update to authenticated using (carguy.can_edit(%s, user_id)) with check (carguy.can_edit(%s, user_id))', t || '_member_update', t, v, v);
      execute format('create policy %I on carguy.%I for delete to authenticated using (carguy.can_edit(%s, user_id))', t || '_member_delete', t, v);
    end if;

    execute format('drop trigger if exists keep_creator on carguy.%I', t);
    execute format('create trigger keep_creator before update on carguy.%I for each row execute function carguy.keep_creator()', t);
  end loop;
end $$;

-- vehicle_member: I see my memberships (live or ended — that is how a removed
-- device learns it was removed) and the members of vehicles I belong to.
-- Written only by the definer functions below.
drop policy if exists vehicle_member_own_select on carguy.vehicle_member;
drop policy if exists vehicle_member_member_select on carguy.vehicle_member;
create policy vehicle_member_member_select on carguy.vehicle_member for select to authenticated
  using (user_id = (select auth.uid()) or carguy.is_member(vehicle_id));
revoke insert, update, delete on carguy.vehicle_member from authenticated;

alter table carguy.vehicle_invite enable row level security;
drop policy if exists vehicle_invite_owner_select on carguy.vehicle_invite;
create policy vehicle_invite_owner_select on carguy.vehicle_invite for select to authenticated
  using (carguy.is_member(vehicle_id, 'owner'));
revoke insert, update, delete on carguy.vehicle_invite from authenticated;
revoke all on carguy.vehicle_invite from anon;

-- ------------------------------------------------------------- the RPCs --

create or replace function carguy.create_invite(p_vehicle text, p_role text default 'editor', p_email text default null) returns text
language plpgsql volatile security definer set search_path = '' as $$
declare c text; alphabet text := 'abcdefghjkmnpqrstuvwxyz23456789'; i int;
begin
  if not carguy.is_member(p_vehicle, 'owner') then raise exception 'only the owner can invite' using errcode = '42501'; end if;
  if p_role not in ('editor', 'viewer') then raise exception 'bad role' using errcode = '22023'; end if;
  loop
    c := '';
    for i in 1..8 loop c := c || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1); end loop;
    exit when not exists (select 1 from carguy.vehicle_invite where code = c);
  end loop;
  insert into carguy.vehicle_invite (code, vehicle_id, role, email, created_by)
  values (c, p_vehicle, p_role, nullif(lower(trim(p_email)), ''), (select auth.uid()));
  return c;
end $$;

create or replace function carguy.redeem_invite(p_code text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare inv carguy.vehicle_invite%rowtype; me uuid := (select auth.uid()); my_email text;
begin
  if me is null then raise exception 'sign in first' using errcode = '42501'; end if;
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

create or replace function carguy.set_member_role(p_vehicle text, p_user uuid, p_role text) returns boolean
language plpgsql volatile security definer set search_path = '' as $$
begin
  if not carguy.is_member(p_vehicle, 'owner') then raise exception 'only the owner' using errcode = '42501'; end if;
  if p_role not in ('editor', 'viewer') then raise exception 'bad role' using errcode = '22023'; end if;
  update carguy.vehicle_member set role = p_role, updated_at = now()
   where vehicle_id = p_vehicle and user_id = p_user and role <> 'owner' and deleted_at is null;
  return found;
end $$;

-- The owner removes someone; anyone but the owner may remove themselves (leave).
create or replace function carguy.remove_member(p_vehicle text, p_user uuid) returns boolean
language plpgsql volatile security definer set search_path = '' as $$
begin
  if not (carguy.is_member(p_vehicle, 'owner') or p_user = (select auth.uid())) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  update carguy.vehicle_member set deleted_at = now(), updated_at = now()
   where vehicle_id = p_vehicle and user_id = p_user and role <> 'owner' and deleted_at is null;
  return found;
end $$;

do $$
declare f text;
begin
  foreach f in array array['create_invite(text, text, text)', 'redeem_invite(text)', 'set_member_role(text, uuid, text)', 'remove_member(text, uuid)']
  loop
    execute format('revoke all on function carguy.%s from public', f);
    execute format('grant execute on function carguy.%s to authenticated', f);
  end loop;
end $$;

-- ---------------------------------------------------------------- storage --

-- Quota: my own folder, vehicle folders I own, and vehicle folders with no
-- vehicle in the cloud yet that I uploaded (so a made-up folder is not free).
create or replace function carguy.storage_usage_bytes() returns bigint
language sql stable security definer set search_path = '' as $$
  select coalesce(sum((o.metadata->>'size')::bigint), 0)
  from storage.objects o
  where o.bucket_id = 'carguy-media'
    and ((storage.foldername(o.name))[1] = (select auth.uid())::text
      or ((storage.foldername(o.name))[1] = 'v'
          and (carguy.vehicle_role((storage.foldername(o.name))[2]) = 'owner'
               or (carguy.vehicle_role((storage.foldername(o.name))[2]) = 'free'
                   and coalesce(o.owner_id, o.owner::text) = (select auth.uid())::text))));
$$;
revoke all on function carguy.storage_usage_bytes() from public;
grant execute on function carguy.storage_usage_bytes() to authenticated;

drop policy if exists "carguy_media_own_select" on storage.objects;
drop policy if exists "carguy_media_own_insert" on storage.objects;
drop policy if exists "carguy_media_own_update" on storage.objects;
drop policy if exists "carguy_media_own_delete" on storage.objects;
drop policy if exists "carguy_media_member_select" on storage.objects;
drop policy if exists "carguy_media_member_insert" on storage.objects;
drop policy if exists "carguy_media_member_update" on storage.objects;
drop policy if exists "carguy_media_member_delete" on storage.objects;

create policy "carguy_media_member_select" on storage.objects for select to authenticated
  using (bucket_id = 'carguy-media' and (
    (storage.foldername(name))[1] = auth.uid()::text
    or ((storage.foldername(name))[1] = 'v' and carguy.vehicle_role((storage.foldername(name))[2]) in ('owner', 'editor', 'viewer'))
    or carguy.can_read_media_object(name)));

create policy "carguy_media_member_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'carguy-media'
    and ((storage.foldername(name))[1] = auth.uid()::text
      or ((storage.foldername(name))[1] = 'v' and carguy.vehicle_role((storage.foldername(name))[2]) in ('owner', 'editor', 'free')))
    and carguy.storage_usage_bytes() + coalesce((metadata->>'size')::bigint, 0)
      <= coalesce((select p.media_quota_bytes from carguy.profiles p where p.user_id = auth.uid()), 314572800));

create policy "carguy_media_member_update" on storage.objects for update to authenticated
  using (bucket_id = 'carguy-media' and ((storage.foldername(name))[1] = auth.uid()::text
    or ((storage.foldername(name))[1] = 'v' and carguy.vehicle_role((storage.foldername(name))[2]) in ('owner', 'editor', 'free'))))
  with check (bucket_id = 'carguy-media' and ((storage.foldername(name))[1] = auth.uid()::text
    or ((storage.foldername(name))[1] = 'v' and carguy.vehicle_role((storage.foldername(name))[2]) in ('owner', 'editor', 'free'))));

create policy "carguy_media_member_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'carguy-media' and ((storage.foldername(name))[1] = auth.uid()::text
    or ((storage.foldername(name))[1] = 'v' and carguy.vehicle_role((storage.foldername(name))[2]) in ('owner', 'editor', 'free'))));

-- ------------------------------------------------------------ self-check --
-- As each account that owns anything: visible own rows == owned rows, per table.

do $$
declare
  u uuid;
  t text;
  owned bigint;
  seen bigint;
begin
  for u in select distinct user_id from carguy.vehicle
           union select distinct user_id from carguy.fuel_log
           union select distinct user_id from carguy.media
  loop
    foreach t in array array['vehicle', 'vehicle_spec', 'odometer_reading', 'fuel_log', 'service_record',
      'service_record_item', 'part', 'expense', 'reminder', 'inspection', 'inspection_result', 'task',
      'document', 'media', 'vehicle_ownership', 'album_item', 'milestone', 'mod', 'mod_media',
      'vehicle_specsheet', 'spec_snapshot', 'torque_spec', 'wishlist_item', 'inventory_item', 'wheel_set',
      'tire', 'vehicle_dtc_event', 'fluid_guide_item', 'track_event', 'track_session', 'setup_sheet',
      'consumable_usage', 'vehicle_share']
    loop
      execute format('select count(*) from carguy.%I where user_id = $1', t) into owned using u;
      perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
      execute 'set local role authenticated';
      execute format('select count(*) from carguy.%I where user_id = $1', t) into seen using u;
      execute 'reset role';
      if seen <> owned then
        raise exception 'self-check: % sees % of its % rows in %', u, seen, owned, t;
      end if;
    end loop;
  end loop;
  perform set_config('request.jwt.claims', null, true);
end $$;

commit;


-- rollback (back to 003/010 own-rows + 011's storage policies):
--   node tools/apply-sql.mjs sql/003_rls.sql && node tools/apply-sql.mjs sql/010_rls_v2.sql
--   node tools/apply-sql.mjs sql/004_storage.sql --shared && node tools/apply-sql.mjs sql/011_storage_v2.sql --shared
-- then:
-- do $$ declare t text; begin
--   foreach t in array array['vehicle','vehicle_spec','odometer_reading','fuel_log','service_record','expense','reminder',
--     'inspection','task','document','vehicle_ownership','album_item','milestone','mod','vehicle_specsheet','spec_snapshot',
--     'torque_spec','wishlist_item','wheel_set','tire','vehicle_dtc_event','fluid_guide_item','track_event','vehicle_share',
--     'service_record_item','part','inspection_result','mod_media','track_session','setup_sheet','consumable_usage','media','inventory_item']
--   loop
--     execute format('drop policy if exists %I on carguy.%I', t || '_member_select', t);
--     execute format('drop policy if exists %I on carguy.%I', t || '_member_insert', t);
--     execute format('drop policy if exists %I on carguy.%I', t || '_member_update', t);
--     execute format('drop policy if exists %I on carguy.%I', t || '_member_delete', t);
--     execute format('drop trigger if exists keep_creator on carguy.%I', t);
--   end loop; end $$;
-- drop policy if exists "carguy_media_member_select" on storage.objects;   -- and _insert/_update/_delete
-- drop trigger if exists vehicle_owner_member on carguy.vehicle;
-- drop function if exists carguy.redeem_invite(text), carguy.create_invite(text, text, text),
--   carguy.set_member_role(text, uuid, text), carguy.remove_member(text, uuid);
