/**
 * How often each live member broadcasts its position in a junte (ADR-57,
 * research 01-research/02-social-follows-live-location-juntes.md §3.5).
 *
 * Supabase Realtime counts "a WebSocket message delivered to, or sent from a
 * client", so one broadcast costs 1 send + 1 per recipient. With n members
 * each sending every T seconds that is ≈ n² / T messages per second for the
 * whole project — and the x-core project is shared, with a 100 msg/s ceiling
 * on Free. A fixed 4 s hits exactly 100 msg/s at 20 cars, hence
 * T = max(4 s, n² / 60 s): the rate never goes above 60 msg/s, leaving
 * headroom for presence, the other app and reconnect bursts.
 *
 * Pure: the live map and the Android background task both read it.
 */

/** Fastest a member ever publishes, s (research §3.3 downsampling gate). */
export const MIN_INTERVAL_S = 4;
/** n² / T is held at or below this, msg/s. */
export const TARGET_MSG_PER_S = 60;
/** Supabase Realtime Free limit, msg/s. */
export const REALTIME_MSG_CAP_PER_S = 100;

/** Broadcast interval for `n` live members, seconds. n < 1 is treated as 1. */
export function liveIntervalS(n: number): number {
  const m = Math.max(1, Math.floor(n));
  return Math.max(MIN_INTERVAL_S, (m * m) / TARGET_MSG_PER_S);
}

/** Same, milliseconds, for timers. */
export function liveIntervalMs(n: number): number {
  return Math.round(liveIntervalS(n) * 1000);
}

/** Broadcasts sent per second by the group: n / T. */
export function sendsPerSecond(n: number, intervalS: number): number {
  return n / intervalS;
}

/**
 * Realtime-counted messages per second: every send plus one delivery to each
 * of the other n − 1 members, i.e. n · n / T. This is what the quota measures.
 */
export function messagesPerSecond(n: number, intervalS: number): number {
  return sendsPerSecond(n, intervalS) * n;
}

/**
 * The cap check the ADR promises: for every group size from 1 to `maxN`,
 * neither the sends nor the counted messages exceed `capPerS`. Returns the
 * first n that breaks it, or null.
 */
export function firstOverCap(maxN = 200, capPerS: number = REALTIME_MSG_CAP_PER_S): number | null {
  for (let n = 1; n <= maxN; n++) {
    const t = liveIntervalS(n);
    if (sendsPerSecond(n, t) > capPerS || messagesPerSecond(n, t) > capPerS) return n;
  }
  return null;
}
