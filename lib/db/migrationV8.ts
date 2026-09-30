import type { SQLiteDatabase } from 'expo-sqlite';

import { historyFeedV5 } from './migrationV6';
import { parseWeekLabel } from '../domain/fuelPrices';
import { id as newId } from '../format';

/**
 * Schema v8 (IMP 30092026, ADR-38) — docs/imp-30092026/02-specs/01-data-model-v8.md.
 *
 * Every table and column the 2.4 cycle needs, written once: the user's fuel
 * price history and the MICM cache, events on milestones, the car's memory
 * ("what I buy" + free facts), legal acceptance, the dossier's tires switch,
 * trip diagnostics and a per-point purge date. No screen reads most of it yet;
 * the flags in lib/flags.ts keep the new surfaces off.
 *
 * v7 is 2.2.1's (inventory → mod, dossier status/costs); nothing numbered 8
 * shipped before this.
 */

/** How long a trip's raw points stay on the phone after the trip ends (lib/db/tripOps.ts). */
const KEEP_DAYS = 30;

export function migrationV8(): string[] {
  return [
    // 1.1 fuel prices — the user's own history (synced) …
    `CREATE TABLE fuel_price (
      id TEXT PRIMARY KEY NOT NULL,
      fuel_type TEXT NOT NULL,
      price REAL NOT NULL,
      valid_from TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'manual',
      station TEXT NOT NULL DEFAULT '',
      note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, synced_at TEXT
    )`,
    `CREATE INDEX fuel_price_type_from ON fuel_price(fuel_type, valid_from DESC)`,
    // … and the local cache of the cloud's MICM rows (pull-only, never pushed, not in SYNC_TABLES).
    `CREATE TABLE fuel_price_ref (
      id TEXT PRIMARY KEY NOT NULL,
      fuel_type TEXT NOT NULL,
      price REAL NOT NULL,
      week_start TEXT NOT NULL,
      week_end TEXT NOT NULL,
      pdf_url TEXT,
      imported_at TEXT NOT NULL,
      stale INTEGER NOT NULL DEFAULT 0
    )`,

    // 1.2 events live on milestone
    `ALTER TABLE milestone ADD COLUMN event_type TEXT NOT NULL DEFAULT 'hito'`,
    `ALTER TABLE milestone ADD COLUMN severity TEXT`,
    `ALTER TABLE milestone ADD COLUMN cost_dop REAL`,
    `ALTER TABLE milestone ADD COLUMN pending TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE milestone ADD COLUMN resolved_at TEXT`,
    `ALTER TABLE milestone ADD COLUMN linked_service_id TEXT`,
    `ALTER TABLE milestone ADD COLUMN linked_mod_id TEXT`,
    `ALTER TABLE milestone ADD COLUMN linked_inspection_id TEXT`,
    `ALTER TABLE milestone ADD COLUMN location_label TEXT NOT NULL DEFAULT ''`,
    // Local only, like the v6 unit conversion: the cloud's sql/025 backfills its own copy.
    `UPDATE milestone SET event_type = 'accidente', severity = 'moderado' WHERE kind = 'accidente' AND event_type = 'hito'`,

    // 1.3 the car's memory: what I actually buy …
    `ALTER TABLE vehicle_specsheet ADD COLUMN oil_brand TEXT`,
    `ALTER TABLE vehicle_specsheet ADD COLUMN oil_product TEXT`,
    `ALTER TABLE vehicle_specsheet ADD COLUMN oil_filter_brand TEXT`,
    `ALTER TABLE vehicle_specsheet ADD COLUMN air_filter_pn TEXT`,
    `ALTER TABLE vehicle_specsheet ADD COLUMN cabin_filter_pn TEXT`,
    `ALTER TABLE vehicle_specsheet ADD COLUMN fuel_filter_pn TEXT`,
    `ALTER TABLE vehicle_specsheet ADD COLUMN wiper_sizes TEXT`,
    `ALTER TABLE vehicle_specsheet ADD COLUMN bulb_low TEXT`,
    `ALTER TABLE vehicle_specsheet ADD COLUMN bulb_high TEXT`,
    `ALTER TABLE vehicle_specsheet ADD COLUMN tire_current_f TEXT`,
    `ALTER TABLE vehicle_specsheet ADD COLUMN tire_current_r TEXT`,
    `ALTER TABLE vehicle_specsheet ADD COLUMN battery_brand TEXT`,
    `ALTER TABLE vehicle_specsheet ADD COLUMN where_bought TEXT NOT NULL DEFAULT ''`,
    // … and anything else, key/value.
    `CREATE TABLE vehicle_fact (
      id TEXT PRIMARY KEY NOT NULL,
      vehicle_id TEXT NOT NULL REFERENCES vehicle(id),
      label TEXT NOT NULL,
      value TEXT NOT NULL,
      group_name TEXT NOT NULL DEFAULT 'otros',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, synced_at TEXT
    )`,
    `CREATE INDEX vehicle_fact_vehicle ON vehicle_fact(vehicle_id, group_name, sort_order)`,

    // 1.5 legal
    `CREATE TABLE legal_acceptance (
      id TEXT PRIMARY KEY NOT NULL,
      version TEXT NOT NULL,
      accepted_at TEXT NOT NULL,
      locale TEXT NOT NULL,
      platform TEXT NOT NULL,
      device_id TEXT NOT NULL,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, synced_at TEXT
    )`,

    // 1.6 the public page's tires block (sql/025 public_dossier)
    `ALTER TABLE vehicle_share ADD COLUMN show_tires INTEGER NOT NULL DEFAULT 0`,

    // 1.7 trips: what finalize saw (JSON), and when each raw point may go
    `ALTER TABLE trip ADD COLUMN diagnostics TEXT`,
    `ALTER TABLE trip_point ADD COLUMN keep_until TEXT`,
    `UPDATE trip_point SET keep_until = (
       SELECT strftime('%Y-%m-%dT%H:%M:%fZ', COALESCE(t2.ended_at, t2.started_at), '+${KEEP_DAYS} days')
         FROM trip t2 WHERE t2.id = trip_point.trip_id)
     WHERE keep_until IS NULL`,

    // history_feed v6: events
    ...historyFeedV6(),
  ];
}

