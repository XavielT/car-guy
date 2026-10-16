/**
 * Migration v11 (IMP 16102026 Phase 1, N5): vehicle.oil_synthetic, against node's real SQLite.
 * A 2.5.x database upgrades; the vehicles already running synthetic intervals come out marked.
 */
import { DatabaseSync } from 'node:sqlite';

import { LATEST_VERSION, MIGRATIONS } from '@/lib/db/migrations';

const T = '2026-10-01T12:00:00.000Z';

function v10Database(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  for (const m of MIGRATIONS.filter((m) => m.version <= 10)) {
    db.exec('BEGIN');
    for (const sql of m.up) db.exec(sql);
    db.exec('COMMIT');
  }
  return db;
}

const vehicle = (db: DatabaseSync, id: string) =>
  db.prepare(`INSERT INTO vehicle (id, name, default_fuel_type, created_at, updated_at, synced_at) VALUES (?, ?, 'regular', ?, ?, ?)`).run(id, id, T, T, T);

function oilReminder(db: DatabaseSync, vehicleId: string, over: { km?: number; months?: number; notes?: string; deleted?: boolean }) {
  db.prepare(
    `INSERT INTO reminder (id, vehicle_id, title, service_type_id, metric, is_recurring, interval_km, interval_months, notes, created_at, updated_at, deleted_at)
     VALUES (?, ?, 'Aceite de motor y filtro', 'aceite_motor', 'both', 1, ?, ?, ?, ?, ?, ?)`,
  ).run(`r_${vehicleId}`, vehicleId, over.km ?? 5000, over.months ?? 6, over.notes ?? '', T, T, over.deleted ? T : null);
}

function upgrade(db: DatabaseSync) {
  const v11 = MIGRATIONS.find((m) => m.version === 11)!;
  db.exec('BEGIN');
  for (const sql of v11.up) db.exec(sql);
  db.exec('COMMIT');
}

const flag = (db: DatabaseSync, id: string) => (db.prepare('SELECT oil_synthetic AS s FROM vehicle WHERE id = ?').get(id) as { s: number }).s;

describe('fresh install', () => {
  it('v11 is the latest and vehicle has oil_synthetic, default 0', () => {
    expect(LATEST_VERSION).toBeGreaterThanOrEqual(11);
    const db = v10Database();
    upgrade(db);
    vehicle(db, 'new');
    expect(flag(db, 'new')).toBe(0);
  });
});

describe('a 2.5.x database: 10 → 11', () => {
  it('marks the vehicles whose oil reminder already runs at 10,000 km / 12 months', () => {
    const db = v10Database();
    for (const id of ['mineral', 'synthetic', 'noted', 'custom', 'gone', 'noreminder']) vehicle(db, id);
    oilReminder(db, 'mineral', {});
    oilReminder(db, 'synthetic', { km: 10_000, months: 12 });
    oilReminder(db, 'noted', { notes: 'Aceite sintético: 10,000 km o 12 meses.' });
    oilReminder(db, 'custom', { km: 7500, months: 9 });
    oilReminder(db, 'gone', { km: 10_000, months: 12, deleted: true });

    upgrade(db);

    expect(['mineral', 'synthetic', 'noted', 'custom', 'gone', 'noreminder'].map((id) => flag(db, id))).toEqual([0, 1, 1, 0, 0, 0]);
  });

  it('the catalog note that every vehicle gets ("Sintético: 10,000 km / 12 meses") does not mark it', () => {
    const db = v10Database();
    vehicle(db, 'plain');
    oilReminder(db, 'plain', { notes: 'Sintético: 10,000 km / 12 meses' });
    upgrade(db);
    expect(flag(db, 'plain')).toBe(0);
  });

  it('leaves updated_at and synced_at alone (sql/040 makes the same change in the cloud)', () => {
    const db = v10Database();
    vehicle(db, 'c3');
    oilReminder(db, 'c3', { km: 10_000, months: 12 });
    upgrade(db);
    expect(db.prepare('SELECT updated_at, synced_at FROM vehicle WHERE id = ?').get('c3')).toEqual({ updated_at: T, synced_at: T });
  });
});
