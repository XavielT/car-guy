/**
 * The vehicle form's rules that are worth a test (IMP 29092026 Phase 3). Pure.
 */
import { fromLiters, toLiters, type VolumeUnit } from './units';

export const FIRST_YEAR = 1950;

/** Years from next year down to 1950 — a car registered today can be next year's model. */
export function yearList(now: Date = new Date()): number[] {
  const last = now.getFullYear() + 1;
  return Array.from({ length: last - FIRST_YEAR + 1 }, (_, i) => last - i);
}

/** Whether a typed year is one the wheel offers. */
export function isYearInRange(year: number, now: Date = new Date()): boolean {
  return Number.isInteger(year) && year >= FIRST_YEAR && year <= now.getFullYear() + 1;
}

/** null = fine (or empty); otherwise the bounds that were broken. */
export function yearError(raw: string, now: Date = new Date()): { min: number; max: number } | null {
  const t = raw.trim();
  if (!t) return null;
  const y = Number(t);
  const max = now.getFullYear() + 1;
  return Number.isInteger(y) && y >= FIRST_YEAR && y <= max ? null : { min: FIRST_YEAR, max };
}

const round = (n: number, d: number) => Math.round(n * 10 ** d) / 10 ** d;

/**
 * The tank as typed, re-expressed when the gal | L toggle flips, so the liters
 * stored stay the same ("12.5" gal → "47.3" L → "12.5" gal).
 */
export function convertTankText(text: string, from: VolumeUnit, to: VolumeUnit, parse: (s: string) => number | null): string {
  if (from === to) return text;
  const n = parse(text);
  if (n == null) return text;
  return String(round(fromLiters(toLiters(n, from), to), 1));
}

/** "45 L ≈ 11.9 gal" under the tank field; null when nothing usable is typed. */
export function tankCaption(n: number | null, unit: VolumeUnit): { typed: string; other: string; otherUnit: VolumeUnit } | null {
  if (n == null || n <= 0) return null;
  const otherUnit: VolumeUnit = unit === 'gal' ? 'l' : 'gal';
  return { typed: String(n), other: String(round(fromLiters(toLiters(n, unit), otherUnit), 1)), otherUnit };
}
