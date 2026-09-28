-- 011_storage_v2.sql — the photo quota on uploads (IMP 28092026, 02-cloud-v2.md §3,
-- ADR-23).
--
-- Thumbs need nothing new: `<user_id>/<media_id>.thumb.jpg` already satisfies the
-- 004 policies (first path segment = the owner). This file only replaces the
-- insert policy of the `carguy-media` bucket so an upload is refused once the
-- account's objects plus this one would pass `carguy.profiles.media_quota_bytes`
-- (300 MB by default, 010). The app reads a refusal as "quota full", pauses
-- uploads and keeps the photos local (lib/sync/mediaBytes.ts).
--
-- `storage_usage_bytes()` (010) is security definer and sums only the caller's
-- objects in this bucket. `metadata->>'size'` may be absent on the new row at
-- check time on some Storage versions, hence the coalesce: the check then counts
-- what is already stored, and the next upload is the one refused.
--
-- --shared: it touches a policy on storage.objects, which Music Hub's buckets
-- share. The policy is scoped to bucket_id = 'carguy-media' by name, like 004's;
-- no other policy or bucket is changed.
--
-- Apply: node tools/apply-sql.mjs sql/011_storage_v2.sql --shared

drop policy if exists "carguy_media_own_insert" on storage.objects;
create policy "carguy_media_own_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'carguy-media'
    and (storage.foldername(name))[1] = auth.uid()::text
    and carguy.storage_usage_bytes() + coalesce((metadata->>'size')::bigint, 0)
      <= coalesce((select p.media_quota_bytes from carguy.profiles p where p.user_id = auth.uid()), 314572800)
  );


-- The quota must not be the user's to raise. 003 grants authenticated UPDATE on
-- every carguy table with an own-row policy, so without this a client could PATCH
-- its own profile to a terabyte. Column privileges cannot narrow a table-level
-- grant, hence a trigger: for anyone but the service role / the database owner
-- (handle_new_user runs as definer), the quota keeps its old value on update and
-- the default on insert.
create or replace function carguy.protect_media_quota() returns trigger
language plpgsql set search_path = '' as $$
begin
  if coalesce(auth.role(), '') = 'service_role' or current_user in ('postgres', 'supabase_admin') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.media_quota_bytes := 314572800;
  else
    new.media_quota_bytes := old.media_quota_bytes;
  end if;
  return new;
end $$;

drop trigger if exists protect_media_quota on carguy.profiles;
create trigger protect_media_quota before insert or update on carguy.profiles
  for each row execute function carguy.protect_media_quota();


-- rollback (back to 004's insert policy):
-- drop policy if exists "carguy_media_own_insert" on storage.objects;
-- create policy "carguy_media_own_insert" on storage.objects
--   for insert to authenticated
--   with check (
--     bucket_id = 'carguy-media'
--     and (storage.foldername(name))[1] = auth.uid()::text
--   );
-- drop trigger if exists protect_media_quota on carguy.profiles;
-- drop function if exists carguy.protect_media_quota();
