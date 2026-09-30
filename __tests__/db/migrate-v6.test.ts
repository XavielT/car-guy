/**
 * Migration v6 (IMP 29092026) against node's real SQLite.
 *
 * The canary of the whole phase: a device at v5 with its fill-ups in gallons
 * migrates to liters, and every km/gal the app shows is the same to three
 * decimals. Written before the store learnt about liters.
 */
import { DatabaseSync } from 'node:sqlite';

import { MIGRATIONS } from '@/lib/db/migrations';
import { computeEconomy } from '@/lib/domain/economy';
import { fuelForDisplay, GAL_L, tankForDisplay } from '@/lib/domain/units';
import type { FillUp } from '@/lib/types';

type Row = Record<string, unknown>;

function run(db: DatabaseSync, statements: string[]) {
  db.exec('BEGIN');
  for (const sql of statements) db.exec(sql);
  db.exec('COMMIT');
}

const T = '2026-09-01T12:00:00.000Z';

/** Six fill-ups the way 2.1.x stored them: gallons, RD$/gal, full and partial. */
const LOGS = [
  { km: 50000, vol: 11.2, price: 322, full: 1 },
  { km: 50410, vol: 10.4, price: 305, full: 1 },
  { km: 50630, vol: 4.2, price: 308.5, full: 0 },
  { km: 50880, vol: 6.1, price: 312, full: 1 },
  { km: 51300, vol: 11.37, price: 318.25, full: 1 },
  { km: 51745, vol: 12.004, price: 321, full: 1 },
];

function v5Database(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  for (const m of MIGRATIONS.filter((m) => m.version <= 5)) run(db, m.up);
  db.prepare(
    `INSERT INTO vehicle (id, name, default_fuel_type, tank_volume, created_at, updated_at) VALUES ('veh', 'DS3', 'premium', 13.2, ?, ?)`,
  ).run(T, T);
  db.prepare(
    `INSERT INTO vehicle (id, name, default_fuel_type, tank_volume, created_at, updated_at) VALUES ('gnv', 'Taxi', 'gnv', 15, ?, ?)`,
  ).run(T, T);
  LOGS.forEach((l, i) => {
    db.prepare(
      `INSERT INTO fuel_log (id, vehicle_id, occurred_at, odometer_km, volume, price_per_unit, total_dop, fuel_type, is_full_tank, created_at, updated_at, synced_at)
       VALUES (?, 'veh', ?, ?, ?, ?, ?, 'premium', ?, ?, ?, ?)`,
    ).run(`f${i}`, `2026-09-0${i + 1}T12:00:00.000Z`, l.km, l.vol, l.price, Math.round(l.vol * l.price * 100) / 100, l.full, T, T, T);
  });
  db.prepare(
    `INSERT INTO fuel_log (id, vehicle_id, occurred_at, odometer_km, volume, price_per_unit, total_dop, fuel_type, created_at, updated_at)
     VALUES ('g1', 'gnv', ?, 1000, 9.5, 43.97, 417.72, 'gnv', ?, ?)`,
  ).run(T, T, T);
  return db;
}

function fillUps(db: DatabaseSync, toDisplay: (r: Row) => { volume: number; pricePerUnit: number }): FillUp[] {
  return (db.prepare(`SELECT * FROM fuel_log WHERE vehicle_id = 'veh'`).all() as Row[]).map((r) => ({
    id: r.id as string,
    vehicleId: 'veh',
    occurredAt: r.occurred_at as string,
    odometerKm: r.odometer_km as number,
    ...toDisplay(r),
    totalDop: r.total_dop as number,
    fuelType: 'premium',
    isFullTank: r.is_full_tank === 1,
    station: '',
    notes: '',
    createdAt: r.created_at as string,
  }));
}

const asStored = (r: Row) => ({
  volume: r.volume as number,
  pricePerUnit: r.price_per_unit as number,
  fuelType: r.fuel_type as string,
  volumeEntered: r.volume_entered as number | null,
  volumeEnteredUnit: r.volume_entered_unit as string | null,
});

