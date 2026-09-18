/**
 * Statistics — pure TypeScript over normalised rows, no React and no SQL
 * (01-data-model.md §3.8, ADR-04).
 *
 * Everything here takes `SpendRow[]` and `Reading[]` rather than repository
 * objects. The shapes a screen has are wider and change with the schema; these
 * two are the only facts the arithmetic needs, so the SQL in
 * `lib/db/statsQueries.ts` normalises once and every function below stays
 * testable with a literal.
 *
 * Tombstones never reach here: the queries filter `deleted_at IS NULL`.
 */
import { addMonths, dayKey, daysBetween } from './dates';
import { roundMoney } from './economy';

/**
 * The six buckets the charts and the donut speak in.
 *
 * `legal` folds seguro, marbete, impuesto and multa together because they are
 * one thing to a driver — the cost of keeping the car street-legal — and
 * splitting them makes a donut of slivers. Everything else an expense can be
 * lands in `otros`.
 */
export type StatCategory =
  | 'combustible'
  | 'mantenimiento'
  | 'reparacion'
  | 'mejora'
  | 'legal'
  | 'otros';

export const STAT_CATEGORIES: StatCategory[] = [
  'combustible',
  'mantenimiento',
  'reparacion',
  'mejora',
  'legal',
  'otros',
];

/** One thing that cost money, flattened to what the arithmetic needs. */
export type SpendRow = {
  occurredAt: string;
  category: StatCategory;
  amountDop: number;
};

/** An odometer reading, same shape `lib/domain/odometer.ts` uses. */
export type Reading = { occurredAt: string; valueKm: number };

export type PeriodKey = 'mes' | 'trimestre' | 'ano' | 'todo';

export type Period = {
  key: PeriodKey;
  label: string;
  /** Inclusive lower bound, or null for "todo". */
  from: string | null;
  /** Inclusive upper bound. */
  to: string;
  /** The window of the same length immediately before, for the deltas. */
  previous: { from: string; to: string } | null;
};

const PERIOD_DAYS: Record<Exclude<PeriodKey, 'todo'>, number> = {
  mes: 30,
  trimestre: 90,
  ano: 365,
};

const PERIOD_LABEL: Record<PeriodKey, string> = {
  mes: 'Mes',
  trimestre: '3 meses',
  ano: 'Año',
  todo: 'Todo',
};

/**
 * The four windows the period selector offers.
 *
 * They are **rolling**, not calendar: "Mes" is the last 30 days, not
 * September. A calendar month would compare a half-finished month against a
 * whole one every time the user opens the screen before the 30th, and the
 * arrow next to the total would say "↓ 40 %" all month for no reason. The
 * monthly bar chart is still calendar months, because there the label *is* the
 * month.
 */
export function periodRanges(today: string): Record<PeriodKey, Period> {
  const end = new Date(today);
  const build = (key: Exclude<PeriodKey, 'todo'>): Period => {
    const days = PERIOD_DAYS[key];
    const from = shiftDays(end, -days);
    return {
      key,
      label: PERIOD_LABEL[key],
      from: from.toISOString(),
      to: end.toISOString(),
      previous: { from: shiftDays(end, -days * 2).toISOString(), to: from.toISOString() },
    };
  };

  return {
    mes: build('mes'),
    trimestre: build('trimestre'),
    ano: build('ano'),
    todo: { key: 'todo', label: PERIOD_LABEL.todo, from: null, to: end.toISOString(), previous: null },
  };
}

function shiftDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days, 12, 0, 0);
}

/** Rows inside `[from, to]`. A null `from` means "everything up to `to`". */
export function inRange<T extends { occurredAt: string }>(
  rows: T[],
  from: string | null,
  to: string,
): T[] {
  return rows.filter((row) => (from == null || row.occurredAt >= from) && row.occurredAt <= to);
}

export function totalSpend(rows: SpendRow[]): number {
  return roundMoney(rows.reduce((sum, row) => sum + row.amountDop, 0));
}

export type CategoryTotal = {
  category: StatCategory;
  total: number;
  /** 0–1 of the period's spend. Zero when nothing was spent at all. */
  share: number;
};

/**
 * Spend per category, biggest first, with empty categories dropped — a legend
 * entry reading "Mejora · RD$ 0.00" is noise.
 */
