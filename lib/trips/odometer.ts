/**
 * Trips and the odometer (IMP 29092026 ADR-30). Pure.
 *
 * A finished trip suggests where the odometer is now: the last *typed* reading
 * plus the GPS distance driven since, corrected by how GPS and this car's
 * odometer have compared so far (the last two typed readings vs the trips
 * between them), with the correction clamped to 0.9–1.1. It is stored as an
 * `odometer_reading` with source 'trip_estimate' and shown with "≈"; a reading
 * the user types always wins, and a trip as passenger adds nothing.
 */

export const CALIBRATION_MIN = 0.9;
export const CALIBRATION_MAX = 1.1;

/** Odometer km per GPS km; 1 when there is nothing to compare yet. */
export function calibrationFactor(typedDeltaKm: number | null, gpsBetweenKm: number | null): number {
  if (typedDeltaKm == null || gpsBetweenKm == null || typedDeltaKm <= 0 || gpsBetweenKm < 5) return 1;
  return Math.min(CALIBRATION_MAX, Math.max(CALIBRATION_MIN, typedDeltaKm / gpsBetweenKm));
}

/** The odometer after the trips since the last typed reading; null without a typed reading. */
export function estimateOdometer(input: {
  lastTypedKm: number | null;
  gpsSinceKm: number;
  factor: number;
}): number | null {
  if (input.lastTypedKm == null) return null;
  return Math.round(input.lastTypedKm + Math.max(0, input.gpsSinceKm) * input.factor);
}
