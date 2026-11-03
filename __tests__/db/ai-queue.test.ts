/**
 * Schema v13 + lib/db/aiQueueOps.ts (IMP 03112026 SPEC-B §B7.6): the Fuel Express offline queue against a real SQLite.
 */
import type { TestDb } from '../helpers/sqlite';
import {
  AI_JOB_TTL_DAYS,
  dropAiJob,
  enqueueAiJob,
  expireOldJobs,
  getAiJob,
  listAiJobs,
  markFailed,
  markProcessing,
  markReady,
  requeue,
  retryLater,
} from '@/lib/db/aiQueueOps';
import { LATEST_VERSION, MIGRATIONS } from '@/lib/db/migrations';
import { resetDatabase } from '@/lib/db/reset';

jest.mock('@/lib/db/client', () => {
  const helpers = require('../helpers/sqlite');
  const testDb = helpers.createTestDb();
  return { ...helpers.clientModule(testDb), testDb };
});
const db = (jest.requireMock('@/lib/db/client') as { testDb: TestDb }).testDb.sqlite;

const job = { kind: 'fuel_express' as const, vehicleId: 'veh_1', imagesB64: ['AAAA', 'BBBB'], imageUris: ['file:///a.jpg'] };

describe('migration v13', () => {
  it('is the latest and creates a local-only queue table', () => {
    expect(LATEST_VERSION).toBe(13);
    expect(MIGRATIONS.at(-1)?.version).toBe(13);
    const cols = (db.prepare('PRAGMA table_info(ai_queue)').all() as { name: string }[]).map((c) => c.name);
    expect(cols).toEqual(expect.arrayContaining(['id', 'kind', 'vehicle_id', 'images_b64', 'image_uris', 'status', 'attempts', 'result_json', 'error_code', 'created_at', 'updated_at']));
  });
  it('is not a synced table (no deleted_at / synced_at columns, never uploaded)', () => {
    const cols = (db.prepare('PRAGMA table_info(ai_queue)').all() as { name: string }[]).map((c) => c.name);
    expect(cols).not.toContain('synced_at');
    expect(cols).not.toContain('deleted_at');
  });
  it('refuses a status or a kind it does not know', () => {
    expect(() => db.prepare(`INSERT INTO ai_queue (id, kind, vehicle_id, images_b64, status, created_at, updated_at) VALUES ('x','fuel_express','v','[]','weird','t','t')`).run()).toThrow();
    expect(() => db.prepare(`INSERT INTO ai_queue (id, kind, vehicle_id, images_b64, created_at, updated_at) VALUES ('y','chat','v','[]','t','t')`).run()).toThrow();
  });
});

describe('aiQueueOps', () => {
  beforeEach(() => {
    db.exec('DELETE FROM ai_queue');
  });

  it('enqueue → queued, photos round-trip as arrays', async () => {
    const id = await enqueueAiJob(job);
    const j = (await getAiJob(id))!;
    expect(j).toMatchObject({ kind: 'fuel_express', vehicleId: 'veh_1', status: 'queued', attempts: 0, resultJson: null });
    expect(j.imagesB64).toEqual(['AAAA', 'BBBB']);
    expect(j.imageUris).toEqual(['file:///a.jpg']);
  });

  it('lists by status in creation order', async () => {
    const a = await enqueueAiJob(job);
    const b = await enqueueAiJob(job);
    expect((await listAiJobs(['queued'])).map((j) => j.id)).toEqual([a, b]);
    expect(await listAiJobs([])).toEqual([]);
    await markReady(a, '{"ok":true}');
    expect((await listAiJobs(['queued'])).map((j) => j.id)).toEqual([b]);
    expect((await listAiJobs(['ready']))[0].resultJson).toBe('{"ok":true}');
  });

  it('a missing network requeues WITHOUT consuming an attempt; a hiccup consumes one', async () => {
    const id = await enqueueAiJob(job);
    await markProcessing(id);
    await requeue(id);
    expect((await getAiJob(id))!.attempts).toBe(0);
    await retryLater(id, 'provider_error');
    const j = (await getAiJob(id))!;
    expect(j).toMatchObject({ status: 'queued', attempts: 1, errorCode: 'provider_error' });
  });

  it('failed keeps the code and counts the attempt', async () => {
    const id = await enqueueAiJob(job);
    await markFailed(id, 'unreadable');
    expect(await getAiJob(id)).toMatchObject({ status: 'failed', errorCode: 'unreadable', attempts: 1 });
  });

  it('"Llenarlo a mano" drops the job and wipes its photos', async () => {
    const id = await enqueueAiJob(job);
    await dropAiJob(id);
    const j = (await getAiJob(id))!;
    expect(j.status).toBe('dropped');
    expect(j.imagesB64).toEqual([]);
    expect(j.imageUris).toEqual([]);
  });

  it('jobs older than 7 days expire (photos wiped); fresh ones and finished ones are untouched', async () => {
    const old = await enqueueAiJob(job);
    const fresh = await enqueueAiJob(job);
    const dropped = await enqueueAiJob(job);
    await dropAiJob(dropped);
    const eightDays = new Date(Date.now() - (AI_JOB_TTL_DAYS + 1) * 86_400_000).toISOString();
    db.prepare('UPDATE ai_queue SET created_at = ? WHERE id = ?').run(eightDays, old);
    expect(await expireOldJobs()).toBe(1);
    expect((await getAiJob(old))!).toMatchObject({ status: 'expired', imagesB64: [] });
    expect((await getAiJob(fresh))!.status).toBe('queued');
    expect((await getAiJob(dropped))!.status).toBe('dropped');
  });

  it('"Borrar datos locales" clears the queue too', async () => {
    await enqueueAiJob(job);
    await resetDatabase();
    expect((db.prepare('SELECT COUNT(*) AS n FROM ai_queue').get() as { n: number }).n).toBe(0);
  });
});
