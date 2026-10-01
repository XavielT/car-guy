/**
 * Learned fuel-gauge calibration (IMP 01102026 notes 1, 3 — ADR-51,
 * docs/imp-01102026/01-research/03-segment-gauge-calibration.md §3–§4, §7).
 *
 * A dash reading is monotone but non-linear in the liters in the tank: tanks
 * are stepped at top and bottom, F sticks for 50–100 km, E is set high. A fixed
 * `liters = C·k/G` is off by up to ~10 % of C. So every vehicle learns its own
 * map f(k) = liters when the dash shows step k:
 *
 *   1. a linear prior p_k through (0, 0) [or (0, reserveL/2) when the light
 *      comes on as the last square goes], (reserveAt, reserveL) and (G, C);
 *   2. per-cell residuals from full tanks (f(k_before) ≈ C − L), shrunk to the
 *      prior by n/(n+κ), κ = 0.5; empty cells interpolate the residual;
 *   3. partial fills (f(a) − f(b) = L) as half-weight pseudo-observations
 *      against the current fit, three backfitting passes;
 *   4. PAV for a non-decreasing fit, hard-anchored at f(G) = C, clamped to
 *      [0, C];
 *   5. a prediction-style band from the pooled residual variance.
 *
 * Pure, recomputed on every fuel-log change; the result is the
 * `vehicle.gauge_calibration` JSON (data model v10 §1). Liters throughout.
 */
import { reserveStep, resolutionL, stepsFor, toGrid, validateGaugeCfg, type GaugeCfg } from './gauge';

export type CalibrationStatus = 'linear' | 'parcial' | 'aprendido';

/** `vehicle.gauge_calibration` (data model v10 §1). Index k of grid/band = step k. */
export type GaugeCalibration = {
  /** Liters in the tank at each step 0..G, non-decreasing, grid[G] = C. */
  grid: number[];
  /** ± liters at each step. */
  band: number[];
  /** Usable full fills (reading before pumping, below F). */
  n_full: number;
  /** Usable partial fills (before and after readings). */
  n_partial: number;
  status: CalibrationStatus;
  /** Newest observation used (or `opts.now`); null without any. */
  updated_at: string | null;
  /**
   * Median liters left when the owner refilled to full on "solo la luz de
   * reserva" — present once there are ≥ 2 such fills (research §3.1 item 3).
   */
  reserve_l?: number;
};

/** One fuel log as calibration sees it. Fractions 0..1 (null = not read). */
export type GaugeObservation = {
  fracBefore: number | null;
  fracAfter?: number | null;
  /** Liters pumped. */
  liters: number;
  isFull: boolean;
  /** ISO timestamp; orders the logs and applies the reset date. */
  at: string;
  /** "Solo la luz de reserva" — overrides fracBefore. */
  inReserve?: boolean;
  /**
   * Down-weight, 0..1. A reading taken under an older gauge config (another
   * grid) counts half (research §7.4); the caller knows the log's scale.
   */
  weight?: number;
};

export type CalibrateOpts = {
  /** Shrinkage strength; one fill moves a cell 1/(1+κ) of the way. */
  kappa?: number;
  /** Backfitting passes for the partial fills. */
  iters?: number;
  /** Logs before this ISO date are ignored (`gauge_calibration_reset_at`). */
  resetAt?: string | null;
  /** Stamp for `updated_at`; default: the newest observation's `at`. */
  now?: string;
  /** Linear-state extra half-width as a share of C — partialEconomy's default. */
  nonlinK?: number;
  /** ± liters of a pump click-off "full" — partialEconomy's default. */
  fullHalfL?: number;
};

const DEFAULTS = { kappa: 0.5, iters: 3, nonlinK: 0.03, fullHalfL: 0.5 };
/** Weight that pins f(G) = C through PAV. */
const HARD_ANCHOR = 1e6;
const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Pool Adjacent Violators: the weighted least-squares non-decreasing fit, O(n).
 * Throws on bad input — a programming error, not a data condition.
 */
