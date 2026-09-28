/**
 * Migration v2 (IMP 28092026) against node's real SQLite.
 *
 * Two paths a device can take: a fresh install runs 0 → 2 in one go; an
 * existing v2.0.0 install already sits at v1 with a garage in it and runs only
 * v2. The second is the one that can lose data, so it runs on the Phase 0
 * fixture — Xaviel's four vehicles, a year of history, as a v2.0 backup.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { MOD_CATEGORIES, VENUES } from '@/lib/domain/catalog';
import { migrationV2Data } from '@/lib/db/migrationV2';
import { LATEST_VERSION, MIGRATIONS } from '@/lib/db/migrations';

type Row = Record<string, unknown>;

const fixture = JSON.parse(
  readFileSync(join(__dirname, '../../docs/imp-28092026/fixtures/car-guy-v2.0-backup.sample.json'), 'utf8'),
) as { tables: Record<string, Row[]> };

/** v1 parents first, so foreign keys hold while importing. */
const V1_ORDER = [
  'vehicle', 'vehicle_spec', 'odometer_reading', 'fuel_log', 'service_type', 'service_record',
  'service_record_item', 'part', 'expense', 'reminder', 'inspection_template', 'inspection_item',
  'inspection', 'inspection_result', 'task', 'document', 'media',
];

function run(db: DatabaseSync, statements: string[]) {
  db.exec('BEGIN');
  for (const sql of statements) db.exec(sql);
  db.exec('COMMIT');
}

