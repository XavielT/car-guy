\set ON_ERROR_STOP 1
create or replace function public.t_as(u text) returns void language plpgsql as $$
begin
  if u = 'anon' then
    perform set_config('request.jwt.claims', '{"role":"anon"}', false); execute 'set role anon';
  else
    perform set_config('request.jwt.claims', json_build_object('sub', ('00000000-0000-0000-0000-00000000000' || u), 'role', 'authenticated')::text, false);
    execute 'set role authenticated';
  end if;
end $$;
create or replace function public.t_ok(name text, cond boolean, detail text default '') returns void language plpgsql as $$
begin
  if cond then raise notice 'PASS  %', name; else raise notice 'FAIL  % %', name, detail; end if;
end $$;
-- denied(sql) = true when running it raises (RLS / permission / explicit)
create or replace function public.t_denied(q text) returns boolean language plpgsql as $$
begin execute q; return false; exception when others then return true; end $$;
grant execute on function public.t_as(text), public.t_ok(text, boolean, text), public.t_denied(text) to anon, authenticated;

-- 1 anon
select t_as('anon');
select t_ok('1. anon: unknown slug → null', carguy.public_dossier('zzzzzzzz') is null);
select t_ok('1b. anon: vehicle table denied', t_denied('select 1 from carguy.vehicle'));
reset role;

-- 2 publish
select t_as('a');
insert into carguy.vehicle_share (id, vehicle_id, slug, visibility, published_at, show_costs, created_at, updated_at)
  values ('share_veh_a', 'veh_a', 'ae85hchg', 'link', now(), false, now(), now());
reset role;
select t_as('anon');
select t_ok('2. anon: published share renders, VIN masked, no costs',
  (carguy.public_dossier('ae85hchg')->'vehicle'->>'name') = 'Trueno AE85'
  and (carguy.public_dossier('ae85hchg')->'vehicle'->>'vin') = 'JT2••••'
  and carguy.public_dossier('ae85hchg')::text not like '%14500%'
  and carguy.public_dossier('ae85hchg')::text not like '%A700001%',
  carguy.public_dossier('ae85hchg')::text);
reset role;

select t_as('a');
update carguy.track_event set layout = 'Completo' where id = 'ev_a';
reset role;
select t_as('anon');
select t_ok('2b. the page carries each event''s layout (017)', (carguy.public_dossier('ae85hchg')->'track'->0->>'layout') = 'Completo', carguy.public_dossier('ae85hchg')->>'track');
reset role;

-- 3/4 B outsider
select t_as('b');
select t_ok('3. B cannot publish A''s car', t_denied($q$insert into carguy.vehicle_share (id, vehicle_id, slug, visibility, published_at, created_at, updated_at) values ('share_b', 'veh_a', 'bbbbbbbb', 'link', now(), now(), now())$q$));
select t_ok('4. B sees nothing of A (vehicle, mod, session, media)',
  (select count(*) from carguy.vehicle where id = 'veh_a') = 0 and (select count(*) from carguy.mod) = 0
  and (select count(*) from carguy.track_session) = 0 and (select count(*) from carguy.media) = 0);
select t_ok('4b. B cannot invite to A''s car', t_denied($q$select carguy.create_invite('veh_a', 'editor', null)$q$));
select t_ok('4c. B cannot write vehicle_member', t_denied($q$insert into carguy.vehicle_member (vehicle_id, user_id, role) values ('veh_a', '00000000-0000-0000-0000-00000000000b', 'owner')$q$));
select t_ok('4d. B cannot read A''s old-layout photo object', (select count(*) from storage.objects where bucket_id = 'carguy-media' and name like '%/m_a.jpg') = 0);
select t_ok('4b2. B cannot promote itself', t_denied($q$select carguy.set_member_role('veh_a', '00000000-0000-0000-0000-00000000000b', 'editor')$q$));
reset role;

