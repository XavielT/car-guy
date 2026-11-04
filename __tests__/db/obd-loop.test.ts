/**
 * IMP 03112026 SPEC-D §D4 (closing the loop): a repair saved from an OBD code links the event AND resolves it, and the
 * re-scan reminder is a one-off date reminder a few days out.
 */
process.env.TZ = 'America/Santo_Domingo';
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

import type { TestDb } from '../helpers/sqlite';
import { createRescanReminder, listDtcEvents, logDtc, resolveDtcFromRepair } from '@/lib/db/diyQueries';
import { reminders as reminderRepo, serviceRecords } from '@/lib/db/repos';
import { seedCatalog } from '@/lib/db/seed';
import { saveVehicleDraft } from '@/lib/db/vehicleOps';
import type { VehicleDraft } from '@/components/VehicleForm';

jest.mock('@/lib/db/client', () => {
  const helpers = require('../helpers/sqlite');
  const testDb = helpers.createTestDb();
  return { ...helpers.clientModule(testDb), testDb };
});
void (jest.requireMock('@/lib/db/client') as { testDb: TestDb }).testDb;

const draft = { id: 'veh_obd', name: 'Hilux', type: 'carro', make: null, model: null, year: null, color: null, plate: null, vin: null, defaultFuelType: 'gasoil_regular', tankVolume: null, odometerKm: 90_000, synthetic: false, purchaseDate: null, purchasePrice: null, photoMediaId: null, notes: '', nickname: null, status: 'activo', chassisCode: null, chassisNumber: null, engineCode: null, transmission: null, drivetrain: null, origin: null, importedYear: null, story: '' } as unknown as VehicleDraft;

beforeAll(async () => {
  await seedCatalog();
  await saveVehicleDraft(draft);
});

describe('closing the loop', () => {
  it('a repair from a code: the event points at it and is marked resolved (and the code is returned for the offer)', async () => {
    const ev = (await logDtc({ vehicleId: 'veh_obd', code: 'p0420', seenAt: '2026-11-01T12:00:00.000Z', odometerKm: 90_000 }))!;
    expect(ev.code).toBe('P0420');
    expect(ev.clearedAt).toBeNull();
    const repair = await serviceRecords.upsert({ id: 'sr_obd', vehicleId: 'veh_obd', kind: 'reparacion', occurredAt: '2026-11-04T12:00:00.000Z', odometerKm: 90_100, title: 'Catalizador', description: '', costPartsDop: 0, costLaborDop: 0, totalDop: 25_000, shop: 'Taller Pérez', deletedAt: null });
    const resolved = await resolveDtcFromRepair(ev.id, repair.id);
    expect(resolved).toMatchObject({ id: ev.id, code: 'P0420', repairRecordId: 'sr_obd' });
    expect(resolved!.clearedAt).toBeTruthy();
    const [stored] = await listDtcEvents({ vehicleId: 'veh_obd', code: 'P0420' });
    expect(stored.clearedAt).toBeTruthy();
    expect(stored.repairRecordId).toBe('sr_obd');
  });

  it('an event that no longer exists yields null, not a crash', async () => {
    expect(await resolveDtcFromRepair('nope', 'sr_obd')).toBeNull();
  });

  it('the re-scan reminder: a one-off enabled date reminder, named for the code, N days out', async () => {
    const id = await createRescanReminder('veh_obd', 'P0420', '2026-11-04', 3);
    const r = (await reminderRepo.getById(id))!;
    expect(r).toMatchObject({ vehicleId: 'veh_obd', title: 'Volver a escanear P0420', metric: 'date', isEnabled: true, isRecurring: false });
    expect(new Date(r.dueDate!).toLocaleDateString('en-CA')).toBe('2026-11-07');
  });
});
