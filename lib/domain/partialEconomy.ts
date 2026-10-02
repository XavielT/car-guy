/**
 * Carga parcial — economy from the fuel gauge (IMP 29092026 note 4,
 * docs/imp-29092026/01-research/02-fuel-partial-and-datasets.md §1).
 *
 * Brim-to-brim (lib/domain/economy.ts `computeEconomy`) is untouched and stays
 * the truth: its full → full spans are the `measured` points here, with the
 * very same numbers. On top of that, the gauge readings before and after each
 * fill-up give every consecutive pair of fill-ups an *estimate* with an error
 * band:
 *
 *   consumed(i → i+1) = levelAfter(i) − levelBefore(i+1)
 *
 * - `estimated`: a gauge-based segment no full → full span encloses yet
 *   (usually the latest ones). Shown hollow with "≈", kept out of the headline
 *   average unless the user asks for it.
 * - `reconciled`: the same segments once a full tank closes their span,
 *   adjusted (by variance) so they add up to the measured total (§1.6).
 * - `unknown`: a missing reading, a forgotten fill-up, an odometer that did not
 *   move, or an estimate too uncertain to mean anything (> 25 %).
 *
 * Pure. The logs come in the vehicle's display unit (the store's shape, see
 * lib/domain/units.ts); `cfg.unitL` says how many liters that unit is, the
 * maths runs in liters and km/unit comes back in the display unit.
 */
import { computeEconomy, roundMoney, roundVolume, sortFillUps } from './economy';
import { stepsFor, validateGaugeCfg, type GaugeCfg } from './gauge';
import { parseCalibration, type GaugeCalibration } from './gaugeCalibration';
import { GAL_L } from './units';
import type { EconomyPoint, FillUp } from '../types';

export type EconomyStatus = 'measured' | 'reconciled' | 'estimated' | 'unknown';
export type EconomyReason = 'missing_gauge' | 'missed_fill' | 'odometer' | 'nonpositive' | 'too_uncertain';
export type EconomyWarning = 'gauge_pump_mismatch' | 'over_capacity';

/** A fill-up with its gauge readings (v6 columns; all optional). */
export type GaugeFillUp = FillUp;

export type FuelCfg = {
  /** Tank capacity in liters; without it no gauge estimate is possible. */
  capacityL: number | null;
  /** Fuel left when the reserve light comes on; default 10 % of the tank. */
  reserveL?: number | null;
  /** Liters per display unit (1 for L, GAL_L for gal). */
  unitL: number;
  /** Extra gauge uncertainty as a share of the tank (non-linear gauges). */
  nonlinK?: number;
  /** ± liters of a pump click-off "full". */
  fullHalfL?: number;
  /** Above this relative uncertainty an estimate is `unknown`. */
  maxRelUnc?: number;
  /** v10 (ADR-51): how the dash reads; default a needle in eighths (today's maths, unchanged). */
  gauge?: GaugeCfg | null;
  /** The learned map; used only when its status is not `linear` and it fits the gauge's grid. */
  calibration?: GaugeCalibration | null;
};

export type SeriesPoint = EconomyPoint & {
  /** The fill-up the segment starts from (the one before `fillUpId`). */
  fromId: string;
  status: EconomyStatus;
  /** Band on km/unit; equal to kmPerUnit for a measured span. Null when unknown. */
  kmPerUnitLow: number | null;
  kmPerUnitHigh: number | null;
  reason?: EconomyReason;
  warnings?: EconomyWarning[];
};

type Level = { value: number; sigma: number };

const DEFAULTS = { nonlinK: 0.03, fullHalfL: 0.5, maxRelUnc: 0.25 };
const rss = (...xs: number[]) => Math.sqrt(xs.reduce((s, x) => s + x * x, 0));
const NEEDLE: GaugeCfg = { type: 'needle8' };

type Conf = Required<Pick<FuelCfg, 'nonlinK' | 'fullHalfL'>> & FuelCfg;

/** The reading as a fraction: the v10 column, else the v6 eighths (a row synced from a 2.4.x phone). */
export function readingFrac(frac: number | null | undefined, eighths: number | null | undefined): number | null {
  if (frac != null && Number.isFinite(frac) && frac >= 0 && frac <= 1) return frac;
  return eighths != null && eighths >= 0 && eighths <= 8 ? eighths / 8 : null;
}

