\set ON_ERROR_STOP 1
-- sql/041: service_record.done_by + carguy.service_media (the photos of a repair, with a role). After scenario.sql and the
-- later ones: A owns veh_a / sr_a; B was removed from veh_a in section 10, so it is re-invited here as an editor;
-- C is a viewer from an earlier scenario and D (a Music Hub-only account) is the stranger.
reset role;
select t_ok('41a. backfill: a record with no contact and no shop is the owner''s own work',
  (select done_by from carguy.service_record where id = 'sr_a') = 'self');
select t_ok('41b. done_by only takes the four values',
  t_denied($q$update carguy.service_record set done_by = 'robot' where id = 'sr_a'$q$));

select t_as('a');
insert into carguy.service_media (id, service_record_id, media_id, role, sort, created_at, updated_at)
  values ('sm_041_a', 'sr_a', 'm_041_a', 'before', 0, now(), now());
select t_ok('41c. the owner links a photo with a role', (select count(*) from carguy.service_media where id = 'sm_041_a') = 1);
select t_ok('41d. an unknown role is refused',
  t_denied($q$insert into carguy.service_media (id, service_record_id, media_id, role, created_at, updated_at) values ('sm_041_bad', 'sr_a', 'm', 'selfie', now(), now())$q$));
select carguy.create_invite('veh_a', 'editor', 'B@example.com') as code41 \gset
reset role;

select t_as('b');
select t_ok('41e0. B (removed earlier) comes back as an editor', (carguy.redeem_invite(:'code41')->>'ok')::boolean);
select t_ok('41e. an editor of the vehicle sees the link', (select count(*) from carguy.service_media where id = 'sm_041_a') = 1);
insert into carguy.service_media (id, service_record_id, media_id, role, sort, created_at, updated_at)
  values ('sm_041_b', 'sr_a', 'm_041_b', 'invoice', 1, now(), now());
select t_ok('41f. an editor can add the invoice', (select count(*) from carguy.service_media where id = 'sm_041_b') = 1);
reset role;

select t_as('a');
select t_ok('41g0. A demotes B to viewer', carguy.set_member_role('veh_a', '00000000-0000-0000-0000-00000000000b', 'viewer'));
reset role;
select t_as('b');
select t_ok('41g. a viewer still sees the links', (select count(*) from carguy.service_media where service_record_id = 'sr_a') = 2);
select t_ok('41h. a viewer cannot add one',
  t_denied($q$insert into carguy.service_media (id, service_record_id, media_id, role, created_at, updated_at) values ('sm_041_v', 'sr_a', 'm', 'other', now(), now())$q$));
reset role;

select t_as('a');
select t_ok('41i. A removes B', carguy.remove_member('veh_a', '00000000-0000-0000-0000-00000000000b'));
reset role;
select t_as('b');
select t_ok('41j. a removed member sees none of it', (select count(*) from carguy.service_media) = 0);
reset role;

select t_as('d');
select t_ok('41k. a stranger (D) sees none of it', (select count(*) from carguy.service_media) = 0);
select t_ok('41l. a stranger cannot link a photo to A''s record',
  t_denied($q$insert into carguy.service_media (id, service_record_id, media_id, role, created_at, updated_at) values ('sm_041_c', 'sr_a', 'm', 'other', now(), now())$q$));
reset role;
select t_as('anon');
select t_ok('41m. anon cannot read the table', t_denied('select 1 from carguy.service_media'));
reset role;
