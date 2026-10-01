/**
 * Migration v10 (IMP 01102026 Phase 2, ADR-51/56/58) against node's real SQLite.
 *
 * The canary: a 2.4.x database with eighths readings upgrades, and every fill-up carries the same reading as
 * a fraction + "n/8" while the eighths stay for 2.4.x phones on the same car. Plus the new tables, the DS3
 * seed (nine squares, four readings), the caches that reset clears, and a backup round-trip of v10 rows.
 */
import { DatabaseSync } from 'node:sqlite';

import type { TestDb } from '../helpers/sqlite';
import { buildBackup, restoreV2, type BackupV2 } from '@/lib/backup';
import { LATEST_VERSION, MIGRATIONS } from '@/lib/db/migrations';
import { fuel, privacyZones, tripShares, vehicles } from '@/lib/db/repos';
import { resetDatabase } from '@/lib/db/reset';
import { seedCatalog } from '@/lib/db/seed';
import { GARAGE_IDS, seedRealGarage } from '@/lib/dev/garage';

jest.mock('@/lib/db/client', () => {
  const helpers = require('../helpers/sqlite');
  const testDb = helpers.createTestDb();
  return { ...helpers.clientModule(testDb), testDb };
});
const appDb = (jest.requireMock('@/lib/db/client') as { testDb: TestDb }).testDb;

type Row = Record<string, unknown>;
const T = '2026-09-30T12:00:00.000Z';

function v9Database(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  for (const m of MIGRATIONS.filter((m) => m.version <= 9)) {
    db.exec('BEGIN');
    for (const sql of m.up) db.exec(sql);
    db.exec('COMMIT');
  }
  db.prepare(`INSERT INTO vehicle (id, name, default_fuel_type, created_at, updated_at) VALUES ('c3', 'C3', 'regular', ?, ?)`).run(T, T);
  const fill = db.prepare(
    `INSERT INTO fuel_log (id, vehicle_id, occurred_at, odometer_km, volume, price_per_unit, total_dop, fuel_type, gauge_before_eighths, gauge_after_eighths, created_at, updated_at)
     VALUES (?, 'c3', ?, ?, 30, 80, 2400, 'regular', ?, ?, ?, ?)`,
  );
  fill.run('f-both', T, 1000, 2, 8, T, T);
  fill.run('f-before', T, 1400, 3, null, T, T);
  fill.run('f-none', T, 1800, null, null, T, T);
  return db;
}

function upgrade(db: DatabaseSync) {
  const v10 = MIGRATIONS.find((m) => m.version === 10)!;
  db.exec('BEGIN');
  for (const sql of v10.up) db.exec(sql);
  db.exec('COMMIT');
}

describe('fresh install: 0 → 10', () => {
  it('is the latest version and has every v10 table and column', () => {
    expect(LATEST_VERSION).toBe(10);
    const tables = (appDb.sqlite.prepare(`SELECT name FROM sqlite_master WHERE type = 'table'`).all() as Row[]).map((r) => r.name);
    for (const t of ['trip_share', 'privacy_zone', 'social_cache', 'junte_cache']) expect(tables).toContain(t);
    const cols = (t: string) => (appDb.sqlite.prepare(`PRAGMA table_info(${t})`).all() as Row[]).map((r) => r.name);
    expect(cols('vehicle')).toEqual(expect.arrayContaining(['gauge_type', 'gauge_segments', 'gauge_reserve_at', 'gauge_calibration']));
    expect(cols('fuel_log')).toEqual(
      expect.arrayContaining(['gauge_before_frac', 'gauge_after_frac', 'gauge_before_raw', 'gauge_after_raw', 'gauge_before_eighths']),
    );
  });

  it('a new car reads a needle in eighths until told otherwise', async () => {
    await vehicles.upsertRaw({ id: 'v-new', name: 'Nuevo', defaultFuelType: 'regular' });
    const v = await vehicles.getById('v-new');
    expect(v?.gaugeType).toBe('needle8');
    expect(v?.gaugeSegments).toBeNull();
    expect(v?.gaugeCalibration).toBeNull();
  });

  it('refuses a trip share with a visibility the cloud does not know', () => {
    expect(() =>
      appDb.sqlite
        .prepare(`INSERT INTO trip_share (id, trip_id, visibility, polyline_trimmed, created_at, updated_at) VALUES ('x', 't', 'everyone', '', ?, ?)`)
        .run(T, T),
    ).toThrow(/CHECK/);
  });
});

