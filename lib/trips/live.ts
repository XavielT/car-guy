/**
 * The foreground trip recorder (IMP 29092026 Phase 5A, ADR-27…31).
 *
 * `startManualTrip` asks for the foreground location permission, opens a trip
 * through the state machine (lib/trips/machine.ts, event `manual_start`) and
 * subscribes to watchPositionAsync at 1 Hz. Every fix goes through
 * `stepAll`; the results are applied in the machine's order by
 * lib/trips/finalize.ts, the GPS points are batched (every 5 s or 20 points)
 * and the live store (lib/trips/liveStore.ts) is updated for the cluster.
 * `stopTrip` sends `manual_stop` and finalizes: stats, route, odometer.
 *
 * Module scope on purpose: the subscription outlives the screen that started
 * it (tabs change, Inicio unmounts) and ends only with stopTrip or with the app
 * (Part B's background task makes it survive that too). A manual trip never
 * ends on its own. Part A runs the machine with `autoDetect: false`.
 */
import * as Location from 'expo-location';
import { Platform } from 'react-native';

import { tripPoints } from '../db/tripOps';
import type { Trip, TripPoint } from '../db/types';
import { recordError } from '../diagnostics';
import { applyStep, loadState, type Applied } from './finalize';
import { displayKmh, effectiveSpeed, haversine, type Fix } from './geo';
import { fixFromLocation, resolveTripCfg, stepAll, type TripInput, type TripMachineState } from './machine';
import { getLiveTrip, reduceLive, setLiveTrip, type LiveTrip } from './liveStore';

const cfg = resolveTripCfg({ autoDetect: false });

const FLUSH_MS = 5000;
const FLUSH_POINTS = 20;
/** A parked phone sends no fixes (distanceInterval): a tick keeps the clock honest. */
const TICK_MS = 20_000;
const MOVING_MS = 1.5;

type Session = {
  vehicleId: string;
  role: Trip['role'];
  state: TripMachineState;
  sub: Location.LocationSubscription | null;
  buffer: TripPoint[];
  flushTimer: ReturnType<typeof setInterval> | null;
  tickTimer: ReturnType<typeof setInterval> | null;
  prev: Fix | null;
  /** Serialises the async work: fixes arrive faster than SQLite answers. */
  queue: Promise<unknown>;
};

let session: Session | null = null;

export type StartResult = { ok: true } | { ok: false; reason: 'permission' | 'services' | 'busy' | 'error' };
export type StopResult =
  | { kind: 'saved'; distanceM: number; tripId: string }
  | { kind: 'discarded'; distanceM: number; durationS: number; reason: 'distance' | 'duration'; tripId: string }
  | { kind: 'none' };

export function isRecordingTrip(): boolean {
  return session != null;
}

async function ensurePermission(): Promise<StartResult | null> {
  let perm = await Location.getForegroundPermissionsAsync();
  if (!perm.granted && perm.canAskAgain) perm = await Location.requestForegroundPermissionsAsync();
  if (!perm.granted) return { ok: false, reason: 'permission' };
  if (Platform.OS !== 'web' && !(await Location.hasServicesEnabledAsync())) return { ok: false, reason: 'services' };
  return null;
}

function enqueue<T>(s: Session, work: () => Promise<T>): Promise<T> {
  const next = s.queue.then(work, work);
  s.queue = next.catch((error) => recordError('trip', error));
  return next;
}

async function flush(s: Session): Promise<void> {
  if (!s.buffer.length) return;
  const batch = s.buffer.splice(0, s.buffer.length);
  await tripPoints.insertBatch(batch);
}

/** Runs inputs through the machine and applies every result; returns the last applied. */
async function feed(s: Session, input: TripInput | TripInput[]): Promise<Applied | null> {
  let last: Applied | null = null;
  for (const r of stepAll(s.state, input, cfg)) {
    s.buffer.push(...r.points);
    // Points before the close is finalized: its stats read them from the DB.
    if (r.close || s.buffer.length >= FLUSH_POINTS) await flush(s);
    last = await applyStep(r, { vehicleId: s.vehicleId, role: s.role, flushPoints: false });
    s.state = last.state;
    if (last.opened) {
      const t = r.open!.startedAt;
      setLiveTrip({
        tripId: last.opened,
        vehicleId: s.vehicleId,
        role: s.role,
        startedAt: t,
        speedKmh: 0,
        maxKmh: 0,
        distanceM: 0,
        movingS: 0,
        lastFixAt: null,
        gps: 'none',
      });
    }
  }
  return last;
}

function onLocation(s: Session, loc: Location.LocationObject): void {
  const fix = fixFromLocation(loc);
  const speedMs = effectiveSpeed(s.prev, fix);
  const stepM = s.prev ? haversine(s.prev, fix) : 0;
  const trip = getLiveTrip();
  // The live numbers: jitter under the accuracy radius is not distance.
  if (trip && speedMs != null) {
    const jitter = stepM < Math.max(fix.acc ?? 0, s.prev?.acc ?? 0) && speedMs < 1;
    setLiveTrip(
      reduceLive(trip, {
        t: fix.t,
        speedKmh: displayKmh(speedMs),
        accM: fix.acc,
        stepM: jitter ? 0 : stepM,
        moving: speedMs >= MOVING_MS,
      }) as LiveTrip,
    );
  }
  s.prev = fix;
  void enqueue(s, () => feed(s, fix));
}

export async function startManualTrip(vehicleId: string, role: Trip['role'] = 'conductor'): Promise<StartResult> {
  if (session) return { ok: false, reason: 'busy' };
  try {
    const denied = await ensurePermission();
    if (denied) return denied;

    const s: Session = {
      vehicleId,
      role,
      state: await loadState(),
      sub: null,
      buffer: [],
      flushTimer: null,
      tickTimer: null,
      prev: null,
      queue: Promise.resolve(),
    };
    session = s;
    await enqueue(s, () => feed(s, { type: 'manual_start', t: Date.now() }));

    s.sub = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: 3 },
      (loc) => onLocation(s, loc),
      (reason) => recordError('trip-gps', reason),
    );
    s.flushTimer = setInterval(() => void enqueue(s, () => flush(s)), FLUSH_MS);
    s.tickTimer = setInterval(() => void enqueue(s, () => feed(s, { type: 'tick', t: Date.now() })), TICK_MS);
    return { ok: true };
  } catch (error) {
    recordError('trip-start', error);
    await teardown();
    return { ok: false, reason: 'error' };
  }
}

async function teardown(): Promise<void> {
  const s = session;
  session = null;
  if (!s) return;
  s.sub?.remove();
  if (s.flushTimer) clearInterval(s.flushTimer);
  if (s.tickTimer) clearInterval(s.tickTimer);
  setLiveTrip(null);
}

export async function stopTrip(): Promise<StopResult> {
  const s = session;
  if (!s) return { kind: 'none' };
  s.sub?.remove();
  s.sub = null;
  try {
    const applied = await enqueue(s, async () => {
      await flush(s);
      return feed(s, { type: 'manual_stop', t: Date.now() });
    });
    const closed = applied?.closed;
    if (!closed) return { kind: 'none' };
    return closed.discarded
      ? { kind: 'discarded', distanceM: closed.distanceM, durationS: closed.durationS, reason: closed.reason ?? 'distance', tripId: closed.tripId }
      : { kind: 'saved', distanceM: closed.distanceM, tripId: closed.tripId };
  } catch (error) {
    recordError('trip-stop', error);
    return { kind: 'none' };
  } finally {
    await teardown();
  }
}
