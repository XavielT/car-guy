/**
 * Backup v2 carries the schema v2 tables: export, wipe, restore, same rows.
 * The bundled DTC table is not user data and stays out of the file.
 */
import type { TestDb } from '../helpers/sqlite';
import { buildBackup, restoreV2 } from '@/lib/backup';
import { resetDatabase } from '@/lib/db/reset';
import { ALL_TABLES } from '@/lib/db/repos';
import { seedCatalog } from '@/lib/db/seed';
import { seedRealGarage } from '@/lib/dev/garage';
import { SYNC_TABLE_NAMES } from '@/lib/sync/tables';

jest.mock('@/lib/db/client', () => {
  const helpers = require('../helpers/sqlite');
  const testDb = helpers.createTestDb();
  return { ...helpers.clientModule(testDb), testDb };
});
const db = (jest.requireMock('@/lib/db/client') as { testDb: TestDb }).testDb.sqlite;
const count = (table: string) => (db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;

it('backs up every synced table (and not dtc_code)', () => {
  const tables = new Set<string>(ALL_TABLES);
  for (const name of SYNC_TABLE_NAMES) if (name !== 'setting') expect(tables).toContain(name);
  expect(tables).not.toContain('dtc_code');
});

it('round-trips the v2 garage', async () => {
  await seedCatalog();
  await seedRealGarage(new Date(2026, 8, 28));
  const before = Object.fromEntries(ALL_TABLES.map((t) => [t, count(t)]));
  expect(before.mod).toBe(5);

  const backup = JSON.parse(JSON.stringify(await buildBackup()));
  await resetDatabase();
  expect(count('mod')).toBe(0);
  expect(count('dtc_code')).toBeGreaterThan(3000); // reset keeps bundled data

  await restoreV2(backup);
  for (const t of ALL_TABLES) expect([t, count(t)]).toEqual([t, before[t]]);
});

describe('v6: liters in the file, gallons in old files (IMP 29092026 Phase 2)', () => {
  const GAL = 3.785411784;
  const one = (sql: string) => db.prepare(sql).get() as Record<string, unknown>;

  it('a 2.2 backup says its schema version and round-trips liters untouched', async () => {
    const backup = JSON.parse(JSON.stringify(await buildBackup()));
    expect(backup.schemaVersion).toBe(9);
    const f = backup.tables.fuel_log[0];
    await resetDatabase();
    await restoreV2(backup);
    expect(one(`SELECT volume, volume_entered FROM fuel_log WHERE id = '${f.id}'`)).toEqual({
      volume: f.volume,
      volume_entered: f.volume_entered,
    });
  });

  it('a 2.1.x backup (gallons, no schemaVersion) is converted on the way in', async () => {
    const backup = JSON.parse(JSON.stringify(await buildBackup()));
    delete backup.schemaVersion;
    // What a 2.1.x file holds: gallons and RD$/gal, no v6 columns.
    backup.tables.fuel_log = backup.tables.fuel_log.map((r: Record<string, unknown>) => {
      const { volume_entered: _e, volume_entered_unit: _u, gauge_before_eighths: _b, gauge_after_eighths: _a, in_reserve: _r, ...v5 } = r;
      return { ...v5, volume: r.volume_entered, price_per_unit: Math.round((r.price_per_unit as number) * GAL * 100) / 100 };
    });
    const sample = backup.tables.fuel_log[0];
    await resetDatabase();
    await restoreV2(backup);
    const row = one(`SELECT * FROM fuel_log WHERE id = '${sample.id}'`);
    expect(row.volume).toBeCloseTo((sample.volume as number) * GAL, 5);
    expect(row.volume_entered).toBe(sample.volume);
    expect(row.volume_entered_unit).toBe('gal');
  });
});
