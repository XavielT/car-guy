import type { SQLiteDatabase } from 'expo-sqlite';
import { Platform } from 'react-native';

/**
 * Schema migrations, applied in order under `PRAGMA user_version`.
 *
 * Rules (ADR-02):
 * - **Never edit a shipped version.** A migration that has run on any device is
 *   history. Add a new entry instead.
 * - Every statement is plain SQL in `up`, run inside one transaction per version.
 * - Views are cheap to drop and recreate in a later version.
 *
 * To add version 2:
 *   { version: 2, up: [`ALTER TABLE vehicle ADD COLUMN nickname TEXT`] }
 */
export type Migration = { version: number; up: string[] };

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    up: [
      `CREATE TABLE setting (
        key        TEXT PRIMARY KEY NOT NULL,
        value      TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,

      `CREATE TABLE vehicle (
        id               TEXT PRIMARY KEY NOT NULL,
        name             TEXT NOT NULL,
        type             TEXT NOT NULL DEFAULT 'carro',
        make             TEXT, model TEXT, year INTEGER, trim TEXT, color TEXT,
        plate            TEXT,
        vin              TEXT,
        default_fuel_type TEXT NOT NULL,
        tank_volume      REAL,
        initial_odometer_km REAL,
        purchase_date    TEXT, purchase_price REAL, sold_date TEXT, sold_price REAL,
        photo_media_id   TEXT,
        notes            TEXT NOT NULL DEFAULT '',
        is_archived      INTEGER NOT NULL DEFAULT 0,
        sort_order       INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, synced_at TEXT
      )`,

      `CREATE TABLE vehicle_spec (
        id TEXT PRIMARY KEY NOT NULL,
        vehicle_id TEXT NOT NULL REFERENCES vehicle(id),
        name TEXT NOT NULL, value TEXT NOT NULL, sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, synced_at TEXT
      )`,

      `CREATE TABLE odometer_reading (
        id TEXT PRIMARY KEY NOT NULL,
        vehicle_id TEXT NOT NULL REFERENCES vehicle(id),
        occurred_at TEXT NOT NULL,
        value_km REAL NOT NULL,
        source TEXT NOT NULL,
        source_id TEXT,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, synced_at TEXT
      )`,
      `CREATE INDEX idx_odo_vehicle_time ON odometer_reading(vehicle_id, occurred_at)`,

      `CREATE TABLE fuel_log (
        id TEXT PRIMARY KEY NOT NULL,
        vehicle_id TEXT NOT NULL REFERENCES vehicle(id),
        occurred_at TEXT NOT NULL,
        odometer_km REAL NOT NULL,
        volume REAL NOT NULL,
        price_per_unit REAL NOT NULL,
        total_dop REAL NOT NULL,
        fuel_type TEXT NOT NULL,
        is_full_tank INTEGER NOT NULL DEFAULT 1,
        missed_previous INTEGER NOT NULL DEFAULT 0,
        station TEXT NOT NULL DEFAULT '',
        notes TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, synced_at TEXT
      )`,
      `CREATE INDEX idx_fuel_vehicle_time ON fuel_log(vehicle_id, occurred_at)`,

      `CREATE TABLE service_type (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        default_interval_km INTEGER,
        default_interval_months INTEGER,
        applies_to TEXT NOT NULL DEFAULT 'all',
        is_seeded INTEGER NOT NULL DEFAULT 0,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, synced_at TEXT
      )`,

      `CREATE TABLE service_record (
        id TEXT PRIMARY KEY NOT NULL,
        vehicle_id TEXT NOT NULL REFERENCES vehicle(id),
        kind TEXT NOT NULL,
        occurred_at TEXT NOT NULL,
        odometer_km REAL,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        cost_parts_dop REAL NOT NULL DEFAULT 0,
        cost_labor_dop REAL NOT NULL DEFAULT 0,
        total_dop REAL NOT NULL DEFAULT 0,
        shop TEXT NOT NULL DEFAULT '',
        warranty_until_date TEXT, warranty_until_km REAL,
        source_inspection_id TEXT,
        source_task_id TEXT,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, synced_at TEXT
      )`,
      `CREATE INDEX idx_service_vehicle_time ON service_record(vehicle_id, occurred_at)`,

      `CREATE TABLE service_record_item (
        id TEXT PRIMARY KEY NOT NULL,
        service_record_id TEXT NOT NULL REFERENCES service_record(id),
        service_type_id TEXT NOT NULL REFERENCES service_type(id),
        notes TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, synced_at TEXT
      )`,

      `CREATE TABLE part (
        id TEXT PRIMARY KEY NOT NULL,
        service_record_id TEXT NOT NULL REFERENCES service_record(id),
        name TEXT NOT NULL, part_number TEXT, brand TEXT, quantity REAL NOT NULL DEFAULT 1,
        unit_cost_dop REAL,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, synced_at TEXT
      )`,

      `CREATE TABLE expense (
        id TEXT PRIMARY KEY NOT NULL,
        vehicle_id TEXT NOT NULL REFERENCES vehicle(id),
        occurred_at TEXT NOT NULL,
        odometer_km REAL,
        category TEXT NOT NULL,
        amount_dop REAL NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        vendor TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, synced_at TEXT
      )`,
      `CREATE INDEX idx_expense_vehicle_time ON expense(vehicle_id, occurred_at)`,

      `CREATE TABLE reminder (
        id TEXT PRIMARY KEY NOT NULL,
        vehicle_id TEXT NOT NULL REFERENCES vehicle(id),
        title TEXT NOT NULL,
        service_type_id TEXT,
        legal_kind TEXT,
        metric TEXT NOT NULL,
        due_date TEXT, due_km REAL,
        is_recurring INTEGER NOT NULL DEFAULT 0,
        interval_months INTEGER, interval_days INTEGER, interval_km INTEGER,
        fixed_interval INTEGER NOT NULL DEFAULT 0,
        threshold_days INTEGER, threshold_km INTEGER,
        notes TEXT NOT NULL DEFAULT '',
        last_completed_at TEXT, last_completed_km REAL, last_completed_record_id TEXT,
        snoozed_until TEXT,
        is_enabled INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, synced_at TEXT
      )`,
      `CREATE INDEX idx_reminder_vehicle ON reminder(vehicle_id)`,

      `CREATE TABLE inspection_template (
        id TEXT PRIMARY KEY NOT NULL,
        vehicle_id TEXT,
        name TEXT NOT NULL,
        cadence TEXT NOT NULL,
        vehicle_type TEXT NOT NULL DEFAULT 'carro',
        is_seeded INTEGER NOT NULL DEFAULT 0,
        is_enabled INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, synced_at TEXT
      )`,

      `CREATE TABLE inspection_item (
        id TEXT PRIMARY KEY NOT NULL,
        template_id TEXT NOT NULL REFERENCES inspection_template(id),
        group_name TEXT NOT NULL,
        label TEXT NOT NULL,
        how TEXT NOT NULL DEFAULT '',
        warning TEXT NOT NULL DEFAULT '',
        requires_cold_engine INTEGER NOT NULL DEFAULT 0,
        on_fail TEXT NOT NULL DEFAULT 'task',
        related_service_type_id TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, synced_at TEXT
      )`,

      `CREATE TABLE inspection (
        id TEXT PRIMARY KEY NOT NULL,
        vehicle_id TEXT NOT NULL REFERENCES vehicle(id),
        template_id TEXT NOT NULL,
        occurred_at TEXT NOT NULL,
        odometer_km REAL,
        status TEXT NOT NULL,
        duration_sec INTEGER,
        notes TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, synced_at TEXT
      )`,
      `CREATE INDEX idx_inspection_vehicle_time ON inspection(vehicle_id, occurred_at)`,

      `CREATE TABLE inspection_result (
        id TEXT PRIMARY KEY NOT NULL,
        inspection_id TEXT NOT NULL REFERENCES inspection(id),
        item_id TEXT NOT NULL,
        label_snapshot TEXT NOT NULL,
        result TEXT NOT NULL,
        note TEXT NOT NULL DEFAULT '',
        media_id TEXT,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, synced_at TEXT
      )`,

      `CREATE TABLE task (
        id TEXT PRIMARY KEY NOT NULL,
        vehicle_id TEXT NOT NULL REFERENCES vehicle(id),
        title TEXT NOT NULL,
        kind TEXT NOT NULL DEFAULT 'reparacion',
        priority TEXT NOT NULL DEFAULT 'normal',
        status TEXT NOT NULL DEFAULT 'pendiente',
        estimated_cost_dop REAL,
        notes TEXT NOT NULL DEFAULT '',
        source_inspection_result_id TEXT,
        done_record_id TEXT,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, synced_at TEXT
      )`,

      `CREATE TABLE document (
        id TEXT PRIMARY KEY NOT NULL,
        vehicle_id TEXT NOT NULL REFERENCES vehicle(id),
        kind TEXT NOT NULL,
        title TEXT NOT NULL,
        issued_at TEXT, expires_at TEXT,
        reminder_id TEXT,
        media_id TEXT,
        notes TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, synced_at TEXT
      )`,

      `CREATE TABLE media (
        id TEXT PRIMARY KEY NOT NULL,
        owner_table TEXT NOT NULL, owner_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        mime TEXT NOT NULL,
        rel_path TEXT,
        blob BLOB,
        width INTEGER, height INTEGER, size_bytes INTEGER,
        remote_path TEXT,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, synced_at TEXT
      )`,
      `CREATE INDEX idx_media_owner ON media(owner_table, owner_id)`,

      `CREATE VIEW history_feed AS
        SELECT id, vehicle_id, 'combustible' AS kind, occurred_at, odometer_km,
               fuel_type AS title, station AS subtitle, total_dop AS amount_dop FROM fuel_log WHERE deleted_at IS NULL
        UNION ALL
        SELECT id, vehicle_id, kind, occurred_at, odometer_km, title, shop, total_dop FROM service_record WHERE deleted_at IS NULL
        UNION ALL
        SELECT id, vehicle_id, 'gasto', occurred_at, odometer_km, description, category, amount_dop FROM expense WHERE deleted_at IS NULL
        UNION ALL
        SELECT id, vehicle_id, 'chequeo', occurred_at, odometer_km, status, template_id, NULL FROM inspection WHERE deleted_at IS NULL`,
    ],
  },
];

export const LATEST_VERSION = MIGRATIONS[MIGRATIONS.length - 1].version;

/**
 * Applies every pending migration. Passed to `<SQLiteProvider onInit>`, so it
 * runs once per app launch before anything queries the database.
 *
 * The PRAGMAs are set outside the transaction on purpose: `journal_mode` cannot
 * change inside one, and `foreign_keys` is a per-connection setting rather than
 * a schema change.
 */
export async function migrate(db: SQLiteDatabase): Promise<void> {
  // WAL on native, MEMORY on web — and this is not a preference.
  //
  // expo-sqlite's web build stores the database in OPFS through wa-sqlite's
  // AccessHandlePoolVFS, which exposes no shared-memory (-shm) implementation.
  // WAL needs one, so under WAL the writes stay in a write-ahead log that is
  // never checkpointed back into the main file: everything reads correctly for
  // the rest of the session and is **silently gone after a reload**. That is
  // exactly what happened here before this line existed.
  //
  // getFirstAsync, not execAsync: `PRAGMA journal_mode = …` answers with a row
  // holding the mode it settled on. execAsync is for statements that return
  // nothing, and on the web build feeding it a row-producing statement fails
  // with "Error finalizing statement" — which surfaces as the database refusing
  // to open on the *second* launch, long after the line that caused it.
  await db.getFirstAsync(
    Platform.OS === 'web' ? 'PRAGMA journal_mode = MEMORY' : 'PRAGMA journal_mode = WAL',
  );
  await db.execAsync('PRAGMA foreign_keys = ON');

  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;

  for (const migration of MIGRATIONS) {
    if (migration.version <= current) continue;
    await db.withTransactionAsync(async () => {
      for (const statement of migration.up) {
        await db.execAsync(statement);
      }
    });
    // Outside the transaction: PRAGMA user_version does not accept a parameter
    // binding, and the value is a literal from our own array, never user input.
    await db.execAsync(`PRAGMA user_version = ${migration.version}`);
  }
}
