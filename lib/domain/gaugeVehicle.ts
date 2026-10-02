/**
 * The gauge of one car, end to end (IMP 01102026 notes 1, 3 — ADR-51, research 03 §3–§4, §7): its config,
 * the observations its fill-ups give, the learned map, and what is in the tank now.
 *
 * Pure. `calibrateVehicle` reads stored rows (liters); `tankNow` reads the store's fill-ups (display unit,
 * converted with `fuelCfgFor().unitL`) so the hub and the cluster share one answer.
 */
import { stepsFor, validateGaugeCfg, type GaugeCfg, type GaugeType } from './gauge';
import { calibrate, parseCalibration, recentKmPerL, remaining, type GaugeCalibration, type GaugeObservation } from './gaugeCalibration';
import { fuelCfgFor, partialEconomy, readingFrac } from './partialEconomy';
import type { FillUp } from '../types';

type GaugeVehicle = {
  gaugeType?: GaugeType | null;
  gaugeSegments?: number | null;
  gaugeReserveAt?: number | null;
  gaugeCalibration?: string | null;
  tankVolume: number | null;
  reserveVolumeL?: number | null;
  defaultFuelType?: string;
  volumeUnit?: 'gal' | 'l';
};

const NEEDLE: GaugeCfg = { type: 'needle8' };

/** The vehicle's gauge, valid or the needle (an invalid row never breaks a form). */
export function gaugeCfgOf(v: Partial<GaugeVehicle> | null | undefined): GaugeCfg {
  return validateGaugeCfg({ type: v?.gaugeType ?? 'needle8', segments: v?.gaugeSegments, reserveAt: v?.gaugeReserveAt }) ?? NEEDLE;
}

/** The denominator a raw reading was taken on: 8 / N for "n/d", 20 for "45%"; null when unknown. */
function rawScale(raw: string | null | undefined): number | null {
  if (!raw) return null;
  if (/%\s*$/.test(raw)) return 20;
  const m = /\/\s*(\d{1,2})\s*$/.exec(raw);
  return m ? Number(m[1]) : null;
}

/** A stored fuel log as calibration needs it (liters). */
export type CalibrationLog = {
  occurredAt: string;
  volume: number;
  isFullTank: boolean;
  inReserve?: boolean | null;
  gaugeBeforeFrac?: number | null;
  gaugeAfterFrac?: number | null;
  gaugeBeforeRaw?: string | null;
  gaugeBeforeEighths?: number | null;
  gaugeAfterEighths?: number | null;
  deletedAt?: string | null;
};

/**
 * Fill-ups → observations. A reading taken on another grid (the owner switched needle → 9 squares) counts
 * half (research §7.4); its fraction is kept as read.
 */
export function observationsOf(logs: CalibrationLog[], cfg: GaugeCfg): GaugeObservation[] {
  const G = stepsFor(cfg) ?? 8;
  return logs
    .filter((l) => !l.deletedAt)
    .map((l) => {
      const scale = rawScale(l.gaugeBeforeRaw) ?? (l.gaugeBeforeEighths != null ? 8 : null);
      return {
        fracBefore: readingFrac(l.gaugeBeforeFrac, l.gaugeBeforeEighths),
        fracAfter: readingFrac(l.gaugeAfterFrac, l.gaugeAfterEighths),
        liters: l.volume,
        isFull: l.isFullTank,
        at: l.occurredAt,
        inReserve: Boolean(l.inReserve),
        weight: scale != null && scale !== G ? 0.5 : 1,
      };
    });
}

/**
 * The JSON to store on `vehicle.gauge_calibration`, or null (GNV, no tank). The previous value's reset date
 * is carried over; `resetAt` sets a new one.
 */
export function calibrateVehicle(
  vehicle: GaugeVehicle,
  logs: CalibrationLog[],
  opts: { resetAt?: string | null } = {},
): GaugeCalibration | null {
  if (vehicle.defaultFuelType === 'gnv' || !(vehicle.tankVolume && vehicle.tankVolume > 0)) return null;
  const cfg = gaugeCfgOf(vehicle);
  const resetAt = opts.resetAt !== undefined ? opts.resetAt : (parseCalibration(vehicle.gaugeCalibration)?.reset_at ?? null);
  const cal = calibrate(cfg, vehicle.tankVolume, vehicle.reserveVolumeL ?? null, observationsOf(logs, cfg), { resetAt: resetAt ?? undefined });
  return cal && resetAt ? { ...cal, reset_at: resetAt } : cal;
}

/** A calibration worth showing as "aprendido"/"parcial" (not the linear default). */
export function isLearned(c: GaugeCalibration | null | undefined): c is GaugeCalibration {
  return Boolean(c && c.status !== 'linear' && c.grid.length >= 2);
}

/** "4/9", "3/8", "45 %" for a fraction on this gauge. */
export function formatFrac(frac: number, cfg: GaugeCfg): string {
  const G = stepsFor(cfg) ?? 8;
  if (cfg.type === 'percent') return `${Math.round(frac * 100)} %`;
  return `${Math.round(frac * G)}/${G}`;
}

