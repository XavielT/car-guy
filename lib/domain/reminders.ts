/**
 * What happens to a reminder when the work actually gets done.
 *
 * Pure TypeScript (ADR-04): these functions take a reminder row and return the
 * patch to apply, so they can be tested without a database and reused by the
 * status engine PROMPT-05 builds on top.
 *
 * The rules are 01-data-model.md §3.2.
 */
import { addDays, addMonths, daysBetween } from './dates';
import { FALLBACK_KM_PER_DAY } from './odometer';
import type { Reminder } from '../db/types';

/* ------------------------------------------------------------------ *
 * Status — how urgent a reminder is right now (spec §3.2)
 * ------------------------------------------------------------------ */

export type ReminderState = 'ok' | 'proximo' | 'urgente' | 'vencido' | 'sin_datos';

export type ReminderStatus = {
  status: ReminderState;
  /** Which metric produced the state, so the UI can explain itself. */
  triggeredBy: 'fecha' | 'km' | null;
  /** Days until due; negative means overdue. */
  dueDays: number | null;
  /** Kilometres until due; negative means overdue. */
  dueKm: number | null;
  /** When the km will run out, at the vehicle's own pace. */
  predictedDueDate: string | null;
  confidence: 'buena' | 'estimada' | 'baja';
  /** True while a snooze is hiding a real state. */
  snoozed: boolean;
};

export type EvaluateContext = {
  today: string;
  currentKm: number | null;
  kmPerDay?: number;
  confidence?: 'buena' | 'estimada' | 'baja';
};

const DEFAULT_PROXIMO_DAYS = 30;
const DEFAULT_URGENTE_DAYS = 7;
/** Marbete and seguro need a bank visit, so they warn earlier. */
const LEGAL_PROXIMO_DAYS = 45;
const LEGAL_URGENTE_DAYS = 14;
const URGENTE_KM = 100;
const MIN_PROXIMO_KM = 300;
const MAX_PROXIMO_KM = 1000;

const SEVERITY: Record<ReminderState, number> = {
  vencido: 0,
  urgente: 1,
  proximo: 2,
  sin_datos: 3,
  ok: 4,
};

function thresholds(reminder: Reminder) {
  const legal = reminder.legalKind != null;
  return {
    proximoDays:
      reminder.thresholdDays ?? (legal ? LEGAL_PROXIMO_DAYS : DEFAULT_PROXIMO_DAYS),
    urgenteDays: legal ? LEGAL_URGENTE_DAYS : DEFAULT_URGENTE_DAYS,
    // Ten per cent of the interval, so a 40,000 km item warns far earlier than a
    // 5,000 km one, clamped so neither extreme is useless.
    proximoKm:
      reminder.thresholdKm ??
      (reminder.intervalKm != null
        ? Math.min(MAX_PROXIMO_KM, Math.max(MIN_PROXIMO_KM, Math.round(reminder.intervalKm * 0.1)))
        : MIN_PROXIMO_KM),
    urgenteKm: URGENTE_KM,
  };
}

function stateFromDays(days: number, proximo: number, urgente: number): ReminderState {
  if (days < 0) return 'vencido';
  if (days <= urgente) return 'urgente';
  if (days <= proximo) return 'proximo';
  return 'ok';
}

function stateFromKm(km: number, proximo: number, urgente: number): ReminderState {
  if (km < 0) return 'vencido';
  if (km <= urgente) return 'urgente';
  if (km <= proximo) return 'proximo';
  return 'ok';
}

/**
 * How urgent a reminder is, right now.
 *
 * Pure: it never touches the database, which is what lets every branch below be
 * tested directly. Repos call it with the context they have.
 *
 * Date and km are judged independently and the **worse** of the two wins — an
 * oil change due in eight months but 200 km away is urgent, and saying "ok"
 * because the date is far off would be exactly the failure this app exists to
 * prevent.
 */
