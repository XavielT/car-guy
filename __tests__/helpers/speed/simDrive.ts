/**
 * Synthetic drives with GROUND TRUTH (IMP 03112026 SPEC-I §I3, PROMPT-10 step 1). A drive is a speed profile v(t) (m/s) along a gently
 * curving road; the simulator integrates it to positions and then makes fixes the way a phone does: position errors that are correlated
 * from fix to fix (a GPS error drifts, it does not flicker), a Doppler speed with its own small noise, and the platform quirks that broke
 * the old needle: Android's "speed 0 while moving", iOS's −1, the web's null, 1 Hz vs 0.2 Hz, tunnels and urban canyons.
 * Deterministic: the same seed gives the same drive, so a number in a table can be reproduced.
 */
import type { Fix } from '@/lib/trips/geo';

export type SpeedMode = 'doppler' | 'android0' | 'ios-1' | 'null';

export function rng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const gauss = () => {
    const u = Math.max(1e-9, next());
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * next());
  };
  return { next, gauss };
}

type Seg = { to: number; over: number };
/** A profile from (target km/h, seconds to get there) steps, then holds: piecewise-linear speed, so accelerations are exact. */
export function profileFrom(start: number, steps: { kmh: number; over: number; hold?: number }[]): { v: (t: number) => number; duration: number; phases: { t0: number; t1: number; kind: 'steady' | 'accel' | 'brake' }[] } {
  const pts: { t: number; v: number }[] = [{ t: 0, v: start / 3.6 }];
  const phases: { t0: number; t1: number; kind: 'steady' | 'accel' | 'brake' }[] = [];
  let t = 0;
  let v = start / 3.6;
  for (const s of steps) {
    const to = s.kmh / 3.6;
    if (s.over > 0) {
      phases.push({ t0: t, t1: t + s.over, kind: to > v ? 'accel' : to < v ? 'brake' : 'steady' });
      t += s.over;
      pts.push({ t, v: to });
    }
    v = to;
    if (s.hold) {
      phases.push({ t0: t, t1: t + s.hold, kind: 'steady' });
      t += s.hold;
      pts.push({ t, v });
    }
  }
  const at = (x: number) => {
    if (x <= 0) return pts[0].v;
    for (let i = 1; i < pts.length; i++) {
      if (x <= pts[i].t) {
        const a = pts[i - 1];
        const b = pts[i];
        return b.t === a.t ? b.v : a.v + ((b.v - a.v) * (x - a.t)) / (b.t - a.t);
      }
    }
    return pts[pts.length - 1].v;
  };
  return { v: at, duration: t, phases };
}

export const PROFILES = {
  /** 0 → 100 km/h, a long cruise, a gentle slowdown. */
  highway: () => profileFrom(0, [{ kmh: 100, over: 30 }, { kmh: 100, over: 0, hold: 150 }, { kmh: 80, over: 20, hold: 40 }, { kmh: 0, over: 25 }]),
  /** Stop-and-go: six cycles of 0 → 50 → 0 with red lights. */
  city: () => {
    const steps: { kmh: number; over: number; hold?: number }[] = [];
    for (let i = 0; i < 6; i++) steps.push({ kmh: 50, over: 12, hold: 15 }, { kmh: 0, over: 9, hold: 18 });
    return profileFrom(0, steps);
  },
  /** 90 km/h, then a hard stop at 6 m/s², then away again. */
  hardBrake: () => profileFrom(90, [{ kmh: 90, over: 0, hold: 40 }, { kmh: 0, over: 90 / 3.6 / 6, hold: 15 }, { kmh: 60, over: 14, hold: 30 }]),
} as const;
export type ProfileName = keyof typeof PROFILES;

