jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

/**
 * IMP 03112026 SPEC-E §E2/§E5: Car Health on the device. Deterministic insights with no AI, dismissals that persist per facts-hash,
 * the closed list of actions as routes, and the AI's wording merged over the deterministic one without ever hiding a fact.
 */
const mockStore = new Map<string, unknown>();
jest.mock('@/lib/db/repos', () => ({
  settings: {
    get: jest.fn(async (k: string, d: unknown) => (mockStore.has(k) ? mockStore.get(k) : d)),
    set: jest.fn(async (k: string, v: unknown) => void mockStore.set(k, v)),
  },
}));
const mockFrom = jest.fn();
jest.mock('@/lib/cloud/supabase', () => ({ getSupabase: () => ({ from: mockFrom }) }));

import { actionFor, actionRoute, baseInsights, dismissInsight, dismissedFor, mergeAi, readCachedInsights, saveCachedInsights, withoutDismissed, type InsightsAnswer } from '@/lib/ai/insights';
import type { Fact } from '@/lib/domain/predict';

const oil: Fact = { id: 'reminder_projection:v1:oil', kind: 'reminder_projection', vehicleId: 'v1', severity: 'watch', data: { title: 'Aceite', dueKm: 100400, daysLeft: 10, kmPerDay: 40, projectedDueAt: '2026-11-14' }, actions: [{ type: 'open_reminder', reminderId: 'oil' }, { type: 'new_service', title: 'Aceite' }] };
const fuel: Fact = { id: 'fuel_anomaly:v1:f9', kind: 'fuel_anomaly', vehicleId: 'v1', severity: 'act', data: { fillupId: 'f9', deviationPct: -45, baseline: 30 }, actions: [{ type: 'open_fillup', fillupId: 'f9' }, { type: 'open_obd' }] };
const cost: Fact = { id: 'cost_per_km:v1:now', kind: 'cost_per_km', vehicleId: 'v1', severity: 'info', data: { perKm30: 5.36 }, actions: [{ type: 'open_costs' }] };

beforeEach(() => {
  mockStore.clear();
  mockFrom.mockReset();
});

describe('baseInsights — no AI, no network', () => {
  it('one deterministic insight per fact, most urgent first, in the requested language', () => {
    const es = baseInsights([cost, oil, fuel], 'es');
    expect(es.map((i) => i.severity)).toEqual(['act', 'watch', 'info']);
    expect(es[0]).toMatchObject({ source: 'template', fact_ids: [fuel.id], headline: 'Tu última carga rindió distinto' });
    expect(es[1].why).toContain('2026-11-14');
    expect(baseInsights([oil], 'en')[0].headline).toBe('Aceite is due in 10 days');
  });
  it('the first action of the fact is the default; a fact with none has none', () => {
    expect(baseInsights([oil], 'es')[0].action).toEqual({ type: 'open_reminder', reminderId: 'oil' });
    expect(baseInsights([{ ...cost, actions: [] }], 'es')[0].action).toBeNull();
  });
  it('the ids are stable for the same facts', () => {
    expect(baseInsights([oil], 'es')[0].id).toBe(baseInsights([oil], 'en')[0].id);
  });
});

describe('dismissals persist, per car and per facts-hash', () => {
  it('a dismissed insight stays dismissed for the same hash, across reads', async () => {
    const [i] = baseInsights([oil], 'es');
    await dismissInsight('v1', 'hashA', i.id);
    expect(await dismissedFor('v1', 'hashA')).toEqual([i.id]);
    expect(withoutDismissed(baseInsights([oil, fuel], 'es'), await dismissedFor('v1', 'hashA')).map((x) => x.fact_ids[0])).toEqual([fuel.id]);
  });
  it('dismissing twice does not duplicate', async () => {
    await dismissInsight('v1', 'hashA', 'x');
    await dismissInsight('v1', 'hashA', 'x');
    expect(await dismissedFor('v1', 'hashA')).toEqual(['x']);
  });
  it('a CHANGED car (a new hash) starts clean: the world moved on', async () => {
    await dismissInsight('v1', 'hashA', 'x');
    expect(await dismissedFor('v1', 'hashB')).toEqual([]);
  });
  it('one car’s dismissals never touch another’s', async () => {
    await dismissInsight('v1', 'hashA', 'x');
    expect(await dismissedFor('v2', 'hashA')).toEqual([]);
  });
});

