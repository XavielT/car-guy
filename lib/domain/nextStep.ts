/**
 * "Siguiente paso" (SPEC-K §K1, ADR-73): the ONE thing Hoy suggests. Pure: the screen reads its facts, this decides, the card shows it.
 *
 * Ranking (first that applies wins):
 *   1 an overdue reminder (legal ones before maintenance)   2 a document expired or expiring in ≤ 14 days
 *   3 no fill-up in > FUEL_DAYS days (or never, once the car has an odometer)   4 odometer not updated in > ODO_DAYS days
 *   5 a recap that just closed   6 a detection-health problem (automatic trips)   7 a first-run checklist item
 *   8 the offer to see only what the person uses   9 the person's most-used action (the default; never empty).
 * "Más tarde" snoozes one candidate for 24 h: the next one applies. Nothing here creates data or sends anything.
 */
export const NEXT_STEP = { fuelDays: 14, odoDays: 30, docDays: 14, snoozeMs: 24 * 3600 * 1000 } as const;

export type FirstRunItem = 'vehicle' | 'fillup' | 'trips';
export type TopAction = 'fuel' | 'trip' | 'service';

export type NextStepInput = {
  /** Epoch ms of "now" (injected: the function never reads the clock). */
  now: number;
  hasVehicle: boolean;
  overdue?: { id: string; title: string; daysOverdue: number | null; legal: boolean } | null;
  document?: { id: string; title: string; daysLeft: number } | null;
  fillupCount: number;
  /** Days since the last fill-up; null when there is none. */
  daysSinceFillup: number | null;
  /** Days since the last odometer reading; null when there is none. */
  daysSinceOdometer: number | null;
  /** PROMPT-11 (`recapReady()`); null/undefined until it exists or when nothing just closed. */
  recap?: { id: string; label: string } | null;
  /** SPEC-H detection health; null/undefined when healthy or not applicable. */
  detection?: { message: string } | null;
  /** The first not-done step of "Primeros pasos"; null when all are done or the card was dismissed. */
  firstRun?: FirstRunItem | null;
  /** ADR-73: show the "¿ver solo lo que usas?" offer (existing person, never answered, enough usage). */
  offerFeatureSet?: boolean;
  topAction?: TopAction;
  /** key → epoch ms until which that candidate is hidden. */
  snoozed?: Record<string, number>;
};

export type NextStep =
  | { kind: 'overdue'; key: string; id: string; title: string; daysOverdue: number | null; legal: boolean }
  | { kind: 'document'; key: string; id: string; title: string; daysLeft: number }
  | { kind: 'fuel'; key: string; neverLogged: boolean; days: number | null }
  | { kind: 'odometer'; key: string; days: number | null }
  | { kind: 'recap'; key: string; id: string; label: string }
  | { kind: 'detection'; key: string; message: string }
  | { kind: 'firstRun'; key: string; item: FirstRunItem }
  | { kind: 'featureSet'; key: string }
  | { kind: 'top'; key: string; action: TopAction }
  | { kind: 'addVehicle'; key: string };

export function nextStep(s: NextStepInput): NextStep {
  if (!s.hasVehicle) return { kind: 'addVehicle', key: 'addVehicle' };
  const hidden = (key: string) => (s.snoozed?.[key] ?? 0) > s.now;
  const out: NextStep[] = [];

  if (s.overdue) {
    out.push({ kind: 'overdue', key: `overdue:${s.overdue.id}`, id: s.overdue.id, title: s.overdue.title, daysOverdue: s.overdue.daysOverdue, legal: s.overdue.legal });
  }
  if (s.document && s.document.daysLeft <= NEXT_STEP.docDays) {
    out.push({ kind: 'document', key: `document:${s.document.id}`, id: s.document.id, title: s.document.title, daysLeft: s.document.daysLeft });
  }
  const neverFilled = s.fillupCount === 0;
  if (neverFilled ? s.daysSinceOdometer != null : s.daysSinceFillup != null && s.daysSinceFillup > NEXT_STEP.fuelDays) {
    out.push({ kind: 'fuel', key: 'fuel', neverLogged: neverFilled, days: s.daysSinceFillup });
  }
  if (s.daysSinceOdometer != null && s.daysSinceOdometer > NEXT_STEP.odoDays) {
    out.push({ kind: 'odometer', key: 'odometer', days: s.daysSinceOdometer });
  }
  if (s.recap) out.push({ kind: 'recap', key: `recap:${s.recap.id}`, id: s.recap.id, label: s.recap.label });
  if (s.detection) out.push({ kind: 'detection', key: 'detection', message: s.detection.message });
  if (s.firstRun) out.push({ kind: 'firstRun', key: `firstRun:${s.firstRun}`, item: s.firstRun });
  if (s.offerFeatureSet) out.push({ kind: 'featureSet', key: 'featureSet' });

  const hit = out.find((c) => !hidden(c.key));
  return hit ?? { kind: 'top', key: 'top', action: s.topAction ?? 'fuel' };
}

/** The snooze map after "Más tarde": this candidate hides for 24 h. Entries already past are dropped. */
export function snooze(map: Record<string, number>, key: string, now: number): Record<string, number> {
  const next: Record<string, number> = {};
  for (const [k, until] of Object.entries(map)) if (until > now) next[k] = until;
  next[key] = now + NEXT_STEP.snoozeMs;
  return next;
}

/** The first "Primeros pasos" item not done yet, from real data (never from a checkbox the person ticked). */
export function firstRunItem(done: { vehicle: boolean; fillup: boolean; trips: boolean }): FirstRunItem | null {
  if (!done.vehicle) return 'vehicle';
  if (!done.fillup) return 'fillup';
  if (!done.trips) return 'trips';
  return null;
}
