/**
 * The SpeedEngine (IMP 03112026 SPEC-I §I1, ADR-72). ONE implementation of "how fast, how far, how long" that the live needle, the saved
 * trip, the map colours and the recaps all use, so the same drive gives the same numbers everywhere. Pure TypeScript: no React, no I/O.
 *
 *   input gate    a fix worse than 50 m has no speed; a jump (> 70 m/s from the last fix) is dropped; a measurement that implies an
 *                 impossible acceleration (> 9 m/s² up, > 14 m/s² braking) is ignored, not believed
 *   measurements  Doppler speed (variance from the accuracy) AND the slope of a 5 s sliding window of positions (where Doppler is
 *                 missing or lies: Android's "0 while moving", iOS −1, the web's null). A pair difference is only the fallback
 *   fusion        a 1-D Kalman filter whose process noise rises while the car is accelerating, so it follows a hard brake quickly
 *                 and is calm at cruise; reset after a gap > 5 s
 *   stop logic    hysteresis: 0 only when the Doppler (if any) AND the positions agree the car is parked for two fixes
 *   top speed     the highest speed SUSTAINED for ≥ 2 s on fixes with accuracy ≤ 20 m: never a single spike
 *   distance      the integral of the fused speed (not the polyline of noisy fixes), plus the straight chord across a gap
 *   averages      moving (distance ÷ time the car moved) and total (distance ÷ elapsed), kept apart so nobody compares the wrong one
 */
import { haversine, isJump, type Fix } from './geo';

export const SPEED_CFG = {
  /** A fix less accurate than this has no usable speed (m). */
  maxAccM: 50,
  /** Only fixes this accurate may set the top speed (m). */
  peakAccM: 20,
  /** Longer than this between fixes and the filter starts over (s). */
  resetGapS: 5,
  /** Window of positions for the regression (s). */
  windowS: 5,
  /** Plausibility limits (m/s²). */
  maxAccelUp: 9,
  maxAccelDown: 14,
  /** Top speed must be held this long (s). */
  sustainS: 2,
  /** Below this the car may be parked (m/s); the moving threshold of the old code. */
  stopMs: 0.5,
  movingMs: 1.5,
  /** Display lead (s): the needle shows where the car is about to be, a little. */
  leadS: 0.4,
  /** A displacement speed is only derived over gaps up to this (s), like the old code. */
  maxChordDtS: 30,
} as const;

export type SpeedSample = {
  t: number;
  /** The fused speed, m/s (no lead, no stop clamp except a parked car = 0). */
  ms: number;
  /** What the needle shows: fused + a small lead, 0 only by the hysteresis rule, km/h. */
  displayKmh: number;
  /** True where no Doppler speed backed this value (web, iPhone, Android without hasSpeed): the UI says "estimada". */
  estimated: boolean;
  moving: boolean;
  acc: number | null;
  /** False for a fix with no measurement at all (the first fix of a trip with no Doppler): there is nothing yet to say about its speed. */
  known: boolean;
};

export type SpeedSummary = {
  distanceM: number;
  elapsedS: number;
  movingS: number;
  avgKmh: number | null;
  avgMovingKmh: number | null;
  /** Sustained top speed, km/h, and when (epoch ms). */
  topKmh: number | null;
  topAt: number | null;
  /** True when no fix was accurate enough (≤ 20 m) and the top speed comes from worse ones: shown, but not to be trusted to ±2 km/h. */
  topApprox: boolean;
};

const accOf = (f: Fix) => (f.acc != null && Number.isFinite(f.acc) ? f.acc : 8);

type Pt = { t: number; x: number; y: number; acc: number };

