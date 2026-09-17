/**
 * Tu Combustible RD → Car Guy import (01-data-model.md §2).
 *
 * Car Guy ships under a new Android package, so a fresh install starts empty and
 * this is how an existing user's history arrives (decision D1). The v1 envelope
 * must therefore stay readable **forever**.
 *
 * The mapping is a pure function so it can be tested without a database:
 * jest-expo has no SQLite, so `mapLegacy` is what the tests exercise and
 * `importTuCombustible` is the thin transactional wrapper around it.
 */
import type { SQLiteDatabase } from 'expo-sqlite';

import { enqueue } from '../db/client';
import { seedVehicleDefaults } from '../db/seed';
import {
  expenses as expenseRepo,
  fuel as fuelRepo,
  odometer as odometerRepo,
  reminders as reminderRepo,
  serviceRecords as serviceRecordRepo,
  settings as settingsRepo,
  vehicles as vehicleRepo,
} from '../db/repos';
import type {
  Expense,
  ExpenseCategory,
  FuelLog,
  OdometerReading,
  Reminder,
  ServiceKind,
  ServiceRecord,
  Vehicle,
} from '../db/types';
import type { LegacyAppData, LegacyExpenseCategory } from '../types';

export type LegacyBackup = {
  app?: string;
  version?: number;
  exportedAt?: string;
  data?: LegacyAppData;
};

/** Legacy expense categories that become maintenance records, not expenses. */
const AS_SERVICE_RECORD: Partial<Record<LegacyExpenseCategory, ServiceKind>> = {
  maintenance: 'mantenimiento',
  repair: 'reparacion',
};

/** The rest keep being expenses, under Car Guy's richer category list. */
const AS_EXPENSE: Partial<Record<LegacyExpenseCategory, ExpenseCategory>> = {
  insurance: 'seguro',
  tax: 'impuesto',
  toll: 'peaje',
  parking: 'parqueo',
  wash: 'lavado',
  other: 'otro',
};

export type MappedImport = {
  vehicles: Partial<Vehicle>[];
  fuelLogs: Partial<FuelLog>[];
  odometerReadings: Partial<OdometerReading>[];
  serviceRecords: Partial<ServiceRecord>[];
  expenses: Partial<Expense>[];
  reminders: Partial<Reminder>[];
  settings: { key: string; value: unknown }[];
};

export type ImportCounts = {
  vehicles: number;
  fuelLogs: number;
  serviceRecords: number;
  expenses: number;
  reminders: number;
};

export class LegacyImportError extends Error {}

/**
 * Pulls the `AppData` out of either envelope shape and rejects anything else
 * with a message a person can act on.
 */
export function unwrapLegacy(payload: unknown): LegacyAppData {
  if (!payload || typeof payload !== 'object') {
    throw new LegacyImportError('El archivo está vacío o no es un JSON válido.');
  }
  const candidate = payload as LegacyBackup & Partial<LegacyAppData>;

  const data =
    candidate.data && typeof candidate.data === 'object'
      ? candidate.data
      : (candidate as unknown as LegacyAppData);

  const looksRight =
    Array.isArray(data.vehicles) || Array.isArray(data.fillups) || (data.settings != null);

  if (!looksRight) {
    throw new LegacyImportError(
      'El archivo no parece un respaldo de Tu Combustible RD: no trae vehículos ni cargas.',
    );
  }
  return {
    vehicles: data.vehicles ?? [],
    fillups: data.fillups ?? [],
    expenses: data.expenses ?? [],
    reminders: data.reminders ?? [],
    settings: data.settings ?? ({} as LegacyAppData['settings']),
  };
}

/**
 * Legacy rows → Car Guy rows. Ids are preserved exactly: they are the join keys
 * a re-import upserts on, and they are frequently `id_<ts>_<hex>` rather than
 * UUIDs, which is precisely why every id column is TEXT (ADR-03).
 */