export type SimOpts = {
  profile: ProfileName;
  seed?: number;
  /** Seconds between fixes (1 = 1 Hz, 5 = 0.2 Hz). */
  dt?: number;
  mode?: SpeedMode;
  /** Mean and spread of the reported accuracy, m. */
  acc?: { mean: number; sd: number };
  /** Std-dev of the position error as a multiple of the reported accuracy. Default 0.5. */
  posSigma?: number;
  /** Std-dev of the Doppler speed error, m/s. */
  dopplerSigma?: number;
  /** [from, to] seconds with NO fixes (a tunnel). */
  dropout?: [number, number];
  /** Urban canyon: every N-th fix carries an extra position error of this many metres. */
  canyon?: { every: number; metres: number };
};

export type Sim = {
  fixes: Fix[];
  /** True speed at time t (seconds from the start), m/s. */
  truth: (t: number) => number;
  truthDistanceM: number;
  truthTopMs: number;
  duration: number;
  phases: { t0: number; t1: number; kind: 'steady' | 'accel' | 'brake' }[];
  startMs: number;
};

const START = Date.parse('2026-11-04T14:00:00Z');
const M_PER_DEG_LAT = 111_194.9;

export function simulate(o: SimOpts): Sim {
  const R = rng(o.seed ?? 7);
  const prof = PROFILES[o.profile]();
  const dt = o.dt ?? 1;
  const acc = o.acc ?? { mean: 6, sd: 2 };
  const posSigma = o.posSigma ?? 0.5;
  const dopSigma = o.dopplerSigma ?? 0.15;
  const mode = o.mode ?? 'doppler';

  // True path: integrate at 0.1 s, heading wanders slowly (a curving road) so displacement is not trivially a straight line.
  const STEP = 0.1;
  const pos: { x: number; y: number }[] = [{ x: 0, y: 0 }];
  let heading = 0.3;
  let x = 0;
  let y = 0;
  let dist = 0;
  let top = 0;
  for (let t = 0; t < prof.duration; t += STEP) {
    const v = prof.v(t + STEP / 2);
    top = Math.max(top, v);
    heading += 0.004 * Math.sin(t / 37) * STEP * 10 + 0.0005 * Math.sin(t / 11);
    x += Math.cos(heading) * v * STEP;
    y += Math.sin(heading) * v * STEP;
    dist += v * STEP;
    pos.push({ x, y });
  }
  const at = (t: number) => pos[Math.min(pos.length - 1, Math.max(0, Math.round(t / STEP)))];

  const lat0 = 18.4861;
  const lng0 = -69.9312;
  const mPerDegLng = M_PER_DEG_LAT * Math.cos((lat0 * Math.PI) / 180);
  const fixes: Fix[] = [];
  // Correlated position error (AR(1), ρ = 0.9): GPS errors drift.
  let ex = 0;
  let ey = 0;
  let n = 0;
  for (let t = 0; t <= prof.duration + 1e-9; t += dt) {
    n++;
    if (o.dropout && t >= o.dropout[0] && t <= o.dropout[1]) continue;
    const a = Math.max(3, acc.mean + acc.sd * R.gauss());
    const sig = posSigma * a;
    ex = 0.9 * ex + Math.sqrt(1 - 0.81) * sig * R.gauss();
    ey = 0.9 * ey + Math.sqrt(1 - 0.81) * sig * R.gauss();
    let px = at(t).x + ex;
    let py = at(t).y + ey;
    if (o.canyon && n % o.canyon.every === 0) {
      px += o.canyon.metres * (R.next() < 0.5 ? -1 : 1) * (0.6 + 0.4 * R.next());
      py += o.canyon.metres * (R.next() < 0.5 ? -1 : 1) * (0.6 + 0.4 * R.next());
    }
    const truth = prof.v(t);
    let speed: number | null;
    if (mode === 'doppler') speed = Math.max(0, truth + dopSigma * R.gauss());
    else if (mode === 'android0') speed = 0;
    else if (mode === 'ios-1') speed = -1;
    else speed = null;
    fixes.push({ t: START + Math.round(t * 1000), lat: lat0 + py / M_PER_DEG_LAT, lng: lng0 + px / mPerDegLng, speed, acc: a });
  }
  return { fixes, truth: prof.v, truthDistanceM: dist, truthTopMs: top, duration: prof.duration, phases: prof.phases, startMs: START };
}
