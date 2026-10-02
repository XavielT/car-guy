\set ON_ERROR_STOP 1
-- sql/037: handle check, follow lists, public photo copy, admin reports. After scenario_035: handles trueno_ae85 (A,
-- public), amigo_prueba (B, private), tercero (C); D is Music Hub only; E is the admin.
reset role;
delete from carguy.follow where (follower_id, followee_id) in (
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b'),
  ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000a'));

select t_as('a');
select t_ok('37a. handle check: mine / taken / free / reserved / format',
  carguy.is_handle_free('trueno_ae85') = 'mine' and carguy.is_handle_free('amigo_prueba') = 'taken'
  and carguy.is_handle_free('nadie_aun') = 'free' and carguy.is_handle_free('admin') = 'reserved'
  and carguy.is_handle_free('Con Espacio') = 'format');
select t_as('anon');
select t_ok('37b. anon cannot probe handles', t_raises($q$select carguy.is_handle_free('trueno_ae85')$q$, '%'));

select t_as('a');
select carguy.follow_user('amigo_prueba');
select t_ok('37c. A → private B: listed as a sent request, not as following',
  jsonb_array_length(carguy.list_follows('requests_sent')) = 1 and (carguy.list_follows('requests_sent')->0->>'handle') = 'amigo_prueba'
  and not exists (select 1 from jsonb_array_elements(carguy.list_follows('following')) e where e->>'handle' = 'amigo_prueba'));
select t_as('b');
select carguy.accept_follow('trueno_ae85');
select carguy.follow_user('trueno_ae85');
select t_ok('37d. both ways accepted → friends on both sides, by handle, never an id',
  exists (select 1 from jsonb_array_elements(carguy.list_follows('friends')) e where e->>'handle' = 'trueno_ae85')
  and carguy.list_follows('friends')::text not like '%00000000-0000-0000-0000-00000000000%');
select t_as('a');
select t_ok('37e. A sees B among friends, followers and following',
  exists (select 1 from jsonb_array_elements(carguy.list_follows('friends')) e where e->>'handle' = 'amigo_prueba')
  and exists (select 1 from jsonb_array_elements(carguy.list_follows('followers')) e where e->>'handle' = 'amigo_prueba')
  and exists (select 1 from jsonb_array_elements(carguy.list_follows('following')) e where e->>'handle' = 'amigo_prueba'));

-- The public photo copy: shown only with photo_public, never the private path.
select t_ok('37f. A stores a small public photo; a bad value is refused',
  t_rows($q$update carguy.profiles set photo_public_jpeg = 'data:image/jpeg;base64,/9j/AA==', photo_public = true,
              avatar_path = '00000000-0000-0000-0000-00000000000a/avatar.jpg' where user_id = auth.uid()$q$) = 1
  and t_denied($q$update carguy.profiles set photo_public_jpeg = 'http://example.com/x.jpg' where user_id = auth.uid()$q$));
select t_as('anon');
select t_ok('37g. anon gets the photo copy, never the private path',
  (carguy.get_public_profile('trueno_ae85')->>'photo') like 'data:image/jpeg;base64,%'
  and carguy.get_public_profile('trueno_ae85')::text not like '%avatar.jpg%');
select t_as('a');
update carguy.profiles set photo_public = false where user_id = auth.uid();
select t_as('anon');
select t_ok('37h. photo_public off → no photo', carguy.get_public_profile('trueno_ae85')->>'photo' is null);

select t_as('a');
select carguy.block_user('amigo_prueba');
select t_ok('37i. a block hides B from all of A''s lists',
  not exists (select 1 from jsonb_array_elements(carguy.list_follows('friends')) e where e->>'handle' = 'amigo_prueba')
  and not exists (select 1 from jsonb_array_elements(carguy.list_follows('followers')) e where e->>'handle' = 'amigo_prueba'));
select carguy.unblock_user('amigo_prueba');

-- Reports
select t_as('b');  -- C used its 10 reports this hour in scenario_034
select carguy.report_target('profile', 'trueno_ae85', 'spam de prueba');
select t_as('c');
select t_ok('37j. a member cannot list or change reports',
  t_raises($q$select carguy.admin_reports()$q$, '%forbidden%')
  and t_raises($q$select carguy.admin_set_report_status(gen_random_uuid(), 'done')$q$, '%forbidden%'));
select t_as('e');
select t_ok('37k. the admin lists reports with the reporter''s handle',
  exists (select 1 from jsonb_array_elements(carguy.admin_reports()) r where r->>'reporter' = 'amigo_prueba' and r->>'reason' = 'spam de prueba'));
select carguy.admin_set_report_status((select (r->>'id')::uuid from jsonb_array_elements(carguy.admin_reports()) r
                                        where r->>'reason' = 'spam de prueba' limit 1), 'done');
select t_ok('37l. … and marks it done',
  exists (select 1 from jsonb_array_elements(carguy.admin_reports()) r where r->>'reason' = 'spam de prueba' and r->>'status' = 'done'));
reset role;

-- sql/038: the invite card behind a code
reset role;
create temp table jc (code text);
grant all on jc to anon, authenticated;
select t_as('a');
insert into jc select carguy.create_junte('Invitación de prueba', now() + interval '1 day')->>'code';
select t_as('anon');
select t_ok('38a. anon reads the invite card by code: title, owner handle, going — no ids, no coordinates',
  (carguy.junte_invite_card((select code from jc))->>'title') = 'Invitación de prueba'
  and (carguy.junte_invite_card((select code from jc))->>'owner_handle') = 'trueno_ae85'
  and (carguy.junte_invite_card((select code from jc))->>'going')::int = 1
  and carguy.junte_invite_card((select code from jc))::text not like '%00000000-0000-0000-0000-0000000000%'
  and carguy.junte_invite_card((select code from jc))::text not like '%meet_lat%');
select t_ok('38b. an unknown or malformed code is null', carguy.junte_invite_card('zzzzzzzz') is null and carguy.junte_invite_card('x'' or 1=1') is null);
reset role;
