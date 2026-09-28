/**
 * The album's SQL and the photo upload path (IMP 28092026 Phase 3) against a
 * real SQLite. Web byte storage (blob / thumb_blob) so no filesystem is needed.
 */
import type { TestDb } from '../helpers/sqlite';
import { seedCatalog } from '@/lib/db/seed';
import {
  albumPhotos,
  deleteMilestone,
  deletePhoto,
  findAlbumDupShapes,
  linkPhotosToMilestone,
  milestonePhotoIds,
  saveMilestone,
  setPhotoDate,
  timelineEvents,
} from '@/lib/db/albumQueries';
import { deletedMediaInStorage } from '@/lib/db/syncOps';
import { buildTimeline } from '@/lib/domain/album';
import { removeDeletedMediaBytes, uploadMediaBytes } from '@/lib/sync/mediaBytes';
import { readStorageMeter, writeStorageMeter } from '@/lib/sync/storageMeter';

jest.mock('react-native', () => ({ Platform: { OS: 'web' } }));
jest.mock('@/lib/cloud/supabase', () => ({ getSupabase: () => null }));
jest.mock('@/lib/db/client', () => {
  const helpers = require('../helpers/sqlite');
  const testDb = helpers.createTestDb();
  return { ...helpers.clientModule(testDb), testDb };
});
const db = (jest.requireMock('@/lib/db/client') as { testDb: TestDb }).testDb.sqlite;
const T = '2026-09-28T12:00:00.000Z';
const row = (sql: string, ...p: string[]) => db.prepare(sql).get(...p) as Record<string, unknown>;

function photo(id: string, takenAt: string | null, opts: { album?: boolean; owner?: [string, string]; size?: number } = {}) {
  const [ownerTable, ownerId] = opts.owner ?? ['vehicle', 'veh_a'];
  db.prepare(
    `INSERT INTO media (id, owner_table, owner_id, kind, mime, blob, thumb_blob, width, height, size_bytes, taken_at, created_at, updated_at)
     VALUES (?, ?, ?, 'photo', 'image/jpeg', ?, ?, 1600, 1200, ?, ?, ?, ?)`,
  ).run(id, ownerTable, ownerId, new Uint8Array([1, 2, 3]), new Uint8Array([9]), opts.size ?? 3, takenAt, T, T);
  if (opts.album !== false) {
    db.prepare(`INSERT INTO album_item (id, vehicle_id, media_id, created_at, updated_at) VALUES (?, 'veh_a', ?, ?, ?)`).run(`ai_${id}`, id, T, T);
  }
}

beforeAll(async () => {
  await seedCatalog();
  db.prepare(`INSERT INTO vehicle (id, name, type, default_fuel_type, created_at, updated_at) VALUES ('veh_a', 'Jetta', 'carro', 'regular', ?, ?)`).run(T, T);
  db.prepare(
    `INSERT INTO service_record (id, vehicle_id, kind, occurred_at, title, created_at, updated_at) VALUES ('srv1', 'veh_a', 'reparacion', '2020-05-01T12:00:00.000Z', 'Bomba de agua', ?, ?)`,
  ).run(T, T);
  photo('p2019', '2019-06-15T18:00:00.000Z');
  photo('p2020', '2020-05-01T18:00:00.000Z');
  photo('psrv', '2020-05-01T19:00:00.000Z', { album: false, owner: ['service_record', 'srv1'] });
});

it('the album holds its photos and the service records’ photos, newest first', async () => {
  const photos = await albumPhotos('veh_a');
  expect(photos.map((p) => p.id)).toEqual(['psrv', 'p2020', 'p2019']);
  expect(photos[0]).toMatchObject({ serviceId: 'srv1', albumItemId: null });
});

