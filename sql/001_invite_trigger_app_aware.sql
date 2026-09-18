-- 001_invite_trigger_app_aware.sql
--
-- The ONE change Car Guy makes to shared code on `x-core` (ADR-06).
--
-- Four lines are added at the top of Music Hub's `enforce_invite_only()` so a
-- signup carrying `raw_user_meta_data.app = 'carguy'` skips the invite check.
-- Everything below the guard is the function as it ran on 2026-09-18, copied
-- from `pg_get_functiondef` and not retyped — the original is preserved in the
-- rollback block at the bottom of this file.
--
-- Two things the body is easy to get wrong from memory, and which are NOT
-- changed here:
--   · `set search_path to 'public', 'extensions'` — not `= ''`. The function
--     calls `extensions.digest`, and the earlier draft of this file assumed the
--     empty search_path the spec sketched.
--   · the `declare v_token text;` block, which the sketch did not have at all.
--
-- `create or replace function` swaps the body under the existing trigger. The
-- trigger object `enforce_invite_only BEFORE INSERT ON auth.users` is not
-- dropped, not recreated and not renamed.

create or replace function public.enforce_invite_only()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  v_token text;
begin
  -- ===== Car Guy, and any future app that sets raw_user_meta_data.app =====
  -- Car Guy is a consumer app with open signup; Music Hub is invite-only. The
  -- flag only opens signup — it grants nothing — so a user-controlled field is
  -- the right place for it.
  if coalesce(new.raw_user_meta_data ->> 'app', '') = 'carguy' then
    return new;
  end if;
  -- ===== everything below is unchanged from 2026-09-18 =====

  if exists (
    select 1 from public.allowed_emails
    where email = lower(trim(new.email))
  ) then
    return new;
  end if;

  v_token := nullif(trim(new.raw_user_meta_data ->> 'invite_token'), '');
  if v_token is not null then
    -- Claimed and spent in one statement, so two people racing the same link
    -- cannot both win it. This runs inside the insert's transaction: if the
    -- sign-up fails afterwards, the link is unspent again.
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


-- rollback:
-- The function exactly as it was before this migration, captured with
-- `select pg_get_functiondef(oid) from pg_proc where proname = 'enforce_invite_only'`
-- on 2026-09-18. Running this block restores Music Hub's behaviour completely;
-- there is no other object to undo.
--
-- CREATE OR REPLACE FUNCTION public.enforce_invite_only()
--  RETURNS trigger
--  LANGUAGE plpgsql
--  SECURITY DEFINER
--  SET search_path TO 'public', 'extensions'
-- AS $function$
-- declare
--   v_token text;
-- begin
--   if exists (
--     select 1 from public.allowed_emails
--     where email = lower(trim(new.email))
--   ) then
--     return new;
--   end if;
--
--   v_token := nullif(trim(new.raw_user_meta_data ->> 'invite_token'), '');
--   if v_token is not null then
--     update public.invite_links
--        set used_at = now(), used_by = new.id
--      where token_hash = encode(extensions.digest(v_token, 'sha256'), 'hex')
--        and used_at is null
--        and revoked_at is null
--        and expires_at > now();
--     if found then
--       return new;
--     end if;
--   end if;
--
--   raise exception 'Sign-ups are invite-only. Ask Xaviel for an invite link.'
--     using errcode = 'P0001';
-- end;
-- $function$
