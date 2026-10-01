/**
 * Fuel gauge readings (IMP 01102026 notes 1, 3 — ADR-51,
 * docs/imp-01102026/01-research/03-segment-gauge-calibration.md §2, §5).
 *
 * A dash shows fuel as a needle in eighths, N lit squares, or a digital %.
 * Every reading is stored twice: the raw text the owner tapped ("4/9", "3/8",
 * "45%") and a unit-less fraction 0..1 that all the maths reads. Keeping the
 * raw text with its own denominator matters: if the owner later corrects the
 * vehicle from "needle" to "9 squares", old readings still parse on their own
 * scale (research §2.2, §7.4).
 *
 * Pure. Liters everywhere; invalid input gives null instead of throwing, so
 * the repo layer can reject a bad row without a try/catch.
 */

export type GaugeType = 'needle8' | 'segments' | 'percent';

export type GaugeCfg = {
  type: GaugeType;
  /** N squares, 3..20; only for `segments` (ignored otherwise). */
  segments?: number | null;
  /**
   * Steps still showing when the reserve light comes on: 1 = "queda 1 cuadro",
   * 0 = "al apagarse el último", null = unknown. In the gauge's own unit:
   * squares, eighths, or % for `percent`.
   */
  reserveAt?: number | null;
};

export const MIN_SEGMENTS = 3;
export const MAX_SEGMENTS = 20;
/** The percent picker snaps to 5 % — finer than any sender is honest about. */
export const PERCENT_STEP = 5;

const isInt = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n);

/** The config if it is usable, else null (N outside 3..20, unknown type, bad reserve). */
export function validateGaugeCfg(cfg: GaugeCfg | null | undefined): GaugeCfg | null {
  if (!cfg) return null;
  if (cfg.type !== 'needle8' && cfg.type !== 'segments' && cfg.type !== 'percent') return null;
  if (cfg.type === 'segments') {
    if (!isInt(cfg.segments) || cfg.segments < MIN_SEGMENTS || cfg.segments > MAX_SEGMENTS) return null;
  }
  const r = cfg.reserveAt;
  if (r != null) {
    const max = cfg.type === 'percent' ? 100 : cfg.type === 'segments' ? cfg.segments! : 8;
    // The light coming on at F makes no sense; "at the top step" is rejected too.
    if (!isInt(r) || r < 0 || r >= max) return null;
  }
  return cfg;
}

/**
 * Grid size G: how many steps the reading can take above E (8, N, or 20 for
 * percent at 5 %). Null for an invalid config.
 */
export function stepsFor(cfg: GaugeCfg): number | null {
  const ok = validateGaugeCfg(cfg);
  if (!ok) return null;
  if (ok.type === 'needle8') return 8;
  if (ok.type === 'segments') return ok.segments!;
  return 100 / PERCENT_STEP;
}

/** The reserve step on the grid (percent converts % → 5 % steps); null when unknown. */
export function reserveStep(cfg: GaugeCfg): number | null {
  const ok = validateGaugeCfg(cfg);
  if (!ok || ok.reserveAt == null) return null;
  return ok.type === 'percent' ? Math.round(ok.reserveAt / PERCENT_STEP) : ok.reserveAt;
}

/**
 * Half-width in liters of one reading on a linear map: half a step, C/(2G).
 * That is C/16 for eighths (today's partialEconomy term without nonlinK),
 * C/(2N) for squares and C/40 for percent in 5 % steps.
 */
export function resolutionL(cfg: GaugeCfg, capacityL: number): number | null {
  const G = stepsFor(cfg);
  if (G == null || !(capacityL > 0)) return null;
  return capacityL / (2 * G);
}

/** Nearest grid step for a fraction: k = round(frac·G), or null when out of range. */
export function toGrid(frac: number, G: number): number | null {
  if (!Number.isFinite(frac) || frac < 0 || frac > 1 || !isInt(G) || G < 1) return null;
  return Math.round(frac * G);
}

/**
 * A raw reading → fraction 0..1. Accepts "n/d" on any valid scale (8, or a
 * square count 3..20 — the reading keeps its own denominator), "p%" / "p %"
 * with 0..100, and a bare step "4" read against `cfg`'s grid. Anything else,
 * or out of range, is null.
 */
export function toFraction(raw: string | null | undefined, cfg: GaugeCfg): number | null {
  if (raw == null) return null;
  const s = raw.trim();
  let m = /^(\d{1,2})\s*\/\s*(\d{1,2})$/.exec(s);
  if (m) {
    const n = Number(m[1]);
    const d = Number(m[2]);
    if (d < MIN_SEGMENTS || d > MAX_SEGMENTS || n > d) return null;
    return n / d;
  }
  m = /^(\d{1,3}(?:[.,]\d+)?)\s*%$/.exec(s);
  if (m) {
    const p = Number(m[1].replace(',', '.'));
    return p >= 0 && p <= 100 ? p / 100 : null;
  }
  m = /^(\d{1,3})$/.exec(s);
  if (m) {
    const G = stepsFor(cfg);
    if (G == null) return null;
    const k = Number(m[1]);
    if (cfg.type === 'percent') return k <= 100 ? k / 100 : null;
    return k <= G ? k / G : null;
  }
  return null;
}

export type GaugeReading = {
  /** Grid step 0..G. */
  step: number;
  /** The snapped fraction step/G — what gets stored. */
  frac: number;
  /** "4/9", "3/8", "45%". */
  raw: string;
};

/** A fraction → the nearest step on `cfg`'s grid, with its raw text. */
export function fromFraction(frac: number, cfg: GaugeCfg): GaugeReading | null {
  const G = stepsFor(cfg);
  if (G == null) return null;
  const step = toGrid(frac, G);
  if (step == null) return null;
  const raw = cfg.type === 'percent' ? `${step * PERCENT_STEP}%` : `${step}/${G}`;
  return { step, frac: step / G, raw };
}

/** Backfill for v6 eighths columns: frac = n/8 (null outside 0..8). */
export function eighthsToFrac(n: number | null | undefined): number | null {
  return isInt(n) && n >= 0 && n <= 8 ? n / 8 : null;
}

/** Backfill raw text for v6 eighths columns: "<n>/8". */
export function eighthsToRaw(n: number | null | undefined): string | null {
  return eighthsToFrac(n) == null ? null : `${n}/8`;
}

/** Percent picker snap: round(p/5)·5, clamped to 0..100. */
export function snapPercent(p: number): number | null {
  if (!Number.isFinite(p)) return null;
  return Math.min(100, Math.max(0, Math.round(p / PERCENT_STEP) * PERCENT_STEP));
}

/** Segment row drag/tap: k = clamp(round(x/W·N), 0, N). The whole row is the hit area. */
export function hitTestSegment(x: number, width: number, N: number): number | null {
  if (!Number.isFinite(x) || !(width > 0) || !isInt(N) || N < MIN_SEGMENTS || N > MAX_SEGMENTS) return null;
  return Math.min(N, Math.max(0, Math.round((x / width) * N)));
}

/**
 * Amber telltale threshold as a fraction (research §4): ≤ 2 squares, ≤ 2/8
 * on a needle, ≤ 20 %.
 */
export function amberThreshold(cfg: GaugeCfg): number | null {
  const G = stepsFor(cfg);
  if (G == null) return null;
  if (cfg.type === 'percent') return 0.2;
  return 2 / G;
}
