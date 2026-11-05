import { buildRecap, nextRecapNotificationAt, parseRecapId, periodsWithData, periodWindow, previousPeriod, recapId, recapReady, type RecapInput } from '@/lib/domain/recap';
import { DEFAULT_SHARE, shareableCount, toShareModel } from '@/lib/domain/recapShare';
import { distanceInRange, inRange, totalSpend } from '@/lib/domain/stats';
import type { FillUp } from '@/lib/types';

// Local-time timestamps (the app's boundaries are local dates).
const at = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m - 1, d, h, min).toISOString();
const TODAY = at(2026, 11, 5);
const V1 = { id: 'v1', name: 'Trueno AE85', photoMediaId: null };
const V2 = { id: 'v2', name: 'DS3', photoMediaId: null };

let n = 0;
const fill = (vehicleId: string, iso: string, odo: number, vol: number, total: number, full = true): FillUp =>
  ({ id: `f${++n}`, vehicleId, occurredAt: iso, odometerKm: odo, volume: vol, pricePerUnit: total / vol, totalDop: total, fuelType: 'premium', isFullTank: full, station: '', notes: '', createdAt: iso }) as FillUp;
const trip = (vehicleId: string, iso: string, km: number, maxKmh: number | null, mins = 30) => ({ vehicleId, startedAt: iso, distanceM: km * 1000, durationS: mins * 60, movingS: mins * 60 - 120, maxKmh, avgMovingKmh: maxKmh ? maxKmh / 2 : null });

const empty: RecapInput = { vehicles: [V1], fillups: [], spend: [], readings: [], trips: [], services: [] };

/** October 2026 for v1, with a September behind it. */
const normal: RecapInput = {
  vehicles: [V1],
  fillups: [fill('v1', at(2026, 9, 5), 50000, 10, 3000), fill('v1', at(2026, 9, 20), 50380, 10, 3100), fill('v1', at(2026, 10, 6), 50760, 10, 3200), fill('v1', at(2026, 10, 22), 51200, 11, 3500)],
  spend: [
    { vehicleId: 'v1', occurredAt: at(2026, 9, 5), category: 'combustible', amountDop: 3000 },
    { vehicleId: 'v1', occurredAt: at(2026, 10, 6), category: 'combustible', amountDop: 3200 },
    { vehicleId: 'v1', occurredAt: at(2026, 10, 22), category: 'combustible', amountDop: 3500 },
    { vehicleId: 'v1', occurredAt: at(2026, 10, 12), category: 'mantenimiento', amountDop: 4500 },
    { vehicleId: 'v1', occurredAt: at(2026, 10, 30), category: 'legal', amountDop: 1200 },
  ],
  readings: [
    { vehicleId: 'v1', occurredAt: at(2026, 9, 5), valueKm: 50000 },
    { vehicleId: 'v1', occurredAt: at(2026, 9, 30), valueKm: 50600 },
    { vehicleId: 'v1', occurredAt: at(2026, 10, 6), valueKm: 50760 },
    { vehicleId: 'v1', occurredAt: at(2026, 10, 31), valueKm: 51500 },
  ],
  trips: [trip('v1', at(2026, 10, 3), 12.5, 96), trip('v1', at(2026, 10, 9), 40, 132, 60), trip('v1', at(2026, 10, 9, 18), 8, 70, 20)],
  services: [{ vehicleId: 'v1', occurredAt: at(2026, 10, 12), kind: 'mantenimiento' }],
};

const kinds = (r: ReturnType<typeof buildRecap>) => r.cards.map((c) => c.kind);
const OCT = { kind: 'month', year: 2026, month: 9 } as const;
const scope = { kind: 'vehicle', vehicleId: 'v1' } as const;