describe('a 2.4.x database: 9 → 10', () => {
  const db = v9Database();
  upgrade(db);
  const row = (id: string) => db.prepare(`SELECT * FROM fuel_log WHERE id = ?`).get(id) as Row;

  it('backfills both readings from the eighths, and keeps the eighths', () => {
    expect(row('f-both')).toMatchObject({
      gauge_before_frac: 0.25,
      gauge_before_raw: '2/8',
      gauge_after_frac: 1,
      gauge_after_raw: '8/8',
      gauge_before_eighths: 2,
      gauge_after_eighths: 8,
    });
  });

  it('fills only the reading that was there', () => {
    expect(row('f-before')).toMatchObject({ gauge_before_frac: 0.375, gauge_before_raw: '3/8', gauge_after_frac: null, gauge_after_raw: null });
    expect(row('f-none')).toMatchObject({ gauge_before_frac: null, gauge_before_raw: null, gauge_after_frac: null, gauge_after_raw: null });
  });

  it('the existing car becomes a needle8 with nothing learned', () => {
    expect(db.prepare(`SELECT gauge_type, gauge_segments, gauge_calibration FROM vehicle WHERE id = 'c3'`).get()).toEqual({
      gauge_type: 'needle8',
      gauge_segments: null,
      gauge_calibration: null,
    });
  });
});

describe('the app on v10 (seed, reset, backup)', () => {
  beforeAll(async () => {
    await resetDatabase();
    await seedCatalog();
    await seedRealGarage(new Date(2026, 9, 1));
  });

  it('the DS3 reads nine squares, reserve at one, with the research example on four fill-ups', async () => {
    const ds3 = await vehicles.getById(GARAGE_IDS.ds3);
    expect(ds3).toMatchObject({ gaugeType: 'segments', gaugeSegments: 9, gaugeReserveAt: 1 });
    const read = (await fuel.list(GARAGE_IDS.ds3)).filter((f) => f.gaugeBeforeRaw);
    expect(read.map((f) => `${f.gaugeBeforeRaw}→${f.gaugeAfterRaw} ${Math.round(f.volume)} L ${f.isFullTank ? 'full' : 'partial'}`).sort()).toEqual([
      '1/9→9/9 36 L full',
      '2/9→6/9 18 L partial',
      '3/9→9/9 28 L full',
      '5/9→9/9 19 L full',
    ]);
    for (const f of read) expect(f.gaugeBeforeEighths).toBeNull();
    expect(read.find((f) => f.gaugeBeforeRaw === '2/9')?.gaugeBeforeFrac).toBeCloseTo(2 / 9, 10);
  });

  it('the other cars are untouched needles', async () => {
    expect((await vehicles.getById(GARAGE_IDS.ae85))?.gaugeType).toBe('needle8');
  });

  it('round-trips the gauge columns, trip_share and privacy_zone through a backup', async () => {
    await tripShares.upsert({ id: 'ts1', tripId: 'trip-1', visibility: 'friends', polylineTrimmed: '_p~iF~ps|U_ulLnnqC', distanceM: 11200, durationS: 1500, startedDay: '2026-09-27', title: 'A la playa' });
    await privacyZones.upsert({ id: 'pz1', label: 'Casa', lat: 18.47, lng: -69.93, radiusM: 400 });
    await vehicles.upsertRaw({ id: GARAGE_IDS.ds3, gaugeCalibration: '{"status":"aprendido"}' });

    const backup = JSON.parse(JSON.stringify(await buildBackup())) as BackupV2;
    expect(backup.schemaVersion).toBe(10);
    expect(backup.tables.trip_share).toHaveLength(1);
    expect(backup.tables.privacy_zone).toHaveLength(1);

    await resetDatabase();
    expect(await tripShares.getById('ts1')).toBeNull();
    await restoreV2(backup);

    expect(await tripShares.getById('ts1')).toMatchObject({ visibility: 'friends', distanceM: 11200, title: 'A la playa' });
    expect(await privacyZones.getById('pz1')).toMatchObject({ label: 'Casa', radiusM: 400 });
    expect(await vehicles.getById(GARAGE_IDS.ds3)).toMatchObject({ gaugeType: 'segments', gaugeSegments: 9, gaugeCalibration: '{"status":"aprendido"}' });
    expect((await fuel.list(GARAGE_IDS.ds3)).filter((f) => f.gaugeBeforeRaw)).toHaveLength(4);
  });

  it('reset clears the social and junte caches (another account must not see them)', async () => {
    appDb.sqlite.prepare(`INSERT INTO social_cache (key, json, updated_at) VALUES ('me', '{}', ?)`).run(T);
    appDb.sqlite.prepare(`INSERT INTO junte_cache (id, json, updated_at) VALUES ('j1', '{}', ?)`).run(T);
    await resetDatabase();
    const n = (t: string) => (appDb.sqlite.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get() as { n: number }).n;
    expect(n('social_cache')).toBe(0);
    expect(n('junte_cache')).toBe(0);
  });
});