export function pav(y: number[], w: number[]): number[] {
  const n = y.length;
  if (n !== w.length) throw new Error('pav: length mismatch');
  const val: number[] = [];
  const wt: number[] = [];
  const len: number[] = [];
  for (let i = 0; i < n; i++) {
    if (!(w[i] > 0)) throw new Error('pav: weights must be > 0');
    val.push(y[i]);
    wt.push(w[i]);
    len.push(1);
    // Merge backwards while the last two blocks violate monotonicity.
    while (val.length > 1 && val[val.length - 2] > val[val.length - 1]) {
      const b = val.length - 1;
      const a = b - 1;
      const W = wt[a] + wt[b];
      val[a] = (val[a] * wt[a] + val[b] * wt[b]) / W;
      wt[a] = W;
      len[a] += len[b];
      val.pop();
      wt.pop();
      len.pop();
    }
  }
  const out: number[] = [];
  for (let j = 0; j < val.length; j++) for (let k = 0; k < len[j]; k++) out.push(val[j]);
  return out;
}

/** A full fill on the grid: before step, liters pumped. */
export type FullObs = { before: number; addedL: number; w?: number };
/** A partial fill on the grid. */
export type PartialObs = { before: number; after: number; addedL: number; w?: number };

export type GaugeFit = {
  prior: number[];
  /** The fitted map f(k). */
  f: number[];
  /** Pre-PAV targets p_k + ρ_k. */
  z: number[];
  /** Cell weights Σw + κ (W_G = hard anchor). */
  W: number[];
  band: number[];
  /** Pooled residual SD (liters). */
  sigma: number;
};

/** The piecewise-linear prior through E, the reserve knot and F (research §3.2 step 1). */
export function linearPrior(G: number, C: number, reserveAt: number | null, reserveL: number): number[] {
  const knots: [number, number][] = [[0, reserveAt === 0 ? reserveL / 2 : 0]];
  if (reserveAt != null && reserveAt > 0 && reserveAt < G) knots.push([reserveAt, reserveL]);
  knots.push([G, C]);
  return Array.from({ length: G + 1 }, (_, k) => {
    for (let j = 1; j < knots.length; j++) {
      const [x0, y0] = knots[j - 1];
      const [x1, y1] = knots[j];
      if (k <= x1) return y0 + ((y1 - y0) * (k - x0)) / (x1 - x0);
    }
    return C;
  });
}

/**
 * The core estimator on grid indices (research §3.3, ported as-is): shrunk
 * residuals → interpolation → PAV, then the band.
 */
