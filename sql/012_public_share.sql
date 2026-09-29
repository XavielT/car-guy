-- 012_public_share.sql — the public car page (IMP 28092026, 02-cloud-v2.md §4, ADR-22).
--
-- One read path for anon: carguy.public_dossier(slug) → jsonb. Security definer,
-- so anon is granted nothing on any table — only EXECUTE on this function and
-- USAGE on the schema to reach it.
--
-- Why not the spec's security_invoker views + anon select policies: an invoker
-- view needs anon to hold SELECT on the base table, and a row-level policy
-- cannot hide columns — so `GET /vehicle?select=vin,plate,user_id` would return
-- them for every shared car regardless of show_vin/show_plate. The function
-- projects the safe columns, gates each section by its show_* flag, and masks
-- the plate/VIN when their flags are off.
--
-- The share lives on vehicle_share (slug, visibility, published_at,
-- revoked_at), which the app already syncs; no vehicle columns are added. A
-- share row only counts when its user owns the vehicle (checked here against
-- vehicle.user_id — 013 widens that to the owner member), so nobody can publish
-- someone else's car by writing a share row with its id.
--
-- Photos: the public bucket `carguy-public`, `<slug>/<media_id>.jpg` and
-- `.thumb.jpg`, copied by the app at publish time. Public read by URL; no select
-- policy for anon, so the bucket cannot be listed. Authenticated users write only
-- under a slug they own.
--
-- --shared: it creates a bucket and policies on storage.objects (scoped to
-- bucket_id = 'carguy-public' by name). Statements touching storage:
--   insert into storage.buckets ('carguy-public', public = true, 2 MB, image/jpeg)
--   create policy carguy_public_owner_select|insert|update|delete on storage.objects
--
-- Apply: node tools/apply-sql.mjs sql/012_public_share.sql --shared

create unique index if not exists vehicle_share_slug_key on carguy.vehicle_share (slug) where slug is not null;

