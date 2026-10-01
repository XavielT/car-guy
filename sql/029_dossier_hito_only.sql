-- 029_dossier_hito_only.sql — the public page never shows events (IMP 30092026 Phase 5, ADR-44).
--
-- Since sql/025 a milestone can be an event (accidente, daño menor, avería, multa…) with a cost and
-- what is still pending. public_dossier() (022 → 025) returns every milestone under show_story, so an
-- accident would appear on the public page. This recreates 025's function unchanged except for one
-- filter: only event_type = 'hito' rows. (Found by the Phase 5 events work; the local dossier and the
-- book already filter the same way.)
--
-- carguy only, no --shared.
-- Apply: node tools/apply-sql.mjs sql/029_dossier_hito_only.sql

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
      'maintenance', s.show_maintenance, 'mods', s.show_mods, 'track', s.show_track, 'story', s.show_story,
      'status', s.show_status),
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
      'story', case when s.show_story then v.story end,
      'status_note', case when s.show_status then nullif(v.status_note, '') end,
      'status_since', case when s.show_status then v.status_since end)
  );

  if s.show_odometer then
    out := out || jsonb_build_object('odometer_km',
      (select max(o.value_km) from carguy.odometer_reading o where o.vehicle_id = v.id and o.deleted_at is null));
  end if;

  -- "Lo que me ha costado": the figure the owner's phone computed and published (never recomputed here,
  -- so the page, the book and Cifras show one number). A malformed summary is simply left out.
  if s.show_costs and s.costs_summary is not null then
    begin
      out := out || jsonb_build_object('costs', s.costs_summary::jsonb);
    exception when others then
      null;
    end;
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
          'venue_id', e.venue_id, 'venue', vn.name, 'layout', e.layout,
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
        from carguy.milestone ms where ms.vehicle_id = v.id and ms.deleted_at is null
           -- 029: events (accidents, damage, fines…) are never public (ADR-44); only plain milestones.
           and ms.event_type = 'hito'), '[]'::jsonb));
  end if;

  -- 025: the tire history (ADR-45), counts only — never brands, DOTs or costs. `badges` is one
  -- entry per status (nueva | en_uso | guardada | quemada | vendida), most tires first.
  if s.show_tires then
    out := out || jsonb_build_object('tires', jsonb_build_object(
      'count', (select count(*) from carguy.tire t where t.vehicle_id = v.id and t.deleted_at is null),
      'badges', coalesce((select jsonb_agg(jsonb_build_object('status', x.status, 'count', x.n) order by x.n desc, x.status)
        from (select t.status, count(*) as n from carguy.tire t
               where t.vehicle_id = v.id and t.deleted_at is null group by t.status) x), '[]'::jsonb)));
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

-- rollback: re-run sql/025_schema_v4.sql's public_dossier block (the same function without the filter).