-- 5 invite
select t_as('a');
select carguy.create_invite('veh_a', 'editor', 'B@example.com') as code \gset
reset role;
select t_as('c');
select t_ok('5. C cannot redeem an invite locked to B''s email', (carguy.redeem_invite(:'code')->>'reason') = 'email');
reset role;
select t_as('b');
select t_ok('5b. B redeems', (carguy.redeem_invite(:'code')->>'ok')::boolean);
select t_ok('5c. the code is single use', (carguy.redeem_invite(:'code')->>'reason') = 'used');

-- 6 member reads
select t_ok('6. B sees the car, mod, session (via event), media, and the old-layout object',
  (select count(*) from carguy.vehicle where id = 'veh_a') = 1 and (select count(*) from carguy.mod) = 1
  and (select count(*) from carguy.track_session) = 1 and (select count(*) from carguy.media where id = 'm_a') = 1
  and (select count(*) from storage.objects where name like '%/m_a.jpg') = 1);
select t_ok('6b. B still cannot see A''s contacts (own rows)', (select count(*) from carguy.contact) = 0);
select t_ok('6c. B reads the venue and category the shared car uses, not A''s other venues (015)',
  (select count(*) from carguy.venue where id = 'ven_a') = 1 and (select count(*) from carguy.venue where id = 'ven_private') = 0
  and (select count(*) from carguy.mod_category where id = 'cat_a') = 1);
select t_ok('6e. B reads the service type and check template the car uses, not A''s others (016)',
  (select count(*) from carguy.service_type where id = 'st_turbo') = 1 and (select count(*) from carguy.service_type where id = 'st_private') = 0
  and (select count(*) from carguy.inspection_template where id = 'tpl_a') = 1 and (select count(*) from carguy.inspection_template where id = 'tpl_private') = 0);
select t_ok('6f. seeded rows are never pulled from the owner (B keeps its own)',
  (select count(*) from carguy.service_type where user_id = '00000000-0000-0000-0000-00000000000a' and is_seeded) = 0);
select t_ok('6d. B cannot rename A''s venue', t_denied($q$do $d$ begin update carguy.venue set name = 'x' where id = 'ven_a'; if not found then raise exception 'no rows'; end if; end $d$$q$));

-- 7 editor writes
insert into carguy.mod (id, vehicle_id, category_id, name, created_at, updated_at) values ('mod_b', 'veh_a', 'motor', 'Hecho por B', now(), now());
insert into carguy.vehicle (id, user_id, name, default_fuel_type, notes, created_at, updated_at, updated_by)
  values ('veh_a', '00000000-0000-0000-0000-00000000000b', 'Trueno AE85', 'premium', 'editado por B', now(), now(), '00000000-0000-0000-0000-00000000000b')
  on conflict (id) do update set user_id = excluded.user_id, notes = excluded.notes, updated_at = excluded.updated_at, updated_by = excluded.updated_by;
insert into carguy.track_session (id, event_id, seq, user_id, created_at, updated_at) values ('s_a', 'ev_a', 1, '00000000-0000-0000-0000-00000000000b', now(), now())
  on conflict (id) do update set user_id = excluded.user_id, laps = 3;
select t_ok('7. editor cannot delete the car', t_denied($q$do $d$ begin delete from carguy.vehicle where id = 'veh_a'; if not found then raise exception 'nothing deleted'; end if; end $d$$q$));
insert into storage.objects (bucket_id, name, owner, owner_id, metadata) values ('carguy-media', 'v/veh_a/x.jpg', '00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b', '{"size": 500}');
select t_ok('7b. B cannot write into A''s old folder', t_denied($q$insert into storage.objects (bucket_id, name, metadata) values ('carguy-media', '00000000-0000-0000-0000-00000000000a/y.jpg', '{"size":1}')$q$));
reset role;

select t_as('a');
select t_ok('8. A sees B''s mod; the car and session stay A''s (keep_creator); notes/laps edited',
  (select count(*) from carguy.mod where id = 'mod_b') = 1
  and (select user_id from carguy.vehicle where id = 'veh_a') = '00000000-0000-0000-0000-00000000000a'
  and (select notes from carguy.vehicle where id = 'veh_a') = 'editado por B'
  and (select user_id from carguy.track_session where id = 's_a') = '00000000-0000-0000-0000-00000000000a'
  and (select laps from carguy.track_session where id = 's_a') = 3
  and (select user_id from carguy.mod where id = 'mod_b') = '00000000-0000-0000-0000-00000000000b');
