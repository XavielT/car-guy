-- 023_inventory_used_in_mod.sql — the inventory item a mod was made from (2.2.1).
--
-- "Usar en un mod" copies an inventory item's cost into the new mod; until now the only trace was a
-- "Usado en: <mod>" line in the item's notes, which "lo que me ha costado" parsed to avoid counting the
-- money twice (an edited note broke it). used_in_mod_id is the real link. Old items keep the note rule.
--
-- Additive and nullable: 2.2.0 clients drop the unknown column on pull and push rows without it.
-- Everything in carguy; no --shared.
-- Apply: node tools/apply-sql.mjs sql/023_inventory_used_in_mod.sql

alter table carguy.inventory_item add column if not exists used_in_mod_id text;

-- rollback: alter table carguy.inventory_item drop column if exists used_in_mod_id;
