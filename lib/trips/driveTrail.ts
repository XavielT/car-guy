/**
 * Modo conducir's growing trail (IMP 30092026 Phase 4): the open trip's points
 * as the recorder wrote them to trip_point, read incrementally (only the rows
 * after the last one already on the map) so a long drive costs one small
 * query per poll. The recorder flushes every few seconds; the map's own
 * location puck covers the gap.
 */
import { getDb } from '../db/client';
import type { RoutePoint } from '@/components/map/types';

export type TrailRow = { t: number; lat: number; lng: number; speed: number | null };

/** Rows → the map's points; m/s → km/h, a negative or missing speed is unknown. */
export function toRoutePoints(rows: readonly TrailRow[]): RoutePoint[] {
  return rows.map((r) => ({
    lat: r.lat,
    lng: r.lng,
    t: r.t,
    speedKmh: r.speed != null && r.speed >= 0 ? r.speed * 3.6 : null,
  }));
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
  const rows = await db.getAllAsync<TrailRow>(
    'SELECT t, lat, lng, speed FROM trip_point WHERE trip_id = ? AND t > ? ORDER BY t',
    [tripId, afterT],
  );
  return toRoutePoints(rows);
}
