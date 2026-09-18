-- 000_inspect.sql — READ ONLY. Nothing here changes anything.
--
-- Run this in the Supabase SQL editor on project `x-core` and paste the whole
-- output into docs/imp-17092026/04-tracking/x-core-inspect.txt (gitignored).
--
-- Why it has to be you: `x-core` is production for Music Hub, and
-- 001_invite_trigger_app_aware.sql must contain the CURRENT body of
-- public.enforce_invite_only() byte for byte — a guess would silently change
-- Music Hub's invite rule. Nothing else in this phase depends on the output.

-- 1. The invite trigger's function, in full. This is the body to copy.
select pg_get_functiondef(oid) as enforce_invite_only_definition
from pg_proc
where proname = 'enforce_invite_only';

-- 2. Which triggers on auth.users call it, and whether they are enabled.
--    tgenabled: 'O' = enabled, 'D' = disabled.
select tgname, tgrelid::regclass as table_name, tgenabled, pg_get_triggerdef(oid) as definition
from pg_trigger
where not tgisinternal
  and tgrelid = 'auth.users'::regclass
order by tgname;

-- 3. Every other function any auth.users trigger runs — Music Hub's profile
--    trigger is the one that matters, because a Car Guy signup will fire it too.
select p.proname, pg_get_functiondef(p.oid) as definition
from pg_proc p
join pg_trigger t on t.tgfoid = p.oid
where not t.tgisinternal
  and t.tgrelid = 'auth.users'::regclass;

-- 4. Schemas that already exist, so `carguy` does not collide.
select nspname
from pg_namespace
where nspname not like 'pg_%' and nspname <> 'information_schema'
order by nspname;

-- 5. What is in the `tucombustible` probe schema (sql/006 offers to drop it).
select table_name
from information_schema.tables
where table_schema = 'tucombustible'
order by table_name;

-- 6. Confirm the shape of public.allowed_emails, which the invite body reads.
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'allowed_emails'
order by ordinal_position;

-- NOTE: the list of *exposed* schemas (Project Settings → API → Exposed
-- schemas) is PostgREST configuration, not database state, so no query can
-- read it. Read it off the dashboard and write it at the bottom of the paste.
