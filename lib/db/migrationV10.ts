/**
 * Schema v10 (IMP 01102026 Phase 2, 02-specs/01-data-model-v10.md): every local column the cycle needs, once
 * (ADR-58). Groundwork only — no screen reads these until Phases 3, 5 and 6 turn their flags on.
 *
 * - §1 gauge (ADR-51): a vehicle says how its fuel gauge reads (needle in eighths, squares, percent) and
 *   carries its learned calibration; a fill-up stores the reading as a unit-less fraction + the raw text. The
 *   eighths columns stay, filled for needle gauges, so a 2.4.x phone syncing the same car keeps working.
 * - §2 sharing: `trip_share` (a trimmed copy of a trip the owner published) and `privacy_zone` (places never
 *   shown on a shared route) — synced, owner-only. `social_cache` is a read-only cache of the cloud's
 *   follow/block/counts (never pushed).
 * - §3 juntes: `junte_cache`, the last JSON the cloud answered per junte (never pushed). Live positions are
 *   never stored anywhere (conventions §3).
 *
 * Deviation, recorded in PROGRESS: history_feed v7 (junte rows) waits for Phase 6 — there is no local junte
 * table to list until then.
 */
export function migrationV10(): string[] {
  return [
    // §1 gauge — vehicle
    `ALTER TABLE vehicle ADD COLUMN gauge_type TEXT NOT NULL DEFAULT 'needle8'`,
    `ALTER TABLE vehicle ADD COLUMN gauge_segments INTEGER`,
    `ALTER TABLE vehicle ADD COLUMN gauge_reserve_at INTEGER`,
    `ALTER TABLE vehicle ADD COLUMN gauge_calibration TEXT`,
    // §1 gauge — fuel_log: fraction 0..1 + the reading as the person saw it ("4/9", "3/8", "45%")
    `ALTER TABLE fuel_log ADD COLUMN gauge_before_frac REAL`,
    `ALTER TABLE fuel_log ADD COLUMN gauge_after_frac REAL`,
    `ALTER TABLE fuel_log ADD COLUMN gauge_before_raw TEXT`,
    `ALTER TABLE fuel_log ADD COLUMN gauge_after_raw TEXT`,
    // Backfill from the eighths every 2.2–2.4 fill-up has (the eighths columns are kept).
    `UPDATE fuel_log SET gauge_before_frac = gauge_before_eighths / 8.0, gauge_before_raw = gauge_before_eighths || '/8'
       WHERE gauge_before_eighths IS NOT NULL`,
    `UPDATE fuel_log SET gauge_after_frac = gauge_after_eighths / 8.0, gauge_after_raw = gauge_after_eighths || '/8'
       WHERE gauge_after_eighths IS NOT NULL`,

    // §2 a trip the owner shared: the trimmed route only (ADR-56), never the raw points.
    `CREATE TABLE trip_share (
      id TEXT PRIMARY KEY NOT NULL,
      trip_id TEXT NOT NULL,
      visibility TEXT NOT NULL CHECK (visibility IN ('followers', 'friends', 'public')),
      polyline_trimmed TEXT NOT NULL,
      distance_m INTEGER,
      duration_s INTEGER,
      started_day TEXT,
      title TEXT,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, synced_at TEXT
    )`,
    `CREATE INDEX trip_share_trip ON trip_share(trip_id)`,
    `CREATE TABLE privacy_zone (
      id TEXT PRIMARY KEY NOT NULL,
      label TEXT,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      radius_m INTEGER NOT NULL DEFAULT 300,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, synced_at TEXT
    )`,
    // Read-only caches of cloud-only rows (follow/block/counts; juntes): JSON by key, never pushed.
    `CREATE TABLE social_cache (key TEXT PRIMARY KEY NOT NULL, json TEXT NOT NULL, updated_at TEXT NOT NULL)`,
    `CREATE TABLE junte_cache (id TEXT PRIMARY KEY NOT NULL, json TEXT NOT NULL, updated_at TEXT NOT NULL)`,
  ];
}
