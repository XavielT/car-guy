import type { SQLiteDatabase } from 'expo-sqlite';

import { id as newId } from '../../format';
import { FUEL_CATALOG } from '../../fuel';
import { enqueue, getDb, now } from '../client';
import type {
  Expense,
  FuelLog,
  HistoryEntry,
  Inspection,
  InspectionItem,
  InspectionResult,
  InspectionTemplate,
  Media,
  OdometerReading,
  OdometerSource,
  Part,
  Reminder,
  ServiceRecord,
  ServiceRecordItem,
  ServiceType,
  Task,
  Vehicle,
  VehicleDocument,
  VehicleSpec,
} from '../types';
import { makeRepo } from './base';

/**
 * One repository per table. Screens and components import from here and never
 * write SQL themselves (ADR-02).
 */

const SYNC_BOOLS: string[] = [];

export const vehicleSpecs = makeRepo<VehicleSpec>({ table: 'vehicle_spec', booleans: SYNC_BOOLS });
export const odometer = makeRepo<OdometerReading>({ table: 'odometer_reading' });
export const serviceTypes = makeRepo<ServiceType>({ table: 'service_type', booleans: ['isSeeded'] });
export const serviceRecordItems = makeRepo<ServiceRecordItem>({ table: 'service_record_item' });
export const parts = makeRepo<Part>({ table: 'part' });
export const expenses = makeRepo<Expense>({ table: 'expense' });
export const reminders = makeRepo<Reminder>({
  table: 'reminder',
  booleans: ['isRecurring', 'fixedInterval', 'isEnabled'],
});
export const inspectionTemplates = makeRepo<InspectionTemplate>({
  table: 'inspection_template',
  booleans: ['isSeeded', 'isEnabled'],
});
export const inspectionItems = makeRepo<InspectionItem>({
  table: 'inspection_item',
  booleans: ['requiresColdEngine'],
});
export const inspections = makeRepo<Inspection>({ table: 'inspection' });
export const inspectionResults = makeRepo<InspectionResult>({ table: 'inspection_result' });
export const tasks = makeRepo<Task>({ table: 'task' });
export const documents = makeRepo<VehicleDocument>({ table: 'document' });
export const media = makeRepo<Media>({ table: 'media' });

const vehiclesBase = makeRepo<Vehicle>({ table: 'vehicle', booleans: ['isArchived'] });
const fuelBase = makeRepo<FuelLog>({
  table: 'fuel_log',
  booleans: ['isFullTank', 'missedPrevious'],
});
const serviceRecordsBase = makeRepo<ServiceRecord>({ table: 'service_record' });

/**
 * Mirrors a record's odometer into `odometer_reading` so that "current
 * odometer" is one query over one table regardless of what produced the number
 * (01-data-model.md §3.1).
 *
 * The reading's id is derived from the source id, which makes the write
 * idempotent: re-saving the record updates the same reading instead of piling
 * up duplicates.
 */
async function syncOdometerReading(
  handle: SQLiteDatabase,
  opts: {
    vehicleId: string;
    occurredAt: string;
    odometerKm: number | null | undefined;
    source: OdometerSource;
    sourceId: string;
  },
): Promise<void> {
  const readingId = `odo_${opts.sourceId}`;
  if (opts.odometerKm == null) {
    // The record lost its odometer — drop the derived reading with it.
    await odometer.softDelete(readingId, handle);
    return;
  }
  await odometer.upsert(
    {
      id: readingId,
      vehicleId: opts.vehicleId,
      occurredAt: opts.occurredAt,
      valueKm: opts.odometerKm,
      source: opts.source,
      sourceId: opts.sourceId,
      deletedAt: null,
    },
    handle,
  );
}

