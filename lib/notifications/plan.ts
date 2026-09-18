/**
 * What to schedule, as a pure function.
 *
 * The Expo calls are a thin adapter around this (ADR-07); everything that can be
 * wrong — too many, wrong order, duplicate ids, something in the past — is
 * decided here where it can be tested.
 */
import { addDays, daysBetween } from '../domain/dates';
import type { Cadence } from '../db/types';

/**
 * The cap. iOS allows 64 pending notifications and Android's AlarmManager many
 * more, but 30 keeps both comfortable and, more importantly, keeps the plan
 * small enough for a person to read in the settings screen.
 */
export const MAX_SCHEDULED = 30;

export type PlannedNotification =
  | {
      kind: 'date';
      /** Deterministic, so re-planning replaces rather than duplicates. */
      id: string;
      title: string;
      body: string;
      date: string;
      route: string;
    }
  | {
      kind: 'daily' | 'weekly' | 'monthly';
      id: string;
      title: string;
      body: string;
      hour: number;
      minute: number;
      /** 1 = Sunday, per expo-notifications. */
      weekday?: number;
      day?: number;
      route: string;
    };

export type PlanInput = {
  today: string;
  hour: number;
  minute: number;
  /** 1 = Sunday. */
  weeklyWeekday: number;
  reminders: {
    id: string;
    title: string;
    dueDate: string | null;
    predictedDueDate: string | null;
    status: string;
  }[];
  templates: { id: string; name: string; cadence: Cadence; enabled: boolean }[];
  marbeteNudges: { date: string; message: string }[];
};

/**
 * Builds the schedule.
 *
 * Ordered by how soon each one fires, then truncated — so when there are more
 * candidates than slots, the ones that survive are the ones that matter next.
 */
export function planNotifications(input: PlanInput): PlannedNotification[] {
  const dated: (PlannedNotification & { at: string })[] = [];

  for (const reminder of input.reminders) {
    // The predicted date is what a km-based reminder actually needs; the due
    // date is for the ones with a calendar deadline.
    const when = reminder.dueDate ?? reminder.predictedDueDate;
    if (!when) continue;
    // A DATE trigger in the past fires the moment it is scheduled, which would
    // mean a burst of notifications for everything already overdue.
    if (daysBetween(input.today, when) <= 0) continue;

    dated.push({
      kind: 'date',
      id: `reminder:${reminder.id}:due`,
      title: reminder.title,
      body: 'Te toca esto hoy.',
      date: when,
      at: when,
      route: `/recordatorio/${reminder.id}`,
    });
  }

  for (const nudge of input.marbeteNudges) {
    if (daysBetween(input.today, nudge.date) <= 0) continue;
    dated.push({
      kind: 'date',
      id: `marbete:${nudge.date.slice(0, 10)}`,
      title: 'Marbete',
      body: nudge.message,
      date: nudge.date,
      at: nudge.date,
      route: '/recordatorios',
    });
  }

  dated.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));

  const repeating: PlannedNotification[] = [];
  for (const template of input.templates) {
    if (!template.enabled) continue;
    const common = {
      id: `template:${template.id}`,
      title: template.name,
      body: 'Dos minutos y queda hecho.',
      hour: input.hour,
      minute: input.minute,
      route: `/chequeo/${template.id}/run`,
    };
    if (template.cadence === 'diaria') repeating.push({ ...common, kind: 'daily' });
    else if (template.cadence === 'semanal') {
      repeating.push({ ...common, kind: 'weekly', weekday: input.weeklyWeekday });
    } else if (template.cadence === 'mensual') repeating.push({ ...common, kind: 'monthly', day: 1 });
  }

  // Repeating ones first: they are the habit, and they are few. The dated ones
  // fill whatever is left.
  const plan = [...repeating, ...dated.map(({ at: _at, ...rest }) => rest)];
  return plan.slice(0, MAX_SCHEDULED);
}

/** Sanity helper for the settings screen: are there duplicate ids? */
export function hasDuplicateIds(plan: PlannedNotification[]): boolean {
  return new Set(plan.map((p) => p.id)).size !== plan.length;
}

/** The next occurrence of a weekday at a given hour, for the settings preview. */
export function nextWeekday(today: string, weekday: number): string {
  const current = new Date(today).getDay() + 1;
  const delta = (weekday - current + 7) % 7 || 7;
  return addDays(today, delta);
}
