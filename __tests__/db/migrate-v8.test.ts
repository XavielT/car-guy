/**
 * Migration v8 (IMP 30092026 Phase 2, ADR-38) against node's real SQLite.
 *
 * The canary: a 2.3.x database with its prices in two settings upgrades, and the
 * board shows the same numbers and the same label as before. Plus the event
 * backfill, the trip-point purge date, history_feed v6, and a 2.3.1 backup
 * (the seed, exported by the v2.3.1 tag's own code) restored into v8.
 */
import { DatabaseSync } from 'node:sqlite';

import fixture from '../fixtures/backup-v7-seed-2.3.1.json';
import type { TestDb } from '../helpers/sqlite';
import { buildBackup, restoreV2, type BackupV2 } from '@/lib/backup';
import { LATEST_VERSION, MIGRATIONS } from '@/lib/db/migrations';
import { migrateV8Data } from '@/lib/db/migrationV8';
import { referencePricesNow, savePriceBoard } from '@/lib/db/priceOps';
import { history } from '@/lib/db/repos';
import { tripPoints, tripPointsCutoff } from '@/lib/db/tripOps';
import { resetDatabase } from '@/lib/db/reset';
import { currentBoard, referencePricesFromBoard, type FuelPriceRow } from '@/lib/domain/fuelPrices';

jest.mock('@/lib/db/client', () => {
  const helpers = require('../helpers/sqlite');
  const testDb = helpers.createTestDb();
  return { ...helpers.clientModule(testDb), testDb };
});
const appDb = (jest.requireMock('@/lib/db/client') as { testDb: TestDb }).testDb;

type Row = Record<string, unknown>;
const T = '2026-09-20T12:00:00.000Z';
const PRICES = { premium: 341.1, regular: 307.5, gasoil_regular: 259.8, gasoil_optimo: 293.1, glp: 135.2, gnv: 43.97 };
const LABEL = '26 sep – 2 oct 2026 (MICM)';

/** The async slice of expo-sqlite migrateV8Data uses, over a DatabaseSync. */
function handle(db: DatabaseSync) {
  return {
    getAllAsync: async <R,>(sql: string, p: unknown[] = []) => db.prepare(sql).all(...(p as never[])) as R[],
    getFirstAsync: async <R,>(sql: string, p: unknown[] = []) => (db.prepare(sql).get(...(p as never[])) as R | undefined) ?? null,
    runAsync: async (sql: string, p: unknown[] = []) => db.prepare(sql).run(...(p as never[])),
  } as never;
}

function v7Database(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  for (const m of MIGRATIONS.filter((m) => m.version <= 7)) {
    db.exec('BEGIN');
    for (const sql of m.up) db.exec(sql);
    db.exec('COMMIT');
  }
  db.prepare(`INSERT INTO vehicle (id, name, default_fuel_type, created_at, updated_at) VALUES ('c3', 'C3', 'regular', ?, ?)`).run(T, T);
  db.prepare(`INSERT INTO setting (key, value, updated_at) VALUES ('reference_prices', ?, ?)`).run(JSON.stringify(PRICES), T);
  db.prepare(`INSERT INTO setting (key, value, updated_at) VALUES ('price_week_label', ?, ?)`).run(JSON.stringify(LABEL), T);
  const milestone = db.prepare(
    `INSERT INTO milestone (id, vehicle_id, kind, occurred_at, title, created_at, updated_at) VALUES (?, 'c3', ?, ?, ?, ?, ?)`,
  );
  milestone.run('m-acc', 'accidente', '2026-09-10T15:00:00.000Z', 'Choque en la 27', T, T);
  milestone.run('m-buy', 'compra', '2025-01-05T15:00:00.000Z', 'Lo compré', T, T);
  db.prepare(
    `INSERT INTO trip (id, vehicle_id, source, status, started_at, ended_at, created_at, updated_at) VALUES ('t1', 'c3', 'manual', 'done', ?, ?, ?, ?)`,
  ).run('2026-09-01T10:00:00.000Z', '2026-09-01T10:30:00.000Z', T, T);
  db.prepare(`INSERT INTO trip_point (trip_id, t, lat, lng) VALUES ('t1', 1, 18.47, -69.9)`).run();
  return db;
}

