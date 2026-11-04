/**
 * IMP 03112026 SPEC-E §E1: the adapter from the app's economy logic to the engine's plain points. The rule that matters: only a
 * full-to-full span is "measured", so a partial fill is never an anomaly, whatever unit the car counts in.
 */
import { economyPointsOf, fuelClassOf, vehicleClassOf } from '@/lib/domain/predictInput';
import type { GaugeFillUp } from '@/lib/domain/partialEconomy';
import { GAL_L } from '@/lib/domain/units';

let n = 0;
const log = (o: Partial<GaugeFillUp> & { odometerKm: number; volume: number }): GaugeFillUp => ({
  id: `f${++n}`, vehicleId: 'v', occurredAt: `2026-0${1 + Math.floor(n / 9)}-${String((n % 9) * 3 + 1).padStart(2, '0')}T12:00:00.000Z`, pricePerUnit: 340, totalDop: o.volume * 340,
  fuelType: 'regular', isFullTank: true, station: '', notes: '', createdAt: `2026-01-01T12:00:00.000Z`, ...o,
});
const gal = { capacityL: 45, unitL: GAL_L };

/** Five full tanks of 10 gal every 300 km (30 km/gal), then the one being judged. */
const run = (lastKm: number, lastVol = 10, over: Partial<GaugeFillUp> = {}) => {
  n = 0;
  const fills = [log({ odometerKm: 1000, volume: 10 })];
  for (let i = 1; i <= 5; i++) fills.push(log({ odometerKm: 1000 + 300 * i, volume: 10 }));
  const last = log({ odometerKm: 2500 + lastKm, volume: lastVol, ...over });
  return { fills: [...fills, last], last };
};

describe('vehicleClassOf', () => {
  it.each([['motor', 'motorcycle'], ['camion', 'truck'], ['camioneta', 'truck'], ['guagua', 'truck'], ['jeepeta', 'suv'], ['carro', 'car'], ['otro', 'car'], [null, 'car'], [undefined, 'car']])('%s → %s', (t, c) => {
    expect(vehicleClassOf(t as string | null)).toBe(c);
  });
});

describe('economyPointsOf', () => {
  it('a full-to-full span is measured and normalised to gallons / km per gallon', () => {
    const { fills } = run(300);
    const pts = economyPointsOf(fills, gal);
    const last = pts[pts.length - 1];
    expect(last).toMatchObject({ measured: true, distanceKm: 300 });
    expect(last.kmPerGal).toBeCloseTo(30, 1);
    expect(last.volumeGal).toBeCloseTo(10, 1);
  });
  it('a car that counts in LITRES gives the same km/gal', () => {
    n = 0;
    const L = (km: number, liters: number) => log({ odometerKm: km, volume: liters });
    const fills = [L(1000, 37.85), L(1300, 37.85), L(1600, 37.85)];
    const last = economyPointsOf(fills, { capacityL: 45, unitL: 1 }).pop()!;
    expect(last.kmPerGal).toBeCloseTo(30, 0);
    expect(last.volumeGal).toBeCloseTo(10, 1);
  });
  it('a PARTIAL fill is not measured', () => {
    const { fills, last } = run(200, 5, { isFullTank: false });
    const p = economyPointsOf(fills, gal).find((x) => x.fillupId === last.id);
    expect(p?.measured).toBe(false);
  });
  it('the first fill-up has no point (nothing to compare it with)', () => {
    const { fills } = run(300);
    expect(economyPointsOf(fills, gal).find((p) => p.fillupId === fills[0].id)).toBeUndefined();
  });
});

describe('fuelClassOf — the badge on the fill-up detail', () => {
  it('a normal fill-up is optimal against the car’s own 30 km/gal baseline', () => {
    const { fills, last } = run(300);
    expect(fuelClassOf(last.id, fills, gal, 'car')).toMatchObject({ state: 'optimal', reason: 'within_band', baseline: 30 });
  });
  it('a full tank at half the usual economy is abnormal (below the baseline)', () => {
    const { fills, last } = run(150);
    expect(fuelClassOf(last.id, fills, gal, 'car')).toMatchObject({ state: 'abnormal', direction: 'below', deviationPct: -50 });
  });
  it('SGC’s case: 11 km on a full tank is insufficient, never optimal', () => {
    const { fills, last } = run(11);
    expect(fuelClassOf(last.id, fills, gal, 'car')).toMatchObject({ state: 'insufficient', reason: 'short_distance' });
  });
  it('a partial fill is insufficient, however bad the number looks', () => {
    const { fills, last } = run(90, 10, { isFullTank: false });
    expect(fuelClassOf(last.id, fills, gal, 'car')?.state).toBe('insufficient');
  });
  it('fewer than 3 earlier full tanks: no baseline, no verdict', () => {
    n = 0;
    const fills = [log({ odometerKm: 1000, volume: 10 }), log({ odometerKm: 1300, volume: 10 }), log({ odometerKm: 1600, volume: 10 })];
    expect(fuelClassOf(fills[2].id, fills, gal, 'car')).toMatchObject({ state: 'insufficient', reason: 'no_baseline' });
  });
  it('a fill-up with no previous one, or an unknown id → null', () => {
    const { fills } = run(300);
    expect(fuelClassOf(fills[0].id, fills, gal, 'car')).toBeNull();
    expect(fuelClassOf('nope', fills, gal, 'car')).toBeNull();
  });
  it('20 km/gal is only LOW for a car (a third under its own 30) but out of range for a motorcycle (floor 25)', () => {
    const { fills, last } = run(200);
    expect(fuelClassOf(last.id, fills, gal, 'car')).toMatchObject({ state: 'low', direction: 'below' });
    expect(fuelClassOf(last.id, fills, gal, 'motorcycle')).toMatchObject({ state: 'abnormal', reason: 'out_of_range', direction: 'below' });
  });
});
