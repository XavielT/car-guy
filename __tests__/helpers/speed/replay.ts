/**
 * The replay scorer (SPEC-I §I3). A "pipeline" turns a fix stream into the four things a driver sees: the needle, the live max, and the
 * saved max / distance / moving average. `oldPipeline` is the code as it was before PROMPT-10 (the engine's `advanceLive` + `reduceLive`
 * for the needle, `geo.stats()` for the saved trip), kept here so the "before" numbers can be reproduced after the code has moved on.
 */
import { effectiveSpeed, haversine, isJump, type Fix } from '@/lib/trips/geo';
import { displayKmh, legacyReduceLive, legacyStats } from './legacy';
import type { LiveTrip } from '@/lib/trips/liveStore';
import { simulate, type ProfileName, type Sim, type SimOpts } from './simDrive';

export type PipelineResult = {
  /** The needle after each fix, km/h, with the fix time (ms). */
  needle: { t: number; kmh: number }[];
  liveMaxKmh: number;
  savedMaxKmh: number | null;
  distanceM: number;
  avgMovingKmh: number | null;
};
export type Pipeline = (fixes: Fix[]) => PipelineResult;

const MOVING_MS = 1.5;

/** The pre-PROMPT-10 pipeline, verbatim in behaviour. */
export const oldPipeline: Pipeline = (fixes) => {
  let live: LiveTrip = { tripId: 't', vehicleId: 'v', role: 'conductor', startedAt: fixes[0]?.t ?? 0, speedKmh: 0, maxKmh: 0, distanceM: 0, movingS: 0, lastFixAt: null, gps: 'none' };
  let prev: Fix | null = null;
  const needle: PipelineResult['needle'] = [];
  for (const fix of fixes) {
    const jump = prev != null && isJump(prev, fix);
    const speedMs = jump ? fix.speed : effectiveSpeed(prev, fix);
    if (speedMs != null) {
      const stepM = prev && !jump ? haversine(prev, fix) : 0;
      const jitter = stepM < Math.max(fix.acc ?? 0, prev?.acc ?? 0) && speedMs < 1;
      live = legacyReduceLive(live, { t: fix.t, speedKmh: displayKmh(speedMs), accM: fix.acc, stepM: jitter ? 0 : stepM, moving: speedMs >= MOVING_MS });
    }
    needle.push({ t: fix.t, kmh: live.speedKmh });
    prev = fix;
  }
  const s = legacyStats(fixes);
  return { needle, liveMaxKmh: live.maxKmh, savedMaxKmh: s.maxKmh, distanceM: s.distanceM, avgMovingKmh: s.avgMovingKmh };
};

export type Case = { id: string; label: string; opts: SimOpts };

export const CASES: Case[] = [
  { id: 'highway-1hz', label: 'Highway cruise, 1 Hz, Doppler', opts: { profile: 'highway' } },
  { id: 'highway-0.2hz', label: 'Highway cruise, 0.2 Hz, Doppler', opts: { profile: 'highway', dt: 5 } },
  { id: 'city-1hz', label: 'City stop-go, 1 Hz, Doppler', opts: { profile: 'city' } },
  { id: 'city-canyon', label: 'City, urban canyon (30–60 m noise)', opts: { profile: 'city', acc: { mean: 35, sd: 10 }, posSigma: 0.5, canyon: { every: 9, metres: 45 } } },
  { id: 'hard-brake', label: 'Hard braking at 6 m/s²', opts: { profile: 'hardBrake' } },
  { id: 'tunnel', label: 'Highway with a 12 s tunnel', opts: { profile: 'highway', dropout: [80, 92] } },
  { id: 'android-zero', label: 'Android "speed 0 while moving"', opts: { profile: 'city', mode: 'android0' } },
  { id: 'ios-minus1', label: 'iOS speed −1 (invalid)', opts: { profile: 'highway', mode: 'ios-1' } },
  { id: 'web-null', label: 'Web, no speed at all, 1 Hz', opts: { profile: 'highway', mode: 'null' } },
  { id: 'web-null-city', label: 'Web, no speed at all, city', opts: { profile: 'city', mode: 'null' } },
];

const SEEDS = [11, 23, 37];

export type Metrics = {
  rmseSteady: number | null;
  rmseAccel: number | null;
  rmseBrake: number | null;
  /** |live max − true top|, km/h. */
  topLiveErr: number;
  /** |saved max − true top|, km/h. */
  topSavedErr: number;
  /** |live max − saved max|, km/h: the two must be the same number. */
  liveSavedGap: number;
  distErrPct: number;
  /** Seconds the needle is late at the 50 % point of a hard brake (null when the drive has none that hard). */
  brakeLagS: number | null;
};