describe('actionRoute — the closed list, as screens (nothing is written by tapping)', () => {
  it.each([
    [{ type: 'open_reminder', reminderId: 'r1' }, '/recordatorio/[id]', { id: 'r1' }],
    [{ type: 'open_fillup', fillupId: 'f1' }, '/carga/[id]', { id: 'f1' }],
    [{ type: 'new_service', title: 'x' }, '/servicio/nuevo', undefined],
    [{ type: 'new_reminder', title: 'x', dueDate: null }, '/recordatorio/nuevo', undefined],
    [{ type: 'open_tires' }, '/gomas', undefined],
    [{ type: 'open_costs' }, '/cifras', undefined],
    [{ type: 'open_obd' }, '/obd', undefined],
  ] as const)('%j → %s', (action, path, params) => {
    expect(actionRoute(action as never)).toEqual(params ? { pathname: path, params } : { pathname: path });
  });
  it('no action → no route', () => {
    expect(actionRoute(null)).toBeNull();
    expect(actionRoute(undefined)).toBeNull();
  });
});

describe('mergeAi — the AI’s wording over the deterministic one', () => {
  const facts = [oil, fuel, cost];
  const base = baseInsights(facts, 'es');
  const ai = (over: Partial<InsightsAnswer['insights'][number]> = {}): InsightsAnswer => ({
    insights: [{ id: 'ai1', headline: 'El aceite toca pronto', why: 'A tu ritmo, en 10 días.', fact_ids: [oil.id], severity: 'watch', action: { type: 'new_service' }, source: 'ai', ...over }], fallbacks: 0, dropped: 0,
  });

  it('an AI insight REPLACES the deterministic one for the same facts; the others stay (a partial answer never hides a fact)', () => {
    const m = mergeAi(base, ai(), facts);
    expect(m.map((i) => i.fact_ids[0]).sort()).toEqual([cost.id, fuel.id, oil.id].sort());
    expect(m.find((i) => i.fact_ids[0] === oil.id)).toMatchObject({ source: 'ai', headline: 'El aceite toca pronto' });
    expect(m.filter((i) => i.fact_ids[0] === oil.id)).toHaveLength(1);
  });
  it('the action is re-taken from the FACT (its parameters), whatever the answer carried', () => {
    const m = mergeAi(base, ai({ action: { type: 'new_service', title: 'HACKED' } }), facts).find((i) => i.fact_ids[0] === oil.id)!;
    expect(m.action).toEqual({ type: 'new_service', title: 'Aceite' });
  });
  it('an action no cited fact offers disappears', () => {
    expect(mergeAi(base, ai({ action: { type: 'open_tires' } }), facts).find((i) => i.fact_ids[0] === oil.id)!.action).toBeNull();
    expect(actionFor({ ...ai().insights[0], action: null }, facts)).toBeNull();
  });
  it('no AI answer → the deterministic list untouched; always sorted by urgency', () => {
    expect(mergeAi(base, null, facts)).toEqual(base);
    expect(mergeAi(base, { insights: [], fallbacks: 0, dropped: 0 }, facts)).toEqual(base);
    expect(mergeAi(base, ai(), facts).map((i) => i.severity)).toEqual(['act', 'watch', 'info']);
  });
  it('an AI insight over several facts hides the template ones it fully covers, and only those', () => {
    const m = mergeAi(base, ai({ fact_ids: [oil.id, fuel.id], severity: 'act' }), facts);
    expect(m).toHaveLength(2);
    expect(m.some((i) => i.fact_ids[0] === cost.id)).toBe(true);
  });
});