describe('buildRecap — shape and rules (SPEC-J §J0, §J7)', () => {
  it('an empty period is thin and has only the cover: never a "0 km" card', () => {
    const r = buildRecap(empty, OCT, scope, TODAY);
    expect(kinds(r)).toEqual(['cover']);
    expect(r.thin).toBe(true);
    expect(r.shareable).toBe(false);
    expect(JSON.stringify(r.cards)).not.toMatch(/"km":0/);
  });

  it('a thin month shows what exists, not zeros', () => {
    const thin: RecapInput = { ...empty, fillups: [fill('v1', at(2026, 10, 6), 50760, 10, 3200)], spend: [{ vehicleId: 'v1', occurredAt: at(2026, 10, 6), category: 'combustible', amountDop: 3200 }] };
    const r = buildRecap(thin, OCT, scope, TODAY);
    expect(kinds(r)).toEqual(['cover', 'fuel', 'cost', 'closer'].filter((k) => k !== 'closer'));
    const fuel = r.cards.find((c) => c.kind === 'fuel');
    // One tank only: efficiency needs two full tanks, so it is null — never an invented number.
    expect(fuel).toMatchObject({ kind: 'fuel', efficiency: null, efficiencyPairs: 0 });
  });

  it('a normal month has the cards that have data, in order', () => {
    const r = buildRecap(normal, OCT, scope, TODAY);
    expect(kinds(r)).toEqual(['cover', 'distance', 'speed', 'fuel', 'cost', 'care', 'compare', 'closer']);
    expect(r.thin).toBe(false);
    expect(r.partial).toBe(false);
  });

  it('speed is the top trip speed of the month and the moving average is weighted by moving time', () => {
    const s = buildRecap(normal, OCT, scope, TODAY).cards.find((c) => c.kind === 'speed');
    expect(s).toMatchObject({ topKmh: 132 });
  });

  it('efficiency comes only from full-to-full pairs that close inside the month', () => {
    const f = buildRecap(normal, OCT, scope, TODAY).cards.find((c) => c.kind === 'fuel');
    // Oct: pairs (9/20→10/6: 380 km / 10 gal of the 10/6 fill) and (10/6→10/22: 440 km / 11 gal) = 820 / 21 = 39.0
    expect(f).toMatchObject({ kind: 'fuel', volume: 21, spend: 6700, efficiency: 39, efficiencyPairs: 2 });
  });

  it('a partial tank in between never becomes its own tank', () => {
    const input: RecapInput = { ...normal, fillups: [fill('v1', at(2026, 10, 2), 50000, 10, 3000), fill('v1', at(2026, 10, 10), 50200, 5, 1500, false), fill('v1', at(2026, 10, 20), 50400, 5, 1500)] };
    const f = buildRecap(input, OCT, scope, TODAY).cards.find((c) => c.kind === 'fuel');
    expect(f).toMatchObject({ efficiencyPairs: 1, efficiency: 40 });
  });

  it('comparison appears only when the previous period has data', () => {
    expect(kinds(buildRecap(normal, OCT, scope, TODAY))).toContain('compare');
    const noPrev: RecapInput = { ...normal, fillups: normal.fillups.filter((f) => f.occurredAt >= at(2026, 10, 1)), spend: normal.spend.filter((r) => r.occurredAt >= at(2026, 10, 1)), readings: normal.readings.filter((r) => r.occurredAt >= at(2026, 10, 1)) };
    expect(kinds(buildRecap(noPrev, OCT, scope, TODAY))).not.toContain('compare');
  });

  it('the current month is "so far"; a past one is not', () => {
    expect(buildRecap(normal, { kind: 'month', year: 2026, month: 10 }, scope, TODAY).partial).toBe(true);
    expect(buildRecap(normal, OCT, scope, TODAY).partial).toBe(false);
  });

  it('overdue / expiring items count only for the current period (they are "now", not history)', () => {
    const withNow = { ...normal, overdueNow: 2, docsExpiring: 1 };
    const past = buildRecap(withNow, OCT, scope, TODAY).cards.find((c) => c.kind === 'care');
    expect(past).toMatchObject({ overdueNow: 0, docsExpiring: 0 });
  });
});

