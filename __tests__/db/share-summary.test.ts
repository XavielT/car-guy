/** sql/022: the phone publishes its own "lo que me ha costado" with the share, and keeps it current. */
import type { TestDb } from '../helpers/sqlite';
import { vehicleShares } from '@/lib/db/repos';
import { refreshShareSummaries } from '@/lib/db/shareQueries';

jest.mock('@/lib/db/client', () => {
  const helpers = require('../helpers/sqlite');
  const testDb = helpers.createTestDb();
  return { ...helpers.clientModule(testDb), testDb };
});
const db = (jest.requireMock('@/lib/db/client') as { testDb: TestDb }).testDb.sqlite;
const T = '2026-09-01T12:00:00.000Z';

beforeAll(() => {
  db.prepare(`INSERT INTO vehicle (id, name, default_fuel_type, created_at, updated_at) VALUES ('v', 'DS3', 'regular', ?, ?)`).run(T, T);
  db.prepare(`INSERT INTO expense (id, vehicle_id, occurred_at, category, amount_dop, created_at, updated_at) VALUES ('e1', 'v', ?, 'seguro', 12000, ?, ?)`).run(T, T, T);
});

const summary = () => (db.prepare(`SELECT costs_summary FROM vehicle_share WHERE id = 'share_v'`).get() as { costs_summary: string | null }).costs_summary;

it('writes the figure for a published car with "costos" on, then only when it changes', async () => {
  await vehicleShares.upsert({ id: 'share_v', vehicleId: 'v', visibility: 'link', slug: 'ab3cdefg', publishedAt: T, showCosts: true, deletedAt: null });
  expect(await refreshShareSummaries()).toBe(1);
  expect(JSON.parse(summary()!).total_dop).toBe(12000);
  expect(await refreshShareSummaries()).toBe(0);
  db.prepare(`INSERT INTO expense (id, vehicle_id, occurred_at, category, amount_dop, created_at, updated_at) VALUES ('e2', 'v', ?, 'seguro', 3000, ?, ?)`).run(T, T, T);
  expect(await refreshShareSummaries()).toBe(1);
  expect(JSON.parse(summary()!).total_dop).toBe(15000);
});

it('clears it when "costos" goes off', async () => {
  await vehicleShares.upsert({ id: 'share_v', showCosts: false });
  await refreshShareSummaries();
  expect(summary()).toBeNull();
});
