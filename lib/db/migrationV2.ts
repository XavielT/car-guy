import dtcRows from '../domain/dtc.es.json';
import { MOD_CATEGORIES, VENUES } from '../domain/catalog';

/**
 * Migration v2 — every table of the IMP 28092026 cycle (ADR-17), written once.
 *
 * The DDL is docs/imp-28092026/02-specs/01-data-model-v2.md §1 verbatim, with
 * one deliberate difference in `history_feed` (see HISTORY_FEED_V2). The data
 * steps after it are idempotent and **deterministic**: derived rows get ids
 * built from their source (`own_<vehicle>`, `mod_<record>`, specsheet id =
 * vehicle id), so two devices that migrate the same synced garage produce the
 * same rows instead of two copies of each.
 *
 * Rows the migration changes or creates are left with `synced_at = NULL`, so the
 * next sync carries them to the cloud; `updated_at` is only stamped on rows
 * that are new, which keeps a device that has not migrated yet from being
 * overruled by a timestamp it never saw.
 */

/** ISO-8601 with milliseconds and Z, exactly how the app writes timestamps. */
const NOW = `strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`;

const quote = (value: string | number | null) =>
  value == null ? 'NULL' : typeof value === 'number' ? String(value) : `'${value.replace(/'/g, "''")}'`;