select t_ok('8b. A reads B''s upload under v/veh_a/', (select count(*) from storage.objects where name = 'v/veh_a/x.jpg') = 1);
select t_ok('8c. quota: A is charged its old folder + its car''s v/ folder (1000 + 500)', carguy.storage_usage_bytes() = 1500, carguy.storage_usage_bytes()::text);
select t_ok('8d. A still cannot see B''s own car', (select count(*) from carguy.vehicle where id = 'veh_b') = 0);
select t_ok('9. A demotes B to viewer', carguy.set_member_role('veh_a', '00000000-0000-0000-0000-00000000000b', 'viewer'));
reset role;

select t_as('b');
select t_ok('9b. viewer B reads both mods', (select count(*) from carguy.mod where vehicle_id = 'veh_a') = 2);
select t_ok('9c. viewer B cannot insert', t_denied($q$insert into carguy.mod (id, vehicle_id, category_id, name, created_at, updated_at) values ('mod_v', 'veh_a', 'motor', 'no', now(), now())$q$));
select t_ok('9d. viewer B cannot update (even its own mod)', t_denied($q$do $d$ begin update carguy.mod set name = 'x' where id = 'mod_b'; if not found then raise exception 'no rows'; end if; end $d$$q$));
select t_ok('9e. viewer B cannot upload under v/veh_a/', t_denied($q$insert into storage.objects (bucket_id, name, metadata) values ('carguy-media', 'v/veh_a/z.jpg', '{"size":1}')$q$));
reset role;

select t_as('a');
select t_ok('10. A removes B', carguy.remove_member('veh_a', '00000000-0000-0000-0000-00000000000b'));
reset role;
select t_as('b');
select t_ok('10b. B sees nothing of the car, not even its own mod on it',
  (select count(*) from carguy.vehicle where id = 'veh_a') = 0 and (select count(*) from carguy.mod where vehicle_id = 'veh_a') = 0);
select t_ok('10c. B pulls its ended membership (how the device learns)',
  (select deleted_at is not null from carguy.vehicle_member where vehicle_id = 'veh_a' and user_id = '00000000-0000-0000-0000-00000000000b'));
select t_ok('10d. B''s push of the car is refused', t_denied($q$insert into carguy.vehicle (id, user_id, name, default_fuel_type, created_at, updated_at) values ('veh_a', '00000000-0000-0000-0000-00000000000b', 'x', 'regular', now(), now()) on conflict (id) do update set name = excluded.name$q$));
select t_ok('10e. B keeps its own car', (select count(*) from carguy.vehicle where id = 'veh_b') = 1);
select t_ok('10h. removed: the service type and template are gone too', (select count(*) from carguy.service_type where id = 'st_turbo') = 0 and (select count(*) from carguy.inspection_template where id = 'tpl_a') = 0);
select t_ok('10g. removed: the shared car''s venue and category are gone too', (select count(*) from carguy.venue where id = 'ven_a') = 0 and (select count(*) from carguy.mod_category where id = 'cat_a') = 0);
select t_ok('10f. a new car of B''s gets B as owner', (select count(*) from carguy.vehicle_member where vehicle_id = 'veh_b' and role = 'owner') = 1);
reset role;

select t_as('a');
update carguy.vehicle_share set revoked_at = now(), slug = null where id = 'share_veh_a';
reset role;
select t_as('anon');
select t_ok('11. revoked → null', carguy.public_dossier('ae85hchg') is null);
reset role;

