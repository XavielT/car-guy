/**
 * The one door into the trip machine (IMP 29092026 Phase 5B, ADR-27/28).
 *
 * Every input — a fix from the foreground watcher (lib/trips/live.ts), a batch
 * from the background task (lib/trips/task.ts), "Iniciar viaje", "Terminar",
 * a tick — goes through `feed()`, one at a time. The machine's state is read
 * from `trip_state` on every call and written back by applyStep: the task can
 * run in a fresh JS context with nothing in memory, and the screen and the
 * task never hold two versions of it.
 *
 * Also keeps the live store (lib/trips/liveStore.ts) in step with the machine,
 * so the cluster shows a trip the background task opened.
 *
 * No React, no expo-location: the callers own the GPS and the service.
 */
import { getDb } from '../db/client';
import { recordNote } from '../diagnostics';
import { settings as settingsRepo } from '../db/repos';
import { trips } from '../db/tripOps';
import type { Trip } from '../db/types';
import { applyStep, loadState, type Applied } from './finalize';
import { displayKmh, effectiveSpeed, haversine, isJump, type Fix } from './geo';
import { resolveTripCfg, stepAll, type TripCfg, type TripInput, type TripMachineState } from './machine';
import { getLiveTrip, reduceLive, setLiveTrip, type LiveTrip } from './liveStore';
import { startableFixes } from './freshness';
import { tripsMode } from './settings';

/** Who a trip opened by this feed belongs to. Auto trips: the active vehicle, as driver. */
export type FeedCtx = { vehicleId?: string | null; role?: Trip['role'] };

export type FeedResult = {
  state: TripMachineState;
  applied: Applied[];
  /** The last intensity change the machine asked for in this feed, if any. */
  switchTo?: 'watching' | 'recording';
};

/** The speed from which the live "moving" clock runs (m/s), as in the machine's stop rule. */
const MOVING_MS = 1.5;

let queue: Promise<unknown> = Promise.resolve();
/** The previous fix, for the live numbers only (displacement speed, jitter). */
let prevFix: Fix | null = null;

function serial<T>(work: () => Promise<T>): Promise<T> {
  const next = queue.then(work, work);
  queue = next.catch(() => undefined);
  return next;
}

const isFix = (x: TripInput): x is Fix => typeof (x as { type?: unknown }).type !== 'string';

/** Defaults + Ajustes → avanzado (`trips_thresholds`); detection only in Automático. */
export async function currentTripCfg(): Promise<TripCfg> {
  const [mode, thresholds] = await Promise.all([tripsMode(), settingsRepo.get<unknown>('trips_thresholds', null)]);
  const cfg = resolveTripCfg(thresholds as Partial<TripCfg> | string | null);
  cfg.autoDetect = mode === 'auto';
  return cfg;
}

/** The vehicle an automatic trip goes to: the one on Inicio, else the first in the garage. */
async function defaultVehicleId(): Promise<string | null> {
  const db = await getDb();
  const active = await settingsRepo.get<string | null>('active_vehicle_id', null);
  if (active) {
    const row = await db.getFirstAsync<{ id: string }>('SELECT id FROM vehicle WHERE id = ? AND deleted_at IS NULL', [active]);
    if (row) return row.id;
  }
  const first = await db.getFirstAsync<{ id: string }>(
    'SELECT id FROM vehicle WHERE deleted_at IS NULL ORDER BY is_archived, created_at LIMIT 1',
  );
  return first?.id ?? null;
}

/**
 * Runs inputs through the machine and applies every result in order. A trip
 * the machine opens with no vehicle to put it on (empty garage) is not opened:
 * the inputs are dropped and the state stays as it was.
 */
export function feed(input: TripInput | TripInput[], ctx: FeedCtx = {}, opts: { liveFixes?: boolean } = {}): Promise<FeedResult> {
  return serial(async () => {
    const [state, cfg] = await Promise.all([loadState(), currentTripCfg()]);
    // ADR-49: an idle machine never starts a trip on a cached fix (a last-known position from hours ago);
    // a deferred background batch (≤ 60 s) still counts. A recording trip keeps every fix it is given.
    const given = Array.isArray(input) ? input : [input];
    const inputs = state.phase === 'idle' ? dropStaleFixes(given, Date.now()) : given;
    const out: FeedResult = { state, applied: [] };
    if (!inputs.length) return out;

    let vehicleId = ctx.vehicleId ?? null;
    const role: Trip['role'] = ctx.role ?? 'conductor';
    for (const r of stepAll(state, inputs, cfg)) {
      if (r.open && !vehicleId) vehicleId = await defaultVehicleId();
      if (r.open && !vehicleId) break;
      const applied = await applyStep(r, { vehicleId: vehicleId ?? '', role, flushPoints: true });
      out.applied.push(applied);
      out.state = applied.state;
      if (applied.switchTo) out.switchTo = applied.switchTo;
    }

    // The foreground watcher moves the needle per fix itself (pushLiveFix) and feeds in batches.
    await syncLive(out.state, out.applied, opts.liveFixes === false ? [] : inputs.filter(isFix), ctx);
    return out;
  });
}

