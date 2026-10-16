/**
 * ADR-63 (IMP 16102026): every field of the vehicle form survives
 * form → SQLite → editor → sync push → sync pull → editor. And N5, the one that did not:
 * "¿Aceite sintético?" was marked, saved, and always came back unmarked.
 */
// Santo Domingo is UTC-4: the zone where a date-only value read as an instant lands on the day before.
process.env.TZ = 'America/Santo_Domingo';

import type { TestDb } from '../helpers/sqlite';
import type { VehicleDraft } from '@/components/VehicleForm';
import { currentOdometer, reminders as reminderRepo, vehicles as vehicleRepo } from '@/lib/db/repos';
import { seedCatalog } from '@/lib/db/seed';
import { applyRemoteRows, dirtyRows, toCloudShape } from '@/lib/db/syncOps';
import { vehicleGallery } from '@/lib/db/tripOps';
import { draftFromVehicle } from '@/lib/db/vehicleDraft';
import { saveVehicleDraft } from '@/lib/db/vehicleOps';
import { decide } from '@/lib/sync/merge';
import { BOOLEAN_COLUMNS, SYNC_TABLES } from '@/lib/sync/tables';

jest.mock('@/lib/db/client', () => {
  const helpers = require('../helpers/sqlite');
  const testDb = helpers.createTestDb();
  return { ...helpers.clientModule(testDb), testDb };
});
const db = (jest.requireMock('@/lib/db/client') as { testDb: TestDb }).testDb.sqlite;

const T = '2026-09-01T12:00:00.000Z';
const media = (id: string, vehicleId: string) =>
  db
    .prepare(`INSERT INTO media (id, owner_table, owner_id, kind, mime, created_at, updated_at) VALUES (?, 'vehicle', ?, 'photo', 'image/jpeg', ?, ?)`)
    .run(id, vehicleId, T, T);

const base = (over: Partial<VehicleDraft> = {}): VehicleDraft => ({
  id: 'veh_rt',
  name: 'Ruta',
  type: 'carro',
  make: null,
  model: null,
  year: null,
  color: null,
  plate: null,
  vin: null,
  defaultFuelType: 'regular',
  tankVolume: null,
  odometerKm: 100_000,
  synthetic: false,
  purchaseDate: null,
  purchasePrice: null,
  photoMediaId: null,
  notes: '',
  nickname: null,
  status: 'activo',
  chassisCode: null,
  chassisNumber: null,
  engineCode: null,
  transmission: null,
  drivetrain: null,
  origin: null,
  importedYear: null,
  story: '',
  ...over,
});

/** Every field away from its default. */
const FULL: VehicleDraft = base({
  name: 'Ruta 2',
  type: 'carro',
  bodyType: 'suv',
  make: 'Toyota',
  makeId: 'toyota',
  model: 'Corolla',
  modelId: 'toyota-corolla',
  year: 2012,
  color: 'Azul',
  colorId: 'azul',
  interiorColorId: 'interior-beige',
  interiorMaterial: 'cuero',
  plate: 'A123456',
  vin: 'JT2AE91A5M0000001',
  defaultFuelType: 'premium',
  volumeUnit: 'l',
  economyUnit: 'l_100km',
  tankVolume: 50,
  reserveVolume: 7,
  odometerKm: 83_210,
  synthetic: true,
  purchaseDate: '2020-03-15',
  purchasePrice: 875_000,
  photoMediaId: 'rt_m1',
  galleryIds: ['rt_m1', 'rt_m2'],
  notes: 'nota larga',
  nickname: 'Rojito',
  status: 'proyecto',
  statusNote: 'esperando piezas',
  statusSince: '2026-08-12',
  chassisCode: 'E150',
  chassisNumber: 'X123',
  engineCode: '1NZ-FE',
  transmission: 'manual',
  drivetrain: 'rwd',
  origin: 'jdm',
  importedYear: 2015,
  story: 'historia',
  gaugeType: 'segments',
  gaugeSegments: 9,
  gaugeReserveAt: 2,
});

const oilReminder = async (vehicleId: string) => (await reminderRepo.listWhere({ vehicleId, serviceTypeId: 'aceite_motor' }))[0];
async function reopen(id: string) {
  const v = (await vehicleRepo.getById(id))!;
  return draftFromVehicle(v, await currentOdometer(id), (await vehicleGallery(id)).map((g) => g.mediaId));
}

beforeAll(async () => {
  await seedCatalog();
});

