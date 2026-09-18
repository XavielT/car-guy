import { getDb } from './client';
import { odometer as odometerRepo, reminders as reminderRepo, serviceRecords, tasks as taskRepo, vehicles } from './repos';
import type { ExpenseCategory, Vehicle } from './types';
import { todayIso } from '../domain/dates';
import { kmPerDay } from '../domain/odometer';
import { evaluate } from '../domain/reminders';
import {
  costPerKm,
  delta,
  distanceInRange,
  distancePerMonth,
  inRange,
  monthlySpendByCategory,
  periodRanges,
  spendByCategory,
  totalCostOfOwnership,
  totalSpend,
  upcomingCosts,
  type Period,
  type PeriodKey,
  type Reading,
  type SpendRow,
  type StatCategory,
} from '../domain/stats';

/**
 * The database half of the statistics: one pass over the tables that cost
 * money, normalised into `SpendRow[]`, and then nothing but `lib/domain/stats`
 * (ADR-02 — no SQL in a screen, ADR-04 — no arithmetic in a query).
 *
 * The spend query is a UNION rather than three round trips because the screen
 * needs a year of rows at once and three awaits over the same connection is
 * three times the latency for the same answer.
 *
 * `history_feed` is deliberately *not* reused here: it flattens the expense
 * category into the subtitle, and the donut needs that column typed.
 */

/** 01-data-model.md §3.6 legal categories — what it costs to stay street-legal. */
const LEGAL: ExpenseCategory[] = ['seguro', 'marbete', 'impuesto', 'multa'];

function expenseCategory(category: string): StatCategory {
  return LEGAL.includes(category as ExpenseCategory) ? 'legal' : 'otros';
}

type SpendQueryRow = { occurred_at: string; category: string; amount_dop: number | null };

/** Every peso spent on one vehicle, cheapest to read as one list. */
export async function spendRows(vehicleId: string): Promise<SpendRow[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<SpendQueryRow>(
    `SELECT occurred_at, 'combustible' AS category, total_dop AS amount_dop
       FROM fuel_log WHERE vehicle_id = ? AND deleted_at IS NULL
     UNION ALL
     SELECT occurred_at, kind, total_dop
       FROM service_record WHERE vehicle_id = ? AND deleted_at IS NULL
     UNION ALL
     SELECT occurred_at, category, amount_dop
       FROM expense WHERE vehicle_id = ? AND deleted_at IS NULL
     ORDER BY occurred_at ASC`,
    [vehicleId, vehicleId, vehicleId],
  );

  return rows.map((row) => ({
    occurredAt: row.occurred_at,
    amountDop: row.amount_dop ?? 0,
    category:
      row.category === 'combustible' ||
      row.category === 'mantenimiento' ||
      row.category === 'reparacion' ||
      row.category === 'mejora'
        ? (row.category as StatCategory)
        : expenseCategory(row.category),
  }));
}

async function readings(vehicleId: string): Promise<Reading[]> {
  const rows = await odometerRepo.list(vehicleId);
  return rows.map((row) => ({ occurredAt: row.occurredAt, valueKm: row.valueKm }));
}

/**
 * What a reminder cost the last time it was done, so "próximos gastos" can use
 * the user's own prices instead of a table of national averages.
 */
async function lastCosts(vehicleId: string): Promise<Map<string, number>> {
  const records = await serviceRecords.list(vehicleId);
  const byId = new Map(records.map((record) => [record.id, record.totalDop]));
  const reminders = await reminderRepo.listWhere({ vehicleId });

  const out = new Map<string, number>();
  for (const reminder of reminders) {
    const cost = reminder.lastCompletedRecordId ? byId.get(reminder.lastCompletedRecordId) : undefined;
    if (cost != null && cost > 0) out.set(reminder.id, cost);
  }
  return out;
}

export type KpiSet = {
  spend: number;
  distanceKm: number;
  costPerKm: number | null;
  /** Deltas against the previous window of the same length; null for "todo". */
  spendDelta: ReturnType<typeof delta> | null;
  distanceDelta: ReturnType<typeof delta> | null;
};

export type VehicleStats = {
  vehicle: Vehicle;
  period: Period;
  kpis: KpiSet;
  byCategory: ReturnType<typeof spendByCategory>;
  monthly: ReturnType<typeof monthlySpendByCategory>;
  monthlyDistance: ReturnType<typeof distancePerMonth>;
  ownership: ReturnType<typeof totalCostOfOwnership>;
  upcoming: ReturnType<typeof upcomingCosts>;
  /** Rows inside the window, for the report and the CSV. */
  rowsInPeriod: SpendRow[];
};

/** How many calendar months of history each window puts in the bar charts. */
const MONTHS: Record<PeriodKey, number> = { mes: 3, trimestre: 6, ano: 12, todo: 12 };

/**
 * Everything the Cifras screen and the report need, in one call.
 *
 * It reads more than any single card uses — the whole spend history rather than
 * the window — because the previous-period delta needs the window before this
 * one anyway, and a second query to fetch it would cost more than the rows do.
 */
export async function vehicleStats(
  vehicleId: string,
  periodKey: PeriodKey,
  today: string = todayIso(),
): Promise<VehicleStats | null> {
  const vehicle = await vehicles.getById(vehicleId);
  if (!vehicle) return null;

  const [spend, odoReadings, taskRows, reminderRows, costs] = await Promise.all([
    spendRows(vehicleId),
    readings(vehicleId),
    taskRepo.listWhere({ vehicleId }),
    reminderRepo.listWhere({ vehicleId }),
    lastCosts(vehicleId),
  ]);

  const period = periodRanges(today)[periodKey];
  const current = inRange(spend, period.from, period.to);
  const distance = distanceInRange(odoReadings, period.from, period.to);

  const previousSpend = period.previous
    ? inRange(spend, period.previous.from, period.previous.to)
    : null;
  const previousDistance = period.previous
    ? distanceInRange(odoReadings, period.previous.from, period.previous.to)
    : null;

  // The reminder engine decides what "due" means; this file does not get a
  // second opinion on it (Phase 5 owns that rule).
  const pace = kmPerDay(odoReadings, today);
  const currentKm = odoReadings.length ? Math.max(...odoReadings.map((r) => r.valueKm)) : null;
  const dueReminders = reminderRows
    .filter((reminder) => reminder.isEnabled)
    .map((reminder) => {
      const status = evaluate(reminder, {
        today,
        currentKm,
        kmPerDay: pace.kmPerDay,
        confidence: pace.confidence,
      });
      return {
        id: reminder.id,
        title: reminder.title,
        dueDate: reminder.dueDate,
        lastCostDop: costs.get(reminder.id) ?? null,
        isDue: status.status === 'proximo' || status.status === 'urgente' || status.status === 'vencido',
      };
    });

  const months = MONTHS[periodKey];

  return {
    vehicle,
    period,
    kpis: {
      spend: totalSpend(current),
      distanceKm: distance,
      costPerKm: costPerKm(current, distance),
      spendDelta: previousSpend ? delta(totalSpend(current), totalSpend(previousSpend)) : null,
      distanceDelta: previousDistance != null ? delta(distance, previousDistance) : null,
    },
    byCategory: spendByCategory(current),
    monthly: monthlySpendByCategory(spend, months, today),
    monthlyDistance: distancePerMonth(odoReadings, months, today),
    // Ownership is a lifetime figure, so it uses every row rather than the window.
    ownership: totalCostOfOwnership(vehicle, totalSpend(spend), today),
    upcoming: upcomingCosts(taskRows, dueReminders),
    rowsInPeriod: current,
  };
}
