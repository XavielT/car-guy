import type { FillUp } from '../types';

/**
 * "≈ por echada" (IMP 30092026 note 9, data model v8 §2): partials must count.
 *
 * For every fill-up with a previous fill-up on the same vehicle and a strictly
 * higher odometer, the km driven since that previous fill-up divided by the
 * volume pumped THIS time. It is an approximation — the tank level at each stop
 * is unknown, so a small top-up after a long stretch reads high and a big fill
 * after a short one reads low — and it is always flagged `approx: true`.
 *
 * It NEVER feeds an average: `computeEconomy` / `partialEconomy` stay the only
 * source of the headline figure.
 *
 * Volumes: the store's `FillUp.volume` is already in the vehicle's volume unit
 * (lib/store.tsx `fuelForDisplay`), so `kmPerUnit` is km per that unit — format
 * it with `kmPerUnit()` / `economyValue()` from lib/format.ts like any economy figure.
 */

export type PerFillEconomy = {
  /** km per the vehicle's volume unit (km/gal or km/L; km/m³ for GNV). */
  kmPerUnit: number;
  /** Odometer km since the previous fill-up on the same vehicle. */
  distanceKm: number;
  /** The previous fill-up the distance is measured from. */
  previousId: string;
  approx: true;
};

/** Longer than this between two fill-ups and the pair says nothing about one tank. */
export const PER_FILL_MAX_GAP_DAYS = 60;
const MAX_GAP_MS = PER_FILL_MAX_GAP_DAYS * 24 * 60 * 60 * 1000;

type Log = Pick<FillUp, 'id' | 'vehicleId' | 'occurredAt' | 'odometerKm' | 'volume'> & { missedPrevious?: boolean | null };

/**
 * One fill-up against the one before it (same vehicle, the caller's choice of
 * "previous"). Null when the pair cannot say anything: no previous, missed
 * previous, odometer not increasing, zero volume, or more than 60 days apart.
 */
export function perFillFor(current: Log, previous: Log | null | undefined): PerFillEconomy | null {
  if (!previous || previous.vehicleId !== current.vehicleId) return null;
  if (current.missedPrevious) return null;
  if (!(current.volume > 0) || !Number.isFinite(current.volume)) return null;
  const distanceKm = current.odometerKm - previous.odometerKm;
  if (!(distanceKm > 0) || !Number.isFinite(distanceKm)) return null;
  const gap = new Date(current.occurredAt).getTime() - new Date(previous.occurredAt).getTime();
  if (!Number.isFinite(gap) || gap < 0 || gap > MAX_GAP_MS) return null;
  return { kmPerUnit: distanceKm / current.volume, distanceKm, previousId: previous.id, approx: true };
}

/** Chronological order within a vehicle: date, then odometer, then creation. */
function byTime(a: Log & { createdAt?: string }, b: Log & { createdAt?: string }): number {
  const t = new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime();
  if (t !== 0) return t;
  if (a.odometerKm !== b.odometerKm) return a.odometerKm - b.odometerKm;
  return (a.createdAt ?? '').localeCompare(b.createdAt ?? '');
}

/**
 * Every fill-up's "≈ por echada" figure, keyed by fill-up id. Input may be in
 * any order and mix vehicles; fill-ups that cannot be measured are absent.
 */
export function perFillEconomy(fillups: readonly (Log & { createdAt?: string })[]): Map<string, PerFillEconomy> {
  const out = new Map<string, PerFillEconomy>();
  const byVehicle = new Map<string, (Log & { createdAt?: string })[]>();
  for (const f of fillups) {
    const list = byVehicle.get(f.vehicleId);
    if (list) list.push(f);
    else byVehicle.set(f.vehicleId, [f]);
  }
  for (const list of byVehicle.values()) {
    const sorted = [...list].sort(byTime);
    for (let i = 1; i < sorted.length; i++) {
      const result = perFillFor(sorted[i], sorted[i - 1]);
      if (result) out.set(sorted[i].id, result);
    }
  }
  return out;
}

/** The figure for one fill-up out of a vehicle's (or the whole store's) list. */
export function perFillEconomyOf(fillupId: string, fillups: readonly (Log & { createdAt?: string })[]): PerFillEconomy | null {
  const target = fillups.find((f) => f.id === fillupId);
  if (!target) return null;
  return perFillEconomy(fillups.filter((f) => f.vehicleId === target.vehicleId)).get(fillupId) ?? null;
}

/** Chart series in time order (occurredAt + figure), for the dotted Cifras line. */
export function perFillSeries(
  fillups: readonly (Log & { createdAt?: string })[],
): { fillUpId: string; occurredAt: string; kmPerUnit: number; distanceKm: number }[] {
  const map = perFillEconomy(fillups);
  return [...fillups]
    .filter((f) => map.has(f.id))
    .sort(byTime)
    .map((f) => {
      const p = map.get(f.id)!;
      return { fillUpId: f.id, occurredAt: f.occurredAt, kmPerUnit: p.kmPerUnit, distanceKm: p.distanceKm };
    });
}
