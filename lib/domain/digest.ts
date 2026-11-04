/**
 * Weekly digest — who gets one (IMP 03112026 SPEC-E §E4, PROMPT-05 step 7). PURE: no imports, no clock, no network. The endpoint that
 * will call this (not built yet, see PROGRESS D-37) hands it the candidates and `now`, and sends only to `selected`.
 *
 * A digest goes out for a car only when ALL of these hold, checked in this order so the reason is always the first one that fails:
 *   kill_switch   the AI/digest kill switch is off
 *   opted_out     the person turned digests off
 *   inactive      not active in the last 30 days (we do not nag people who left)
 *   no_facts      nothing worth saying (no act/watch fact)
 *   unchanged     the facts-hash is the one already sent (the world did not move)
 *   too_soon      a digest went out in the last 6 days (one a week at most)
 *   quiet_hours   it is the person's night (their local hour is in the quiet window)
 *   daily_cap     today's global cap is already used up (the rest wait for tomorrow)
 * Most urgent first, so a cap never drops an `act` digest in favour of a `watch` one.
 */

export type DigestCandidate = {
  userId: string;
  vehicleId: string;
  /** ISO instant of the last time the person opened the app. */
  lastActiveAt: string | null;
  /** The facts-hash of the digest last sent for this car, and when. */
  lastDigestHash: string | null;
  lastDigestAt: string | null;
  /** The hash of the facts computed now, and the worst severity among them. */
  hash: string;
  worst: 'info' | 'watch' | 'act';
  prefs: { enabled: boolean; quietFrom: number; quietTo: number; tzOffsetMin: number };
};

export type DigestSkip = 'kill_switch' | 'opted_out' | 'inactive' | 'no_facts' | 'unchanged' | 'too_soon' | 'quiet_hours' | 'daily_cap';
export type DigestPlan = { selected: DigestCandidate[]; skipped: { userId: string; vehicleId: string; reason: DigestSkip }[] };

export const DIGEST = { ACTIVE_DAYS: 30, MIN_GAP_DAYS: 6, DAILY_CAP: 200 } as const;
const DAY = 86_400_000;
const RANK = { act: 0, watch: 1, info: 2 } as const;

/** Local hour (0–23) for a person whose clock is `tzOffsetMin` minutes from UTC (Santo Domingo = −240). */
export function localHour(nowMs: number, tzOffsetMin: number): number {
  return Math.floor((((nowMs + tzOffsetMin * 60_000) % DAY) + DAY) % DAY / 3_600_000);
}

/** Is `hour` inside the quiet window? The window may wrap midnight (22 → 7). from === to means no quiet hours. */
export function inQuietHours(hour: number, from: number, to: number): boolean {
  if (from === to) return false;
  return from < to ? hour >= from && hour < to : hour >= from || hour < to;
}

export function planDigests(candidates: readonly DigestCandidate[], opts: { now: string; killSwitchOn: boolean; sentToday: number; dailyCap?: number }): DigestPlan {
  const nowMs = Date.parse(opts.now);
  const cap = opts.dailyCap ?? DIGEST.DAILY_CAP;
  const selected: DigestCandidate[] = [];
  const skipped: DigestPlan['skipped'] = [];
  const skip = (c: DigestCandidate, reason: DigestSkip) => skipped.push({ userId: c.userId, vehicleId: c.vehicleId, reason });

  // Filters first, in the documented order; the cap last, applied to the urgency-sorted survivors.
  const survivors: DigestCandidate[] = [];
  for (const c of candidates) {
    const active = c.lastActiveAt ? Date.parse(c.lastActiveAt) : NaN;
    const last = c.lastDigestAt ? Date.parse(c.lastDigestAt) : NaN;
    if (opts.killSwitchOn) skip(c, 'kill_switch');
    else if (!c.prefs.enabled) skip(c, 'opted_out');
    else if (!Number.isFinite(active) || nowMs - active > DIGEST.ACTIVE_DAYS * DAY) skip(c, 'inactive');
    else if (c.worst === 'info') skip(c, 'no_facts');
    else if (c.lastDigestHash === c.hash) skip(c, 'unchanged');
    else if (Number.isFinite(last) && nowMs - last < DIGEST.MIN_GAP_DAYS * DAY) skip(c, 'too_soon');
    else if (inQuietHours(localHour(nowMs, c.prefs.tzOffsetMin), c.prefs.quietFrom, c.prefs.quietTo)) skip(c, 'quiet_hours');
    else survivors.push(c);
  }
  survivors.sort((a, b) => RANK[a.worst] - RANK[b.worst] || (a.lastDigestAt ?? '').localeCompare(b.lastDigestAt ?? ''));
  let room = Math.max(0, cap - opts.sentToday);
  for (const c of survivors) {
    if (room > 0) {
      selected.push(c);
      room--;
    } else skip(c, 'daily_cap');
  }
  return { selected, skipped };
}
