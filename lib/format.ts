import { displayUnitLabel, economyFromKmPerLiter, economyUnitLabel, GAL_L, type EconomyUnit, type VolumeUnit } from './domain/units';
import type { FuelType } from './types';
import { localeTag } from './i18n';

// Numbers and money read the same in es-DO and en-US (1,234.50) and RD$ stays RD$ in
// English too, so these stay es-DO; dates follow the language (ADR-39).
const dop = new Intl.NumberFormat('es-DO', {
  style: 'currency',
  currency: 'DOP',
  minimumFractionDigits: 2,
});

const qty = new Intl.NumberFormat('es-DO', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 3,
});

const kmFmt = new Intl.NumberFormat('es-DO', {
  maximumFractionDigits: 0,
});

// Fuel economy is only as good as the pump's reading and the odometer's; a
// third decimal (41.346 km/gal) claims a precision neither has.
const economyFmt = new Intl.NumberFormat('es-DO', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export function money(n: number): string {
  return dop.format(n).replace('RD$', 'RD$ ');
}

/** A volume in the vehicle's unit (v6); GNV is always m³. */
export function volume(n: number, type: FuelType, unit: VolumeUnit = 'gal'): string {
  return `${qty.format(n)} ${displayUnitLabel(type, unit)}`;
}

export function km(n: number): string {
  return `${kmFmt.format(n)} km`;
}

/** An economy figure without its unit, one decimal like everywhere else. */
export function economyNumber(n: number): string {
  return economyFmt.format(n);
}

/**
 * km per the vehicle's volume unit — the figure computeEconomy returns over the
 * store's fill-ups, which are already in that unit (lib/domain/units.ts).
 */
export function kmPerUnit(n: number, type: FuelType, unit: VolumeUnit = 'gal', economy?: EconomyUnit | null): string {
  if (economy === 'l_100km' && type !== 'gnv') return `${economyFmt.format(economyValue(n, unit, economy))} ${economyUnitLabel(type, 'l_100km')}`;
  return `${economyFmt.format(n)} ${economyUnitLabel(type, unit === 'l' ? 'km_l' : 'km_gal')}`;
}

/**
 * A km-per-volume-unit figure (what the economy maths returns) in the vehicle's
 * chosen economy unit: unchanged for km/gal and km/L, inverted for L/100 km
 * (where a smaller number is the better tank — lib/domain/units.ts higherIsBetter).
 */
export function economyValue(n: number, unit: VolumeUnit = 'gal', economy?: EconomyUnit | null): number {
  if (economy !== 'l_100km') return n;
  return economyFromKmPerLiter(unit === 'gal' ? n / GAL_L : n, 'l_100km');
}

export function dateLabel(iso: string): string {
  // A date-only value ('2018-01-01') parses as UTC midnight — the evening before
  // in Santo Domingo. Read it as a local calendar day instead.
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  const date = day ? new Date(Number(day[1]), Number(day[2]) - 1, Number(day[3])) : new Date(iso);
  return date.toLocaleDateString(localeTag(), {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * "30 sep 2026 · 3:58 p. m." / "Sep 30, 2026 · 3:58 PM" — a moment, not just a day (IMP 01102026 note 5:
 * Cuenta → última sincronización). Intl in the app's language; local time.
 */
export function dateTimeLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const time = date.toLocaleTimeString(localeTag(), { hour: 'numeric', minute: '2-digit' });
  return `${dateLabel(iso)} · ${time}`;
}

export function monthTitle(year: number, month: number): string {
  const label = new Date(year, month, 1).toLocaleDateString(localeTag(), {
    month: 'long',
    year: 'numeric',
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function id(): string {
  return globalThis.crypto?.randomUUID?.() ?? `id_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function todayIsoDate(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function isoFromDateInput(date: string): string {
  const [y, m, day] = date.split('-').map(Number);
  return new Date(y, m - 1, day, 12, 0, 0).toISOString();
}

export function dateInputFromIso(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
