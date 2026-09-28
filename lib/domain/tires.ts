/**
 * Tires and wheels (IMP 28092026, 01-data-model-v2.md §2.2). Pure and tested.
 *
 * `parseTireSize` never throws: a size typed off a sidewall is often partial
 * ("195/50R15" with no load index, a 1980s "165SR13"), and a partial answer is
 * worth more than an error.
 */

export type TireSize = {
  width: number | null;
  /** Aspect ratio in %; an old "165SR13" has none written and is 82 by convention. */
  aspect: number | null;
  aspectAssumed: boolean;
  /** 'R' radial, 'ZR' radial ≥ 240 km/h, 'D'/'-' bias/diagonal, null unknown. */
  construction: 'R' | 'ZR' | 'D' | null;
  rim: number | null;
  load: string | null;
  speed: string | null;
};

const EMPTY: TireSize = { width: null, aspect: null, aspectAssumed: false, construction: null, rim: null, load: null, speed: null };

/**
 * "195/50R15 82V", "195/50 ZR15", "185/60-14", "165SR13", "205/55R16" → parts.
 * Anything unrecognised comes back with the fields it could read and nulls.
 */
export function parseTireSize(raw: string | null | undefined): TireSize {
  if (!raw) return { ...EMPTY };
  const s = raw.toUpperCase().replace(/\s+/g, ' ').trim();

  // Metric: 195/50R15 82V · 195/50 ZR15 · 185/60-14 · 195/50R15 (no load)
  let m = s.match(/^P?(\d{3})\s?\/\s?(\d{2})\s?(ZR|R|D|-)\s?(\d{2}(?:\.\d)?)(?:\s?(\d{2,3}(?:\/\d{2,3})?)\s?([A-Z]))?/);
  if (m) {
    return {
      width: Number(m[1]),
      aspect: Number(m[2]),
      aspectAssumed: false,
      construction: m[3] === '-' || m[3] === 'D' ? 'D' : (m[3] as 'R' | 'ZR'),
      rim: Number(m[4]),
      load: m[5] ?? null,
      speed: m[6] ?? null,
    };
  }
  // Old metric with the speed letter before R and no aspect: 165SR13, 175HR14.
  m = s.match(/^(\d{3})\s?([A-Z])R\s?(\d{2})/);
  if (m) return { width: Number(m[1]), aspect: 82, aspectAssumed: true, construction: 'R', rim: Number(m[3]), load: null, speed: m[2] };
  // No aspect at all: 165R13 (also 82 by convention).
  m = s.match(/^(\d{3})\s?R\s?(\d{2})/);
  if (m) return { width: Number(m[1]), aspect: 82, aspectAssumed: true, construction: 'R', rim: Number(m[2]), load: null, speed: null };

  // Partial: whatever numbers are there.
  const width = s.match(/^(\d{3})/)?.[1];
  const rim = s.match(/R\s?(\d{2})/)?.[1];
  return { ...EMPTY, width: width ? Number(width) : null, rim: rim ? Number(rim) : null };
}

/** Overall diameter in mm: rim × 25.4 + 2 × sidewall. Null when a part is missing. */
export function tireDiameterMm(size: TireSize): number | null {
  if (size.width == null || size.aspect == null || size.rim == null) return null;
  return size.rim * 25.4 + 2 * size.width * (size.aspect / 100);
}

export function circumferenceMm(size: TireSize): number | null {
  const d = tireDiameterMm(size);
  return d == null ? null : Math.PI * d;
}

export function revsPerKm(size: TireSize): number | null {
  const c = circumferenceMm(size);
  return c == null ? null : 1_000_000 / c;
}

/**
 * New size against the old: diameter change and what the speedometer shows.
 * A bigger tire covers more ground per turn, so the car goes faster than the
 * needle says: at an indicated 100 the real speed is 100 × (1 + diffPct/100),
 * i.e. the speedo reads `speedoErrorPct` low (negative).
 */
export function compareSizes(a: TireSize, b: TireSize): { diffPct: number; speedoErrorPct: number; realAt100: number } | null {
  const da = tireDiameterMm(a);
  const db = tireDiameterMm(b);
  if (da == null || db == null) return null;
  const diffPct = ((db - da) / da) * 100;
  return { diffPct, speedoErrorPct: -diffPct, realAt100: 100 * (db / da) };
}

/**
 * DOT date code: the last four digits "WWYY" ("2323" = week 23 of 2023). A
 * pre-2000 three-digit code has no decade, so it is only flagged as old.
 * `flag` is true from 6 years — the age most makers say to replace at,
 * tread or not.
 */
export function dotAge(
  code: string | null | undefined,
  today: Date = new Date(),
): { week: number; year: number; ageYears: number; flag: boolean } | { legacy: true; flag: true } | null {
  const digits = (code ?? '').replace(/\D/g, '');
  if (digits.length === 3) return { legacy: true, flag: true };
  if (digits.length < 4) return null;
  const four = digits.slice(-4);
  const week = Number(four.slice(0, 2));
  const year = 2000 + Number(four.slice(2));
  if (week < 1 || week > 53 || year > today.getFullYear() + 1) return null;
  // Monday of ISO-ish week `week`: close enough for an age in years.
  const made = new Date(year, 0, 1 + (week - 1) * 7);
  const ageYears = Math.max(0, (today.getTime() - made.getTime()) / (365.25 * 86_400_000));
  return { week, year, ageYears, flag: ageYears >= 6 };
}

/**
 * Where the new wheel sits against the old, in mm (positive = further out).
 * Poke: the outer face moves out by half the width change plus the offset
 * drop. Inset: the inner face moves in by half the width change minus it.
 */
export function offsetDelta(
  oldWheel: { widthIn: number; offsetMm: number },
  newWheel: { widthIn: number; offsetMm: number },
): { pokeMm: number; insetMm: number } {
  const halfDelta = ((newWheel.widthIn - oldWheel.widthIn) * 25.4) / 2;
  const offsetDrop = oldWheel.offsetMm - newWheel.offsetMm;
  return { pokeMm: Math.round(halfDelta + offsetDrop), insetMm: Math.round(halfDelta - offsetDrop) };
}

/** "15x8 ET0" / "15x8 +35" / "7Jx17 ET42" → width, diameter, offset. */
export function parseWheelSpec(raw: string | null | undefined): { widthIn: number | null; diamIn: number | null; offsetMm: number | null } {
  const s = (raw ?? '').toUpperCase();
  const m = s.match(/(\d{1,2}(?:\.\d)?)\s?J?\s?X\s?(\d{2})|(\d{2})\s?X\s?(\d{1,2}(?:\.\d)?)/);
  let widthIn: number | null = null;
  let diamIn: number | null = null;
  if (m) {
    // "15x8" (diameter first) is how the scene writes it; "7Jx17" is width first.
    const a = Number(m[1] ?? m[3]);
    const b = Number(m[2] ?? m[4]);
    if (a >= 12 && b < 12) [diamIn, widthIn] = [a, b];
    else [widthIn, diamIn] = [a, b];
  }
  const off = s.match(/(?:ET|OFFSET|\+)\s?(-?\d{1,3})/) ?? s.match(/\s(-\d{1,3})\b/);
  return { widthIn, diamIn, offsetMm: off ? Number(off[1]) : null };
}
