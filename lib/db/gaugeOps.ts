import { fuel, vehicles } from './repos';
import { calibrateVehicle } from '../domain/gaugeVehicle';

/**
 * Recomputes `vehicle.gauge_calibration` from the car's fill-ups (IMP 01102026 Phase 3, ADR-51) — after any
 * fill-up change, a gauge config change, or "Reiniciar calibración". Writes only when the JSON changed, so a
 * save that teaches nothing does not push the vehicle again. Returns the stored JSON.
 */
export async function recalibrateVehicle(vehicleId: string, opts: { resetAt?: string | null } = {}): Promise<string | null> {
  const vehicle = await vehicles.getById(vehicleId);
  if (!vehicle) return null;
  const logs = await fuel.list(vehicleId, { orderBy: 'occurred_at', direction: 'ASC' });
  const cal = calibrateVehicle(vehicle, logs, opts);
  // updated_at changes with every recompute; compare without it.
  const comparable = (json: string | null) => {
    if (!json) return null;
    try {
      const { updated_at: _u, ...rest } = JSON.parse(json) as Record<string, unknown>;
      return JSON.stringify(rest);
    } catch {
      return json;
    }
  };
  const next = cal ? JSON.stringify(cal) : null;
  if (comparable(next) !== comparable(vehicle.gaugeCalibration ?? null)) {
    await vehicles.upsertRaw({ id: vehicleId, gaugeCalibration: next });
  }
  return next;
}
