-- 024_roles_admin_storage.shared.sql — the `--shared` half of 024: the feedback screenshots are the
-- admin *role*'s to read, not a hard-coded email's (021_feedback_storage.shared.sql).
--
-- Touches one Car Guy policy on storage.objects (bucket carguy-feedback only); Music Hub's policies
-- are untouched. Needs sql/024_roles_admin.sql first (carguy.is_admin()).
-- Apply: node tools/apply-sql.mjs sql/024_roles_admin_storage.shared.sql --shared

drop policy if exists "carguy_feedback_admin_select" on storage.objects;
create policy "carguy_feedback_admin_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'carguy-feedback'
    and (select carguy.is_admin())
  );

-- rollback (--shared): re-run the admin policy of 021_feedback_storage.shared.sql.
