/**
 * IMP 03112026 SPEC-E: the loader reads this device's data into the pure engine. A real in-memory database, no network.
 */
process.env.TZ = 'America/Santo_Domingo';
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

import type { TestDb } from '../helpers/sqlite';
import type { VehicleDraft } from '@/components/VehicleForm';
import { loadFacts } from '@/lib/db/predictQueries';
import { expenses, odometer, reminders, vehicles as vehicleRepo } from '@/lib/db/repos';
import { seedCatalog } from '@/lib/db/seed';
import { saveVehicleDraft } from '@/lib/db/vehicleOps';
import type { FillUp } from '@/lib/types';

jest.mock('@/lib/db/client', () => {
  const helpers = require('../helpers/sqlite');
  const testDb = helpers.createTestDb();
  return { ...helpers.clientModule(testDb), testDb };
});
void (jest.requireMock('@/lib/db/client') as { testDb: TestDb }).testDb;

const draft = (id: string): VehicleDraft => ({ id, name: id, type: 'carro', make: null, model: null, year: null, color: null, plate: null, vin: null, defaultFuelType: 'regular', tankVolume: null, odometerKm: null, synthetic: false, purchaseDate: null, purchasePrice: null, photoMediaId: null, notes: '', nickname: null, status: 'activo', chassisCode: null, chassisNumber: null, engineCode: null, transmission: null, drivetrain: null, origin: null, importedYear: null, story: '' }) as unknown as VehicleDraft;

const today = '2026-11-04';
const storeVehicle = async (id: string) => {
  const detail = (await vehicleRepo.getById(id))!;
  return { id, name: id, plate: '', defaultFuelType: 'regular' as const, tankVolume: null, createdAt: '2026-01-01T00:00:00Z', detail };
};

beforeAll(async () => {
  await seedCatalog();
  await saveVehicleDraft(draft('veh_empty'));
  await saveVehicleDraft(draft('veh_data'));
  // 9 weekly readings at 40 km/day, ending at 100,000 km today
  for (let i = 0; i < 9; i++) {
    const back = (8 - i) * 7;
    const at = new Date(Date.parse(`${today}T12:00:00Z`) - back * 86_400_000).toISOString();
    await odometer.upsert({ id: `o${i}`, vehicleId: 'veh_data', occurredAt: at, valueKm: 100_000 - back * 40, source: 'manual' });
  }
  await reminders.upsert({ id: 'r_oil', vehicleId: 'veh_data', title: 'Aceite', serviceTypeId: null, metric: 'km', dueKm: 100_400, dueDate: null, isRecurring: false, thresholdDays: 7, notes: '', isEnabled: true, snoozedUntil: null });
  await expenses.upsert({ id: 'e1', vehicleId: 'veh_data', occurredAt: '2026-10-20T12:00:00.000Z', category: 'otro', amountDop: 6000, description: '', vendor: '', odometerKm: null, deletedAt: null });
});

describe('loadFacts', () => {
  it('a car with no readings, reminders or spending has NO facts and an empty-key hash', async () => {
    const r = await loadFacts(await storeVehicle('veh_empty'), [], today);
    expect(r.facts).toEqual([]);
    expect(r.rate.confidence).toBe('none');
    expect(r.hash).toMatch(/^[0-9a-f]{16}$/);
  });

  it('a car with a pace and a km reminder: the usage rate, the projection fact and the cost per km, from the local database', async () => {
    const r = await loadFacts(await storeVehicle('veh_data'), [], today);
    expect(r.rate).toMatchObject({ kmPerDay: 40, confidence: 'high' });
    const proj = r.facts.find((f) => f.kind === 'reminder_projection')!;
    expect(proj).toMatchObject({ severity: 'watch', data: { reminderId: 'r_oil', daysLeft: 10, projectedDueAt: '2026-11-14' } });
    expect(r.facts.find((f) => f.kind === 'cost_per_km')?.data.perKm30).toBeCloseTo(5.36, 1);
  });

  it('the hash is stable for unchanged data and moves when the data does', async () => {
    const v = await storeVehicle('veh_data');
    const a = await loadFacts(v, [], today);
    expect((await loadFacts(v, [], today)).hash).toBe(a.hash);
    await reminders.upsert({ id: 'r_oil', dueKm: 100_200 });
    expect((await loadFacts(v, [], today)).hash).not.toBe(a.hash);
  });

  it('another car’s data never leaks in', async () => {
    const r = await loadFacts(await storeVehicle('veh_empty'), [], today);
    expect(r.facts.every((f) => f.vehicleId === 'veh_empty')).toBe(true);
  });

  it('fill-ups of the car feed fuel spend (and are ignored for other cars)', async () => {
    const fill = (id: string, vehicleId: string): FillUp => ({ id, vehicleId, occurredAt: '2026-10-25T12:00:00.000Z', odometerKm: 99_000, volume: 10, pricePerUnit: 340, totalDop: 3400, fuelType: 'regular', isFullTank: true, station: '', notes: '', createdAt: '2026-10-25T12:00:00.000Z' });
    const v = await storeVehicle('veh_data');
    const withFill = await loadFacts(v, [fill('f1', 'veh_data'), fill('f2', 'veh_empty')], today);
    const without = await loadFacts(v, [], today);
    expect(withFill.facts.find((f) => f.kind === 'cost_per_km')!.data.perKm30 as number).toBeGreaterThan(without.facts.find((f) => f.kind === 'cost_per_km')!.data.perKm30 as number);
  });
});