/** The gauge grid and the learned map that fits it (null map → linear). */
function gridOf(cfg: FuelCfg): { G: number; learned: GaugeCalibration | null } {
  const gauge = validateGaugeCfg(cfg.gauge ?? NEEDLE) ?? NEEDLE;
  const G = stepsFor(gauge) ?? 8;
  const c = cfg.calibration;
  const learned = c && c.status !== 'linear' && c.grid.length === G + 1 && c.band.length === G + 1 ? c : null;
  return { G, learned };
}

/**
 * Liters at a reading (research 03 §6). Linear: C·frac ± (C/(2G) + nonlinK·C) — for eighths exactly the
 * pre-v10 C·n/8 ± (C/16 + nonlinK·C). Learned: the grid interpolated, ± its band (nonlinK dropped: the
 * residuals already hold the non-linearity).
 */
function levelAt(frac: number, C: number, cfg: Conf): Level {
  const { G, learned } = gridOf(cfg);
  if (!learned) return { value: frac * C, sigma: C / (2 * G) + cfg.nonlinK * C };
  const x = frac * G;
  const k0 = Math.min(G - 1, Math.floor(x));
  const t = x - k0;
  return {
    value: learned.grid[k0] + (learned.grid[k0 + 1] - learned.grid[k0]) * t,
    sigma: learned.band[k0] + (learned.band[k0 + 1] - learned.band[k0]) * t,
  };
}

function levelBefore(log: GaugeFillUp, C: number, cfg: Conf): Level | null {
  if (log.inReserve) {
    // The learned reserve (median of "solo la luz" fills, ≥ 2 samples) before the configured one.
    const learnedReserve = cfg.calibration?.reserve_l;
    const reserve = learnedReserve != null && learnedReserve > 0 ? learnedReserve : (cfg.reserveL ?? 0.1 * C);
    return { value: reserve, sigma: reserve / 2 };
  }
  const frac = readingFrac(log.gaugeBeforeFrac, log.gaugeBefore8);
  return frac == null ? null : levelAt(frac, C, cfg);
}

/** levelAfter as the gauge and the pump each see it, combined by inverse variance (§1.2, §1.8 step 3). */
function levelAfter(
  log: GaugeFillUp,
  before: Level | null,
  addedL: number,
  C: number,
  cfg: Conf,
): { level: Level | null; warnings: EconomyWarning[] } {
  const warnings: EconomyWarning[] = [];
  if (before && before.value + addedL > C * 1.1) warnings.push('over_capacity');
  if (log.isFullTank) return { level: { value: C, sigma: cfg.fullHalfL }, warnings };

  const frac = readingFrac(log.gaugeAfterFrac, log.gaugeAfter8);
  const { G } = gridOf(cfg);
  // F without the full toggle: "somewhere in the top step" — C·(1 − 1/(2G)) ± C/(2G) (15/16·C for eighths, §1.4).
  const gauge: Level | null =
    frac == null ? null : frac >= 1 ? { value: C * (1 - 1 / (2 * G)), sigma: C / (2 * G) + cfg.nonlinK * C } : levelAt(frac, C, cfg);
  const pump: Level | null = before ? { value: before.value + addedL, sigma: before.sigma } : null;
  if (!gauge || !pump) return { level: gauge ?? pump, warnings };

  if (Math.abs(gauge.value - pump.value) > 2 * rss(gauge.sigma, pump.sigma)) warnings.push('gauge_pump_mismatch');
  const wg = 1 / gauge.sigma ** 2;
  const wp = 1 / pump.sigma ** 2;
  return {
    level: { value: (gauge.value * wg + pump.value * wp) / (wg + wp), sigma: 1 / Math.sqrt(wg + wp) },
    warnings,
  };
}

type Segment = SeriesPoint & { fuelL: number | null; sigmaL: number | null; index: number };

function unknownSegment(prev: GaugeFillUp, cur: GaugeFillUp, index: number, reason: EconomyReason, warnings: EconomyWarning[]): Segment {
  return {
    fillUpId: cur.id,
    fromId: prev.id,
    occurredAt: cur.occurredAt,
    distanceKm: cur.odometerKm - prev.odometerKm,
    volume: 0,
    kmPerUnit: 0,
    costPerKm: 0,
    status: 'unknown',
    kmPerUnitLow: null,
    kmPerUnitHigh: null,
    reason,
    ...(warnings.length ? { warnings } : {}),
    fuelL: null,
    sigmaL: null,
    index,
  };
}

