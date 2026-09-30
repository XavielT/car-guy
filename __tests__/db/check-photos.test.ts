/**
 * Check photos and ATENCIÓN (IMP 29092026 Phase 3, note 3) against a real
 * SQLite: several photos per result are media rows owned by the result, the
 * first one is also media_id, removed ones are dropped on save; history_feed
 * counts them; the album lists them with the item's label.
 */
import type { TestDb } from '../helpers/sqlite';
import { albumPhotos } from '@/lib/db/albumQueries';
import { inspectionPhotos, resultIdFor, saveInspection, type Answer } from '@/lib/db/inspectionOps';
import { history } from '@/lib/db/repos';
import type { InspectionItem } from '@/lib/db/types';

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

function media(id: string, ownerTable: string, ownerId: string, createdAt = T) {
  db.prepare(
    `INSERT INTO media (id, owner_table, owner_id, kind, mime, blob, width, height, created_at, updated_at)
     VALUES (?, ?, ?, 'photo', 'image/jpeg', ?, 1600, 1200, ?, ?)`,
  ).run(id, ownerTable, ownerId, new Uint8Array([1]), createdAt, createdAt);
}

const item = (id: string, label: string): InspectionItem =>
  ({
    id,
    templateId: 'tpl_semanal',
    groupName: 'Motor',
    label,
    how: '',
    warning: '',
    requiresColdEngine: false,
    onFail: 'task',
    relatedServiceTypeId: null,
    sortOrder: 0,
  }) as unknown as InspectionItem;

const answer = (it: InspectionItem, result: Answer['result'], mediaIds: string[] = [], action: Answer['action'] = 'none'): Answer => ({
  item: it,
  result,
  note: result === 'ok' ? '' : 'visto',
  mediaId: mediaIds[0] ?? null,
  mediaIds,
  action,
});

const run = (id: string, answers: Answer[]) =>
  saveInspection({ id, vehicleId: 'veh_a', templateId: 'tpl_semanal', occurredAt: T, odometerKm: null, durationSec: 60, answers });

const coolant = item('it_coolant', 'Refrigerante');
const oil = item('it_oil', 'Aceite');
const tires = item('it_tires', 'Gomas');

beforeAll(() => {
  db.prepare(`INSERT INTO vehicle (id, name, type, default_fuel_type, created_at, updated_at) VALUES ('veh_a', 'DS3', 'carro', 'regular', ?, ?)`).run(T, T);
});

describe('a falla with two photos', () => {
  const rid = resultIdFor('insp1', coolant.id);
  beforeAll(async () => {
    // The strip stored three while running; the user removed the third before saving.
    media('ph1', 'inspection_result', rid, '2026-09-28T12:00:01.000Z');
    media('ph2', 'inspection_result', rid, '2026-09-28T12:00:02.000Z');
    media('ph3', 'inspection_result', rid, '2026-09-28T12:00:03.000Z');
    await run('insp1', [answer(coolant, 'falla', ['ph1', 'ph2']), answer(oil, 'ok'), answer(tires, 'na')]);
  });

  it('keeps the first photo in media_id, owns both, drops the removed one, captions the kept', () => {
    expect(row('SELECT media_id FROM inspection_result WHERE id = ?', rid).media_id).toBe('ph1');
    expect(row('SELECT deleted_at FROM media WHERE id = ?', 'ph3').deleted_at).not.toBeNull();
    expect(row('SELECT caption FROM media WHERE id = ?', 'ph2').caption).toBe('CHEQUEO · Refrigerante');
    expect(row('SELECT status FROM inspection WHERE id = ?', 'insp1').status).toBe('con_fallas');
  });

  it('history_feed counts the media owned by the results', () => {
    expect(row(`SELECT photos FROM history_feed WHERE id = ?`, 'insp1').photos).toBe(2);
  });

  it('inspectionPhotos lists them per result, media_id first', async () => {
    expect(await inspectionPhotos('insp1')).toEqual({ [rid]: ['ph1', 'ph2'] });
  });

  it('the album lists check photos with the item label', async () => {
    const photos = (await albumPhotos('veh_a')).filter((p) => p.inspectionId === 'insp1');
    expect(photos.map((p) => p.id).sort()).toEqual(['ph1', 'ph2']);
    expect(photos[0]).toMatchObject({ checkLabel: 'Refrigerante', albumItemId: null, inspectionId: 'insp1' });
  });
});

