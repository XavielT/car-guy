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
