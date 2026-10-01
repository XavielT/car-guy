\set ON_ERROR_STOP 1
-- sql/031: other members' avatars. After scenario.sql: A owns veh_a; B left it (10e); E is the admin.
reset role;
insert into carguy.vehicle_member (vehicle_id, user_id, role, display_name, created_at, updated_at)
values ('veh_a', '00000000-0000-0000-0000-00000000000c', 'viewer', 'C copia', now(), now())
on conflict (vehicle_id, user_id) do update set deleted_at = null, role = 'viewer', display_name = excluded.display_name;
update carguy.profiles set avatar_id = 'helmet-red', display_name = 'Ana' where user_id = '00000000-0000-0000-0000-00000000000a';
update carguy.profiles set avatar_id = 'turbo', display_name = null where user_id = '00000000-0000-0000-0000-00000000000c';

select t_as('c');
select t_ok('31a. a viewer of veh_a sees the owner''s drawing and current name',
  exists (select 1 from carguy.member_avatars('veh_a') where avatar_id = 'helmet-red' and display_name = 'Ana'));
select t_ok('31b. … and their own row, name falling back to the member copy',
  exists (select 1 from carguy.member_avatars('veh_a') where avatar_id = 'turbo' and display_name = 'C copia'));
select t_ok('31c. no photo path in the result (columns: user_id, display_name, avatar_id)',
  (select proargnames::text from pg_proc where proname = 'member_avatars') = '{p_vehicle,user_id,display_name,avatar_id}');
select t_as('b');
select t_ok('31d. someone who left the car is refused', t_raises($q$select * from carguy.member_avatars('veh_a')$q$, 'forbidden'));
select t_as('anon');
select t_ok('31e. anon cannot call it', t_denied($q$select * from carguy.member_avatars('veh_a')$q$));
select t_as('c');
select t_ok('31f. a non-admin still cannot list users', t_raises($q$select * from carguy.admin_users()$q$, 'forbidden'));
select t_admin();
select t_ok('31g. the admin list carries avatar_id and display_name',
  exists (select 1 from carguy.admin_users() where avatar_id = 'helmet-red' and display_name = 'Ana'));
reset role;
