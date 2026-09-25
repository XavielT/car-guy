import { currentOdometer, odometer as odometerRepo, reminders as reminderRepo } from './repos';
import type { Reminder } from './types';
import { todayIso } from '../domain/dates';
import { kmPerDay } from '../domain/odometer';
import { bySeverity, evaluate, needsAttention, type ReminderStatus } from '../domain/reminders';

export type EvaluatedReminder = { reminder: Reminder; status: ReminderStatus };

/**
 * Every enabled reminder for a vehicle, with its urgency, worst first.
 *
 * The context — current odometer and the vehicle's own km/day — is read once
 * here and shared, so the screen does not run the same two queries per row.
 * `evaluate` itself stays pure and untouched by the database (ADR-07).
 */
export async function evaluatedReminders(
  vehicleId: string,
  today: string = todayIso(),
  { includeDisabled = false }: { includeDisabled?: boolean } = {},
): Promise<EvaluatedReminder[]> {
  const [rows, km, readings] = await Promise.all([
    reminderRepo.listWhere({ vehicleId }),
    currentOdometer(vehicleId),
    odometerRepo.list(vehicleId),
  ]);

  const pace = kmPerDay(readings, today);

  return rows
    // The list screen asks for the disabled ones too, so a reminder switched
    // off — or the Revisión técnica, which starts off — can be switched back on.
    .filter((reminder) => includeDisabled || reminder.isEnabled)
    .map((reminder) => ({
      reminder,
      status: evaluate(reminder, {
        today,
        currentKm: km,
        kmPerDay: pace.kmPerDay,
        confidence: pace.confidence,
      }),
    }))
    .sort(bySeverity);
}

/**
 * The handful worth putting on the home screen: anything actually coming due.
 * `sin_datos` is left out — see `needsAttention`.
 */
export async function attentionReminders(
  vehicleId: string,
  limit = 4,
  today: string = todayIso(),
): Promise<EvaluatedReminder[]> {
  const all = await evaluatedReminders(vehicleId, today);
  return all.filter((r) => needsAttention(r.status)).slice(0, limit);
}
