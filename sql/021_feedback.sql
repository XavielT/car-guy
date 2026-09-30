-- 021_feedback.sql — "Enviar comentario" inbox (IMP 29092026 Phase 6, ADR-35).
--
-- The package calls this file §020 (02-cloud-v3.md); 019/020 were taken by
-- schema v3 + its RLS, so it is 021 here.
--
-- What it does, all inside schema carguy (no --shared):
--   · carguy.feedback, the table from 02-cloud-v3.md §020, verbatim, plus a
--     size cap on `diagnostics` and an index for the rate-limit count;
--   · nobody inserts directly: carguy.submit_feedback(p jsonb) is the only
--     write path, security definer, 5 per hour per device_id;
--   · reads: your own rows, or everything for the admin email (lower-cased,
--     the same predicate as lib/cloud/admin.ts); the admin may change only
--     `status` and `admin_note`;
--   · 018's restrictive carguy_app_only, as every carguy table has.
--
-- Three things beyond the spec's text, each for a reason the spec left open:
--   1. submit_feedback takes an optional client-generated `id` and returns the
--      row's id (uuid instead of void). The app's offline outbox retries a send
--      whose answer it never saw; with the id, the retry is a no-op instead of
--      a second row (and does not count against the rate limit).
--   2. carguy.attach_feedback_screenshot(id, device_id): the screenshot is
--      uploaded after the row exists, so the row learns its path afterwards.
--      The server builds the path (<device_id>/<id>.jpg) — the client cannot
--      point a row at somebody else's object.
--   3. carguy.feedback_upload_allowed(name): used by the --shared storage
--      policy (021_feedback_storage.shared.sql). An upload into
--      carguy-feedback is accepted only for the object name of a row submitted
--      in the last hour that has no screenshot yet — so "the app only uploads
--      after a successful RPC" is enforced, not just promised, and the upload
--      rate is bounded by the RPC's.
--
-- Re-running the file is safe.
-- Apply: node tools/apply-sql.mjs sql/021_feedback.sql

create table if not exists carguy.feedback (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  kind text not null check (kind in ('bug','idea','otro')),
  message text not null check (char_length(message) between 5 and 4000),
  app_version text, build text, platform text, os_version text, device text,
  screen text,                         -- route the user was on
  diagnostics jsonb,                   -- flags, db version, sync state; never secrets
  device_id text not null,             -- random uuid stored on the device
  user_id uuid references auth.users(id) on delete set null,
  email text,                          -- optional, typed by the user
  screenshot_path text,                -- object name in carguy-feedback: <device_id>/<id>.jpg
  status text not null default 'new' check (status in ('new','seen','done')),
  admin_note text,
  constraint feedback_diagnostics_size check (diagnostics is null or octet_length(diagnostics::text) <= 32000)
);

create index if not exists feedback_device_recent on carguy.feedback (device_id, created_at desc);
create index if not exists feedback_created on carguy.feedback (created_at desc);

alter table carguy.feedback enable row level security;

-- 003's default privileges hand every new carguy table full CRUD to
-- authenticated; this one gets read + the two admin columns, nothing else.
revoke all on carguy.feedback from anon, authenticated;
grant select on carguy.feedback to authenticated;
grant update (status, admin_note) on carguy.feedback to authenticated;

-- The only write path.
create or replace function carguy.submit_feedback(p jsonb) returns uuid
language plpgsql volatile security definer set search_path = carguy, pg_temp as $$
declare
  v_id uuid := coalesce(nullif(p->>'id', '')::uuid, gen_random_uuid());
  v_device text := lower(nullif(trim(p->>'device_id'), ''));
begin
  if v_device is null or v_device !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception 'device_id' using errcode = '22023';
  end if;
  -- A retry of a send that already landed (the outbox never saw the answer).
  if exists (select 1 from carguy.feedback where id = v_id and device_id = v_device) then
    return v_id;
  end if;
  if (select count(*) from carguy.feedback
      where device_id = v_device and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  insert into carguy.feedback (id, kind, message, app_version, build, platform, os_version, device, screen,
                               diagnostics, device_id, user_id, email)
  values (v_id, p->>'kind', p->>'message', left(p->>'app_version', 40), left(p->>'build', 40),
          left(p->>'platform', 20), left(p->>'os_version', 40), left(p->>'device', 120), left(p->>'screen', 200),
          p->'diagnostics', v_device, auth.uid(), left(nullif(trim(p->>'email'), ''), 320));
  return v_id;
end $$;
revoke all on function carguy.submit_feedback(jsonb) from public;
grant execute on function carguy.submit_feedback(jsonb) to anon, authenticated;

-- After the screenshot upload succeeded. The path is the server's, not the client's.
create or replace function carguy.attach_feedback_screenshot(p_id uuid, p_device_id text) returns boolean
language plpgsql volatile security definer set search_path = carguy, pg_temp as $$
begin
  update carguy.feedback
     set screenshot_path = device_id || '/' || id::text || '.jpg'
   where id = p_id and device_id = lower(trim(p_device_id)) and screenshot_path is null
     and created_at > now() - interval '1 day';
  return found;
end $$;
revoke all on function carguy.attach_feedback_screenshot(uuid, text) from public;
grant execute on function carguy.attach_feedback_screenshot(uuid, text) to anon, authenticated;

-- For the storage insert policy (--shared file): may this object name be written?
create or replace function carguy.feedback_upload_allowed(object_name text) returns boolean
language sql stable security definer set search_path = carguy, pg_temp as $$
  select exists (
    select 1 from carguy.feedback f
     where f.device_id || '/' || f.id::text || '.jpg' = object_name
       and f.screenshot_path is null
       and f.created_at > now() - interval '1 hour')
$$;
revoke all on function carguy.feedback_upload_allowed(text) from public;
grant execute on function carguy.feedback_upload_allowed(text) to anon, authenticated;

-- read: own rows, or admin
drop policy if exists feedback_select_own on carguy.feedback;
create policy feedback_select_own on carguy.feedback for select to authenticated
  using (user_id = (select auth.uid()) or lower((select auth.jwt()) ->> 'email') = 'tecnologia@constructorasd.com');
drop policy if exists feedback_update_admin on carguy.feedback;
create policy feedback_update_admin on carguy.feedback for update to authenticated
  using (lower((select auth.jwt()) ->> 'email') = 'tecnologia@constructorasd.com')
  with check (lower((select auth.jwt()) ->> 'email') = 'tecnologia@constructorasd.com');

-- sql/018: a session from another x-core app reads nothing here either. (The
-- admin account is a Car Guy account, so this does not hide the inbox.)
drop policy if exists carguy_app_only on carguy.feedback;
create policy carguy_app_only on carguy.feedback as restrictive for all to authenticated
  using ((select carguy.is_app_user())) with check ((select carguy.is_app_user()));

-- rollback:
-- drop function if exists carguy.feedback_upload_allowed(text);
-- drop function if exists carguy.attach_feedback_screenshot(uuid, text);
-- drop function if exists carguy.submit_feedback(jsonb);
-- drop table if exists carguy.feedback;
