-- 043_ai_insights.sql — IMP 03112026 Phase 4 (SPEC-D §D1 cache; SPEC-E §E2; ADR-66, ADR-68).
--
-- carguy.ai_insights: what the AI said about a car, kept so re-opening costs nothing and a dismissal sticks.
--   · OBD explanations (kind 'obd'): key = vehicle + the code set + a hash of the car's relevant history, so the same
--     question about the same car is answered from here; a Refresh button asks again (a new row, same key → upsert).
--   · SPEC-E insights (kind 'insight', Phase 5) use the same table.
-- The row is written BY THE APP with the person's own session (the Edge Functions are stateless): the payload is what
-- `cg-ai-obd` already returned and already validated. It never holds a photo, a transcript or a prompt.
--
--   · read   : the owner, and any member of that vehicle's garage (viewer or better) via carguy.can_see
--   · write  : the owner of the row, and only for a vehicle they can edit (carguy.can_edit)
--   · delete : the owner of the row
--   · restrictive carguy_app_only: a Music Hub account on the shared x-core project never touches it
-- Not synced through the offline queue (cloud-only cache; the device recomputes when it is offline).
--
-- carguy only, additive, re-runnable, no --shared. Touches nothing Music Hub owns.
-- Apply: node tools/apply-sql.mjs sql/043_ai_insights.sql   (before deploying cg-ai-obd's client)

create table if not exists carguy.ai_insights (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  vehicle_id  text not null,
  kind        text not null,
  input_hash  text not null,
  payload     jsonb not null,
  status      text not null default 'new',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint ai_insights_kind_chk    check (kind in ('obd', 'insight', 'digest')),
  constraint ai_insights_status_chk  check (status in ('new', 'seen', 'dismissed', 'done')),
  constraint ai_insights_hash_chk    check (char_length(input_hash) between 8 and 128),
  -- The explanation of a few codes is a couple of KB; this keeps a client from using the table as storage.
  constraint ai_insights_size_chk    check (octet_length(payload::text) <= 32768),
  constraint ai_insights_key_uq      unique (user_id, vehicle_id, kind, input_hash)
);
create index if not exists ai_insights_vehicle_idx on carguy.ai_insights (vehicle_id, kind, created_at desc);

create or replace function carguy.ai_insights_touch() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  -- A row never changes owner, vehicle, kind or key: a "refresh" is an update of the payload only.
  new.user_id := old.user_id;
  new.vehicle_id := old.vehicle_id;
  new.kind := old.kind;
  new.input_hash := old.input_hash;
  new.created_at := old.created_at;
  return new;
end $$;
drop trigger if exists ai_insights_touch on carguy.ai_insights;
create trigger ai_insights_touch before update on carguy.ai_insights for each row execute function carguy.ai_insights_touch();

alter table carguy.ai_insights enable row level security;
drop policy if exists ai_insights_select on carguy.ai_insights;
drop policy if exists ai_insights_insert on carguy.ai_insights;
drop policy if exists ai_insights_update on carguy.ai_insights;
drop policy if exists ai_insights_delete on carguy.ai_insights;
create policy ai_insights_select on carguy.ai_insights for select to authenticated
  using (carguy.can_see(vehicle_id, user_id));
create policy ai_insights_insert on carguy.ai_insights for insert to authenticated
  with check (user_id = (select auth.uid()) and carguy.can_edit(vehicle_id, user_id));
create policy ai_insights_update on carguy.ai_insights for update to authenticated
  using (user_id = (select auth.uid()) and carguy.can_edit(vehicle_id, user_id))
  with check (user_id = (select auth.uid()) and carguy.can_edit(vehicle_id, user_id));
create policy ai_insights_delete on carguy.ai_insights for delete to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists carguy_app_only on carguy.ai_insights;
create policy carguy_app_only on carguy.ai_insights as restrictive for all to authenticated
  using ((select carguy.is_app_user())) with check ((select carguy.is_app_user()));

revoke all on carguy.ai_insights from anon, authenticated;
grant select, insert, update, delete on carguy.ai_insights to authenticated;
grant all on carguy.ai_insights to service_role;

-- rollback:
-- drop table if exists carguy.ai_insights; drop function if exists carguy.ai_insights_touch();
