\set ON_ERROR_STOP 1
-- sql/041: service_record.done_by + carguy.service_media (the photos of a repair, with a role). After scenario.sql:
-- A owns veh_a / sr_a, B is an editor of veh_a (redeemed in section 5b), C is a stranger.
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

select t_as('b');
select t_ok('41e. an editor of the vehicle sees the link', (select count(*) from carguy.service_media where id = 'sm_041_a') = 1);
insert into carguy.service_media (id, service_record_id, media_id, role, sort, created_at, updated_at)
  values ('sm_041_b', 'sr_a', 'm_041_b', 'invoice', 1, now(), now());
select t_ok('41f. an editor can add the invoice', (select count(*) from carguy.service_media where id = 'sm_041_b') = 1);

select t_as('c');
select t_ok('41g. a stranger sees none of it', (select count(*) from carguy.service_media) = 0);
select t_ok('41h. a stranger cannot link a photo to A''s record',
  t_denied($q$insert into carguy.service_media (id, service_record_id, media_id, role, created_at, updated_at) values ('sm_041_c', 'sr_a', 'm', 'other', now(), now())$q$));
select t_ok('41i. anon cannot read the table', t_denied('set local role anon; select 1 from carguy.service_media'));
reset role;
