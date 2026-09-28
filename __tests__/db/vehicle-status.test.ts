/**
 * Status changes and the sale (IMP 28092026 Phase 2) against a real SQLite.
 */
import type { TestDb } from '../helpers/sqlite';
import { seedCatalog } from '@/lib/db/seed';
import { garageFacts } from '@/lib/db/garageQueries';
import { saveVehicleDraft, sellVehicle, setVehicleStatus } from '@/lib/db/vehicleOps';
import type { VehicleDraft } from '@/components/VehicleForm';

jest.mock('@/lib/db/client', () => {
  const helpers = require('../helpers/sqlite');
  const testDb = helpers.createTestDb();
  return { ...helpers.clientModule(testDb), testDb };
});
const db = (jest.requireMock('@/lib/db/client') as { testDb: TestDb }).testDb.sqlite;
const row = (sql: string, ...p: string[]) => db.prepare(sql).get(...p) as Record<string, unknown>;

const draft = (over: Partial<VehicleDraft> = {}): VehicleDraft => ({
  id: 'veh_status',
  name: 'Civic',
  type: 'carro',
  make: 'Honda',
  model: 'Civic',
  year: 1998,
  color: null,
  plate: null,
  vin: null,
  defaultFuelType: 'regular',
  tankVolume: null,
  odometerKm: 180000,
  synthetic: false,
  purchaseDate: '2019-06-15T12:00:00.000Z',
  purchasePrice: 250000,
  photoMediaId: null,
  notes: '',
  nickname: 'el ek',
  status: 'activo',
  chassisCode: 'EK',
  chassisNumber: null,
  engineCode: 'B16A',
  transmission: 'manual',
  drivetrain: 'fwd',
  origin: 'jdm',
  importedYear: 2012,
  story: '',
  ...over,
});

beforeAll(async () => {
  await seedCatalog();
  await saveVehicleDraft(draft());
});

it('a new vehicle gets its identity, an ownership period and a ficha', () => {
  expect(row('SELECT * FROM vehicle WHERE id = ?', 'veh_status')).toMatchObject({ nickname: 'el ek', chassis_code: 'EK', engine_code: 'B16A', status: 'activo', is_archived: 0 });
  expect(row('SELECT * FROM vehicle_ownership WHERE id = ?', 'own_veh_status')).toMatchObject({ acquired_price: 250000, is_current: 1 });
  expect(row('SELECT id FROM vehicle_specsheet WHERE id = ?', 'veh_status')).toBeDefined();
});

it('guardado archives; proyecto and activo do not', async () => {
  await setVehicleStatus('veh_status', 'guardado');
  expect(row('SELECT status, is_archived FROM vehicle WHERE id = ?', 'veh_status')).toEqual({ status: 'guardado', is_archived: 1 });
  await setVehicleStatus('veh_status', 'proyecto');
  expect(row('SELECT status, is_archived FROM vehicle WHERE id = ?', 'veh_status')).toEqual({ status: 'proyecto', is_archived: 0 });
});

it('editing keeps the status the form was given', async () => {
  await saveVehicleDraft(draft({ status: 'proyecto', story: 'En pintura.' }));
  expect(row('SELECT status, story FROM vehicle WHERE id = ?', 'veh_status')).toEqual({ status: 'proyecto', story: 'En pintura.' });
});

it('selling closes the ownership period and makes it an Ex', async () => {
  await sellVehicle('veh_status', { soldAt: '2026-09-01T12:00:00.000Z', soldKm: 185000, soldPrice: 300000, soldTo: 'Un pana', reason: 'Espacio' });
  expect(row('SELECT status, is_archived, sold_price FROM vehicle WHERE id = ?', 'veh_status')).toEqual({ status: 'vendido', is_archived: 1, sold_price: 300000 });
  expect(row('SELECT sold_at, sold_km, sold_to, reason, acquired_price FROM vehicle_ownership WHERE id = ?', 'own_veh_status')).toEqual({
    sold_at: '2026-09-01T12:00:00.000Z',
    sold_km: 185000,
    sold_to: 'Un pana',
    reason: 'Espacio',
    acquired_price: 250000,
  });
  expect(row("SELECT value_km FROM odometer_reading WHERE id = 'odo_sale_veh_status'")).toEqual({ value_km: 185000 });
});

it('the cover falls back to the first favourite album photo', async () => {
  expect((await garageFacts('veh_status')).favoriteMediaId).toBeNull();
  const now = '2026-09-28T12:00:00.000Z';
  const media = db.prepare(
    "INSERT INTO media (id, owner_table, owner_id, kind, mime, created_at, updated_at, is_favorite, taken_at) VALUES (?, 'vehicle', 'veh_status', 'photo', 'image/jpeg', ?, ?, ?, ?)",
  );
  const item = db.prepare('INSERT INTO album_item (id, vehicle_id, media_id, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)');
  media.run('m_plain', now, now, 0, '2020-01-01');
  media.run('m_fav', now, now, 1, '2021-01-01');
  item.run('a1', 'veh_status', 'm_plain', 0, now, now);
  item.run('a2', 'veh_status', 'm_fav', 1, now, now);
  const facts = await garageFacts('veh_status');
  expect(facts.favoriteMediaId).toBe('m_fav');
  expect(facts.photos).toBe(2);
});
