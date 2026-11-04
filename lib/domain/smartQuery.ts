/**
 * Smart search answers (IMP 03112026 SPEC-G §G1). Pure, no AI. `cg-ai-intent` only CLASSIFIES a typed or spoken question into the closed
 * list below (and names a period / a keyword); everything that is an answer, a number or a date, is computed here from the person's own
 * records. The model never produces a figure: if it were wrong about the question, the person sees the right number for a wrong question
 * (with the question restated), never an invented number.
 *
 *   fuel_spend    how much was spent on fuel in a period
 *   total_spend   how much was spent in total (fuel + every expense, services and repairs included) in a period
 *   last_service  when a kind of service was last done (keyword), and at what km
 *   next_due      what is due next (keyword optional): a reminder's date or km
 *   show_repairs  open the repairs list (navigation, not a number)
 */
export const QUERY_KINDS = ['fuel_spend', 'total_spend', 'last_service', 'next_due', 'show_repairs'] as const;
export type QueryKind = (typeof QUERY_KINDS)[number];

export type QueryPlan = { kind: QueryKind; from: string | null; to: string | null; keyword: string | null };

type FieldLike = Record<string, { value: string | number | null } | undefined>;

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** What `cg-ai-intent` returned for a `query` target → a plan, or null when it does not hold together. */
export function queryPlan(fields: FieldLike): QueryPlan | null {
  const kind = fields.query_kind?.value;
  if (typeof kind !== 'string' || !(QUERY_KINDS as readonly string[]).includes(kind)) return null;
  const date = (k: string) => {
    const v = fields[k]?.value;
    return typeof v === 'string' && ISO.test(v) ? v : null;
  };
  let from = date('period_from');
  let to = date('period_to');
  if (from && to && to < from) from = to = null;
  // One end alone is not a period.
  if (!from || !to) from = to = null;
  const kw = fields.keyword?.value;
  const keyword = typeof kw === 'string' && kw.trim() ? kw.trim().slice(0, 30) : null;
  return { kind: kind as QueryKind, from, to, keyword };
}

export type SpendRow = { vehicleId: string; occurredAt: string; amount: number };
export type Dated = { vehicleId: string; occurredAt: string; odometerKm: number | null; title: string };
export type ReminderLite = { vehicleId: string; title: string; dueDate: string | null; dueOdometerKm: number | null; completedAt: string | null };

export type QueryData = {
  vehicleId: string;
  today: string;
  fuel: readonly SpendRow[];
  /** Every other expense (the store's legacy list: services and repairs included). */
  expenses: readonly SpendRow[];
  /** Services and repairs with a title, for "when did I last…". */
  services: readonly Dated[];
  reminders: readonly ReminderLite[];
};

export type QueryAnswer =
  | { kind: 'fuel_spend' | 'total_spend'; amount: number; count: number; from: string | null; to: string | null; link: 'cifras' }
  | { kind: 'last_service'; keyword: string; found: { title: string; date: string; km: number | null } | null; link: 'historial' }
  | { kind: 'next_due'; keyword: string | null; found: { title: string; dueDate: string | null; dueKm: number | null; daysLeft: number | null } | null; link: 'recordatorios' }
  | { kind: 'show_repairs'; keyword: string | null; link: 'reparaciones' };

const day = (iso: string) => iso.slice(0, 10);
const within = (iso: string, from: string | null, to: string | null) => (!from || day(iso) >= from) && (!to || day(iso) <= to);

function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}

export function answerQuery(plan: QueryPlan, d: QueryData): QueryAnswer {
  const mine = <T extends { vehicleId: string }>(rows: readonly T[]) => rows.filter((r) => r.vehicleId === d.vehicleId);
  switch (plan.kind) {
    case 'fuel_spend':
    case 'total_spend': {
      const rows = [...mine(d.fuel), ...(plan.kind === 'total_spend' ? mine(d.expenses) : [])].filter((r) => within(r.occurredAt, plan.from, plan.to));
      const amount = Math.round(rows.reduce((t, r) => t + (Number.isFinite(r.amount) ? r.amount : 0), 0) * 100) / 100;
      return { kind: plan.kind, amount, count: rows.length, from: plan.from, to: plan.to, link: 'cifras' };
    }
    case 'last_service': {
      const kw = fold(plan.keyword ?? '');
      const hits = mine(d.services)
        .filter((s) => (kw ? fold(s.title).includes(kw) : true))
        .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
      const top = hits[0];
      return { kind: 'last_service', keyword: plan.keyword ?? '', found: top ? { title: top.title, date: day(top.occurredAt), km: top.odometerKm } : null, link: 'historial' };
    }
    case 'next_due': {
      const kw = fold(plan.keyword ?? '');
      const open = mine(d.reminders).filter((r) => !r.completedAt && (kw ? fold(r.title).includes(kw) : true));
      // Dated reminders by date first (the soonest, overdue included); a km-only reminder only when nothing has a date.
      const dated = open.filter((r) => r.dueDate).sort((a, b) => a.dueDate!.localeCompare(b.dueDate!));
      const top = dated[0] ?? open.find((r) => r.dueOdometerKm != null) ?? null;
      return {
        kind: 'next_due',
        keyword: plan.keyword,
        found: top ? { title: top.title, dueDate: top.dueDate ? day(top.dueDate) : null, dueKm: top.dueOdometerKm, daysLeft: top.dueDate ? daysBetween(d.today, day(top.dueDate)) : null } : null,
        link: 'recordatorios',
      };
    }
    case 'show_repairs':
      return { kind: 'show_repairs', keyword: plan.keyword, link: 'reparaciones' };
  }
}
