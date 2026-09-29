/** lib/domain/vehicleStatus.ts — nine statuses (01-data-model-v6.md §1.1). */
import { statusBadge } from '@/lib/domain/garage';
import { isArchivedFor, isEx, statusLine, VEHICLE_STATUSES } from '@/lib/domain/vehicleStatus';
import { es } from '@/lib/i18n/es';

it('nine statuses, each with a Spanish label', () => {
  expect(VEHICLE_STATUSES).toHaveLength(9);
  for (const s of VEHICLE_STATUSES) expect(es.vehicleStatus[s]).toBeTruthy();
});

it('out of the selector: guardado, prestado, vendido, perdido; Ex: vendido, perdido', () => {
  expect(VEHICLE_STATUSES.filter(isArchivedFor)).toEqual(['guardado', 'prestado', 'vendido', 'perdido']);
  expect(VEHICLE_STATUSES.filter(isEx)).toEqual(['vendido', 'perdido']);
});

it('every non-active status is an outline badge; an active stock car is the DAILY', () => {
  expect(statusBadge('en_taller', 0)).toEqual({ label: 'EN TALLER', tone: 'outline' });
  expect(statusBadge('accidentado', 3)).toEqual({ label: 'ACCIDENTADO', tone: 'outline' });
  expect(statusBadge('restauracion', 0)).toEqual({ label: 'RESTAURACIÓN', tone: 'outline' });
  expect(statusBadge('prestado', 0)).toEqual({ label: 'PRESTADO', tone: 'outline' });
  expect(statusBadge('vendido', 0)).toEqual({ label: 'EX', tone: 'outline' });
  expect(statusBadge('activo', 0)).toEqual({ label: 'DAILY', tone: 'amber' });
  expect(statusBadge('activo', 2)).toBeNull();
});

it('the status line leaves out what is missing', () => {
  const year = new Date().getFullYear();
  expect(statusLine({ status: 'en_taller', statusSince: `${year}-09-12`, statusNote: 'esperando piezas' })).toBe(
    'EN EL TALLER · desde 12 sept · esperando piezas',
  );
  expect(statusLine({ status: 'guardado', statusSince: '2024-03-01', statusNote: '' })).toBe('GUARDADO · desde 1 mar 2024');
  expect(statusLine({ status: 'activo', statusSince: null, statusNote: '' })).toBeNull();
});
