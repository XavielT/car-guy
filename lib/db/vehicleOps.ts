import type { SQLiteDatabase } from 'expo-sqlite';

import type { VehicleDraft } from '@/components/VehicleForm';

import { addMonths, todayIso } from '../domain/dates';
import { isArchivedFor } from '../domain/garage';
import { statusLabel } from '../domain/vehicleStatus';
import { isLiquid, tankForStorage, toLiters } from '../domain/units';
import { t } from '../i18n';
import type { VehicleStatus } from './types';
import { enqueue, now } from './client';
import {
  albumItems as albumItemRepo,
  milestones as milestoneRepo,
  odometer as odometerRepo,
  reminders as reminderRepo,
  specsheets as specsheetRepo,
  vehicleOwnership as ownershipRepo,
  vehicles as vehicleRepo,
} from './repos';
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
  const existing = draft.id ? await vehicleRepo.getById(draft.id) : null;
  const isNew = existing == null;
  // The form types the tank in the vehicle's unit; storage is liters (v6).
  const volumeUnit = draft.volumeUnit ?? existing?.volumeUnit ?? 'gal';
  const tank = tankForStorage(draft.tankVolume, volumeUnit, draft.defaultFuelType);
  const statusChanged = existing != null && existing.status !== draft.status;
  // Back to activo: nothing to note and no "since".
  const statusNote = draft.status === 'activo' ? '' : (draft.statusNote ?? existing?.statusNote ?? '');
  const statusSince =
    draft.status === 'activo'
      ? null
      : (draft.statusSince ?? (statusChanged || isNew ? todayIso() : existing?.statusSince ?? null));

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
        ...tank,
        // The reserve light (Phase 0 audit): liters like the tank; undefined leaves the column alone.
        reserveVolumeL:
          draft.reserveVolume === undefined
            ? undefined
            : draft.reserveVolume == null || !isLiquid(draft.defaultFuelType)
              ? null
              : Math.round(toLiters(draft.reserveVolume, volumeUnit) * 1000) / 1000,
        initialOdometerKm: draft.odometerKm,
        purchaseDate: draft.purchaseDate,
        purchasePrice: draft.purchasePrice,
        photoMediaId: draft.photoMediaId,
        notes: draft.notes,
        nickname: draft.nickname,
        status: draft.status,
        // Status and is_archived say the same thing until a later schema drops the flag.
        isArchived: isArchivedFor(draft.status),
        chassisCode: draft.chassisCode,
        chassisNumber: draft.chassisNumber,
        engineCode: draft.engineCode,
        transmission: draft.transmission,
        drivetrain: draft.drivetrain,
        origin: draft.origin,
        importedYear: draft.importedYear,
        story: draft.story,
        // v6 (IMP 29092026 Phase 3). `undefined` leaves a column alone (upsertRaw skips it),
        // so a caller that does not know these fields changes none of them.
        volumeUnit,
        // L/100 km is a choice; otherwise the figure follows the volume unit.
        economyUnit: (draft.economyUnit ?? existing?.economyUnit) === 'l_100km' ? 'l_100km' : volumeUnit === 'l' ? 'km_l' : 'km_gal',
        makeId: draft.makeId,
        modelId: draft.modelId,
        bodyType: draft.bodyType,
        colorId: draft.colorId,
        interiorColorId: draft.interiorColorId,
        interiorMaterial: draft.interiorMaterial,
        statusNote,
        statusSince,
      },
      db,
    );

    if (draft.galleryIds) await syncVehicleGallery(vehicle.id, draft.galleryIds, db);

    // A status change from the form is a milestone too (01-data-model-v6.md §1.8),
    // like the hub's "Cambiar estado" (setVehicleStatus).
    if (statusChanged) {
      await milestoneRepo.upsert(
        {
          vehicleId: vehicle.id,
          kind: 'estado',
          occurredAt: statusSince ?? todayIso(),
          odometerKm: null,
          title: t.statusChanged(statusLabel(draft.status), statusNote),
          story: statusNote,
          coverMediaId: null,
        },
        db,
      );
    }

    // The ownership period mirrors the purchase fields, with migration v2's id
    // (own_<vehicle>) so a device that migrated and one that created converge.
    const own = await ownershipRepo.getById(`own_${vehicle.id}`);
    if (!own) {
      await ownershipRepo.upsert(
        {
          id: `own_${vehicle.id}`,
          vehicleId: vehicle.id,
          acquiredAt: draft.purchaseDate,
          acquiredPrice: draft.purchasePrice,
          isCurrent: true,
          deletedAt: null,
        },
        db,
      );
      await specsheetRepo.upsertForVehicle(vehicle.id, {}, db);
    } else if (own.acquiredAt !== draft.purchaseDate || own.acquiredPrice !== draft.purchasePrice) {
      await ownershipRepo.upsert({ id: own.id, acquiredAt: draft.purchaseDate, acquiredPrice: draft.purchasePrice }, db);
    }

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
    notes: t.oil.syntheticNote,
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
/**
 * Every row of one vehicle, as (table, where) pairs with `?3` the vehicle id,
 * children before parents. Shared by the tombstoning delete and the local purge
 * of a vehicle someone stopped sharing with me.
 */