/** Liters → the step the dash should show (the learned map inverted; linear otherwise). */
export function stepForLiters(liters: number, cfg: GaugeCfg, capacityL: number, cal: GaugeCalibration | null): number {
  const G = stepsFor(cfg) ?? 8;
  if (isLearned(cal) && cal.grid.length === G + 1) {
    let best = 0;
    for (let k = 0; k <= G; k++) if (Math.abs(cal.grid[k] - liters) < Math.abs(cal.grid[best] - liters)) best = k;
    return best;
  }
  return Math.max(0, Math.min(G, Math.round((liters / capacityL) * G)));
}

export type TankNow = {
  /** The reading the estimate starts from, as seen ("4/9") — or 'F' after a full tank. */
  fromRaw: string;
  /** When that reading was taken. */
  at: string;
  liters: number;
  band: [number, number];
  km: number | null;
  kmBand: [number, number] | null;
  /** ≈ the step the dash shows now. */
  stepNow: number;
  steps: number;
  /** The fuel telltale (Inicio cluster): amber low, red at the reserve. */
  telltale: 'off' | 'amber' | 'red';
  learned: boolean;
};

/** A reading older than this is not a tank estimate any more (02-screens Phase 3: hides after 30 days). */
export const TANK_MAX_AGE_DAYS = 30;

/**
 * What is in the tank now (research §4): the last fill-up's after-level (C when full), minus the km driven
 * since at the recent km/L; the band grows as √(b² + (km/kpl·rel)²). Null without a capacity, without a
 * reading to start from, after 30 days, or when the estimate falls below zero.
 */
export function tankNow(
  vehicle: GaugeVehicle | null | undefined,
  fillups: FillUp[],
  latestOdometerKm: number | null,
  now: Date = new Date(),
): TankNow | null {
  const cfg = fuelCfgFor(vehicle);
  const C = cfg.capacityL;
  if (!vehicle || !C || !(C > 0)) return null;
  const gauge = gaugeCfgOf(vehicle);
  const G = stepsFor(gauge) ?? 8;
  const cal = cfg.calibration ?? null;
  const sorted = [...fillups].sort((a, b) => (a.occurredAt < b.occurredAt ? -1 : a.occurredAt > b.occurredAt ? 1 : a.odometerKm - b.odometerKm));
  const last = sorted[sorted.length - 1];
  if (!last) return null;
  if ((now.getTime() - new Date(last.occurredAt).getTime()) / 86_400_000 > TANK_MAX_AGE_DAYS) return null;

  const addedL = last.volume * cfg.unitL;
  let start: { mid: number; b: number; raw: string } | null = null;
  if (last.isFullTank) start = { mid: C, b: 0.5, raw: 'F' };
  else {
    const after = readingFrac(last.gaugeAfterFrac, last.gaugeAfter8);
    if (after != null) {
      const r = remaining(cal, gauge, C, after);
      if (r) start = { mid: r.liters, b: (r.band[1] - r.band[0]) / 2, raw: last.gaugeAfterRaw ?? formatFrac(after, gauge) };
    } else {
      const before = readingFrac(last.gaugeBeforeFrac, last.gaugeBefore8);
      const r = last.inReserve
        ? remaining(cal, gauge, C, 0, null, { onReserve: true, reserveL: cfg.reserveL })
        : before != null
          ? remaining(cal, gauge, C, before)
          : null;
      if (r) start = { mid: Math.min(C, r.liters + addedL), b: (r.band[1] - r.band[0]) / 2, raw: '' };
    }
  }
  if (!start) return null;

  const economy = partialEconomy(fillups, cfg);
  const kpl = recentKmPerL(
    economy.spans.map((p) => ({ distanceKm: p.distanceKm, liters: p.volume * cfg.unitL, status: p.status })),
    economy.average != null ? economy.average / cfg.unitL : null,
  );
  const kmSince = latestOdometerKm != null ? Math.max(0, latestOdometerKm - last.odometerKm) : 0;
  const usedL = kpl && kmSince > 0 ? kmSince / kpl.kmPerL : 0;
  const mid = start.mid - usedL;
  if (mid <= 0) return null;
  const b = Math.sqrt(start.b ** 2 + (kpl ? usedL * kpl.rel : 0) ** 2);
  const lo = Math.max(0, mid - b);
  const hi = Math.min(C, mid + b);
  const stepNow = stepForLiters(mid, gauge, C, cal);

  const reserveL = cal?.reserve_l ?? cfg.reserveL ?? 0.1 * C;
  const reserveAt = gauge.reserveAt;
  const amber = (G > 0 ? stepNow / G : 1) <= (gauge.type === 'percent' ? 0.2 : 2 / G);
  // Red on the best estimate, not the band's top (research §4 says hi): after a long drive the band is wide and
  // hi ≤ reserve would come on only when the car is already dry.
  const red = mid <= reserveL || (reserveAt != null && gauge.type !== 'percent' && stepNow <= reserveAt);
  return {
    fromRaw: start.raw,
    at: last.occurredAt,
    liters: Math.round(mid),
    band: [Math.round(lo), Math.round(hi)],
    km: kpl ? Math.round((mid * kpl.kmPerL) / 10) * 10 : null,
    kmBand: kpl ? [Math.floor((lo * kpl.kmPerL * (1 - kpl.rel)) / 10) * 10, Math.ceil((hi * kpl.kmPerL * (1 + kpl.rel)) / 10) * 10] : null,
    stepNow,
    steps: G,
    telltale: red ? 'red' : amber ? 'amber' : 'off',
    learned: isLearned(cal),
  };
}
