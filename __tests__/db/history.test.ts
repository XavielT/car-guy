/**
 * Historial's feed against a real SQLite (2.1.1 backlog): free text folds
 * accents and case in JS (SQLite's NOCASE is ASCII-only), fuel labels still
 * find fill-ups, a limit applies after the text filter, and same-day entries
 * come newest first.
 */
import type { TestDb } from '../helpers/sqlite';
import { dtcCodes, expenses, history, vehicles } from '@/lib/db/repos';

jest.mock('@/lib/db/client', () => {
  const helpers = require('../helpers/sqlite');
  const testDb = helpers.createTestDb();
  return { ...helpers.clientModule(testDb), testDb };
});
const db = (jest.requireMock('@/lib/db/client') as { testDb: TestDb }).testDb.sqlite;

const DAY = '2026-09-20T12:00:00.000Z';

beforeAll(async () => {
  await vehicles.upsertRaw({ id: 'v1', name: 'DS3', type: 'carro', defaultFuelType: 'regular', notes: '', sortOrder: 0 } as never);
  const add = (id: string, description: string, createdAt: string, category = 'otro') =>
    db
      .prepare(`INSERT INTO expense (id, vehicle_id, occurred_at, category, amount_dop, description, vendor, created_at, updated_at) VALUES (?, 'v1', ?, ?, 100, ?, '', ?, ?)`)
      .run(id, DAY, category, description, createdAt, createdAt);
  add('e_first', 'Lavado', '2026-09-20T09:00:00.000Z', 'lavado');
  add('e_second', 'Aceite Óptimo 5W-30', '2026-09-20T15:00:00.000Z');
  add('e_third', 'Peaje Autopista Duarte', '2026-09-20T18:00:00.000Z', 'peaje');
  db.prepare(
    `INSERT INTO fuel_log (id, vehicle_id, occurred_at, odometer_km, volume, price_per_unit, total_dop, fuel_type, is_full_tank, missed_previous, station, notes, created_at, updated_at)
     VALUES ('f1', 'v1', '2026-09-10T12:00:00.000Z', 1000, 10, 300, 3000, 'gasoil_optimo', 1, 0, 'Shell', '', ?, ?)`,
  ).run(DAY, DAY);
  void expenses;
});

it('same-day entries come newest first', async () => {
  const feed = await history.feed('v1', { kinds: ['gasto'] });
  expect(feed.map((e) => e.id)).toEqual(['e_third', 'e_second', 'e_first']);
});

it('"optimo" finds "Óptimo", in any case, and a fuel label finds its fill-ups', async () => {
  for (const q of ['optimo', 'ÓPTIMO', 'Optimo 5w']) {
    const ids = (await history.feed('v1', { q })).map((e) => e.id);
    expect(ids).toContain('e_second');
  }
  // "Gasoil óptimo" is the label; the feed row's title is the code.
  expect((await history.feed('v1', { q: 'gasoil óptimo' })).map((e) => e.id)).toEqual(['f1']);
  expect((await history.feed('v1', { q: 'shell' })).map((e) => e.id)).toEqual(['f1']);
  expect(await history.feed('v1', { q: 'nada de esto' })).toEqual([]);
});

it('a limit applies after the text filter', async () => {
  const ids = (await history.feed('v1', { q: 'a', limit: 2 })).map((e) => e.id);
  expect(ids).toHaveLength(2);
  expect(ids).toEqual(['e_third', 'e_second']);
});

it('OBD search folds accents too ("posicion" finds "posición")', async () => {

  const withAccent = await dtcCodes.search('posición', 500);
  const without = await dtcCodes.search('posicion', 500);
  expect(withAccent.length).toBeGreaterThan(0);
  expect(without.map((d) => d.code)).toEqual(withAccent.map((d) => d.code));
  expect((await dtcCodes.search('p0301'))[0]?.code).toBe('P0301');
});