describe('v5 → v6: gallons become liters and nothing the user sees moves', () => {
  const db = v5Database();
  const before = computeEconomy(fillUps(db, (r) => ({ volume: r.volume as number, pricePerUnit: r.price_per_unit as number })));
  run(db, MIGRATIONS.find((m) => m.version === 6)!.up);

  it('the canary: km/gal per tank is identical to three decimals', () => {
    const after = computeEconomy(fillUps(db, (r) => fuelForDisplay(asStored(r), 'gal')));
    expect(before.length).toBe(4);
    expect(after.map((p) => p.kmPerUnit.toFixed(3))).toEqual(before.map((p) => p.kmPerUnit.toFixed(3)));
    expect(after.map((p) => p.costPerKm)).toEqual(before.map((p) => p.costPerKm));
  });

  it('even without the typed value, converting back gives the same km/gal', () => {
    const after = computeEconomy(
      fillUps(db, (r) => fuelForDisplay({ ...asStored(r), volumeEntered: null }, 'gal')),
    );
    expect(after.map((p) => p.kmPerUnit.toFixed(3))).toEqual(before.map((p) => p.kmPerUnit.toFixed(3)));
  });

  it('stores liters and RD$ per liter, and keeps what was typed', () => {
    const f0 = db.prepare(`SELECT * FROM fuel_log WHERE id = 'f0'`).get() as Row;
    expect(f0.volume).toBeCloseTo(11.2 * GAL_L, 6);
    expect(f0.price_per_unit).toBeCloseTo(322 / GAL_L, 6);
    expect(f0.volume_entered).toBe(11.2);
    expect(f0.volume_entered_unit).toBe('gal');
    expect(fuelForDisplay(asStored(f0), 'gal')).toEqual({ volume: 11.2, pricePerUnit: 322 });
  });

  it('in liters the same car reads km/L', () => {
    const inLiters = computeEconomy(fillUps(db, (r) => fuelForDisplay(asStored(r), 'l')));
    inLiters.forEach((p, i) => expect(p.kmPerUnit).toBeCloseTo(before[i].kmPerUnit / GAL_L, 2));
  });

  it('GNV is m³ and is not converted', () => {
    const g1 = db.prepare(`SELECT * FROM fuel_log WHERE id = 'g1'`).get() as Row;
    expect(g1.volume).toBe(9.5);
    expect(g1.price_per_unit).toBe(43.97);
    expect(g1.volume_entered_unit).toBe('m3');
    const taxi = db.prepare(`SELECT tank_volume FROM vehicle WHERE id = 'gnv'`).get() as Row;
    expect(taxi.tank_volume).toBe(15);
  });

  it('the tank is liters, shown back as typed', () => {
    const v = db.prepare(`SELECT * FROM vehicle WHERE id = 'veh'`).get() as Row;
    expect(v.tank_volume).toBeCloseTo(13.2 * GAL_L, 6);
    expect(v.volume_unit).toBe('gal');
    expect(v.economy_unit).toBe('km_gal');
    expect(tankForDisplay(v.tank_volume as number, v.tank_volume_entered as number, 'gal', 'premium')).toBe(13.2);
  });

  it('does not mark anything for upload (the cloud keeps its gallons)', () => {
    const dirty = db.prepare(`SELECT COUNT(*) AS n FROM fuel_log WHERE vehicle_id = 'veh' AND synced_at IS NULL`).get() as Row;
    expect(dirty.n).toBe(0);
  });
});

describe('fresh install: 0 → 6', () => {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  for (const m of MIGRATIONS) run(db, m.up);

  it('has the v6 tables and the history_feed photos column', () => {
    const tables = (db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table'`).all() as Row[]).map((r) => r.name);
    expect(tables).toEqual(expect.arrayContaining(['trip', 'trip_point', 'trip_state']));
    const cols = (db.prepare(`PRAGMA table_info(history_feed)`).all() as Row[]).map((r) => r.name);
    expect(cols).toContain('photos');
  });

  it('a done trip shows in the history as viaje; a recording one does not', () => {
    db.prepare(`INSERT INTO vehicle (id, name, default_fuel_type, created_at, updated_at) VALUES ('v', 'x', 'regular', ?, ?)`).run(T, T);
    db.prepare(
      `INSERT INTO trip (id, vehicle_id, source, status, started_at, distance_m, duration_s, start_label, end_label, created_at, updated_at)
       VALUES ('t1', 'v', 'manual', 'done', ?, 12400, 1500, 'Casa', 'Trabajo', ?, ?),
              ('t2', 'v', 'auto', 'recording', ?, 100, 10, '', '', ?, ?)`,
    ).run(T, T, T, T, T, T);
    const rows = db.prepare(`SELECT * FROM history_feed WHERE kind = 'viaje'`).all() as Row[];
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: 't1', title: '12400.0', subtitle: '1500|Casa|Trabajo' });
  });

  it('a check counts the photos on its results', () => {
    db.prepare(`INSERT INTO inspection (id, vehicle_id, template_id, occurred_at, status, created_at, updated_at) VALUES ('i1', 'v', 'tpl', ?, 'con_fallas', ?, ?)`).run(T, T, T);
    db.prepare(
      `INSERT INTO inspection_result (id, inspection_id, item_id, label_snapshot, result, media_id, created_at, updated_at)
       VALUES ('r1', 'i1', 'a', 'A', 'falla', 'm1', ?, ?), ('r2', 'i1', 'b', 'B', 'ok', NULL, ?, ?)`,
    ).run(T, T, T, T);
    const row = db.prepare(`SELECT photos FROM history_feed WHERE id = 'i1'`).get() as Row;
    expect(row.photos).toBe(1);
  });
});
