/**
 * Test helpers for lib/trips: a GPX reader and a replay that feeds fixes
 * through the state machine and applies its results to an in-memory "DB"
 * the way the recorder / background task will.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Fix } from '@/lib/trips/geo';
import {
  DEFAULT_TRIP_CFG,
  initialTripState,
  stepAll,
  type StepResult,
  type TripCfg,
  type TripCloseOut,
  type TripInput,
  type TripMachineState,
} from '@/lib/trips/machine';
import type { TripPoint } from '@/lib/db/types';

export const DRIVE_GPX = resolve(__dirname, '../../docs/imp-29092026/fixtures/drive-synthetic.gpx');

/** trkpts → fixes. GPX has no speed or accuracy: speed null (derived), acc as given. */
export function parseGpx(xml: string, acc: number | null = 5): Fix[] {
  const out: Fix[] = [];
  const re = /<trkpt lat="([-\d.]+)" lon="([-\d.]+)">[\s\S]*?<time>([^<]+)<\/time>[\s\S]*?<\/trkpt>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    out.push({ t: Date.parse(m[3]), lat: Number(m[1]), lng: Number(m[2]), speed: null, acc });
  }
  return out;
}

export const loadDrive = (acc: number | null = 5) => parseGpx(readFileSync(DRIVE_GPX, 'utf8'), acc);

export type FakeTrip = {
  id: string;
  source: 'auto' | 'manual';
  status: 'recording' | 'done' | 'discarded';
  segments: number;
  points: TripPoint[];
  closes: TripCloseOut[];
};

export type Replay = {
  state: TripMachineState;
  trips: Map<string, FakeTrip>;
  results: StepResult[];
  switches: ('watching' | 'recording')[];
};

let n = 0;
export const seqId = () => `t${++n}`;

/** Applies one step result the way the caller must: open/merge → points → close. */
export function apply(r: Replay, out: StepResult): void {
  r.results.push(out);
  if (out.open) {
    r.trips.set(out.open.tripId, {
      id: out.open.tripId,
      source: out.open.source,
      status: 'recording',
      segments: 1,
      points: [],
      closes: [],
    });
  }
  if (out.merge) {
    const t = r.trips.get(out.merge.tripId)!;
    t.status = 'recording';
    t.segments = out.merge.segments;
  }
  if (out.adopt) r.trips.get(out.adopt.tripId)!.source = 'manual';
  for (const p of out.points) {
    const t = r.trips.get(p.tripId);
    if (!t) throw new Error(`point for unknown trip ${p.tripId}`);
    if (t.points.length && t.points[t.points.length - 1].t >= p.t) throw new Error('points out of order / duplicate t');
    t.points.push(p);
  }
  if (out.close) {
    const t = r.trips.get(out.close.tripId)!;
    t.status = out.close.discard ? 'discarded' : 'done';
    t.closes.push(out.close);
  }
  if (out.switchTo) r.switches.push(out.switchTo);
  r.state = out.state;
}

export function newReplay(state: TripMachineState = initialTripState()): Replay {
  return { state, trips: new Map(), results: [], switches: [] };
}

/** Feeds inputs in batches of `batch` (the background task delivers arrays). */
export function feed(r: Replay, inputs: TripInput[], cfg: TripCfg = DEFAULT_TRIP_CFG, batch = 1): Replay {
  for (let i = 0; i < inputs.length; i += batch) {
    for (const out of stepAll(r.state, inputs.slice(i, i + batch), cfg, { newId: seqId })) apply(r, out);
  }
  return r;
}

export const openTrips = (r: Replay) => [...r.trips.values()].filter((t) => t.status === 'recording');
