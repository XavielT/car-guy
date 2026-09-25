/**
 * The Dominican Republic's vehicle calendar.
 *
 * Pure TypeScript (ADR-04). Facts and dates come from
 * 01-research/02-maintenance-checklists-dr.md §C, which cites Listín Diario,
 * elDinero, DGII and INTRANT.
 *
 * The marbete is the one obligation with a hard, published, nationwide deadline,
 * and the research found that only 30.7 % of drivers had renewed by 26 December
 * — so the nudges escalate through January rather than firing once in October
 * and being forgotten.
 */
import { addDays, daysBetween, nextJanuary31 } from './dates';

/** DGII opens marbete sales in the third or fourth week of October. */
const WINDOW_OPENS_MONTH = 9; // October, zero-based
const WINDOW_OPENS_DAY = 21;
/** Online and app sales close around 18 January. */
const ONLINE_CLOSES_DAY = 18;

export const MARBETE_TIER_OLD = 1_500;
export const MARBETE_TIER_NEW = 3_000;
/** Model years within this many years of the deadline pay the higher tier. */
const NEW_TIER_YEARS = 5;

export const LATE_SURCHARGE_DOP = 2_000;

export const PGR_MULTAS_URL = 'https://multas.pgr.gob.do/consultas';
export const INTRANT_URL = 'https://www.intrant.gob.do';

/** The next 31 January strictly at or after `today` — the deadline with no surcharge. */
export function nextMarbeteDeadline(today: string): string {
  return nextJanuary31(today);
}

/** When sales open for the period that ends on the given deadline. */
export function marbeteWindowOpens(deadline: string): string {
  const year = new Date(deadline).getFullYear() - 1;
  return new Date(year, WINDOW_OPENS_MONTH, WINDOW_OPENS_DAY, 12).toISOString();
}

/** Whether the app should be showing the marbete banner at all. */
export function isMarbeteWindowOpen(today: string): boolean {
  const deadline = nextMarbeteDeadline(today);
  // 15 October: the "abre pronto" notice, two weeks before sales start.
  const firstNotice = addDays(marbeteWindowOpens(deadline), -6);
  return daysBetween(firstNotice, today) >= 0 && daysBetween(today, deadline) >= 0;
}

/**
 * What the marbete costs, as an estimate the user can correct.
 *
 * The boundary moves by one model year every period, so it is expressed
 * relative to the deadline rather than hard-coded — RD$3,000 for anything from
 * the last five model years, RD$1,500 for the rest.
 */
export function marbeteTier(modelYear: number | null, today: string): number | null {
  if (modelYear == null) return null;
  const deadlineYear = new Date(nextMarbeteDeadline(today)).getFullYear();
  return deadlineYear - modelYear < NEW_TIER_YEARS ? MARBETE_TIER_NEW : MARBETE_TIER_OLD;
}

export type MarbeteNudge = {
  date: string;
  message: string;
  /** The banner wording once the day itself has passed, when it differs. */
  later?: string;
};

/**
 * The escalation, from a gentle heads-up in October to the deadline itself.
 *
 * Weekly through January because that is when Dominicans actually renew: the
 * research put on-time renewal at 86 % but only 30.7 % done by Boxing Day.
 */
export function marbeteNudges(today: string): MarbeteNudge[] {
  return nudgesFor(nextMarbeteDeadline(today)).filter((n) => daysBetween(today, n.date) >= 0);
}

/**
 * What the Inicio banner should say today: the latest nudge that has already
 * arrived, not the next one coming. Showing the next one had the banner
 * announcing "Ya abrió la venta" a week before sales opened, and "Enero
 * empezó" all through November.
 *
 * Null outside the window.
 */
export function currentMarbeteNudge(today: string): MarbeteNudge | null {
  if (!isMarbeteWindowOpen(today)) return null;
  const arrived = nudgesFor(nextMarbeteDeadline(today)).filter(
    (n) => daysBetween(n.date, today) >= 0,
  );
  const latest = arrived[arrived.length - 1];
  if (!latest) return null;
  // The banner outlives the day its nudge was sent, so a nudge worded for
  // that day carries the wording for the days after it.
  return daysBetween(latest.date, today) > 0 && latest.later ? { ...latest, message: latest.later } : latest;
}