function vehicleScopes(): [string, string][] {
  return [
    // Photos first, while their owners are still live rows to select from.
    [
      'media',
      `(owner_table = 'vehicle' AND owner_id = ?3)
        OR (owner_table = 'service_record' AND owner_id IN (SELECT id FROM service_record WHERE vehicle_id = ?3))
        OR (owner_table = 'expense' AND owner_id IN (SELECT id FROM expense WHERE vehicle_id = ?3))
        OR (owner_table = 'fuel_log' AND owner_id IN (SELECT id FROM fuel_log WHERE vehicle_id = ?3))
        OR (owner_table = 'document' AND owner_id IN (SELECT id FROM document WHERE vehicle_id = ?3))
        OR (owner_table = 'inspection_result' AND owner_id IN
              (SELECT r.id FROM inspection_result r JOIN inspection i ON i.id = r.inspection_id WHERE i.vehicle_id = ?3))
        OR id IN (SELECT media_id FROM album_item WHERE vehicle_id = ?3)
        OR id IN (SELECT mm.media_id FROM mod_media mm JOIN mod ON mod.id = mm.mod_id WHERE mod.vehicle_id = ?3)`,
    ],
    // Schema v2 children reached through their parent (IMP 28092026).
    ['mod_media', 'mod_id IN (SELECT id FROM mod WHERE vehicle_id = ?3)'],
    ['setup_sheet', 'session_id IN (SELECT s.id FROM track_session s JOIN track_event e ON e.id = s.event_id WHERE e.vehicle_id = ?3)'],
    // Consumables hang off the event (session_id is often null).
    ['consumable_usage', 'event_id IN (SELECT id FROM track_event WHERE vehicle_id = ?3)'],
    ['track_session', 'event_id IN (SELECT id FROM track_event WHERE vehicle_id = ?3)'],
    ['service_record_item', 'service_record_id IN (SELECT id FROM service_record WHERE vehicle_id = ?3)'],
    ['part', 'service_record_id IN (SELECT id FROM service_record WHERE vehicle_id = ?3)'],
    ['inspection_result', 'inspection_id IN (SELECT id FROM inspection WHERE vehicle_id = ?3)'],
    ['inspection_item', 'template_id IN (SELECT id FROM inspection_template WHERE vehicle_id = ?3)'],
    ...[
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
      // v2. Inventory stays (an item can outlive the car); vehicle_member is the server's.
      'album_item',
      'milestone',
      'vehicle_ownership',
      'mod',
      'vehicle_specsheet',
      'spec_snapshot',
      'torque_spec',
      'wishlist_item',
      'tire',
      'wheel_set',
      'vehicle_dtc_event',
      'fluid_guide_item',
      'track_event',
      'vehicle_share',
      // v8
      'vehicle_fact',
    ].map((table): [string, string] => [table, 'vehicle_id = ?3']),
    ['vehicle', 'id = ?3'],
  ];
}

export async function deleteVehicleCascade(vehicleId: string): Promise<void> {
  await enqueue(async (db) => {
    const stamp = now();
    for (const [table, where] of vehicleScopes()) {
      await db.runAsync(
        `UPDATE ${table} SET deleted_at = ?1, updated_at = ?2, synced_at = NULL
         WHERE deleted_at IS NULL AND (${where})`,
        [stamp, stamp, vehicleId],
      );
    }
  });
}

/**
 * Removes a vehicle from this device only — nothing is tombstoned, nothing is
 * pushed. For a shared car whose owner removed me (or that I left): the rows
 * are the owner's, and deleting them in the cloud is not mine to do.
 */
export async function purgeVehicleLocal(vehicleId: string): Promise<void> {
  await enqueue(async (db) => {
    await db.execAsync('PRAGMA foreign_keys = OFF');
    try {
      for (const [table, where] of vehicleScopes()) {
        await db.runAsync(`DELETE FROM ${table} WHERE (${where.replace(/\?3/g, '?1')})`, [vehicleId]);
      }
      await db.runAsync('DELETE FROM vehicle_member WHERE vehicle_id = ?', [vehicleId]);
    } finally {
      await db.execAsync('PRAGMA foreign_keys = ON');
    }
  });
}