async function upgrade(db: DatabaseSync, today = new Date('2026-09-30T12:00:00Z')) {
  const v8 = MIGRATIONS.find((m) => m.version === 8)!;
  db.exec('BEGIN');
  for (const sql of v8.up) db.exec(sql);
  await migrateV8Data(handle(db), today);
  db.exec('COMMIT');
}

describe('fresh install: 0 → 8', () => {
  it('is the latest version and has every v8 table', () => {
    expect(LATEST_VERSION).toBe(10);
    const tables = (appDb.sqlite.prepare(`SELECT name FROM sqlite_master WHERE type = 'table'`).all() as Row[]).map((r) => r.name);
    for (const t of ['fuel_price', 'fuel_price_ref', 'vehicle_fact', 'legal_acceptance']) expect(tables).toContain(t);
  });

  it('a fresh database has no price rows, and the board falls back to 2.3’s defaults', async () => {
    const now = await referencePricesNow();
    expect(now.referencePrices.regular).toBe(307.5);
    expect(now.priceWeekLabel).toBe('15–21 ago 2026 (MICM)');
  });
});

describe('2.3.x (v7) → v8', () => {
  it('turns the two settings into one manual row per fuel, dated by the label', async () => {
    const db = v7Database();
    await upgrade(db);
    const rows = db.prepare(`SELECT * FROM fuel_price ORDER BY fuel_type`).all() as Row[];
    expect(rows).toHaveLength(6);
    for (const r of rows) {
      expect(r.source).toBe('manual');
      expect(r.valid_from).toBe('2026-09-26');
      expect(r.note).toBe(LABEL);
      expect(r.synced_at).toBeNull(); // pushed on the next sync
    }
  });

  it('shows the same numbers and the same label as 2.3.1 did', async () => {
    const db = v7Database();
    await upgrade(db);
    const own = (db.prepare(`SELECT * FROM fuel_price`).all() as Row[]).map((r) => ({
      id: r.id, fuelType: r.fuel_type, price: r.price, validFrom: r.valid_from, source: r.source,
      station: r.station, note: r.note, createdAt: r.created_at, updatedAt: r.updated_at, deletedAt: r.deleted_at,
    })) as FuelPriceRow[];
    const shown = referencePricesFromBoard(currentBoard(own, []));
    expect(shown.referencePrices).toEqual(PRICES);
    expect(shown.priceWeekLabel).toBe(LABEL);
  });

  it('an unreadable label dates the rows today', async () => {
    const db = v7Database();
    db.prepare(`UPDATE setting SET value = ? WHERE key = 'price_week_label'`).run(JSON.stringify('la semana pasada'));
    await upgrade(db, new Date(2026, 8, 30, 9));
    const r = db.prepare(`SELECT valid_from FROM fuel_price LIMIT 1`).get() as Row;
    expect(r.valid_from).toBe('2026-09-30');
  });

  it('no settings, no rows', async () => {
    const db = v7Database();
    db.exec(`DELETE FROM setting`);
    await upgrade(db);
    expect((db.prepare(`SELECT COUNT(*) AS n FROM fuel_price`).get() as Row).n).toBe(0);
  });

  it('an accident becomes an event (moderado); a purchase stays a hito', async () => {
    const db = v7Database();
    await upgrade(db);
    const byId = Object.fromEntries((db.prepare(`SELECT id, event_type, severity, pending FROM milestone`).all() as Row[]).map((r) => [r.id, r]));
    expect(byId['m-acc']).toMatchObject({ event_type: 'accidente', severity: 'moderado', pending: '' });
    expect(byId['m-buy']).toMatchObject({ event_type: 'hito', severity: null });
  });

  it('history_feed v6: the accident is an evento row, the purchase a hito', async () => {
    const db = v7Database();
    await upgrade(db);
    const feed = db.prepare(`SELECT id, kind, subtitle, amount_dop FROM history_feed WHERE vehicle_id = 'c3' ORDER BY occurred_at`).all() as Row[];
    expect(feed.find((r) => r.id === 'm-buy')).toMatchObject({ kind: 'hito', subtitle: 'compra' });
    expect(feed.find((r) => r.id === 'm-acc')).toMatchObject({ kind: 'evento', subtitle: 'accidente|accidente|moderado||' });
    expect(feed.find((r) => r.id === 't1')?.kind).toBe('viaje');
  });

  it('stamps keep_until on existing points: the trip’s end + 30 days', async () => {
    const db = v7Database();
    await upgrade(db);
    const p = db.prepare(`SELECT keep_until FROM trip_point`).get() as Row;
    expect(p.keep_until).toBe('2026-10-01T10:30:00.000Z');
  });

  it('adds the tires switch off and trip diagnostics empty', async () => {
    const db = v7Database();
    await upgrade(db);
    const cols = (t: string) => (db.prepare(`PRAGMA table_info(${t})`).all() as Row[]).map((c) => c.name);
    expect(cols('vehicle_share')).toContain('show_tires');
    expect(cols('trip')).toContain('diagnostics');
    expect(cols('vehicle_specsheet')).toEqual(expect.arrayContaining(['oil_brand', 'where_bought', 'tire_current_f']));
    expect(cols('milestone')).toEqual(expect.arrayContaining(['event_type', 'linked_service_id', 'location_label']));
  });
});

