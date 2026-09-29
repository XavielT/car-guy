/**
 * The oil columns through the service ops against a real SQLite (IMP 29092026
 * note 16): save and load, an edit that rewrites them, the "Igual que la
 * última vez" query and Historial's oil lines.
 */
import { lastOilFor, oilSummaries } from '@/lib/db/oilQueries';
import { serviceRecordItems, vehicles } from '@/lib/db/repos';
import { seedCatalog } from '@/lib/db/seed';
import { saveServiceRecord, type ServiceDraft } from '@/lib/db/serviceOps';

jest.mock('@/lib/db/client', () => {
  const helpers = require('../helpers/sqlite');
  const testDb = helpers.createTestDb();
  return { ...helpers.clientModule(testDb), testDb };
});

const base = (over: Partial<ServiceDraft>): ServiceDraft => ({
  vehicleId: 'v1',
  kind: 'mantenimiento',
  occurredAt: '2026-09-01T12:00:00.000Z',
  odometerKm: null,
  title: 'Aceite de motor y filtro',
  description: '',
  costPartsDop: 0,
  costLaborDop: 0,
  totalDop: 0,
  shop: '',
  warrantyUntilDate: null,
  warrantyUntilKm: null,
  serviceTypeIds: ['aceite_motor'],
  parts: [],
  ...over,
});

beforeAll(async () => {
  await seedCatalog();
  await vehicles.upsertRaw({ id: 'v1', name: 'DS3', type: 'carro', defaultFuelType: 'regular', notes: '', sortOrder: 0 } as never);
  await vehicles.upsertRaw({ id: 'v2', name: 'C3', type: 'carro', defaultFuelType: 'regular', notes: '', sortOrder: 1 } as never);
});

const itemOf = async (recordId: string, typeId = 'aceite_motor') =>
  (await serviceRecordItems.listWhere({ serviceRecordId: recordId })).find((i) => i.serviceTypeId === typeId);

it('saves and loads the four columns, and an edit rewrites them', async () => {
  await saveServiceRecord(
    base({
      id: 'r1',
      serviceTypeIds: ['aceite_motor', 'filtro_aire'],
      oil: { aceite_motor: { oilViscosity: '5W-30', oilType: 'sintetico', oilBrand: 'Castrol', oilSpec: 'API SP · ILSAC GF-6A' } },
    }),
  );
  expect(await itemOf('r1')).toMatchObject({
    oilViscosity: '5W-30',
    oilType: 'sintetico',
    oilBrand: 'Castrol',
    oilSpec: 'API SP · ILSAC GF-6A',
  });
  expect(await itemOf('r1', 'filtro_aire')).toMatchObject({ oilViscosity: null, oilBrand: null });

  // Edit: brand changed, spec cleared.
  await saveServiceRecord(
    base({ id: 'r1', serviceTypeIds: ['aceite_motor'], oil: { aceite_motor: { oilViscosity: '5W-30', oilType: 'sintetico', oilBrand: 'Mobil 1' } } }),
  );
  expect(await itemOf('r1')).toMatchObject({ oilBrand: 'Mobil 1', oilSpec: null, deletedAt: null });
  expect(await itemOf('r1', 'filtro_aire')).toBeUndefined();
});

it('a save without the oil map (a task, a check) leaves the columns alone', async () => {
  await saveServiceRecord(base({ id: 'r1', serviceTypeIds: ['aceite_motor'] }));
  expect(await itemOf('r1')).toMatchObject({ oilBrand: 'Mobil 1', oilViscosity: '5W-30' });
});

it('lastOilFor: the newest earlier oil of the same vehicle and item, never the record being edited', async () => {
  await saveServiceRecord(
    base({ id: 'r0', occurredAt: '2026-03-01T12:00:00.000Z', oil: { aceite_motor: { oilViscosity: '10W-40', oilType: 'mineral' } } }),
  );
  await saveServiceRecord(base({ id: 'r2', occurredAt: '2026-09-20T12:00:00.000Z', oil: {} })); // newest, but no oil
  await saveServiceRecord(base({ id: 'rv2', vehicleId: 'v2', occurredAt: '2026-09-25T12:00:00.000Z', oil: { aceite_motor: { oilBrand: 'Motul' } } }));

  expect(await lastOilFor('v1', 'aceite_motor')).toEqual({ oilViscosity: '5W-30', oilType: 'sintetico', oilBrand: 'Mobil 1', oilSpec: null });
  expect(await lastOilFor('v1', 'aceite_motor', 'r1')).toMatchObject({ oilViscosity: '10W-40', oilType: 'mineral' });
  expect(await lastOilFor('v1', 'aceite_transmision')).toBeNull();
  expect(await lastOilFor('v2', 'aceite_motor')).toMatchObject({ oilBrand: 'Motul' });
});

it('oilSummaries: one line per record with oil, engine oil first', async () => {
  await saveServiceRecord(
    base({
      id: 'r3',
      serviceTypeIds: ['aceite_transmision', 'aceite_motor'],
      oil: { aceite_transmision: { oilBrand: 'Valvoline' }, aceite_motor: { oilViscosity: '0W-20', oilType: 'sintetico', oilBrand: 'Castrol' } },
    }),
  );
  const lines = await oilSummaries(['r0', 'r1', 'r2', 'r3', 'nope']);
  expect(Object.fromEntries(lines)).toEqual({
    r0: '10W-40 mineral',
    r1: '5W-30 sintético · Mobil 1',
    r3: '0W-20 sintético · Castrol',
  });
  expect((await oilSummaries([])).size).toBe(0);
});