/** A straight-line fit of the window, for the outlier pass. */
function fitLine(pts: Pt[]): { px: (t: number) => number; py: (t: number) => number } | null {
  const n = pts.length;
  const t0 = pts[0].t;
  const ts = pts.map((p) => (p.t - t0) / 1000);
  const tm = ts.reduce((a, b) => a + b, 0) / n;
  const xm = pts.reduce((a, p) => a + p.x, 0) / n;
  const ym = pts.reduce((a, p) => a + p.y, 0) / n;
  let stt = 0;
  let sx = 0;
  let sy = 0;
  for (let i = 0; i < n; i++) {
    const d = ts[i] - tm;
    stt += d * d;
    sx += d * (pts[i].x - xm);
    sy += d * (pts[i].y - ym);
  }
  if (stt < 0.5) return null;
  return { px: (t) => xm + (sx / stt) * ((t - t0) / 1000 - tm), py: (t) => ym + (sy / stt) * ((t - t0) / 1000 - tm) };
}

/** Least-squares slope of x(t), y(t) over `pts` (m/s) and the std-dev of that slope. Null when there is no usable spread in time. */
function windowSpeed(all: Pt[]): { v: number; sd: number; span: number } | null {
  let pts = all;
  // One robust pass: a fix far from the straight-line fit (an urban-canyon jump) is left out of the slope.
  if (pts.length >= 5) {
    const first = fitLine(pts);
    if (first) {
      const res = pts.map((p) => Math.hypot(p.x - first.px(p.t), p.y - first.py(p.t)));
      const sorted = [...res].sort((a, b) => a - b);
      const med = sorted[Math.floor(sorted.length / 2)];
      const keep = pts.filter((_, i) => res[i] <= Math.max(2.5 * med, 6));
      if (keep.length >= 3 && keep.length < pts.length) pts = keep;
    }
  }
  const n = pts.length;
  if (n < 2) return null;
  const t0 = pts[0].t;
  const ts = pts.map((p) => (p.t - t0) / 1000);
  const tm = ts.reduce((a, b) => a + b, 0) / n;
  let stt = 0;
  let sx = 0;
  let sy = 0;
  const xm = pts.reduce((a, p) => a + p.x, 0) / n;
  const ym = pts.reduce((a, p) => a + p.y, 0) / n;
  for (let i = 0; i < n; i++) {
    const dt = ts[i] - tm;
    stt += dt * dt;
    sx += dt * (pts[i].x - xm);
    sy += dt * (pts[i].y - ym);
  }
  if (stt < 0.5) return null;
  const v = Math.hypot(sx / stt, sy / stt);
  const accMean = pts.reduce((a, p) => a + p.acc, 0) / n;
  // Position errors drift (they are correlated), so the textbook slope variance is optimistic: floor it.
  const sd = Math.max(1.1, (0.9 * accMean) / Math.sqrt(stt));
  return { v, sd, span: ts[n - 1] - ts[0] };
}

export class SpeedEngine {
  private cfg = SPEED_CFG;
  private origin: Fix | null = null;
  private win: Pt[] = [];
  private last: Fix | null = null;
  private lastMs = 0;
  private v = 0;
  private P = 100;
  private aEma = 0;
  /** The last RAW measurement (Doppler, else the uncorrected window slope): the acceleration is read from these, never from the fused output, so the lag correction cannot feed on itself. */
  private lastRaw: number | null = null;
  /** Android without `hasSpeed` reports exactly 0 all the time. Once a trip has shown it (several 0s while the positions move), every 0 is treated as "no speed". */
  private zeroLiar = 0;
  /** Consecutive fixes whose Doppler was exactly 0. A real stop has them too, so one alone proves nothing. */
  private zeroRun = 0;
  private knownBefore = false;
  /** Fixes in a row where the fast estimate disagrees with the fused value by more than a plausible error: the speed is changing, so the filter must listen. */
  private devCount = 0;
  /** Per measurement source: how many times in a row a (consistent) value was refused as implausible. See `take`. */
  private rej: Record<string, { n: number; z: number }> = {};
  private stopCount = 0;
  private stopped = false;
  private moveCount = 0;
  private started = false;
  // totals
  private dist = 0;
  private movingS = 0;
  private firstT: number | null = null;
  private lastT: number | null = null;
  // top speed: contiguous run of usable samples
  private run: { t: number; ms: number }[] = [];
  private top: { ms: number; at: number } | null = null;
  /** The same, over every accepted fix: used only when no fix was accurate enough for `top` (an urban canyon). */
  private loose: { ms: number; at: number } | null = null;
  private looseRun: { t: number; ms: number }[] = [];

