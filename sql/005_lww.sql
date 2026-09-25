-- 005_lww.sql — server-side last-write-wins.
--
-- The client pushes with `upsert(...)` on each table's key — `id`, or
-- `user_id, id` for the seeded catalogue since sql/008 — which becomes an
-- INSERT … ON CONFLICT DO UPDATE. Without this guard, a phone that had been
-- offline for a week would overwrite a newer row from another device simply by
-- syncing later. The rule from 02-supabase-carguy.md §5: an update applies only
-- when the incoming `updated_at` is at least as new as the stored one.
--
-- It is added to `carguy.before_write()` — the function 002 already attached to
-- every table — rather than as a second trigger. Two before-update triggers
-- fire in name order and each is handed what the previous returned, so a
-- separate guard could be undone by the stamping trigger running after it, and
-- a rejected write would still move `server_updated_at`. That would make every
-- other device pull a row that had not changed. One function, no ordering.
--
-- Rejection is silent on purpose. Raising would fail the whole batch of 200
-- rows for one stale record, and the client has nothing useful to do with the
-- error: the row it pushed is simply out of date, and the next pull brings it
-- the newer version.

create or replace function carguy.before_write()
returns trigger
language plpgsql
as $$
begin
  -- Stale write: keep the stored row untouched, cursor included.
  if new.updated_at < old.updated_at then
    return old;
  end if;

  new.server_updated_at := now();
  return new;
end
$$;

-- The triggers themselves were created by 002 and are not recreated here;
-- `create or replace function` swaps the body underneath them.
--
-- Verify with:
--   select tgname from pg_trigger
--   where tgrelid = 'carguy.vehicle'::regclass and not tgisinternal;
--   -- expect exactly one: vehicle_before_write


-- rollback:
-- Restore the stamp-only version from 002:
--
-- create or replace function carguy.before_write()
-- returns trigger language plpgsql as $$
-- begin
--   new.server_updated_at := now();
--   return new;
-- end $$;