describe('the app on v8 (store helpers, feed repo, backup)', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('saving the price screen writes rows, and the board reads them back', async () => {
    const before = await referencePricesNow();
    await savePriceBoard({ ...before.referencePrices, regular: 299.9 }, before.priceWeekLabel, before);
    const after = await referencePricesNow();
    expect(after.referencePrices.regular).toBe(299.9);
    expect(after.referencePrices.premium).toBe(before.referencePrices.premium);
    // Saving the same thing again stacks nothing.
    await savePriceBoard(after.referencePrices, after.priceWeekLabel, after);
    expect((appDb.sqlite.prepare(`SELECT COUNT(*) AS n FROM fuel_price`).get() as Row).n).toBe(1);
  });

  it('a new week label writes every fuel, dated by it', async () => {
    const before = await referencePricesNow();
    await savePriceBoard(before.referencePrices, '3–9 oct 2026 (MICM)', before);
    const rows = appDb.sqlite.prepare(`SELECT valid_from, note FROM fuel_price`).all() as Row[];
    expect(rows).toHaveLength(6);
    expect(new Set(rows.map((r) => r.valid_from))).toEqual(new Set(['2026-10-03']));
    expect((await referencePricesNow()).priceWeekLabel).toBe('3–9 oct 2026 (MICM)');
  });

  it('restores the 2.3.1 seed export: every row, prices adopted, the accident an event', async () => {
    const counts = await restoreV2(fixture as unknown as BackupV2);
    expect(counts.merged).toBeGreaterThan(200);
    const board = await referencePricesNow();
    expect(board.priceWeekLabel).toBe('26 sep – 2 oct 2026 (MICM)');
    expect(board.referencePrices).toEqual(PRICES);
    const acc = appDb.sqlite.prepare(`SELECT event_type, severity FROM milestone WHERE kind = 'accidente'`).get() as Row;
    expect(acc).toEqual({ event_type: 'accidente', severity: 'moderado' });
    for (const [table, rows] of Object.entries((fixture as unknown as BackupV2).tables)) {
      if (!Array.isArray(rows)) continue;
      const n = (appDb.sqlite.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as Row).n;
      expect([table, n]).toEqual([table, rows.length]);
    }
  });

  it('a v8 backup carries the new tables and restores them', async () => {
    const stamp = new Date().toISOString();
    appDb.sqlite.prepare(`INSERT INTO vehicle (id, name, default_fuel_type, created_at, updated_at) VALUES ('v', 'Trueno', 'premium', ?, ?)`).run(stamp, stamp);
    appDb.sqlite
      .prepare(`INSERT INTO vehicle_fact (id, vehicle_id, label, value, group_name, created_at, updated_at) VALUES ('f1', 'v', 'Código de radio', '1234', 'electrico', ?, ?)`)
      .run(stamp, stamp);
    appDb.sqlite
      .prepare(`INSERT INTO legal_acceptance (id, version, accepted_at, locale, platform, device_id, created_at, updated_at) VALUES ('l1', '2026-10', ?, 'es', 'android', 'd1', ?, ?)`)
      .run(stamp, stamp, stamp);
    const before = await referencePricesNow();
    await savePriceBoard({ ...before.referencePrices, glp: 140 }, before.priceWeekLabel, before);

    const backup = JSON.parse(JSON.stringify(await buildBackup())) as BackupV2;
    expect(backup.schemaVersion).toBe(10);
    expect(backup.tables.fuel_price).toHaveLength(1);
    expect(backup.tables.vehicle_fact).toHaveLength(1);
    expect(backup.tables.legal_acceptance).toHaveLength(1);

    await resetDatabase();
    await restoreV2(backup);
    expect((await referencePricesNow()).referencePrices.glp).toBe(140);
    expect((appDb.sqlite.prepare(`SELECT value FROM vehicle_fact`).get() as Row).value).toBe('1234');
  });

  it('with FEATURE_EVENTS on, Historial reads an event as an evento row, not a hito', async () => {
    await restoreV2(fixture as unknown as BackupV2);
    const acc = appDb.sqlite.prepare(`SELECT id, vehicle_id FROM milestone WHERE kind = 'accidente'`).get() as Row;
    expect((await history.feed(acc.vehicle_id as string, { kinds: ['hito'] })).find((e) => e.id === acc.id)).toBeUndefined();
    const row = (await history.feed(acc.vehicle_id as string, { kinds: ['evento'] })).find((e) => e.id === acc.id);
    expect(row).toMatchObject({ kind: 'evento', subtitle: 'accidente|accidente|moderado||' });
  });

  it('the purge keeps points until keep_until, and stamps it for finished trips', async () => {
    const stamp = '2026-09-01T00:00:00.000Z';
    appDb.sqlite.prepare(`INSERT INTO vehicle (id, name, default_fuel_type, created_at, updated_at) VALUES ('v', 'C3', 'regular', ?, ?)`).run(stamp, stamp);
    const trip = appDb.sqlite.prepare(
      `INSERT INTO trip (id, vehicle_id, source, status, started_at, ended_at, created_at, updated_at) VALUES (?, 'v', 'manual', ?, ?, ?, ?, ?)`,
    );
    trip.run('old', 'done', '2026-08-01T10:00:00.000Z', '2026-08-01T11:00:00.000Z', stamp, stamp);
    trip.run('new', 'done', '2026-09-25T10:00:00.000Z', '2026-09-25T11:00:00.000Z', stamp, stamp);
    trip.run('live', 'recording', '2026-07-01T10:00:00.000Z', null, stamp, stamp);
    for (const id of ['old', 'new', 'live']) appDb.sqlite.prepare(`INSERT INTO trip_point (trip_id, t, lat, lng) VALUES (?, 1, 18.4, -69.9)`).run(id);

    const removed = await tripPoints.purgeOlderThan(tripPointsCutoff(new Date('2026-09-30T12:00:00Z')));
    expect(removed).toBe(1);
    const left = appDb.sqlite.prepare(`SELECT trip_id, keep_until FROM trip_point ORDER BY trip_id`).all() as Row[];
    expect(left).toEqual([
      { trip_id: 'live', keep_until: null },
      { trip_id: 'new', keep_until: '2026-10-25T11:00:00.000Z' },
    ]);
  });
});
