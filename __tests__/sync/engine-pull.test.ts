/**
 * The real `sync()` against a real SQLite and an in-memory fake of PostgREST.
 *
 * The case that matters: the server stamps `server_updated_at` with the
 * *transaction* start, so every row of one pushed batch shares it. Pulled by
 * "server_updated_at > cursor" in pages of 500, a table of 600 such rows came
 * down as 500 — the rest were skipped for good, on every new device.
 */
import type { TestDb } from '../helpers/sqlite';

jest.mock('@/lib/db/client', () => {
  const helpers = require('../helpers/sqlite');
  const testDb = helpers.createTestDb();
  return { ...helpers.clientModule(testDb), testDb };
});

type Row = Record<string, unknown> & { id: string; server_updated_at: string };
const mockServer: Record<string, Row[]> = {};
const mockAuth = { expireNext: false, refreshes: 0 };

/** Enough of the PostgREST query builder for the engine: select/order/limit/or/in/upsert. */
function mockQuery(table: string) {
  const state: { or?: string; limit?: number; inKeys?: string[]; upsert?: unknown[] } = {};
  const builder = {
    select: () => builder,
    order: () => builder,
    limit: (n: number) => ((state.limit = n), builder),
    or: (filter: string) => ((state.or = filter), builder),
    in: (_col: string, keys: string[]) => ((state.inKeys = keys), builder),
    upsert: (rows: unknown[]) => ((state.upsert = rows), builder),
    then: (resolve: (value: { data: unknown; error: unknown }) => void) => {
      if (mockAuth.expireNext) {
        mockAuth.expireNext = false;
        return resolve({ data: null, error: { code: 'PGRST301', message: 'JWT expired' } });
      }
      if (state.upsert) return resolve({ data: null, error: null });
      let rows = [...(mockServer[table] ?? [])];
      if (state.or) {
        const pair = state.or.match(/server_updated_at\.gt\."([^"]+)",and\(server_updated_at\.eq\."([^"]+)",id\.gt\."([^"]+)"\)/);
        const from = state.or.match(/server_updated_at\.gte\."([^"]+)"/);
        const after = state.or.match(/^server_updated_at\.gt\."([^"]+)"$/);
        if (after) rows = rows.filter((r) => r.server_updated_at > after[1]);
        else if (pair) rows = rows.filter((r) => r.server_updated_at > pair[1] || (r.server_updated_at === pair[2] && r.id > pair[3]));
        else if (from) rows = rows.filter((r) => r.server_updated_at >= from[1]);
      }
      rows.sort((a, b) => (a.server_updated_at < b.server_updated_at ? -1 : a.server_updated_at > b.server_updated_at ? 1 : a.id < b.id ? -1 : 1));
      resolve({ data: rows.slice(0, state.limit ?? rows.length), error: null });
    },
  };
  return builder;
}

jest.mock('@/lib/cloud/supabase', () => ({
  getSupabase: () => ({
    auth: {
      getSession: async () => ({ data: { session: { user: { id: 'user-1' } } } }),
      refreshSession: async () => ((mockAuth.refreshes += 1), { error: null }),
    },
    from: (table: string) => mockQuery(table),
    storage: { from: () => ({ upload: async () => ({ error: null }), remove: async () => ({ error: null }) }) },
  }),
  describeSchemaError: () => null,
}));

// eslint-disable-next-line import/first
import { newerSchemaCount, SCHEMA_SKIPPED_KEY, sync } from '@/lib/sync/engine';
// eslint-disable-next-line import/first
import { settings as settingsRepo } from '@/lib/db/repos';

const db = (jest.requireMock('@/lib/db/client') as { testDb: TestDb }).testDb.sqlite;

describe('pull', () => {
  it('brings down every row of a batch that shares one server timestamp', async () => {
    const stamp = '2026-09-25T20:00:00.123456+00:00'; // one push transaction
    mockServer.vehicle = Array.from({ length: 600 }, (_, i) => ({
      id: `veh_${String(i).padStart(3, '0')}`,
      user_id: 'user-1',
      name: `Vehículo ${i}`,
      type: 'carro',
      default_fuel_type: 'regular',
      is_archived: false,
      sort_order: 0,
      notes: '',
      created_at: '2026-09-25T20:00:00+00:00',
      updated_at: '2026-09-25T20:00:00+00:00',
      server_updated_at: stamp,
    }));

    const result = await sync('manual');

    expect(result.ok).toBe(true);
    expect(db.prepare('SELECT COUNT(*) AS n FROM vehicle').get()).toEqual({ n: 600 });
  });

  it('pulls nothing twice when nothing changed', async () => {
    const result = await sync('manual');
    // The overlap window re-reads recent rows; last-write-wins skips them.
    expect(result.pulled).toBe(0);
  });

  it('refreshes an expired session once and carries on', async () => {
    mockAuth.expireNext = true;
    const result = await sync('manual');
    expect(mockAuth.refreshes).toBe(1);
    expect(result.ok).toBe(true);
  });
});

describe('schema gate (IMP 29092026 Phase 1)', () => {
  const vehicle = (id: string, stamp: string, extra: Record<string, unknown>) => ({
    id,
    user_id: 'user-1',
    name: id,
    type: 'carro',
    default_fuel_type: 'regular',
    is_archived: false,
    sort_order: 0,
    notes: '',
    created_at: '2026-09-29T10:00:00+00:00',
    updated_at: '2026-09-29T10:00:00+00:00',
    server_updated_at: stamp,
    ...extra,
  });

  it('skips rows from a newer schema, counts them, and applies the rest (unknown columns ignored)', async () => {
    mockServer.vehicle = [
      ...(mockServer.vehicle ?? []),
      vehicle('veh_gate_old', '2026-09-29T10:00:01+00:00', {}), // before sql/018: no schema_hint at all
      vehicle('veh_gate_v5', '2026-09-29T10:00:02+00:00', { schema_hint: 'v6', some_future_column: 1 }),
      vehicle('veh_gate_v6a', '2026-09-29T10:00:03+00:00', { schema_hint: 'v7', tank_l: 45 }),
      vehicle('veh_gate_v6b', '2026-09-29T10:00:04+00:00', { schema_hint: 'v7' }),
    ];
    const result = await sync('manual');
    expect(result.ok).toBe(true);
    const ids = (db.prepare("SELECT id FROM vehicle WHERE id LIKE 'veh_gate_%' ORDER BY id").all() as { id: string }[]).map((r) => r.id);
    expect(ids).toEqual(['veh_gate_old', 'veh_gate_v5']);
    expect(await newerSchemaCount()).toBe(2);
  });

  it('does not count the same skipped row twice', async () => {
    await sync('manual'); // the overlap window re-reads the same page
    expect(await newerSchemaCount()).toBe(2);
  });

  it('after an app update, re-reads the tables that had skipped rows from zero', async () => {
    // Pretend the skipped rows were recorded by an older build.
    await settingsRepo.set(SCHEMA_SKIPPED_KEY, { hint: 'v5', tables: { vehicle: ['veh_gate_v6a'] } });
    await sync('manual');
    // The re-read found the v7 rows again (still too new for this build) and
    // recorded them under this build's hint.
    expect(await newerSchemaCount()).toBe(2);
    expect(db.prepare("SELECT COUNT(*) AS n FROM vehicle WHERE id LIKE 'veh_gate_v6%'").get()).toEqual({ n: 0 });
  });
});

