/**
 * Trip state machine — decides when a trip opens, closes, merges or is
 * discarded (IMP 29092026 notes 1–2; docs/imp-29092026/01-research/
 * 01-trip-tracking.md §2.1, ADR-27, ADR-28).
 *
 *   idle (watching) ──3 fixes ≥ 5.5 m/s, acc ≤ 50 m──────────────▶ recording
 *                   └─or > 300 m of displacement within 2 min──▶
 *   recording ──< 1.5 m/s and < 75 m of displacement for 4 min──▶ close 'stop'
 *             ──no good fix for > 10 min────────────────────────▶ close 'gap'
 *             ──manual_stop────────────────────────────────────▶ close 'manual'
 *   close: discard when < 500 m or < 2 min (parking-lot moves, walks)
 *   an auto start ≤ 10 min and ≤ 150 m from where the previous auto trip
 *   ended resumes that trip (`merge`, one row, segments + 1)
 *
 * Manual trips (manual_start) never close on their own: stop and gap detection
 * only apply to `source: 'auto'`. A manual_start while an auto trip is open
 * adopts it (`adopt`), so there are never two trips at once.
 *
 * Pure and synchronous. The state is plain JSON (it lives in `trip_state`);
 * the caller persists it and applies the result. One step emits at most one
 * `close` and at most one `open`/`merge` — when a batch holds a second
 * transition, processing stops there and the unprocessed inputs come back in
 * `rest` (feed them to the next step, or use `stepAll`).
 */
import type { TripPoint, TripSource } from '../db/types';
import { effectiveSpeed, GEO_DEFAULTS, haversine, isJump, segmentDistance, type Fix, type LatLng } from './geo';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export type TripCfg = {
  /** Auto detection armed. Off ("Solo manual"): fixes while idle are ignored. */
  autoDetect: boolean;
  /** Start: this many consecutive fixes at ≥ startSpeedMs … */
  startSpeedMs: number;
  startSamples: number;
  /** … each with accuracy ≤ startAccM. */
  startAccM: number;
  /** Start, alternative: this much displacement within startWindowS. */
  startDisplacementM: number;
  startWindowS: number;
  /** Fixes worse than this are not part of the track. */
  trackAccM: number;
  /** Stop: under stopSpeedMs and within stopRadiusM for stopMinutes. */
  stopSpeedMs: number;
  stopRadiusM: number;
  stopMinutes: number;
  /** No good fix for longer than this closes an auto trip at its last fix. */
  gapMinutes: number;
  /** Closed trips shorter than either are discarded. */
  minDistanceM: number;
  minDurationS: number;
  /** An auto start this close (time and place) to the previous auto end merges. */
  mergeMinutes: number;
  mergeRadiusM: number;
  /** Jump filter: a fix implying more than this from the last one is dropped … */
  maxJumpSpeedMs: number;
  /** … unless this many in a row were dropped (then the last good fix was the bad one). */
  maxJumpRejects: number;
};

export const DEFAULT_TRIP_CFG: Readonly<TripCfg> = Object.freeze({
  autoDetect: true,
  startSpeedMs: 5.5, // research §2.1 (~20 km/h)
  startSamples: 3, // research §2.1
  startAccM: 50, // research §2.1
  startDisplacementM: 300, // research §2.1
  startWindowS: 120, // research §2.1
  trackAccM: GEO_DEFAULTS.trackAccM, // research §2.1 (30 m)
  stopSpeedMs: 1.5, // research §2.1, ADR-28
  stopRadiusM: 75, // ADR-28
  stopMinutes: 4, // ADR-28 (covers traffic lights and Santo Domingo traffic)
  gapMinutes: 10, // ADR-28
  minDistanceM: 500, // ADR-28
  minDurationS: 120, // ADR-28
  mergeMinutes: 10, // ADR-28
  mergeRadiusM: 150, // ADR-28
  maxJumpSpeedMs: GEO_DEFAULTS.maxJumpSpeedMs, // research §2.1 (70 m/s ≈ 250 km/h)
  maxJumpRejects: 5, // ours: recovers when the fix before the jump was the bad one
});

const NUMERIC_KEYS = (Object.keys(DEFAULT_TRIP_CFG) as (keyof TripCfg)[]).filter((k) => k !== 'autoDetect');

/**
 * Defaults + the user's advanced overrides (`trips_thresholds`, JSON or an
 * object). Unknown keys, non-numbers and non-positive values are ignored.
 */
