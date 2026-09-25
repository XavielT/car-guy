import { enqueue } from './client';
import { reminders as reminderRepo, serviceTypes as serviceTypeRepo } from './repos';
import { retargetInterval } from '../domain/reminders';

/**
 * Changes a catalog item's default interval, and carries the change to every
 * reminder that was still using the old default (`retargetInterval` decides
 * which, and how the due point moves). Reminders set by hand are left alone.
 *
 * One transaction, so the catalog and the reminders never disagree.
 *
 * Returns how many reminders moved, for the confirmation.
 */
export async function saveServiceTypeInterval(
  serviceTypeId: string,
  next: { km: number | null; months: number | null },
): Promise<{ updated: number }> {
  const type = await serviceTypeRepo.getById(serviceTypeId);
  if (!type) throw new Error(`No service type ${serviceTypeId}`);
  const previous = { km: type.defaultIntervalKm, months: type.defaultIntervalMonths };
  const affected = await reminderRepo.listWhere({ serviceTypeId });

  return enqueue(async (db) => {
    await serviceTypeRepo.upsert(
      { id: serviceTypeId, defaultIntervalKm: next.km, defaultIntervalMonths: next.months },
      db,
    );
    let updated = 0;
    for (const reminder of affected) {
      const patch = retargetInterval(reminder, previous, next);
      if (!patch) continue;
      await reminderRepo.upsert({ id: reminder.id, ...patch }, db);
      updated += 1;
    }
    return { updated };
  });
}
