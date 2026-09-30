/**
 * Volume and economy units (IMP 29092026 ADR-33).
 *
 * From schema v6 every liquid volume is stored in **liters** — `fuel_log.volume`,
 * `fuel_log.price_per_unit` (RD$ per liter), `vehicle.tank_volume` — and each
 * vehicle chooses how it is shown: `volume_unit` 'gal' | 'l' and `economy_unit`
 * km_gal | km_l | l_100km. Existing vehicles default to gallons, so a 2.1.x
 * garage reads exactly as it did.
 *
 * GNV is the exception: it is sold and logged in m³ (lib/fuel.ts), is never
 * converted, and its economy is km/m³ whatever the vehicle's setting says.
 *
 * Pure TypeScript, no React.
 */
import type { FuelType } from '../types';

/** US liquid gallon, exact by definition (231 in³). */
export const GAL_L = 3.785411784;

export type VolumeUnit = 'gal' | 'l';
export type EconomyUnit = 'km_gal' | 'km_l' | 'l_100km';

export const VOLUME_UNITS: VolumeUnit[] = ['gal', 'l'];
export const ECONOMY_UNITS: EconomyUnit[] = ['km_gal', 'km_l', 'l_100km'];

/**
 * Six decimals, not three: a volume goes gallons → liters → gallons on every
 * read of an old fill-up, and three decimals of liters moved km/gal in the third
 * decimal (11.2 gal → 42.397 L → 11.19994 gal).
 */
const STORE = 1e6;
const round = (n: number) => Math.round(n * STORE) / STORE;

/** GNV is m³ and stays m³ — only liquid fuels have a gallon/liter choice. */
export function isLiquid(fuelType: FuelType | string | null | undefined): boolean {
  return fuelType !== 'gnv';
}

export function toLiters(value: number, unit: VolumeUnit): number {
  return unit === 'gal' ? round(value * GAL_L) : round(value);
}

export function fromLiters(liters: number, unit: VolumeUnit): number {
  return unit === 'gal' ? round(liters / GAL_L) : round(liters);
}

/** RD$ per `unit` → RD$ per liter (a price divides where a volume multiplies). */
export function pricePerLiter(price: number, unit: VolumeUnit): number {
  return unit === 'gal' ? round(price / GAL_L) : round(price);
}

export function priceFromPerLiter(perLiter: number, unit: VolumeUnit): number {
  return unit === 'gal' ? round(perLiter * GAL_L) : round(perLiter);
}

/** The unit a stored volume is shown in: the vehicle's, or m³ for GNV. */
export function displayUnitLabel(fuelType: FuelType | string, unit: VolumeUnit): string {
  if (!isLiquid(fuelType)) return 'm³';
  return unit === 'gal' ? 'gal' : 'L';
}

export function perUnitLabel(fuelType: FuelType | string, unit: VolumeUnit): string {
  return `RD$/${displayUnitLabel(fuelType, unit)}`;
}

export function economyUnitLabel(fuelType: FuelType | string, unit: EconomyUnit): string {
  if (!isLiquid(fuelType)) return 'km/m³';
  if (unit === 'l_100km') return 'L/100 km';
  return unit === 'km_l' ? 'km/L' : 'km/gal';
}

/**
 * The volume unit an economy unit is measured in — km/gal needs gallons, the
 * other two liters. Used to express a distance/volume pair in the right unit
 * before dividing, so the result is not a rounded conversion of a rounded one.
 */
export function economyVolumeUnit(unit: EconomyUnit): VolumeUnit {
  return unit === 'km_gal' ? 'gal' : 'l';
}

/** km per liter → the figure in `unit`. L/100 km inverts; 0 stays 0 rather than ∞. */
export function economyFromKmPerLiter(kmPerL: number, unit: EconomyUnit): number {
  if (unit === 'km_gal') return kmPerL * GAL_L;
  if (unit === 'km_l') return kmPerL;
  return kmPerL > 0 ? 100 / kmPerL : 0;
}

/** For comparisons: with L/100 km a *smaller* number is the better tank. */
export function higherIsBetter(unit: EconomyUnit): boolean {
  return unit !== 'l_100km';
}

export function isVolumeUnit(v: unknown): v is VolumeUnit {
  return v === 'gal' || v === 'l';
}

export function isEconomyUnit(v: unknown): v is EconomyUnit {
  return v === 'km_gal' || v === 'km_l' || v === 'l_100km';
}

// ------------------------------------------------ the store's boundary ---
//
// The screens, the economy maths and the charts work in the vehicle's display
// unit, exactly as they did in gallons before v6; the database holds liters.
// These two functions are the only crossing (lib/store.tsx).

const round3 = (n: number) => Math.round(n * 1000) / 1000;
const money = (n: number) => Math.round(n * 100) / 100;

export type StoredFuel = {
  volume: number;
  pricePerUnit: number;
  fuelType: FuelType | string;
  volumeEntered?: number | null;
  volumeEnteredUnit?: string | null;
};

/**
 * A stored fill-up in `unit`. When it was typed in that same unit the typed
 * number comes back untouched, so a gallons car shows 11.2, never 11.19994.
 */
export function fuelForDisplay(row: StoredFuel, unit: VolumeUnit): { volume: number; pricePerUnit: number } {
  if (!isLiquid(row.fuelType)) return { volume: row.volume, pricePerUnit: row.pricePerUnit };
  const volume =
    row.volumeEntered != null && row.volumeEnteredUnit === unit ? row.volumeEntered : round3(fromLiters(row.volume, unit));
  return { volume, pricePerUnit: money(priceFromPerLiter(row.pricePerUnit, unit)) };
}

/** What a form typed in `unit` is stored as. GNV passes through in m³. */
export function fuelForStorage(
  input: { volume: number; pricePerUnit: number; fuelType: FuelType | string },
  unit: VolumeUnit,
): { volume: number; pricePerUnit: number; volumeEntered: number; volumeEnteredUnit: 'gal' | 'l' | 'm3' } {
  if (!isLiquid(input.fuelType)) {
    return { volume: input.volume, pricePerUnit: input.pricePerUnit, volumeEntered: input.volume, volumeEnteredUnit: 'm3' };
  }
  return {
    volume: toLiters(input.volume, unit),
    pricePerUnit: pricePerLiter(input.pricePerUnit, unit),
    volumeEntered: input.volume,
    volumeEnteredUnit: unit,
  };
}

/** The tank in `unit`; the typed value when it still matches what is stored. */
export function tankForDisplay(
  tankLiters: number | null,
  entered: number | null | undefined,
  unit: VolumeUnit,
  fuelType: FuelType | string,
): number | null {
  if (tankLiters == null) return null;
  if (!isLiquid(fuelType)) return tankLiters;
  const converted = fromLiters(tankLiters, unit);
  return entered != null && Math.abs(entered - converted) < 0.01 ? entered : round3(converted);
}

export function tankForStorage(
  typed: number | null,
  unit: VolumeUnit,
  fuelType: FuelType | string,
): { tankVolume: number | null; tankVolumeEntered: number | null } {
  if (typed == null) return { tankVolume: null, tankVolumeEntered: null };
  if (!isLiquid(fuelType)) return { tankVolume: typed, tankVolumeEntered: typed };
  return { tankVolume: toLiters(typed, unit), tankVolumeEntered: typed };
}
