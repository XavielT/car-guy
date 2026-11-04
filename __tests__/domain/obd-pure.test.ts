/**
 * IMP 03112026 SPEC-D §D2–D4, PROMPT-04: scanner text → codes, warning lights, price vs own history, warranty watcher,
 * re-scan reminder. All pure.
 */
import { DASH_LIGHTS, LIGHT_COLORS, actionOf, rankLights, telltaleOf, urgencyOf } from '@/lib/domain/dashLights';
import { extractCodes, extractFreezeFrame } from '@/lib/domain/dtcParse';
import { SIMILAR_BAND, activeWarrantiesFor, priceVsHistory, rescanReminder } from '@/lib/domain/repairs';
import type { ServiceRecord } from '@/lib/db/types';

describe('extractCodes — scanner text', () => {
  it('finds well-formed codes in a pasted list, in order, without repeats', () => {
    expect(extractCodes('P0301, p0420\nP0301  c0035;B0010 U0100')).toEqual(['P0301', 'P0420', 'C0035', 'B0010', 'U0100']);
  });
  it('reads them out of a messy scanner screen (labels, descriptions, status)', () => {
    const screen = `Stored DTCs (2)\nP0420 - Catalyst System Efficiency Below Threshold (Bank 1)\nPending: P0171 System Too Lean\nCleared: none`;
    expect(extractCodes(screen)).toEqual(['P0420', 'P0171']);
  });
  it.each([['P03011'], ['XP0301'], ['P4000'], ['P0G01'], ['hello world'], [''], ['2026-11-04'], ['B00100']])('%j has no code', (s) => {
    expect(extractCodes(s)).toEqual([]);
  });
  it('null and undefined are nothing; the list is capped at 12', () => {
    expect(extractCodes(null)).toEqual([]);
    expect(extractCodes(undefined)).toEqual([]);
    const many = Array.from({ length: 30 }, (_, i) => `P0${(0x300 + i).toString(16).toUpperCase()}`).join(' ');
    expect(extractCodes(many)).toHaveLength(12);
  });
});

describe('extractFreezeFrame', () => {
  it('reads labelled values only', () => {
    expect(extractFreezeFrame('Engine RPM: 2,450 rpm\nCoolant Temp 92 °C\nCalculated Load 35.5 %\nVehicle Speed 60 km/h')).toEqual({ rpm: 2450, coolantC: 92, loadPct: 35.5, speedKmh: 60 });
  });
  it('Spanish labels', () => {
    expect(extractFreezeFrame('Velocidad 80 km/h\nTemp. refrigerante 88 °C\nCarga del motor 22 %\n3100 rpm')).toEqual({ rpm: 3100, coolantC: 88, loadPct: 22, speedKmh: 80 });
  });
  it('converts Fahrenheit and mph', () => {
    const f = extractFreezeFrame('Coolant 194 F\nSpeed 37 mph')!;
    expect(f.coolantC).toBe(90);
    expect(f.speedKmh).toBe(60);
  });
  it('a number without its label is never taken; out-of-range values are dropped', () => {
    expect(extractFreezeFrame('Fuel trim 25\nOdometer 84000\nP0301')).toBeNull();
    expect(extractFreezeFrame('RPM 99999\nCoolant 900 C\nLoad 400 %\nSpeed 999 km/h')).toBeNull();
  });
  it('nothing → null', () => {
    expect(extractFreezeFrame('')).toBeNull();
    expect(extractFreezeFrame(undefined)).toBeNull();
  });
});

