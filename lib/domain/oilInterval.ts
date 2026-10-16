import type { Reminder } from '../db/types';
import { addMonths } from './dates';
import { SERVICE_TYPES } from './catalog';

/** Synthetic oil stretches the interval; the catalog default assumes mineral. */
export const SYNTHETIC_KM = 10_000;
export const SYNTHETIC_MONTHS = 12;

const oil = SERVICE_TYPES.find((s) => s.id === 'aceite_motor')!;
/** The catalog's own oil-change interval (what a vehicle that is not synthetic follows). */
export const CATALOG_OIL = { km: oil.km as number, months: oil.months as number, notes: oil.notes ?? '' };

type OilReminder = Pick<Reminder, 'dueKm' | 'dueDate' | 'intervalKm' | 'intervalMonths' | 'lastCompletedKm' | 'lastCompletedAt' | 'notes'>;

/**
 * The oil reminder for "¿Aceite sintético?" on or off (IMP 16102026 N5). Pure.
 *
 * The next due is counted from where the current interval started — the last change when there is one, else the
 * moment the reminder was set (due − interval) — so flipping the switch back and forth never moves the baseline and
 * never touches `lastCompleted*`. A side the reminder never had (date-only, no odometer yet) stays missing.
 */
export function oilReminderPatch(
  r: OilReminder,
  synthetic: boolean,
  syntheticNote: string = '',
): Pick<Reminder, 'dueKm' | 'dueDate' | 'intervalKm' | 'intervalMonths' | 'notes'> {
  const km = synthetic ? SYNTHETIC_KM : CATALOG_OIL.km;
  const months = synthetic ? SYNTHETIC_MONTHS : CATALOG_OIL.months;

  const baseKm = r.lastCompletedKm ?? (r.dueKm != null && r.intervalKm != null ? r.dueKm - r.intervalKm : null);
  const baseDate = r.lastCompletedAt ?? (r.dueDate && r.intervalMonths != null ? addMonths(r.dueDate, -r.intervalMonths) : null);

  return {
    intervalKm: km,
    intervalMonths: months,
    dueKm: r.dueKm != null && baseKm != null ? baseKm + km : r.dueKm,
    dueDate: r.dueDate && baseDate ? addMonths(baseDate, months) : r.dueDate,
    notes: synthetic ? syntheticNote || r.notes : CATALOG_OIL.notes,
  };
}
