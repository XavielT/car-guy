/**
 * Uso y costos (IMP 01102026 Phase 4, ADR-53, research 01 §4.4): x-core's usage against the Free plan, and
 * when Pro would be needed at the current slope. Pure. The history is one snapshot a day, kept by the admin
 * screen in `app_config.usage_history` (admin-only).
 */
export type UsageSnapshot = { at: string; db_bytes: number; storage_bytes: number; mau: number };
export type UsageMetric = 'db_bytes' | 'storage_bytes' | 'mau';

/** The Free plan, 2026-10 (verified in research 01 §4.4). */
export const FREE_LIMITS: Record<UsageMetric, number> = { db_bytes: 500 * 1024 * 1024, storage_bytes: 1024 * 1024 * 1024, mau: 50_000 };
/** Supabase Pro, per month. */
export const PRO_USD = 25;
/** Snapshots kept (about half a year). */
export const HISTORY_MAX = 180;

const DAY = 86_400_000;
const dayOf = (iso: string) => iso.slice(0, 10);

/** Adds today's snapshot (replacing an earlier one from the same day), oldest first, capped. */
export function appendSnapshot(history: UsageSnapshot[], snap: UsageSnapshot): UsageSnapshot[] {
  const rest = history.filter((h) => dayOf(h.at) !== dayOf(snap.at));
  return [...rest, snap].sort((a, b) => (a.at < b.at ? -1 : 1)).slice(-HISTORY_MAX);
}

/** Least-squares slope in units per day; null with fewer than 2 days of data or no spread in time. */
export function slopePerDay(history: UsageSnapshot[], metric: UsageMetric): number | null {
  if (history.length < 2) return null;
  const t0 = new Date(history[0].at).getTime();
  const xs = history.map((h) => (new Date(h.at).getTime() - t0) / DAY);
  const ys = history.map((h) => h[metric]);
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let num = 0;
  let den = 0;
  for (let i = 0; i < xs.length; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  if (den < 1) return null; // less than a day apart
  return num / den;
}

/** When `metric` reaches its Free limit at the current slope: a date, 'reached', or null (flat/shrinking/unknown). */
export function limitEta(history: UsageSnapshot[], metric: UsageMetric, limit = FREE_LIMITS[metric]): Date | 'reached' | null {
  const last = history[history.length - 1];
  if (!last) return null;
  if (last[metric] >= limit) return 'reached';
  const slope = slopePerDay(history, metric);
  if (slope == null || slope <= 0) return null;
  return new Date(new Date(last.at).getTime() + ((limit - last[metric]) / slope) * DAY);
}

/** The first limit to be hit and when — what "Pro necesario ≈ <mes>" says. */
export function proNeeded(history: UsageSnapshot[]): { metric: UsageMetric; when: Date | 'reached' } | null {
  let best: { metric: UsageMetric; when: Date | 'reached' } | null = null;
  for (const metric of ['db_bytes', 'storage_bytes', 'mau'] as UsageMetric[]) {
    const when = limitEta(history, metric);
    if (when == null) continue;
    if (when === 'reached') return { metric, when };
    if (!best || (best.when !== 'reached' && when < best.when)) best = { metric, when };
  }
  return best;
}

/** Bar colour: amber from 70 %, red from 90 % (research §4.4). */
export function usageLevel(value: number, limit: number): 'ok' | 'amber' | 'red' {
  const f = limit > 0 ? value / limit : 0;
  return f >= 0.9 ? 'red' : f >= 0.7 ? 'amber' : 'ok';
}

/** What Apoyar shows (app_config.support_text, public): published by the admin from this screen. */
export type SupportText = {
  /** "2026-10" */
  month: string;
  /** What the backend costs now, US$ a month (Free plans → 0). */
  cost_usd: number;
  /** What Pro would cost. */
  pro_usd: number;
  /** "2027-03", 'reached', or null when not in sight. */
  pro_eta: string | 'reached' | null;
};

export function supportTextFrom(history: UsageSnapshot[], now: Date = new Date()): SupportText {
  const pro = proNeeded(history);
  const reached = pro?.when === 'reached';
  return {
    month: now.toISOString().slice(0, 7),
    cost_usd: reached ? PRO_USD : 0,
    pro_usd: PRO_USD,
    pro_eta: pro == null ? null : pro.when === 'reached' ? 'reached' : pro.when.toISOString().slice(0, 7),
  };
}