describe('dash lights', () => {
  it('check engine goes to OBD; oil, coolant, battery, tyre and brake go to their telltale; unknown lights go nowhere', () => {
    expect(actionOf('check_engine')).toEqual({ kind: 'obd' });
    expect(actionOf('oil_pressure')).toEqual({ kind: 'telltale', telltale: 'oil' });
    expect(actionOf('coolant_temp')).toEqual({ kind: 'telltale', telltale: 'coolant' });
    expect(actionOf('battery_charge')).toEqual({ kind: 'telltale', telltale: 'battery' });
    expect(actionOf('tire_pressure')).toEqual({ kind: 'telltale', telltale: 'tire' });
    expect(actionOf('abs')).toEqual({ kind: 'telltale', telltale: 'brake' });
    expect(actionOf('seat_belt')).toEqual({ kind: 'none' });
    expect(telltaleOf('other')).toBeNull();
  });
  it.each([
    ['oil_pressure', 'red', 'stop'], ['coolant_temp', 'red', 'stop'], ['brake_system', 'red', 'stop'], ['battery_charge', 'red', 'stop'], ['airbag', 'red', 'stop'],
    ['check_engine', 'red', 'stop'], ['check_engine', 'amber', 'soon'], ['abs', 'amber', 'soon'], ['tire_pressure', 'amber', 'soon'],
    ['fuel_low', 'amber', 'info'], ['seat_belt', 'red', 'info'], ['door_ajar', 'amber', 'info'], ['glow_plug', 'green', 'info'], ['traction_control', 'blue', 'info'],
  ] as const)('%s %s → %s', (light, color, want) => {
    expect(urgencyOf(light, color)).toBe(want);
  });
  it('an unknown colour is never "info" for a safety light', () => {
    expect(urgencyOf('brake_system', null)).toBe('soon');
    expect(urgencyOf('oil_pressure', 'other')).toBe('soon');
  });
  it('ranks the most urgent first, then by confidence', () => {
    const r = rankLights([
      { light: 'tire_pressure', color: 'amber', confidence: 0.9 },
      { light: 'oil_pressure', color: 'red', confidence: 0.6 },
      { light: 'check_engine', color: 'amber', confidence: 0.95 },
    ]);
    expect(r.map((x) => x.light)).toEqual(['oil_pressure', 'check_engine', 'tire_pressure']);
    expect(r[0].urgency).toBe('stop');
  });
  it('the closed lists have no repeats', () => {
    expect(new Set(DASH_LIGHTS).size).toBe(DASH_LIGHTS.length);
    expect(new Set(LIGHT_COLORS).size).toBe(LIGHT_COLORS.length);
  });
});

const rec = (over: Partial<ServiceRecord>): ServiceRecord =>
  ({ id: 'r', vehicleId: 'v1', kind: 'reparacion', occurredAt: '2026-01-10T12:00:00.000Z', odometerKm: 80000, title: 'Pastillas de frenos', description: '', costPartsDop: 0, costLaborDop: 0, totalDop: 4000, shop: 'Taller Pérez', doneBy: 'shop', system: 'frenos', warrantyUntilDate: null, warrantyUntilKm: null, deletedAt: null, ...over }) as ServiceRecord;

describe('priceVsHistory — only the person’s own data', () => {
  const now = { system: 'frenos' as const, title: 'Pastillas y discos de frenos', totalDop: 5520, occurredAt: '2026-11-01T12:00:00.000Z' };

  it('"+38 % vs your last brake job"', () => {
    const c = priceVsHistory(now, [rec({ id: 'a', totalDop: 4000 })]);
    expect(c).toMatchObject({ verdict: 'higher', n: 1, vsLastPct: 38, vsMedianPct: null, median: null });
    expect(c.last).toEqual({ total: 4000, date: '2026-01-10', title: 'Pastillas de frenos' });
  });
  it('within ±10 % is "similar"; cheaper is "lower"', () => {
    expect(priceVsHistory({ ...now, totalDop: 4300 }, [rec({ totalDop: 4000 })]).verdict).toBe('similar');
    expect(priceVsHistory({ ...now, totalDop: 4000 * (1 + SIMILAR_BAND) }, [rec({ totalDop: 4000 })]).verdict).toBe('similar');
    expect(priceVsHistory({ ...now, totalDop: 3000 }, [rec({ totalDop: 4000 })])).toMatchObject({ verdict: 'lower', vsLastPct: -25 });
  });
  it('with 3 or more earlier jobs the MEDIAN is the baseline', () => {
    const h = [rec({ id: 'a', totalDop: 3000, occurredAt: '2025-01-01T12:00:00.000Z' }), rec({ id: 'b', totalDop: 4000, occurredAt: '2025-06-01T12:00:00.000Z' }), rec({ id: 'c', totalDop: 9000, occurredAt: '2026-01-01T12:00:00.000Z' })];
    const c = priceVsHistory({ ...now, totalDop: 4200 }, h);
    expect(c.median).toBe(4000);
    expect(c.vsMedianPct).toBe(5);
    expect(c.verdict).toBe('similar'); // against the median, not the 9,000 outlier that was last
    expect(c.vsLastPct).toBe(-53);
  });
  it('with no system the title words still find the comparable job', () => {
    expect(priceVsHistory({ ...now, system: null }, [rec({ totalDop: 4000 })])).toMatchObject({ verdict: 'higher', n: 1 });
  });
  it('prefers jobs that share a word with the title; otherwise the whole system', () => {
    const h = [rec({ id: 'oil', title: 'Cambio de bomba de agua', totalDop: 20000, occurredAt: '2026-05-01T12:00:00.000Z' }), rec({ id: 'br', title: 'Frenos traseros', totalDop: 4000 })];
    expect(priceVsHistory(now, h).last?.title).toBe('Frenos traseros');
    expect(priceVsHistory({ ...now, title: 'Algo distinto' }, h).n).toBe(2);
  });
  it('NO baseline: nothing earlier, another system, a later repair, no total, or no system — and it never invents a number', () => {
    for (const c of [
      priceVsHistory(now, []),
      priceVsHistory(now, [rec({ system: 'motor' })]),
      priceVsHistory(now, [rec({ occurredAt: '2027-01-01T12:00:00.000Z' })]),
      priceVsHistory({ ...now, totalDop: 0 }, [rec({})]),
      priceVsHistory({ ...now, system: null, title: 'Algo distinto' }, [rec({})]), // no system and no shared word: nothing to compare
    ]) {
      expect(c).toEqual({ verdict: 'no_baseline', n: 0, last: null, median: null, vsLastPct: null, vsMedianPct: null });
    }
  });
  it('ignores the record being edited, deleted records, mantenimiento and zero-cost work', () => {
    const c = priceVsHistory({ ...now, id: 'me' }, [rec({ id: 'me', totalDop: 9999 }), rec({ id: 'del', deletedAt: '2026-02-01T00:00:00Z' }), rec({ id: 'm', kind: 'mantenimiento' }), rec({ id: 'free', totalDop: 0 })]);
    expect(c.verdict).toBe('no_baseline');
  });
});

