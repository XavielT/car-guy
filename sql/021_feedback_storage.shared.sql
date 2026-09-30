-- 021_feedback_storage.shared.sql — the `--shared` half of 021 (IMP 29092026
-- Phase 6, ADR-35): the private bucket for feedback screenshots.
--
-- It writes to `storage` (a bucket row and two policies on storage.objects),
-- which x-core shares with Music Hub — hence a file of its own, applied with
-- --shared and only after Xaviel has read it:
--
--   node tools/apply-sql.mjs sql/021_feedback.sql            (first: the functions below need it)
--   node tools/apply-sql.mjs sql/021_feedback_storage.shared.sql --shared
--
-- Music Hub's buckets and policies are untouched: every policy here names
-- bucket_id = 'carguy-feedback', and nothing is dropped except these two
-- names. sql/018's restrictive carguy_app_only on storage.objects passes this
-- bucket (it only restricts carguy-media / carguy-public), so an anon upload
-- is decided by the insert policy alone.
--
-- Rules:
--   · private, 2 MB per object, image/jpeg only (the bucket enforces both);
--   · insert for anon and authenticated, only as <device_id>/<feedback id>.jpg
--     for a row submitted through carguy.submit_feedback in the last hour that
--     has no screenshot yet (carguy.feedback_upload_allowed, sql/021) — no
--     upsert, no update, no delete for anyone;
--   · select only for the admin email (signed URLs in Comentarios recibidos).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('carguy-feedback', 'carguy-feedback', false, 2097152, array['image/jpeg'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "carguy_feedback_insert" on storage.objects;
create policy "carguy_feedback_insert" on storage.objects
  for insert to anon, authenticated
  with check (
    bucket_id = 'carguy-feedback'
    and carguy.feedback_upload_allowed(name)
  );

drop policy if exists "carguy_feedback_admin_select" on storage.objects;
create policy "carguy_feedback_admin_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'carguy-feedback'
    and lower((select auth.jwt()) ->> 'email') = 'tecnologia@constructorasd.com'
  );

-- rollback (--shared):
-- drop policy if exists "carguy_feedback_admin_select" on storage.objects;
-- drop policy if exists "carguy_feedback_insert" on storage.objects;
-- delete from storage.buckets where id = 'carguy-feedback';   (only once it is empty)