-- 12 an x-core account made in another app (Music Hub) gets nothing (sql/018)
-- A Music Hub bucket stand-in, so the storage check can show it is left alone.
create policy mh_test_all on storage.objects for all to authenticated using (bucket_id = 'mh-test') with check (bucket_id = 'mh-test');
select t_as('d');
select t_ok('12a. other-app account: is_app_user() is false', not carguy.is_app_user());
select t_ok('12b. other-app account: cannot create its own Car Guy profile', t_denied($q$insert into carguy.profiles (user_id) values ('00000000-0000-0000-0000-00000000000d')$q$));
select t_ok('12c. other-app account: cannot push a vehicle', t_denied($q$insert into carguy.vehicle (id, user_id, name, default_fuel_type, created_at, updated_at) values ('veh_d', '00000000-0000-0000-0000-00000000000d', 'x', 'regular', now(), now())$q$));
select t_ok('12d. other-app account: reads no Car Guy rows', (select count(*) from carguy.vehicle) = 0 and (select count(*) from carguy.service_type) = 0 and (select count(*) from carguy.profiles) = 0);
select t_ok('12e. other-app account: cannot redeem an invite', t_denied($q$select carguy.redeem_invite('whatever')$q$));
select t_ok('12f. other-app account: cannot upload to carguy-media', t_denied($q$insert into storage.objects (bucket_id, name, owner) values ('carguy-media', '00000000-0000-0000-0000-00000000000d/x.jpg', '00000000-0000-0000-0000-00000000000d')$q$));
select t_ok('12g. other-app account: its own app''s bucket still works', not t_denied($q$insert into storage.objects (bucket_id, name, owner) values ('mh-test', 'd/x.jpg', '00000000-0000-0000-0000-00000000000d')$q$));
reset role;
select t_as('a');
select t_ok('12h. Car Guy account: is_app_user() is true, still sees its car', carguy.is_app_user() and (select count(*) from carguy.vehicle where id = 'veh_a') = 1);
reset role;

-- 13 trips (sql/019 + 020): the track_event shape, plus Car Guy-only
select t_as('a');
insert into carguy.trip (id, vehicle_id, source, status, started_at, created_at, updated_at, distance_m)
  values ('trip_a', 'veh_a', 'manual', 'done', now(), now(), now(), 12400);
select t_ok('13a. owner reads, updates and deletes its trip',
  (select count(*) from carguy.trip where id = 'trip_a') = 1
  and not t_denied($q$update carguy.trip set notes = 'x' where id = 'trip_a'$q$));
select carguy.create_invite('veh_a', 'editor', 'c@example.com') as code_c \gset
reset role;
select t_as('c');
select t_ok('13b. C redeems as editor', (carguy.redeem_invite(:'code_c')->>'ok')::boolean);
select t_ok('13c. editor member sees the trip and can add one on the shared car',
  (select count(*) from carguy.trip where vehicle_id = 'veh_a') = 1
  and not t_denied($q$insert into carguy.trip (id, vehicle_id, source, status, started_at, created_at, updated_at) values ('trip_c', 'veh_a', 'auto', 'done', now(), now(), now())$q$));
reset role;
select t_as('a');
select t_ok('13d. A demotes C to viewer', carguy.set_member_role('veh_a', '00000000-0000-0000-0000-00000000000c', 'viewer'));
reset role;
select t_as('c');
select t_ok('13e. viewer reads trips but cannot insert one',
  (select count(*) from carguy.trip where vehicle_id = 'veh_a') = 2
  and t_denied($q$insert into carguy.trip (id, vehicle_id, source, status, started_at, created_at, updated_at) values ('trip_v', 'veh_a', 'auto', 'done', now(), now(), now())$q$));
reset role;
select t_as('b');
select t_ok('13f. outsider (removed member) sees no trips', (select count(*) from carguy.trip) = 0);
reset role;
select t_as('d');
select t_ok('13g. other-app account sees and writes no trips',
  (select count(*) from carguy.trip) = 0
  and t_denied($q$insert into carguy.trip (id, vehicle_id, source, status, started_at, created_at, updated_at) values ('trip_d', 'veh_d', 'auto', 'done', now(), now(), now())$q$));
reset role;
select t_as('a');
update carguy.vehicle_share set revoked_at = null, slug = 'ae85hchg', published_at = now() where id = 'share_veh_a';
reset role;
select t_as('anon');
select t_ok('13h. the public dossier renders and has no trips', carguy.public_dossier('ae85hchg') is not null and carguy.public_dossier('ae85hchg')::text not like '%trip%');
select t_ok('13i. anon cannot read trips', t_denied('select 1 from carguy.trip'));
reset role;
