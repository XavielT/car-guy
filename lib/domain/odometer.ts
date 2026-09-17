/**
 * Odometer readings and how fast the vehicle actually covers ground.
 *
 * Pure TypeScript (ADR-04). `kmPerDay` is what turns a km-based reminder into a
 * *date* — "faltan 320 km" means nothing to someone planning a week, but
 * "alrededor del 14 de octubre" does. PROMPT-05's reminder engine is built on it.
 *
 * Every rule here is defensive about real data: odometers get mistyped, a
 * vehicle sits unused for a month, two readings land on the same day.
 */
import { daysBetween } from './dates';

export type Reading = {
  occurredAt: string;
  valueKm: number;
};

export type KmPerDay = {
  kmPerDay: number;
  /** 'buena' with recent readings, 'estimada' when the newest is stale, 'baja' when guessing. */
  confidence: 'buena' | 'estimada' | 'baja';
  /** How many usable day-to-day rates went into the median. */
  samples: number;
};

/** What the app assumes when it has nothing to go on: ~13,000 km a year. */
export const FALLBACK_KM_PER_DAY = 35;

/** Nobody averages more than this; above it the data is a typo, not a road trip. */
const MAX_KM_PER_DAY = 400;

const WINDOW_DAYS = 90;
const MIN_READINGS = 5;
/** Past this, the newest reading is too old to call the rate current. */
const STALE_DAYS = 30;

/** The highest value ever recorded — never the newest, so a typo cannot lower it. */
export function currentOdometer(readings: Reading[]): number | null {
  if (readings.length === 0) return null;
  return readings.reduce((max, r) => (r.valueKm > max ? r.valueKm : max), readings[0].valueKm);
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/**
 * Median daily distance.
 *
 * The **median**, not the mean, because one 600 km trip to Puerto Plata should
 * not convince the app that the car does 600 km every day. Rates are built
 * between consecutive readings at least a day apart with a positive delta, which
 * drops same-day duplicates and mistyped values that go backwards.
 *
 * Looks at the last 90 days, but always keeps at least the last 5 readings so a
 * vehicle that was parked for a season still reports something.
 */
export function kmPerDay(readings: Reading[], today: string = new Date().toISOString()): KmPerDay {
  const sorted = [...readings].sort(
    (a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime(),
  );

  const inWindow = sorted.filter((r) => daysBetween(r.occurredAt, today) <= WINDOW_DAYS);
  const usable = inWindow.length >= 2 ? inWindow : sorted.slice(-MIN_READINGS);

  const rates: number[] = [];
  for (let i = 1; i < usable.length; i++) {
    const days = daysBetween(usable[i - 1].occurredAt, usable[i].occurredAt);
    const delta = usable[i].valueKm - usable[i - 1].valueKm;
    if (days < 1) continue; // same day, or out of order
    if (delta <= 0) continue; // a correction or a typo, not distance travelled
    const rate = delta / days;
    if (rate > MAX_KM_PER_DAY) continue;
    rates.push(rate);
  }

  if (rates.length === 0) {
    return { kmPerDay: FALLBACK_KM_PER_DAY, confidence: 'baja', samples: 0 };
  }

  const newest = sorted[sorted.length - 1];
  const stale = daysBetween(newest.occurredAt, today) > STALE_DAYS;

  return {
    kmPerDay: Math.min(median(rates), MAX_KM_PER_DAY),
    confidence: stale ? 'estimada' : 'buena',
    samples: rates.length,
  };
}

/**
 * How a lower-than-current odometer should be treated in a form.
 *
 * Always a warning, never a block: the correct reading might genuinely be lower
 * — a record being backdated, or the previous entry being the typo. The one case
 * that is not even worth mentioning is a reading dated *before* the highest one,
 * where a lower number is simply expected.
 */
export function odometerWarning(
  value: number,
  occurredAt: string,
  readings: Reading[],
): string | null {
  const max = currentOdometer(readings);
  if (max == null || value >= max) return null;

  const highest = readings.reduce((best, r) => (r.valueKm > best.valueKm ? r : best), readings[0]);
  if (daysBetween(highest.occurredAt, occurredAt) < 0) return null;

  return `El odómetro más alto registrado es ${Math.round(max).toLocaleString('es-DO')} km. Puedes guardarlo igual.`;
}
