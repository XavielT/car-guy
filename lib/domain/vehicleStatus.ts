/**
 * A vehicle's status (schema v6, 01-data-model-v6.md §1.1).
 *
 * Nine values. Four of them take the car out of the everyday selector
 * (guardado, prestado, vendido, perdido); two of those make it an Ex (vendido,
 * perdido). The badge on a card is always `outline` — one accent and one status
 * colour per screen — and the meaning is carried by the line under the name:
 * "EN EL TALLER · desde 12 sept · esperando piezas".
 */
import type { Vehicle, VehicleStatus } from '../db/types';
import { t } from '../i18n';
import { catalogText } from '../i18n/catalog';

export const VEHICLE_STATUSES: VehicleStatus[] = [
  'activo',
  'proyecto',
  'en_taller',
  'accidentado',
  'guardado',
  'restauracion',
  'prestado',
  'vendido',
  'perdido',
];

export function isVehicleStatus(v: unknown): v is VehicleStatus {
  return typeof v === 'string' && (VEHICLE_STATUSES as string[]).includes(v);
}

export function statusLabel(status: VehicleStatus): string {
  return t.vehicleStatus[status] ?? status;
}

/** Out of the everyday selector. Status ⇔ is_archived, until is_archived is dropped. */
export function isArchivedFor(status: VehicleStatus): boolean {
  return status === 'guardado' || status === 'prestado' || status === 'vendido' || status === 'perdido';
}

/** No longer yours: read-only history. */
export function isEx(status: VehicleStatus): boolean {
  return status === 'vendido' || status === 'perdido';
}

/** The short badge text on a card, or null when the status needs none (activo). */
export function statusBadgeLabel(status: VehicleStatus): string | null {
  const es = BADGE_ES[status];
  return es == null ? null : catalogText('statusBadge', status, 'label', es);
}

/** The Spanish badge per status (English: lib/i18n/catalogTranslations.en.json `statusBadge`); none for activo. */
const BADGE_ES: Partial<Record<VehicleStatus, string>> = {
  proyecto: 'PROYECTO',
  en_taller: 'EN TALLER',
  accidentado: 'ACCIDENTADO',
  guardado: 'GUARDADO',
  restauracion: 'RESTAURACIÓN',
  prestado: 'PRESTADO',
  vendido: 'EX',
  perdido: 'EX',
};

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];

function shortDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  if (!y || !m) return iso;
  const thisYear = new Date().getFullYear();
  const day = d ? `${d} ` : '';
  return y === thisYear ? `${day}${MONTHS[m - 1]}` : `${day}${MONTHS[m - 1]} ${y}`;
}

/**
 * "EN EL TALLER · desde 12 sept · esperando piezas". Null for an active car
 * with nothing to say; the parts that are missing are simply left out.
 */
export function statusLine(vehicle: Pick<Vehicle, 'status' | 'statusSince' | 'statusNote'>): string | null {
  const note = vehicle.statusNote?.trim() ?? '';
  if (vehicle.status === 'activo' && !note) return null;
  const parts = [statusLabel(vehicle.status).toUpperCase()];
  if (vehicle.statusSince) parts.push(t.statusSince(shortDate(vehicle.statusSince)));
  if (note) parts.push(note);
  return parts.join(' · ');
}