export function resolveTripCfg(overrides?: Partial<TripCfg> | string | null): TripCfg {
  const cfg: TripCfg = { ...DEFAULT_TRIP_CFG };
  let o: unknown = overrides;
  if (typeof o === 'string') {
    try {
      o = JSON.parse(o);
    } catch {
      o = null;
    }
  }
  if (!o || typeof o !== 'object') return cfg;
  const rec = o as Record<string, unknown>;
  for (const k of NUMERIC_KEYS) {
    const v = rec[k];
    if (typeof v === 'number' && Number.isFinite(v) && v > 0) (cfg as Record<string, unknown>)[k] = v;
  }
  if (typeof rec.autoDetect === 'boolean') cfg.autoDetect = rec.autoDetect;
  cfg.startSamples = Math.max(1, Math.round(cfg.startSamples));
  cfg.maxJumpRejects = Math.max(1, Math.round(cfg.maxJumpRejects));
  return cfg;
}

// ---------------------------------------------------------------------------
// State (serializable)
// ---------------------------------------------------------------------------

type Pt = { t: number; lat: number; lng: number };

export type OpenTrip = {
  id: string;
  source: TripSource;
  /** epoch ms */
  startedAt: number;
  startLat: number | null;
  startLng: number | null;
  /** 1 + the number of merges into it. */
  segments: number;
  /** Running distance (same jitter rule as stats) — for the discard decision. */
  distanceM: number;
  /** Last accepted fix. */
  last: Fix | null;
  lastSpeed: number | null;
  /** Where and when the current stationary spell began. */
  still: Pt | null;
  /** Consecutive fixes dropped by the jump filter. */
  rejects: number;
};

/** The last kept auto trip, while it can still be merged into. */
export type ClosedRef = {
  id: string;
  startedAt: number;
  endedAt: number;
  lat: number;
  lng: number;
  startLat: number | null;
  startLng: number | null;
  distanceM: number;
  segments: number;
};

export type TripMachineState = {
  v: 1;
  phase: 'idle' | 'recording';
  trip: OpenTrip | null;
  /** Idle: the fixes of the last startWindowS, for start detection (≤ 30). */
  recent: Fix[];
  /** Idle: consecutive fixes at ≥ startSpeedMs. */
  fastCount: number;
  lastClosed: ClosedRef | null;
};

export function initialTripState(): TripMachineState {
  return { v: 1, phase: 'idle', trip: null, recent: [], fastCount: 0, lastClosed: null };
}

/** Reads `trip_state.json`; anything unreadable starts from idle. */
export function parseTripState(json: string | null | undefined): TripMachineState {
  if (!json) return initialTripState();
  try {
    const s = JSON.parse(json) as TripMachineState;
    if (s && s.v === 1 && (s.phase === 'idle' || s.phase === 'recording') && Array.isArray(s.recent)) return s;
  } catch {
    // fall through
  }
  return initialTripState();
}

// ---------------------------------------------------------------------------
// Inputs and outputs
// ---------------------------------------------------------------------------

export type TripEvent =
  /** The user tapped "Iniciar viaje". lat/lng: a current position, if the caller has one. */
  | { type: 'manual_start'; t: number; lat?: number | null; lng?: number | null }
  /** The user tapped "Terminar". */
  | { type: 'manual_stop'; t: number }
  /** "Now" without a fix — lets stop/gap detection run when no fixes arrive. */
  | { type: 'tick'; t: number };

/** A fix (from watchPositionAsync or the background task) or an event. */
export type TripInput = Fix | TripEvent;

export type CloseReason = 'stop' | 'gap' | 'manual';

export type TripOpenOut = {
  tripId: string;
  source: TripSource;
  /** epoch ms */
  startedAt: number;
  startLat: number | null;
  startLng: number | null;
};

export type TripCloseOut = {
  tripId: string;
  source: TripSource;
  reason: CloseReason;
  startedAt: number;
  /**
   * epoch ms. For 'stop' this is when the car stopped, not when the stop was
   * detected: points with t > endedAt are the parked tail — leave them out of
   * the stats (or delete them).
   */
  endedAt: number;
  endLat: number | null;
  endLng: number | null;
  /** Start position (filled from the first fix when the open had none). */
  startLat: number | null;
  startLng: number | null;
  /** Machine's running distance, all segments. */
  distanceM: number;
  durationS: number;
  segments: number;
  discard: boolean;
  discardReason?: 'distance' | 'duration';
};

export type TripMergeOut = {
  /** The trip that resumes: back to `recording`, ended_at cleared, segments set. */
  tripId: string;
  resumedAt: number;
  pausedS: number;
  segments: number;
};

