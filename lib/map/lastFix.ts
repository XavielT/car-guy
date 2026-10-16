import { settings } from '../db/repos';

/**
 * The last good position the phone had (IMP 16102026 M-7, ADR-64): where the map starts when there is no fix yet —
 * no permission, GPS still searching, the first seconds. A local setting (not in the synced whitelist: a position is
 * a fact about a phone, and the point of it is never to leave it).
 */
export const LAST_FIX_KEY = 'last_fix';
/** A position is written at most this often: a fix arrives every second. */
const SAVE_EVERY_MS = 30_000;

export type LastFix = { lat: number; lng: number; /** epoch ms of the fix */ t: number };

let lastSaved = 0;

export function saveLastFix(point: { lat: number; lng: number }, t: number, now: number = Date.now()): void {
  if (now - lastSaved < SAVE_EVERY_MS) return;
  lastSaved = now;
  void settings.set(LAST_FIX_KEY, { lat: point.lat, lng: point.lng, t }).catch(() => {});
}

export function parseLastFix(raw: unknown): LastFix | null {
  const v = raw as Partial<LastFix> | null;
  if (!v || typeof v.lat !== 'number' || typeof v.lng !== 'number' || typeof v.t !== 'number') return null;
  if (!Number.isFinite(v.lat) || !Number.isFinite(v.lng) || Math.abs(v.lat) > 90 || Math.abs(v.lng) > 180) return null;
  return { lat: v.lat, lng: v.lng, t: v.t };
}

export async function loadLastFix(): Promise<LastFix | null> {
  return parseLastFix(await settings.get<unknown>(LAST_FIX_KEY, null));
}

/** Tests only. */
export function __resetLastFixThrottle(): void {
  lastSaved = 0;
}