  /** Feed one fix. Returns the sample, or null when the fix was rejected (bad accuracy, duplicate time, a jump). */
  push(fix: Fix): SpeedSample | null {
    const c = this.cfg;
    if (accOf(fix) > c.maxAccM && fix.acc != null) return null;
    const prev = this.last;
    if (prev && fix.t <= prev.t) return null;
    if (prev && isJump(prev, fix)) return null;
    if (!this.origin) this.origin = fix;
    const dt = prev ? (fix.t - prev.t) / 1000 : 0;
    const gap = prev != null && dt > c.resetGapS;

    // Position window (metres in a local plane around the first fix).
    const o = this.origin;
    const mLat = 111_194.9;
    const mLng = mLat * Math.cos((o.lat * Math.PI) / 180);
    if (gap) this.win = [];
    this.win.push({ t: fix.t, x: (fix.lng - o.lng) * mLng, y: (fix.lat - o.lat) * mLat, acc: accOf(fix) });
    // A steady car gets a long window (quiet); a changing speed a short one (it follows).
    const winS = 10;
    while (this.win.length > 2 && (fix.t - this.win[0].t) / 1000 > winS) this.win.shift();

    // Window slope, or the chord from the previous fix when the window is too thin (0.2 Hz, after a gap).
    let wv: { v: number; sd: number } | null = null;
    const ws = windowSpeed(this.win);
    // A slope over a window is the speed at its MIDDLE: while the car accelerates it lags by a·span/2, so shift it to the end of the window.
    const aUse = Math.max(-6, Math.min(3.5, this.aEma));
    // A second, FAST estimate from the last 3 s: noisier, but it follows a change of speed that the long window is still averaging away.
    let wf: { v: number; sd: number } | null = null;
    {
      const tail = this.win.filter((p) => fix.t - p.t <= 3000);
      const w = tail.length >= 3 ? windowSpeed(tail) : null;
      if (w) wf = { v: Math.max(0, w.v + 0.5 * aUse * (w.span / 2)), sd: Math.max(1.6, w.sd * 1.6) };
    }
    if (ws) wv = { v: Math.max(0, ws.v + 0.5 * aUse * (ws.span / 2)), sd: ws.sd + Math.abs(aUse) * 0.15 };
    else if (prev && dt > 0 && dt <= c.maxChordDtS) {
      const d = haversine(prev, fix);
      wv = { v: d / dt, sd: Math.max(0.6, (1.4 * (accOf(prev) + accOf(fix))) / 2 / dt) };
    }

    // The pair difference with the previous fix: very noisy, but it answers at once. Only used where there is no Doppler.
    let wp: { v: number; sd: number } | null = null;
    if (prev && dt > 0 && dt <= 3) wp = { v: haversine(prev, fix) / dt, sd: Math.max(1.8, (0.8 * (accOf(prev) + accOf(fix))) / dt) };

    // Doppler: valid when reported and not the Android "0 while the positions say we are flying".
    let dop: { v: number; sd: number } | null = null;
    if (fix.speed != null && Number.isFinite(fix.speed) && fix.speed >= 0) {
      const chordV = prev != null && dt > 0 && dt <= c.maxChordDtS ? haversine(prev, fix) / dt : 0;
      const chordBig = prev != null && haversine(prev, fix) > accOf(prev) + accOf(fix);
      // A 0 is a lie only after several in a row while the positions keep moving: right after a real stop the window still remembers the drive.
      this.zeroRun = fix.speed === 0 ? this.zeroRun + 1 : 0;
      // Only the LAST 3 s of positions count as evidence: the long window still remembers the drive for seconds after a real stop.
      const recent = this.win.filter((p) => fix.t - p.t <= 3000);
      let movingNow = false;
      if (recent.length >= 3) {
        const dx = Math.max(...recent.map((p) => p.x)) - Math.min(...recent.map((p) => p.x));
        const dy = Math.max(...recent.map((p) => p.y)) - Math.min(...recent.map((p) => p.y));
        const span = (recent[recent.length - 1].t - recent[0].t) / 1000;
        const accR = recent.reduce((a, p) => a + p.acc, 0) / recent.length;
        movingNow = span > 0 && Math.hypot(dx, dy) > accR * 1.5 && Math.hypot(dx, dy) / span > 2;
      }
      const contradicted = fix.speed === 0 && this.zeroRun >= 4 && movingNow;
      if (contradicted) this.zeroLiar++;
      const lies = fix.speed === 0 && (contradicted || (this.zeroLiar >= 3 && this.zeroRun >= 2 && movingNow));
      if (!lies) dop = { v: fix.speed, sd: 0.25 + 0.01 * accOf(fix) };
    }

    // ---- fuse
    let ms: number;
    if (!this.started || gap) {
      // (Re)start: the best single measurement.
      ms = dop ? dop.v : wv ? wv.v : 0;
      this.v = ms;
      this.P = (dop ? dop.sd : wv ? Math.max(wv.sd, 1) : 5) ** 2;
      this.aEma = 0;
      this.started = true;
    } else {
      const sigA = (dop ? 0.4 : 0.22) + 2.6 * Math.min(1, Math.abs(this.aEma) / 2.5);
      this.P += (sigA * Math.max(dt, 0.2)) ** 2;
      // Carry the current acceleration forward (damped): the filter follows a ramp instead of trailing it.
      if (dt <= 2) this.v = Math.max(0, this.v + Math.max(-6, Math.min(3.5, this.aEma)) * dt * 0.6);
      if (!dop && wf && Math.abs(wf.v - this.v) > 2.5) this.devCount++;
      else this.devCount = 0;
      if (this.devCount >= 2) this.P = Math.max(this.P, 16);
      const lim = (z: number) => (z >= this.v ? c.maxAccelUp : c.maxAccelDown) * Math.max(dt, 0.5) + 1.0;
      const upd = (z: number, sd: number) => {
        const K = this.P / (this.P + sd * sd);
        this.v += K * (z - this.v);
        this.P *= 1 - K;
      };
      // A measurement that implies an impossible acceleration is ignored, but if the SAME value keeps coming (three times) it is the filter that is
      // wrong, not the world: it wins. Without this a state pulled to 0 by Android's fake zeros could never recover.
      const take = (key: string, z: number, sd: number, slack = 0) => {
        if (Math.abs(z - this.v) <= lim(z) + slack) {
          this.rej[key] = { n: 0, z };
          upd(z, sd);
          return;
        }
        const r = this.rej[key];
        const same = r && Math.abs(z - r.z) < 3;
        this.rej[key] = { n: same ? r.n + 1 : 1, z };
        if (this.rej[key].n >= 3) {
          this.v = z;
          this.P = Math.max(this.P, sd * sd * 4);
          this.rej[key] = { n: 0, z };
        }
      };
      if (dop) take('dop', dop.v, dop.sd);
      // With a trustworthy Doppler the positions only vote on the stop logic: fusing a noisier slope in would only add noise.
      if (!dop && wv) take('win', wv.v, wv.sd);
      if (!dop && wf) take('fast', wf.v, wf.sd);
      if (!dop && wp) take('pair', wp.v, wp.sd, 2);
      // The positions' errors are correlated, so several measurements per fix are NOT independent: never let the filter become sure of itself,
      // or it stops following a change of speed. The floor rises with the acceleration.
      if (!dop) this.P = Math.max(this.P, (0.7 + 2.0 * Math.min(1, Math.abs(this.aEma) / 1.5)) ** 2, this.devCount >= 2 ? 6 : 0);
      ms = this.v;
    }
    ms = Math.max(0, ms);
    {
      const raw = dop ? dop.v : ws ? ws.v : null;
      if (raw != null && this.lastRaw != null && dt > 0 && dt <= 2) {
        const a = Math.max(-8, Math.min(5, (raw - this.lastRaw) / dt));
        this.aEma = 0.65 * this.aEma + 0.35 * a;
      } else if (dt > 2 || raw == null) this.aEma *= 0.5;
      this.lastRaw = raw;
    }

    // ---- stop hysteresis
    const dopLow = dop ? dop.v < c.stopMs : true;
    const windowQuiet = (() => {
      const w3 = this.win.filter((p) => fix.t - p.t <= 3000);
      if (w3.length < 2) return dop != null || !wv || wv.v < c.stopMs;
      const dx = Math.max(...w3.map((p) => p.x)) - Math.min(...w3.map((p) => p.x));
      const dy = Math.max(...w3.map((p) => p.y)) - Math.min(...w3.map((p) => p.y));
      const accMean = w3.reduce((s, p) => s + p.acc, 0) / w3.length;
      // The 3 s of positions decide (the long window still remembers the drive). Without a Doppler the fast slope must agree too.
      return Math.hypot(dx, dy) <= accMean * 1.2 && (dop != null || !wf || wf.v < 1.2);
    })();
    if (dopLow && windowQuiet && ms < 2) this.stopCount++;
    else this.stopCount = 0;
    const best = dop ? dop.v : wv ? wv.v : ms;
    if (!this.stopped && this.stopCount >= 2) {
      this.stopped = true;
      this.v = 0;
      this.P = 0.5;
    } else if (this.stopped) {
      // A Doppler above 1 m/s ends a stop on its own (the positions are still inside the error circle for seconds after a start); without one, the positions must agree.
      if (dop ? dop.v > 1.0 : (wf ? wf.v : best) > 1.3 && (wp ? wp.v > 1.0 : true)) this.moveCount++;
      else this.moveCount = 0;
      if (this.moveCount >= (dop ? 1 : 2)) {
        this.stopped = false;
        this.moveCount = 0;
        this.v = best;
        this.P = 2;
      }
    }
    if (this.stopped) ms = 0;

    // ---- totals
    if (this.firstT == null) this.firstT = fix.t;
    this.lastT = fix.t;
    if (prev) {
      if (gap) {
        // A tunnel: no speed was seen, so the straight line across it is the honest minimum.
        this.dist += haversine(prev, fix);
      } else if (!this.stopped) {
        this.dist += ((ms + this.lastMs) / 2) * dt;
        if (ms >= c.movingMs || this.lastMs >= c.movingMs) this.movingS += dt;
      }
    }

    // ---- top speed (sustained)
    // A peak is a claim, so it takes the MORE CONSERVATIVE reading: without a Doppler the lag-corrected value can overshoot at the end of a ramp,
    // while the plain window slope never does (at a plateau it is exact). Under-reporting a peak by a little beats inventing one.
    const topMs = dop ? ms : ws ? Math.min(ms, ws.v) : ms;
    if (gap) this.run = [];
    if (fix.acc != null && fix.acc <= c.peakAccM) {
      this.run.push({ t: fix.t, ms: topMs });
      let i = this.run.length - 1;
      while (i > 0 && (fix.t - this.run[i].t) / 1000 < c.sustainS) i--;
      if (this.run.length >= 2 && (fix.t - this.run[i].t) / 1000 >= c.sustainS - 1e-9) {
        let lo = Infinity;
        for (let k = i; k < this.run.length; k++) lo = Math.min(lo, this.run[k].ms);
        if (!this.top || lo > this.top.ms) this.top = { ms: lo, at: this.run[i].t };
        if (this.run.length > 12) this.run.splice(0, this.run.length - 12);
      }
    } else this.run = [];
    if (gap) this.looseRun = [];
    this.looseRun.push({ t: fix.t, ms: topMs });
    {
      let i = this.looseRun.length - 1;
      while (i > 0 && (fix.t - this.looseRun[i].t) / 1000 < c.sustainS) i--;
      if (this.looseRun.length >= 2 && (fix.t - this.looseRun[i].t) / 1000 >= c.sustainS - 1e-9) {
        let lo = Infinity;
        for (let k = i; k < this.looseRun.length; k++) lo = Math.min(lo, this.looseRun[k].ms);
        if (!this.loose || lo > this.loose.ms) this.loose = { ms: lo, at: this.looseRun[i].t };
        if (this.looseRun.length > 12) this.looseRun.splice(0, this.looseRun.length - 12);
      }
    }

    // ---- display
    const lead = dt > 0 && dt <= 2 && !this.stopped ? Math.max(-6, Math.min(3, this.aEma)) * c.leadS : 0;
    const shown = this.stopped ? 0 : Math.max(0, ms + lead);
    if (dop != null || wv != null || wp != null) this.knownBefore = true;
    this.last = fix;
    this.lastMs = ms;
    return { t: fix.t, ms, displayKmh: shown * 3.6, estimated: dop == null, moving: !this.stopped && ms >= c.movingMs, acc: fix.acc, known: dop != null || wv != null || wp != null || this.knownBefore };
  }

