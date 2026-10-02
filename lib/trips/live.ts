/**
 * "Iniciar viaje" / "Terminar" (IMP 29092026 Phase 5A/5B, ADR-27…31).
 *
 * Everything goes through lib/trips/engine.ts: `manual_start` opens a trip (or
 * adopts the automatic one already open — never two trips), `manual_stop`
 * finalizes it (stats, route, odometer). Where the fixes come from depends on
 * the mode:
 *
 * - Solo manual: this module subscribes to watchPositionAsync at 1 Hz, with a
 *   tick every 20 s so a parked phone keeps the clock honest. Module scope on
 *   purpose: the subscription outlives the screen that started it and ends
 *   with stopTrip or with the app.
 * - Automático armed: the background task is the only GPS source; starting
 *   switches it to grabando, stopping back to vigilando. A second watcher
 *   would feed every fix twice.
 *
 * A manual trip never ends on its own.
 */
import * as Location from 'expo-location';
import { Platform } from 'react-native';

import type { Trip } from '../db/types';
import { recordError } from '../diagnostics';
import { isAutoArmed, switchIntensity } from './auto';
import { feed, machineState, pushLiveFix, type FeedResult } from './engine';
import type { Fix } from './geo';
import { getLiveTrip } from './liveStore';
import { fixFromLocation } from './machine';
import { WEB_PRECISE_GPS } from './webGeo';

/** A parked phone sends no fixes (distanceInterval): a tick keeps the clock honest. */
const TICK_MS = 20_000;
/** Fixes reach the machine (and SQLite) in batches; the needle moves per fix. */
const FLUSH_MS = 5000;
const FLUSH_FIXES = 20;

type Watcher = {
  sub: Location.LocationSubscription | null;
  tickTimer: ReturnType<typeof setInterval> | null;
  flushTimer: ReturnType<typeof setInterval> | null;
  buffer: Fix[];
};

let watcher: Watcher | null = null;

export type StartResult = { ok: true } | { ok: false; reason: 'permission' | 'services' | 'busy' | 'error' };
export type StopResult =
  | { kind: 'saved'; distanceM: number; tripId: string }
  | { kind: 'discarded'; distanceM: number; durationS: number; reason: 'distance' | 'duration'; tripId: string }
  | { kind: 'none' };

/** A trip is on the cluster: recording from here or from the background task. */
export function isRecordingTrip(): boolean {
  return watcher != null || getLiveTrip() != null;
}

async function ensurePermission(): Promise<StartResult | null> {
  let perm = await Location.getForegroundPermissionsAsync();
  if (!perm.granted && perm.canAskAgain) perm = await Location.requestForegroundPermissionsAsync();
  if (!perm.granted) return { ok: false, reason: 'permission' };
  if (Platform.OS !== 'web' && !(await Location.hasServicesEnabledAsync())) return { ok: false, reason: 'services' };
  return null;
}

function flush(w: Watcher): Promise<unknown> {
  if (!w.buffer.length) return Promise.resolve();
  const batch = w.buffer.splice(0, w.buffer.length);
  return feed(batch, {}, { liveFixes: false }).catch((e) => recordError('trip', e));
}

async function startWatcher(): Promise<void> {
  const w: Watcher = { sub: null, tickTimer: null, flushTimer: null, buffer: [] };
  watcher = w;
  w.sub = await Location.watchPositionAsync(
    { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: 3, ...WEB_PRECISE_GPS } as Location.LocationOptions,
    (loc) => {
      const fix = fixFromLocation(loc);
      pushLiveFix(fix);
      w.buffer.push(fix);
      if (w.buffer.length >= FLUSH_FIXES) void flush(w);
    },
    (reason) => recordError('trip-gps', reason),
  );
  w.flushTimer = setInterval(() => void flush(w), FLUSH_MS);
  w.tickTimer = setInterval(() => void feed({ type: 'tick', t: Date.now() }).catch((e) => recordError('trip', e)), TICK_MS);
}

/** Stops the GPS; the fixes still buffered go to the machine first. */
async function stopWatcher(): Promise<void> {
  const w = watcher;
  watcher = null;
  if (!w) return;
  w.sub?.remove();
  if (w.tickTimer) clearInterval(w.tickTimer);
  if (w.flushTimer) clearInterval(w.flushTimer);
  await flush(w);
}

export async function startManualTrip(vehicleId: string, role: Trip['role'] = 'conductor'): Promise<StartResult> {
  if (watcher) return { ok: false, reason: 'busy' };
  try {
    const state = await machineState();
    // An open automatic trip is adopted by manual_start; a manual one is already "Iniciar".
    if (state.phase === 'recording' && state.trip?.source === 'manual') return { ok: false, reason: 'busy' };
    const denied = await ensurePermission();
    if (denied) return denied;

    await feed({ type: 'manual_start', t: Date.now() }, { vehicleId, role });
    if (await isAutoArmed()) await switchIntensity('recording');
    else await startWatcher();
    return { ok: true };
  } catch (error) {
    recordError('trip-start', error);
    await stopWatcher();
    return { ok: false, reason: 'error' };
  }
}

/** Solo manual, after a restart mid-trip: the watcher again, if the permission is still there. */
export async function resumeManualTrip(): Promise<void> {
  if (watcher) return;
  const perm = await Location.getForegroundPermissionsAsync();
  if (perm.granted) await startWatcher();
}

function toStop(result: FeedResult): StopResult {
  const closed = [...result.applied].reverse().find((a) => a.closed)?.closed;
  if (!closed) return { kind: 'none' };
  return closed.discarded
    ? { kind: 'discarded', distanceM: closed.distanceM, durationS: closed.durationS, reason: closed.reason ?? 'distance', tripId: closed.tripId }
    : { kind: 'saved', distanceM: closed.distanceM, tripId: closed.tripId };
}

/** "Terminar": ends whatever is recording — a manual trip or an automatic one. */
export async function stopTrip(): Promise<StopResult> {
  await stopWatcher();
  try {
    const result = await feed({ type: 'manual_stop', t: Date.now() });
    if (await isAutoArmed()) await switchIntensity('watching');
    return toStop(result);
  } catch (error) {
    recordError('trip-stop', error);
    return { kind: 'none' };
  }
}
