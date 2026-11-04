\set ON_ERROR_STOP 1
-- sql/043 (IMP 03112026 Phase 4): carguy.ai_insights. After scenario_042 and before scenario_028 (which deletes A).
-- A owns veh_a; B is re-invited as a viewer for the garage-member checks; D (a Music Hub-only account) is the stranger.
reset role;
select t_as('a');
select carguy.create_invite('veh_a', 'viewer', 'B@example.com') as code43 \gset
insert into carguy.ai_insights (vehicle_id, kind, input_hash, payload)
  values ('veh_a', 'obd', 'hash-p0420-aaaa1111', '{"can_drive":"yes","causes":[{"title":"Catalizador"}]}'::jsonb);
select t_ok('43a. the owner stores an OBD explanation for their car',
  (select count(*) from carguy.ai_insights where vehicle_id = 'veh_a' and kind = 'obd') = 1);
select t_ok('43b. user_id defaults to the caller',
  (select user_id from carguy.ai_insights where input_hash = 'hash-p0420-aaaa1111') = '00000000-0000-0000-0000-00000000000a');
select t_ok('43c. the same key is one row (upsert, not a second charge)',
  t_denied($q$insert into carguy.ai_insights (vehicle_id, kind, input_hash, payload) values ('veh_a', 'obd', 'hash-p0420-aaaa1111', '{}'::jsonb)$q$));
insert into carguy.ai_insights (vehicle_id, kind, input_hash, payload)
  values ('veh_a', 'obd', 'hash-p0420-aaaa1111', '{"can_drive":"careful"}'::jsonb)
  on conflict (user_id, vehicle_id, kind, input_hash) do update set payload = excluded.payload;
select t_ok('43d. a Refresh replaces the payload in place',
  (select count(*) from carguy.ai_insights where input_hash = 'hash-p0420-aaaa1111') = 1
  and (select payload ->> 'can_drive' from carguy.ai_insights where input_hash = 'hash-p0420-aaaa1111') = 'careful');
select t_ok('43e. an unknown kind is refused',
  t_denied($q$insert into carguy.ai_insights (vehicle_id, kind, input_hash, payload) values ('veh_a', 'chat', 'hash-zzzzzzzz', '{}'::jsonb)$q$));
select t_ok('43f. an unknown status is refused',
  t_denied($q$update carguy.ai_insights set status = 'banana' where input_hash = 'hash-p0420-aaaa1111'$q$));
select t_ok('43g. a payload over 32 KB is refused',
  t_denied($q$insert into carguy.ai_insights (vehicle_id, kind, input_hash, payload) values ('veh_a', 'obd', 'hash-big-00000001', jsonb_build_object('x', repeat('a', 40000)))$q$));
update carguy.ai_insights set status = 'dismissed' where input_hash = 'hash-p0420-aaaa1111';
select t_ok('43h. a dismissal is stored', (select status from carguy.ai_insights where input_hash = 'hash-p0420-aaaa1111') = 'dismissed');
-- a row never moves to another car or another key
update carguy.ai_insights set vehicle_id = 'veh_b', kind = 'insight', input_hash = 'hash-moved-0000' where input_hash = 'hash-p0420-aaaa1111';
select t_ok('43i. vehicle, kind and key are immutable (the trigger keeps them)',
  (select count(*) from carguy.ai_insights where vehicle_id = 'veh_a' and kind = 'obd' and input_hash = 'hash-p0420-aaaa1111') = 1);
reset role;

select t_as('b');
select t_ok('43j0. B joins the garage as a viewer', (carguy.redeem_invite(:'code43')->>'ok')::boolean);
select t_ok('43j. a garage member (viewer) can read the car''s explanations',
  (select count(*) from carguy.ai_insights where vehicle_id = 'veh_a') = 1);
select t_ok('43k. a viewer cannot write one for that car',
  t_denied($q$insert into carguy.ai_insights (vehicle_id, kind, input_hash, payload) values ('veh_a', 'obd', 'hash-viewer-00001', '{}'::jsonb)$q$));
update carguy.ai_insights set status = 'done' where vehicle_id = 'veh_a';
delete from carguy.ai_insights where vehicle_id = 'veh_a';
select t_ok('43m. B cannot write a row in A''s name',
  t_denied($q$insert into carguy.ai_insights (user_id, vehicle_id, kind, input_hash, payload) values ('00000000-0000-0000-0000-00000000000a', 'veh_a', 'obd', 'hash-forged-0001', '{}'::jsonb)$q$));
reset role;
select t_ok('43l. a viewer cannot change or delete the owner''s row (still there, still dismissed)',
  (select count(*) from carguy.ai_insights where input_hash = 'hash-p0420-aaaa1111' and status = 'dismissed') = 1);

select t_as('a');
select carguy.remove_member('veh_a', '00000000-0000-0000-0000-00000000000b') as removed43 \gset
reset role;
select t_as('b');
select t_ok('43n. once removed from the garage, B no longer sees it', (select count(*) from carguy.ai_insights where vehicle_id = 'veh_a') = 0);
reset role;

select t_as('d');
select t_ok('43o. a Music Hub-only account sees nothing and cannot write',
  (select count(*) from carguy.ai_insights) = 0
  and t_denied($q$insert into carguy.ai_insights (vehicle_id, kind, input_hash, payload) values ('veh_a', 'obd', 'hash-stranger-001', '{}'::jsonb)$q$));
reset role;
select t_as('anon');
select t_ok('43p. anon cannot read the table', t_denied('select 1 from carguy.ai_insights'));
reset role;

select t_as('a');
delete from carguy.ai_insights where vehicle_id = 'veh_a';
select t_ok('43q. the owner can delete their own rows', (select count(*) from carguy.ai_insights where vehicle_id = 'veh_a') = 0);
reset role;
