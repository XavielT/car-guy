\set ON_ERROR_STOP 1
-- sql/035 + 036: juntes and the Realtime topic policies (ADR-57). After scenario_034: handles trueno_ae85 (A),
-- amigo_prueba (B), tercero (C); D is Music Hub only.
reset role;
create temp table j (n serial, id uuid, code text);  -- n: creation order (uuids are random)
grant all on j to authenticated; grant usage on sequence j_n_seq to authenticated;

select t_as('a');
insert into j (id, code) select (r->>'id')::uuid, r->>'code' from (select carguy.create_junte('Junte de prueba', now() + interval '10 minutes') r) x;
select t_ok('35a. A creates a junte: an id and an 8-char code', (select code ~ '^[a-z0-9]{8}$' from j));
select t_as('c');
select t_ok('35b. C joins by code', carguy.join_junte((select code from j)) = (select id from j));
select t_ok('35c. C reads the detail: members by handle, never an id or a position',
  jsonb_array_length(carguy.junte_detail((select id from j))->'members') = 2
  and carguy.junte_detail((select id from j))::text not like '%00000000-0000-0000-0000-0000000000%'
  and carguy.junte_detail((select id from j))::text not like '%"lat"%');
select t_as('b');
select t_ok('35d. B (not a member) reads nothing', carguy.junte_detail((select id from j)) is null and not exists (select 1 from carguy.junte));
select t_ok('35e. no direct writes to junte_member', t_denied($q$insert into carguy.junte_member (junte_id, user_id) select id, auth.uid() from j$q$));
select t_as('d');
select t_ok('35f. a Music Hub-only account cannot join', t_denied($q$select carguy.join_junte((select code from j))$q$));

-- Realtime: the topic carguy:junte:<id>
select set_config('realtime.topic', 'carguy:junte:' || (select id from j)::text, false);
select t_as('c');
select t_ok('35g. a member inside the live window may send on the junte topic',
  t_rows($q$insert into realtime.messages (topic, extension) values (realtime.topic(), 'broadcast')$q$) = 1);
select t_ok('35h. … and receive on it', exists (select 1 from realtime.messages where topic = realtime.topic()));
select t_as('b');
select t_ok('35i. a non-member may not send', t_denied($q$insert into realtime.messages (topic, extension) values (realtime.topic(), 'broadcast')$q$));
select t_ok('35j. … nor receive', not exists (select 1 from realtime.messages where topic = realtime.topic()));

-- A broad permissive policy like another app might have: the restrictive guard still keeps Car Guy topics closed
-- and leaves every other topic alone.
reset role;
create policy test_other_app_all on realtime.messages for all to authenticated using (true) with check (true);
select t_as('b');
select t_ok('35k. with another app''s open policy, B still cannot use the Car Guy topic',
  t_denied($q$insert into realtime.messages (topic, extension) values (realtime.topic(), 'broadcast')$q$));
select set_config('realtime.topic', 'musichub:room:1', false);
select t_ok('35l. … while that app''s own topic is untouched by the guard',
  t_rows($q$insert into realtime.messages (topic, extension) values (realtime.topic(), 'broadcast')$q$) = 1);
select set_config('realtime.topic', '', false);
select t_ok('35l2. … and so is a row read/written with no topic at all (NULL topic never trips the guard)',
  t_rows($q$insert into realtime.messages (topic, extension) values ('musichub:room:2', 'broadcast')$q$) = 1);
select set_config('realtime.topic', 'carguy:junte:not-a-uuid', false);
select t_ok('35m. a malformed carguy: topic is just refused (no cast error)',
  not carguy.junte_topic_allowed('carguy:junte:not-a-uuid') and t_denied($q$insert into realtime.messages (topic, extension) values (realtime.topic(), 'broadcast')$q$));
reset role;
drop policy test_other_app_all on realtime.messages;

-- Kick: the topic closes for C
select set_config('realtime.topic', 'carguy:junte:' || (select id from j)::text, false);
select t_as('a');
select carguy.kick_junte_member((select id from j), 'tercero');
select t_as('c');
select t_ok('35n. kicked: C can no longer use the topic, nor rejoin',
  not carguy.junte_topic_allowed(realtime.topic()) and t_raises($q$select carguy.join_junte((select code from j))$q$, '%kicked%'));

-- B joins (unblocked again in 034), then the owner ends it: the window closes
select t_as('b');
select carguy.join_junte((select code from j));
select t_ok('35o. B, a member now, may use the topic', carguy.junte_topic_allowed(realtime.topic()));
select t_ok('35p. chat: a member can send (FEATURE_JUNTE_CHAT is off in the app, the RPC exists)', carguy.send_junte_message((select id from j), 'llegando') is not null);
select t_ok('35q. linking someone else''s trip share is refused', t_raises($q$select carguy.link_junte_trip((select id from j), 'ts_pub')$q$, '%not_found%'));
select t_as('a');
select t_ok('35r. the owner cannot leave, only end', t_raises($q$select carguy.set_junte_status((select id from j), 'left')$q$, '%owner_cannot_leave%'));
select carguy.end_junte((select id from j));
select t_as('b');
select t_ok('35s. ended: the topic is closed for everyone', not carguy.junte_topic_allowed(realtime.topic())
  and t_denied($q$insert into realtime.messages (topic, extension) values (realtime.topic(), 'broadcast')$q$));

-- The live window: a junte two days away is not open yet
select t_as('a');
insert into j (id, code) select (r->>'id')::uuid, r->>'code' from (select carguy.create_junte('Más adelante', now() + interval '2 days') r) x;
select t_ok('35t. outside the window (starts in 2 days) even the owner cannot use the topic',
  not carguy.junte_topic_allowed('carguy:junte:' || (select id from j where n = 2)::text));

-- Block: blocking a member removes them from the blocker's open juntes
insert into j (id, code) select (r->>'id')::uuid, r->>'code' from (select carguy.create_junte('Hoy', now() + interval '5 minutes') r) x;
select t_as('b');
select carguy.join_junte((select code from j order by n desc limit 1));
select t_as('a');
select carguy.block_user('amigo_prueba');
select t_as('b');
select t_ok('35u. blocked by the owner: out of the junte',
  carguy.junte_detail((select id from j order by n desc limit 1)) is null);
select t_as('a');
select carguy.unblock_user('amigo_prueba');
select t_as('e');
select t_ok('35v. admin_usage carries the juntes counters', (carguy.admin_usage() ? 'juntes_30d') and (carguy.admin_usage() ? 'db_bytes'));
select t_as('c');
select t_ok('35w. admin_usage is admin only', t_raises($q$select carguy.admin_usage()$q$, '%forbidden%'));
reset role;