const DDL: string[] = [
  // ===== vehicle: identity, status, story =====
  `ALTER TABLE vehicle ADD COLUMN nickname TEXT`,
  `ALTER TABLE vehicle ADD COLUMN status TEXT NOT NULL DEFAULT 'activo'`,
  `ALTER TABLE vehicle ADD COLUMN chassis_code TEXT`,
  `ALTER TABLE vehicle ADD COLUMN chassis_number TEXT`,
  `ALTER TABLE vehicle ADD COLUMN engine_code TEXT`,
  `ALTER TABLE vehicle ADD COLUMN transmission TEXT`,
  `ALTER TABLE vehicle ADD COLUMN drivetrain TEXT`,
  `ALTER TABLE vehicle ADD COLUMN origin TEXT`,
  `ALTER TABLE vehicle ADD COLUMN imported_year INTEGER`,
  `ALTER TABLE vehicle ADD COLUMN story TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE vehicle ADD COLUMN hero_media_id TEXT`,
  `ALTER TABLE vehicle ADD COLUMN garage_role TEXT`,

  // ===== ownership periods (Ex vehicles) =====
  `CREATE TABLE vehicle_ownership (
    id TEXT PRIMARY KEY NOT NULL,
    vehicle_id TEXT NOT NULL REFERENCES vehicle(id),
    acquired_at TEXT, acquired_km REAL, acquired_price REAL, acquired_from TEXT,
    sold_at TEXT, sold_km REAL, sold_price REAL, sold_to TEXT, reason TEXT,
    is_current INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, synced_at TEXT
  )`,

  // ===== media: dates, thumbs =====
  `ALTER TABLE media ADD COLUMN taken_at TEXT`,
  `ALTER TABLE media ADD COLUMN date_precision TEXT NOT NULL DEFAULT 'day'`,
  `ALTER TABLE media ADD COLUMN source TEXT NOT NULL DEFAULT 'camera'`,
  `ALTER TABLE media ADD COLUMN remote_thumb_path TEXT`,
  `ALTER TABLE media ADD COLUMN thumb_rel_path TEXT`,
  `ALTER TABLE media ADD COLUMN thumb_blob BLOB`,
  `ALTER TABLE media ADD COLUMN blurhash TEXT`,
  `ALTER TABLE media ADD COLUMN caption TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE media ADD COLUMN is_favorite INTEGER NOT NULL DEFAULT 0`,
  `CREATE INDEX idx_media_taken ON media(owner_table, owner_id, taken_at)`,

  // ===== album + milestones =====
  `CREATE TABLE album_item (
    id TEXT PRIMARY KEY NOT NULL,
    vehicle_id TEXT NOT NULL REFERENCES vehicle(id),
    media_id TEXT NOT NULL,
    milestone_id TEXT, mod_id TEXT, track_event_id TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, synced_at TEXT
  )`,
  `CREATE INDEX idx_album_vehicle ON album_item(vehicle_id)`,
  `CREATE TABLE milestone (
    id TEXT PRIMARY KEY NOT NULL,
    vehicle_id TEXT NOT NULL REFERENCES vehicle(id),
    kind TEXT NOT NULL,
    occurred_at TEXT NOT NULL, odometer_km REAL,
    title TEXT NOT NULL, story TEXT NOT NULL DEFAULT '',
    cover_media_id TEXT,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, synced_at TEXT
  )`,

  // ===== build log =====
  `CREATE TABLE mod_category (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL, icon TEXT, sort_order INTEGER NOT NULL DEFAULT 0, is_seeded INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, synced_at TEXT
  )`,
  `CREATE TABLE mod (
    id TEXT PRIMARY KEY NOT NULL,
    vehicle_id TEXT NOT NULL REFERENCES vehicle(id),
    category_id TEXT NOT NULL,
    name TEXT NOT NULL, brand TEXT, part_number TEXT, variant TEXT,
    status TEXT NOT NULL DEFAULT 'instalado',
    installed_at TEXT, installed_km REAL, removed_at TEXT, removed_km REAL,
    installer_type TEXT NOT NULL DEFAULT 'yo',
    contact_id TEXT,
    cost_part_dop REAL NOT NULL DEFAULT 0, cost_labor_dop REAL NOT NULL DEFAULT 0,
    cost_shipping_dop REAL NOT NULL DEFAULT 0, cost_customs_dop REAL NOT NULL DEFAULT 0,
    price_foreign REAL, currency TEXT,
    fx_rate_to_dop REAL,
    vendor TEXT, vendor_url TEXT,
    replaces_mod_id TEXT,
    affects_specs INTEGER NOT NULL DEFAULT 0,
    spec_effects TEXT NOT NULL DEFAULT '{}',
    service_record_id TEXT,
    sold_price_dop REAL, sold_to TEXT,
    tags TEXT NOT NULL DEFAULT '[]',
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, synced_at TEXT
  )`,
  `CREATE INDEX idx_mod_vehicle ON mod(vehicle_id, status)`,
  `CREATE TABLE mod_media (
    id TEXT PRIMARY KEY NOT NULL,
    mod_id TEXT NOT NULL REFERENCES mod(id),
    media_id TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'foto',
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, synced_at TEXT
  )`,
  `CREATE TABLE vehicle_specsheet (
    id TEXT PRIMARY KEY NOT NULL,
    vehicle_id TEXT NOT NULL REFERENCES vehicle(id),
    preset_id TEXT,
    stock TEXT NOT NULL DEFAULT '{}',
    overrides TEXT NOT NULL DEFAULT '{}',
    field_sources TEXT NOT NULL DEFAULT '{}',
    verified_fields TEXT NOT NULL DEFAULT '[]',
    oil_capacity_l REAL, oil_capacity_filter_l REAL, oil_grade TEXT, oil_spec TEXT, oil_filter_pn TEXT,
    coolant_capacity_l REAL, coolant_type TEXT, trans_oil_l REAL, trans_oil_spec TEXT, diff_oil_l REAL, diff_oil_spec TEXT,
    brake_fluid TEXT, ps_fluid TEXT, spark_plug_pn TEXT, plug_gap_mm REAL, battery_spec TEXT,
    tire_size_oem_f TEXT, tire_size_oem_r TEXT, psi_oem_f REAL, psi_oem_r REAL,
    bolt_pattern TEXT, center_bore_mm REAL, lug_torque_nm REAL, lug_thread TEXT,
    fuel_tank_l REAL, fuel_octane INTEGER,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, synced_at TEXT
  )`,
  `CREATE TABLE spec_snapshot (
    id TEXT PRIMARY KEY NOT NULL,
    vehicle_id TEXT NOT NULL REFERENCES vehicle(id),
    label TEXT NOT NULL, as_of TEXT NOT NULL, specs TEXT NOT NULL DEFAULT '{}', cover_media_id TEXT,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, synced_at TEXT
  )`,
  `CREATE TABLE torque_spec (
    id TEXT PRIMARY KEY NOT NULL,
    vehicle_id TEXT NOT NULL REFERENCES vehicle(id),
    item TEXT NOT NULL, value_nm REAL NOT NULL, stage TEXT, source TEXT, media_id TEXT, notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, synced_at TEXT
  )`,
  `CREATE TABLE wishlist_item (
    id TEXT PRIMARY KEY NOT NULL,
    vehicle_id TEXT NOT NULL REFERENCES vehicle(id),
    category_id TEXT, name TEXT NOT NULL, brand TEXT, part_number TEXT,
    priority INTEGER NOT NULL DEFAULT 2,
    est_price_foreign REAL, currency TEXT, est_shipping_dop REAL, est_customs_dop REAL, est_total_dop REAL,
    url TEXT, vendor TEXT, target_date TEXT,
    status TEXT NOT NULL DEFAULT 'idea',
    converted_mod_id TEXT, notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, synced_at TEXT
  )`,
  `CREATE TABLE inventory_item (
    id TEXT PRIMARY KEY NOT NULL,
    owner_vehicle_id TEXT,
    kind TEXT NOT NULL,
    name TEXT NOT NULL, brand TEXT, part_number TEXT, qty REAL NOT NULL DEFAULT 1, unit TEXT,
    condition TEXT NOT NULL DEFAULT 'usado',
    location TEXT, cost_dop REAL, acquired_at TEXT,
    fits_vehicle_ids TEXT NOT NULL DEFAULT '[]', media_id TEXT, notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, synced_at TEXT
  )`,
  `CREATE TABLE wheel_set (
    id TEXT PRIMARY KEY NOT NULL,
    vehicle_id TEXT NOT NULL REFERENCES vehicle(id),
    name TEXT NOT NULL, brand TEXT, model TEXT,
    width_in REAL, diam_in INTEGER, offset_mm INTEGER, bolt_pattern TEXT, center_bore_mm REAL,
    qty INTEGER NOT NULL DEFAULT 4, position_pref TEXT NOT NULL DEFAULT 'any',
    status TEXT NOT NULL DEFAULT 'montado',
    media_id TEXT, notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, synced_at TEXT
  )`,
  `CREATE TABLE tire (
    id TEXT PRIMARY KEY NOT NULL,
    vehicle_id TEXT NOT NULL REFERENCES vehicle(id),
    wheel_set_id TEXT,
    brand TEXT, model TEXT, size TEXT,
    width_mm INTEGER, aspect INTEGER, rim_in INTEGER, load_index TEXT, speed_rating TEXT,
    dot_code TEXT, dot_week INTEGER, dot_year INTEGER, compound TEXT, treadwear INTEGER,
    position TEXT NOT NULL DEFAULT 'unmounted',
    tread_mm_new REAL, tread_mm_current REAL, heat_cycles INTEGER NOT NULL DEFAULT 0,
    purchased_at TEXT, cost_dop REAL,
    status TEXT NOT NULL DEFAULT 'en_uso',
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, synced_at TEXT
  )`,

  // ===== DIY =====
  `CREATE TABLE dtc_code (
    code TEXT PRIMARY KEY NOT NULL, system TEXT NOT NULL, desc_en TEXT NOT NULL, desc_es TEXT NOT NULL,
    is_generic INTEGER NOT NULL DEFAULT 1
  )`,
  `CREATE TABLE vehicle_dtc_event (
    id TEXT PRIMARY KEY NOT NULL,
    vehicle_id TEXT NOT NULL REFERENCES vehicle(id),
    code TEXT NOT NULL, seen_at TEXT NOT NULL, odometer_km REAL, cleared_at TEXT,
    repair_record_id TEXT, notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, synced_at TEXT
  )`,
  `CREATE TABLE contact (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL, kind TEXT NOT NULL,
    phone TEXT, whatsapp TEXT, address TEXT, notes TEXT NOT NULL DEFAULT '', rating INTEGER,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, synced_at TEXT
  )`,
  `ALTER TABLE service_record ADD COLUMN contact_id TEXT`,
  `CREATE TABLE fluid_guide_item (
    id TEXT PRIMARY KEY NOT NULL,
    vehicle_id TEXT NOT NULL REFERENCES vehicle(id),
    kind TEXT NOT NULL,
    media_id TEXT, how TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '', sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, synced_at TEXT
  )`,

  // ===== track =====
  `CREATE TABLE venue (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL, city TEXT, type TEXT NOT NULL DEFAULT 'circuito',
    layout TEXT, length_m INTEGER, lat REAL, lng REAL, is_seeded INTEGER NOT NULL DEFAULT 0, notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, synced_at TEXT
  )`,
  `CREATE TABLE track_event (
    id TEXT PRIMARY KEY NOT NULL,
    vehicle_id TEXT NOT NULL REFERENCES vehicle(id),
    venue_id TEXT, occurred_at TEXT NOT NULL, title TEXT NOT NULL DEFAULT '', organizer TEXT,
    discipline TEXT NOT NULL DEFAULT 'drift',
    weather TEXT, ambient_c REAL, track_temp_c REAL, track_condition TEXT,
    odometer_start_km REAL, odometer_end_km REAL,
    entry_fee_dop REAL, fuel_cost_dop REAL, other_cost_dop REAL,
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, synced_at TEXT
  )`,
  `CREATE TABLE track_session (
    id TEXT PRIMARY KEY NOT NULL,
    event_id TEXT NOT NULL REFERENCES track_event(id),
    seq INTEGER NOT NULL, kind TEXT NOT NULL DEFAULT 'practica',
    started_at TEXT, duration_min INTEGER, laps INTEGER, runs INTEGER,
    best_lap_ms INTEGER, second_best_ms INTEGER, sectors_ms TEXT NOT NULL DEFAULT '[]',
    zero_100_ms INTEGER, quarter_mile_ms INTEGER, quarter_mile_trap_kmh REAL, sixty_foot_ms INTEGER,
    fuel_load_l REAL, ballast_kg REAL, driver TEXT, passenger INTEGER NOT NULL DEFAULT 0,
    car_feel TEXT, rating INTEGER, notes TEXT NOT NULL DEFAULT '', incident TEXT, video_url TEXT,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, synced_at TEXT
  )`,
  `CREATE TABLE setup_sheet (
    id TEXT PRIMARY KEY NOT NULL,
    session_id TEXT NOT NULL REFERENCES track_session(id),
    tire_set_f_id TEXT, tire_set_r_id TEXT,
    psi_cold_fl REAL, psi_cold_fr REAL, psi_cold_rl REAL, psi_cold_rr REAL,
    psi_hot_fl REAL, psi_hot_fr REAL, psi_hot_rl REAL, psi_hot_rr REAL,
    camber_fl REAL, camber_fr REAL, camber_rl REAL, camber_rr REAL,
    toe_f_mm REAL, toe_r_mm REAL, caster_l REAL, caster_r REAL,
    rh_fl_mm REAL, rh_fr_mm REAL, rh_rl_mm REAL, rh_rr_mm REAL,
    spring_f REAL, spring_r REAL, spring_unit TEXT NOT NULL DEFAULT 'kgf_mm',
    bump_f INTEGER, rebound_f INTEGER, bump_r INTEGER, rebound_r INTEGER, clicks_total INTEGER,
    swaybar_f TEXT, swaybar_r TEXT, pad_f TEXT, pad_r TEXT, brake_bias TEXT,
    steering_angle_deg REAL, hydro INTEGER NOT NULL DEFAULT 0, lsd_type TEXT, lsd_preload TEXT,
    tire_size_f TEXT, tire_size_r TEXT, compound_f TEXT, compound_r TEXT, two_step_rpm INTEGER, rev_limit_rpm INTEGER,
    changed_from_previous TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, synced_at TEXT
  )`,
  `CREATE TABLE consumable_usage (
    id TEXT PRIMARY KEY NOT NULL,
    event_id TEXT NOT NULL, session_id TEXT, tire_id TEXT, wheel_set_id TEXT,
    kind TEXT NOT NULL,
    qty REAL, unit TEXT, pad_thickness_mm REAL, tread_mm REAL, notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, synced_at TEXT
  )`,

  // ===== sharing =====
  `CREATE TABLE vehicle_share (
    id TEXT PRIMARY KEY NOT NULL,
    vehicle_id TEXT NOT NULL REFERENCES vehicle(id),
    slug TEXT, visibility TEXT NOT NULL DEFAULT 'private',
    show_plate INTEGER NOT NULL DEFAULT 0, show_vin INTEGER NOT NULL DEFAULT 0, show_costs INTEGER NOT NULL DEFAULT 0,
    show_location INTEGER NOT NULL DEFAULT 0, show_odometer INTEGER NOT NULL DEFAULT 1,
    show_maintenance INTEGER NOT NULL DEFAULT 1, show_mods INTEGER NOT NULL DEFAULT 1,
    show_track INTEGER NOT NULL DEFAULT 1, show_docs INTEGER NOT NULL DEFAULT 0, show_story INTEGER NOT NULL DEFAULT 1,
    og_media_id TEXT, published_at TEXT, revoked_at TEXT,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, synced_at TEXT
  )`,
  `CREATE TABLE vehicle_member (
    id TEXT PRIMARY KEY NOT NULL,
    vehicle_id TEXT NOT NULL, user_id TEXT NOT NULL, role TEXT NOT NULL, display_name TEXT,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, synced_at TEXT
  )`,
];

