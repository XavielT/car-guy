/**
 * IMP 03112026 SPEC-E §E1: the deterministic engine. Pure, so it is tested hard: gaps and a stale odometer, a car with one
 * reading, the SGC fuel rule (a 10–11 km fill-up is never "optimal"; a partial fill is never an anomaly), motorcycles, facts, and
 * the hash that decides whether an AI call or a push is needed.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  FUEL, FUEL_BOUNDS, SOON_DAYS, STALE_DAYS, buildFacts, classifyFuel, dotDate, factsHash, fuelBaseline, projectDue, projectionState, usageRate,
  type EconomyPoint, type PredictInput, type ReminderInput, type UsageRate,
} from '@/lib/domain/predict';

const today = '2026-11-04';
const rd = (at: string, km: number) => ({ at, km });
/** A reading every `step` days going back from `today`, at `perDay` km/day, ending at `endKm`. */
const steady = (n: number, step: number, perDay: number, endKm = 100_000, end = today) => {
  const t = Date.parse(`${end}T12:00:00Z`);
  return Array.from({ length: n }, (_, i) => {
    const back = (n - 1 - i) * step;
    return rd(new Date(t - back * 86_400_000).toISOString().slice(0, 10), Math.round(endKm - back * perDay));
  });
};

describe('the import boundary (it must also run in Deno)', () => {
  it('predict.ts imports NOTHING from the app, react-native, expo or i18n', () => {
    const src = readFileSync(join(__dirname, '../../lib/domain/predict.ts'), 'utf8');
    const imports = src.split('\n').filter((l) => /^\s*(import|export)\s.*from\s/.test(l) || /require\(/.test(l));
    expect(imports).toEqual([]);
    // and no dynamic import / require either
    expect(src.split('\n').filter((l) => /^\s*[^/*\s].*\b(import|require)\s*\(/.test(l))).toEqual([]);
  });
});

describe('usageRate', () => {
  it('a steady 40 km/day over 60 days → 40, high confidence, current km estimated from the last reading', () => {
    const r = usageRate(steady(9, 7, 40), today);
    expect(r).toMatchObject({ kmPerDay: 40, confidence: 'high', stale: false, daysSinceLast: 0, estimatedKmNow: 100_000 });
  });
  it('the MEDIAN shrugs off one long trip', () => {
    const rs = steady(9, 7, 40);
    rs[5] = rd(rs[5].at, rs[5].km + 1500); // a road trip logged in one reading
    const r = usageRate(rs, today);
    expect(r.kmPerDay).toBeGreaterThan(30);
    expect(r.kmPerDay).toBeLessThan(60);
  });
  it('an odometer that goes DOWN is a typo: it is dropped, not averaged in', () => {
    const rs = [...steady(8, 7, 40)];
    rs.splice(4, 0, rd(rs[3].at.replace(/\d\d$/, '28'), 10)); // a "10" km reading in the middle
    expect(usageRate(rs, today).kmPerDay).toBe(40);
  });
  it('several readings on one day: the highest wins', () => {
    const rs = [...steady(5, 10, 30), rd(today, 99_000)];
    expect(usageRate(rs, today).lastReading?.km).toBe(100_000);
  });
  it('readings in the future are ignored', () => {
    expect(usageRate([...steady(5, 10, 30), rd('2027-01-01', 999_999)], today).lastReading?.km).toBe(100_000);
  });
  it('ONE reading is never a rate', () => {
    expect(usageRate([rd(today, 50_000)], today)).toMatchObject({ kmPerDay: null, confidence: 'none', estimatedKmNow: 50_000 });
  });
  it('no readings → none, nothing to estimate', () => {
    expect(usageRate([], today)).toMatchObject({ kmPerDay: null, confidence: 'none', lastReading: null, estimatedKmNow: null });
  });
  it('two readings less than 14 days apart are too close to call', () => {
    expect(usageRate([rd('2026-10-30', 100_000), rd(today, 100_200)], today).confidence).toBe('none');
  });
  it('two readings 30 days apart → low confidence, still a number', () => {
    expect(usageRate([rd('2026-10-05', 99_000), rd(today, 100_000)], today)).toMatchObject({ kmPerDay: 33.3, confidence: 'low' });
  });
  it('a parked car (under 0.5 km/day) has no pace to project from', () => {
    expect(usageRate(steady(9, 7, 0.2), today).confidence).toBe('none');
  });
  it('an impossible pace (a typo\'d reading) is none, not a projection to next week', () => {
    expect(usageRate([rd('2026-09-01', 10_000), rd('2026-09-20', 900_000), rd(today, 901_000)], today).kmPerDay).toBeNull();
  });
  it('a STALE last reading lowers the confidence one level and estimates the odometer from the pace', () => {
    const r = usageRate(steady(9, 7, 40, 100_000, '2026-09-10'), today);
    expect(r.stale).toBe(true);
    expect(r.daysSinceLast).toBeGreaterThan(STALE_DAYS);
    expect(r.confidence).toBe('medium'); // 9 readings over 56 days is high; stale lowers it one level
    expect(r.estimatedKmNow).toBeGreaterThan(100_000);
  });
  it('a gap of weeks inside the window does not drag the pace to zero', () => {
    const rs = [rd('2026-08-10', 90_000), rd('2026-08-17', 90_280), rd('2026-09-30', 92_000), rd('2026-10-07', 92_280), rd(today, 93_400)];
    expect(usageRate(rs, today).kmPerDay).toBeGreaterThan(30);
  });
  it('bad dates and negatives are ignored', () => {
    expect(usageRate([rd('hola', 5), rd(today, -3)], today).confidence).toBe('none');
    expect(usageRate(steady(5, 10, 30), 'nope').confidence).toBe('none');
  });
});

describe('projectDue', () => {
  const rate: UsageRate = usageRate(steady(9, 7, 40), today);
  const rem = (over: Partial<ReminderInput> = {}): ReminderInput => ({ id: 'r1', title: 'Aceite', metric: 'km', dueKm: 100_800, dueDate: null, isEnabled: true, ...over });

  it('today + (dueKm − current) / kmPerDay: 800 km at 40/day = 20 days', () => {
    expect(projectDue(rem(), rate, 100_000, today)).toMatchObject({ projectedDueAt: '2026-11-24', daysLeft: 20, kmLeft: 800, confidence: 'high' });
  });
  it('an already-passed km limit projects to TODAY (never the past)', () => {
    expect(projectDue(rem({ dueKm: 99_000 }), rate, 100_000, today)).toMatchObject({ projectedDueAt: today, daysLeft: 0, kmLeft: -1000 });
  });
  it('"both": says when the pace puts it BEFORE the calendar date', () => {
    expect(projectDue(rem({ metric: 'both', dueDate: '2027-03-01' }), rate, 100_000, today).earlierThanDate).toBe(true);
    expect(projectDue(rem({ metric: 'both', dueDate: '2026-11-10' }), rate, 100_000, today).earlierThanDate).toBe(false);
  });
  it('NO pace → no projection, and the km left is still reported (the reminder behaves as before)', () => {
    const none = usageRate([rd(today, 100_000)], today);
    expect(projectDue(rem(), none, 100_000, today)).toMatchObject({ projectedDueAt: null, daysLeft: null, kmLeft: 800 });
  });
  it('date-only, disabled, or no limit/odometer → nothing', () => {
    expect(projectDue(rem({ metric: 'date' }), rate, 100_000, today).projectedDueAt).toBeNull();
    expect(projectDue(rem({ isEnabled: false }), rate, 100_000, today).projectedDueAt).toBeNull();
    expect(projectDue(rem({ dueKm: null }), rate, 100_000, today).projectedDueAt).toBeNull();
    expect(projectDue(rem(), rate, null, today).projectedDueAt).toBeNull();
  });
  it('states: ok beyond 30 days, soon within, act within 7 or due', () => {
    expect([projectionState(null), projectionState(60), projectionState(SOON_DAYS), projectionState(SOON_DAYS - 1), projectionState(7), projectionState(0)]).toEqual(['ok', 'ok', 'soon', 'soon', 'act', 'act']);
  });
});

const pt = (over: Partial<EconomyPoint> = {}): EconomyPoint => ({ fillupId: 'f', at: '2026-10-20', distanceKm: 300, volumeGal: 10, kmPerGal: 30, measured: true, ...over });
const history = (n: number, kmPerGal = 30): EconomyPoint[] => Array.from({ length: n }, (_, i) => pt({ fillupId: `h${i}`, at: `2026-0${i + 1}-15`, kmPerGal }));

describe('classifyFuel — SGC’s 4-state rule on Car Guy’s fill-ups', () => {
  const base = { value: 30, n: 5 };

  it('SGC’s real case: a 10–11 km fill-up is NEVER "optimal", whatever its economy', () => {
    for (const km of [10, 11]) {
      for (const eco of [25, 30, 31, 12, 80]) {
        const c = classifyFuel(pt({ distanceKm: km, kmPerGal: eco }), base, 'car');
        expect(c).toMatchObject({ state: 'insufficient', reason: 'short_distance' });
      }
    }
  });
  it('a PARTIAL or estimated fill is never an anomaly, even at 3 km/gal', () => {
    expect(classifyFuel(pt({ measured: false, kmPerGal: 3 }), base, 'car')).toMatchObject({ state: 'insufficient', reason: 'partial' });
    expect(classifyFuel(pt({ measured: false, kmPerGal: 90 }), base, 'car').state).toBe('insufficient');
  });
  it('exactly the distance minimum counts; one km under does not', () => {
    expect(classifyFuel(pt({ distanceKm: FUEL.DIST_MIN_KM }), base, 'car').state).toBe('optimal');
    expect(classifyFuel(pt({ distanceKm: FUEL.DIST_MIN_KM - 1 }), base, 'car').state).toBe('insufficient');
  });
  it('against the baseline: ±20 % optimal, 20–40 % low, ≥ 40 % abnormal, in both directions', () => {
    const at = (eco: number) => classifyFuel(pt({ kmPerGal: eco }), base, 'car');
    expect(at(30).state).toBe('optimal');
    expect(at(24)).toMatchObject({ state: 'optimal', deviationPct: -20 });
    expect(at(23.9)).toMatchObject({ state: 'low', direction: 'below' });
    expect(at(33).state).toBe('optimal');
    // above the baseline by 24 %: low (a car's ceiling is 35 km/gal, so use a low baseline)
    expect(classifyFuel(pt({ kmPerGal: 31 }), { value: 25, n: 5 }, 'car')).toMatchObject({ state: 'low', direction: 'above', deviationPct: 24 });
    expect(at(36.5)).toMatchObject({ state: 'abnormal', reason: 'out_of_range' }); // past the car ceiling
    expect(at(18)).toMatchObject({ state: 'abnormal', direction: 'below', reason: 'below_baseline' });
    expect(at(18.5).state).toBe('low');
  });
  it('outside the class’s floor/ceiling is abnormal whatever the baseline', () => {
    expect(classifyFuel(pt({ kmPerGal: 9 }), base, 'car')).toMatchObject({ state: 'abnormal', reason: 'out_of_range', direction: 'below' });
    expect(classifyFuel(pt({ kmPerGal: 60 }), { value: 58, n: 4 }, 'car')).toMatchObject({ state: 'abnormal', reason: 'out_of_range', direction: 'above' });
  });
  it('a MOTORCYCLE at 60 km/gal is fine; the same number on a car is abnormal', () => {
    expect(classifyFuel(pt({ kmPerGal: 60 }), { value: 58, n: 4 }, 'motorcycle').state).toBe('optimal');
    expect(classifyFuel(pt({ kmPerGal: 60 }), { value: 58, n: 4 }, 'car').state).toBe('abnormal');
    expect(FUEL_BOUNDS.motorcycle[0]).toBeGreaterThan(FUEL_BOUNDS.car[1] - 20);
  });
  it('a pickup at 8 km/gal is normal for it, abnormal for a car (diesel and gasoline share the km/gal scale)', () => {
    expect(classifyFuel(pt({ kmPerGal: 8 }), { value: 8, n: 4 }, 'truck').state).toBe('optimal');
    expect(classifyFuel(pt({ kmPerGal: 8 }), { value: 8, n: 4 }, 'car').state).toBe('abnormal');
  });
  it('no baseline (fewer than 3 plausible fills) → insufficient, never a guess', () => {
    expect(classifyFuel(pt(), null, 'car')).toMatchObject({ state: 'insufficient', reason: 'no_baseline' });
  });
  it('no volume or no economy → insufficient', () => {
    expect(classifyFuel(pt({ volumeGal: null }), base, 'car').reason).toBe('no_data');
    expect(classifyFuel(pt({ kmPerGal: null }), base, 'car').reason).toBe('no_data');
    expect(classifyFuel(pt({ volumeGal: 0 }), base, 'car').reason).toBe('no_data');
    expect(classifyFuel(pt({ distanceKm: null }), base, 'car').reason).toBe('short_distance');
  });

  describe('fuelBaseline', () => {
    it('averages PLAUSIBLE measured fills only, and needs 3', () => {
      expect(fuelBaseline(history(2), 'car')).toBeNull();
      expect(fuelBaseline(history(3), 'car')).toEqual({ value: 30, n: 3 });
    });
    it('never averages short-distance, partial, or out-of-range fills (the historic bug that poisoned SGC’s baseline)', () => {
      const poisoned = [...history(3, 30), pt({ fillupId: 'short', distanceKm: 11, kmPerGal: 90 }), pt({ fillupId: 'part', measured: false, kmPerGal: 3 }), pt({ fillupId: 'crazy', kmPerGal: 200 })];
      expect(fuelBaseline(poisoned, 'car')).toEqual({ value: 30, n: 3 });
    });
    it('leaves out the fill-up being judged', () => {
      expect(fuelBaseline([...history(3, 30), pt({ fillupId: 'me', kmPerGal: 12 })], 'car', 'me')?.value).toBe(30);
    });
  });
});

describe('dotDate', () => {
  it('DOT week/year → a date; anything else → null', () => {
    expect(dotDate('2321')).toBe('2021-06-04');
    expect(dotDate('0120')).toBe('2020-01-01');
    for (const bad of ['', null, '9921', '2321X', '23', '0021', '5421']) expect(dotDate(bad)).toBeNull();
  });
});

const input = (over: Partial<PredictInput> = {}): PredictInput => ({
  today, vehicle: { id: 'v1', class: 'car' }, readings: steady(9, 7, 40), reminders: [], economy: [], spend: [], prices: [], referencePrices: {}, tires: [],
  lastService: { rotacion: null, alineacion: null, frenos: null, bateria: null, correa: null, refrigerante: null }, ...over,
});

describe('buildFacts', () => {
  it('a car with no data at all has NO facts (no data, no fact)', () => {
    expect(buildFacts(input({ readings: [] }))).toEqual([]);
    expect(buildFacts(input())).toEqual([]);
  });

  it('a km reminder that falls due soon at the real pace is a fact with its projection and closed-list actions', () => {
    const f = buildFacts(input({ reminders: [{ id: 'oil', title: 'Aceite', metric: 'km', dueKm: 100_400, dueDate: null, isEnabled: true }] }));
    expect(f).toHaveLength(1);
    expect(f[0]).toMatchObject({ kind: 'reminder_projection', severity: 'watch', id: 'reminder_projection:v1:oil', data: { daysLeft: 10, projectedDueAt: '2026-11-14', kmPerDay: 40 } });
    expect(f[0].actions.map((a) => a.type)).toEqual(['open_reminder', 'new_service']);
  });
  it('within a week, or already due → "act"; far away → no fact', () => {
    const sev = (dueKm: number) => buildFacts(input({ reminders: [{ id: 'x', title: 'x', metric: 'km', dueKm, dueDate: null, isEnabled: true }] }))[0]?.severity;
    expect(sev(100_100)).toBe('act');
    expect(sev(99_000)).toBe('act');
    expect(sev(104_000)).toBeUndefined();
  });
  it('with NO usage rate there is no projection fact at all (existing behaviour is untouched)', () => {
    expect(buildFacts(input({ readings: [rd(today, 100_000)], reminders: [{ id: 'x', title: 'x', metric: 'km', dueKm: 100_050, dueDate: null, isEnabled: true }] })).filter((f) => f.kind === 'reminder_projection')).toEqual([]);
  });

  it('a stale odometer is itself a fact, and says how stale', () => {
    const f = buildFacts(input({ readings: steady(9, 7, 40, 100_000, '2026-09-01') })).find((x) => x.kind === 'odometer_stale')!;
    expect(f.severity).toBe('watch');
    expect(f.data.daysSince).toBeGreaterThan(STALE_DAYS);
  });

  it('the latest full-to-full 45 % below the car’s own baseline is an "act" fact; a partial one is no fact', () => {
    const eco = [...history(4, 30), pt({ fillupId: 'bad', at: '2026-11-01', kmPerGal: 16.5 })];
    const f = buildFacts(input({ economy: eco })).find((x) => x.kind === 'fuel_anomaly')!;
    expect(f).toMatchObject({ severity: 'act', data: { fillupId: 'bad', state: 'abnormal', direction: 'below', deviationPct: -45, baseline: 30 } });
    expect(f.actions.map((a) => a.type)).toEqual(['open_fillup', 'open_obd']);
    const partial = [...history(4, 30), pt({ fillupId: 'bad', at: '2026-11-01', kmPerGal: 16.5, measured: false })];
    expect(buildFacts(input({ economy: partial })).filter((x) => x.kind === 'fuel_anomaly')).toEqual([]);
    const short = [...history(4, 30), pt({ fillupId: 'bad', at: '2026-11-01', kmPerGal: 90, distanceKm: 11 })];
    expect(buildFacts(input({ economy: short })).filter((x) => x.kind === 'fuel_anomaly')).toEqual([]);
  });

  it('cost per km over 30/90/365 days, from the spend and the distance driven', () => {
    const spend = [{ at: '2026-10-20', amountDop: 6000, category: 'combustible' as const }];
    const f = buildFacts(input({ spend })).find((x) => x.kind === 'cost_per_km')!;
    // the readings in the last 30 days span 28 days × 40 km = 1,120 km: 6,000 / 1,120
    expect(f.data.perKm30).toBeCloseTo(5.36, 1);
    expect(f.severity).toBe('info');
  });
  it('no distance, no cost per km', () => {
    expect(buildFacts(input({ readings: [rd(today, 1)], spend: [{ at: today, amountDop: 5000, category: 'otros' }] })).find((x) => x.kind === 'cost_per_km')).toBeUndefined();
  });

  it('this month 2× the average of the previous three is "act"; +50 % is "watch"; early in the month, nothing', () => {
    const mk = (cur: number, prev: number) => [
      { at: '2026-11-02', amountDop: cur, category: 'otros' as const }, { at: '2026-10-05', amountDop: prev, category: 'otros' as const },
      { at: '2026-09-05', amountDop: prev, category: 'otros' as const }, { at: '2026-08-05', amountDop: prev, category: 'otros' as const },
    ];
    const f = (cur: number, td = '2026-11-15') => buildFacts(input({ today: td, spend: mk(cur, 10_000) })).find((x) => x.kind === 'monthly_spend');
    expect(f(20_000)).toMatchObject({ severity: 'act', data: { thisMonth: 20_000, previousAvg: 10_000, changePct: 100 } });
    expect(f(15_000)?.severity).toBe('watch');
    expect(f(11_000)).toBeUndefined();
    expect(f(20_000, '2026-11-05')).toBeUndefined();
  });

  it('fuel paid 12 % over the MICM reference → a "watch" fact with the two prices', () => {
    const prices = [{ at: '2026-10-01', pricePerGal: 336, fuelGroup: 'regular' }, { at: '2026-10-20', pricePerGal: 336, fuelGroup: 'regular' }];
    const f = buildFacts(input({ prices, referencePrices: { regular: 300 } })).find((x) => x.kind === 'fuel_price')!;
    expect(f).toMatchObject({ severity: 'watch', data: { paidPerGal: 336, referencePerGal: 300, overPct: 12 } });
    expect(buildFacts(input({ prices, referencePrices: { regular: 340 } })).find((x) => x.kind === 'fuel_price')).toBeUndefined();
  });

  it('the biggest non-fuel expense of the last 90 days', () => {
    const f = buildFacts(input({ spend: [{ at: '2026-09-20', amountDop: 25_000, category: 'reparacion' }, { at: '2026-10-10', amountDop: 3_000, category: 'otros' }, { at: '2026-10-11', amountDop: 90_000, category: 'combustible' }] })).find((x) => x.kind === 'biggest_expense')!;
    expect(f.data).toMatchObject({ amountDop: 25_000, category: 'reparacion' });
  });

  it('tires: 6 years from the DOT is "watch", 10 is "act", an unreadable DOT is nothing', () => {
    const tires = [{ id: 'a', label: 'Delantera', dot: '2318', installedAt: null }, { id: 'b', label: 'Trasera', dot: '1112', installedAt: null }, { id: 'c', label: 'Nueva', dot: '2325', installedAt: null }, { id: 'd', label: '?', dot: 'xx', installedAt: null }];
    const f = buildFacts(input({ tires })).filter((x) => x.kind === 'tire_age');
    expect(f.map((x) => [x.data.tireId, x.severity, x.data.ageYears])).toEqual([['b', 'act', 14], ['a', 'watch', 8]]);
  });

  it('wear: time since rotation, alignment, brakes, belt, coolant, and the battery’s age', () => {
    const f = buildFacts(input({ lastService: { rotacion: '2026-01-10', alineacion: '2025-06-01', frenos: '2023-01-01', bateria: '2022-01-01', correa: '2024-01-01', refrigerante: '2026-06-01' } }));
    const by = (k: string) => f.filter((x) => x.kind === k).map((x) => [x.data.item ?? 'battery', x.severity]);
    expect(by('service_gap')).toEqual(expect.arrayContaining([['rotacion', 'watch'], ['alineacion', 'watch'], ['frenos', 'act']]));
    expect(by('service_gap')).not.toContainEqual(['refrigerante', expect.anything()]);
    expect(by('service_gap')).not.toContainEqual(['correa', expect.anything()]); // 34 months: not yet
    expect(by('battery_age')).toEqual([['battery', 'act']]);
  });

  it('the order is canonical: act, then watch, then info; the same data gives the same list', () => {
    const i = input({ reminders: [{ id: 'oil', title: 'Aceite', metric: 'km', dueKm: 100_100, dueDate: null, isEnabled: true }], spend: [{ at: '2026-10-20', amountDop: 6000, category: 'combustible' }], lastService: { rotacion: '2026-01-10', alineacion: null, frenos: null, bateria: null, correa: null, refrigerante: null } });
    const a = buildFacts(i);
    expect(a.map((f) => f.severity)).toEqual([...a.map((f) => f.severity)].sort((x, y) => ({ act: 0, watch: 1, info: 2 }[x] - { act: 0, watch: 1, info: 2 }[y])));
    expect(buildFacts(i)).toEqual(a);
  });
});

describe('factsHash — the key for the cache and the digest', () => {
  const facts = () => buildFacts(input({ reminders: [{ id: 'oil', title: 'Aceite', metric: 'km', dueKm: 100_400, dueDate: null, isEnabled: true }] }));
  it('is stable: the same facts, the same 16 hex digits', () => {
    expect(factsHash(facts())).toBe(factsHash(facts()));
    expect(factsHash(facts())).toMatch(/^[0-9a-f]{16}$/);
  });
  it('a changed number changes it; a new fact changes it; no facts has a key too', () => {
    const base = factsHash(facts());
    expect(factsHash(buildFacts(input({ reminders: [{ id: 'oil', title: 'Aceite', metric: 'km', dueKm: 100_300, dueDate: null, isEnabled: true }] })))).not.toBe(base);
    expect(factsHash([...facts(), ...buildFacts(input({ readings: steady(9, 7, 40, 100_000, '2026-09-01') }))])).not.toBe(base);
    expect(factsHash([])).toMatch(/^[0-9a-f]{16}$/);
  });
});
