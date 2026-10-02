\set ON_ERROR_STOP 1
-- sql/039: the junte chat by @handle, push tokens, mute, the service_role push claim. After scenario_037: handles
-- trueno_ae85 (A), amigo_prueba (B), tercero (C); D is Music Hub only.
reset role;
create temp table jc (id uuid, code text, msg uuid, msg2 uuid);
grant all on jc to authenticated, service_role;
create or replace function public.t_as_service() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role":"service_role"}', false);
  execute 'set role service_role';
end $$;
grant execute on function public.t_as_service() to authenticated, service_role;
grant usage on schema public to service_role;
grant execute on function public.t_ok(text, boolean, text), public.t_denied(text), public.t_raises(text, text) to service_role;

select t_as('a');
insert into jc (id, code) select (r->>'id')::uuid, r->>'code' from (select carguy.create_junte('Chat de prueba', now() + interval '1 hour') r) x;
select t_as('b');
select carguy.join_junte((select code from jc));
select t_as('c');
select carguy.join_junte((select code from jc));

-- Tokens
select t_as('b');
select carguy.register_push_token('ExponentPushToken[bbbbbbbbbbbbbbbbbbbbbb]', 'android');
select t_as('c');
select carguy.register_push_token('ExponentPushToken[cccccccccccccccccccccc]', 'android');
select t_ok('39a. a malformed token is refused', t_denied($q$select carguy.register_push_token('not-a-token', 'android')$q$));
select t_ok('39b. nobody reads push_token directly', t_denied('select 1 from carguy.push_token'));
select t_as('d');
select t_ok('39c. a Music Hub-only account cannot register a token',
  t_raises($q$select carguy.register_push_token('ExponentPushToken[dddddddddddddddddddddd]', 'android')$q$, '%forbidden%'));

-- The list
select t_as('a');
update jc set msg = carguy.send_junte_message(id, 'Salimos a las 8');
select t_as('b');
select t_ok('39d. a member reads the chat: author by handle, no user id anywhere',
  (carguy.junte_messages((select id from jc))->'messages'->0->'author'->>'handle') = 'trueno_ae85'
  and carguy.junte_messages((select id from jc))::text not like '%00000000-0000-0000-0000-0000000000%'
  and not (carguy.junte_messages((select id from jc))->'messages'->0 ? 'user_id'));
select t_ok('39e. … mine=false, can_delete=false for someone else''s message',
  (carguy.junte_messages((select id from jc))->'messages'->0->>'mine')::boolean = false
  and (carguy.junte_messages((select id from jc))->'messages'->0->>'can_delete')::boolean = false);
select t_ok('39f. the direct table read is closed', t_denied('select 1 from carguy.junte_message'));
select t_ok('39g. p_after returns only newer messages',
  jsonb_array_length(carguy.junte_messages((select id from jc), now() + interval '1 minute')->'messages') = 0);
select t_as('d');
select t_ok('39h. a non-member gets null', carguy.junte_messages((select id from jc)) is null);

-- The push claim
select t_as('b');
select t_ok('39i. an authenticated client cannot call the claim',
  t_denied($q$select carguy.junte_push_claim((select msg from jc), '00000000-0000-0000-0000-00000000000a')$q$));
select t_as_service();
select t_ok('39j. the claim for someone else''s message (wrong caller) is null',
  carguy.junte_push_claim((select msg from jc), '00000000-0000-0000-0000-00000000000b') is null);
select t_ok('39k. the author''s claim returns the others'' tokens (not the author''s), title, author, body',
  c @> '{"title":"Chat de prueba","body":"Salimos a las 8","tokens":["ExponentPushToken[bbbbbbbbbbbbbbbbbbbbbb]","ExponentPushToken[cccccccccccccccccccccc]"]}'::jsonb
  and c->>'author' = 'Ana', c::text)  -- A's display name wins over the @handle
  from (select carguy.junte_push_claim((select msg from jc), '00000000-0000-0000-0000-00000000000a') c) x;
select t_ok('39l. … only once', carguy.junte_push_claim((select msg from jc), '00000000-0000-0000-0000-00000000000a') is null);

-- A burst: a second message within 15 s is marked but not pushed
select t_as('b');
update jc set msg2 = carguy.send_junte_message(id, '¡Voy!');
select t_as_service();
select t_ok('39m. a burst inside 15 s is skipped',
  carguy.junte_push_claim((select msg2 from jc), '00000000-0000-0000-0000-00000000000b') = '{"skipped":"burst"}'::jsonb);

-- Mute: C mutes, then a fresh message (older pushes moved out of the window) reaches B only
reset role;
update carguy.junte_message set pushed_at = now() - interval '1 minute' where junte_id = (select id from jc);
select t_as('c');
select carguy.set_junte_muted((select id from jc), true);
select t_ok('39n. the caller sees their own mute', (carguy.junte_messages((select id from jc))->>'muted')::boolean);
select t_as('a');
update jc set msg = carguy.send_junte_message(id, 'Cambio: 8:30');
select t_as_service();
select t_ok('39o. a muted member gets no push',
  carguy.junte_push_claim((select msg from jc), '00000000-0000-0000-0000-00000000000a')->'tokens' = '["ExponentPushToken[bbbbbbbbbbbbbbbbbbbbbb]"]'::jsonb);

-- Block between two members: B blocks C → C's messages vanish for B, and C's pushes skip B (A still gets them)
select t_as('a');
select carguy.register_push_token('ExponentPushToken[aaaaaaaaaaaaaaaaaaaaaa]', 'ios');
select t_as('b');
select carguy.block_user('tercero');
reset role;
update carguy.junte_message set pushed_at = now() - interval '1 minute' where junte_id = (select id from jc);
select t_as('c');
update jc set msg = carguy.send_junte_message(id, 'Llego tarde');
select t_as('b');
select t_ok('39p. blocked author: their message is not in B''s list (A''s still is)',
  carguy.junte_messages((select id from jc))::text not like '%Llego tarde%'
  and carguy.junte_messages((select id from jc))::text like '%Salimos%');
select t_as_service();
select t_ok('39q. … and C''s push goes to A only',
  carguy.junte_push_claim((select msg from jc), '00000000-0000-0000-0000-00000000000c')->'tokens' = '["ExponentPushToken[aaaaaaaaaaaaaaaaaaaaaa]"]'::jsonb);
select t_as('b');
select carguy.unblock_user('tercero');

-- Token housekeeping
select t_as('b');
select carguy.unregister_push_token('ExponentPushToken[bbbbbbbbbbbbbbbbbbbbbb]');
select t_as_service();
select t_ok('39r. unregister removed B''s token; drop_push_tokens removes A''s and C''s',
  carguy.drop_push_tokens(array['ExponentPushToken[aaaaaaaaaaaaaaaaaaaaaa]', 'ExponentPushToken[cccccccccccccccccccccc]', 'ExponentPushToken[bbbbbbbbbbbbbbbbbbbbbb]']) = 2);
reset role;
select t_ok('39s. … nothing left', not exists (select 1 from carguy.push_token));
select t_as('a');
select carguy.end_junte((select id from jc));
reset role;
