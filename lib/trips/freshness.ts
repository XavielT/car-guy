/**
 * Location freshness is a rule, not a hope (IMP 01102026 ADR-49, notes 8 and 16). Pure.
 *
 * A phone's first fix after waking is often a cached one — on the iPhone PWA hours old and from wherever the
 * phone was that morning. So:
 *
 * - the **user dot** is drawn solid only on a fix ≤ 15 s old and ≤ 50 m; anything else keeps the last good dot
 *   greyed (or "Buscando GPS…" when there is none);
 * - **automatic detection** never starts on a stale fix. The background service delivers in batches (watching:
 *   up to 60 s deferred, lib/trips/auto.ts), so the start rule allows 90 s of age — still far below a cached
 *   last-known fix, which is minutes to hours old — and drops fixes stamped in the future (clock skew).
 */

export const MAX_FIX_AGE_MS = 15_000;
export const GOOD_ACC_M = 50;
/** Above this a fix is only "aproximada" — never a solid dot, never a re-centre. */
export const COARSE_ACC_M = 150;
/** Idle start detection: the watching service's 60 s deferral + margin. */
export const AUTO_START_MAX_AGE_MS = 90_000;
/** A fix this far in the future is a clock problem, not a position. */
export const MAX_FUTURE_MS = 15_000;

export type TimedFix = { t: number; acc: number | null };

export type FixClass = 'good' | 'coarse' | 'stale';

/** good = draw it solid · coarse = recent but imprecise (grey halo) · stale = ignore for the dot. */
export function classifyFix(fix: TimedFix, now: number): FixClass {
  const age = now - fix.t;
  if (age > MAX_FIX_AGE_MS || age < -MAX_FUTURE_MS) return 'stale';
  if (fix.acc == null || fix.acc > GOOD_ACC_M) return 'coarse';
  return 'good';
}

export function isFreshFix(fix: TimedFix, now: number): boolean {
  return classifyFix(fix, now) === 'good';
}

/** The fixes an idle machine may use to detect a start: none older than 90 s, none from the future. */
export function startableFixes<F extends TimedFix>(fixes: readonly F[], now: number): F[] {
  return fixes.filter((f) => now - f.t <= AUTO_START_MAX_AGE_MS && f.t - now <= MAX_FUTURE_MS);
}

/** "hace 3 h" helpers want the age; null when there is no fix. */
export function fixAgeMs(fix: TimedFix | null | undefined, now: number): number | null {
  return fix ? Math.max(0, now - fix.t) : null;
}
