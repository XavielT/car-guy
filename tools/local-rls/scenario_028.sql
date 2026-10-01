\set ON_ERROR_STOP 1
-- sql/028: "Eliminar cuenta". Runs last, after scenario.sql (A owns veh_a with rows in most tables,
-- B is a member of it and owns veh_b, C is a member, D is a Music Hub-only account, E is the admin).

-- Rows per carguy table for one user, as the database owner sees them.
create or replace function public.t_counts(u uuid) returns jsonb language plpgsql as $$
declare t text; n bigint; out jsonb := '{}'::jsonb;
begin
  for t in select c.table_name from information_schema.columns c
             join information_schema.tables tb on tb.table_schema = c.table_schema and tb.table_name = c.table_name
            where c.table_schema = 'carguy' and c.column_name = 'user_id' and tb.table_type = 'BASE TABLE'
              and c.table_name <> 'profiles'
            order by 1
  loop
    execute format('select count(*) from carguy.%I where user_id = $1', t) into n using u;
    if n > 0 then out := out || jsonb_build_object(t, n); end if;
  end loop;
  return out;
end $$;

-- A's things in Storage and elsewhere, written as the owner (the shim has no Storage API).
insert into storage.objects (bucket_id, name, owner, owner_id, metadata) values
  ('carguy-media', 'v/veh_a/m_new.jpg', '00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', '{"size": 10}'),
  ('carguy-media', '00000000-0000-0000-0000-00000000000a/avatar.jpg', '00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', '{"size": 10}'),
  ('carguy-media', 'v/veh_b/b1.jpg', '00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b', '{"size": 10}'),
  ('carguy-media', '00000000-0000-0000-0000-00000000000b/b2.jpg', '00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b', '{"size": 10}'),
  ('carguy-public', 'ae85hchg/m_a.jpg', null, null, '{"size": 10}'),
  ('carguy-feedback', '0000feed-0000-4000-8000-00000000a028/0000feed-0001-4000-8000-00000000a028.jpg', null, null, '{"size": 10}');
insert into carguy.feedback (id, kind, message, device_id, user_id, screenshot_path) values
  ('0000feed-0001-4000-8000-00000000a028', 'bug', 'Algo falla aquí', '0000feed-0000-4000-8000-00000000a028',
   '00000000-0000-0000-0000-00000000000a', '0000feed-0000-4000-8000-00000000a028/0000feed-0001-4000-8000-00000000a028.jpg');
update carguy.profiles set avatar_id = null, avatar_path = '00000000-0000-0000-0000-00000000000a/avatar.jpg', display_name = 'Xaviel A'
 where user_id = '00000000-0000-0000-0000-00000000000a';
select t_as('a');
insert into carguy.legal_acceptance (id, version, accepted_at, locale, platform, device_id, created_at, updated_at)
  values ('la_a028', '2026-10', now(), 'es', 'android', 'redmi', now(), now())
  on conflict (id) do nothing;
reset role;
-- B has rows of its own in A's car (B is an editor there) and in its own car.
select t_as('b');
insert into carguy.fuel_log (id, vehicle_id, occurred_at, odometer_km, volume, price_per_unit, total_dop, fuel_type, is_full_tank, missed_previous, station, notes, created_at, updated_at)
  values ('f_b028', 'veh_b', now(), 1000, 10, 300, 3000, 'regular', true, false, '', '', now(), now());
reset role;

create temp table before_028 as
  select public.t_counts('00000000-0000-0000-0000-00000000000a') as a,
         public.t_counts('00000000-0000-0000-0000-00000000000b') as b,
         public.t_counts('00000000-0000-0000-0000-00000000000c') as c;
grant select on before_028 to authenticated;

select t_ok('28a. setup: A has rows in at least 15 carguy tables',
  (select count(*) from jsonb_object_keys((select a from before_028))) >= 15, (select a::text from before_028));

-- Refusals first.
select t_as('d');
select t_ok('28b. a Music Hub-only account is refused (not_carguy) and nothing happens',
  t_raises('select carguy.delete_my_account()', '%not_carguy%'));
reset role;
select t_as('anon');
select t_ok('28c. anon cannot call it', t_denied('select carguy.delete_my_account()'));
reset role;
select t_as('b');
select t_ok('28d. a non-admin cannot list pending deletions', t_raises('select * from carguy.admin_pending_deletions()', '%forbidden%'));
reset role;

