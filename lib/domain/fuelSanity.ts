/**
 * The deterministic sanity checks for a fill-up read by AI (IMP 03112026 SPEC-B §B2/§B7, ADR-68: deterministic first,
 * AI second). Pure: the same numbers always give the same flags, and none of them is a model's opinion.
 *
 * The existing checks keep running where they live (`odometerBounds` in the form's save, `findRecentDuplicate` before
 * saving, `reviewFillUp` after). These flags exist so Fuel Express can ask its plain question BEFORE the person taps
 * Confirm, on one screen, with a suggested fix.
 */
export type SanityCode =
  | 'odo_below_last'
  | 'odo_miles'
  | 'total_mismatch'
  | 'date_old'
  | 'date_future'
  | 'vol_over_tank'
  | 'price_band';

export type SanityFlag = {
  code: SanityCode;
  /** The form field that should expand to ask the question. */
  field: 'odo' | 'total' | 'date' | 'vol' | 'price';
  /** Numbers the message needs (last odometer, expected total, the suggested conversion…). */
  detail: Record<string, number>;
};

export type SanityInput = {
  odometerKm: number | null;
  /** The dashboard showed miles. */
  odoUnitMi?: boolean;
  volume: number | null;
  pricePerUnit: number | null;
  total: number | null;
  /** YYYY-MM-DD */
  date: string | null;
};

export type SanityContext = {
  lastOdometerKm: number | null;
  /** Tank capacity in the SAME unit as `volume`; null when unknown. */
  tankVolume: number | null;
  /** A reference unit price in the SAME unit as `pricePerUnit` (the last fill-up's or the MICM board's); null when unknown. */
  referencePrice: number | null;
  /** YYYY-MM-DD */
  today: string;
};

export const MI_TO_KM = 1.609344;
/** gallons × price may differ from the printed total by up to this share (rounding, taxes) before we ask. */
export const TOTAL_TOLERANCE = 0.03;
export const OLD_DATE_DAYS = 7;
/** A unit price outside [ref × LOW, ref × HIGH] is "implausible" (a misread digit: 3438 vs 343.8). */
export const PRICE_LOW = 0.5;
export const PRICE_HIGH = 2;

function daysBetween(a: string, b: string): number {
  const da = Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10));
  const db = Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10));
  return Math.round((db - da) / 86_400_000);
}

export function fuelSanity(i: SanityInput, c: SanityContext): SanityFlag[] {
  const flags: SanityFlag[] = [];

  // A dashboard in miles: offer the conversion first; the below-last check then runs on the converted value.
  let odo = i.odometerKm;
  if (odo != null && i.odoUnitMi) {
    const km = Math.round(odo * MI_TO_KM);
    flags.push({ code: 'odo_miles', field: 'odo', detail: { read: odo, km } });
    odo = km;
  }
  if (odo != null && c.lastOdometerKm != null && odo < c.lastOdometerKm) {
    flags.push({ code: 'odo_below_last', field: 'odo', detail: { last: c.lastOdometerKm, read: odo } });
  }

  if (i.volume != null && i.pricePerUnit != null && i.total != null && i.total > 0) {
    const expected = i.volume * i.pricePerUnit;
    if (Math.abs(expected - i.total) / i.total > TOTAL_TOLERANCE) {
      flags.push({ code: 'total_mismatch', field: 'total', detail: { expected: Math.round(expected * 100) / 100, total: i.total } });
    }
  }

  if (i.date) {
    const age = daysBetween(i.date, c.today);
    if (age < 0) flags.push({ code: 'date_future', field: 'date', detail: { days: -age } });
    else if (age > OLD_DATE_DAYS) flags.push({ code: 'date_old', field: 'date', detail: { days: age } });
  }

  if (i.volume != null && c.tankVolume != null && c.tankVolume > 0 && i.volume > c.tankVolume * 1.05) {
    flags.push({ code: 'vol_over_tank', field: 'vol', detail: { volume: i.volume, tank: c.tankVolume } });
  }

  if (i.pricePerUnit != null && c.referencePrice != null && c.referencePrice > 0) {
    const r = c.referencePrice;
    if (i.pricePerUnit < r * PRICE_LOW || i.pricePerUnit > r * PRICE_HIGH) {
      flags.push({ code: 'price_band', field: 'price', detail: { price: i.pricePerUnit, reference: r } });
    }
  }
  return flags;
}

/** The first flag per field: Fuel Express expands only the field that fails, one question at a time. */
export function firstFlagByField(flags: SanityFlag[]): Partial<Record<SanityFlag['field'], SanityFlag>> {
  const out: Partial<Record<SanityFlag['field'], SanityFlag>> = {};
  for (const f of flags) if (!out[f.field]) out[f.field] = f;
  return out;
}
