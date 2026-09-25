/**
 * The sync engine's local half against a real SQLite (see helpers/sqlite.ts).
 * Every case here is a bug that lost or resurrected data before 2026-09-25.
 */
import type { TestDb } from '../helpers/sqlite';
import { seedCatalog } from '@/lib/db/seed';
import { applyRemoteRows, dirtyRows, markAllUnsynced, markSynced, toCloudShape } from '@/lib/db/syncOps';
import { BOOLEAN_COLUMNS } from '@/lib/sync/tables';

// Hoisted above the imports by jest, so the database is created inside the
// factory and read back through the mocked module.
jest.mock('@/lib/db/client', () => {
  const helpers = require('../helpers/sqlite');
  const testDb = helpers.createTestDb();
  return { ...helpers.clientModule(testDb), testDb };
});
const db = (jest.requireMock('@/lib/db/client') as { testDb: TestDb }).testDb.sqlite;
const T1 = '2026-09-25T12:00:00.000Z';
const T2 = '2026-09-25T12:00:05.000Z';

function vehicle(id: string, updatedAt = T1, syncedAt: string | null = null) {
  db.prepare(
    `INSERT INTO vehicle (id, name, type, default_fuel_type, created_at, updated_at, synced_at)
     VALUES (?, ?, 'carro', 'regular', ?, ?, ?)`,
  ).run(id, id, T1, updatedAt, syncedAt);
}
const dirtyIds = async (table: string) => (await dirtyRows(table)).map((r) => r.id);

describe('markSynced', () => {
  it('marks a pushed row clean', async () => {
    vehicle('veh_clean');
    const [row] = (await dirtyRows('vehicle')).filter((r) => r.id === 'veh_clean');
    await markSynced('vehicle', [{ id: 'veh_clean', updatedAt: row.updated_at as string }]);
    expect(await dirtyIds('vehicle')).not.toContain('veh_clean');
  });

  it('keeps an edit made during the upload dirty', async () => {
    vehicle('veh_race');
    const [pushed] = (await dirtyRows('vehicle')).filter((r) => r.id === 'veh_race');
    // The user renames the car while the push is in flight…
    db.prepare(`UPDATE vehicle SET name = 'renamed', updated_at = ? WHERE id = 'veh_race'`).run(T2);
    // …and the push then succeeds for the version it read.
    await markSynced('vehicle', [{ id: 'veh_race', updatedAt: pushed.updated_at as string }]);
    // Before the fix `synced_at = updated_at` stamped the rename as synced.
    expect(await dirtyIds('vehicle')).toContain('veh_race');
  });
});

describe('applyRemoteRows', () => {
  it('parks a child whose parent is missing and still applies its siblings', async () => {
    vehicle('veh_parent', T1, T1);
    const child = (id: string, vehicleId: string) => ({
      id,
      vehicle_id: vehicleId,
      occurred_at: '2026-09-20T16:00:00+00:00',
      value_km: 1000,
      source: 'manual',
      created_at: '2026-09-20T16:00:00+00:00',
      updated_at: '2026-09-20T16:00:00.123+00:00',
      server_updated_at: '2026-09-20T16:00:01.456789+00:00',
      user_id: 'u1',
    });
    const result = await applyRemoteRows('odometer_reading', [
      child('odo_ok', 'veh_parent'),
      child('odo_orphan', 'veh_not_here_yet'),
    ]);
    expect(result.applied).toBe(1);
    expect(result.parked.map((r) => r.id)).toEqual(['odo_orphan']);
    expect(db.prepare(`SELECT COUNT(*) AS n FROM odometer_reading WHERE id = 'odo_ok'`).get()).toEqual({ n: 1 });
  });

  it('stores server timestamps the way the app writes them', async () => {
    const row = db.prepare(`SELECT occurred_at, updated_at, synced_at FROM odometer_reading WHERE id = 'odo_ok'`).get() as Record<string, string>;
    expect(row.occurred_at).toBe('2026-09-20T16:00:00.000Z');
    expect(row.updated_at).toBe('2026-09-20T16:00:00.123Z');
    // Arrives clean: it *is* what the server holds.
    expect(row.synced_at).toBe(row.updated_at);
  });
});

