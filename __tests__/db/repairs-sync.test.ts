/**
 * v12 through the sync engine's local half (IMP 16102026 Phase 5): a repair and its photo links go up in the cloud's
 * shape and come back down on another phone; a cloud row from a phone that does not know a column still applies; a
 * link whose record has not arrived yet waits (parked) instead of failing.
 */
import type { TestDb } from '../helpers/sqlite';
import { applyRemoteRows, dirtyRows, toCloudShape } from '@/lib/db/syncOps';
import { SYNC_TABLES } from '@/lib/sync/tables';

jest.mock('@/lib/db/client', () => {
  const helpers = require('../helpers/sqlite');
  const testDb = helpers.createTestDb();
  return { ...helpers.clientModule(testDb), testDb };
});
const db = (jest.requireMock('@/lib/db/client') as { testDb: TestDb }).testDb.sqlite;
const T = '2026-10-17T12:00:00.000Z';

beforeAll(() => {
  db.prepare(`INSERT INTO vehicle (id, name, type, default_fuel_type, created_at, updated_at) VALUES ('v1', 'v1', 'carro', 'regular', ?, ?)`).run(T, T);
});

const record = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  vehicle_id: 'v1',
  kind: 'reparacion',
  occurred_at: '2026-10-10T16:00:00+00:00',
  title: 'Alternador',
  description: '',
  cost_parts_dop: 4500,
  cost_labor_dop: 0,
  total_dop: 4500,
  shop: '',
  created_at: '2026-10-10T16:00:00+00:00',
  updated_at: '2026-10-10T16:00:00.100+00:00',
  server_updated_at: '2026-10-10T16:00:01.000000+00:00',
  user_id: 'u1',
  ...extra,
});

const link = (id: string, recordId: string, role = 'before') => ({
  id,
  service_record_id: recordId,
  media_id: `m_${id}`,
  role,
  sort: 0,
  created_at: '2026-10-10T16:00:00+00:00',
  updated_at: '2026-10-10T16:00:00.200+00:00',
  server_updated_at: '2026-10-10T16:00:02.000000+00:00',
  user_id: 'u1',
});

describe('sync order', () => {
  it('service_media comes after service_record (its local FK)', () => {
    const names = SYNC_TABLES.map((t) => t.name);
    expect(names.indexOf('service_media')).toBeGreaterThan(names.indexOf('service_record'));
  });
});

describe('down: another phone', () => {
  it('applies done_by, system and the photo links', async () => {
    await applyRemoteRows('service_record', [record('r_down', { done_by: 'self', system: 'electrico' })]);
    const res = await applyRemoteRows('service_media', [link('sm_a', 'r_down', 'before'), link('sm_b', 'r_down', 'invoice')]);
    expect(res.applied).toBe(2);
    expect(db.prepare(`SELECT done_by, system FROM service_record WHERE id = 'r_down'`).get()).toEqual({ done_by: 'self', system: 'electrico' });
    expect(db.prepare(`SELECT role FROM service_media WHERE service_record_id = 'r_down' ORDER BY id`).all()).toEqual([{ role: 'before' }, { role: 'invoice' }]);
  });

  it('a row from an older phone (no done_by, no system) applies with the defaults', async () => {
    await applyRemoteRows('service_record', [record('r_old')]);
    expect(db.prepare(`SELECT done_by, system FROM service_record WHERE id = 'r_old'`).get()).toEqual({ done_by: 'shop', system: null });
  });

  it('a link that arrives before its record waits, and applies once the record is there', async () => {
    const first = await applyRemoteRows('service_media', [link('sm_wait', 'r_late')]);
    expect(first.applied).toBe(0);
    expect(first.parked.map((r) => r.id)).toEqual(['sm_wait']);
    await applyRemoteRows('service_record', [record('r_late')]);
    const second = await applyRemoteRows('service_media', first.parked);
    expect(second.applied).toBe(1);
  });
});

describe('up: this phone', () => {
  it('a new link is dirty and goes up in the cloud shape (snake_case, no synced_at)', async () => {
    db.prepare(`INSERT INTO service_record (id, vehicle_id, kind, occurred_at, title, done_by, system, created_at, updated_at) VALUES ('r_up', 'v1', 'reparacion', ?, 'Frenos', 'shop', 'frenos', ?, ?)`).run(T, T, T);
    db.prepare(`INSERT INTO service_media (id, service_record_id, media_id, role, sort, created_at, updated_at) VALUES ('sm_up', 'r_up', 'm_up', 'after', 1, ?, ?)`).run(T, T);
    const dirtyLinks = await dirtyRows('service_media');
    expect(dirtyLinks.map((r) => r.id)).toContain('sm_up');
    const cloud = toCloudShape(dirtyLinks.find((r) => r.id === 'sm_up')!, ['syncedAt'], 'u1', [], true);
    expect(cloud).toMatchObject({ id: 'sm_up', service_record_id: 'r_up', media_id: 'm_up', role: 'after', sort: 1 });
    expect(cloud).not.toHaveProperty('synced_at');
    const rec = toCloudShape((await dirtyRows('service_record')).find((r) => r.id === 'r_up')!, ['syncedAt'], 'u1', [], true);
    expect(rec).toMatchObject({ done_by: 'shop', system: 'frenos' });
  });
});