export function fitGauge(
  G: number,
  C: number,
  full: FullObs[],
  partial: PartialObs[],
  opts: { kappa?: number; reserveAt?: number | null; reserveL?: number; iters?: number } = {},
): GaugeFit {
  const kappa = opts.kappa ?? DEFAULTS.kappa;
  const iters = opts.iters ?? DEFAULTS.iters;
  const resL = opts.reserveL ?? 0.1 * C;
  const prior = linearPrior(G, C, opts.reserveAt ?? null, resL);

  // F readings say little (it is a plateau), so only fills from below F count.
  const pts = full.filter((o) => o.before < G).map((o) => ({ x: o.before, y: Math.max(0, C - o.addedL), w: o.w ?? 1 }));

  const fit = (extra: { x: number; y: number; w: number }[]) => {
    const sw = new Array<number>(G + 1).fill(0);
    const swr = new Array<number>(G + 1).fill(0);
    for (const p of [...pts, ...extra]) {
      sw[p.x] += p.w;
      swr[p.x] += p.w * (p.y - prior[p.x]);
    }
    // n/(n+κ) blend of the cell mean with the prior.
    const rho: (number | null)[] = sw.map((s, k) => (s > 0 ? swr[k] / (s + kappa) : null));
    rho[G] = 0; // hard: F is the brim
    if (rho[0] == null) rho[0] = 0; // soft: E without data stays on the prior
    // One fill at 3/9 should lift 2/9 and 4/9 too, not leave a kink.
    for (let k = 1; k < G; k++) {
      if (rho[k] != null) continue;
      let a = k - 1;
      while (rho[a] == null) a--;
      let b = k + 1;
      while (rho[b] == null) b++;
      rho[k] = rho[a]! + ((rho[b]! - rho[a]!) * (k - a)) / (b - a);
    }
    const z = prior.map((p, k) => p + rho[k]!);
    const W = sw.map((s) => s + kappa);
    W[G] = HARD_ANCHOR;
    const f = pav(z, W).map((v) => Math.min(C, Math.max(0, v)));
    f[G] = C;
    return { f, z, W };
  };

  let res = fit([]);
  for (let it = 0; it < iters && partial.length; it++) {
    const cur = res.f;
    res = fit(
      partial
        .flatMap((p) => [
          { x: p.before, y: Math.max(0, cur[p.after] - p.addedL), w: 0.5 * (p.w ?? 1) },
          { x: p.after, y: Math.min(C, cur[p.before] + p.addedL), w: 0.5 * (p.w ?? 1) },
        ])
        .filter((e) => e.x < G),
    );
  }

  // Pooled residual variance with a resolution prior (σ₀ = C/2G, ν₀ = 2);
  // only the full fills carry absolute levels, so only they enter.
  const sigma0 = C / (2 * G);
  const nu0 = 2;
  let ssr = 0;
  let swt = 0;
  for (const p of pts) {
    ssr += p.w * (p.y - res.f[p.x]) ** 2;
    swt += p.w;
  }
  const s2 = (nu0 * sigma0 ** 2 + ssr) / (nu0 + swt);
  const band = res.W.map((Wk, k) => (k === G ? DEFAULTS.fullHalfL : Math.max(C / (4 * G), Math.sqrt(s2 * (1 + 1 / Wk)))));
  return { prior, ...res, band, sigma: Math.sqrt(s2) };
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

const validFrac = (x: number | null | undefined): x is number => typeof x === 'number' && Number.isFinite(x) && x >= 0 && x <= 1;

/**
 * Fuel logs → `gauge_calibration`. Null when the config or the capacity is
 * unusable (GNV / electric callers never get here: research §7.6).
 *
 * Status (ADR-51): `aprendido` with ≥ 2 usable full fills at ≥ 2 distinct
 * readings below F; `parcial` with at least one; `linear` otherwise — and then
 * the band is the legacy linear one, honest about non-linearity.
 */
export function calibrate(
  cfg: GaugeCfg,
  capacityL: number | null,
  reserveL: number | null | undefined,
  observations: GaugeObservation[],
  opts: CalibrateOpts = {},
): GaugeCalibration | null {
  const ok = validateGaugeCfg(cfg);
  const G = ok ? stepsFor(ok) : null;
  if (!ok || G == null || capacityL == null || !(capacityL > 0)) return null;
  const C = capacityL;
  const resL = reserveL != null && reserveL > 0 ? reserveL : 0.1 * C;
  const conf = { ...DEFAULTS, ...opts };

  const logs = observations
    .filter((o) => Number.isFinite(o.liters) && o.liters > 0 && (!opts.resetAt || o.at >= opts.resetAt))
    .sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));

  const full: FullObs[] = [];
  const partial: PartialObs[] = [];
  const reserveSamples: number[] = [];
  let prevAfter: number | null = null;
  for (const o of logs) {
    const w = o.weight == null ? 1 : Math.min(1, Math.max(0, o.weight));
    const before = o.inReserve ? null : validFrac(o.fracBefore) ? toGrid(o.fracBefore, G) : null;
    // A reading more than one step above the last after-level without a fill
    // is a slope, damping or a mis-tap (research §7.2): drop it, tolerate 1.
    const rose = before != null && prevAfter != null && before > prevAfter + 1;
    if (o.isFull) {
      if (o.inReserve) reserveSamples.push(Math.max(0, C - o.liters));
      else if (before != null && before < G && !rose && w > 0) full.push({ before, addedL: o.liters, w });
      prevAfter = G;
    } else {
      const after = validFrac(o.fracAfter) ? toGrid(o.fracAfter, G) : null;
      if (before != null && after != null && after > before && !rose && w > 0) partial.push({ before, after, addedL: o.liters, w });
      prevAfter = after;
    }
  }

  const fit = fitGauge(G, C, full, partial, { kappa: conf.kappa, iters: conf.iters, reserveAt: reserveStep(ok), reserveL: resL });
  const distinct = new Set(full.map((o) => o.before)).size;
  const status: CalibrationStatus = full.length === 0 ? 'linear' : full.length >= 2 && distinct >= 2 ? 'aprendido' : 'parcial';

  const legacy = resolutionL(ok, C)! + conf.nonlinK * C;
  const band = status === 'linear' ? fit.band.map((_, k) => (k === G ? conf.fullHalfL : legacy)) : fit.band;

  const out: GaugeCalibration = {
    grid: fit.f.map(round2),
    band: band.map(round2),
    n_full: full.length,
    n_partial: partial.length,
    status,
    updated_at: opts.now ?? (logs.length ? logs[logs.length - 1].at : null),
  };
  if (reserveSamples.length >= 2) out.reserve_l = round2(median(reserveSamples));
  return out;
}

/** Recent fuel economy and its relative spread. */
export type KmPerL = { kmPerL: number; rel: number; source: 'recent' | 'lifetime' };

