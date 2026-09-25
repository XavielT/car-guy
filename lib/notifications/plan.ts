/**
 * What to schedule, as a pure function.
 *
 * The Expo calls are a thin adapter around this (ADR-07); everything that can be
 * wrong — too many, wrong order, duplicate ids, something in the past — is
 * decided here where it can be tested.
 */
import { addDays } from '../domain/dates';
import { FALLBACK_KM_PER_DAY } from '../domain/odometer';
import { evaluate, type EvaluateContext } from '../domain/reminders';
import type { Cadence, Reminder } from '../db/types';

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
      /** The exact instant: the due day at the user's hour, local time. */
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
      /** 1 = Sunday … 7 = Saturday, per expo-notifications' WEEKLY trigger. */
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
    /** The day it turns próximo (see `firstAttentionDay`), if still ahead. */
    proximoDate?: string | null;
    status: string;
    /** Set when more than one vehicle is planned, so the body can say which. */
    vehicleName?: string;
  }[];
  templates: { id: string; name: string; cadence: Cadence; enabled: boolean; baseId?: string }[];
  marbeteNudges: { date: string; message: string }[];
};

/** A day-only ISO (stored as local noon) moved to the user's hour on that day. */
export function atHour(dayIso: string, hour: number, minute: number): string {
  const d = new Date(dayIso);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), hour, minute, 0).toISOString();
}

/**
 * The first future day on which a reminder stops being "al día", found by
 * asking the engine itself day by day, with the odometer projected at the
 * vehicle's pace. Asking `evaluate` rather than re-deriving its thresholds here
 * means a change to the thresholds — or a snooze — can never make the
 * notification disagree with the screen.
 *
 * Null when it already needs attention, when nothing is known, or when the day
 * is beyond the horizon (the plan is rebuilt long before then).
 */
export function firstAttentionDay(
  reminder: Reminder,
  ctx: EvaluateContext,
  horizonDays = 400,
): string | null {
  const today = evaluate(reminder, ctx);
  if (today.status !== 'ok') return null;
  // The same fallback pace the engine predicts with, so the two agree.
  const pace = ctx.kmPerDay && ctx.kmPerDay > 0 ? ctx.kmPerDay : FALLBACK_KM_PER_DAY;
  for (let d = 1; d <= horizonDays; d++) {
    const day = addDays(ctx.today, d);
    const status = evaluate(reminder, {
      ...ctx,
      today: day,
      currentKm: ctx.currentKm != null ? ctx.currentKm + pace * d : null,
    }).status;
    if (status === 'sin_datos') return null;
    if (status !== 'ok') return day;
  }
  return null;
}

/**
 * Builds the schedule.
 *
 * `now` is the real instant: a dated notification whose moment has passed is
 * dropped, because a DATE trigger in the past fires the second it is
 * scheduled — a burst of everything already overdue. It defaults to `today`
 * for tests that only care about days.
 *
 * Repeating checks come first (they are the habit, and they are few); dated ones
 * are ordered by how soon they fire and fill what is left of the cap, so when
 * there are more candidates than slots the survivors are the ones that matter
 * next.
 */
export function planNotifications(input: PlanInput, now: string = input.today): PlannedNotification[] {
  const nowMs = new Date(now).getTime();
  const dated: Extract<PlannedNotification, { kind: 'date' }>[] = [];
  const push = (item: Extract<PlannedNotification, { kind: 'date' }>) => {
    if (new Date(item.date).getTime() > nowMs) dated.push(item);
  };

  for (const reminder of input.reminders) {
    const suffix = reminder.vehicleName ? ` · ${reminder.vehicleName}` : '';
    // A "both" reminder is due at whichever limit arrives first.
    const candidates = [reminder.dueDate, reminder.predictedDueDate].filter(
      (d): d is string => d != null,
    );
    const due = candidates.length ? candidates.reduce((a, b) => (a < b ? a : b)) : null;

    if (due) {
      push({
        kind: 'date',
        id: `reminder:${reminder.id}:due`,
        title: reminder.title,
        body: `Te toca esto hoy.${suffix}`,
        date: atHour(due, input.hour, input.minute),
        route: `/recordatorio/${reminder.id}`,
      });
    }
    if (reminder.proximoDate && (!due || reminder.proximoDate < due)) {
      push({
        kind: 'date',
        id: `reminder:${reminder.id}:proximo`,
        title: reminder.title,
        body: `Se acerca: ve cuadrándolo.${suffix}`,
        date: atHour(reminder.proximoDate, input.hour, input.minute),
        route: `/recordatorio/${reminder.id}`,
      });
    }
  }

  for (const nudge of input.marbeteNudges) {
    push({
      kind: 'date',
      id: `marbete:${nudge.date.slice(0, 10)}`,
      title: 'Marbete',
      body: nudge.message,
      date: atHour(nudge.date, input.hour, input.minute),
      route: '/recordatorios',
    });
  }

  dated.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id < b.id ? -1 : 1));

  const repeating: PlannedNotification[] = [];
  // Two vehicles on the same checklist need one reminder at 09:00, not two.
  const seen = new Set<string>();
  for (const template of input.templates) {
    if (!template.enabled) continue;
    const base = template.baseId ?? template.id;
    if (seen.has(base)) continue;
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
    else continue;
    seen.add(base);
  }

  const plan = [...repeating, ...dated];
  // Dedupe by id, first wins: the same reminder must never be scheduled twice.
  const ids = new Set<string>();
  return plan.filter((p) => !ids.has(p.id) && ids.add(p.id)).slice(0, MAX_SCHEDULED);
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