describe('cross-check with Cifras (SPEC-J §J8): the same numbers, from the same functions', () => {
  it('cost total, distance and cost per km equal the Cifras arithmetic for the same window', () => {
    const r = buildRecap(normal, OCT, scope, TODAY);
    const w = periodWindow(OCT);
    const spendTotal = totalSpend(inRange(normal.spend, w.from, w.to));
    const km = Math.round(distanceInRange(normal.readings, w.from, w.to));
    const cost = r.cards.find((c) => c.kind === 'cost');
    const dist = r.cards.find((c) => c.kind === 'distance');
    expect(cost).toMatchObject({ total: spendTotal });
    expect(dist).toMatchObject({ km });
    expect((cost as { costPerKm: number }).costPerKm).toBeCloseTo(spendTotal / km, 2);
  });

  it('the cover headline is the distance card', () => {
    const r = buildRecap(normal, OCT, scope, TODAY);
    expect((r.cards[0] as { headlineKm: number }).headlineKm).toBe((r.cards.find((c) => c.kind === 'distance') as { km: number }).km);
  });
});

describe('boundaries are local calendar dates (DST, year boundary)', () => {
  it('a record at 23:59 local on the last day is in the month; one at 00:00 the next day is out', () => {
    const input: RecapInput = { ...empty, spend: [{ vehicleId: 'v1', occurredAt: at(2026, 10, 31, 23, 59), category: 'otros', amountDop: 100 }, { vehicleId: 'v1', occurredAt: at(2026, 11, 1, 0, 0), category: 'otros', amountDop: 900 }] };
    const r = buildRecap(input, OCT, scope, TODAY);
    expect(r.cards.find((c) => c.kind === 'cost')).toMatchObject({ total: 100 });
  });

  it('the day the clocks change is a normal day (a record at 12:00 local is in that month in any zone)', () => {
    // 2026-03-08 is the US spring-forward; 2026-10-25 the EU fall-back: both inside their months for any TZ.
    for (const [y, m, d] of [[2026, 3, 8], [2026, 10, 25], [2026, 11, 1]] as const) {
      const input: RecapInput = { ...empty, spend: [{ vehicleId: 'v1', occurredAt: at(y, m, d, 12), category: 'otros', amountDop: 50 }] };
      const r = buildRecap(input, { kind: 'month', year: y, month: m - 1 }, scope, TODAY);
      expect(r.cards.find((c) => c.kind === 'cost')).toMatchObject({ total: 50 });
    }
  });

  it('January compares with December of the previous year', () => {
    expect(previousPeriod({ kind: 'month', year: 2026, month: 0 })).toEqual({ kind: 'month', year: 2025, month: 11 });
    const input: RecapInput = { ...empty, spend: [{ vehicleId: 'v1', occurredAt: at(2025, 12, 20), category: 'otros', amountDop: 500 }, { vehicleId: 'v1', occurredAt: at(2026, 1, 10), category: 'otros', amountDop: 700 }] };
    const r = buildRecap(input, { kind: 'month', year: 2026, month: 0 }, scope, TODAY);
    expect(r.cards.find((c) => c.kind === 'compare')).toMatchObject({ previousLabel: '2025-12' });
  });

  it('ids round-trip', () => {
    expect(recapId({ kind: 'month', year: 2026, month: 9 })).toBe('2026-10');
    expect(parseRecapId('2026-10')).toEqual({ kind: 'month', year: 2026, month: 9 });
    expect(parseRecapId('2026')).toEqual({ kind: 'year', year: 2026 });
    expect(parseRecapId('2026-13')).toBeNull();
    expect(parseRecapId('x')).toBeNull();
  });
});

