import type { OdoInterval } from '../trips/calibration';
import { getDb } from './client';

/**
 * The odometer factor's evidence for one car: each pair of consecutive TYPED odometer readings gives the odometer's difference
 * and the GPS kilometres of the finished driver trips between them (trip_estimate readings are never evidence, they come from the factor).
 * lib/trips/calibration.ts decides what is enough (>= 3 intervals of >= 100 km).
 */
export async function loadOdoIntervals(vehicleId: string): Promise<OdoInterval[]> {
  const db = await getDb();
  const typed = await db.getAllAsync<{ value_km: number; occurred_at: string }>(
    `SELECT value_km, occurred_at FROM odometer_reading
      WHERE vehicle_id = ? AND deleted_at IS NULL AND source <> 'trip_estimate'
      ORDER BY occurred_at ASC, value_km ASC`,
    [vehicleId],
  );
  const out: OdoInterval[] = [];
  for (let i = 1; i < typed.length; i++) {
    const a = typed[i - 1];
    const b = typed[i];
    const odoKm = b.value_km - a.value_km;
    if (odoKm <= 0) continue;
    const row = await db.getFirstAsync<{ m: number | null }>(
      `SELECT SUM(distance_m) AS m FROM trip WHERE vehicle_id = ? AND deleted_at IS NULL AND status = 'done'
         AND role = 'conductor' AND started_at > ? AND started_at <= ?`,
      [vehicleId, a.occurred_at, b.occurred_at],
    );
    const gpsKm = (row?.m ?? 0) / 1000;
    if (gpsKm > 0) out.push({ gpsKm, odoKm });
  }
  return out;
}