/**
 * The spec's view with one change: a `mejora` service record is hidden only
 * when a live mod stands for it.
 *
 * The spec drops every `mejora` row because migration v2 turns each into a mod,
 * which then appears as kind `mod`. But until PROMPT-04 makes the "Mejora" kind
 * create a mod, the v2.0 forms still write plain `mejora` records — and hiding
 * all of them would make every new one vanish from Historial the moment it was
 * saved. Hidden only when it has a mod, each improvement shows exactly once.
 */
/**
 * v3 (IMP 28092026 Phase 4): the same view, with a mod row's subtitle as
 * "<status>|<brand>" so Historial can say Instalado / Quitado. The view is
 * local-only — no cloud change, nothing to sync.
 */
export function historyFeedV3(): string[] {
  return HISTORY_FEED_V2.map((sql) =>
    sql.replace(
      "installed_km, name, brand,",
      "installed_km, name, status || '|' || COALESCE(brand, ''),",
    ),
  );
}

/**
 * v4 (IMP 28092026 Phase 5): v3 plus OBD codes as a subtle 'obd' row — title
 * the code, subtitle abierto/resuelto. Still local-only.
 */
export function historyFeedV4(): string[] {
  return historyFeedV3().map((sql) =>
    sql.includes('CREATE VIEW history_feed')
      ? `${sql}
    UNION ALL SELECT id, vehicle_id, 'obd', seen_at, created_at, odometer_km, code,
                     CASE WHEN cleared_at IS NULL THEN 'abierto' ELSE 'resuelto' END, NULL FROM vehicle_dtc_event WHERE deleted_at IS NULL`
      : sql,
  );
}