function v1WithFixture(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  run(db, MIGRATIONS[0].up);
  for (const table of V1_ORDER) {
    for (const row of fixture.tables[table] ?? []) {
      const cols = Object.keys(row);
      db.prepare(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`).run(
        ...(cols.map((c) => row[c]) as never[]),
      );
    }
  }
  // Mark everything clean, as a device that had synced would be.
  for (const table of V1_ORDER) db.exec(`UPDATE ${table} SET synced_at = updated_at`);
  return db;
}

const all = (db: DatabaseSync, sql: string, ...p: string[]) => db.prepare(sql).all(...p) as Row[];
const count = (db: DatabaseSync, table: string) =>
  (db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;

describe('fresh install: 0 → 2', () => {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  for (const m of MIGRATIONS) run(db, m.up);

  it('is the latest version', () => {
    expect(LATEST_VERSION).toBe(4);
  });

  it('creates every v2 table', () => {
    const tables = new Set(all(db, "SELECT name FROM sqlite_master WHERE type = 'table'").map((r) => r.name));
    for (const t of [
      'vehicle_ownership', 'album_item', 'milestone', 'mod_category', 'mod', 'mod_media',
      'vehicle_specsheet', 'spec_snapshot', 'torque_spec', 'wishlist_item', 'inventory_item',
      'wheel_set', 'tire', 'dtc_code', 'vehicle_dtc_event', 'contact', 'fluid_guide_item', 'venue',
      'track_event', 'track_session', 'setup_sheet', 'consumable_usage', 'vehicle_share', 'vehicle_member',
    ]) {
      expect(tables).toContain(t);
    }
  });

  it('seeds the mod categories, the Autódromo and the DTC table', () => {
    expect(count(db, 'mod_category')).toBe(MOD_CATEGORIES.length);
    expect(count(db, 'venue')).toBe(VENUES.length);
    expect(all(db, "SELECT name FROM venue WHERE id = 'autodromo_americas'")[0].name).toMatch(/Sunix/);
    expect(count(db, 'dtc_code')).toBeGreaterThan(3000);
  });
});

describe('existing install: v1 with the v2.0 fixture → 2', () => {
  const db = v1WithFixture();
  const before = Object.fromEntries(V1_ORDER.map((t) => [t, count(db, t)]));
  const mejoras = all(db, "SELECT id FROM service_record WHERE kind = 'mejora' AND deleted_at IS NULL");
  run(db, MIGRATIONS[1].up);

  it('preserves every v1 row', () => {
    for (const t of V1_ORDER) expect(count(db, t)).toBe(before[t]);
  });

  it('gives every vehicle one ownership period and one ficha', () => {
    const vehicles = count(db, 'vehicle');
    expect(count(db, 'vehicle_ownership')).toBe(vehicles);
    expect(count(db, 'vehicle_specsheet')).toBe(vehicles);
    const [jetta] = all(db, "SELECT * FROM vehicle_ownership WHERE vehicle_id = 'dev_jetta'");
    expect(jetta.sold_at).toBe('2021-01-01');
    expect(jetta.acquired_at).toBe('2018-01-01');
  });

  it('derives status: sold → vendido, the rest stay activo', () => {
    const status = Object.fromEntries(all(db, 'SELECT id, status FROM vehicle').map((r) => [r.id, r.status]));
    expect(status.dev_jetta).toBe('vendido');
    expect(status.dev_ae85).toBe('activo');
    // Changed rows go up on the next sync; unchanged ones stay clean.
    const dirty = all(db, 'SELECT id FROM vehicle WHERE synced_at IS NULL').map((r) => r.id);
    expect(dirty).toEqual(['dev_jetta']);
  });

  it("turns every 'mejora' into a mod and keeps the record", () => {
    expect(mejoras.length).toBeGreaterThan(0);
    for (const { id } of mejoras) {
      const [mod] = all(db, 'SELECT * FROM mod WHERE service_record_id = ?', id as string);
      expect(mod).toBeDefined();
      expect(mod.id).toBe(`mod_${id}`);
      expect(mod.category_id).toBe('otro');
      expect(mod.status).toBe('instalado');
    }
  });

  it('history_feed shows the mod instead of its record, with created_at', () => {
    const kinds = all(db, "SELECT DISTINCT kind FROM history_feed WHERE vehicle_id = 'dev_ae85'").map((r) => r.kind);
    expect(kinds).toContain('mod');
    expect(kinds).not.toContain('mejora');
    const [row] = all(db, "SELECT created_at FROM history_feed WHERE kind = 'mod'");
    expect(row.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('keeps a new mejora record visible until the build log writes mods (PROMPT-04)', () => {
    db.prepare(
      `INSERT INTO service_record (id, vehicle_id, kind, occurred_at, title, created_at, updated_at)
       VALUES ('sr_new', 'dev_ds3', 'mejora', '2026-09-28T12:00:00.000Z', 'Bocinas', '2026-09-28T12:00:00.000Z', '2026-09-28T12:00:00.000Z')`,
    ).run();
    expect(all(db, "SELECT kind FROM history_feed WHERE id = 'sr_new'")).toEqual([{ kind: 'mejora' }]);
  });

  it('shows milestones and track days in the feed', () => {
    const at = '2025-08-01T12:00:00.000Z';
    db.prepare(
      `INSERT INTO milestone (id, vehicle_id, kind, occurred_at, title, created_at, updated_at)
       VALUES ('ms1', 'dev_ae85', 'swap', ?, 'Swap 4A-GE 20V', ?, ?)`,
    ).run(at, at, at);
    db.prepare(
      `INSERT INTO track_event (id, vehicle_id, venue_id, occurred_at, title, discipline, entry_fee_dop, created_at, updated_at)
       VALUES ('te1', 'dev_ae85', 'autodromo_americas', ?, 'Drift day', 'drift', 1500, ?, ?)`,
    ).run(at, at, at);
    const rows = all(db, "SELECT id, kind, amount_dop FROM history_feed WHERE id IN ('ms1', 'te1') ORDER BY id");
    expect(rows).toEqual([
      { id: 'ms1', kind: 'hito', amount_dop: null },
      { id: 'te1', kind: 'pista', amount_dop: 1500 },
    ]);
  });

});

describe('migration v2 data steps', () => {
  const migrated = () => {
    const db = v1WithFixture();
    run(db, MIGRATIONS[1].up);
    return db;
  };
  const TABLES = ['vehicle_ownership', 'mod', 'vehicle_specsheet', 'mod_category', 'venue'];

  it('are idempotent', () => {
    const db = migrated();
    const snapshot = TABLES.map((t) => count(db, t));
    run(db, migrationV2Data());
    run(db, migrationV2Data());
    expect(TABLES.map((t) => count(db, t))).toEqual(snapshot);
  });

  it('produce the same ids on two devices', () => {
    const a = migrated();
    const b = migrated();
    const ids = (d: DatabaseSync, t: string) => all(d, `SELECT id FROM ${t} ORDER BY id`).map((r) => r.id);
    for (const t of TABLES) expect(ids(b, t)).toEqual(ids(a, t));
  });
});
