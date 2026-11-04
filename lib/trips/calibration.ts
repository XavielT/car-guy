/**
 * Calibration per vehicle (IMP 03112026 SPEC-I §I2, PROMPT-10 step 4). Pure.
 *
 * A car's speedometer reads HIGH on purpose (commonly +2 to +6 %); the GPS is the truth. So the app shows GPS speed by default and, if the
 * person wants it, "como mi tablero": GPS × a per-car factor learned from a few steady-speed samples, "tablero marca X, GPS marca Y".
 * The saved trip always keeps GPS truth: the factor only changes what is DISPLAYED. The odometer factor is learned from fill-up-to-fill-up
 * intervals (GPS km vs the odometer's difference) and only nudges the odometer *estimates* after a trip.
 */
export const FACTOR_RANGE = { min: 0.8, max: 1.2 } as const;
export const MIN_SAMPLES = 3;
/**
 * A steady stretch: at least this long, above this speed, with NO TREND (the second half's mean within `trendKmh` of the first half's) and a
 * scatter no worse than `sdKmh`. Judged on the mean and the trend, not on the instantaneous range: a perfectly steady car still shows a
 * ±1–2 km/h wobble in a GPS speed (more without a Doppler), so a range test would almost never pass.
 */
export const STEADY = { seconds: 10, trendKmh: 1.2, sdKmh: 2.5, minKmh: 30 } as const;
/** Samples whose dash/GPS ratios differ by more than this (as a fraction) do not agree: more samples, or a repeat on better GPS. */
export const AGREE = 0.012;
/** Odometer intervals count from this long (km), and three of them are needed. */
export const ODO_MIN_KM = 100;

export type SpeedSample = { dashKmh: number; gpsKmh: number };
export type SpeedProposal = { factor: number; n: number; spread: number; agrees: boolean; percent: number };

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** The ratio of one sample, or null when either number is not usable. */
export const ratioOf = (s: SpeedSample): number | null => (Number.isFinite(s.dashKmh) && Number.isFinite(s.gpsKmh) && s.dashKmh > 0 && s.gpsKmh >= STEADY.minKmh ? s.dashKmh / s.gpsKmh : null);

/**
 * The factor the samples propose: the MEDIAN of dash ÷ GPS (a single typo cannot drag it), needing ≥ 3 usable samples. `agrees` says whether
 * they are within ~1.2 % of each other; `ok` is false when the factor is outside 0.8–1.2 (a wrong number typed, a tyre-size change).
 */
export function proposeSpeedFactor(samples: readonly SpeedSample[]): SpeedProposal | null {
  const ratios = samples.map(ratioOf).filter((r): r is number => r != null);
  if (ratios.length < MIN_SAMPLES) return null;
  const factor = median(ratios);
  const spread = Math.max(...ratios) - Math.min(...ratios);
  return { factor, n: ratios.length, spread, agrees: spread <= AGREE * 2, percent: (factor - 1) * 100 };
}

export const factorInRange = (f: number): boolean => Number.isFinite(f) && f >= FACTOR_RANGE.min && f <= FACTOR_RANGE.max;

/** A rounded factor for storage and display ("1.042"). */
export const roundFactor = (f: number): number => Math.round(f * 1000) / 1000;

/**
 * Is the last stretch steady enough to take a sample? `recent` is the fused GPS speed (km/h) with its time (ms), newest last. Returns the mean
 * when the last `STEADY.seconds` s span the window, show no trend and little scatter, and are above `STEADY.minKmh`; otherwise why not.
 */
export function steadySample(recent: readonly { t: number; kmh: number }[]): { ok: true; gpsKmh: number } | { ok: false; reason: 'short' | 'slow' | 'varying' } {
  if (!recent.length) return { ok: false, reason: 'short' };
  const end = recent[recent.length - 1].t;
  const win = recent.filter((p) => end - p.t <= STEADY.seconds * 1000);
  if (win.length < 3 || end - win[0].t < (STEADY.seconds - 1.5) * 1000) return { ok: false, reason: 'short' };
  const v = win.map((p) => p.kmh);
  const mean = v.reduce((a, b) => a + b, 0) / v.length;
  if (mean < STEADY.minKmh) return { ok: false, reason: 'slow' };
  const half = Math.floor(v.length / 2);
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const trend = Math.abs(avg(v.slice(v.length - half)) - avg(v.slice(0, half)));
  const sd = Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / v.length);
  if (trend > STEADY.trendKmh || sd > STEADY.sdKmh) return { ok: false, reason: 'varying' };
  return { ok: true, gpsKmh: mean };
}

export type OdoInterval = { gpsKm: number; odoKm: number };

/** The odometer factor (odometer ÷ GPS) from ≥ 3 intervals of ≥ 100 km, or null. Outside 0.9–1.15 it is not proposed (a wrong reading, not physics). */
export function proposeOdoFactor(intervals: readonly OdoInterval[]): { factor: number; n: number } | null {
  const ok = intervals.filter((i) => i.gpsKm >= ODO_MIN_KM && i.odoKm >= ODO_MIN_KM);
  if (ok.length < MIN_SAMPLES) return null;
  const factor = median(ok.map((i) => i.odoKm / i.gpsKm));
  return factor >= 0.9 && factor <= 1.15 ? { factor: roundFactor(factor), n: ok.length } : null;
}

export type ShowSpeed = 'gps' | 'dash';
export type CarCalibration = { speedFactor: number; odoFactor: number; show: ShowSpeed };
export const DEFAULT_CALIBRATION: CarCalibration = { speedFactor: 1, odoFactor: 1, show: 'gps' };

/** What the cluster shows: GPS truth by default, GPS × factor when the person chose "como mi tablero". An unusable factor is 1. */
export function displayFactor(c: Pick<CarCalibration, 'speedFactor' | 'show'> | null | undefined): number {
  return c && c.show === 'dash' && factorInRange(c.speedFactor) ? c.speedFactor : 1;
}

/** Reads a stored value defensively: anything malformed is the default. */
export function parseCalibration(raw: unknown): CarCalibration {
  const r = (raw ?? {}) as Partial<CarCalibration>;
  return {
    speedFactor: typeof r.speedFactor === 'number' && factorInRange(r.speedFactor) ? r.speedFactor : 1,
    odoFactor: typeof r.odoFactor === 'number' && r.odoFactor >= 0.9 && r.odoFactor <= 1.15 ? r.odoFactor : 1,
    show: r.show === 'dash' ? 'dash' : 'gps',
  };
}