describe('markAllUnsynced (after "Borrar datos en la nube")', () => {
  it('makes every row and photo go up again on the next sync', async () => {
    db.prepare(
      `INSERT INTO media (id, owner_table, owner_id, kind, mime, remote_path, created_at, updated_at, synced_at)
       VALUES ('m1', 'vehicle', 'veh_parent', 'photo', 'image/jpeg', 'u1/m1.jpg', ?, ?, ?)`,
    ).run(T1, T1, T1);
    expect(await dirtyIds('vehicle')).not.toContain('veh_parent');

    await markAllUnsynced(['vehicle', 'odometer_reading', 'media']);

    expect(await dirtyIds('vehicle')).toContain('veh_parent');
    expect(await dirtyIds('odometer_reading')).toContain('odo_ok');
    expect(db.prepare(`SELECT remote_path FROM media WHERE id = 'm1'`).get()).toEqual({ remote_path: null });
  });
});

describe('seedCatalog', () => {
  const catalogTables = ['service_type', 'inspection_template', 'inspection_item'];

  it('writes nothing when the catalog is already up to date', async () => {
    await seedCatalog();
    // Pretend a sync pushed it all.
    for (const t of catalogTables) db.exec(`UPDATE ${t} SET synced_at = updated_at`);

    await seedCatalog(); // the next launch

    // Before the fix every launch re-dirtied ~70 rows with a fresh timestamp,
    // which then won last-write-wins against edits made on other devices.
    for (const t of catalogTables) expect(`${t}:${(await dirtyRows(t)).length}`).toBe(`${t}:0`);
  });

  it('still repairs a seeded row that drifted from the catalog', async () => {
    db.exec(`UPDATE service_type SET name = 'Algo raro', synced_at = updated_at WHERE id = 'aceite_motor'`);
    await seedCatalog();
    expect(await dirtyIds('service_type')).toEqual(['aceite_motor']);
  });
});

describe('toCloudShape → applyRemoteRows', () => {
  it('a fill-up survives the round trip to the cloud and back', async () => {
    db.prepare(
      `INSERT INTO fuel_log (id, vehicle_id, occurred_at, odometer_km, fuel_type, volume, price_per_unit,
         total_dop, is_full_tank, missed_previous, station, notes, created_at, updated_at, synced_at)
       VALUES ('fuel_rt', 'veh_parent', ?, 52000, 'regular', 11.4, 305.9, 3487.26, 0, 1, 'Texaco', 'ñ', ?, ?, NULL)`,
    ).run(T1, T1, T2);
    const [local] = (await dirtyRows('fuel_log')).filter((r) => r.id === 'fuel_rt');

    const cloud = toCloudShape(local, ['syncedAt'], 'user-1', BOOLEAN_COLUMNS.fuel_log);
    // What PostgREST expects: real booleans, the owner, no local bookkeeping.
    expect(cloud.is_full_tank).toBe(false);
    expect(cloud.missed_previous).toBe(true);
    expect(cloud.user_id).toBe('user-1');
    expect('synced_at' in cloud).toBe(false);

    db.exec(`DELETE FROM fuel_log WHERE id = 'fuel_rt'`);
    // …and what comes back down, the way the server returns it.
    await applyRemoteRows('fuel_log', [
      { ...cloud, created_at: '2026-09-25T12:00:00+00:00', server_updated_at: '2026-09-25T12:00:06+00:00' },
    ]);
    const back = db.prepare(`SELECT * FROM fuel_log WHERE id = 'fuel_rt'`).get() as Record<string, unknown>;
    for (const column of Object.keys(local)) {
      if (column === 'synced_at') continue;
      expect(`${column}=${String(back[column])}`).toBe(`${column}=${String(local[column])}`);
    }
  });
});
