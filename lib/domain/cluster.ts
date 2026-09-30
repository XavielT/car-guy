import type { Reminder } from '../db/types';
import type { ReminderStatus } from './reminders';
import { catalogLabel } from '../i18n/catalog';

/**
 * What the cluster hero's needle reads (05-design-jdm.md, ClusterHero): how
 * much of the interval to the nearest due service has been used up.
 *
 * km first — it is what the odometer in the middle of the dial measures — and
 * days when no km-based reminder has an interval. 0 = just serviced, 1 = due;
 * overdue pins at 1, which is where the red wedge is. Pure, so it is tested
 * rather than eyeballed on a phone.
 */
export type ClusterReading = {
  progress: number;
  /** "PRÓX. SERVICIO" subject, e.g. the reminder's title. */
  title: string;
  /** Remaining distance or days; negative means overdue. */
  remaining: { km: number } | { days: number };
  /** For the mono line — the predicted date when km-based. */
  predictedDueDate: string | null;
};

type Evaluated = { reminder: Reminder; status: ReminderStatus };

export function clusterReading(evaluated: Evaluated[]): ClusterReading | null {
  const live = evaluated.filter((e) => e.status.status !== 'sin_datos' && !e.status.snoozed);

  const byKm = live
    .filter((e) => e.status.dueKm != null && (e.reminder.intervalKm ?? 0) > 0)
    .sort((a, b) => a.status.dueKm! - b.status.dueKm!)[0];
  if (byKm) {
    const interval = byKm.reminder.intervalKm!;
    return {
      progress: clamp(1 - byKm.status.dueKm! / interval),
      title: catalogLabel('reminder', byKm.reminder, 'title'),
      remaining: { km: byKm.status.dueKm! },
      predictedDueDate: byKm.status.predictedDueDate,
    };
  }

  const byDays = live
    .filter((e) => e.status.dueDays != null && intervalDays(e.reminder) > 0)
    .sort((a, b) => a.status.dueDays! - b.status.dueDays!)[0];
  if (byDays) {
    return {
      progress: clamp(1 - byDays.status.dueDays! / intervalDays(byDays.reminder)),
      title: catalogLabel('reminder', byDays.reminder, 'title'),
      remaining: { days: byDays.status.dueDays! },
      predictedDueDate: byDays.reminder.dueDate,
    };
  }
  return null;
}

function intervalDays(r: Reminder): number {
  return r.intervalDays ?? (r.intervalMonths != null ? Math.round(r.intervalMonths * 30.44) : 0);
}

const clamp = (n: number) => Math.max(0, Math.min(1, n));
