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
import { LEGAL_LEAD_DAYS } from './legal-dr';
import { FALLBACK_KM_PER_DAY } from './odometer';
import type { Reminder } from '../db/types';
import { es } from '../i18n/es';

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
/**
 * Marbete and seguro need a bank visit, so they warn earlier; the licencia
 * earlier still (60/30, §3.7), because pending multas block the renewal and
 * clearing them takes time. The per-kind leads live in legal-dr.ts.
 */
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
  const lead = legal ? LEGAL_LEAD_DAYS[reminder.legalKind!] : undefined;
  return {
    proximoDays:
      reminder.thresholdDays ??
      (legal ? (lead?.[0] ?? LEGAL_PROXIMO_DAYS) : DEFAULT_PROXIMO_DAYS),
    urgenteDays: legal ? (lead?.[1] ?? LEGAL_URGENTE_DAYS) : DEFAULT_URGENTE_DAYS,
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

/**
 * The instant a reminder is really due, for ordering: the earlier of its date
 * and the day its km are predicted to run out. A km-only reminder has no
 * `dueDays`, so sorting on that alone parked every oil change at the bottom of
 * its group however close it was.
 *
 * An overdue km reminder has no predicted date (the km are already gone), so it
 * sorts as "now" — the empty string is before every ISO date.
 */
function dueKey({ reminder, status }: { reminder: Reminder; status: ReminderStatus }): string {
  const dates: string[] = [];
  if (reminder.dueDate && reminder.metric !== 'km') dates.push(reminder.dueDate);
  if (status.predictedDueDate) dates.push(status.predictedDueDate);
  if (dates.length) return dates.sort()[0];
  if (status.dueKm != null && status.dueKm < 0) return '';
  return '\uffff';
}

/** vencido → urgente → próximo → sin datos → ok, then soonest first. */
export function bySeverity(
  a: { reminder?: Reminder; status: ReminderStatus },
  b: { reminder?: Reminder; status: ReminderStatus },
): number {
  const diff = SEVERITY[a.status.status] - SEVERITY[b.status.status];
  if (diff !== 0) return diff;
  if (!a.reminder || !b.reminder) {
    // Callers without the row (older tests, summaries) keep the dueDays order.
    const ad = a.status.dueDays ?? Number.MAX_SAFE_INTEGER;
    const bd = b.status.dueDays ?? Number.MAX_SAFE_INTEGER;
    return ad - bd;
  }
  const ka = dueKey({ reminder: a.reminder, status: a.status });
  const kb = dueKey({ reminder: b.reminder, status: b.status });
  return ka < kb ? -1 : ka > kb ? 1 : 0;
}

/**
 * Whether a reminder belongs on the home screen's telltale row.
 *
 * `sin_datos` does not: a seguro whose expiry nobody has typed in yet is not the
 * car asking for anything, and letting it sit there permanently meant "Todo al
 * día" could never appear. The Recordatorios list still shows it, asking for
 * the date.
 */
export function needsAttention(status: ReminderStatus): boolean {
  return status.status === 'vencido' || status.status === 'urgente' || status.status === 'proximo';
}

export type AttentionItem<R, T> =
  | { kind: 'reminder'; item: R; rank: number }
  | { kind: 'task'; item: T; rank: number };

const TASK_RANK = { critica: 0, normal: 3, baja: 5 } as const;
const REMINDER_RANK: Record<ReminderState, number> = {
  vencido: 1,
  urgente: 2,
  proximo: 4,
  sin_datos: 6,
  ok: 7,
};

/**
 * Reminders and open tasks on one strip, worst first.
 *
 * A critical task — a failed coolant or brake check — ranks ahead of even an
 * overdue reminder: it is something the owner saw with their own eyes, and a
 * late oil change is rarely as dangerous as a coolant leak. A normal task sits
 * between urgente and próximo; a low-priority one after everything that is
 * actually due. Ties keep the input order, which is already worst first.
 */
export function mergeAttention<R extends { status: ReminderStatus }, T extends { priority: keyof typeof TASK_RANK }>(
  reminders: R[],
  tasks: T[],
  limit = 4,
): AttentionItem<R, T>[] {
  const merged: AttentionItem<R, T>[] = [
    ...reminders
      .filter((r) => needsAttention(r.status))
      .map((item) => ({ kind: 'reminder' as const, item, rank: REMINDER_RANK[item.status.status] })),
    ...tasks.map((item) => ({ kind: 'task' as const, item, rank: TASK_RANK[item.priority] })),
  ];
  return merged
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => a.entry.rank - b.entry.rank || a.index - b.index)
    .slice(0, limit)
    .map(({ entry }) => entry);
}