function dropStaleFixes(inputs: TripInput[], now: number): TripInput[] {
  const fixes = inputs.filter(isFix);
  if (!fixes.length) return inputs;
  const keep = new Set(startableFixes(fixes, now));
  const dropped = fixes.length - keep.size;
  if (dropped) recordNote('trip-fresh', `${dropped} stale fix(es) ignored while idle`);
  return inputs.filter((i) => !isFix(i) || keep.has(i));
}

/** "Now", without a fix: lets an automatic trip notice it has been parked long enough. */
export function tick(t: number = Date.now()): Promise<FeedResult> {
  return feed({ type: 'tick', t });
}

/** The machine's state as stored (no feed). */
export function machineState(): Promise<TripMachineState> {
  return serial(loadState);
}

/**
 * Live store ← machine: a recording trip is on the cluster (opened here, by
 * the task in the background, or before the app was reopened), an idle machine
 * clears it, and each fix moves the numbers.
 */
async function syncLive(state: TripMachineState, applied: Applied[], fixes: Fix[], ctx: FeedCtx): Promise<void> {
  if (state.phase !== 'recording' || !state.trip) {
    if (getLiveTrip()) setLiveTrip(null);
    prevFix = null;
    return;
  }
  const open = state.trip;
  let live = getLiveTrip();
  if (live && live.tripId === open.id && ctx.vehicleId && applied.some((a) => a.adopted === open.id)) {
    live = { ...live, vehicleId: ctx.vehicleId, role: ctx.role ?? live.role };
  }
  if (!live || live.tripId !== open.id) {
    const row = applied.some((a) => a.opened === open.id) ? null : await trips.getById(open.id);
    live = {
      tripId: open.id,
      vehicleId: row?.vehicleId ?? ctx.vehicleId ?? (await defaultVehicleId()) ?? '',
      role: row?.role ?? ctx.role ?? 'conductor',
      startedAt: open.startedAt,
      speedKmh: 0,
      maxKmh: 0,
      distanceM: open.distanceM,
      movingS: 0,
      lastFixAt: null,
      gps: 'none',
    };
    // The machine's distance already counts this batch: start after it, not before
    // (the last fix still lights the GPS lamp).
    const last = fixes.at(-1) ?? null;
    if (last) live = { ...live, lastFixAt: last.t, gps: last.acc != null && last.acc <= 20 ? 'good' : 'weak' };
    prevFix = last;
    setLiveTrip(live);
    return;
  }
  for (const fix of fixes) live = advanceLive(live, fix);
  // The machine's distance is the truth (jump filter, accuracy rules); the live
  // one only fills the gaps between batches.
  setLiveTrip({ ...live, distanceM: open.distanceM });
}

function advanceLive(live: LiveTrip, fix: Fix): LiveTrip {
  // A teleport (GPS glitch, a mock provider switched off) is neither distance nor speed.
  const jump = prevFix != null && isJump(prevFix, fix);
  const speedMs = jump ? fix.speed : effectiveSpeed(prevFix, fix);
  let next = live;
  if (speedMs != null) {
    const stepM = prevFix && !jump ? haversine(prevFix, fix) : 0;
    // Jitter under the accuracy radius is not distance.
    const jitter = stepM < Math.max(fix.acc ?? 0, prevFix?.acc ?? 0) && speedMs < 1;
    next = reduceLive(live, { t: fix.t, speedKmh: displayKmh(speedMs), accM: fix.acc, stepM: jitter ? 0 : stepM, moving: speedMs >= MOVING_MS });
  }
  prevFix = fix;
  return next;
}

/** One fix onto the cluster right away, without the machine (it gets the fix in the next batch). */
export function pushLiveFix(fix: Fix): void {
  const live = getLiveTrip();
  if (live) setLiveTrip(advanceLive(live, fix));
}

/** Puts a trip that is recording (opened in the background, or before a restart) back on the cluster. */
export async function hydrateLive(): Promise<void> {
  const state = await machineState();
  await serial(() => syncLive(state, [], [], {}));
}
