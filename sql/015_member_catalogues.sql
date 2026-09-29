-- 015_member_catalogues.sql — a shared car's own names (IMP 28092026, 2.1.1).
--
-- venue and mod_category are per-user catalogues keyed (user_id, id) and stay
-- own-rows for writing. But a member of a shared car pulled its track events
-- and mods without the owner's custom venue / category rows, so the names read
-- "Sin pista" / "Otro" on the member's phone. Members may now READ exactly the
-- catalogue rows the shared car uses: a venue some visible track_event points
-- at (same owner), a category some visible mod points at (same owner). Nothing
-- else of the owner's catalogue shows, and writes stay own-rows. Seeded rows
-- (same id for everyone, e.g. autodromo_americas) are excluded: a member keeps
-- its own copy rather than pulling the owner's over it.
--
-- Everything in carguy; no --shared.
-- Apply: node tools/apply-sql.mjs sql/015_member_catalogues.sql

drop policy if exists venue_own_select on carguy.venue;
drop policy if exists venue_member_select on carguy.venue;
create policy venue_member_select on carguy.venue for select to authenticated using (
  user_id = (select auth.uid())
  -- Seeded rows exist for everyone under the same id: a member keeps its own copy.
  or not venue.is_seeded and exists (select 1 from carguy.track_event e
              where e.venue_id = venue.id and e.user_id = venue.user_id and e.deleted_at is null
                and carguy.can_see(e.vehicle_id, e.user_id)));

drop policy if exists mod_category_own_select on carguy.mod_category;
drop policy if exists mod_category_member_select on carguy.mod_category;
create policy mod_category_member_select on carguy.mod_category for select to authenticated using (
  user_id = (select auth.uid())
  -- Seeded rows exist for everyone under the same id: a member keeps its own copy.
  or not mod_category.is_seeded and exists (select 1 from carguy.mod m
              where m.category_id = mod_category.id and m.user_id = mod_category.user_id and m.deleted_at is null
                and carguy.can_see(m.vehicle_id, m.user_id)));

-- rollback:
-- drop policy if exists venue_member_select on carguy.venue;
-- create policy venue_own_select on carguy.venue for select to authenticated using (user_id = auth.uid());
-- drop policy if exists mod_category_member_select on carguy.mod_category;
-- create policy mod_category_own_select on carguy.mod_category for select to authenticated using (user_id = auth.uid());
