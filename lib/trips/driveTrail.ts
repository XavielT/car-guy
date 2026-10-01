/**
 * Modo conducir's growing trail (IMP 30092026 Phase 4): the open trip's points
 * as the recorder wrote them to trip_point, read incrementally (only the rows
 * after the last one already on the map) so a long drive costs one small
 * query per poll. The recorder flushes every few seconds; the map's own
 * location puck covers the gap.
 */
import { getDb } from '../db/client';
import type { RoutePoint } from '@/components/map/types';
import { effectiveSpeed, type Fix } from './geo';

export type TrailRow = { t: number; lat: number; lng: number; speed: number | null; acc?: number | null };

/**
 * Rows → the map's points, km/h. The speed is the trip detail's (routePointsFromDrawn): the reported GPS
 * speed, or — when a fix has none (web, iOS's −1, Android's "no speed" 0 while moving) — distance ÷ time
 * from the fix before. Without that, every speedless fix drew its piece of the live trail in the
 * "unknown" red. `prev` is the last row already on the map, so an incremental read can derive its first.
 */
export function toRoutePoints(rows: readonly TrailRow[], prev?: TrailRow | null): RoutePoint[] {
  const fix = (r: TrailRow): Fix => ({ t: r.t, lat: r.lat, lng: r.lng, speed: r.speed, acc: r.acc ?? null });
  return rows.map((r, i) => {
    const before = i > 0 ? rows[i - 1] : (prev ?? null);
    const v = effectiveSpeed(before ? fix(before) : null, fix(r));
    return { lat: r.lat, lng: r.lng, t: r.t, speedKmh: v == null ? null : v * 3.6 };
  });
}

/** Appends new points (t strictly after the last) to the trail; the same array when nothing is new. */
export function appendTrail(trail: RoutePoint[], next: readonly RoutePoint[]): RoutePoint[] {
  const lastT = trail.at(-1)?.t ?? -Infinity;
  const fresh = next.filter((p) => (p.t ?? -Infinity) > lastT);
  return fresh.length ? [...trail, ...fresh] : trail;
}

/** The open trip's points after `afterT` (epoch ms), oldest first. */
export async function trailSince(tripId: string, afterT: number): Promise<RoutePoint[]> {
  const db = await getDb();
  // `>=`: the last row already on the map comes back too, so the first new one can derive its speed from it.
  const rows = await db.getAllAsync<TrailRow>(
    'SELECT t, lat, lng, speed, acc FROM trip_point WHERE trip_id = ? AND t >= ? ORDER BY t',
    [tripId, afterT],
  );
  const prev = rows.length && rows[0].t === afterT ? rows[0] : null;
  return toRoutePoints(prev ? rows.slice(1) : rows, prev);
}