export function evaluate(reminder: Reminder, ctx: EvaluateContext): ReminderStatus {
  const kmPerDay = ctx.kmPerDay && ctx.kmPerDay > 0 ? ctx.kmPerDay : FALLBACK_KM_PER_DAY;
  const confidence = ctx.confidence ?? 'baja';
  const limits = thresholds(reminder);

  const wantsDate = reminder.metric === 'date' || reminder.metric === 'both';
  const wantsKm = reminder.metric === 'km' || reminder.metric === 'both';

  const dueDays = wantsDate && reminder.dueDate ? daysBetween(ctx.today, reminder.dueDate) : null;
  const dueKm =
    wantsKm && reminder.dueKm != null && ctx.currentKm != null
      ? reminder.dueKm - ctx.currentKm
      : null;

  // "I cannot tell you" is its own answer: a km reminder on a vehicle with no
  // readings, or a legal item whose date the user has not entered yet.
  const missingKm = wantsKm && (reminder.dueKm == null || ctx.currentKm == null);
  const missingDate = wantsDate && reminder.dueDate == null;
  const nothingKnown = dueDays == null && dueKm == null;

  const predictedDueDate =
    dueKm != null && dueKm >= 0 ? addDays(ctx.today, Math.ceil(dueKm / kmPerDay)) : null;

  if (nothingKnown) {
    return {
      status: 'sin_datos',
      triggeredBy: null,
      dueDays: null,
      dueKm: null,
      predictedDueDate: null,
      confidence,
      snoozed: false,
    };
  }

  const dateState =
    dueDays != null ? stateFromDays(dueDays, limits.proximoDays, limits.urgenteDays) : null;
  const kmState = dueKm != null ? stateFromKm(dueKm, limits.proximoKm, limits.urgenteKm) : null;

  let status: ReminderState = 'ok';
  let triggeredBy: 'fecha' | 'km' | null = null;
  for (const [state, by] of [
    [dateState, 'fecha'],
    [kmState, 'km'],
  ] as const) {
    if (state == null) continue;
    if (triggeredBy == null || SEVERITY[state] < SEVERITY[status]) {
      status = state;
      triggeredBy = by;
    }
  }

  // Half the picture is worse than none: a "both" reminder missing one side
  // still reports on the side it has, but says so.
  if ((missingKm || missingDate) && status === 'ok') status = 'sin_datos';

  // A snooze hides the state until its date, but the underlying values stay
  // visible so a report can still say "pospuesto".
  const snoozed =
    reminder.snoozedUntil != null && daysBetween(ctx.today, reminder.snoozedUntil) > 0;

  return {
    status: snoozed ? 'ok' : status,
    triggeredBy: snoozed ? null : triggeredBy,
    dueDays,
    dueKm,
    predictedDueDate,
    confidence,
    snoozed,
  };
}

/** The date to show: whichever limit arrives first. */
export function displayDueDate(reminder: Reminder, status: ReminderStatus): string | null {
  if (reminder.dueDate && status.predictedDueDate) {
    return reminder.dueDate < status.predictedDueDate ? reminder.dueDate : status.predictedDueDate;
  }
  return reminder.dueDate ?? status.predictedDueDate;
}

/** vencido → urgente → próximo → sin datos → ok, then soonest first. */
export function bySeverity(
  a: { status: ReminderStatus },
  b: { status: ReminderStatus },
): number {
  const diff = SEVERITY[a.status.status] - SEVERITY[b.status.status];
  if (diff !== 0) return diff;
  const ad = a.status.dueDays ?? Number.MAX_SAFE_INTEGER;
  const bd = b.status.dueDays ?? Number.MAX_SAFE_INTEGER;
  return ad - bd;
}

export const STATUS_LABEL: Record<ReminderState, string> = {
  ok: 'Al día',
  proximo: 'Próximo',
  urgente: 'Urgente',
  vencido: 'Vencido',
  sin_datos: 'Sin datos',
};

/* ------------------------------------------------------------------ *
 * Completion (Phase 4)
 * ------------------------------------------------------------------ */

export type CompletionContext = {
  /** ISO date the work was done. */
  date: string;
  /** Odometer at the time, when known. */
  km?: number | null;
  /** The service record that completed it, for the audit trail. */
  recordId?: string | null;
};

/** The columns a completion changes. Everything else is left alone. */
export type ReminderPatch = {
  id: string;
  lastCompletedAt: string;
  lastCompletedKm: number | null;
  lastCompletedRecordId: string | null;
  dueDate: string | null;
  dueKm: number | null;
  isEnabled: boolean;
  snoozedUntil: null;
};