export const vehicles = {
  ...vehiclesBase,

  /**
   * Upsert with no seeding side effect. The importer uses this so the whole
   * import stays one transaction and seeding runs once at the end, against the
   * odometer readings the import just created.
   */
  upsertRaw: vehiclesBase.upsert,

  /**
   * On INSERT only, gives the new vehicle its default maintenance reminders and
   * the DR legal set (§3.3). Updates never re-seed — the user may have deleted
   * reminders on purpose.
   */
  async upsert(input: Partial<Vehicle> & Record<string, unknown>, db?: SQLiteDatabase) {
    const rowId = (input.id as string | undefined) ?? newId();
    const handle = db ?? (await getDb());
    const existing = await handle.getFirstAsync<{ id: string }>(
      'SELECT id FROM vehicle WHERE id = ?',
      [rowId],
    );

    const saved = await vehiclesBase.upsert({ ...input, id: rowId }, db);

    if (!existing) {
      // Imported at module scope this would be a cycle: seed.ts imports repos.
      const { seedVehicleDefaults } = await import('../seed');
      await seedVehicleDefaults(saved.id, { db });
    }
    return saved;
  },
};

export const fuel = {
  ...fuelBase,

  async upsert(input: Partial<FuelLog> & Record<string, unknown>, db?: SQLiteDatabase) {
    const run = async (handle: SQLiteDatabase) => {
      const saved = await fuelBase.upsert(input, handle);
      await syncOdometerReading(handle, {
        vehicleId: saved.vehicleId,
        occurredAt: saved.occurredAt,
        odometerKm: saved.odometerKm,
        source: 'fuel',
        sourceId: saved.id,
      });
      return saved;
    };
    return db ? run(db) : enqueue(run);
  },

  async softDelete(rowId: string, db?: SQLiteDatabase) {
    const run = async (handle: SQLiteDatabase) => {
      await fuelBase.softDelete(rowId, handle);
      await odometer.softDelete(`odo_${rowId}`, handle);
    };
    if (db) await run(db);
    else await enqueue(run);
  },
};

export const serviceRecords = {
  ...serviceRecordsBase,

  async upsert(input: Partial<ServiceRecord> & Record<string, unknown>, db?: SQLiteDatabase) {
    const run = async (handle: SQLiteDatabase) => {
      const saved = await serviceRecordsBase.upsert(input, handle);
      await syncOdometerReading(handle, {
        vehicleId: saved.vehicleId,
        occurredAt: saved.occurredAt,
        odometerKm: saved.odometerKm,
        source: 'service',
        sourceId: saved.id,
      });
      return saved;
    };
    return db ? run(db) : enqueue(run);
  },

  async softDelete(rowId: string, db?: SQLiteDatabase) {
    const run = async (handle: SQLiteDatabase) => {
      await serviceRecordsBase.softDelete(rowId, handle);
      await odometer.softDelete(`odo_${rowId}`, handle);
    };
    if (db) await run(db);
    else await enqueue(run);
  },

  /** The catalog items done in one visit; drives reminder resets in Phase 4. */
  async items(serviceRecordId: string) {
    return serviceRecordItems.listWhere({ serviceRecordId });
  },
};

