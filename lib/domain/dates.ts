/**
 * Date helpers for the domain layer. Pure, no React, no Expo.
 *
 * Car Guy stores day-only values as **local noon** ISO strings — the convention
 * `lib/format.ts` `isoFromDateInput` established and that the legacy data
 * already uses. Noon keeps a day from sliding either side of midnight when the
 * string is read back in another timezone, and because the format is fixed,
 * SQLite's plain string comparison orders these correctly.
 */

/** `YYYY-MM-DD` for a local Date. */
export function dayKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * A development-only stand-in for today (app/dev/tokens.tsx, "Fecha simulada").
 *
 * The marbete window, the due states and the "Para hoy" cards all hinge on
 * the date, and nudging a phone's clock to 16 October to look at a banner is
 * slow and breaks everything else on the phone. Every "what day is it?" in the
 * app goes through `todayIso()`, so overriding it here moves all of them at
 * once. Ignored outside __DEV__, and never persisted.
 */
let simulatedToday: string | null = null;

export function setSimulatedToday(iso: string | null): void {
  simulatedToday = iso;
}

export function simulatedTodayIso(): string | null {
  return simulatedToday;
}

/** Local noon ISO for today. */
export function todayIso(): string {
  const devOverride = typeof __DEV__ !== 'undefined' && __DEV__ ? simulatedToday : null;
  const d = devOverride ? new Date(devOverride) : new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0).toISOString();
}

/**
 * Adds whole months, clamping the day to the target month's length so that
 * 31 January + 1 month is 28 February rather than rolling into March.
 */
export function addMonths(iso: string, months: number): string {
  const d = new Date(iso);
  const day = d.getDate();
  const target = new Date(d.getFullYear(), d.getMonth() + months, 1, 12, 0, 0);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(day, lastDay));
  return target.toISOString();
}

export function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days, 12, 0, 0).toISOString();
}

/** Whole days from `from` to `to`; negative when `to` is in the past. */
export function daysBetween(from: string, to: string): number {
  const a = new Date(from);
  const b = new Date(to);
  const startA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const startB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((startB - startA) / 86_400_000);
}

/**
 * The next 31 January strictly after `iso` — the marbete deadline.
 *
 * On 31 January itself the deadline is still today, not a year away, so the
 * comparison is on the date rather than the instant.
 */
export function nextJanuary31(iso: string): string {
  const d = new Date(iso);
  const thisYear = new Date(d.getFullYear(), 0, 31, 12, 0, 0);
  if (daysBetween(iso, thisYear.toISOString()) >= 0) return thisYear.toISOString();
  return new Date(d.getFullYear() + 1, 0, 31, 12, 0, 0).toISOString();
}