export type StepResult = {
  state: TripMachineState;
  /** Points to insert, in time order, each tagged with its trip. */
  points: TripPoint[];
  open?: TripOpenOut;
  close?: TripCloseOut;
  merge?: TripMergeOut;
  /** A manual_start took over this open auto trip: set its source to 'manual'. */
  adopt?: { tripId: string };
  /** The location-update intensity changed. */
  switchTo?: 'watching' | 'recording';
  /** Inputs not processed because they hold a second transition — step them next. */
  rest: TripInput[];
};

export type StepOpts = {
  /** Id for a new trip (default: crypto.randomUUID). */
  newId?: () => string;
};

const defaultId = () =>
  globalThis.crypto?.randomUUID?.() ?? `trip_${Date.now().toString(36)}_${Math.random().toString(16).slice(2)}`;

const isEvent = (x: TripInput): x is TripEvent => typeof (x as TripEvent).type === 'string';

/**
 * Converts an expo-location `LocationObject` (structurally — no import) to a
 * Fix. Negative speed/heading (iOS "invalid") become null.
 */
export function fixFromLocation(loc: {
  timestamp: number;
  coords: {
    latitude: number;
    longitude: number;
    speed?: number | null;
    accuracy?: number | null;
    altitude?: number | null;
    heading?: number | null;
  };
}): Fix {
  const c = loc.coords;
  const nn = (v: number | null | undefined) => (v == null || !Number.isFinite(v) || v < 0 ? null : v);
  return {
    t: loc.timestamp,
    lat: c.latitude,
    lng: c.longitude,
    speed: nn(c.speed),
    acc: nn(c.accuracy),
    alt: c.altitude ?? null,
    heading: nn(c.heading),
  };
}

// ---------------------------------------------------------------------------
// Step
// ---------------------------------------------------------------------------

type Emit = {
  points: TripPoint[];
  open?: TripOpenOut;
  close?: TripCloseOut;
  merge?: TripMergeOut;
  adopt?: { tripId: string };
};

type Ctx = { cfg: TripCfg; newId: () => string };

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

/**
 * Advances the machine over `input` (one fix/event or a batch, any order — it
 * is sorted by t). Never mutates `state`.
 */
export function step(
  state: TripMachineState,
  input: TripInput | readonly TripInput[],
  cfg: TripCfg = DEFAULT_TRIP_CFG,
  opts: StepOpts = {},
): StepResult {
  const inputs = (Array.isArray(input) ? input.slice() : [input as TripInput]).sort((a, b) => a.t - b.t);
  const ctx: Ctx = { cfg, newId: opts.newId ?? defaultId };
  let s = clone(state);
  const startPhase = s.phase;
  const res: StepResult = { state: s, points: [], rest: [] };

  for (let i = 0; i < inputs.length; i++) {
    const snapshot = clone(s);
    const e: Emit = { points: [] };
    const x = inputs[i];
    if (isEvent(x)) onEvent(s, x, e, ctx);
    else onFix(s, x, e, ctx);

    if (conflicts(res, e)) {
      s = snapshot;
      res.rest = inputs.slice(i);
      break;
    }
    res.points.push(...e.points);
    if (e.close) res.close = e.close;
    if (e.open) res.open = e.open;
    if (e.adopt) res.adopt = e.adopt;
    if (e.merge) {
      // Closed earlier in this same step and resumed: the row never left
      // `recording`, so drop the close and keep the merge (segments + 1).
      if (res.close && res.close.tripId === e.merge.tripId) delete res.close;
      res.merge = e.merge;
    }
  }

  res.state = s;
  if (s.phase !== startPhase) res.switchTo = s.phase === 'recording' ? 'recording' : 'watching';
  return res;
}

/** Steps until nothing is left in `rest`; apply the results in order. */
export function stepAll(
  state: TripMachineState,
  input: TripInput | readonly TripInput[],
  cfg: TripCfg = DEFAULT_TRIP_CFG,
  opts: StepOpts = {},
): StepResult[] {
  const out: StepResult[] = [];
  let r = step(state, input, cfg, opts);
  out.push(r);
  while (r.rest.length) {
    r = step(r.state, r.rest, cfg, opts);
    out.push(r);
  }
  return out;
}

/** True when `e` would be a second transition for this step. */
function conflicts(res: StepResult, e: Emit): boolean {
  if (e.close && (res.close || res.open || res.merge)) return true;
  if ((e.open || e.merge) && (res.open || res.merge)) return true;
  if (e.merge && res.close && res.close.tripId !== e.merge.tripId) return true;
  return false;
}