-- A deletes.
select t_as('a');
create temp table result_028 as select carguy.delete_my_account() as r;
reset role;

select t_ok('28e. A''s rows are gone from every carguy table',
  public.t_counts('00000000-0000-0000-0000-00000000000a') = '{}'::jsonb, public.t_counts('00000000-0000-0000-0000-00000000000a')::text);
select t_ok('28f. B''s rows are intact (its car, its rows in A''s car)',
  public.t_counts('00000000-0000-0000-0000-00000000000b') - 'vehicle_member' = (select b from before_028) - 'vehicle_member'
  and exists (select 1 from carguy.vehicle where id = 'veh_b') and exists (select 1 from carguy.fuel_log where id = 'f_b028'),
  public.t_counts('00000000-0000-0000-0000-00000000000b')::text || ' vs ' || (select b::text from before_028));
select t_ok('28g. C''s rows are intact',
  public.t_counts('00000000-0000-0000-0000-00000000000c') - 'vehicle_member' = (select c from before_028) - 'vehicle_member');
select t_ok('28h. B''s and C''s memberships in A''s car ended (their phones learn the car is gone)',
  not exists (select 1 from carguy.vehicle_member where vehicle_id = 'veh_a' and deleted_at is null)
  and exists (select 1 from carguy.vehicle_member where vehicle_id = 'veh_a' and user_id = '00000000-0000-0000-0000-00000000000b'));
select t_ok('28i. invites of A''s car and A''s feedback are gone',
  not exists (select 1 from carguy.vehicle_invite where vehicle_id = 'veh_a' or created_by = '00000000-0000-0000-0000-00000000000a')
  and not exists (select 1 from carguy.feedback where user_id = '00000000-0000-0000-0000-00000000000a'));
select t_ok('28j. the profile stays, marked, without name or avatar',
  exists (select 1 from carguy.profiles where user_id = '00000000-0000-0000-0000-00000000000a'
          and deletion_requested_at is not null and display_name is null and avatar_path is null));
select t_ok('28k. the object list: A''s folder, its car''s v/ folder, the avatar, the public page photo, the screenshot — none of B''s',
  (select r -> 'objects' from result_028) @> '[{"bucket":"carguy-media","name":"00000000-0000-0000-0000-00000000000a/m_a.jpg"},
    {"bucket":"carguy-media","name":"v/veh_a/m_new.jpg"},
    {"bucket":"carguy-media","name":"00000000-0000-0000-0000-00000000000a/avatar.jpg"},
    {"bucket":"carguy-public","name":"ae85hchg/m_a.jpg"},
    {"bucket":"carguy-feedback","name":"0000feed-0000-4000-8000-00000000a028/0000feed-0001-4000-8000-00000000a028.jpg"}]'::jsonb
  and (select r -> 'objects' from result_028)::text not like '%veh_b%'
  and (select r -> 'objects' from result_028)::text not like '%0000000b/%',
  (select r::text from result_028));
select t_ok('28l. the objects are still there (the RPC cannot delete them; the Vercel function does)',
  exists (select 1 from storage.objects where name = 'v/veh_a/m_new.jpg'));

select t_as('a');
select t_ok('28m. calling again deletes nothing more and returns the same object list',
  (select (carguy.delete_my_account() -> 'objects') = (select r -> 'objects' from result_028)));
reset role;

select t_admin();
select t_ok('28n. the admin sees A in "Cuentas por eliminar", with its object count',
  exists (select 1 from carguy.admin_pending_deletions() p
          where p.user_id = '00000000-0000-0000-0000-00000000000a' and p.objects >= 5 and p.email = 'a@example.com'));
reset role;

-- The function then deletes the auth user: the profile cascades away and the list empties.
delete from auth.users where id = '00000000-0000-0000-0000-00000000000a';
select t_admin();
select t_ok('28o. once the login is deleted, A leaves the list',
  not exists (select 1 from carguy.admin_pending_deletions() p where p.user_id = '00000000-0000-0000-0000-00000000000a'));
reset role;
select t_ok('28p. D (Music Hub) is untouched', exists (select 1 from auth.users where id = '00000000-0000-0000-0000-00000000000d'));