function withFuel(seg: Segment, fuelL: number, sigmaL: number, unitL: number, pricePerUnit: number, status: EconomyStatus): Segment {
  const volume = fuelL / unitL;
  const low = fuelL + sigmaL;
  const high = fuelL - sigmaL;
  return {
    ...seg,
    status,
    fuelL,
    sigmaL,
    volume: roundVolume(volume),
    kmPerUnit: roundVolume((seg.distanceKm / fuelL) * unitL),
    kmPerUnitLow: roundVolume((seg.distanceKm / low) * unitL),
    kmPerUnitHigh: high > 0 ? roundVolume((seg.distanceKm / high) * unitL) : null,
    costPerKm: roundMoney((volume * pricePerUnit) / seg.distanceKm),
  };
}

export type PartialEconomy = {
  /** Consecutive-pair segments (estimated / reconciled / unknown). */
  segments: SeriesPoint[];
  /** Full → full spans: exactly `computeEconomy`, as `measured`. */
  spans: SeriesPoint[];
  /**
   * What a chart draws, oldest first: each span as its reconciled sub-segments
   * when all of them are known (else the span itself), then the estimated and
   * unknown segments outside any span.
   */
  series: SeriesPoint[];
  /** Σkm / Σunits over the measured spans (+ estimated segments when asked). */
  average: number | null;
};

/**
 * The whole picture for one vehicle (§1.8). `includeEstimates` adds the
 * estimated segments to the average (setting `economy_include_estimates`).
 */
export function partialEconomy(fillups: GaugeFillUp[], cfg: FuelCfg, opts: { includeEstimates?: boolean } = {}): PartialEconomy {
  const conf = { ...DEFAULTS, ...cfg };
  const sorted = sortFillUps(fillups) as GaugeFillUp[];
  const C = cfg.capacityL && cfg.capacityL > 0 ? cfg.capacityL : null;

  // --- measured spans: brim-to-brim, unchanged ---
  const measured = computeEconomy(sorted);
  const indexOf = new Map(sorted.map((f, i) => [f.id, i]));
  const spans: (SeriesPoint & { from: number; to: number })[] = measured.map((p) => {
    const to = indexOf.get(p.fillUpId)!;
    let from = to - 1;
    while (from > 0 && !(sorted[from].isFullTank || sorted[from].missedPrevious)) from--;
    return { ...p, fromId: sorted[from].id, status: 'measured', kmPerUnitLow: p.kmPerUnit, kmPerUnitHigh: p.kmPerUnit, from, to };
  });

  // --- gauge segments between consecutive fill-ups ---
  const segments: Segment[] = [];
  let after: Level | null = null;
  let afterWarnings: EconomyWarning[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const cur = sorted[i];
    const before = C ? levelBefore(cur, C, conf) : null;
    if (i > 0) {
      const prev = sorted[i - 1];
      const distance = cur.odometerKm - prev.odometerKm;
      const base = unknownSegment(prev, cur, i, 'missing_gauge', afterWarnings);
      if (cur.missedPrevious) segments.push({ ...base, reason: 'missed_fill' });
      else if (distance <= 0) segments.push({ ...base, reason: 'odometer' });
      else if (!C || !after || !before) segments.push(base);
      else {
        const fuelL = after.value - before.value;
        const sigmaL = rss(after.sigma, before.sigma);
        if (fuelL <= 0) segments.push({ ...base, reason: 'nonpositive' });
        else if (sigmaL / fuelL > conf.maxRelUnc) segments.push({ ...base, reason: 'too_uncertain' });
        else segments.push(withFuel(base, fuelL, sigmaL, conf.unitL, prev.pricePerUnit, 'estimated'));
      }
    }
    if (C) {
      const next = levelAfter(cur, before, cur.volume * conf.unitL, C, conf);
      after = next.level;
      afterWarnings = next.warnings;
    } else {
      after = null;
      afterWarnings = [];
    }
  }

  // --- reconcile the segments inside each measured span (§1.6) ---
  const covered = new Set<number>();
  const series: SeriesPoint[] = [];
  for (const span of spans) {
    const inside = segments.filter((s) => s.index > span.from && s.index <= span.to);
    inside.forEach((s) => covered.add(s.index));
    const allKnown = inside.length > 1 && inside.every((s) => s.fuelL != null && s.sigmaL != null);
    if (!allKnown) {
      series.push(stripSpan(span));
      continue;
    }
    const totalL = span.volume * conf.unitL;
    const D = inside.reduce((t, s) => t + s.fuelL!, 0) - totalL;
    const variance = inside.reduce((t, s) => t + s.sigmaL! ** 2, 0);
    for (const s of inside) {
      const fuelL = s.fuelL! - (D * s.sigmaL! ** 2) / variance;
      const price = sorted[s.index - 1].pricePerUnit;
      const rec = withFuel(s, fuelL, s.sigmaL!, conf.unitL, price, 'reconciled');
      series.push(strip(rec));
      Object.assign(s, rec);
    }
  }
  for (const s of segments) if (!covered.has(s.index)) series.push(strip(s));
  series.sort((a, b) => (indexOf.get(a.fillUpId)! - indexOf.get(b.fillUpId)!));

  // --- the headline average: distance over fuel, never a mean of ratios ---
  let km = 0;
  let units = 0;
  for (const span of spans) {
    km += span.distanceKm;
    units += span.volume;
  }
  if (opts.includeEstimates) {
    for (const s of segments) {
      if (!covered.has(s.index) && s.status === 'estimated') {
        km += s.distanceKm;
        units += s.volume;
      }
    }
  }

  return {
    segments: segments.map(strip),
    spans: spans.map(stripSpan),
    series,
    average: units > 0 ? roundVolume(km / units) : null,
  };
}

