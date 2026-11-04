import { QUERY_KINDS as SRV_KINDS } from '../../supabase/functions/cg-ai-intent/intents.ts';
import { QUERY_KINDS, answerQuery, queryPlan, type QueryData } from '@/lib/domain/smartQuery';

const intents = require('../../evals/ai/fixtures/intents.json') as { cases: { id: string; text: string; expected: { target: string; fields: Record<string, string | null> } }[] };

describe('the app and the function agree on the question kinds', () => {
  it('same closed list', () => expect([...QUERY_KINDS]).toEqual([...SRV_KINDS]));
});

describe('the 30 es-DO phrases of the eval fixture, as the model would classify them', () => {
  const queries = intents.cases.filter((c) => c.expected.target === 'query');
  it('there are 30 of them, each kind represented', () => {
    expect(queries).toHaveLength(30);
    for (const k of QUERY_KINDS) expect(queries.some((q) => q.expected.fields.query_kind === k)).toBe(true);
  });
  it.each(queries.map((q) => [q.id, q.text, q.expected.fields] as const))('%s «%s» → a plan with the right kind, keyword and period', (_id, _text, f) => {
    const plan = queryPlan(Object.fromEntries(Object.entries(f).map(([k, v]) => [k, { value: v }])));
    expect(plan).not.toBeNull();
    expect(plan!.kind).toBe(f.query_kind);
    expect(plan!.keyword).toBe(f.keyword ?? null);
    expect(plan!.from).toBe(f.period_from ?? null);
    expect(plan!.to).toBe(f.period_to ?? null);
  });
});

describe('queryPlan guards', () => {
  const v = (value: string | null) => ({ value });
  it('an unknown kind or none is no plan', () => {
    expect(queryPlan({ query_kind: v('delete_everything') })).toBeNull();
    expect(queryPlan({ query_kind: v(null) })).toBeNull();
    expect(queryPlan({})).toBeNull();
  });
  it('a period needs both ends, in order; otherwise there is none', () => {
    expect(queryPlan({ query_kind: v('fuel_spend'), period_from: v('2026-10-01') })).toMatchObject({ from: null, to: null });
    expect(queryPlan({ query_kind: v('fuel_spend'), period_from: v('2026-10-31'), period_to: v('2026-10-01') })).toMatchObject({ from: null, to: null });
    expect(queryPlan({ query_kind: v('fuel_spend'), period_from: v('octubre'), period_to: v('2026-10-31') })).toMatchObject({ from: null, to: null });
  });
});

describe('answerQuery: every figure comes from the records', () => {
  const data: QueryData = {
    vehicleId: 'v1',
    today: '2026-11-04',
    fuel: [
      { vehicleId: 'v1', occurredAt: '2026-10-03T12:00:00Z', amount: 2500 },
      { vehicleId: 'v1', occurredAt: '2026-10-20T12:00:00Z', amount: 3100.5 },
      { vehicleId: 'v1', occurredAt: '2026-09-30T12:00:00Z', amount: 1000 },
      { vehicleId: 'v2', occurredAt: '2026-10-05T12:00:00Z', amount: 9999 },
    ],
    expenses: [
      { vehicleId: 'v1', occurredAt: '2026-10-10T12:00:00Z', amount: 3800 },
      { vehicleId: 'v1', occurredAt: '2026-08-10T12:00:00Z', amount: 700 },
    ],
    services: [
      { vehicleId: 'v1', occurredAt: '2026-10-02T12:00:00Z', odometerKm: 84000, title: 'Cambio de aceite y filtro' },
      { vehicleId: 'v1', occurredAt: '2025-09-02T12:00:00Z', odometerKm: 70000, title: 'Cambio de aceite' },
      { vehicleId: 'v1', occurredAt: '2026-06-10T12:00:00Z', odometerKm: 80100, title: 'Alternador' },
      { vehicleId: 'v2', occurredAt: '2026-10-20T12:00:00Z', odometerKm: 1, title: 'Aceite del otro carro' },
    ],
    reminders: [
      { vehicleId: 'v1', title: 'Marbete', dueDate: '2026-12-15', dueOdometerKm: null, completedAt: null },
      { vehicleId: 'v1', title: 'Seguro', dueDate: '2026-11-10', dueOdometerKm: null, completedAt: null },
      { vehicleId: 'v1', title: 'Cambio de aceite', dueDate: null, dueOdometerKm: 94000, completedAt: null },
      { vehicleId: 'v1', title: 'Marbete 2025', dueDate: '2025-12-15', dueOdometerKm: null, completedAt: '2025-12-01' },
      { vehicleId: 'v2', title: 'Marbete', dueDate: '2026-01-01', dueOdometerKm: null, completedAt: null },
    ],
  };
  const plan = (kind: Parameters<typeof queryPlan>[0]['query_kind'] extends infer _ ? string : never, extra: Record<string, string | null> = {}) =>
    queryPlan({ query_kind: { value: kind }, ...Object.fromEntries(Object.entries(extra).map(([k, v]) => [k, { value: v }])) })!;

  it('fuel spend in October counts only this car and only that month', () => {
    expect(answerQuery(plan('fuel_spend', { period_from: '2026-10-01', period_to: '2026-10-31' }), data)).toMatchObject({ amount: 5600.5, count: 2, link: 'cifras' });
  });
  it('total spend adds the other expenses; no period means everything', () => {
    expect(answerQuery(plan('total_spend', { period_from: '2026-10-01', period_to: '2026-10-31' }), data)).toMatchObject({ amount: 9400.5, count: 3 });
    expect(answerQuery(plan('total_spend'), data)).toMatchObject({ amount: 11100.5, count: 5 });
  });
  it('a period with nothing says zero, not nothing', () => {
    expect(answerQuery(plan('fuel_spend', { period_from: '2025-01-01', period_to: '2025-12-31' }), data)).toMatchObject({ amount: 0, count: 0 });
  });
  it('last service: the newest match for the keyword, accents and case ignored, this car only', () => {
    expect(answerQuery(plan('last_service', { keyword: 'ACEITE' }), data)).toMatchObject({ found: { date: '2026-10-02', km: 84000, title: 'Cambio de aceite y filtro' } });
    expect(answerQuery(plan('last_service', { keyword: 'frenos' }), data)).toMatchObject({ found: null });
  });
  it('next due: the soonest dated open reminder; the keyword narrows; completed and other cars are ignored', () => {
    expect(answerQuery(plan('next_due'), data)).toMatchObject({ found: { title: 'Seguro', dueDate: '2026-11-10', daysLeft: 6 } });
    expect(answerQuery(plan('next_due', { keyword: 'marbete' }), data)).toMatchObject({ found: { title: 'Marbete', dueDate: '2026-12-15', daysLeft: 41 } });
  });
  it('a km-only reminder answers with the km when nothing matching has a date', () => {
    expect(answerQuery(plan('next_due', { keyword: 'aceite' }), data)).toMatchObject({ found: { dueDate: null, dueKm: 94000, daysLeft: null } });
  });
  it('an overdue reminder has negative days left', () => {
    const late = { ...data, today: '2026-12-20' };
    expect(answerQuery(plan('next_due', { keyword: 'marbete' }), late)).toMatchObject({ found: { daysLeft: -5 } });
  });
  it('show_repairs is a navigation, no figure', () => {
    expect(answerQuery(plan('show_repairs', { keyword: 'frenos' }), data)).toEqual({ kind: 'show_repairs', keyword: 'frenos', link: 'reparaciones' });
  });
});
