-- 041_repairs_done_by_media.sql — IMP 16102026 Phase 5 (N7, X7: registrar reparaciones).
--
--   · carguy.service_record + done_by ('self' | 'shop' | 'friend' | 'other') — who did the repair. The local v12
--     column. Backfill = the one the phones run: 'shop' when the record has a contact or a shop name, else 'self'.
--   · carguy.service_record + system text — the system a repair touched (motor, frenos, …; null = not said).
--   · carguy.service_media — the photos of a service with a role (before / after / invoice / other), the pattern of
--     carguy.mod_media. Until now a service had one photo, found through media.owner_table = 'service_record'
--     (the form showed photos[0] and hid the rest). The existing photo of each service becomes a link with the
--     derived id 'sm_<media id>' — the id every phone derives in v12, so they converge instead of duplicating.
--     RLS: the vehicle's members, exactly like part / service_record_item (sql/013), through carguy.vehicle_of.
--
-- carguy only, additive, no --shared. Re-runnable. updated_at of service_record is left alone by the backfill (the
-- phones make the same change; a bump would re-sync every record).
-- Apply: node tools/apply-sql.mjs sql/041_repairs_done_by_media.sql   (BEFORE publishing the app that pushes service_media)

alter table carguy.service_record add column if not exists done_by text not null default 'shop';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'service_record_done_by_check') then
    alter table carguy.service_record
      add constraint service_record_done_by_check check (done_by in ('self', 'shop', 'friend', 'other'));
  end if;
end $$;

alter table carguy.service_record add column if not exists system text;

-- Backfill only what still carries the default and has neither contact nor shop: those are the owner's own work.
update carguy.service_record
   set done_by = 'self'
 where done_by = 'shop' and coalesce(contact_id, '') = '' and btrim(coalesce(shop, '')) = '';

create table if not exists carguy.service_media (
  id                text primary key,
  user_id           uuid not null default auth.uid() references auth.users(id) on delete cascade,
  service_record_id text not null,
  media_id          text not null,
  role              text not null default 'other' check (role in ('before', 'after', 'invoice', 'other')),
  sort              integer not null default 0,
  created_at        timestamptz not null,
  updated_at        timestamptz not null,
  deleted_at        timestamptz,
  updated_by        uuid,
  server_updated_at timestamptz not null default now()
);

create index if not exists idx_service_media_record on carguy.service_media (service_record_id);
create index if not exists idx_service_media_user_cursor on carguy.service_media (user_id, server_updated_at);

drop trigger if exists service_media_before_write on carguy.service_media;
create trigger service_media_before_write before update on carguy.service_media
  for each row execute function carguy.before_write();

-- The photos that already exist (one per record) become a link with role 'other'.
insert into carguy.service_media (id, user_id, service_record_id, media_id, role, sort, created_at, updated_at)
select 'sm_' || m.id, m.user_id, m.owner_id, m.id, 'other', 0, m.created_at, m.updated_at
  from carguy.media m
  join carguy.service_record sr on sr.id = m.owner_id and sr.user_id = m.user_id
 where m.owner_table = 'service_record' and m.deleted_at is null
on conflict (id) do nothing;

-- RLS: the 013 member policies, through the owning service record's vehicle.
alter table carguy.service_media enable row level security;
drop policy if exists service_media_own_select on carguy.service_media;
drop policy if exists service_media_own_insert on carguy.service_media;
drop policy if exists service_media_own_update on carguy.service_media;
drop policy if exists service_media_own_delete on carguy.service_media;
drop policy if exists service_media_member_select on carguy.service_media;
drop policy if exists service_media_member_insert on carguy.service_media;
drop policy if exists service_media_member_update on carguy.service_media;
drop policy if exists service_media_member_delete on carguy.service_media;

create policy service_media_member_select on carguy.service_media for select to authenticated
  using (carguy.can_see(carguy.vehicle_of('service_record', service_record_id), user_id));
create policy service_media_member_insert on carguy.service_media for insert to authenticated
  with check (user_id = (select auth.uid()) and carguy.can_edit(carguy.vehicle_of('service_record', service_record_id), user_id));
create policy service_media_member_update on carguy.service_media for update to authenticated
  using (carguy.can_edit(carguy.vehicle_of('service_record', service_record_id), user_id))
  with check (carguy.can_edit(carguy.vehicle_of('service_record', service_record_id), user_id));
create policy service_media_member_delete on carguy.service_media for delete to authenticated
  using (carguy.can_edit(carguy.vehicle_of('service_record', service_record_id), user_id));

drop trigger if exists keep_creator on carguy.service_media;
create trigger keep_creator before update on carguy.service_media
  for each row execute function carguy.keep_creator();

grant select, insert, update, delete on carguy.service_media to authenticated;
revoke all on carguy.service_media from anon;

-- ---------------------------------------------------------------- rollback ----
-- (service_media holds user data once clients sync — dump it before dropping)
-- drop table if exists carguy.service_media;
-- alter table carguy.service_record drop constraint if exists service_record_done_by_check;
-- alter table carguy.service_record drop column if exists done_by;
-- alter table carguy.service_record drop column if exists system;
