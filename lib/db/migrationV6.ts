import { historyFeedV4 } from './migrationV2';
import { GAL_L } from '../domain/units';

/**
 * Schema v6 (IMP 29092026, ADR-26 / ADR-33) — docs/imp-29092026/02-specs/01-data-model-v6.md.
 *
 * Every column and table this cycle needs, written once: vehicle units,
 * statuses and identity pickers; partial-fill gauge readings; oil details on a
 * service item; the vehicle gallery role on album items; trips (plus two
 * local-only tables); and volumes moved to liters.
 *
 * Two departures from the spec's statements, both on purpose:
 *
 * - **GNV is not converted.** It is logged in m³ (lib/fuel.ts, Phase 0 audit
 *   a); multiplying it by 3.785 would make every GNV fill-up nonsense.
 * - **Liters keep six decimals, not three.** An old fill-up is read back in
 *   gallons on every screen; ROUND(…, 3) moved its km/gal in the third decimal.
 *
 * The conversion is local only and does not mark rows for upload: the cloud
 * keeps gallons in the legacy columns and gets liters alongside from 2.2 pushes
 * (lib/sync/unitBridge.ts). A pull of an old row converts on the way in.
 */
const G = String(GAL_L);

export function migrationV6(): string[] {
  return [
    // 1.1 vehicle
    `ALTER TABLE vehicle ADD COLUMN volume_unit TEXT NOT NULL DEFAULT 'gal'`,
    `ALTER TABLE vehicle ADD COLUMN economy_unit TEXT NOT NULL DEFAULT 'km_gal'`,
    `ALTER TABLE vehicle ADD COLUMN reserve_volume_l REAL`,
    `ALTER TABLE vehicle ADD COLUMN tank_volume_entered REAL`,
    `ALTER TABLE vehicle ADD COLUMN status_note TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE vehicle ADD COLUMN status_since TEXT`,
    `ALTER TABLE vehicle ADD COLUMN body_type TEXT`,
    `ALTER TABLE vehicle ADD COLUMN color_id TEXT`,
    `ALTER TABLE vehicle ADD COLUMN interior_color_id TEXT`,
    `ALTER TABLE vehicle ADD COLUMN interior_material TEXT`,
    `ALTER TABLE vehicle ADD COLUMN make_id TEXT`,
    `ALTER TABLE vehicle ADD COLUMN model_id TEXT`,
    `ALTER TABLE vehicle ADD COLUMN limit_kmh INTEGER NOT NULL DEFAULT 120`,
    `ALTER TABLE vehicle ADD COLUMN trip_mode TEXT NOT NULL DEFAULT 'auto'`,

    // 1.2 the vehicle gallery is album items with role 'vehicle'
    `ALTER TABLE album_item ADD COLUMN role TEXT NOT NULL DEFAULT 'album'`,

    // 1.3 fuel: gauge readings for partial fills, and what was typed
    `ALTER TABLE fuel_log ADD COLUMN gauge_before_eighths INTEGER`,
    `ALTER TABLE fuel_log ADD COLUMN gauge_after_eighths INTEGER`,
    `ALTER TABLE fuel_log ADD COLUMN in_reserve INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE fuel_log ADD COLUMN volume_entered REAL`,
    `ALTER TABLE fuel_log ADD COLUMN volume_entered_unit TEXT`,

    // 1.4 trips
    `CREATE TABLE trip (
      id TEXT PRIMARY KEY NOT NULL,
      vehicle_id TEXT NOT NULL REFERENCES vehicle(id),
      source TEXT NOT NULL,
      status TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'conductor',
      started_at TEXT NOT NULL,
      ended_at TEXT,
      start_lat REAL, start_lng REAL, end_lat REAL, end_lng REAL,
      start_label TEXT NOT NULL DEFAULT '', end_label TEXT NOT NULL DEFAULT '',
      distance_m REAL NOT NULL DEFAULT 0,
      duration_s INTEGER NOT NULL DEFAULT 0,
      moving_s INTEGER NOT NULL DEFAULT 0,
      avg_kmh REAL, avg_moving_kmh REAL, max_kmh REAL,
      speed_buckets TEXT NOT NULL DEFAULT '[0,0,0,0,0]',
      polyline TEXT,
      bbox TEXT,
      segments INTEGER NOT NULL DEFAULT 1,
      odometer_reading_id TEXT,
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, synced_at TEXT
    )`,
    `CREATE INDEX trip_vehicle_started ON trip(vehicle_id, started_at DESC)`,
    // Local only, never synced; purged 30 days after the trip is done.
    `CREATE TABLE trip_point (
      trip_id TEXT NOT NULL REFERENCES trip(id) ON DELETE CASCADE,
      t INTEGER NOT NULL,
      lat REAL NOT NULL, lng REAL NOT NULL,
      speed REAL, acc REAL, alt REAL, heading REAL,
      PRIMARY KEY (trip_id, t)
    )`,
    // Local only: the background recorder's memory, one row with id 'state'.
    `CREATE TABLE trip_state (
      id TEXT PRIMARY KEY NOT NULL, json TEXT NOT NULL, updated_at TEXT NOT NULL
    )`,

    // 1.5 oil on a service item
    `ALTER TABLE service_record_item ADD COLUMN oil_viscosity TEXT`,
    `ALTER TABLE service_record_item ADD COLUMN oil_type TEXT`,
    `ALTER TABLE service_record_item ADD COLUMN oil_spec TEXT`,
    `ALTER TABLE service_record_item ADD COLUMN oil_brand TEXT`,

    // 1.6 units: keep what was typed, then liquid volumes to liters
    `UPDATE fuel_log SET volume_entered = volume,
            volume_entered_unit = CASE WHEN fuel_type = 'gnv' THEN 'm3' ELSE 'gal' END
      WHERE volume_entered IS NULL`,
    `UPDATE vehicle SET tank_volume_entered = tank_volume WHERE tank_volume_entered IS NULL`,
    `UPDATE fuel_log SET volume = ROUND(volume * ${G}, 6), price_per_unit = ROUND(price_per_unit / ${G}, 6)
      WHERE fuel_type <> 'gnv'`,
    `UPDATE vehicle SET tank_volume = ROUND(tank_volume * ${G}, 6)
      WHERE tank_volume IS NOT NULL AND default_fuel_type <> 'gnv'`,

    // 1.8 history_feed v5
    ...historyFeedV5(),
  ];
}

