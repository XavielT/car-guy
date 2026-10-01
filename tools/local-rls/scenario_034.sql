\set ON_ERROR_STOP 1
-- sql/034: profiles, follows, blocks, shared trips (ADR-54…56). After scenario.sql: A (veh_a, plate A700001) and B and C
-- are Car Guy accounts; D is Music Hub only; E is the admin.
reset role;
update carguy.trip_share set deleted_at = now() where user_id = '00000000-0000-0000-0000-00000000000a';

select t_as('a');
select t_ok('34a. A sets a handle and a bio on its own profile',
  t_rows($q$update carguy.profiles set handle = 'trueno_ae85', bio = 'Montaña los domingos', is_public = true, show_stats = true
            where user_id = auth.uid()$q$) = 1);
select t_as('b');
select t_ok('34b. a reserved handle is refused', t_raises($q$update carguy.profiles set handle = 'admin' where user_id = auth.uid()$q$, '%handle_reserved%'));
select t_ok('34c. a malformed handle is refused (uppercase / spaces)', t_denied($q$update carguy.profiles set handle = 'Amigo Prueba' where user_id = auth.uid()$q$));
select t_ok('34d. B: private account, its own handle',
  t_rows($q$update carguy.profiles set handle = 'amigo_prueba', display_name = 'Amigo de Prueba', bio = 'secreto', is_public = false
            where user_id = auth.uid()$q$) = 1);
select t_as('c');
select t_ok('34e. the same handle twice is refused', t_denied($q$update carguy.profiles set handle = 'trueno_ae85' where user_id = auth.uid()$q$));
update carguy.profiles set handle = 'tercero' where user_id = auth.uid();

select t_as('anon');
select t_ok('34f. anon reads a public card + bio, never an id or the plate',
  (carguy.get_public_profile('trueno_ae85')->>'bio') = 'Montaña los domingos'
  and carguy.get_public_profile('trueno_ae85')::text not like '%00000000-0000-0000-0000-00000000000a%'
  and carguy.get_public_profile('trueno_ae85')::text not like '%A700001%'
  and (carguy.get_public_profile('trueno_ae85')->'cars'->0->>'name') = 'Trueno AE85');
select t_ok('34g. anon sees a private account as a card only (no bio, no cars)',
  (carguy.get_public_profile('amigo_prueba')->>'can_see') = 'false'
  and carguy.get_public_profile('amigo_prueba')->>'bio' is null and carguy.get_public_profile('amigo_prueba')->'cars' is null);
select t_ok('34h. anon cannot read profiles rows', t_denied($q$select * from carguy.profiles$q$));
select t_ok('34i. anon cannot search', t_denied($q$select * from carguy.search_profiles('tru')$q$));

select t_as('a');
select t_ok('34j. A → private B: a request', carguy.follow_user('amigo_prueba') = 'requested');
select t_ok('34k. search folds accents and never lists me ("amígo" finds B; "tru" not A to itself)',
  exists (select 1 from carguy.search_profiles('amígo') where handle = 'amigo_prueba')
  and not exists (select 1 from carguy.search_profiles('tru') where handle = 'trueno_ae85'));
select t_as('b');
select t_ok('34l. B → public A: accepted at once', carguy.follow_user('trueno_ae85') = 'accepted');
select t_ok('34m. B sees the request and accepts it', (carguy.my_social()->'requests'->0->>'handle') = 'trueno_ae85' and carguy.accept_follow('trueno_ae85'));
select t_as('a');
select t_ok('34n. mutual → friends; now A sees B''s bio', (carguy.my_social()->>'friends')::int = 1
  and (carguy.get_public_profile('amigo_prueba')->>'bio') = 'secreto');
select t_as('c');
select t_ok('34o. C sees none of A''s and B''s follow rows', (select count(*) from carguy.follow) = 0);
select t_ok('34p. no direct writes to follow (only the RPCs)',
  t_denied($q$insert into carguy.follow (follower_id, followee_id) values (auth.uid(), '00000000-0000-0000-0000-00000000000a')$q$));
select t_ok('34q. C cannot read A''s profile row', not exists (select 1 from carguy.profiles where user_id = '00000000-0000-0000-0000-00000000000a'));
select t_ok('34r. C cannot force a status: follow_user decides', carguy.follow_user('trueno_ae85') = 'accepted');

-- shared trips: one of each visibility for A
select t_as('a');
insert into carguy.trip_share (id, trip_id, visibility, polyline_trimmed, distance_m, created_at, updated_at) values
  ('ts_pub', 't1', 'public', 'abc', 4000, now(), now()),
  ('ts_fol', 't2', 'followers', 'def', 5000, now(), now()),
  ('ts_fri', 't3', 'friends', 'ghi', 6000, now(), now());
select t_ok('34s. A (owner) lists all three', jsonb_array_length(carguy.list_trip_shares('trueno_ae85')) = 3);
select t_as('c');
select t_ok('34t. C (a follower, not a friend): public + followers', jsonb_array_length(carguy.list_trip_shares('trueno_ae85')) = 2
  and carguy.list_trip_shares('trueno_ae85')::text not like '%ghi%');
select t_ok('34u. C cannot read A''s trip_share rows directly', not exists (select 1 from carguy.trip_share where user_id = '00000000-0000-0000-0000-00000000000a'));
select t_as('b');
select t_ok('34v. B (a friend): all three', jsonb_array_length(carguy.list_trip_shares('trueno_ae85')) = 3);
select t_as('anon');
select t_ok('34w. anon: public only', jsonb_array_length(carguy.list_trip_shares('trueno_ae85')) = 1);

-- block
select t_as('b');
select carguy.block_user('trueno_ae85');
select t_ok('34x. block removes the follows both ways', (carguy.my_social()->>'followers')::int = 0 and (carguy.my_social()->>'following')::int = 0);
select t_as('a');
select t_ok('34y. after the block A sees nothing of B: no profile, no search hit, no shares',
  carguy.get_public_profile('amigo_prueba') is null
  and not exists (select 1 from carguy.search_profiles('amigo') where handle = 'amigo_prueba')
  and jsonb_array_length(carguy.list_trip_shares('amigo_prueba')) = 0);
select t_ok('34z. … and A cannot follow B again', t_raises($q$select carguy.follow_user('amigo_prueba')$q$, '%blocked%'));
select t_as('b');
select carguy.unblock_user('trueno_ae85');
select t_ok('34za. unblock: B sees A again', carguy.get_public_profile('trueno_ae85') is not null);

-- privacy zones are the owner's only
select t_as('a');
insert into carguy.privacy_zone (id, label, lat, lng, created_at, updated_at) values ('pz_a', 'Casa', 18.44, -69.95, now(), now());
select t_as('c');
select t_ok('34zb. C cannot read A''s privacy zone', not exists (select 1 from carguy.privacy_zone));
select t_as('d');
select t_ok('34zc. a Music Hub-only account cannot follow (not a Car Guy account)', t_denied($q$select carguy.follow_user('trueno_ae85')$q$));
select t_as('c');
select t_ok('34zd. reports are rate-limited (10/h)', (select count(*) from (select carguy.report_target('profile', 'trueno_ae85', 'x') from generate_series(1, 10)) r) = 10
  and t_raises($q$select carguy.report_target('profile', 'trueno_ae85', 'x')$q$, '%rate_limited%'));
reset role;