it('a milestone and a service with photos become timeline cards carrying their photos', async () => {
  const m = await saveMilestone({ vehicleId: 'veh_a', kind: 'compra', occurredAt: '2019-06-15T12:00:00.000Z', title: 'Lo compré' });
  await linkPhotosToMilestone(['p2019'], m.id);
  expect(await milestonePhotoIds(m.id)).toEqual(['p2019']);

  const sections = buildTimeline({ photos: await albumPhotos('veh_a'), events: await timelineEvents('veh_a') });
  const byKind = Object.fromEntries(sections.flatMap((s) => s.items).map((i) => [i.kind, i.photos.map((p) => p.id)]));
  expect(byKind).toEqual({ mantenimiento: ['psrv'], fotos: ['p2020'], hito: ['p2019'] });

  // Deleting the milestone keeps its photos in the album, loose.
  await deleteMilestone(m.id);
  expect(row("SELECT milestone_id FROM album_item WHERE id = 'ai_p2019'")).toEqual({ milestone_id: null });
});

it('fixing a date moves the photo and is pushed', async () => {
  await setPhotoDate('p2020', '2021-01-01T16:00:00.000Z', 'year');
  expect(row("SELECT taken_at, date_precision, synced_at FROM media WHERE id = 'p2020'")).toEqual({
    taken_at: '2021-01-01T16:00:00.000Z',
    date_precision: 'year',
    synced_at: null,
  });
});

it('duplicate shapes come from the album only', async () => {
  const shapes = await findAlbumDupShapes('veh_a');
  expect(shapes).toHaveLength(2);
});

describe('uploads', () => {
  type Call = { path: string };
  const client = (refuse?: (path: string) => boolean) => {
    const calls: Call[] = [];
    const removed: string[][] = [];
    return {
      calls,
      removed,
      storage: {
        from: () => ({
          upload: async (path: string) => {
            calls.push({ path });
            return { error: refuse?.(path) ? { statusCode: '403', message: 'new row violates row-level security policy' } : null };
          },
          remove: async (paths: string[]) => {
            removed.push(paths);
            return { error: null };
          },
        }),
      },
    };
  };

  it('uploads the thumb before the full copy and records both paths', async () => {
    const c = client();
    await uploadMediaBytes(c, 'user1');
    const forP2019 = c.calls.map((x) => x.path).filter((p) => p.includes('p2019'));
    expect(forP2019).toEqual(['user1/p2019.thumb.jpg', 'user1/p2019.jpg']);
    expect(row("SELECT remote_path, remote_thumb_path FROM media WHERE id = 'p2019'")).toEqual({
      remote_path: 'user1/p2019.jpg',
      remote_thumb_path: 'user1/p2019.thumb.jpg',
    });
    // Nothing left to send.
    const again = client();
    await uploadMediaBytes(again, 'user1');
    expect(again.calls).toHaveLength(0);
  });

  it('a quota refusal pauses uploads; the photo stays local and waits', async () => {
    photo('pfull', '2026-01-01T12:00:00.000Z');
    const c = client((path) => path.includes('pfull'));
    await uploadMediaBytes(c, 'user1');
    expect((await readStorageMeter()).paused).toBe(true);
    expect(row("SELECT remote_path, remote_thumb_path FROM media WHERE id = 'pfull'")).toEqual({ remote_path: null, remote_thumb_path: null });
    // While paused nothing is even tried.
    const next = client();
    await uploadMediaBytes(next, 'user1');
    expect(next.calls).toHaveLength(0);
  });

  it('the client stops before a photo that cannot fit the last known quota', async () => {
    await writeStorageMeter({ paused: false, usedBytes: 100, quotaBytes: 100 });
    const c = client();
    await uploadMediaBytes(c, 'user1');
    expect(c.calls).toHaveLength(0);
    expect((await readStorageMeter()).paused).toBe(true);
    await writeStorageMeter({ paused: false, usedBytes: 0, quotaBytes: null });
  });

  it('deleting a photo removes both objects on the next sync', async () => {
    await deletePhoto('p2019');
    expect(row("SELECT deleted_at IS NOT NULL AS gone FROM album_item WHERE id = 'ai_p2019'")).toEqual({ gone: 1 });
    expect(await deletedMediaInStorage()).toEqual([{ id: 'p2019', remote_path: 'user1/p2019.jpg', remote_thumb_path: 'user1/p2019.thumb.jpg' }]);
    const c = client();
    await removeDeletedMediaBytes(c);
    expect(c.removed).toEqual([['user1/p2019.jpg', 'user1/p2019.thumb.jpg']]);
    expect(await deletedMediaInStorage()).toEqual([]);
  });
});