/**
 * v5 = v4 plus trips (kind 'viaje') and a tenth column, `photos`: the number
 * of photos on a check's results (null for every other kind).
 *
 * A trip row packs its numbers the way the other arms do: title = distance in
 * meters, subtitle = "<duration_s>|<start_label>|<end_label>"; lib/domain/
 * history.ts turns them into "Viaje · 12.4 km · 25 min". Status changes need
 * no arm: they are milestones of kind 'estado' and already show as 'hito'.
 */
export function historyFeedV5(): string[] {
  return historyFeedV4().map((sql) => {
    if (!sql.includes('CREATE VIEW history_feed')) return sql;
    const withPhotos = sql
      // Every arm but the check gets a NULL tenth column…
      .replace(/(FROM (fuel_log|service_record sr|expense|mod|milestone|track_event|vehicle_dtc_event) WHERE)/g, ', NULL AS photos $1')
      // …and the check counts the photos on its results.
      .replace(
        'status, template_id, NULL FROM inspection WHERE',
        `status, template_id, NULL,
                     (SELECT COUNT(*) FROM inspection_result r WHERE r.inspection_id = inspection.id
                        AND r.media_id IS NOT NULL AND r.deleted_at IS NULL) FROM inspection WHERE`,
      );
    return `${withPhotos}
    UNION ALL SELECT id, vehicle_id, 'viaje', started_at, created_at, NULL, CAST(distance_m AS TEXT),
                     duration_s || '|' || start_label || '|' || end_label, NULL, NULL
                FROM trip WHERE deleted_at IS NULL AND status = 'done'`;
  });
}