/** Key/value settings. Values are JSON so callers get real types back. */
export const settings = {
  async get<T>(key: string, fallback: T): Promise<T> {
    const db = await getDb();
    const row = await db.getFirstAsync<{ value: string }>(
      'SELECT value FROM setting WHERE key = ?',
      [key],
    );
    if (!row) return fallback;
    try {
      return JSON.parse(row.value) as T;
    } catch {
      return fallback;
    }
  },

  async set(key: string, value: unknown, db?: SQLiteDatabase): Promise<void> {
    const timestamp = now();
    const run = async (handle: SQLiteDatabase) => {
      await handle.runAsync(
        `INSERT INTO setting (key, value, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
        [key, JSON.stringify(value), timestamp],
      );
    };
    if (db) await run(db);
    else await enqueue(run);
  },

  async all(): Promise<{ key: string; value: string; updatedAt: string }[]> {
    const db = await getDb();
    const rows = await db.getAllAsync<{ key: string; value: string; updated_at: string }>(
      'SELECT key, value, updated_at FROM setting',
    );
    return rows.map((r) => ({ key: r.key, value: r.value, updatedAt: r.updated_at }));
  },
};

export const history = {
  /** The unified timeline, straight off the view. */
  async feed(
    vehicleId: string,
    opts: { kinds?: string[]; from?: string; to?: string; q?: string; limit?: number } = {},
  ): Promise<HistoryEntry[]> {
    const db = await getDb();
    const clauses = ['vehicle_id = ?'];
    const params: unknown[] = [vehicleId];

    if (opts.kinds?.length) {
      clauses.push(`kind IN (${opts.kinds.map(() => '?').join(', ')})`);
      params.push(...opts.kinds);
    }
    if (opts.from) {
      clauses.push('occurred_at >= ?');
      params.push(opts.from);
    }
    if (opts.to) {
      clauses.push('occurred_at <= ?');
      params.push(opts.to);
    }
    if (opts.q) {
      // COLLATE NOCASE so "texaco" finds "Texaco". It only folds ASCII, so
      // "optimo" will not find "Óptimo" — accent-insensitive search needs an
      // ICU build of SQLite and is out of scope.
      //
      // A fill-up's title in the feed is its fuel *code* ("regular"); the
      // screen shows the label ("Gasolina Regular"). Matching the query against
      // the labels here — accent-insensitively, in JS — is what lets "gasolina"
      // or "óptimo" find fill-ups at all.
      const fold = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      const wanted = fold(opts.q);
      const fuelCodes = Object.entries(FUEL_CATALOG)
        .filter(([, meta]) => fold(meta.label).includes(wanted))
        .map(([code]) => code);
      const fuelClause = fuelCodes.length
        ? ` OR (kind = 'combustible' AND title IN (${fuelCodes.map(() => '?').join(', ')}))`
        : '';
      clauses.push(`(title LIKE ? COLLATE NOCASE OR subtitle LIKE ? COLLATE NOCASE${fuelClause})`);
      params.push(`%${opts.q}%`, `%${opts.q}%`, ...fuelCodes);
    }

    const rows = await db.getAllAsync<Record<string, unknown>>(
      `SELECT * FROM history_feed WHERE ${clauses.join(' AND ')} ORDER BY occurred_at DESC${
        opts.limit ? ` LIMIT ${Number(opts.limit)}` : ''
      }`,
      params as never,
    );

    return rows.map((r) => ({
      id: r.id as string,
      vehicleId: r.vehicle_id as string,
      kind: r.kind as HistoryEntry['kind'],
      occurredAt: r.occurred_at as string,
      odometerKm: (r.odometer_km as number | null) ?? null,
      title: (r.title as string) ?? '',
      subtitle: (r.subtitle as string | null) ?? null,
      amountDop: (r.amount_dop as number | null) ?? null,
    }));
  },
};

/** Highest odometer ever observed for a vehicle (§3.1). */
export async function currentOdometer(vehicleId: string): Promise<number | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ max_km: number | null }>(
    'SELECT MAX(value_km) AS max_km FROM odometer_reading WHERE vehicle_id = ? AND deleted_at IS NULL',
    [vehicleId],
  );
  return row?.max_km ?? null;
}

/**
 * Distance covered since tracking began: highest reading minus lowest. The
 * profile's "Km registrados" showed the odometer itself, repeating the number
 * right above it.
 */
export async function trackedDistance(vehicleId: string): Promise<number | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ lo: number | null; hi: number | null }>(
    'SELECT MIN(value_km) AS lo, MAX(value_km) AS hi FROM odometer_reading WHERE vehicle_id = ? AND deleted_at IS NULL',
    [vehicleId],
  );
  return row?.lo != null && row.hi != null ? row.hi - row.lo : null;
}

/** Every table, for the v2 backup and for resetAll. Order respects FKs. */
export const ALL_TABLES = [
  'vehicle',
  'vehicle_spec',
  'odometer_reading',
  'fuel_log',
  'service_type',
  'service_record',
  'service_record_item',
  'part',
  'expense',
  'reminder',
  'inspection_template',
  'inspection_item',
  'inspection',
  'inspection_result',
  'task',
  'document',
  'media',
] as const;
