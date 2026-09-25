import type { VehicleDraft } from '@/components/VehicleForm';

import { addMonths, todayIso } from '../domain/dates';
import { enqueue, now } from './client';
import { odometer as odometerRepo, reminders as reminderRepo, vehicles as vehicleRepo } from './repos';
import { seedVehicleDefaults } from './seed';

/** Synthetic oil stretches the interval; the catalog default assumes mineral. */
const SYNTHETIC_KM = 10_000;
const SYNTHETIC_MONTHS = 12;

/**
 * Saves a vehicle from the form, in the order the data depends on.
 *
 * The sequence matters: seeding reads the current odometer to work out
 * `due_km` for every catalog reminder, so the **initial reading has to exist
 * first**. That is why the vehicle goes in through `upsertRaw` (no seeding side
 * effect) and seeding is called explicitly afterwards.
 */
export async function saveVehicleDraft(draft: VehicleDraft): Promise<string> {
  const isNew = draft.id ? (await vehicleRepo.getById(draft.id)) == null : true;

  const saved = await enqueue(async (db) => {
    const vehicle = await vehicleRepo.upsertRaw(
      {
        id: draft.id,
        name: draft.name,
        type: draft.type,
        make: draft.make,
        model: draft.model,
        year: draft.year,
        color: draft.color,
        plate: draft.plate,
        vin: draft.vin,
        defaultFuelType: draft.defaultFuelType,
        tankVolume: draft.tankVolume,
        initialOdometerKm: draft.odometerKm,
        purchaseDate: draft.purchaseDate,
        purchasePrice: draft.purchasePrice,
        photoMediaId: draft.photoMediaId,
        notes: draft.notes,
      },
      db,
    );

    if (draft.odometerKm != null) {
      // One reading per vehicle from this source, so editing the vehicle
      // corrects the initial reading instead of stacking another one.
      await odometerRepo.upsert(
        {
          id: `odo_init_${vehicle.id}`,
          vehicleId: vehicle.id,
          occurredAt: todayIso(),
          valueKm: draft.odometerKm,
          source: 'manual',
          sourceId: vehicle.id,
          deletedAt: null,
        },
        db,
      );
    }

    return vehicle;
  });

  if (isNew) {
    await seedVehicleDefaults(saved.id);
    if (draft.synthetic) await applySyntheticOil(saved.id);
  }

  return saved.id;
}

/**
 * Pushes the seeded oil reminder out to the synthetic interval.
 *
 * Done by editing the reminder rather than the catalog: the catalog is shared by
 * every vehicle, and only this one runs synthetic.
 */
async function applySyntheticOil(vehicleId: string): Promise<void> {
  const rows = await reminderRepo.listWhere({ vehicleId, serviceTypeId: 'aceite_motor' });
  const reminder = rows[0];
  if (!reminder) return;

  const baseKm = (reminder.dueKm ?? 0) - (reminder.intervalKm ?? 0);
  await reminderRepo.upsert({
    id: reminder.id,
    intervalKm: SYNTHETIC_KM,
    intervalMonths: SYNTHETIC_MONTHS,
    dueKm: reminder.dueKm != null ? baseKm + SYNTHETIC_KM : null,
    dueDate: reminder.dueDate ? addMonths(todayIso(), SYNTHETIC_MONTHS) : null,
    notes: 'Aceite sintético: 10,000 km o 12 meses.',
  });
}

/**
 * Deletes a vehicle and everything that belongs to it, in one transaction.
 *
 * Tombstones, not DELETEs — sync has to carry the removal to the cloud and to
 * the user's other devices, row by row. Deleting only the vehicle row used to
 * leave its reminders, tasks, checks and readings behind: invisible here, but
 * still counted by queries that do not join the vehicle, and still pushed.
 *
 * Children without a vehicle_id (record items, parts, check results, a
 * vehicle's own checklist items, photos) go through their parent's id.
 */
export async function deleteVehicleCascade(vehicleId: string): Promise<void> {
  await enqueue(async (db) => {
    const stamp = now();
    const tomb = (table: string, where: string) =>
      db.runAsync(
        `UPDATE ${table} SET deleted_at = ?1, updated_at = ?2, synced_at = NULL
         WHERE deleted_at IS NULL AND ${where}`,
        [stamp, stamp, vehicleId],
      );

    // Photos first, while their owners are still live rows to select from.
    await tomb(
      'media',
      `(owner_table = 'vehicle' AND owner_id = ?3)
        OR (owner_table = 'service_record' AND owner_id IN (SELECT id FROM service_record WHERE vehicle_id = ?3))
        OR (owner_table = 'expense' AND owner_id IN (SELECT id FROM expense WHERE vehicle_id = ?3))
        OR (owner_table = 'fuel_log' AND owner_id IN (SELECT id FROM fuel_log WHERE vehicle_id = ?3))
        OR (owner_table = 'document' AND owner_id IN (SELECT id FROM document WHERE vehicle_id = ?3))
        OR (owner_table = 'inspection_result' AND owner_id IN
              (SELECT r.id FROM inspection_result r JOIN inspection i ON i.id = r.inspection_id WHERE i.vehicle_id = ?3))`,
    );
    await tomb('service_record_item', 'service_record_id IN (SELECT id FROM service_record WHERE vehicle_id = ?3)');
    await tomb('part', 'service_record_id IN (SELECT id FROM service_record WHERE vehicle_id = ?3)');
    await tomb('inspection_result', 'inspection_id IN (SELECT id FROM inspection WHERE vehicle_id = ?3)');
    await tomb('inspection_item', 'template_id IN (SELECT id FROM inspection_template WHERE vehicle_id = ?3)');
    for (const table of [
      'vehicle_spec',
      'odometer_reading',
      'fuel_log',
      'service_record',
      'expense',
      'reminder',
      'inspection_template',
      'inspection',
      'task',
      'document',
    ]) {
      await tomb(table, 'vehicle_id = ?3');
    }
    await tomb('vehicle', 'id = ?3');
  });
}
