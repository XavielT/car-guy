/**
 * Modo conducir's growing trail (IMP 30092026 Phase 4): the open trip's points
 * as the recorder wrote them to trip_point, read incrementally (only the rows
 * after the last one already on the map) so a long drive costs one small
 * query per poll. The recorder flushes every few seconds; the map's own
 * location puck covers the gap.
 */
import { getDb } from '../db/client';
import type { RoutePoint } from '@/components/map/types';
import type { Fix } from './geo';
import { segmentSpeedsKmh } from './speed';

/** How much trail before the new rows the speed engine is given (s of GPS ≈ its longest window). */
const CONTEXT_MS = 10_000;

export type TrailRow = { t: number; lat: number; lng: number; speed: number | null; acc?: number | null };

/**
 * Rows → the map's points, km/h. The speed is the trip detail's (routePointsFromDrawn): the reported GPS
 * speed, or — when a fix has none (web, iOS's −1, Android's "no speed" 0 while moving) — distance ÷ time
 * from the fix before. Without that, every speedless fix drew its piece of the live trail in the
 * "unknown" red. `prev` is the last row already on the map, so an incremental read can derive its first.
 */
export function toRoutePoints(rows: readonly TrailRow[], prev?: TrailRow | readonly TrailRow[] | null): RoutePoint[] {
  const fix = (r: TrailRow): Fix => ({ t: r.t, lat: r.lat, lng: r.lng, speed: r.speed, acc: r.acc ?? null });
  // The SpeedEngine over [the row already on the map, ...the new rows]: the trail's colours are the cluster's speeds, not a pair difference.
  // `prev` is the rows already on the map: a few seconds of context warm the engine up, so an incremental read colours like a full one.
  const ctx: readonly TrailRow[] = !prev ? [] : Array.isArray(prev) ? (prev as readonly TrailRow[]) : [prev as TrailRow];
  const all = [...ctx, ...rows];
  const speeds = segmentSpeedsKmh(all.map(fix)).slice(ctx.length);
  return rows.map((r, i) => ({ lat: r.lat, lng: r.lng, t: r.t, speedKmh: speeds[i] ?? null }));
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
  // The last CONTEXT_MS before `afterT` come back too: the engine needs a few seconds of the trail to read the first new row like a full read would.
  const rows = await db.getAllAsync<TrailRow>(
    'SELECT t, lat, lng, speed, acc FROM trip_point WHERE trip_id = ? AND t >= ? ORDER BY t',
    [tripId, afterT - CONTEXT_MS],
  );
  const fresh = rows.filter((r) => r.t > afterT);
  const context = rows.filter((r) => r.t <= afterT);
  return toRoutePoints(fresh, context);
}