/**
 * v6 = v5 with the milestone arm split: `event_type = 'hito'` stays a 'hito'
 * row exactly as before; any other event type is an 'evento' row whose
 * subtitle packs `kind|event_type|severity|pending|resolved_at` and whose
 * amount is the event's cost. lib/domain/history.ts unpacks it; while
 * FEATURE_EVENTS is off the repo folds 'evento' back into 'hito' (same
 * subtitle, no amount), so Historial reads as it did in 2.3.
 */
export function historyFeedV6(): string[] {
  // v5's arm, as historyFeedV5 wrote it (its ", NULL AS photos" insert leaves "NULL , NULL").
  const hitoArm =
    /UNION ALL SELECT id, vehicle_id, 'hito', occurred_at, created_at, odometer_km, title, kind, NULL\s*, NULL AS photos FROM milestone WHERE deleted_at IS NULL/;
  return historyFeedV5().map((sql) => {
    if (!sql.includes('CREATE VIEW history_feed')) return sql;
    if (!hitoArm.test(sql)) throw new Error('history_feed v6: the v5 milestone arm moved');
    return sql.replace(
      hitoArm,
      `UNION ALL SELECT id, vehicle_id, 'hito', occurred_at, created_at, odometer_km, title, kind, NULL, NULL AS photos
                FROM milestone WHERE deleted_at IS NULL AND event_type = 'hito'
    UNION ALL SELECT id, vehicle_id, 'evento', occurred_at, created_at, odometer_km, title,
                     kind || '|' || event_type || '|' || COALESCE(severity, '') || '|' || pending || '|' || COALESCE(resolved_at, ''),
                     cost_dop, NULL
                FROM milestone WHERE deleted_at IS NULL AND event_type <> 'hito'`,
    );
  });
}

/**
 * 2.3's price settings → `fuel_price`, but only while this database has no price
 * row of its own: a restore of a 2.3 backup, or a first sync that pulled a 2.3
 * device's settings. Once any row exists the settings are history.
 */
export async function adoptLegacyPrices(db: SQLiteDatabase): Promise<void> {
  const own = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM fuel_price WHERE deleted_at IS NULL');
  if (!own?.n) await migrateV8Data(db);
}

type ReferencePricesSetting = Record<string, number>;

/**
 * The data half of v8, run inside the same transaction as the statements:
 * 2.3's two price settings become one `fuel_price` row per fuel, source
 * 'manual', dated by the week label ("15–21 ago 2026 (MICM)" → 2026-08-15;
 * unreadable → today). The label itself is kept in the row's note so the
 * board shows the same text as before. The settings rows stay (old backups and
 * 2.3 devices still read them); the store no longer does.
 */
export async function migrateV8Data(db: SQLiteDatabase, today = new Date()): Promise<void> {
  const rows = await db.getAllAsync<{ key: string; value: string }>(
    `SELECT key, value FROM setting WHERE key IN ('reference_prices', 'price_week_label')`,
  );
  const byKey = new Map(rows.map((r) => [r.key, r.value]));
  const rawPrices = byKey.get('reference_prices');
  if (!rawPrices) return;

  let prices: ReferencePricesSetting;
  let label = '';
  try {
    prices = JSON.parse(rawPrices) as ReferencePricesSetting;
    const rawLabel = byKey.get('price_week_label');
    if (rawLabel) label = String(JSON.parse(rawLabel) ?? '');
  } catch {
    return;
  }
  if (!prices || typeof prices !== 'object') return;

  const validFrom = parseWeekLabel(label, today);
  const stamp = today.toISOString();
  for (const [fuelType, price] of Object.entries(prices)) {
    if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0) continue;
    await db.runAsync(
      `INSERT INTO fuel_price (id, fuel_type, price, valid_from, source, station, note, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'manual', '', ?, ?, ?)`,
      [newId(), fuelType, price, validFrom, label, stamp, stamp],
    );
  }
}
