import type { SQLiteDatabase } from 'expo-sqlite';

import { INSPECTION_TEMPLATES, SERVICE_TYPES, type ServiceTypeSeed } from '../domain/catalog';
import { addMonths, nextJanuary31, todayIso } from '../domain/dates';
import { enqueue } from './client';
import {
  currentOdometer,
  inspectionItems,
  inspectionTemplates,
  reminders,
  serviceTypes,
  vehicles,
} from './repos';
import type { AppliesTo, Vehicle } from './types';

/**
 * Turns lib/domain/catalog.ts into rows. Idempotent by construction: every
 * seeded row has a slug id, so re-running upserts the same row.
 *
 * Seeded rows carry `is_seeded = 1`. User edits to them survive — the seeder
 * only fills the columns it owns — and user-created rows are never touched.
 */
export async function seedCatalog(db?: SQLiteDatabase): Promise<void> {
  const run = async (handle: SQLiteDatabase) => {
    for (const [index, type] of SERVICE_TYPES.entries()) {
      await serviceTypes.upsert(
        {
          id: type.id,
          name: type.name,
          category: type.category,
          defaultIntervalKm: type.km,
          defaultIntervalMonths: type.months,
          appliesTo: type.appliesTo,
          isSeeded: true,
          sortOrder: index,
          deletedAt: null,
        },
        handle,
      );
    }

    for (const template of INSPECTION_TEMPLATES) {
      await inspectionTemplates.upsert(
        {
          id: template.id,
          vehicleId: null,
          name: template.name,
          cadence: template.cadence,
          vehicleType: template.vehicleType,
          isSeeded: true,
          isEnabled: true,
          deletedAt: null,
        },
        handle,
      );

      for (const [index, item] of template.items.entries()) {
        await inspectionItems.upsert(
          {
            // Deterministic so re-seeding updates rather than duplicates, and so
            // inspection_result.item_id keeps pointing at the same item.
            id: `${template.id}__${index}`,
            templateId: template.id,
            groupName: item.group,
            label: item.label,
            how: item.how,
            warning: item.warning,
            requiresColdEngine: item.coldEngine ?? false,
            onFail: item.onFail ?? 'task',
            relatedServiceTypeId: item.serviceTypeId ?? null,
            sortOrder: index,
            deletedAt: null,
          },
          handle,
        );
      }
    }
  };

  if (db) await run(db);
  else await enqueue(run);
}

function isDiesel(vehicle: Pick<Vehicle, 'defaultFuelType'>): boolean {
  return vehicle.defaultFuelType === 'gasoil_regular' || vehicle.defaultFuelType === 'gasoil_optimo';
}

function seedApplies(type: ServiceTypeSeed, vehicle: Vehicle): boolean {
  if (type.seedReminder === false) return false;
  const target: AppliesTo = type.seedReminder;
  if (target === 'all') return true;
  if (target === 'motor') return vehicle.type === 'motor';
  if (target === 'diesel') return isDiesel(vehicle);
  if (target === 'gasolina') return !isDiesel(vehicle) && vehicle.type !== 'motor';
  return false;
}

/**
 * Gives a vehicle its starting reminders: the catalog items flagged for it, plus
 * the DR legal set (01-data-model.md §3.3).
 *
 * Skips any reminder whose title is already present, which is what lets the
 * legacy importer run this over a vehicle that arrived with its own reminders
 * without producing two "Cambio de aceite" rows.
 */
export async function seedVehicleDefaults(
  vehicleId: string,
  { db }: { db?: SQLiteDatabase } = {},
): Promise<{ created: number }> {
  const run = async (handle: SQLiteDatabase) => {
    const vehicle = await vehicles.getById(vehicleId);
    if (!vehicle) return { created: 0 };

    const existing = await reminders.listWhere({ vehicleId });
    const taken = new Set(existing.map((r) => r.title.trim().toLowerCase()));
    const km = await currentOdometer(vehicleId);
    const today = todayIso();
    let created = 0;

    const add = async (input: Parameters<typeof reminders.upsert>[0]) => {
      const title = String(input.title ?? '').trim().toLowerCase();
      if (taken.has(title)) return;
      taken.add(title);
      await reminders.upsert({ ...input, vehicleId }, handle);
      created += 1;
    };

    for (const type of SERVICE_TYPES) {
      if (!seedApplies(type, vehicle)) continue;

      const override = isDiesel(vehicle) ? type.dieselOverride : undefined;
      const intervalKm = override?.km ?? type.km;
      const intervalMonths = override?.months ?? type.months;

      // Without an odometer reading there is nothing to count km from, so the
      // reminder starts as date-only and gains its km side on the first fill-up.
      const useKm = intervalKm != null && km != null;
      const useDate = intervalMonths != null;
      if (!useKm && !useDate) continue;

      await add({
        title: type.name,
        serviceTypeId: type.id,
        metric: useKm && useDate ? 'both' : useKm ? 'km' : 'date',
        dueKm: useKm ? km! + intervalKm! : null,
        dueDate: useDate ? addMonths(today, intervalMonths!) : null,
        isRecurring: true,
        intervalKm: intervalKm ?? null,
        intervalMonths: intervalMonths ?? null,
        fixedInterval: false,
        isEnabled: true,
        notes: type.notes ?? '',
      });
    }

    // DR legal set. These are fixed-interval: the marbete is due on 31 January
    // whether or not you renewed it in December, so the next due date anchors to
    // the old due date, never to the completion date.
    await add({
      title: 'Marbete',
      legalKind: 'marbete',
      metric: 'date',
      dueDate: nextJanuary31(today),
      isRecurring: true,
      intervalMonths: 12,
      fixedInterval: true,
      isEnabled: true,
      notes: 'La ventana abre a finales de octubre y cierra el 31 de enero.',
    });

    await add({
      title: 'Seguro',
      legalKind: 'seguro',
      metric: 'date',
      dueDate: null,
      isRecurring: true,
      intervalMonths: 12,
      fixedInterval: true,
      isEnabled: true,
      notes: 'Pon la fecha de vencimiento de tu póliza.',
    });

    await add({
      title: 'Licencia de conducir',
      legalKind: 'licencia',
      metric: 'date',
      dueDate: null,
      isRecurring: true,
      intervalMonths: 48,
      fixedInterval: true,
      isEnabled: true,
      notes: 'Revisa multas pendientes antes de renovar.',
    });

    await add({
      title: 'Revisión técnica',
      legalKind: 'revision_tecnica',
      metric: 'date',
      dueDate: null,
      isRecurring: false,
      isEnabled: false,
      notes: 'Pendiente de implementación por INTRANT.',
    });

    return { created };
  };

  return db ? run(db) : enqueue(run);
}