describe('the cache never breaks the card', () => {
  const answer: InsightsAnswer = { insights: [{ id: 'a', headline: 'h', why: 'w', fact_ids: ['x'], severity: 'info', action: null, source: 'ai' }], fallbacks: 0, dropped: 0 };
  const query = (result: unknown) => {
    const q: Record<string, unknown> = {};
    q.eq = jest.fn(() => q);
    q.maybeSingle = jest.fn(async () => result);
    return q;
  };
  it('a hit returns the stored answer; a miss, an error or junk is null', async () => {
    mockFrom.mockReturnValue({ select: jest.fn(() => query({ data: { payload: answer }, error: null })) });
    expect(await readCachedInsights('v1', 'h')).toEqual(answer);
    for (const r of [{ data: null, error: null }, { data: null, error: { message: 'x' } }, { data: { payload: { nope: 1 } }, error: null }]) {
      mockFrom.mockReturnValue({ select: jest.fn(() => query(r)) });
      expect(await readCachedInsights('v1', 'h')).toBeNull();
    }
  });
  it('a throwing client is null / false; a save upserts on the unique key as kind "insight"', async () => {
    mockFrom.mockImplementation(() => { throw new Error('offline'); });
    expect(await readCachedInsights('v1', 'h')).toBeNull();
    expect(await saveCachedInsights('v1', 'h', answer)).toBe(false);
    const upsert = jest.fn(async () => ({ error: null }));
    mockFrom.mockReset();
    mockFrom.mockReturnValue({ upsert });
    expect(await saveCachedInsights('v1', 'hash1234', answer)).toBe(true);
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ kind: 'insight', input_hash: 'hash1234', vehicle_id: 'v1' }), { onConflict: 'user_id,vehicle_id,kind,input_hash' });
  });
});

describe('insightsFor — one paid call per (car, facts-hash) per session', () => {
  const answer: InsightsAnswer = { insights: [{ id: 'a', headline: 'h', why: 'w', fact_ids: [oil.id], severity: 'watch', action: null, source: 'ai' }], fallbacks: 0, dropped: 0 };
  beforeEach(() => {
    jest.resetModules();
  });

  it('three simultaneous askers share ONE call, and a later asker reuses the result', async () => {
    mockFrom.mockReturnValue({ select: () => ({ eq: function () { return this; }, maybeSingle: async () => ({ data: null, error: null }) }), upsert: async () => ({ error: null }) });
    const calls = jest.fn(async () => answer);
    jest.doMock('@/lib/ai/client', () => ({ callAi: calls }));
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const m = require('@/lib/ai/insights') as typeof import('@/lib/ai/insights');
    m.resetInsightsSession();
    const [a, b, c] = await Promise.all([1, 2, 3].map(() => m.insightsFor('v1', 'h1', [oil], 'Corolla', 'es')));
    expect(calls).toHaveBeenCalledTimes(1);
    expect(a).toEqual(answer);
    expect(b).toBe(a);
    expect(c).toBe(a);
    await m.insightsFor('v1', 'h1', [oil], 'Corolla', 'es');
    expect(calls).toHaveBeenCalledTimes(1);
    await m.insightsFor('v1', 'h2', [oil], 'Corolla', 'es'); // a changed car IS a new question
    expect(calls).toHaveBeenCalledTimes(2);
  });

  it('a stored answer means NO call at all', async () => {
    mockFrom.mockReturnValue({ select: () => ({ eq: function () { return this; }, maybeSingle: async () => ({ data: { payload: answer }, error: null }) }) });
    const calls = jest.fn(async () => answer);
    jest.doMock('@/lib/ai/client', () => ({ callAi: calls }));
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const m = require('@/lib/ai/insights') as typeof import('@/lib/ai/insights');
    m.resetInsightsSession();
    expect(await m.insightsFor('v1', 'h1', [oil], 'Corolla', 'es')).toEqual(answer);
    expect(calls).not.toHaveBeenCalled();
  });

  it('a failure resolves to null (the deterministic sentences stay) and is forgotten, so the next visit can try again', async () => {
    mockFrom.mockReturnValue({ select: () => ({ eq: function () { return this; }, maybeSingle: async () => ({ data: null, error: null }) }), upsert: async () => ({ error: null }) });
    const calls = jest.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(answer);
    jest.doMock('@/lib/ai/client', () => ({ callAi: calls }));
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const m = require('@/lib/ai/insights') as typeof import('@/lib/ai/insights');
    m.resetInsightsSession();
    expect(await m.insightsFor('v1', 'h1', [oil], 'Corolla', 'es')).toBeNull();
    expect(await m.insightsFor('v1', 'h1', [oil], 'Corolla', 'es')).toEqual(answer);
    expect(calls).toHaveBeenCalledTimes(2);
  });
});
