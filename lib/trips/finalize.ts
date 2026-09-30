/**
 * Applying the trip machine's output to the database (IMP 29092026 Phase 5).
 * No React: the foreground recorder (lib/trips/live.ts) uses it now, the
 * background task (Part B) will too.
 *
 * Order per step result, as lib/trips/machine.ts requires: open (or merge),
 * adopt, points, state, then the close — and only then any mode switch.
 */
import { loadTripStateJson, saveTripStateJson, suggestOdometerFromTrip, tripPoints, trips } from '../db/tripOps';
import type { Trip, TripPoint } from '../db/types';
import { bbox as bboxOf, encodePolyline, simplify, stats } from './geo';
import { parseTripState, type StepResult, type TripCloseOut, type TripMachineState } from './machine';

const iso = (t: number) => new Date(t).toISOString();

export async function loadState(): Promise<TripMachineState> {
  return parseTripState(await loadTripStateJson());
}

export type Applied = {
  state: TripMachineState;
  opened?: string;
  /** An open automatic trip that manual_start took over. */
  adopted?: string;
  closed?: { tripId: string; discarded: boolean; distanceM: number; durationS: number; reason?: 'distance' | 'duration'; trip: Trip | null };
  switchTo?: 'watching' | 'recording';
};

/**
 * One step's result into the DB. `vehicleId` and `role` belong to the trip
 * being opened (the machine does not know vehicles). Points can be buffered by
 * the caller: pass `flushPoints` to write them here, or not and write later.
 */
export async function applyStep(
  r: StepResult,
  ctx: { vehicleId: string; role: Trip['role']; flushPoints?: boolean },
): Promise<Applied> {
  const out: Applied = { state: r.state, switchTo: r.switchTo };
  if (r.open) {
    await trips.upsert({
      id: r.open.tripId,
      vehicleId: ctx.vehicleId,
      source: r.open.source,
      status: 'recording',
      role: ctx.role,
      startedAt: iso(r.open.startedAt),
      endedAt: null,
      startLat: r.open.startLat,
      startLng: r.open.startLng,
      startLabel: '',
      endLabel: '',
      distanceM: 0,
      durationS: 0,
      movingS: 0,
      speedBuckets: '[0,0,0,0,0]',
      segments: 1,
      notes: '',
      deletedAt: null,
    });
    out.opened = r.open.tripId;
  }
  if (r.merge) await trips.upsert({ id: r.merge.tripId, status: 'recording', endedAt: null, segments: r.merge.segments });
  if (r.adopt) {
    // "Iniciar viaje" names the car and the role: they win over the automatic guess.
    await trips.upsert({ id: r.adopt.tripId, source: 'manual', ...(ctx.vehicleId ? { vehicleId: ctx.vehicleId, role: ctx.role } : {}) });
    out.adopted = r.adopt.tripId;
  }
  if (ctx.flushPoints !== false && r.points.length) await tripPoints.insertBatch(r.points as TripPoint[]);
  await saveTripStateJson(JSON.stringify(r.state));
  if (r.close) out.closed = await finalizeTrip(r.close);
  return out;
}

/**
 * A closed trip: discarded (too short — its points go too), or done with its
 * stats over the points up to `endedAt` (a 'stop' close is dated when the car
 * stopped; what follows is the parked tail), a simplified route, and the
 * odometer suggestion (ADR-30; re-finalizing a merged trip updates the same
 * reading).
 */
export async function finalizeTrip(close: TripCloseOut): Promise<NonNullable<Applied['closed']>> {
  const all = await tripPoints.forTrip(close.tripId);
  const points = all.filter((p) => p.t <= close.endedAt);
  const s = stats(points.map((p) => ({ t: p.t, lat: p.lat, lng: p.lng, speed: p.speed, acc: p.acc, alt: p.alt, heading: p.heading })));

  if (close.discard || s.distanceM < 1) {
    await trips.upsert({ id: close.tripId, status: 'discarded', endedAt: iso(close.endedAt), distanceM: Math.round(s.distanceM || close.distanceM) });
    return {
      tripId: close.tripId,
      discarded: true,
      distanceM: s.distanceM || close.distanceM,
      durationS: close.durationS,
      reason: close.discardReason ?? 'distance',
      trip: null,
    };
  }

  const route = simplify(s.track, 8);
  const first = s.track[0];
  const last = s.track[s.track.length - 1];
  const done = await trips.upsert({
    id: close.tripId,
    status: 'done',
    endedAt: iso(close.endedAt),
    startLat: close.startLat ?? first?.lat ?? null,
    startLng: close.startLng ?? first?.lng ?? null,
    endLat: close.endLat ?? last?.lat ?? null,
    endLng: close.endLng ?? last?.lng ?? null,
    distanceM: Math.round(s.distanceM),
    durationS: Math.round(s.durationS),
    movingS: Math.round(s.movingS),
    avgKmh: s.avgKmh,
    avgMovingKmh: s.avgMovingKmh,
    // The max is a median of reported speeds, the moving average is distance over time;
    // a max below the average reads as a bug, so it is never shown lower.
    maxKmh: s.maxKmh != null || s.avgMovingKmh != null ? Math.max(s.maxKmh ?? 0, s.avgMovingKmh ?? 0) : null,
    speedBuckets: JSON.stringify(s.speedBuckets.map((x) => Math.round(x))),
    polyline: route.length > 1 ? encodePolyline(route) : null,
    bbox: JSON.stringify(s.bbox ?? bboxOf(route)),
    segments: close.segments,
  });
  await suggestOdometerFromTrip(done as Trip);
  return { tripId: close.tripId, discarded: false, distanceM: s.distanceM, durationS: s.durationS, trip: done as Trip };
}