const HISTORY_FEED_V2 = [
  `DROP VIEW IF EXISTS history_feed`,
  `CREATE VIEW history_feed AS
    SELECT id, vehicle_id, 'combustible' AS kind, occurred_at, created_at, odometer_km, fuel_type AS title, station AS subtitle, total_dop AS amount_dop FROM fuel_log WHERE deleted_at IS NULL
    UNION ALL SELECT id, vehicle_id, kind, occurred_at, created_at, odometer_km, title, shop, total_dop FROM service_record sr WHERE deleted_at IS NULL
      AND NOT (kind = 'mejora' AND EXISTS (SELECT 1 FROM mod m WHERE m.service_record_id = sr.id AND m.deleted_at IS NULL))
    UNION ALL SELECT id, vehicle_id, 'gasto', occurred_at, created_at, odometer_km, description, category, amount_dop FROM expense WHERE deleted_at IS NULL
    UNION ALL SELECT id, vehicle_id, 'chequeo', occurred_at, created_at, odometer_km, status, template_id, NULL FROM inspection WHERE deleted_at IS NULL
    UNION ALL SELECT id, vehicle_id, 'mod', COALESCE(installed_at, created_at), created_at, installed_km, name, brand,
                     cost_part_dop + cost_labor_dop + cost_shipping_dop + cost_customs_dop FROM mod WHERE deleted_at IS NULL AND status IN ('instalado','quitado','vendido','danado')
    UNION ALL SELECT id, vehicle_id, 'hito', occurred_at, created_at, odometer_km, title, kind, NULL FROM milestone WHERE deleted_at IS NULL
    UNION ALL SELECT id, vehicle_id, 'pista', occurred_at, created_at, odometer_start_km, title, discipline,
                     COALESCE(entry_fee_dop,0)+COALESCE(fuel_cost_dop,0)+COALESCE(other_cost_dop,0) FROM track_event WHERE deleted_at IS NULL`,
];