describe('yearly and multi-vehicle', () => {
  const year: RecapInput = {
    vehicles: [V1, V2],
    fillups: [],
    spend: [
      { vehicleId: 'v1', occurredAt: at(2026, 2, 10), category: 'combustible', amountDop: 2000 },
      { vehicleId: 'v1', occurredAt: at(2026, 8, 10), category: 'mantenimiento', amountDop: 6000 },
      { vehicleId: 'v2', occurredAt: at(2026, 5, 3), category: 'combustible', amountDop: 1500 },
    ],
    readings: [
      { vehicleId: 'v1', occurredAt: at(2026, 1, 5), valueKm: 40000 },
      { vehicleId: 'v1', occurredAt: at(2026, 6, 5), valueKm: 42000 },
      { vehicleId: 'v1', occurredAt: at(2026, 11, 5), valueKm: 44000 },
      { vehicleId: 'v2', occurredAt: at(2026, 2, 5), valueKm: 90000 },
      { vehicleId: 'v2', occurredAt: at(2026, 9, 5), valueKm: 90500 },
    ],
    trips: [],
    services: [],
  };
  const Y = { kind: 'year', year: 2026 } as const;

  it('a year has month bars, and the km add up across cars (an odometer is per car)', () => {
    const r = buildRecap(year, Y, { kind: 'all' }, TODAY);
    expect(kinds(r)).toContain('months');
    const dist = r.cards.find((c) => c.kind === 'distance') as { km: number };
    expect(dist.km).toBe(4000 + 500);
    const garage = r.cards.find((c) => c.kind === 'garage') as { cars: { name: string; km: number }[]; mostDriven: string };
    expect(garage.cars.map((c) => c.name)).toEqual(['Trueno AE85', 'DS3']);
    expect(garage.mostDriven).toBe('Trueno AE85');
  });

  it('one car has the odometer start → end card; several cars do not', () => {
    expect(kinds(buildRecap(year, Y, { kind: 'vehicle', vehicleId: 'v1' }, TODAY))).toContain('odometer');
    expect(kinds(buildRecap(year, Y, { kind: 'all' }, TODAY))).not.toContain('odometer');
  });

  it('month bars attribute each gap to the later reading, like Cifras, and add up to the year', () => {
    const r = buildRecap(year, Y, { kind: 'vehicle', vehicleId: 'v1' }, TODAY);
    const months = (r.cards.find((c) => c.kind === 'months') as { months: { month: number; km: number; spend: number }[] }).months;
    expect(months).toHaveLength(12);
    const total = months.reduce((s, m) => s + m.km, 0);
    expect(total).toBe((r.cards.find((c) => c.kind === 'distance') as { km: number }).km);
    expect(months[5].km).toBe(2000);
    expect(months[10].km).toBe(2000);
    expect(months[1].spend).toBe(2000);
    expect(months[7].spend).toBe(6000);
  });
});

describe('what is ready and when', () => {
  it('days 1–14 of a month offer the month that just closed', () => {
    expect(recapReady(at(2026, 11, 5))).toEqual([{ kind: 'month', year: 2026, month: 9 }]);
    expect(recapReady(at(2026, 11, 14))).toHaveLength(1);
    expect(recapReady(at(2026, 11, 15))).toEqual([]);
  });
  it('January offers the year too', () => {
    expect(recapReady(at(2027, 1, 3))).toEqual([{ kind: 'year', year: 2026 }, { kind: 'month', year: 2026, month: 11 }]);
  });
  it('the next notification is 09:00 local on the 1st', () => {
    const d = nextRecapNotificationAt(new Date(2026, 10, 5, 10, 0));
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()]).toEqual([2026, 11, 1, 9, 0]);
    const e = nextRecapNotificationAt(new Date(2026, 10, 1, 8, 0));
    expect([e.getMonth(), e.getDate(), e.getHours()]).toEqual([10, 1, 9]);
  });
  it('periods with data are listed newest first', () => {
    const list = periodsWithData(normal, TODAY);
    expect(list[0]).toEqual({ kind: 'year', year: 2026 }.kind === 'year' ? list[0] : list[0]);
    expect(list.filter((p) => p.kind === 'month').map(recapId)).toEqual(['2026-10', '2026-09']);
  });
});

describe('performance: a year of data builds well under 300 ms', () => {
  it('3,000 fill-ups, 8,000 spend rows, 6,000 readings, 2,000 trips', () => {
    const big: RecapInput = { vehicles: [V1], fillups: [], spend: [], readings: [], trips: [], services: [] };
    for (let i = 0; i < 3000; i++) big.fillups.push(fill('v1', at(2026, 1 + (i % 12), 1 + (i % 27)), 10000 + i * 40, 9, 2800));
    for (let i = 0; i < 8000; i++) big.spend.push({ vehicleId: 'v1', occurredAt: at(2026, 1 + (i % 12), 1 + (i % 27)), category: 'otros', amountDop: 100 });
    for (let i = 0; i < 6000; i++) big.readings.push({ vehicleId: 'v1', occurredAt: at(2026, 1 + (i % 12), 1 + (i % 27)), valueKm: 10000 + i * 5 });
    for (let i = 0; i < 2000; i++) big.trips.push(trip('v1', at(2026, 1 + (i % 12), 1 + (i % 27)), 10, 90));
    const t0 = Date.now();
    buildRecap(big, { kind: 'year', year: 2026 }, scope, TODAY);
    expect(Date.now() - t0).toBeLessThan(300);
  });
});