create or replace function carguy.public_dossier(p_slug text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  s carguy.vehicle_share%rowtype;
  v carguy.vehicle%rowtype;
  out jsonb;
begin
  if p_slug is null or length(p_slug) < 6 then return null; end if;

  select * into s from carguy.vehicle_share
   where slug = p_slug and visibility in ('link', 'public')
     and revoked_at is null and deleted_at is null and published_at is not null;
  if not found then return null; end if;

  select * into v from carguy.vehicle
   where id = s.vehicle_id and user_id = s.user_id and deleted_at is null;
  if not found then return null; end if;

  out := jsonb_build_object(
    'slug', s.slug,
    'visibility', s.visibility,
    'published_at', s.published_at,
    'show', jsonb_build_object(
      'plate', s.show_plate, 'vin', s.show_vin, 'costs', s.show_costs, 'odometer', s.show_odometer,
      'maintenance', s.show_maintenance, 'mods', s.show_mods, 'track', s.show_track, 'story', s.show_story),
    'vehicle', jsonb_build_object(
      'name', v.name, 'type', v.type, 'make', v.make, 'model', v.model, 'year', v.year, 'trim', v.trim,
      'color', v.color, 'nickname', v.nickname, 'status', v.status, 'chassis_code', v.chassis_code,
      'engine_code', v.engine_code, 'transmission', v.transmission, 'drivetrain', v.drivetrain,
      'origin', v.origin, 'imported_year', v.imported_year, 'hero_media_id', v.hero_media_id,
      'updated_at', v.updated_at,
      'plate', case when s.show_plate then v.plate
                    when v.plate is not null and v.plate <> '' then left(v.plate, 3) || '••••' end,
      'vin', case when s.show_vin then v.vin
                  when v.vin is not null and v.vin <> '' then left(v.vin, 3) || '••••' end,
      'story', case when s.show_story then v.story end)
  );

  if s.show_odometer then
    out := out || jsonb_build_object('odometer_km',
      (select max(o.value_km) from carguy.odometer_reading o where o.vehicle_id = v.id and o.deleted_at is null));
  end if;

  if s.show_mods then
    out := out || jsonb_build_object(
      'specsheet', (select jsonb_build_object('stock', sp.stock, 'overrides', sp.overrides)
                      from carguy.vehicle_specsheet sp where sp.vehicle_id = v.id and sp.deleted_at is null limit 1),
      'mods', coalesce((select jsonb_agg(jsonb_build_object(
          'id', m.id, 'name', m.name, 'brand', m.brand, 'variant', m.variant, 'category_id', m.category_id,
          'category', c.name, 'status', m.status, 'installed_at', m.installed_at, 'removed_at', m.removed_at,
          'affects_specs', m.affects_specs, 'spec_effects', m.spec_effects, 'tags', m.tags,
          'service_record_id', m.service_record_id,
          'cost_dop', case when s.show_costs
                           then m.cost_part_dop + m.cost_labor_dop + m.cost_shipping_dop + m.cost_customs_dop end)
          order by m.installed_at nulls last, m.created_at)
        from carguy.mod m
        left join carguy.mod_category c on c.user_id = m.user_id and c.id = m.category_id
        where m.vehicle_id = v.id and m.deleted_at is null and m.status <> 'planeado' and m.status <> 'pedido'), '[]'::jsonb));
  end if;

  if s.show_maintenance then
    out := out || jsonb_build_object('services', coalesce((select jsonb_agg(jsonb_build_object(
          'kind', r.kind, 'occurred_at', r.occurred_at, 'title', r.title,
          'odometer_km', case when s.show_odometer then r.odometer_km end,
          'total_dop', case when s.show_costs then r.total_dop end)
          order by r.occurred_at desc)
        from carguy.service_record r
        where r.vehicle_id = v.id and r.deleted_at is null and r.kind in ('mantenimiento', 'reparacion', 'mejora')), '[]'::jsonb));
  end if;

  if s.show_track then
    out := out || jsonb_build_object('track', coalesce((select jsonb_agg(jsonb_build_object(
          'id', e.id, 'occurred_at', e.occurred_at, 'title', e.title, 'discipline', e.discipline,
          'venue_id', e.venue_id, 'venue', vn.name,
          'sessions', (select count(*) from carguy.track_session ts where ts.event_id = e.id and ts.deleted_at is null),
          'runs', (select sum(ts.runs) from carguy.track_session ts where ts.event_id = e.id and ts.deleted_at is null),
          'best_lap_ms', (select min(ts.best_lap_ms) from carguy.track_session ts
                           where ts.event_id = e.id and ts.deleted_at is null and ts.best_lap_ms > 0))
          order by e.occurred_at desc)
        from carguy.track_event e
        left join carguy.venue vn on vn.user_id = e.user_id and vn.id = e.venue_id
        where e.vehicle_id = v.id and e.deleted_at is null), '[]'::jsonb));
  end if;

  if s.show_story then
    out := out || jsonb_build_object('milestones', coalesce((select jsonb_agg(jsonb_build_object(
          'kind', ms.kind, 'occurred_at', ms.occurred_at, 'title', ms.title, 'story', ms.story)
          order by ms.occurred_at)
        from carguy.milestone ms where ms.vehicle_id = v.id and ms.deleted_at is null), '[]'::jsonb));
  end if;

  -- The favourites (≤ 24), newest first: the same list the app copied to carguy-public.
  out := out || jsonb_build_object('photos', coalesce((select jsonb_agg(x.id) from (
        select md.id from carguy.album_item a join carguy.media md on md.id = a.media_id
         where a.vehicle_id = v.id and a.deleted_at is null and md.deleted_at is null and md.is_favorite
         order by md.taken_at desc nulls last, md.created_at desc limit 24) x), '[]'::jsonb));

  return out;
end $$;

revoke all on function carguy.public_dossier(text) from public;
grant execute on function carguy.public_dossier(text) to anon, authenticated;
grant usage on schema carguy to anon;
-- Belt and braces: anon holds nothing on the tables, today or for tables added later.
revoke all on all tables in schema carguy from anon;
alter default privileges in schema carguy revoke all on tables from anon;
alter default privileges in schema carguy revoke execute on functions from public;

-- ------------------------------------------------------------ the bucket --

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('carguy-public', 'carguy-public', true, 2097152, array['image/jpeg'])
on conflict (id) do update set public = true, file_size_limit = 2097152, allowed_mime_types = array['image/jpeg'];

-- Only under a slug the caller owns. No anon policy at all: public URLs work,
-- listing does not.
drop policy if exists "carguy_public_owner_select" on storage.objects;
create policy "carguy_public_owner_select" on storage.objects for select to authenticated
  using (bucket_id = 'carguy-public' and (storage.foldername(name))[1] in (
    select sh.slug from carguy.vehicle_share sh where sh.user_id = auth.uid() and sh.slug is not null));

drop policy if exists "carguy_public_owner_insert" on storage.objects;
create policy "carguy_public_owner_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'carguy-public' and (storage.foldername(name))[1] in (
    select sh.slug from carguy.vehicle_share sh where sh.user_id = auth.uid() and sh.slug is not null));

drop policy if exists "carguy_public_owner_update" on storage.objects;
create policy "carguy_public_owner_update" on storage.objects for update to authenticated
  using (bucket_id = 'carguy-public' and (storage.foldername(name))[1] in (
    select sh.slug from carguy.vehicle_share sh where sh.user_id = auth.uid() and sh.slug is not null))
  with check (bucket_id = 'carguy-public' and (storage.foldername(name))[1] in (
    select sh.slug from carguy.vehicle_share sh where sh.user_id = auth.uid() and sh.slug is not null));

drop policy if exists "carguy_public_owner_delete" on storage.objects;
create policy "carguy_public_owner_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'carguy-public' and (storage.foldername(name))[1] in (
    select sh.slug from carguy.vehicle_share sh where sh.user_id = auth.uid() and sh.slug is not null));


-- rollback:
-- drop policy if exists "carguy_public_owner_select" on storage.objects;
-- drop policy if exists "carguy_public_owner_insert" on storage.objects;
-- drop policy if exists "carguy_public_owner_update" on storage.objects;
-- drop policy if exists "carguy_public_owner_delete" on storage.objects;
-- drop function if exists carguy.public_dossier(text);
-- revoke usage on schema carguy from anon;
-- drop index if exists carguy.vehicle_share_slug_key;
-- (the bucket and its objects go through the Storage API — storage.protect_delete)
