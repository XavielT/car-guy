/**
 * When a checklist is due, and how long you have kept it up.
 *
 * Pure TypeScript (ADR-04). This is the habit half of the app — the reason it
 * exists is that a weekly coolant check never became a habit, so "is it due?"
 * and "how many weeks in a row?" have to be right and easy to reason about.
 */
import { daysBetween } from './dates';
import type { Cadence, Inspection, InspectionResult } from '../db/types';

export type Run = { occurredAt: string };

/**
 * Whether a template is due today.
 *
 * Deliberately *not* calendar-based. A weekly check done last Sunday and again
 * this Saturday is a week apart in practice, and a rule that said "not due, it
 * is still the same week" would be arguing with someone who is doing the right
 * thing. So: due when the last run was a cadence-length ago or more.
 */
export function isDue(cadence: Cadence, runs: Run[], today: string): boolean {
  if (cadence === 'manual' || cadence === 'antes_de_viaje') return false;

  const last = latestRun(runs);
  if (!last) return true;

  const since = daysBetween(last.occurredAt, today);
  if (cadence === 'diaria') return since >= 1;
  if (cadence === 'semanal') return since >= 7;
  if (cadence === 'mensual') return since >= 30;
  return false;
}

export function latestRun(runs: Run[]): Run | null {
  if (runs.length === 0) return null;
  return runs.reduce((newest, run) => (run.occurredAt > newest.occurredAt ? run : newest), runs[0]);
}

/**
 * How many consecutive weeks the weekly check has been done.
 *
 * A week is the seven-day window since the previous run, not a calendar week.
 * Doing it on Sunday and then the following Monday — eight days, one day late —
 * would break a calendar-week streak on a technicality, and the streak exists to
 * encourage the habit, not to referee it. The grace is one extra day: the chain
 * holds while every gap between runs is at most eight days.
 *
 * Extra runs inside one window do not count twice. Doing the weekly check on
 * Monday and again on Wednesday is one week of habit, not two, so a run only
 * adds to the streak once it is at least six days after the last one counted
 * (six, so that a week done a day early still counts).
 */
export function weeklyStreak(runs: Run[], today: string): number {
  const sorted = [...runs].sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : -1));
  if (sorted.length === 0) return 0;

  // The streak is only alive if the most recent run is still inside its window.
  if (daysBetween(sorted[0].occurredAt, today) > 8) return 0;

  let streak = 1;
  let counted = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    if (daysBetween(sorted[i].occurredAt, sorted[i - 1].occurredAt) > 8) break;
    if (daysBetween(sorted[i].occurredAt, counted.occurredAt) >= 6) {
      streak += 1;
      counted = sorted[i];
    }
  }
  return streak;
}

/**
 * The id a seeded template gets once one vehicle edits it.
 *
 * Deterministic, so a second edit finds the copy the first one made, and so two
 * devices that both edit the same template for the same vehicle converge on one
 * row under sync instead of producing two.
 */
export function scopedTemplateId(baseId: string, vehicleId: string): string {
  return `${baseTemplateId(baseId)}@${vehicleId}`;
}

/** The seeded template a vehicle copy came from, or the id itself. */
export function baseTemplateId(templateId: string): string {
  const at = templateId.indexOf('@');
  return at === -1 ? templateId : templateId.slice(0, at);
}

/**
 * Items whose failure is not something to note and move on from.
 *
 * Every one of these is a way to destroy an engine or fail to stop, and the
 * coolant is on the list because it is literally why this app was written.
 */
const CRITICAL_SERVICE_TYPES = new Set([
  'refrigerante',
  'aceite_motor',
  'liquido_frenos',
  'pastillas_frenos',
]);

export function taskPriorityFor(serviceTypeId: string | null): 'critica' | 'normal' {
  return serviceTypeId != null && CRITICAL_SERVICE_TYPES.has(serviceTypeId) ? 'critica' : 'normal';
}

// ------------------------------------------------------------ verdicts ---

export type Verdict = InspectionResult['result'];
export type InspectionStatus = Inspection['status'];

/** The runner's buttons, in the order they appear: OK · ATENCIÓN · FALLA · N/A. */
export const VERDICTS: readonly Verdict[] = ['ok', 'atencion', 'falla', 'na'];

/** Verdicts that open the note and the photo strip. */
export function needsDetail(verdict: Verdict | undefined): boolean {
  return verdict === 'falla' || verdict === 'atencion';
}

/** How many photos one item can carry. */
export const MAX_CHECK_PHOTOS = 5;

/**
 * A run's overall status. Any failure wins; failing that, one ATENCIÓN makes
 * it "con avisos" — something to keep an eye on is not a failure, and the home
 * screen's "last check had failures" must not light up for it.
 */
export function inspectionStatusFor(results: { result: Verdict }[]): InspectionStatus {
  if (results.some((r) => r.result === 'falla')) return 'con_fallas';
  if (results.some((r) => r.result === 'atencion')) return 'con_avisos';
  return 'ok';
}

/**
 * The default "AL TERMINAR, CREAR" for an answer: a failure does what its item
 * says; an ATENCIÓN creates nothing unless the user asks for it.
 */
export function defaultActionFor<A extends string>(verdict: Verdict | undefined, itemOnFail: A): A | 'none' {
  return verdict === 'falla' ? itemOnFail : 'none';
}