function nudgesFor(deadline: string): MarbeteNudge[] {
  const year = new Date(deadline).getFullYear();
  const opens = marbeteWindowOpens(deadline);
  const at = (m: number, d: number) => new Date(year, m, d, 12).toISOString();

  const nudges: MarbeteNudge[] = [
    { date: addDays(opens, -6), message: 'El marbete abre pronto. Ve preparando los papeles.' },
    { date: opens, message: 'Ya abrió la venta del marbete. Mientras más temprano, menos fila.' },
    { date: at(0, 5), message: 'Enero empezó: el marbete vence el 31.' },
    { date: at(0, 12), message: 'Quedan menos de tres semanas para el marbete.' },
    {
      date: at(0, ONLINE_CLOSES_DAY),
      message: 'La venta en línea del marbete cierra hoy. Después, solo en el banco.',
      later: 'La venta en línea del marbete cerró el 18. Ahora solo en el banco.',
    },
    { date: at(0, 25), message: 'Una semana para el marbete. Después son RD$2,000 de recargo.' },
    { date: at(0, 31), message: 'Hoy vence el marbete. Sin prórroga.' },
  ];

  return nudges;
}

/** "Estimado: RD$1,500" — the tier as a line the banner can carry. */
export function marbeteTierLabel(modelYear: number | null, today: string): string | null {
  const tier = marbeteTier(modelYear, today);
  return tier == null ? null : `Estimado: RD$${tier.toLocaleString('en-US')}`;
}

/** Ley 63-17 art. 41 — how long a vehicle may legally circulate. */
const VIDA_UTIL_YEARS: Record<string, number> = {
  motor: 10,
  carro: 15,
  jeepeta: 15,
  camioneta: 15,
  guagua: 20,
  camion: 30,
  otro: 15,
};

export type VidaUtil = {
  limitYears: number;
  age: number | null;
  remainingYears: number | null;
};

/**
 * The vida útil badge for the vehicle profile.
 *
 * Informational only: the ITV that would enforce it is not operating yet — as of
 * September 2026 INTRANT has a signed PPP and no start date — so Car Guy shows
 * the number and does not pretend it is a deadline.
 */
export function vidaUtil(vehicleType: string, modelYear: number | null, today: string): VidaUtil {
  const limitYears = VIDA_UTIL_YEARS[vehicleType] ?? VIDA_UTIL_YEARS.otro;
  if (modelYear == null) return { limitYears, age: null, remainingYears: null };
  const age = new Date(today).getFullYear() - modelYear;
  return { limitYears, age, remainingYears: limitYears - age };
}

/**
 * How the badge should read: fine, close (two years or less), or past the
 * limit. Informational, so "past" is urgente-coloured rather than vencido —
 * nothing is enforcing it yet.
 */
export function vidaUtilTone(v: VidaUtil): 'ok' | 'proximo' | 'urgente' | 'neutral' {
  if (v.remainingYears == null) return 'neutral';
  if (v.remainingYears < 0) return 'urgente';
  if (v.remainingYears <= 2) return 'proximo';
  return 'ok';
}

/** Lead times before an expiry, in days, per legal kind. */
export const LEGAL_LEAD_DAYS: Record<string, number[]> = {
  marbete: [45, 14, 7],
  seguro: [45, 14, 7],
  licencia: [60, 30],
};

export const LEGAL_NOTES: Record<string, string> = {
  marbete: 'La venta abre a finales de octubre y cierra el 31 de enero. Sin prórroga.',
  seguro: 'Pon la fecha de vencimiento de tu póliza para que te avise a tiempo.',
  licencia: 'Revisa multas pendientes antes de renovar: bloquean la renovación.',
  revision_tecnica: 'Pendiente de implementación por INTRANT.',
};
