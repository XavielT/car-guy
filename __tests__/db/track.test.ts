/**
 * Pista against a real SQLite with the real-garage seed (IMP 28092026 Phase 6):
 * the AE85's drift day summary, copy-forward and its "Cambiaste…" diff, heat
 * cycles, a burned tire, the pad reminder hook, the odometer readings, Cifras.
 */
import type { TestDb } from '../helpers/sqlite';
import {
  burnTire,
  copyToNextSession,
  deleteEvent,
  eventDetail,
  listEvents,
  measurePads,
  padReminderId,
  saveEvent,
  saveSession,
  sessionDetail,
  sessionDraft,
  setTireUsed,
  trackLine,
  usableTires,
} from '@/lib/db/trackQueries';
import { reminders, tires } from '@/lib/db/repos';
import { seedCatalog } from '@/lib/db/seed';
import { spendRows } from '@/lib/db/statsQueries';
import { describeChanges, diffSheets, flagRearGrowth } from '@/lib/domain/track';
import { GARAGE_IDS, seedRealGarage } from '@/lib/dev/garage';

jest.mock('@/lib/db/client', () => {
  const helpers = require('../helpers/sqlite');
  const testDb = helpers.createTestDb();
  return { ...helpers.clientModule(testDb), testDb };
});
const db = (jest.requireMock('@/lib/db/client') as { testDb: TestDb }).testDb.sqlite;
const all = (sql: string, ...p: string[]) => db.prepare(sql).all(...p) as Record<string, unknown>[];
const AE85 = GARAGE_IDS.ae85;

beforeAll(async () => {
  await seedCatalog();
  await seedRealGarage(new Date(2026, 8, 28));
});

it('the seeded drift day sums up like the artboard', async () => {
  const [card] = await listEvents(AE85);
  expect(card.venue?.name).toMatch(/Sunix/);
  expect(card.summary).toEqual({ sessions: 2, runs: 14, laps: 0, bestLapMs: null, tiresBurned: 0, kmOnTrack: 86, spendDop: 9800 });
  expect(await trackLine(AE85)).toEqual({ events: 1, best: null }); // drift has no lap to beat
});

it('session 2 records what changed from session 1, and its rears grew red', async () => {
  const s2 = await sessionDetail('dev_track_s2');
  expect(JSON.parse(s2!.sheet!.changedFromPrevious)).toEqual(['psiColdRl', 'psiColdRr', 'psiHotRl', 'psiHotRr']);
  const note = describeChanges(diffSheets(s2!.previous!.sheet, s2!.sheet!));
  expect(note[0]).toBe('TI/TD 40 → 42');
  expect(flagRearGrowth(s2!.sheet!)).toBe(true);
  expect(s2!.sheet!.hydro).toBe(true);
});

it('copy-forward copies the sheet, not the runs or the incident', async () => {
  const s3 = await copyToNextSession('dev_track_s2');
  expect(s3!.seq).toBe(3);
  expect(s3!.runs).toBeNull();
  expect(s3!.incident).toBeNull();
  const d = await sessionDetail(s3!.id);
  expect(d!.sheet!.psiColdRl).toBe(42);
  expect(d!.sheet!.steeringAngleDeg).toBe(55);
  expect(JSON.parse(d!.sheet!.changedFromPrevious)).toEqual([]);
  const draft = await sessionDraft('dev_track_drift');
  expect(draft.seq).toBe(4);
  expect(draft.sheet.psiColdRl).toBe(42);
});

it('heat cycles count once per tire per event, and a burned tire leaves the garage', async () => {
  const rl = (await tires.getById('dev_tire_rl'))!;
  expect(rl.heatCycles).toBe(1); // the seed marked the rears
  await setTireUsed('dev_track_drift', rl, true); // again: no double count
  expect((await tires.getById('dev_tire_rl'))!.heatCycles).toBe(1);

  await burnTire('dev_track_drift', rl);
  expect((await tires.getById('dev_tire_rl'))!.status).toBe('quemada');
  expect((await usableTires(AE85)).map((t) => t.id)).not.toContain('dev_tire_rl');
  expect((await eventDetail('dev_track_drift'))!.summary.tiresBurned).toBe(1);
});

it('pads under 5 mm arm "Pastillas (pista)" on the next event, and new pads clear it', async () => {
  expect(await reminders.getById(padReminderId(AE85))).toBeNull(); // 7 / 8 mm is fine
  const next = await saveEvent({ vehicleId: AE85, occurredAt: '2026-10-19T12:00:00.000Z', discipline: 'drift', venueId: 'autodromo_americas' });
  await saveSession({ eventId: 'dev_track_drift', seq: 5, kind: 'practica' }, {});
  const later = await saveEvent({ vehicleId: AE85, occurredAt: '2026-09-27T12:00:00.000Z', discipline: 'drift' });
  await saveSession({ eventId: later.id, seq: 1 }, {});
  await saveSession({ eventId: later.id, seq: 2 }, {});
  await measurePads(later.id, { f: 5.2 });

  const r = await reminders.getById(padReminderId(AE85));
  expect(r).toMatchObject({ title: 'Pastillas (pista)', metric: 'date', serviceTypeId: 'pastillas_frenos', isEnabled: true });
  expect(r!.dueDate).toBe(next.occurredAt);

  await measurePads(later.id, { f: 11 });
  expect((await reminders.getById(padReminderId(AE85)))!.isEnabled).toBe(false);
});

it('odometer start/end become track readings, and deleting the event takes everything', async () => {
  const readings = all("SELECT value_km, source FROM odometer_reading WHERE source_id = 'dev_track_drift' AND deleted_at IS NULL ORDER BY value_km");
  expect(readings).toEqual([
    { value_km: 52_200, source: 'track' },
    { value_km: 52_286, source: 'track' },
  ]);
  expect((await spendRows(AE85)).filter((r) => r.category === 'pista').reduce((t, r) => t + r.amountDop, 0)).toBe(9800);
  expect(all("SELECT kind FROM history_feed WHERE id = 'dev_track_drift'")).toEqual([{ kind: 'pista' }]);

  await deleteEvent('dev_track_drift');
  expect(all("SELECT id FROM track_session WHERE event_id = 'dev_track_drift' AND deleted_at IS NULL")).toEqual([]);
  expect(all("SELECT id FROM consumable_usage WHERE event_id = 'dev_track_drift' AND deleted_at IS NULL")).toEqual([]);
  expect(all("SELECT id FROM odometer_reading WHERE source_id = 'dev_track_drift' AND deleted_at IS NULL")).toEqual([]);
  expect(await eventDetail('dev_track_drift')).toBeNull();
});