describe('activeWarrantiesFor — the warranty watcher', () => {
  const today = '2026-11-04T12:00:00.000Z'; // the app's todayIso(): local noon, like the stored dates
  const w = (over: Partial<ServiceRecord>) => rec({ id: 'w', warrantyUntilDate: '2027-01-12T12:00:00.000Z', ...over });

  it('same system, still running → a banner with the shop and the days left', () => {
    const [b] = activeWarrantiesFor('frenos', [w({})], today, 90000);
    expect(b).toMatchObject({ recordId: 'w', shop: 'Taller Pérez', daysLeft: 69, kmLeft: null, untilKm: null });
  });
  it('another system, none given, expired, or the car’s own work → nothing for a shop banner of another system', () => {
    expect(activeWarrantiesFor('motor', [w({})], today, null)).toEqual([]);
    expect(activeWarrantiesFor(null, [w({})], today, null)).toEqual([]);
    expect(activeWarrantiesFor('frenos', [w({ warrantyUntilDate: '2026-10-01T12:00:00.000Z' })], today, null)).toEqual([]);
    expect(activeWarrantiesFor('frenos', [rec({})], today, null)).toEqual([]);
  });
  it('"6 months OR 10,000 km": it ends at whichever limit comes FIRST', () => {
    const both = w({ warrantyUntilKm: 90_000 });
    expect(activeWarrantiesFor('frenos', [both], today, 89_000)[0].kmLeft).toBe(1000);
    expect(activeWarrantiesFor('frenos', [both], today, 91_000)).toEqual([]); // km passed, date not
    expect(activeWarrantiesFor('frenos', [w({ warrantyUntilDate: null, warrantyUntilKm: 95_000 })], today, 90_000)[0]).toMatchObject({ daysLeft: null, kmLeft: 5000 });
    expect(activeWarrantiesFor('frenos', [w({ warrantyUntilDate: null, warrantyUntilKm: 95_000 })], today, null)[0].kmLeft).toBeNull(); // unknown odometer: not excluded
  });
  it('the soonest end first; the repair being edited is excluded; own work has no shop name', () => {
    const list = activeWarrantiesFor('frenos', [w({ id: 'late', warrantyUntilDate: '2027-06-01T12:00:00.000Z' }), w({ id: 'soon', warrantyUntilDate: '2026-11-20T12:00:00.000Z', occurredAt: '2026-06-01T12:00:00.000Z' }), w({ id: 'self', doneBy: 'self', shop: '', warrantyUntilDate: '2027-02-01T12:00:00.000Z', occurredAt: '2026-05-01T12:00:00.000Z' })], today, null, 'late');
    expect(list.map((b) => b.recordId)).toEqual(['soon', 'self']);
    expect(list[1].shop).toBeNull();
  });
});

describe('rescanReminder', () => {
  it('is a date a few days out, named for the code', () => {
    expect(rescanReminder('P0420', '2026-11-04')).toEqual({ title: 'Volver a escanear P0420', dueDate: '2026-11-07' });
    expect(rescanReminder('C0035', '2026-12-30', 7).dueDate).toBe('2027-01-06');
  });
});
