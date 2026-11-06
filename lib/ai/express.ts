/**
 * Fuel Express, the logic (IMP 03112026 SPEC-B §B7, P9): two photos in, one confirmation card out. Pure and tested; the
 * screen (app/carga/express.tsx) only renders it and calls `readImages`.
 *
 *   · `buildExpressCard` turns what the AI read into the values of ONE card plus the deterministic flags. The card is
 *     COMPACT (Confirmar is the only thing to do) when every read field is confident, nothing is missing and no check
 *     fails; otherwise only the failing field expands (§B7.4).
 *   · The person never types defaults: date = receipt or today, fuel = the receipt's or the last used, "tanque lleno" = yes
 *     unless the gauge hint is clearly low AND the gallons are small (then it asks, §B7.5).
 *   · `expressToDraft` is the same validation the manual form runs on Save (odometer bounds, the two-of-three amounts), so a
 *     card that confirms is a record the form would have accepted.
 */
import { completeAmounts, odometerBounds, parseDecimal, parseVolume } from '../domain/economy';
import { MI_TO_KM, firstFlagByField, fuelSanity, type SanityFlag } from '../domain/fuelSanity';
import { isoFromDateInput } from '../format';
import type { FillUp, FuelType } from '../types';
import type { AiMarks, FuelPrefill } from './fuelMap';
import { LOW_CONFIDENCE } from './read';

/** The values the card shows and lets the person edit in place: all strings, as the form's inputs hold them. */
export type ExpressValues = {
  date: string;
  odo: string;
  fuel: FuelType;
  vol: string;
  price: string;
  total: string;
  station: string;
  full: boolean;
};

export type ExpressContext = {
  today: string;
  defaultFuel: FuelType;
  lastOdometerKm: number | null;
  /** Tank capacity in the vehicle's volume unit; null when unknown. */
  tankVolume: number | null;
  referencePrice: number | null;
};

export type ExpressCard = {
  values: ExpressValues;
  marks: AiMarks;
  flags: SanityFlag[];
  /** Field → its first flag (one question per field). */
  flagBy: ReturnType<typeof firstFlagByField>;
  /** Required values the photos did not give (the card expands these inputs). */
  missing: ('odo' | 'amounts')[];
  /** Ask "¿Fue una carga parcial?" (the gauge says low and the gallons are few). */
  askPartial: boolean;
  /** Confirmar is the only thing to do. */
  compact: boolean;
  /** The dashboard showed miles: the odometer is kept as read until the person taps "Usar km". */
  milesRead: boolean;
};

/** The vehicle whose last odometer is closest to the photo's reading; null with one vehicle or no data (the active one stays). */
export function closestVehicle(readKm: number | null, vehicles: { id: string; lastOdometerKm: number | null }[]): string | null {
  if (readKm == null || vehicles.length < 2) return null;
  let best: { id: string; d: number } | null = null;
  for (const v of vehicles) {
    if (v.lastOdometerKm == null) continue;
    const d = Math.abs(v.lastOdometerKm - readKm);
    if (!best || d < best.d) best = { id: v.id, d };
  }
  return best?.id ?? null;
}

/** §B7.5: full tank unless the gauge is clearly low AND the volume is small; then ask. */
export const LOW_GAUGE = 0.35;
export const SMALL_FILL_SHARE = 0.4;
export function suggestFullTank(fuelLevel: number | undefined, volume: number | null, tankVolume: number | null): { full: boolean; ask: boolean } {
  const gaugeLow = fuelLevel != null && fuelLevel < LOW_GAUGE;
  const small = volume != null && tankVolume != null && tankVolume > 0 && volume < tankVolume * SMALL_FILL_SHARE;
  return gaugeLow && small ? { full: false, ask: true } : { full: true, ask: false };
}

