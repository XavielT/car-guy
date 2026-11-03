/**
 * Maps what the AI read (receipt, dashboard, pump: separately or merged by Fuel Express) onto the fill-up form's fields
 * (IMP 03112026 SPEC-B §B2/§B7). Pure. The form keeps its own validation, the duplicate check and the review sheet:
 * this only proposes values as the STRINGS the form's inputs hold, plus the confidence of each, so the form can mark
 * them "AI" and outline the unsure ones.
 *
 * Units: Dominican receipts are in gallons and RD$/gallon. A vehicle that counts in litres gets them converted here,
 * once, so the person never does arithmetic.
 */
import { GAL_L, fromLiters, toLiters, type VolumeUnit } from '../domain/units';
import type { FuelType } from '../types';
import { conf, num, str, type ReadResult } from './read';

/** The form's value strings, only for fields the AI actually read. */
export type FuelPrefill = {
  date?: string; // YYYY-MM-DD (the DateField value)
  odo?: string;
  fuel?: FuelType;
  vol?: string;
  price?: string;
  total?: string;
  station?: string;
  /** The dashboard showed miles: the odometer value was kept as read and the person is asked (see fuelSanity). */
  odoUnitMi?: boolean;
  /** Gauge reading 0..1 from the dashboard: a hint for "tanque lleno", never saved by itself. */
  fuelLevel?: number;
  /** Receipt number and NCF are kept for the note / the invoice record, not for a field of the form. */
  ncf?: string;
};

/** field name → confidence 0..1 (only for AI-filled fields). */
export type AiMarks = Partial<Record<'date' | 'odo' | 'fuel' | 'vol' | 'price' | 'total' | 'station', number>>;

const FUEL_WORDS: [RegExp, FuelType][] = [
  [/optimo|óptimo/, 'gasoil_optimo'],
  [/gasoil|diesel|diésel/, 'gasoil_regular'],
  [/glp|propano/, 'glp'],
  [/gnv|natural/, 'gnv'],
  [/premium|super|súper/, 'premium'],
  [/regular|gasolina/, 'regular'],
];

/** "Gasolina Premium", "DIESEL OPTIMO", "REGULAR" → the app's fuel id; null when the text says nothing we know. */
export function fuelTypeFromText(text: string | null | undefined): FuelType | null {
  if (!text) return null;
  const s = text.toLowerCase();
  for (const [re, id] of FUEL_WORDS) if (re.test(s)) return id;
  return null;
}

const round = (n: number, d: number) => Math.round(n * 10 ** d) / 10 ** d;

/** Gallons (as printed) → the vehicle's volume unit; RD$/gal → RD$/unit. */
export function toVehicleVolume(gallons: number, unit: VolumeUnit): number {
  return unit === 'gal' ? gallons : fromLiters(toLiters(gallons, 'gal'), unit);
}
export function toVehiclePrice(perGallon: number, unit: VolumeUnit): number {
  return unit === 'gal' ? perGallon : perGallon / GAL_L;
}

/** One read result (any kind that carries fuel fields) → prefill + marks. */
export function fuelPrefillFrom(r: ReadResult, volumeUnit: VolumeUnit = 'gal'): { prefill: FuelPrefill; marks: AiMarks } {
  const prefill: FuelPrefill = {};
  const marks: AiMarks = {};

  const odo = num(r, 'odometer');
  if (odo != null) {
    prefill.odo = String(Math.round(odo));
    marks.odo = conf(r, 'odometer');
    if (str(r, 'unit') === 'mi') prefill.odoUnitMi = true;
  }

  // The receipt's gallons are the printed truth; the pump display is the fallback.
  const gallons = num(r, 'gallons') ?? num(r, 'pump_gallons');
  if (gallons != null) {
    prefill.vol = String(round(toVehicleVolume(gallons, volumeUnit), 3));
    marks.vol = num(r, 'gallons') != null ? conf(r, 'gallons') : conf(r, 'pump_gallons');
  }
  const price = num(r, 'unit_price');
  if (price != null) {
    prefill.price = String(round(toVehiclePrice(price, volumeUnit), 2));
    marks.price = conf(r, 'unit_price');
  }
  const total = num(r, 'total') ?? num(r, 'amount') ?? num(r, 'pump_amount');
  if (total != null) {
    prefill.total = String(round(total, 2));
    marks.total = num(r, 'total') != null ? conf(r, 'total') : num(r, 'amount') != null ? conf(r, 'amount') : conf(r, 'pump_amount');
  }
  const date = str(r, 'date');
  if (date) {
    prefill.date = date;
    marks.date = conf(r, 'date');
  }
  const fuel = fuelTypeFromText(str(r, 'product'));
  if (fuel) {
    prefill.fuel = fuel;
    marks.fuel = conf(r, 'product');
  }
  const station = str(r, 'station');
  if (station) {
    prefill.station = station;
    marks.station = conf(r, 'station');
  }
  const level = num(r, 'fuel_level');
  if (level != null) prefill.fuelLevel = level;
  const ncf = str(r, 'ncf');
  if (ncf) prefill.ncf = ncf;
  return { prefill, marks };
}

/** Several results (receipt + dashboard…) → one. A field read twice keeps the more confident reading. */
export function mergeFuelPrefills(parts: { prefill: FuelPrefill; marks: AiMarks }[]): { prefill: FuelPrefill; marks: AiMarks } {
  const prefill: FuelPrefill = {};
  const marks: AiMarks = {};
  for (const p of parts) {
    for (const [k, v] of Object.entries(p.prefill) as [keyof FuelPrefill, unknown][]) {
      const markKey = k as keyof AiMarks;
      const incoming = p.marks[markKey] ?? 0;
      const current = marks[markKey];
      if (!(k in prefill) || current == null || incoming > current) {
        (prefill as Record<string, unknown>)[k] = v;
        if (p.marks[markKey] != null) marks[markKey] = incoming;
      }
    }
  }
  return { prefill, marks };
}
