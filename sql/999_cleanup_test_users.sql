-- 999_cleanup_test_users.sql — removes the throwaway users the verification made.
--
-- `tools/verify-x-core.mjs` signs up `carguy-test-<timestamp>-<a|b>@example.com`
-- to exercise the invite trigger and the RLS policies. It cannot delete them
-- itself: that needs a privileged connection, and the script only ever holds the
-- anon key.
--
-- Safe to re-run, and safe to run when there is nothing to delete. The pattern
-- is anchored to the `carguy-test-` / `carguy-sync-` / `carguy-ui-` prefixes and
-- to `@example.com`, a domain reserved by RFC 2606 that no real account can use.
--
-- `auth.users` is in the `auth` schema rather than `public`, so this does not
-- trip the shared-object guard in tools/apply-sql.mjs — but it IS a delete on a
-- table Music Hub also uses, so read the select below before the delete.

select id, email, created_at
from auth.users
where email like 'carguy-test-%@example.com'
   or email like 'carguy-sync-%@example.com'
   or email like 'carguy-ui-%@example.com';

delete from carguy.vehicle where id like 'veh_test_%' or id like 'sync_probe_%';
-- Phase 7: shares, memberships and invites of the test cars. (Members and
-- invites of test users also go with the users below — on delete cascade.)
delete from carguy.vehicle_share where id like 'veh_test_%' or vehicle_id like 'veh_test_%' or vehicle_id like 'sync_probe_%';
delete from carguy.vehicle_member where vehicle_id like 'veh_test_%' or vehicle_id like 'sync_probe_%';
delete from carguy.vehicle_invite where vehicle_id like 'veh_test_%' or vehicle_id like 'sync_probe_%';

-- The probe photos from verify-sync check 8 are NOT deleted here. Supabase
-- installs `storage.protect_delete()` on storage.objects, which rejects any
-- direct delete with 42501 — the bytes would be orphaned in the bucket even if
-- the row went. They go through the Storage API instead:
--   · verify-sync removes its own object at the end of each run
--   · tools/cleanup-probe-media.mjs sweeps anything left behind

-- Cascades to public.profiles and carguy.profiles, both of which reference
-- auth.users(id) on delete cascade.
-- verify-x-core 24–28 (sql/021): its devices are 0000feed-…; a real phone's id is a random v4 uuid.
delete from carguy.feedback where device_id like '0000feed-%';
-- (its test screenshot in carguy-feedback stays: storage rows can only be deleted through the Storage API)
delete from auth.users
where email like 'carguy-test-%@example.com'
   or email like 'carguy-sync-%@example.com'
   or email like 'carguy-ui-%@example.com';

-- Nothing of Music Hub's should remain behind.
select count(*) as leftover_profiles
from public.profiles
where id not in (select id from auth.users);


-- rollback:
-- None. The rows were test data created by this phase and hold nothing.