export const STATUS_LABEL: Record<ReminderState, string> = es.reminders.statusLabels;

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
    .filter((r) => !alreadyRenewed(r, context.date))
    .map((reminder) => {
      // Legal items are always fixed-interval, whatever the row says: the
      // deadline is set by the calendar, not by when the payment happened.
      const patch = completeReminder({ ...reminder, fixedInterval: true }, context);
      // The marbete's deadline comes from the payment, not from the old due
      // date plus a year — so recording the same payment twice lands on the
      // same 31 January instead of skipping a season.
      if (legalKind === 'marbete') patch.dueDate = marbeteDueAfterPayment(context.date);
      return { reminder, patch };
    });
}

/**
 * A payment recorded against a reminder that is already far in the future
 * renews nothing — it is the same renewal recorded again. Without this, each
 * extra record pushed the due date another year out.
 */
function alreadyRenewed(reminder: Reminder, paidOn: string): boolean {
  if (!reminder.dueDate) return false;
  return daysBetween(paidOn, reminder.dueDate) > RENEWED_HORIZON_DAYS;
}
const RENEWED_HORIZON_DAYS = 183;

/**
 * The marbete due date after paying it on `paidOn`.
 *
 * Sales open in late October and close on 31 January. A payment from October
 * to December is for the coming 31 January; one from January to September is
 * for this year's (a late payment still pays the season that just closed). The
 * next deadline is a year after the one paid.
 */
export function marbeteDueAfterPayment(paidOn: string): string {
  const d = new Date(paidOn);
  const covered = d.getMonth() >= 9 ? d.getFullYear() + 1 : d.getFullYear();
  return new Date(covered + 1, 0, 31, 12, 0, 0).toISOString();
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

/* ------------------------------------------------------------------ *
 * Catalog interval changes (Más → Catálogo de servicios)
 * ------------------------------------------------------------------ */

export type Interval = { km: number | null; months: number | null };

/**
 * What a reminder becomes when its catalog item's default interval changes.
 *
 * Only a reminder still on the **old default** follows the change: one whose
 * interval differs was set by hand (or by the diesel override), and silently
 * moving it would overwrite a decision. Each side is judged on its own, so a
 * reminder whose km was customised still follows a new months default.
 *
 * The due point keeps its anchor — the last completion when there is one,
 * otherwise the old due minus the old interval — and is recounted with the new
 * interval. Returns null when nothing changes.
 */
export function retargetInterval(
  reminder: Reminder,
  previous: Interval,
  next: Interval,
): Partial<Reminder> | null {
  const patch: Partial<Reminder> = {};

  if (
    previous.km !== next.km &&
    reminder.intervalKm != null &&
    reminder.intervalKm === previous.km &&
    next.km != null
  ) {
    patch.intervalKm = next.km;
    const anchor =
      reminder.lastCompletedKm ?? (reminder.dueKm != null ? reminder.dueKm - previous.km : null);
    if (anchor != null && reminder.dueKm != null) patch.dueKm = anchor + next.km;
  }

  if (
    previous.months !== next.months &&
    reminder.intervalMonths != null &&
    reminder.intervalMonths === previous.months &&
    next.months != null &&
    !reminder.fixedInterval
  ) {
    patch.intervalMonths = next.months;
    const anchor =
      reminder.lastCompletedAt ??
      (reminder.dueDate ? addMonths(reminder.dueDate, -previous.months) : null);
    if (anchor != null && reminder.dueDate) patch.dueDate = addMonths(anchor, next.months);
  }

  return Object.keys(patch).length ? patch : null;
}