/**
 * Re-arms a reminder that has just been satisfied.
 *
 * The interesting case is `fixed_interval`, which legal items always use: the
 * marbete is due on 31 January whether you renewed it in December or on the
 * deadline, so the next due date is counted from the **old due date**, not from
 * when you got round to it. A maintenance interval is the opposite — the next
 * oil change is due six months after *this* oil change.
 *
 * A non-recurring reminder is simply switched off; it did its job.
 */
export function completeReminder(reminder: Reminder, context: CompletionContext): ReminderPatch {
  const base: ReminderPatch = {
    id: reminder.id,
    lastCompletedAt: context.date,
    lastCompletedKm: context.km ?? null,
    lastCompletedRecordId: context.recordId ?? null,
    dueDate: reminder.dueDate,
    dueKm: reminder.dueKm,
    isEnabled: reminder.isEnabled,
    // Completing something clears any snooze: the reason to hide it is gone.
    snoozedUntil: null,
  };

  if (!reminder.isRecurring) {
    return { ...base, isEnabled: false };
  }

  let dueKm = reminder.dueKm;
  if (reminder.intervalKm != null) {
    // Counted from the odometer at completion when known; otherwise the old due
    // km is still the best anchor available.
    const anchor = context.km ?? reminder.dueKm;
    dueKm = anchor != null ? anchor + reminder.intervalKm : null;
  }

  let dueDate = reminder.dueDate;
  if (reminder.intervalMonths != null) {
    const anchor = reminder.fixedInterval ? (reminder.dueDate ?? context.date) : context.date;
    dueDate = addMonths(anchor, reminder.intervalMonths);
  } else if (reminder.intervalDays != null) {
    const anchor = reminder.fixedInterval ? (reminder.dueDate ?? context.date) : context.date;
    dueDate = addDays(anchor, reminder.intervalDays);
  }

  return { ...base, dueKm, dueDate };
}

/**
 * Which of a vehicle's reminders a service record satisfies.
 *
 * Only enabled reminders that point at one of the catalog items done in the
 * visit. A disabled reminder is one the user turned off on purpose, and
 * re-arming it silently because they happened to change the oil would be the
 * app overriding a decision.
 */
export function remindersForServiceItems(
  reminders: Reminder[],
  serviceTypeIds: string[],
): Reminder[] {
  const wanted = new Set(serviceTypeIds);
  return reminders.filter(
    (r) => r.isEnabled && r.serviceTypeId != null && wanted.has(r.serviceTypeId),
  );
}

/**
 * The patches to apply after saving a service record.
 *
 * Returned rather than written so the caller can put them in the same
 * transaction as the record itself, and so the summary shown to the user is
 * built from exactly what was changed.
 */
export function resetForServiceItems(
  reminders: Reminder[],
  serviceTypeIds: string[],
  context: CompletionContext,
): { reminder: Reminder; patch: ReminderPatch }[] {
  return remindersForServiceItems(reminders, serviceTypeIds).map((reminder) => ({
    reminder,
    patch: completeReminder(reminder, context),
  }));
}

/**
 * Paying for the marbete or the insurance *is* renewing it.
 *
 * Someone who records "Marbete · RD$1,500" has already been to the bank; asking
 * them to also tick the reminder would be asking twice for the same fact.
 */
export function completeLegal(
  reminders: Reminder[],
  legalKind: string,
  context: CompletionContext,
): { reminder: Reminder; patch: ReminderPatch }[] {
  return reminders
    .filter((r) => r.isEnabled && r.legalKind === legalKind)
    .map((reminder) => ({
      reminder,
      // Legal items are always fixed-interval, whatever the row says: the
      // deadline is set by the calendar, not by when the payment happened.
      patch: completeReminder({ ...reminder, fixedInterval: true }, context),
    }));
}

/** "Aceite de motor → 57,000 km · 15 mar 2027" */
export function describeReset(reminder: Reminder, patch: ReminderPatch): string {
  const parts: string[] = [];
  if (patch.dueKm != null) parts.push(`${Math.round(patch.dueKm).toLocaleString('es-DO')} km`);
  if (patch.dueDate) {
    parts.push(
      new Date(patch.dueDate).toLocaleDateString('es-DO', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }),
    );
  }
  if (!patch.isEnabled) return `${reminder.title} → listo`;
  return parts.length ? `${reminder.title} → ${parts.join(' · ')}` : reminder.title;
}
