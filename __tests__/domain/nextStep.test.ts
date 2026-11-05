import { firstRunItem, NEXT_STEP, nextStep, snooze, type NextStepInput } from '@/lib/domain/nextStep';

const NOW = Date.UTC(2026, 10, 5, 12);
const base: NextStepInput = { now: NOW, hasVehicle: true, fillupCount: 12, daysSinceFillup: 3, daysSinceOdometer: 3, topAction: 'fuel' };

describe('nextStep ranking (SPEC-K §K1)', () => {
  const cases: [string, Partial<NextStepInput>, string][] = [
    ['no car → add one', { hasVehicle: false }, 'addVehicle'],
    ['everything fine → the most-used action', {}, 'top'],
    ['an overdue reminder wins over everything', { overdue: { id: 'r1', title: 'Aceite', daysOverdue: 2, legal: false }, document: { id: 'd1', title: 'Marbete', daysLeft: -1 }, daysSinceFillup: 40 }, 'overdue'],
    ['a document expiring in 10 days', { document: { id: 'd1', title: 'Seguro', daysLeft: 10 } }, 'document'],
    ['a document in 30 days is not yet a next step', { document: { id: 'd1', title: 'Seguro', daysLeft: 30 } }, 'top'],
    ['no fill-up in 15 days', { daysSinceFillup: 15 }, 'fuel'],
    ['a fill-up 14 days ago is still fine', { daysSinceFillup: 14 }, 'top'],
    ['never filled but the car has an odometer → log the first fill-up', { fillupCount: 0, daysSinceFillup: null }, 'fuel'],
    ['odometer 31 days old', { daysSinceOdometer: 31 }, 'odometer'],
    ['a recap that just closed', { recap: { id: '2026-10', label: 'Octubre' } }, 'recap'],
    ['a detection-health problem', { detection: { message: 'Sin permiso de ubicación' } }, 'detection'],
    ['first-run item', { firstRun: 'trips' }, 'firstRun'],
    ['the "see only what you use" offer', { offerFeatureSet: true }, 'featureSet'],
  ];
  it.each(cases)('%s', (_name, over, kind) => {
    expect(nextStep({ ...base, ...over }).kind).toBe(kind);
  });

  it('the documented order holds pairwise', () => {
    const all: Partial<NextStepInput> = {
      overdue: { id: 'r', title: 'x', daysOverdue: 1, legal: true },
      document: { id: 'd', title: 'x', daysLeft: 5 },
      daysSinceFillup: 30,
      daysSinceOdometer: 60,
      recap: { id: 'm', label: 'm' },
      detection: { message: 'm' },
      firstRun: 'fillup',
      offerFeatureSet: true,
    };
    const order: string[] = [];
    const left = { ...all };
    const strip: (keyof NextStepInput)[] = ['overdue', 'document', 'daysSinceFillup', 'daysSinceOdometer', 'recap', 'detection', 'firstRun', 'offerFeatureSet'];
    for (let i = 0; i < strip.length; i++) {
      const r = nextStep({ ...base, ...left });
      order.push(r.kind);
      const k = strip[i];
      delete (left as Record<string, unknown>)[k];
      if (k === 'daysSinceFillup') (left as Record<string, unknown>).daysSinceFillup = 3;
      if (k === 'daysSinceOdometer') (left as Record<string, unknown>).daysSinceOdometer = 3;
    }
    expect(order).toEqual(['overdue', 'document', 'fuel', 'odometer', 'recap', 'detection', 'firstRun', 'featureSet']);
  });

  it('"Más tarde" hides one candidate for 24 h and the next applies', () => {
    const input = { ...base, overdue: { id: 'r1', title: 'Aceite', daysOverdue: 2, legal: false }, daysSinceOdometer: 40 };
    const first = nextStep(input);
    expect(first.kind).toBe('overdue');
    const snoozed = snooze({}, first.key, NOW);
    expect(nextStep({ ...input, snoozed }).kind).toBe('odometer');
    // 25 hours later it is back.
    expect(nextStep({ ...input, snoozed, now: NOW + NEXT_STEP.snoozeMs + 3600_000 }).kind).toBe('overdue');
  });

  it('snooze drops expired entries and keeps live ones', () => {
    const m = snooze({ old: NOW - 1, live: NOW + 5000 }, 'new', NOW);
    expect(Object.keys(m).sort()).toEqual(['live', 'new']);
  });

  it('never empty: with everything snoozed it falls back to the default action', () => {
    const s = nextStep({ ...base, overdue: { id: 'r1', title: 'x', daysOverdue: 1, legal: false }, snoozed: { 'overdue:r1': NOW + 1000 }, topAction: 'trip' });
    expect(s).toMatchObject({ kind: 'top', action: 'trip' });
  });
});

describe('firstRunItem', () => {
  it('goes in order and ends', () => {
    expect(firstRunItem({ vehicle: false, fillup: false, trips: false })).toBe('vehicle');
    expect(firstRunItem({ vehicle: true, fillup: false, trips: false })).toBe('fillup');
    expect(firstRunItem({ vehicle: true, fillup: true, trips: false })).toBe('trips');
    expect(firstRunItem({ vehicle: true, fillup: true, trips: true })).toBeNull();
  });
});