function strip(s: Segment): SeriesPoint {
  const { fuelL: _f, sigmaL: _s, index: _i, ...point } = s;
  return point;
}

function stripSpan(s: SeriesPoint & { from: number; to: number }): SeriesPoint {
  const { from: _f, to: _t, ...point } = s;
  return point;
}

/** The latest point a screen should talk about: the newest one with a number. */
export function latestKnown(series: SeriesPoint[]): SeriesPoint | null {
  for (let i = series.length - 1; i >= 0; i--) if (series[i].status !== 'unknown') return series[i];
  return null;
}

/**
 * A vehicle's gauge settings from its stored row: the tank and the reserve are
 * liters in the database (v6); the logs the screens hold are in `volumeUnit`.
 */
export function fuelCfgFor(
  vehicle:
    | {
        tankVolume: number | null;
        reserveVolumeL?: number | null;
        volumeUnit?: 'gal' | 'l';
        defaultFuelType?: string;
        gaugeType?: GaugeCfg['type'] | null;
        gaugeSegments?: number | null;
        gaugeReserveAt?: number | null;
        gaugeCalibration?: string | null;
      }
    | null
    | undefined,
): FuelCfg {
  const liquid = vehicle?.defaultFuelType !== 'gnv';
  const gauge = validateGaugeCfg({ type: vehicle?.gaugeType ?? 'needle8', segments: vehicle?.gaugeSegments, reserveAt: vehicle?.gaugeReserveAt });
  return {
    // GNV's tank is m³ and its gauge is a pressure dial: no estimates.
    capacityL: liquid ? (vehicle?.tankVolume ?? null) : null,
    reserveL: vehicle?.reserveVolumeL ?? null,
    unitL: vehicle?.volumeUnit === 'l' ? 1 : GAL_L,
    gauge: gauge ?? NEEDLE,
    calibration: liquid ? parseCalibration(vehicle?.gaugeCalibration) : null,
  };
}

/**
 * Distance over fuel for any set of points (research 02 §1.5 rule 4): never a
 * mean of the ratios, which lets a short tank weigh as much as a long one.
 * Unknown points carry no fuel and are skipped.
 */
export function weightedAverage(points: Pick<SeriesPoint, 'distanceKm' | 'volume' | 'status'>[]): number | null {
  let km = 0;
  let units = 0;
  for (const p of points) {
    if (p.status === 'unknown' || p.volume <= 0) continue;
    km += p.distanceKm;
    units += p.volume;
  }
  return units > 0 ? roundVolume(km / units) : null;
}

/**
 * Capacity calibration (research 02 §1.4): on every full tank with a reading
 * before pumping, `levelBefore + added − C` is what went in beyond the stated
 * capacity. A consistent excess (median over at least three tanks, above 1.5 L
 * and 3 % of the tank) means the tank takes more than the manual says — the
 * filler neck, or a wrong number. Returned as a suggestion; never applied here.
 */
export function capacityHint(fillups: GaugeFillUp[], cfg: FuelCfg): { extraL: number; suggestedL: number; samples: number } | null {
  const C = cfg.capacityL;
  if (!C || C <= 0) return null;
  const conf = { ...DEFAULTS, ...cfg };
  const excess: number[] = [];
  for (const f of sortFillUps(fillups) as GaugeFillUp[]) {
    if (!f.isFullTank || f.missedPrevious) continue;
    const before = levelBefore(f, C, conf);
    if (!before) continue;
    excess.push(before.value + f.volume * conf.unitL - C);
  }
  if (excess.length < 3) return null;
  const sorted = [...excess].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  if (median <= Math.max(1.5, 0.03 * C)) return null;
  const extraL = Math.round(median * 10) / 10;
  return { extraL, suggestedL: Math.round(C + median), samples: excess.length };
}
