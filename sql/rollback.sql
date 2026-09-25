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
-- The bucket's files and the bucket itself cannot be removed with SQL:
-- Supabase's storage.protect_delete() rejects direct deletes on storage.objects
-- and storage.buckets (42501) so bytes are never orphaned. Before running this
-- file, empty and delete the bucket through the dashboard (Storage →
-- carguy-media → select all → Delete, then the bucket's menu → Delete bucket)
-- or the Storage API with the service-role key.

-- 2. The trigger on auth.users, before the function it calls goes away.
drop trigger if exists carguy_on_auth_user_created on auth.users;

-- 3. The whole schema: tables, policies, triggers, functions and data.
drop schema if exists carguy cascade;

-- 4. The one shared change: Music Hub's function exactly as it was, captured
--    by 000_inspect.sql on 2026-09-18 (the same text as the rollback block at
--    the bottom of 001_invite_trigger_app_aware.sql).
CREATE OR REPLACE FUNCTION public.enforce_invite_only()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  v_token text;
begin
  if exists (
    select 1 from public.allowed_emails
    where email = lower(trim(new.email))
  ) then
    return new;
  end if;

  v_token := nullif(trim(new.raw_user_meta_data ->> 'invite_token'), '');
  if v_token is not null then
    update public.invite_links
       set used_at = now(), used_by = new.id
     where token_hash = encode(extensions.digest(v_token, 'sha256'), 'hex')
       and used_at is null
       and revoked_at is null
       and expires_at > now();
    if found then
      return new;
    end if;
  end if;

  raise exception 'Sign-ups are invite-only. Ask Xaviel for an invite link.'
    using errcode = 'P0001';
end;
$function$;

-- sql/007 (user cascade) and sql/008 (per-account catalogue keys) live entirely
-- inside the carguy schema, so step 3 already removed them.

-- 5. Dashboard steps that no SQL can do:
--    · Settings → Data API → Exposed schemas: remove `carguy`.
--      (Supabase split the old Settings → API page; Data API is under the
--       INTEGRATIONS group in the Settings sidebar.)