describe('N5 — ¿Aceite sintético?', () => {
  it('marked on an existing vehicle: still marked when the editor reopens, and the oil reminder is 10,000 km / 12 months', async () => {
    await saveVehicleDraft(base({ id: 'veh_syn' }));
    expect(await oilReminder('veh_syn')).toMatchObject({ intervalKm: 5000, intervalMonths: 6 });

    await saveVehicleDraft(base({ id: 'veh_syn', synthetic: true }));

    expect((await reopen('veh_syn')).synthetic).toBe(true);
    expect(await oilReminder('veh_syn')).toMatchObject({ intervalKm: 10_000, intervalMonths: 12, dueKm: 110_000 });
  });

  it('survives a second save (a row read back from SQLite)', async () => {
    await saveVehicleDraft(base({ id: 'veh_syn', synthetic: true, notes: 'otra cosa' }));
    expect((await reopen('veh_syn')).synthetic).toBe(true);
    expect(await oilReminder('veh_syn')).toMatchObject({ intervalKm: 10_000, dueKm: 110_000 });
  });

  it('unmarked: back to the catalog interval, and the last change is not lost', async () => {
    const r = await oilReminder('veh_syn');
    await reminderRepo.upsert({ id: r.id, lastCompletedKm: 98_000, lastCompletedAt: '2026-09-01T12:00:00.000Z', dueKm: 108_000 });

    await saveVehicleDraft(base({ id: 'veh_syn', synthetic: false }));

    expect((await reopen('veh_syn')).synthetic).toBe(false);
    expect(await oilReminder('veh_syn')).toMatchObject({ intervalKm: 5000, intervalMonths: 6, dueKm: 103_000, lastCompletedKm: 98_000 });
  });

  it('a new vehicle created synthetic opens synthetic', async () => {
    await saveVehicleDraft(base({ id: 'veh_new', synthetic: true }));
    expect((await reopen('veh_new')).synthetic).toBe(true);
    expect(await oilReminder('veh_new')).toMatchObject({ intervalKm: 10_000, intervalMonths: 12 });
  });

  it('the sync guard: an older remote default never overwrites a newer local "marked"', async () => {
    await saveVehicleDraft(base({ id: 'veh_guard', synthetic: true }));
    const local = (await dirtyRows('vehicle')).find((r) => r.id === 'veh_guard')!;
    const older = new Date(new Date(local.updated_at as string).getTime() - 60_000).toISOString();
    expect(
      decide(
        { id: 'veh_guard', updatedAt: local.updated_at as string, syncedAt: null },
        { id: 'veh_guard', updatedAt: older, serverUpdatedAt: older, deletedAt: null },
      ),
    ).not.toBe('apply');
  });
});

describe('ADR-63 — round trip of every VehicleDraft field', () => {
  beforeAll(async () => {
    await saveVehicleDraft(base()); // exists first, so FULL is an edit
    media('rt_m1', 'veh_rt');
    media('rt_m2', 'veh_rt');
  });

  const compare = (got: Partial<VehicleDraft>, skip: string[] = []) => {
    for (const key of Object.keys(FULL) as (keyof VehicleDraft)[]) {
      if (skip.includes(key)) continue;
      const want = FULL[key];
      const have = got[key];
      if (typeof want === 'number' && typeof have === 'number') expect([key, Math.round(have * 100) / 100]).toEqual([key, want]);
      else expect([key, have]).toEqual([key, want]);
    }
  };

  it('form → SQLite → editor: nothing is lost', async () => {
    await saveVehicleDraft(FULL);
    compare(await reopen('veh_rt'));
  });

  it('…and again after saving what the editor shows, with no change', async () => {
    await saveVehicleDraft({ ...FULL, ...(await reopen('veh_rt')) } as VehicleDraft);
    compare(await reopen('veh_rt'));
  });

  it('push → pull: a second phone opens the same editor', async () => {
    const table = SYNC_TABLES.find((x) => x.name === 'vehicle')!;
    const row = (await dirtyRows('vehicle')).find((r) => r.id === 'veh_rt')!;
    const cloud = toCloudShape(row, table.localOnly, 'user-1', BOOLEAN_COLUMNS.vehicle);
    // What PostgREST returns: the same row, timestamptz spelled with an offset, a server stamp.
    const pulled = { ...cloud, id: 'veh_pulled', updated_at: String(cloud.updated_at).replace('Z', '+00:00'), server_updated_at: '2026-10-16T12:00:00+00:00' };
    await applyRemoteRows('vehicle', [pulled]);
    const v = (await vehicleRepo.getById('veh_pulled'))!;
    compare(draftFromVehicle(v, null, []), ['id', 'odometerKm', 'photoMediaId', 'galleryIds']);
  });
});