/** Floor on the relative km/L band: even three identical tanks don't promise better. */
const MIN_REL = 0.05;

/**
 * Distance-weighted km/L over the last 3 measured (full → full) points:
 * ΣD/ΣL, never a mean of ratios. `rel` is the distance-weighted SD of the
 * points' km/L over the mean, floored at 5 %. Points oldest first, liters.
 * Without measured points, the lifetime average (at the floor band) or null.
 */
export function recentKmPerL(
  points: { distanceKm: number; liters: number; status?: string }[],
  lifetimeKmPerL?: number | null,
): KmPerL | null {
  const usable = points.filter((p) => (p.status == null || p.status === 'measured') && p.distanceKm > 0 && p.liters > 0).slice(-3);
  if (!usable.length) return lifetimeKmPerL != null && lifetimeKmPerL > 0 ? { kmPerL: lifetimeKmPerL, rel: MIN_REL, source: 'lifetime' } : null;
  const D = usable.reduce((t, p) => t + p.distanceKm, 0);
  const L = usable.reduce((t, p) => t + p.liters, 0);
  const mean = D / L;
  const variance = usable.reduce((t, p) => t + p.distanceKm * (p.distanceKm / p.liters - mean) ** 2, 0) / D;
  return { kmPerL: mean, rel: Math.max(MIN_REL, Math.sqrt(variance) / mean), source: 'recent' };
}

export type Remaining = {
  /** Best estimate of liters in the tank. */
  liters: number;
  /** [lo, hi] liters — always shown with the estimate. */
  band: [number, number];
  /** ≈ km left, to 10 km; null without an economy figure. */
  km: number | null;
  /** [lo, hi] km, floored/ceiled to 10 km; null without an economy figure. */
  kmBand: [number, number] | null;
};

/**
 * Liters (and km) left at a reading (research §4). With no calibration, or a
 * `linear` one, the map is C·frac with the legacy band; otherwise the learned
 * grid, interpolated between steps (a percent or old-grid reading may fall
 * between them). On "solo la luz de reserva" the level is reserveL/2..reserveL
 * whatever the dash shows. Never a bare number: `band` always comes along.
 */
export function remaining(
  calibration: GaugeCalibration | null,
  cfg: GaugeCfg,
  capacityL: number,
  frac: number | null,
  kmPerL?: number | KmPerL | null,
  opts: { onReserve?: boolean; reserveL?: number | null; nonlinK?: number } = {},
): Remaining | null {
  const G = stepsFor(cfg);
  if (G == null || !(capacityL > 0)) return null;
  const C = capacityL;
  let mid: number;
  let lo: number;
  let hi: number;
  if (opts.onReserve) {
    const r = opts.reserveL != null && opts.reserveL > 0 ? opts.reserveL : (calibration?.reserve_l ?? 0.1 * C);
    lo = r / 2;
    hi = r;
    mid = (lo + hi) / 2;
  } else {
    if (!validFrac(frac)) return null;
    const learned = calibration && calibration.status !== 'linear' && calibration.grid.length === G + 1 && calibration.band.length === G + 1;
    let b: number;
    if (learned) {
      const x = frac * G;
      const k0 = Math.min(G - 1, Math.floor(x));
      const t = x - k0;
      mid = calibration.grid[k0] + (calibration.grid[k0 + 1] - calibration.grid[k0]) * t;
      b = calibration.band[k0] + (calibration.band[k0 + 1] - calibration.band[k0]) * t;
    } else {
      mid = C * frac;
      b = C / (2 * G) + (opts.nonlinK ?? DEFAULTS.nonlinK) * C;
    }
    mid = Math.min(C, Math.max(0, mid));
    lo = Math.max(0, mid - b);
    hi = Math.min(C, mid + b);
  }
  const kpl = typeof kmPerL === 'number' ? { kmPerL, rel: MIN_REL } : (kmPerL ?? null);
  const liters = round2(mid);
  const band: [number, number] = [round2(lo), round2(hi)];
  if (!kpl || !(kpl.kmPerL > 0)) return { liters, band, km: null, kmBand: null };
  return {
    liters,
    band,
    km: Math.round((mid * kpl.kmPerL) / 10) * 10,
    kmBand: [Math.floor((lo * kpl.kmPerL * (1 - kpl.rel)) / 10) * 10, Math.ceil((hi * kpl.kmPerL * (1 + kpl.rel)) / 10) * 10],
  };
}