/** Seeded catalogues. Timestamps only on insert; an existing row is left alone. */
function seedStatements(): string[] {
  const categories = MOD_CATEGORIES.map(
    (c, i) => `(${quote(c.id)}, ${quote(c.name)}, ${quote(c.icon)}, ${i}, 1, ${NOW}, ${NOW})`,
  ).join(',\n');
  const venues = VENUES.map(
    (v) => `(${quote(v.id)}, ${quote(v.name)}, ${quote(v.city)}, ${quote(v.type)}, 1, ${NOW}, ${NOW})`,
  ).join(',\n');
  return [
    `INSERT OR IGNORE INTO mod_category (id, name, icon, sort_order, is_seeded, created_at, updated_at) VALUES\n${categories}`,
    `INSERT OR IGNORE INTO venue (id, name, city, type, is_seeded, created_at, updated_at) VALUES\n${venues}`,
  ];
}

type DtcRow = { code: string; system: string; descEn: string; descEs: string; isGeneric: number | boolean };

/**
 * The bundled DTC table (lib/domain/dtc.es.json, MIT — see LICENSE-mytrile.txt),
 * in chunks: one statement per 500 rows keeps each well under SQLite's limits.
 * INSERT OR REPLACE, so a later migration can re-run it with a newer file.
 */