describe('toShareModel: privacy by omission (SPEC-J §J5)', () => {
  const recap = buildRecap({ ...normal, overdueNow: 3, docsExpiring: 2 }, OCT, scope, TODAY);
  const yearRecap = buildRecap(
    {
      vehicles: [V1],
      fillups: [],
      spend: [{ vehicleId: 'v1', occurredAt: at(2026, 3, 1), category: 'combustible', amountDop: 2000 }],
      readings: [{ vehicleId: 'v1', occurredAt: at(2026, 1, 5), valueKm: 40000 }, { vehicleId: 'v1', occurredAt: at(2026, 11, 5), valueKm: 44123 }],
      trips: [trip('v1', at(2026, 3, 3), 12, 100)],
      services: [{ vehicleId: 'v1', occurredAt: at(2026, 3, 4), kind: 'mantenimiento' }],
    },
    { kind: 'year', year: 2026 },
    scope,
    TODAY,
  );
  const SPEND_KEYS = ['spend', 'total', 'avgPrice', 'invested', 'byCategory', 'biggest', 'costPerKm'];
  const ALWAYS_OUT = ['startKm', 'endKm', 'plate', 'vin', 'overdueNow', 'docsExpiring', 'photoMediaId', 'longestTripDate', 'busiestDay', 'topDate'];

  it('by default there is no spend anywhere', () => {
    for (const r of [recap, yearRecap]) {
      const json = JSON.stringify(toShareModel(r, DEFAULT_SHARE));
      for (const k of SPEND_KEYS) expect({ k, present: json.includes(`"${k}"`) }).toEqual({ k, present: false });
      expect(toShareModel(r).cards.some((c) => c.kind === 'cost')).toBe(false);
    }
  });

  it('never carries the odometer, plate, VIN, overdue/expiring items or exact dates of places, whatever the toggles', () => {
    for (const r of [recap, yearRecap]) {
      const json = JSON.stringify(toShareModel(r, { showSpend: true, showVehicleName: true, showUserName: true, userName: 'Xaviel' }));
      for (const k of ALWAYS_OUT) expect({ k, present: json.includes(`"${k}"`) }).toEqual({ k, present: false });
      expect(json).not.toContain('44123');
      expect(json).not.toContain('40000');
    }
    expect(toShareModel(yearRecap, { ...DEFAULT_SHARE, showSpend: true }).cards.some((c) => (c.kind as string) === 'odometer')).toBe(false);
  });

  it('with spend on, the spend cards appear', () => {
    const m = toShareModel(recap, { ...DEFAULT_SHARE, showSpend: true });
    expect(m.cards.some((c) => c.kind === 'cost')).toBe(true);
    expect(JSON.stringify(m)).toContain('"total"');
  });

  it('the car name and the person name appear only when turned on', () => {
    const off = JSON.stringify(toShareModel(recap, { showSpend: false, showVehicleName: false, showUserName: false, userName: 'Xaviel' }));
    expect(off).not.toContain('Trueno');
    expect(off).not.toContain('Xaviel');
    const on = JSON.stringify(toShareModel(recap, { showSpend: false, showVehicleName: true, showUserName: true, userName: 'Xaviel' }));
    expect(on).toContain('Trueno');
    expect(on).toContain('Xaviel');
  });

  it('a thin recap is not shareable (fewer than two cards besides the cover)', () => {
    const thin = buildRecap({ ...empty, fillups: [fill('v1', at(2026, 10, 6), 50760, 10, 3200)], spend: [{ vehicleId: 'v1', occurredAt: at(2026, 10, 6), category: 'combustible', amountDop: 3200 }] }, OCT, scope, TODAY);
    expect(shareableCount(toShareModel(thin))).toBeLessThan(2);
  });
});
