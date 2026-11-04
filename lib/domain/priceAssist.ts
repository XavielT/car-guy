/**
 * Fuel price assist (IMP 03112026 SPEC-G §G5). Pure, no AI: the model only READ the receipt (SPEC-B); everything here is arithmetic
 * on what the person saved and on the board of reference prices.
 *
 *  - `paidVsReference`: "you paid RD$ 12 more per gallon than the weekly reference". Compared per GALLON, the unit the board uses.
 *  - `receiptPriceOffer`: the station price printed on a receipt, offered as a `recibo` row of `fuel_price` ONLY when the person
 *    says yes. Never saved by itself; never offered twice for the same fuel, station and day.
 */
import { GAL_L } from './units';
import type { FuelType } from '../types';

/** Within this many RD$ per gallon of the reference counts as "the same" (rounding at the pump, a station's own cents). */
export const SAME_BAND = 0.5;
/** A receipt price further than this from the reference is probably a misread, not a price worth sharing. */
export const PLAUSIBLE = { min: 0.5, max: 2 };

export type PaidTone = 'above' | 'below' | 'same';
export type PaidVsReference = { paidPerGal: number; refPerGal: number; diffPerGal: number; pct: number; tone: PaidTone };

const cents = (n: number) => Math.round(n * 100) / 100;

/** The price per gallon of a fill-up whose volume unit is gallons or litres. GNV is per m³ and has no comparable board row. */
export function perGallon(pricePerUnit: number, fuelType: FuelType, volumeUnit: 'gal' | 'l'): number | null {
  if (fuelType === 'gnv') return null;
  if (!Number.isFinite(pricePerUnit) || pricePerUnit <= 0) return null;
  return cents(volumeUnit === 'l' ? pricePerUnit * GAL_L : pricePerUnit);
}

/** null when there is no reference for this fuel or the fill-up has no usable price. */
export function paidVsReference(input: { pricePerUnit: number; fuelType: FuelType; volumeUnit?: 'gal' | 'l'; reference: Partial<Record<FuelType, number>> }): PaidVsReference | null {
  const paid = perGallon(input.pricePerUnit, input.fuelType, input.volumeUnit ?? 'gal');
  const ref = input.reference[input.fuelType];
  if (paid == null || ref == null || !Number.isFinite(ref) || ref <= 0) return null;
  const diff = cents(paid - ref);
  const tone: PaidTone = Math.abs(diff) < SAME_BAND ? 'same' : diff > 0 ? 'above' : 'below';
  return { paidPerGal: paid, refPerGal: cents(ref), diffPerGal: diff, pct: Math.round((diff / ref) * 1000) / 10, tone };
}

export type OfferRow = { fuelType: FuelType; validFrom: string; station: string; source: string; deletedAt?: string | null };

export type PriceOffer = { fuelType: FuelType; price: number; validFrom: string; station: string; source: 'recibo'; note: '' };

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * The `fuel_price` row a receipt could add, or null when it should not be offered: no station printed (a price without a place is
 * of no use to anyone), no usable price, a price implausibly far from the reference, or the same station/fuel/day already there.
 */
export function receiptPriceOffer(input: {
  fillUp: { fuelType: FuelType; pricePerUnit: number; occurredAt: string; station: string };
  volumeUnit?: 'gal' | 'l';
  reference: Partial<Record<FuelType, number>>;
  existing: readonly OfferRow[];
}): PriceOffer | null {
  const { fillUp } = input;
  const station = fillUp.station.trim();
  if (!station) return null;
  const price = perGallon(fillUp.pricePerUnit, fillUp.fuelType, input.volumeUnit ?? 'gal');
  if (price == null) return null;
  const ref = input.reference[fillUp.fuelType];
  if (ref != null && ref > 0 && (price < ref * PLAUSIBLE.min || price > ref * PLAUSIBLE.max)) return null;
  const day = fillUp.occurredAt.slice(0, 10);
  const dup = input.existing.some((r) => !r.deletedAt && r.fuelType === fillUp.fuelType && r.validFrom.slice(0, 10) === day && norm(r.station) === norm(station));
  if (dup) return null;
  return { fuelType: fillUp.fuelType, price, validFrom: day, station, source: 'recibo', note: '' };
}