export function dtcStatements(rows: DtcRow[] = dtcRows as DtcRow[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < rows.length; i += 500) {
    const values = rows
      .slice(i, i + 500)
      .map((r) => `(${quote(r.code)}, ${quote(r.system)}, ${quote(r.descEn)}, ${quote(r.descEs)}, ${r.isGeneric ? 1 : 0})`)
      .join(',\n');
    out.push(`INSERT OR REPLACE INTO dtc_code (code, system, desc_en, desc_es, is_generic) VALUES\n${values}`);
  }
  return out;
}

/** 01-data-model-v2.md §1 "Data migration inside v2". */
const DATA: string[] = [
  // Status from what v1 knew. Only rows whose status actually changes are
  // marked for upload; everyone else already matches the cloud default.
  `UPDATE vehicle SET
     status = CASE WHEN sold_date IS NOT NULL THEN 'vendido' ELSE 'guardado' END,
     synced_at = NULL
   WHERE status = 'activo' AND (sold_date IS NOT NULL OR is_archived = 1)`,

  // One ownership period per vehicle, mirroring purchase/sold.
  `INSERT OR IGNORE INTO vehicle_ownership
     (id, vehicle_id, acquired_at, acquired_price, sold_at, sold_price, is_current, created_at, updated_at, deleted_at)
   SELECT 'own_' || id, id, purchase_date, purchase_price, sold_date, sold_price, 1, ${NOW}, ${NOW}, NULL
   FROM vehicle WHERE deleted_at IS NULL`,

  // Every v2.0 "mejora" becomes a mod; the record stays as the cost/history entry.
  `INSERT OR IGNORE INTO mod
     (id, vehicle_id, category_id, name, status, installed_at, installed_km,
      installer_type, cost_part_dop, cost_labor_dop, service_record_id, notes, created_at, updated_at, deleted_at)
   SELECT 'mod_' || id, vehicle_id, 'otro', title, 'instalado', occurred_at, odometer_km,
          CASE WHEN shop <> '' THEN 'taller' ELSE 'yo' END, cost_parts_dop, cost_labor_dop, id, description,
          ${NOW}, ${NOW}, NULL
   FROM service_record WHERE kind = 'mejora' AND deleted_at IS NULL`,

  // An empty ficha per vehicle (1:1, id = vehicle id).
  `INSERT OR IGNORE INTO vehicle_specsheet (id, vehicle_id, created_at, updated_at)
   SELECT id, id, ${NOW}, ${NOW} FROM vehicle WHERE deleted_at IS NULL`,
];

/** The data steps alone — exported so a test can prove they are idempotent. */
export function migrationV2Data(): string[] {
  return [...seedStatements(), ...DATA];
}

export function migrationV2(): string[] {
  return [...DDL, ...migrationV2Data(), ...HISTORY_FEED_V2, ...dtcStatements()];
}
