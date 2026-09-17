/**
 * What happens to a reminder when the work actually gets done.
 *
 * Pure TypeScript (ADR-04): these functions take a reminder row and return the
 * patch to apply, so they can be tested without a database and reused by the
 * status engine PROMPT-05 builds on top.
 *
 * The rules are 01-data-model.md §3.2.
 */
import { addDays, addMonths } from './dates';
import type { Reminder } from '../db/types';

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