function onEvent(s: TripMachineState, ev: TripEvent, e: Emit, ctx: Ctx): void {
  const tr = s.trip;
  switch (ev.type) {
    case 'manual_start': {
      if (tr) {
        if (tr.source === 'auto') {
          tr.source = 'manual';
          tr.still = null;
          e.adopt = { tripId: tr.id };
        }
        return;
      }
      const lat = ev.lat ?? null;
      const lng = ev.lng ?? null;
      openTrip(s, e, ctx, 'manual', ev.t, lat != null && lng != null ? { lat, lng } : null);
      return;
    }
    case 'manual_stop': {
      if (!tr) return;
      closeTrip(s, e, ctx, 'manual', Math.max(ev.t, tr.last?.t ?? ev.t), tr.last);
      return;
    }
    case 'tick': {
      if (!tr || tr.source !== 'auto' || !tr.last) return;
      const { cfg } = ctx;
      const sinceLast = ev.t - tr.last.t;
      if (sinceLast > cfg.gapMinutes * 60_000) {
        closeTrip(s, e, ctx, 'gap', tr.last.t, tr.last);
      } else if (tr.still && ev.t - tr.still.t >= cfg.stopMinutes * 60_000) {
        closeTrip(s, e, ctx, 'stop', tr.still.t, tr.still);
      } else if (sinceLast >= cfg.stopMinutes * 60_000 && (tr.lastSpeed ?? 0) < cfg.stopSpeedMs) {
        // No fixes at all while slow: with a distanceInterval the OS sends
        // nothing to a parked phone.
        const at = tr.still ?? tr.last;
        closeTrip(s, e, ctx, 'stop', at.t, at);
      }
      return;
    }
  }
}

function onFix(s: TripMachineState, f: Fix, e: Emit, ctx: Ctx): void {
  if (s.trip) onFixRecording(s, f, e, ctx);
  else onFixIdle(s, f, e, ctx);
}

function onFixIdle(s: TripMachineState, f: Fix, e: Emit, ctx: Ctx): void {
  const { cfg } = ctx;
  if (!cfg.autoDetect) return;
  if (f.acc != null && f.acc > cfg.startAccM) {
    s.fastCount = 0;
    return;
  }
  const prev = s.recent[s.recent.length - 1];
  if (prev && f.t <= prev.t) return;
  const v = effectiveSpeed(prev, f, cfg.startAccM);

  s.recent.push(f);
  const horizon = f.t - cfg.startWindowS * 1000;
  while (s.recent.length > 1 && s.recent[0].t < horizon) s.recent.shift();
  if (s.recent.length > 30) s.recent.splice(0, s.recent.length - 30);

  s.fastCount = v != null && v >= cfg.startSpeedMs ? s.fastCount + 1 : 0;

  let from = -1;
  if (s.fastCount >= cfg.startSamples) {
    // The streak plus the fix just before it (where the car pulled away),
    // unless that one is stale (> 30 s before the streak).
    const first = s.recent.length - s.fastCount;
    const before = s.recent[first - 1];
    from = before && s.recent[first].t - before.t <= GEO_DEFAULTS.maxDerivedDtS * 1000 ? first - 1 : first;
  } else if (s.recent.length > 1 && haversine(s.recent[0], f) > cfg.startDisplacementM) {
    from = 0;
  }
  if (from < 0) return;

  const fixes = s.recent.slice(from);
  s.recent = [];
  s.fastCount = 0;
  openTrip(s, e, ctx, 'auto', fixes[0].t, fixes[0]);
  for (const x of fixes) onFixRecording(s, x, e, ctx);
}

