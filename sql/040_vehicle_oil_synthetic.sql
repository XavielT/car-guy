-- 040_vehicle_oil_synthetic.sql — IMP 16102026 Phase 1 (note 5: "Aceite sintético" always came back unmarked).
--
--   · carguy.vehicle + oil_synthetic boolean (the local v11 column). The switch used to be only a field of the vehicle
--     form, applied once at creation and never stored; now the editor reads it back and the oil reminder follows it.
--   · Backfill = the one the phones run in v11: a vehicle whose aceite_motor reminder already runs at 10,000 km /
--     12 months, or carries the note the form wrote (es or en), is synthetic. updated_at is left alone (the phones make
--     the same change; a bump would re-sync every vehicle).
--
-- carguy only, additive, no --shared. Re-runnable (only rows still false are touched).
-- Apply: node tools/apply-sql.mjs sql/040_vehicle_oil_synthetic.sql   (before publishing 2.5.2)

alter table carguy.vehicle add column if not exists oil_synthetic boolean not null default false;

update carguy.vehicle v set oil_synthetic = true
 where v.oil_synthetic = false
   and exists (
     select 1 from carguy.reminder r
      where r.vehicle_id = v.id and r.service_type_id = 'aceite_motor' and r.deleted_at is null
        and ((r.interval_km = 10000 and r.interval_months = 12)
             or r.notes in ('Aceite sintético: 10,000 km o 12 meses.', 'Synthetic oil: 10,000 km or 12 months.')));

-- ---------------------------------------------------------------- rollback ----
-- alter table carguy.vehicle drop column if exists oil_synthetic;
