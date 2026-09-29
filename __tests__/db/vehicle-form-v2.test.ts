/**
 * The vehicle form v2 (IMP 29092026 Phase 3) through saveVehicleDraft, on a
 * real SQLite: units, the gallery, and the status milestone.
 */
import type { TestDb } from '../helpers/sqlite';
import { seedCatalog } from '@/lib/db/seed';
import { vehicleGallery } from '@/lib/db/tripOps';
import { saveVehicleDraft, setVehicleStatus } from '@/lib/db/vehicleOps';
import { GAL_L } from '@/lib/domain/units';
import type { VehicleDraft } from '@/components/VehicleForm';

jest.mock('@/lib/db/client', () => {
  const helpers = require('../helpers/sqlite');
  const testDb = helpers.createTestDb();
  return { ...helpers.clientModule(testDb), testDb };
});
const db = (jest.requireMock('@/lib/db/client') as { testDb: TestDb }).testDb.sqlite;
const row = (sql: string, ...p: string[]) => db.prepare(sql).get(...p) as Record<string, unknown>;
const all = (sql: string, ...p: string[]) => db.prepare(sql).all(...p) as Record<string, unknown>[];

const T = '2026-09-01T12:00:00.000Z';
function media(id: string) {
  db.prepare(
    `INSERT INTO media (id, owner_table, owner_id, kind, mime, created_at, updated_at) VALUES (?, 'vehicle', 'veh_c3', 'photo', 'image/jpeg', ?, ?)`,
  ).run(id, T, T);
}

const draft = (over: Partial<VehicleDraft> = {}): VehicleDraft => ({
  id: 'veh_c3',
  name: 'C3',
  type: 'carro',
  make: 'Citroën',
  makeId: 'citroen',
  model: 'C3',
  modelId: 'citroen-c3',
  year: 2003,
  color: 'Rojo',
  colorId: 'rojo',
  plate: null,
  vin: null,
  defaultFuelType: 'regular',
  volumeUnit: 'gal',
  tankVolume: 12,
  odometerKm: 150000,
  synthetic: false,
  purchaseDate: null,
  purchasePrice: 180000,
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
  bodyType: 'hatchback',
  ...over,
});

beforeAll(async () => {
  await seedCatalog();
  ['m1', 'm2', 'm3'].forEach(media);
});

it('saves the pickers\' ids beside the text, and the tank in liters', async () => {
  await saveVehicleDraft(draft({ galleryIds: ['m1', 'm2', 'm3'], photoMediaId: 'm1' }));
  const v = row(`SELECT * FROM vehicle WHERE id = 'veh_c3'`);
  expect(v).toMatchObject({ make: 'Citroën', make_id: 'citroen', model_id: 'citroen-c3', color_id: 'rojo', body_type: 'hatchback', type: 'carro', volume_unit: 'gal', economy_unit: 'km_gal', tank_volume_entered: 12, purchase_price: 180000 });
  expect(v.tank_volume).toBeCloseTo(12 * GAL_L, 5);
});

it('writes the gallery in order, with the cover', async () => {
  expect((await vehicleGallery('veh_c3')).map((i) => i.mediaId)).toEqual(['m1', 'm2', 'm3']);
  expect(row(`SELECT photo_media_id FROM vehicle WHERE id = 'veh_c3'`).photo_media_id).toBe('m1');
});

it('reorders and drops photos; a dropped photo leaves the gallery, not the database', async () => {
  await saveVehicleDraft(draft({ galleryIds: ['m3', 'm1'], photoMediaId: 'm3' }));
  expect((await vehicleGallery('veh_c3')).map((i) => i.mediaId)).toEqual(['m3', 'm1']);
  expect(row(`SELECT COUNT(*) AS n FROM media WHERE id = 'm2'`).n).toBe(1);
  expect(all(`SELECT id FROM album_item WHERE media_id = 'm2' AND deleted_at IS NULL`)).toHaveLength(0);
});

it('the same tank in liters stores the same liters (the L | gal toggle)', async () => {
  await saveVehicleDraft(draft({ volumeUnit: 'l', tankVolume: 12 * GAL_L }));
  const v = row(`SELECT tank_volume, volume_unit, economy_unit FROM vehicle WHERE id = 'veh_c3'`);
  expect(v).toMatchObject({ volume_unit: 'l', economy_unit: 'km_l' });
  expect(v.tank_volume).toBeCloseTo(12 * GAL_L, 5);
});

it('a status change from the form is a milestone "estado", with the note', async () => {
  await saveVehicleDraft(draft({ status: 'accidentado', statusSince: '2026-08-12', statusNote: 'esperando piezas' }));
  const v = row(`SELECT status, status_since, status_note, is_archived FROM vehicle WHERE id = 'veh_c3'`);
  expect(v).toMatchObject({ status: 'accidentado', status_since: '2026-08-12', status_note: 'esperando piezas', is_archived: 0 });
  const m = all(`SELECT title, story, occurred_at FROM milestone WHERE vehicle_id = 'veh_c3' AND kind = 'estado'`);
  expect(m).toEqual([{ title: 'Cambió a ACCIDENTADO · esperando piezas', story: 'esperando piezas', occurred_at: '2026-08-12' }]);
});

it('saving again without a change writes no second milestone; activo clears since and note', async () => {
  await saveVehicleDraft(draft({ status: 'accidentado', statusSince: '2026-08-12', statusNote: 'esperando piezas' }));
  expect(all(`SELECT id FROM milestone WHERE vehicle_id = 'veh_c3' AND kind = 'estado'`)).toHaveLength(1);
  await saveVehicleDraft(draft({ status: 'activo' }));
  expect(row(`SELECT status_since, status_note FROM vehicle WHERE id = 'veh_c3'`)).toEqual({ status_since: null, status_note: '' });
  expect(all(`SELECT id FROM milestone WHERE vehicle_id = 'veh_c3' AND kind = 'estado'`)).toHaveLength(2);
});

it('the hub\'s "Cambiar estado" writes the same kind of milestone', async () => {
  await setVehicleStatus('veh_c3', 'en_taller', 'cambio de clutch');
  const titles = all(`SELECT title FROM milestone WHERE vehicle_id = 'veh_c3' AND kind = 'estado' ORDER BY created_at`).map((r) => r.title);
  expect(titles.at(-1)).toBe('Cambió a EN EL TALLER · cambio de clutch');
});