describe('an atención-only check', () => {
  let summary: Awaited<ReturnType<typeof run>>;
  beforeAll(async () => {
    media('ph_att', 'inspection_result', resultIdFor('insp2', tires.id));
    // A photo taken while the item was FALLA, before it was changed to OK.
    media('ph_stale', 'inspection_result', resultIdFor('insp2', oil.id));
    summary = await run('insp2', [answer(coolant, 'ok'), answer(oil, 'ok', ['ph_stale']), answer(tires, 'atencion', ['ph_att'])]);
  });

  it('is "con_avisos", creates nothing by default and is not a failure', () => {
    expect(row('SELECT status FROM inspection WHERE id = ?', 'insp2').status).toBe('con_avisos');
    expect(summary).toMatchObject({ failures: 0, warnings: 1, createdTasks: [], createdReminders: [] });
    expect(row(`SELECT COUNT(*) AS n FROM task WHERE source_inspection_result_id LIKE 'insp2%'`).n).toBe(0);
  });

  it('an OK answer keeps no photo', () => {
    expect(row('SELECT media_id FROM inspection_result WHERE id = ?', resultIdFor('insp2', oil.id)).media_id).toBeNull();
    expect(row('SELECT deleted_at FROM media WHERE id = ?', 'ph_stale').deleted_at).not.toBeNull();
    expect(row(`SELECT photos FROM history_feed WHERE id = ?`, 'insp2').photos).toBe(1);
  });

  it('an atención may still ask for a task', async () => {
    const s = await run('insp3', [answer(tires, 'atencion', [], 'task')]);
    expect(s.createdTasks).toEqual(['Revisar gomas']);
    expect(row(`SELECT priority FROM task WHERE source_inspection_result_id = ?`, resultIdFor('insp3', tires.id)).priority).toBe('normal');
  });
});

it('an old run with only media_id (not owned by the result) still counts and shows', async () => {
  const at = '2025-01-01T12:00:00.000Z';
  db.prepare(`INSERT INTO inspection (id, vehicle_id, template_id, occurred_at, status, created_at, updated_at) VALUES ('old', 'veh_a', 'tpl', ?, 'con_fallas', ?, ?)`).run(at, at, at);
  media('ph_old', 'inspection', 'old');
  db.prepare(
    `INSERT INTO inspection_result (id, inspection_id, item_id, label_snapshot, result, media_id, created_at, updated_at) VALUES ('r_old', 'old', 'x', 'Frenos', 'falla', 'ph_old', ?, ?)`,
  ).run(at, at);
  expect(row(`SELECT photos FROM history_feed WHERE id = 'old'`).photos).toBe(1);
  expect(await inspectionPhotos('old')).toEqual({ r_old: ['ph_old'] });
  expect((await albumPhotos('veh_a')).find((p) => p.id === 'ph_old')).toMatchObject({ checkLabel: 'Frenos' });
});

it('service records and mods count their photos too; other kinds stay null', async () => {
  db.prepare(`INSERT INTO service_record (id, vehicle_id, kind, occurred_at, title, created_at, updated_at) VALUES ('srv', 'veh_a', 'reparacion', ?, 'Bomba', ?, ?)`).run(T, T, T);
  media('ps1', 'service_record', 'srv');
  media('ps2', 'service_record', 'srv');
  db.prepare(`INSERT INTO expense (id, vehicle_id, occurred_at, category, amount_dop, description, vendor, created_at, updated_at) VALUES ('e1', 'veh_a', ?, 'otro', 100, 'x', '', ?, ?)`).run(T, T, T);
  expect(row(`SELECT photos FROM history_feed WHERE id = 'srv'`).photos).toBe(2);
  expect(row(`SELECT photos FROM history_feed WHERE id = 'e1'`).photos).toBeNull();
  // The feed still reads the view (every arm has ten columns).
  expect((await history.feed('veh_a')).length).toBeGreaterThan(3);
});