  summary(): SpeedSummary {
    const elapsedS = this.firstT != null && this.lastT != null ? (this.lastT - this.firstT) / 1000 : 0;
    return {
      distanceM: this.dist,
      elapsedS,
      movingS: this.movingS,
      avgKmh: elapsedS > 0 ? (this.dist / elapsedS) * 3.6 : null,
      avgMovingKmh: this.movingS > 0 ? (this.dist / this.movingS) * 3.6 : null,
      topKmh: (this.top ?? this.loose) ? (this.top ?? this.loose)!.ms * 3.6 : null,
      topAt: (this.top ?? this.loose) ? (this.top ?? this.loose)!.at : null,
      topApprox: this.top == null && this.loose != null,
    };
  }
}

/** The whole drive at once (the saved trip, the replay): the same engine, so the numbers match the live ones fix for fix. */
export function analyzeFixes(fixes: readonly Fix[]): { samples: SpeedSample[]; summary: SpeedSummary } {
  const eng = new SpeedEngine();
  const samples: SpeedSample[] = [];
  for (const f of [...fixes].sort((a, b) => a.t - b.t)) {
    const s = eng.push(f);
    if (s) samples.push(s);
  }
  return { samples, summary: eng.summary() };
}

/**
 * The speed of each fix for the MAP (the route colours and the live trail): the engine's fused speed smoothed over ±2 fixes (SPEC-I §I1),
 * aligned with the input, null where the engine rejected the fix. Same numbers as the cluster and the saved max, by construction.
 */
export function segmentSpeedsKmh(fixes: readonly Fix[]): (number | null)[] {
  const eng = new SpeedEngine();
  const raw = fixes.map((f) => {
    const s = eng.push(f);
    return s && s.known ? s.ms * 3.6 : null;
  });
  return raw.map((v, i) => {
    if (v == null) return null;
    let sum = 0;
    let n = 0;
    for (let j = Math.max(0, i - 2); j <= Math.min(raw.length - 1, i + 2); j++) {
      const x = raw[j];
      if (x != null) {
        sum += x;
        n++;
      }
    }
    return sum / n;
  });
}