function onFixRecording(s: TripMachineState, f: Fix, e: Emit, ctx: Ctx): void {
  const { cfg } = ctx;
  const tr = s.trip!;
  if (f.acc != null && f.acc > cfg.trackAccM) return;
  const last = tr.last;
  let jumpReset = false;

  if (last) {
    if (f.t <= last.t) return;
    const dt = f.t - last.t;
    if (tr.source === 'auto') {
      if (dt > cfg.gapMinutes * 60_000) {
        closeTrip(s, e, ctx, 'gap', last.t, last);
        onFixIdle(s, f, e, ctx);
        return;
      }
      if (dt >= cfg.stopMinutes * 60_000 && haversine(last, f) < cfg.stopRadiusM) {
        // Parked with no fixes in between (distanceInterval), now moving again.
        const at = tr.still ?? last;
        closeTrip(s, e, ctx, 'stop', at.t, at);
        onFixIdle(s, f, e, ctx);
        return;
      }
    }
    if (isJump(last, f, cfg.maxJumpSpeedMs)) {
      tr.rejects += 1;
      if (tr.rejects < cfg.maxJumpRejects) return;
      jumpReset = true; // the fix before the jump was the outlier: restart from here
    }
  }

  const v = jumpReset ? f.speed : effectiveSpeed(last, f, cfg.trackAccM);
  if (last && !jumpReset) tr.distanceM += segmentDistance(last, f, v);
  tr.rejects = 0;
  if (tr.startLat == null || tr.startLng == null) {
    tr.startLat = f.lat;
    tr.startLng = f.lng;
  }
  e.points.push({
    tripId: tr.id,
    t: f.t,
    lat: f.lat,
    lng: f.lng,
    speed: f.speed,
    acc: f.acc,
    alt: f.alt ?? null,
    heading: f.heading ?? null,
  });
  tr.last = f;
  tr.lastSpeed = v;

  // Stop detection. Tracked for manual trips too (a UI may show "detenido"),
  // but only an auto trip closes on it.
  if (v != null && v >= cfg.stopSpeedMs) {
    tr.still = null;
  } else if (v != null || tr.still) {
    if (!tr.still || haversine(tr.still, f) > cfg.stopRadiusM) {
      tr.still = { t: f.t, lat: f.lat, lng: f.lng };
    } else if (tr.source === 'auto' && f.t - tr.still.t >= cfg.stopMinutes * 60_000) {
      closeTrip(s, e, ctx, 'stop', tr.still.t, tr.still);
    }
  }
}

function openTrip(s: TripMachineState, e: Emit, ctx: Ctx, source: TripSource, t: number, at: LatLng | null): void {
  const { cfg } = ctx;
  const lc = s.lastClosed;
  const canMerge =
    source === 'auto' &&
    lc != null &&
    at != null &&
    t - lc.endedAt <= cfg.mergeMinutes * 60_000 &&
    t >= lc.endedAt &&
    haversine(lc, at) <= cfg.mergeRadiusM;

  if (canMerge) {
    const segments = lc.segments + 1;
    s.trip = {
      id: lc.id,
      source: 'auto',
      startedAt: lc.startedAt,
      startLat: lc.startLat,
      startLng: lc.startLng,
      segments,
      distanceM: lc.distanceM,
      last: null,
      lastSpeed: null,
      still: null,
      rejects: 0,
    };
    e.merge = { tripId: lc.id, resumedAt: t, pausedS: (t - lc.endedAt) / 1000, segments };
  } else {
    const id = ctx.newId();
    s.trip = {
      id,
      source,
      startedAt: t,
      startLat: at?.lat ?? null,
      startLng: at?.lng ?? null,
      segments: 1,
      distanceM: 0,
      last: null,
      lastSpeed: null,
      still: null,
      rejects: 0,
    };
    e.open = { tripId: id, source, startedAt: t, startLat: at?.lat ?? null, startLng: at?.lng ?? null };
  }
  s.phase = 'recording';
  s.lastClosed = null;
  s.recent = [];
  s.fastCount = 0;
}

function closeTrip(
  s: TripMachineState,
  e: Emit,
  ctx: Ctx,
  reason: CloseReason,
  endedAt: number,
  at: LatLng | null,
): void {
  const { cfg } = ctx;
  const tr = s.trip!;
  const durationS = Math.max(0, (endedAt - tr.startedAt) / 1000);
  const discardReason =
    tr.distanceM < cfg.minDistanceM ? 'distance' : durationS < cfg.minDurationS ? 'duration' : undefined;
  e.close = {
    tripId: tr.id,
    source: tr.source,
    reason,
    startedAt: tr.startedAt,
    endedAt,
    endLat: at?.lat ?? null,
    endLng: at?.lng ?? null,
    startLat: tr.startLat,
    startLng: tr.startLng,
    distanceM: tr.distanceM,
    durationS,
    segments: tr.segments,
    discard: discardReason != null,
    ...(discardReason ? { discardReason } : {}),
  };
  s.lastClosed =
    tr.source === 'auto' && !discardReason && at
      ? {
          id: tr.id,
          startedAt: tr.startedAt,
          endedAt,
          lat: at.lat,
          lng: at.lng,
          startLat: tr.startLat,
          startLng: tr.startLng,
          distanceM: tr.distanceM,
          segments: tr.segments,
        }
      : null;
  s.trip = null;
  s.phase = 'idle';
  s.recent = [];
  s.fastCount = 0;
}

export const isRecording = (s: TripMachineState) => s.phase === 'recording';