export function buildExpressCard(prefill: FuelPrefill, marks: AiMarks, ctx: ExpressContext): ExpressCard {
  const volume = prefill.vol != null ? parseVolume(prefill.vol) : null;
  const fullTank = suggestFullTank(prefill.fuelLevel, volume, ctx.tankVolume);
  const values: ExpressValues = {
    date: prefill.date ?? ctx.today,
    odo: prefill.odo ?? '',
    fuel: prefill.fuel ?? ctx.defaultFuel,
    vol: prefill.vol ?? '',
    price: prefill.price ?? '',
    total: prefill.total ?? '',
    station: prefill.station ?? '',
    full: fullTank.full,
  };
  return cardFrom(values, marks, ctx, Boolean(prefill.odoUnitMi), fullTank.ask);
}

/** Recomputes the flags/compactness after an in-place edit (the person fixed a field). Marks for edited fields are removed by the caller. */
export function cardFrom(values: ExpressValues, marks: AiMarks, ctx: ExpressContext, milesRead: boolean, askPartial: boolean): ExpressCard {
  const flags = fuelSanity(
    {
      odometerKm: parseDecimal(values.odo),
      odoUnitMi: milesRead,
      volume: parseVolume(values.vol),
      pricePerUnit: parseDecimal(values.price),
      total: parseDecimal(values.total),
      date: values.date,
    },
    { lastOdometerKm: ctx.lastOdometerKm, tankVolume: ctx.tankVolume, referencePrice: ctx.referencePrice, today: ctx.today },
  );
  const missing: ExpressCard['missing'] = [];
  if (parseDecimal(values.odo) == null) missing.push('odo');
  const known = [values.vol, values.price, values.total].filter((v) => (parseDecimal(v) ?? 0) > 0).length;
  if (known < 2) missing.push('amounts');
  const unsure = Object.values(marks).some((c) => c != null && c < LOW_CONFIDENCE);
  return {
    values,
    marks,
    flags,
    flagBy: firstFlagByField(flags),
    missing,
    askPartial,
    compact: !unsure && flags.length === 0 && missing.length === 0 && !askPartial,
    milesRead,
  };
}

export type DraftOutcome =
  | { ok: true; draft: Omit<FillUp, 'id' | 'createdAt'> }
  | { ok: false; reason: 'odometer_missing' | 'odometer_low' | 'odometer_high' | 'amounts'; bound?: number };

/** The manual form's Save validation, for the card: same bounds, same completeAmounts, same field names. */
export function expressToDraft(v: ExpressValues, vehicleId: string, vehicleFillups: FillUp[], milesRead = false): DraftOutcome {
  let odometerKm = parseDecimal(v.odo);
  if (odometerKm == null) return { ok: false, reason: 'odometer_missing' };
  if (milesRead) odometerKm = Math.round(odometerKm * MI_TO_KM);
  const bounds = odometerBounds(vehicleFillups, isoFromDateInput(v.date));
  if (bounds.min != null && odometerKm < bounds.min) return { ok: false, reason: 'odometer_low', bound: bounds.min };
  if (bounds.max != null && odometerKm > bounds.max) return { ok: false, reason: 'odometer_high', bound: bounds.max };
  const amounts = completeAmounts({ volume: parseVolume(v.vol), pricePerUnit: parseDecimal(v.price), totalDop: parseDecimal(v.total) });
  if (!amounts) return { ok: false, reason: 'amounts' };
  return {
    ok: true,
    draft: {
      vehicleId,
      occurredAt: isoFromDateInput(v.date),
      odometerKm,
      volume: amounts.volume,
      pricePerUnit: amounts.pricePerUnit,
      totalDop: amounts.totalDop,
      fuelType: v.fuel,
      isFullTank: v.full,
      missedPrevious: false,
      station: v.station.trim(),
      notes: '',
      gaugeBefore8: null,
      gaugeAfter8: null,
      gaugeBeforeFrac: null,
      gaugeBeforeRaw: null,
      gaugeAfterFrac: null,
      gaugeAfterRaw: null,
      inReserve: false,
    },
  };
}