const rmse = (xs: number[]) => (xs.length ? Math.sqrt(xs.reduce((a, b) => a + b * b, 0) / xs.length) : null);

export function metricsFor(sim: Sim, r: PipelineResult): Metrics {
  const steady: number[] = [];
  const accel: number[] = [];
  const brake: number[] = [];
  for (const n of r.needle) {
    const ts = (n.t - sim.startMs) / 1000;
    const err = n.kmh - sim.truth(ts) * 3.6;
    // Skip 4 s after a phase starts: the needle may not have caught up with a change that has just begun, that is the lag metric's job.
    const ph = sim.phases.find((p) => ts >= p.t0 && ts < p.t1);
    if (!ph) continue;
    if (ph.kind === 'steady') {
      if (ts - ph.t0 > 4) steady.push(err);
    } else if (ph.kind === 'accel') accel.push(err);
    else brake.push(err);
  }
  let lag: number | null = null;
  const hard = sim.phases.find((p) => p.kind === 'brake' && (sim.truth(p.t0) - sim.truth(p.t1)) / (p.t1 - p.t0) > 4);
  if (hard) {
    const v0 = sim.truth(hard.t0) * 3.6;
    const half = v0 / 2;
    const tTruth = hard.t0 + (hard.t1 - hard.t0) / 2;
    const cross = r.needle.find((n) => (n.t - sim.startMs) / 1000 >= hard.t0 && n.kmh <= half);
    lag = cross ? (cross.t - sim.startMs) / 1000 - tTruth : null;
  }
  const topMs = sim.truthTopMs * 3.6;
  return {
    rmseSteady: rmse(steady),
    rmseAccel: rmse(accel),
    rmseBrake: rmse(brake),
    topLiveErr: Math.abs(r.liveMaxKmh - topMs),
    topSavedErr: r.savedMaxKmh == null ? topMs : Math.abs(r.savedMaxKmh - topMs),
    liveSavedGap: Math.abs(r.liveMaxKmh - (r.savedMaxKmh ?? 0)),
    distErrPct: (Math.abs(r.distanceM - sim.truthDistanceM) / sim.truthDistanceM) * 100,
    brakeLagS: lag,
  };
}

/** Mean of a metric over the seeds (nulls ignored). */
const mean = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => x != null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};

export function runCase(p: Pipeline, c: Case): Metrics {
  const ms = SEEDS.map((seed) => {
    const sim = simulate({ ...c.opts, seed });
    return metricsFor(sim, p(sim.fixes));
  });
  const pick = (k: keyof Metrics) => mean(ms.map((m) => m[k]));
  return {
    rmseSteady: pick('rmseSteady'),
    rmseAccel: pick('rmseAccel'),
    rmseBrake: pick('rmseBrake'),
    topLiveErr: pick('topLiveErr') as number,
    topSavedErr: pick('topSavedErr') as number,
    liveSavedGap: pick('liveSavedGap') as number,
    distErrPct: pick('distErrPct') as number,
    brakeLagS: pick('brakeLagS'),
  };
}

export const fmt = (n: number | null, d = 1) => (n == null ? '–' : n.toFixed(d));

export function table(p: Pipeline): { id: string; label: string; m: Metrics }[] {
  return CASES.map((c) => ({ id: c.id, label: c.label, m: runCase(p, c) }));
}

export function markdown(rows: ReturnType<typeof table>): string {
  const head = '| Case | RMSE steady | RMSE accel | RMSE brake | Top (live) err | Top (saved) err | live↔saved gap | Distance err % | Brake lag s |\n|---|---|---|---|---|---|---|---|---|';
  const body = rows
    .map((r) => `| ${r.label} | ${fmt(r.m.rmseSteady)} | ${fmt(r.m.rmseAccel)} | ${fmt(r.m.rmseBrake)} | ${fmt(r.m.topLiveErr)} | ${fmt(r.m.topSavedErr)} | ${fmt(r.m.liveSavedGap)} | ${fmt(r.m.distErrPct, 2)} | ${fmt(r.m.brakeLagS)} |`)
    .join('\n');
  return `${head}\n${body}`;
}

export type { ProfileName };

import { analyzeFixes } from '@/lib/trips/speed';

/** The SpeedEngine pipeline: the needle, the live max and the saved max are the SAME numbers by construction. */
export const newPipeline: Pipeline = (fixes) => {
  const { samples, summary } = analyzeFixes(fixes);
  return {
    needle: samples.map((s) => ({ t: s.t, kmh: s.displayKmh })),
    liveMaxKmh: summary.topKmh ?? 0,
    savedMaxKmh: summary.topKmh,
    distanceM: summary.distanceM,
    avgMovingKmh: summary.avgMovingKmh,
  };
};
