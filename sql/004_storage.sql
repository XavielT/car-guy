-- 004_storage.sql — the private bucket for photos and PDFs.
--
-- Object key is `<user_id>/<media_id>.<ext>`, so the first path segment is the
-- owner and every policy is one comparison against it. Private, not public: a
-- photo of a marbete carries a plate number.

insert into storage.buckets (id, name, public)
values ('carguy-media', 'carguy-media', false)
on conflict (id) do nothing;

-- storage.objects already has RLS enabled by Supabase; these four policies are
-- scoped to this bucket by name and do not affect Music Hub's buckets.

drop policy if exists "carguy_media_own_select" on storage.objects;
create policy "carguy_media_own_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'carguy-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "carguy_media_own_insert" on storage.objects;
create policy "carguy_media_own_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'carguy-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "carguy_media_own_update" on storage.objects;
create policy "carguy_media_own_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'carguy-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'carguy-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "carguy_media_own_delete" on storage.objects;
create policy "carguy_media_own_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'carguy-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );


-- rollback:
-- drop policy if exists "carguy_media_own_select" on storage.objects;
-- drop policy if exists "carguy_media_own_insert" on storage.objects;
-- drop policy if exists "carguy_media_own_update" on storage.objects;
-- drop policy if exists "carguy_media_own_delete" on storage.objects;
-- The files and the bucket go through the dashboard or the Storage API, not
-- SQL: storage.protect_delete() rejects direct deletes (see sql/rollback.sql).