export function mapLegacy(payload: unknown): MappedImport {
  const data = unwrapLegacy(payload);
  const out: MappedImport = {
    vehicles: [],
    fuelLogs: [],
    odometerReadings: [],
    serviceRecords: [],
    expenses: [],
    reminders: [],
    settings: [],
  };

  for (const v of data.vehicles) {
    out.vehicles.push({
      id: v.id,
      name: v.name,
      type: 'carro',
      plate: v.plate || null,
      defaultFuelType: v.defaultFuelType,
      tankVolume: v.tankVolume,
      notes: '',
      isArchived: false,
      sortOrder: 0,
      createdAt: v.createdAt,
      updatedAt: v.createdAt,
      deletedAt: null,
    });
  }

  for (const f of data.fillups) {
    out.fuelLogs.push({
      id: f.id,
      vehicleId: f.vehicleId,
      occurredAt: f.occurredAt,
      odometerKm: f.odometerKm,
      volume: f.volume,
      pricePerUnit: f.pricePerUnit,
      totalDop: f.totalDop,
      fuelType: f.fuelType,
      isFullTank: f.isFullTank,
      missedPrevious: false,
      station: f.station ?? '',
      notes: f.notes ?? '',
      createdAt: f.createdAt,
      updatedAt: f.createdAt,
      deletedAt: null,
    });
    out.odometerReadings.push({
      id: `odo_${f.id}`,
      vehicleId: f.vehicleId,
      occurredAt: f.occurredAt,
      valueKm: f.odometerKm,
      source: 'fuel',
      sourceId: f.id,
      createdAt: f.createdAt,
      updatedAt: f.createdAt,
      deletedAt: null,
    });
  }

  for (const e of data.expenses) {
    const kind = AS_SERVICE_RECORD[e.category];
    if (kind) {
      out.serviceRecords.push({
        id: e.id,
        vehicleId: e.vehicleId,
        kind,
        occurredAt: e.occurredAt,
        odometerKm: e.odometerKm,
        // The legacy row has no title of its own; its description is the closest
        // thing, and a record with an empty title reads as broken in Historial.
        title: e.description?.trim() || (kind === 'reparacion' ? 'Reparación' : 'Mantenimiento'),
        description: '',
        costPartsDop: 0,
        costLaborDop: 0,
        totalDop: e.amountDop,
        shop: '',
        createdAt: e.createdAt,
        updatedAt: e.createdAt,
        deletedAt: null,
      });
      if (e.odometerKm != null) {
        out.odometerReadings.push({
          id: `odo_${e.id}`,
          vehicleId: e.vehicleId,
          occurredAt: e.occurredAt,
          valueKm: e.odometerKm,
          source: 'service',
          sourceId: e.id,
          createdAt: e.createdAt,
          updatedAt: e.createdAt,
          deletedAt: null,
        });
      }
      continue;
    }

    out.expenses.push({
      id: e.id,
      vehicleId: e.vehicleId,
      occurredAt: e.occurredAt,
      odometerKm: e.odometerKm,
      category: AS_EXPENSE[e.category] ?? 'otro',
      amountDop: e.amountDop,
      description: e.description ?? '',
      vendor: '',
      createdAt: e.createdAt,
      updatedAt: e.createdAt,
      deletedAt: null,
    });
  }

  for (const r of data.reminders) {
    const hasDate = r.dueDate != null;
    const hasKm = r.dueOdometerKm != null;
    out.reminders.push({
      id: r.id,
      vehicleId: r.vehicleId,
      title: r.title,
      metric: hasDate && hasKm ? 'both' : hasKm ? 'km' : 'date',
      dueDate: r.dueDate,
      dueKm: r.dueOdometerKm,
      isRecurring: false,
      fixedInterval: false,
      // A completed legacy reminder is history, not something still pending.
      isEnabled: r.completedAt == null,
      lastCompletedAt: r.completedAt,
      notes: r.notes ?? '',
      createdAt: r.createdAt,
      updatedAt: r.createdAt,
      deletedAt: null,
    });
  }

  const s = data.settings;
  if (s) {
    if (s.activeVehicleId !== undefined) {
      out.settings.push({ key: 'active_vehicle_id', value: s.activeVehicleId });
    }
    if (s.referencePrices) out.settings.push({ key: 'reference_prices', value: s.referencePrices });
    if (s.priceWeekLabel) out.settings.push({ key: 'price_week_label', value: s.priceWeekLabel });
  }

  return out;
}

export function countsOf(mapped: MappedImport): ImportCounts {
  return {
    vehicles: mapped.vehicles.length,
    fuelLogs: mapped.fuelLogs.length,
    serviceRecords: mapped.serviceRecords.length,
    expenses: mapped.expenses.length,
    reminders: mapped.reminders.length,
  };
}

/** "3 vehículos, 148 cargas, 12 gastos, 4 recordatorios" */
export function describeCounts(counts: ImportCounts): string {
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  const parts = [
    plural(counts.vehicles, 'vehículo', 'vehículos'),
    plural(counts.fuelLogs, 'carga', 'cargas'),
  ];
  if (counts.serviceRecords) {
    parts.push(plural(counts.serviceRecords, 'mantenimiento', 'mantenimientos'));
  }
  if (counts.expenses) parts.push(plural(counts.expenses, 'gasto', 'gastos'));
  if (counts.reminders) parts.push(plural(counts.reminders, 'recordatorio', 'recordatorios'));
  return parts.join(', ');
}

/**
 * Writes a mapped import. One transaction, upsert by id, so importing the same
 * file twice changes nothing.
 */
export async function importTuCombustible(
  payload: unknown,
  { source = 'file' }: { source?: 'file' | 'asyncstorage' } = {},
): Promise<ImportCounts> {
  const mapped = mapLegacy(payload);
  const exportedAt =
    (payload as LegacyBackup | null)?.exportedAt ?? new Date().toISOString();

  await enqueue(async (db: SQLiteDatabase) => {
    // upsertRaw, not upsert: the seeding side effect must not run inside this
    // transaction — it needs the odometer readings the import is still writing.
    for (const v of mapped.vehicles) await vehicleRepo.upsertRaw(v, db);
    // Fuel and service upserts derive their own odometer readings; the mapped
    // ones are written afterwards so the legacy timestamps win on the same ids.
    for (const f of mapped.fuelLogs) await fuelRepo.upsert(f, db);
    for (const r of mapped.serviceRecords) await serviceRecordRepo.upsert(r, db);
    for (const o of mapped.odometerReadings) await odometerRepo.upsert(o, db);
    for (const e of mapped.expenses) await expenseRepo.upsert(e, db);
    for (const r of mapped.reminders) await reminderRepo.upsert(r, db);
    for (const s of mapped.settings) await settingsRepo.set(s.key, s.value, db);

    await settingsRepo.set('legacy_import_done', { exportedAt, source, at: new Date().toISOString() }, db);
  });

  // After the data lands, so that default reminders can key off the imported
  // odometer readings. seedVehicleDefaults skips titles that already exist.
  for (const v of mapped.vehicles) {
    if (v.id) await seedVehicleDefaults(v.id);
  }

  return countsOf(mapped);
}
