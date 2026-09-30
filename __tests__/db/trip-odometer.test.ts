/** ADR-30 on a real SQLite: a trip's odometer suggestion, and typed readings winning. */
import type { TestDb } from '../helpers/sqlite';
import { odometer as odometerRepo, odometerNow } from '@/lib/db/repos';
import { suggestOdometerFromTrip, trips } from '@/lib/db/tripOps';
import type { Trip } from '@/lib/db/types';

jest.mock('@/lib/db/client', () => {
  const helpers = require('../helpers/sqlite');
  const testDb = helpers.createTestDb();
  return { ...helpers.clientModule(testDb), testDb };
});
const db = (jest.requireMock('@/lib/db/client') as { testDb: TestDb }).testDb.sqlite;
const T = (d: number) => `2026-09-${String(d).padStart(2, '0')}T12:00:00.000Z`;

beforeAll(async () => {
  db.prepare(`INSERT INTO vehicle (id, name, default_fuel_type, created_at, updated_at) VALUES ('v', 'DS3', 'regular', ?, ?)`).run(T(1), T(1));
  await odometerRepo.upsert({ id: 'r1', vehicleId: 'v', occurredAt: T(1), valueKm: 100000, source: 'manual', sourceId: null, deletedAt: null });
  await odometerRepo.upsert({ id: 'r2', vehicleId: 'v', occurredAt: T(10), valueKm: 100515, source: 'fuel', sourceId: null, deletedAt: null });
});

const trip = async (id: string, day: number, km: number, role: Trip['role'] = 'conductor') =>
  (await trips.upsert({
    id, vehicleId: 'v', source: 'manual', status: 'done', role, startedAt: T(day), endedAt: T(day),
    distanceM: km * 1000, durationS: 600, movingS: 500, speedBuckets: '[0,0,0,0,0]', segments: 1, notes: '',
    startLabel: '', endLabel: '', deletedAt: null,
  })) as Trip;

it('calibrates GPS against the odometer and suggests last typed + GPS since', async () => {
  await trip('a', 5, 500); // between the two typed readings: odometer 515 km, GPS 500 → ×1.03
  const t = await trip('b', 12, 10);
  expect(await suggestOdometerFromTrip(t)).toBe(100515 + Math.round(10 * 1.03));
  expect(await odometerNow('v')).toEqual({ km: 100525, estimated: true });
  expect(db.prepare(`SELECT odometer_reading_id FROM trip WHERE id = 'b'`).get()).toEqual({ odometer_reading_id: 'odo_trip_b' });
});

it('a passenger trip adds nothing', async () => {
  expect(await suggestOdometerFromTrip(await trip('c', 13, 30, 'pasajero'))).toBeNull();
});

it('a typed reading after the estimate wins, even when lower', async () => {
  await odometerRepo.upsert({ id: 'r3', vehicleId: 'v', occurredAt: T(14), valueKm: 100520, source: 'manual', sourceId: null, deletedAt: null });
  expect(await odometerNow('v')).toEqual({ km: 100520, estimated: false });
});