/**
 * Moves a vehicle between activo / proyecto / guardado (vendido has its own
 * path, `sellVehicle`). Coming back from vendido reopens the ownership period
 * — "lo compré otra vez" — but keeps the sale on record in the row's history
 * by leaving `sold_*` to the user's edit.
 */
export async function setVehicleStatus(
  vehicleId: string,
  status: Exclude<VehicleStatus, 'vendido'>,
  note?: string,
): Promise<void> {
  const before = await vehicleRepo.getById(vehicleId);
  if (before && before.status === status && (note === undefined || note === before.statusNote)) return;
  const today = todayIso();
  await vehicleRepo.upsertRaw({
    id: vehicleId,
    status,
    isArchived: isArchivedFor(status),
    statusSince: before?.status === status ? before.statusSince : today,
    ...(note === undefined ? {} : { statusNote: note.trim() }),
  });
  // v6: a status change is a milestone of kind 'estado', so the history and the
  // album timeline show it without a table of its own (01-data-model-v6.md §1.8).
  if (before?.status !== status) {
    await milestoneRepo.upsert({
      vehicleId,
      kind: 'estado',
      occurredAt: today,
      odometerKm: null,
      title: t.statusChanged(statusLabel(status), note),
      story: note?.trim() ?? '',
      coverMediaId: null,
    });
  }
}

/**
 * The gallery as the form left it: album items with role 'vehicle', in order.
 * A photo already in the album (role 'album') joins the gallery rather than
 * getting a second album item; one dropped from the gallery is removed from it
 * (its album item goes, the photo itself stays — it may be the cover of a
 * milestone). The cover is `vehicle.photo_media_id`, written by the caller.
 */
export async function syncVehicleGallery(vehicleId: string, ids: string[], db?: SQLiteDatabase): Promise<void> {
  const items = await albumItemRepo.listWhere({ vehicleId });
  const byMedia = new Map(items.map((item) => [item.mediaId, item]));
  for (const [sortOrder, mediaId] of ids.entries()) {
    const item = byMedia.get(mediaId);
    if (item) {
      if (item.role !== 'vehicle' || item.sortOrder !== sortOrder) {
        await albumItemRepo.upsert({ id: item.id, role: 'vehicle', sortOrder }, db);
      }
    } else {
      await albumItemRepo.upsert(
        { vehicleId, mediaId, role: 'vehicle', sortOrder, milestoneId: null, modId: null, trackEventId: null, deletedAt: null },
        db,
      );
    }
  }
  for (const item of items) {
    if (item.role === 'vehicle' && !ids.includes(item.mediaId)) await albumItemRepo.softDelete(item.id, db);
  }
}

export type SaleDraft = {
  soldAt: string;
  soldKm: number | null;
  soldPrice: number | null;
  soldTo: string | null;
  reason: string | null;
};

/**
 * Sells the car (ADR-18): closes the ownership period, marks it vendido and
 * archived, and mirrors the sale onto the v1 columns the reports read. The
 * car and its whole history stay — it becomes an Ex.
 */
export async function sellVehicle(vehicleId: string, sale: SaleDraft): Promise<void> {
  await enqueue(async (db) => {
    const vehicle = await vehicleRepo.getById(vehicleId);
    if (!vehicle) return;
    const ownId = `own_${vehicleId}`;
    const own = await ownershipRepo.getById(ownId);
    await ownershipRepo.upsert(
      {
        id: ownId,
        vehicleId,
        ...(own ? {} : { acquiredAt: vehicle.purchaseDate, acquiredPrice: vehicle.purchasePrice, isCurrent: true }),
        soldAt: sale.soldAt,
        soldKm: sale.soldKm,
        soldPrice: sale.soldPrice,
        soldTo: sale.soldTo,
        reason: sale.reason,
        deletedAt: null,
      },
      db,
    );
    await vehicleRepo.upsertRaw(
      { id: vehicleId, status: 'vendido', isArchived: true, soldDate: sale.soldAt, soldPrice: sale.soldPrice },
      db,
    );
    if (sale.soldKm != null) {
      await odometerRepo.upsert(
        { id: `odo_sale_${vehicleId}`, vehicleId, occurredAt: sale.soldAt, valueKm: sale.soldKm, source: 'manual', sourceId: ownId, deletedAt: null },
        db,
      );
    }
  });
}
