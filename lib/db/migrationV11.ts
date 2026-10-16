/**
 * Schema v11 (IMP 16102026 Phase 1, N5): "¿Aceite sintético?" becomes a column of the vehicle.
 *
 * Until now it was only a field of the form: applied once when a vehicle was created, never stored, never read back
 * by the editor — so it always reopened unmarked. `oil_synthetic` is what the editor reads and what
 * `saveVehicleDraft` writes (and turns into the oil reminder's interval, both ways).
 *
 * Backfill: a vehicle whose oil reminder already runs at 10,000 km / 12 months — or carries the note the form wrote
 * (es or en) — is synthetic. `updated_at` is left alone: sql/040 makes the same change in the cloud, so a bump here
 * would only re-send every vehicle.
 */
export function migrationV11(): string[] {
  return [
    `ALTER TABLE vehicle ADD COLUMN oil_synthetic INTEGER NOT NULL DEFAULT 0`,
    `UPDATE vehicle SET oil_synthetic = 1 WHERE id IN (
       SELECT vehicle_id FROM reminder
        WHERE service_type_id = 'aceite_motor' AND deleted_at IS NULL
          AND ((interval_km = 10000 AND interval_months = 12)
               OR notes IN ('Aceite sintético: 10,000 km o 12 meses.', 'Synthetic oil: 10,000 km or 12 months.')))`,
  ];
}
