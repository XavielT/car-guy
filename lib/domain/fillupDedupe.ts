/**
 * The second tap on Guardar (IMP 30092026 note 8). A draft is the same fill-up
 * as one saved moments ago when the car, the odometer, the volume, the total and
 * the date (± 1 min) match and that log was created less than `windowMs` ago.
 * A real second fill-up the same minute at the same odometer does not happen;
 * a double tap, a "Listo" back to the filled form, or a re-sent screen does.
 */
import type { FillUp } from '../types';

export const DEDUPE_WINDOW_MS = 60_000;
const SAME_MINUTE_MS = 60_000;

type Draft = Pick<FillUp, 'vehicleId' | 'odometerKm' | 'volume' | 'totalDop' | 'occurredAt'>;

export function findRecentDuplicate(draft: Draft, fillups: readonly FillUp[], now: number = Date.now(), windowMs = DEDUPE_WINDOW_MS): FillUp | null {
  const at = Date.parse(draft.occurredAt);
  for (const f of fillups) {
    if (f.vehicleId !== draft.vehicleId) continue;
    const created = Date.parse(f.createdAt);
    if (!(now - created >= 0 && now - created < windowMs)) continue;
    if (Math.abs(f.odometerKm - draft.odometerKm) > 0.5) continue;
    if (Math.abs(f.volume - draft.volume) > 0.005) continue;
    if (Math.abs(f.totalDop - draft.totalDop) > 0.5) continue;
    if (Math.abs(Date.parse(f.occurredAt) - at) > SAME_MINUTE_MS) continue;
    return f;
  }
  return null;
}