export function spendByCategory(rows: SpendRow[]): CategoryTotal[] {
  const totals = new Map<StatCategory, number>();
  for (const row of rows) {
    totals.set(row.category, (totals.get(row.category) ?? 0) + row.amountDop);
  }
  const grand = totalSpend(rows);

  return [...totals.entries()]
    .map(([category, total]) => ({
      category,
      total: roundMoney(total),
      share: grand > 0 ? roundMoney(total / grand) : 0,
    }))
    .filter((entry) => entry.total > 0)
    .sort((a, b) => b.total - a.total);
}

export type MonthlySpend = {
  /** `YYYY-MM`, so the rows sort as strings. */
  month: string;
  year: number;
  /** 0-indexed, ready for `monthTitle`. */
  monthIndex: number;
  total: number;
  byCategory: Record<StatCategory, number>;
};

/**
 * The last `months` calendar months ending with the one `today` falls in,
 * including the months where nothing was spent — a gap in a bar chart is
 * information, and dropping empty months would silently compress the axis.
 */
export function monthlySpendByCategory(
  rows: SpendRow[],
  months: number,
  today: string,
): MonthlySpend[] {
  const buckets = new Map<string, MonthlySpend>();

  for (let i = months - 1; i >= 0; i--) {
    const at = new Date(addMonths(today, -i));
    const key = monthKey(at);
    buckets.set(key, {
      month: key,
      year: at.getFullYear(),
      monthIndex: at.getMonth(),
      total: 0,
      byCategory: emptyCategories(),
    });
  }

  for (const row of rows) {
    const bucket = buckets.get(monthKey(new Date(row.occurredAt)));
    if (!bucket) continue;
    bucket.byCategory[row.category] += row.amountDop;
    bucket.total += row.amountDop;
  }

  return [...buckets.values()].map((bucket) => ({
    ...bucket,
    total: roundMoney(bucket.total),
    byCategory: Object.fromEntries(
      Object.entries(bucket.byCategory).map(([key, value]) => [key, roundMoney(value)]),
    ) as Record<StatCategory, number>,
  }));
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function emptyCategories(): Record<StatCategory, number> {
  return {
    combustible: 0,
    mantenimiento: 0,
    reparacion: 0,
    mejora: 0,
    legal: 0,
    otros: 0,
  };
}

/**
 * Kilometres covered inside a window.
 *
 * The span between the lowest and the highest reading, not the sum of the
 * deltas: an odometer only goes up, so they are the same number, and the span
 * survives a reading that arrived out of order.
 *
 * One reading in the window means one moment observed, not zero distance
 * travelled — but zero is the only number we can defend, so that is what it
 * returns.
 */
export function distanceInRange(readings: Reading[], from: string | null, to: string): number {
  const inside = inRange(readings, from, to);
  if (inside.length < 2) return 0;
  const values = inside.map((r) => r.valueKm);
  return Math.max(0, Math.max(...values) - Math.min(...values));
}

export type MonthlyDistance = { month: string; year: number; monthIndex: number; km: number };

/**
 * Distance per calendar month, attributing each gap between two consecutive
 * readings to the month of the **later** one.
 *
 * A reading in March and the next in June puts all three months' driving on
 * June. That is wrong in the sense that the car did not sit still, and right in
 * the sense that it is the only month we have evidence for — spreading it
 * evenly would invent two data points. The chart is built from what was
 * written down.
 */
export function distancePerMonth(readings: Reading[], months: number, today: string): MonthlyDistance[] {
  const buckets = new Map<string, MonthlyDistance>();
  for (let i = months - 1; i >= 0; i--) {
    const at = new Date(addMonths(today, -i));
    buckets.set(monthKey(at), {
      month: monthKey(at),
      year: at.getFullYear(),
      monthIndex: at.getMonth(),
      km: 0,
    });
  }

  const sorted = [...readings].sort((a, b) => a.valueKm - b.valueKm);
  for (let i = 1; i < sorted.length; i++) {
    const delta = sorted[i].valueKm - sorted[i - 1].valueKm;
    if (delta <= 0) continue;
    const bucket = buckets.get(monthKey(new Date(sorted[i].occurredAt)));
    if (bucket) bucket.km += delta;
  }

  return [...buckets.values()].map((b) => ({ ...b, km: Math.round(b.km) }));
}

/**
 * Pesos per kilometre over a window: everything spent divided by everything
 * driven. Null rather than Infinity when the distance is unknown — "—" is an
 * honest answer and a division by zero is not.
 */
export function costPerKm(rows: SpendRow[], distanceKm: number): number | null {
  if (distanceKm <= 0) return null;
  return roundMoney(totalSpend(rows) / distanceKm);
}

export type Delta = {
  current: number;
  previous: number;
  /** Percent change, or null when the previous window had nothing to compare. */
  percent: number | null;
  direction: 'up' | 'down' | 'flat';
};

/**
 * Change against the previous window of the same length.
 *
 * A 0 → something jump has no percentage (it is division by zero, and "+∞ %"
 * helps nobody), so `percent` is null and only the direction is reported.
 * Anything inside ±1 % reads as flat: month-to-month noise is not a trend.
 */
export function delta(current: number, previous: number): Delta {
  if (previous === 0) {
    return {
      current,
      previous,
      percent: null,
      direction: current > 0 ? 'up' : 'flat',
    };
  }
  const percent = ((current - previous) / previous) * 100;
  return {
    current,
    previous,
    percent: Math.round(percent),
    direction: Math.abs(percent) < 1 ? 'flat' : percent > 0 ? 'up' : 'down',
  };
}

export type Ownership = {
  purchasePrice: number;
  soldPrice: number | null;
  spend: number;
  /** purchase − sold + everything spent. */
  total: number;
  monthsOwned: number;
  /** Null until a month has passed; a one-week "cost per month" is a fiction. */
  costPerMonth: number | null;
};

/**
 * What the car has cost in total, including what it lost in value.
 *
 * Only returned when a purchase price was recorded — without one the number is
 * just the running spend under a grander name, and the card says nothing the
 * KPI tiles have not already said.
 */
export function totalCostOfOwnership(
  vehicle: {
    purchaseDate: string | null;
    purchasePrice: number | null;
    soldDate: string | null;
    soldPrice: number | null;
  },
  spend: number,
  today: string,
): Ownership | null {
  if (vehicle.purchasePrice == null || vehicle.purchasePrice <= 0) return null;

  const sold = vehicle.soldPrice ?? null;
  const total = roundMoney(vehicle.purchasePrice - (sold ?? 0) + spend);

  // Owned until it was sold, or until today.
  const start = vehicle.purchaseDate;
  const end = vehicle.soldDate ?? today;
  const days = start ? daysBetween(start, end) : 0;
  const monthsOwned = Math.max(0, Math.floor(days / 30.44));

  return {
    purchasePrice: vehicle.purchasePrice,
    soldPrice: sold,
    spend: roundMoney(spend),
    total,
    monthsOwned,
    costPerMonth: monthsOwned >= 1 ? roundMoney(total / monthsOwned) : null,
  };
}

export type UpcomingCost = {
  id: string;
  title: string;
  amountDop: number;
  /** Where the number came from, so the screen can say so. */
  basis: 'estimado' | 'ultimo_costo';
  dueDate: string | null;
};

export type Upcoming = { items: UpcomingCost[]; total: number };

/**
 * What the next stretch is likely to cost: open tasks with an estimate, plus
 * reminders that are already due or close to it and whose last completion left
 * a price behind.
 *
 * A reminder with no history contributes nothing rather than a guess — the
 * point of the card is that the figures are the user's own.
 */
export function upcomingCosts(
  tasks: { id: string; title: string; status: string; estimatedCostDop: number | null }[],
  reminders: {
    id: string;
    title: string;
    dueDate: string | null;
    lastCostDop: number | null;
    isDue: boolean;
  }[],
): Upcoming {
  const items: UpcomingCost[] = [];

  for (const task of tasks) {
    if (task.status === 'hecha') continue;
    if (task.estimatedCostDop == null || task.estimatedCostDop <= 0) continue;
    items.push({
      id: task.id,
      title: task.title,
      amountDop: task.estimatedCostDop,
      basis: 'estimado',
      dueDate: null,
    });
  }

  for (const reminder of reminders) {
    if (!reminder.isDue) continue;
    if (reminder.lastCostDop == null || reminder.lastCostDop <= 0) continue;
    items.push({
      id: reminder.id,
      title: reminder.title,
      amountDop: reminder.lastCostDop,
      basis: 'ultimo_costo',
      dueDate: reminder.dueDate,
    });
  }

  items.sort((a, b) => b.amountDop - a.amountDop);
  return { items, total: roundMoney(items.reduce((sum, item) => sum + item.amountDop, 0)) };
}

/** `YYYY-MM-DD` for a row, for grouping without a timezone surprise. */
export function dayOf(iso: string): string {
  return dayKey(new Date(iso));
}
