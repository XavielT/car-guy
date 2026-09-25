import { FUEL_CATALOG } from './fuel';
import type { FuelType } from './types';

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

export function volume(n: number, type: FuelType): string {
  return `${qty.format(n)} ${FUEL_CATALOG[type].unitLabel}`;
}

export function km(n: number): string {
  return `${kmFmt.format(n)} km`;
}

/** An economy figure without its unit, one decimal like everywhere else. */
export function economyNumber(n: number): string {
  return economyFmt.format(n);
}

export function kmPerUnit(n: number, type: FuelType): string {
  const unit = FUEL_CATALOG[type].unit === 'm3' ? 'km/m³' : 'km/gal';
  return `${economyFmt.format(n)} ${unit}`;
}

export function dateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString('es-DO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function monthTitle(year: number, month: number): string {
  const label = new Date(year, month, 1).toLocaleDateString('es-DO', {
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
