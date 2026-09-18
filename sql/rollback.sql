-- rollback.sql — undo everything Phase 8 added to x-core.
--
-- Order matters: Storage policies and objects first (they reference nothing but
-- would be orphaned), then the schema, then the trigger on auth.users, and the
-- invite function last because that is the only shared object.
--
-- Music Hub is untouched by every statement here except the last, which puts
-- its own function back exactly as it was.

-- 1. Storage
drop policy if exists "carguy_media_own_select" on storage.objects;
drop policy if exists "carguy_media_own_insert" on storage.objects;
drop policy if exists "carguy_media_own_update" on storage.objects;
drop policy if exists "carguy_media_own_delete" on storage.objects;
delete from storage.objects where bucket_id = 'carguy-media';
delete from storage.buckets where id = 'carguy-media';

-- 2. The trigger on auth.users, before the function it calls goes away.
drop trigger if exists carguy_on_auth_user_created on auth.users;

-- 3. The whole schema: tables, policies, triggers, functions and data.
drop schema if exists carguy cascade;

-- 4. The one shared change. Paste the original definition captured by
--    000_inspect.sql query 1 — it is also saved in the rollback block at the
--    bottom of 001_invite_trigger_app_aware.sql.
--
-- >>>>>>>>>> PASTE THE ORIGINAL public.enforce_invite_only() HERE <<<<<<<<<<

-- 5. Dashboard steps that no SQL can do:
--    · Settings → Data API → Exposed schemas: remove `carguy`.
--      (Supabase split the old Settings → API page; Data API is under the
--       INTEGRATIONS group in the Settings sidebar.)
