import { computeEconomy } from '@/lib/domain/economy';
import { PER_FILL_BAND, perFillEconomy, perFillEconomyOf, perFillFor, perFillSeries } from '@/lib/domain/perFillEconomy';
import type { FillUp } from '@/lib/types';

function fill(id: string, day: string, odometerKm: number, volume: number, over: Partial<FillUp> = {}): FillUp {
  const pricePerUnit = 290;
  return {
    id,
    vehicleId: 'v1',
    occurredAt: `2026-${day}T16:00:00.000Z`,
    odometerKm,
    volume,
    pricePerUnit,
    totalDop: Math.round(volume * pricePerUnit * 100) / 100,
    fuelType: 'regular',
    isFullTank: true,
    station: '',
    notes: '',
    createdAt: `2026-${day}T16:00:00.000Z`,
    ...over,
  };
}

describe('perFillEconomy (note 9: partials must count)', () => {
  it('divides the km since the previous log by this log’s volume, flagged approx', () => {
    const map = perFillEconomy([fill('a', '09-01', 10_000, 10), fill('b', '09-08', 10_300, 10), fill('c', '09-15', 10_540, 8)]);
    expect(map.has('a')).toBe(false); // nothing before it
    expect(map.get('b')).toEqual({ kmPerUnit: 30, distanceKm: 300, previousId: 'a', approx: true });
    expect(map.get('c')?.kmPerUnit).toBeCloseTo(30, 5);
    expect(map.get('c')?.distanceKm).toBe(240);
  });

  it('skips a log flagged missedPrevious', () => {
    const map = perFillEconomy([
      fill('a', '09-01', 10_000, 10),
      fill('b', '09-08', 10_600, 10, { missedPrevious: true }),
      fill('c', '09-15', 10_900, 10),
    ]);
    expect(map.has('b')).toBe(false);
    expect(map.get('c')?.kmPerUnit).toBe(30);
  });

  it('skips a pair more than 60 days apart', () => {
    const map = perFillEconomy([fill('a', '01-01', 10_000, 10), fill('b', '03-15', 10_300, 10), fill('c', '03-20', 10_600, 10)]);
    expect(map.has('b')).toBe(false);
    expect(map.get('c')?.kmPerUnit).toBe(30);
    // Exactly 60 days still counts.
    expect(perFillFor(fill('y', '03-02', 10_300, 10), fill('x', '01-01', 10_000, 10))).not.toBeNull();
  });

  it('skips zero volume and a non-increasing odometer', () => {
    const map = perFillEconomy([fill('a', '09-01', 10_000, 10), fill('b', '09-08', 10_300, 0), fill('c', '09-10', 10_000, 5)]);
    expect(map.has('b')).toBe(false);
    // c's previous is b (by date) and the odometer went back.
    expect(map.has('c')).toBe(false);
    expect(perFillFor(fill('e', '09-12', 10_000, 5), fill('d', '09-11', 10_000, 5))).toBeNull();
  });

  it('orders unordered input by date and keeps vehicles apart', () => {
    const other = fill('z', '09-05', 50_000, 10, { vehicleId: 'v2' });
    const map = perFillEconomy([fill('c', '09-15', 10_540, 8), other, fill('a', '09-01', 10_000, 10), fill('b', '09-08', 10_300, 10)]);
    expect(map.get('b')?.previousId).toBe('a');
    expect(map.get('c')?.previousId).toBe('b');
    expect(map.has('z')).toBe(false);
    expect(perFillSeries([fill('c', '09-15', 10_540, 8), fill('a', '09-01', 10_000, 10), fill('b', '09-08', 10_300, 10)]).map((p) => p.fillUpId)).toEqual(['b', 'c']);
  });

  it('gives an RD$ 1,000 refill between full tanks its own number, and leaves the average alone', () => {
    // Full → RD$ 1,000 partial (≈ 3.45 gal at 290) → full.
    const partialVolume = 1000 / 290;
    const logs = [
      fill('a', '09-01', 10_000, 10),
      fill('p', '09-04', 10_100, partialVolume, { isFullTank: false, totalDop: 1000 }),
      fill('b', '09-10', 10_400, 10),
    ];
    const map = perFillEconomy(logs);
    expect(map.get('p')?.kmPerUnit).toBeCloseTo(100 / partialVolume, 5); // ≈ 29 km/gal
    expect(map.get('p')?.approx).toBe(true);
    expect(map.get('b')?.kmPerUnit).toBe(30); // 300 km since the partial / 10 gal
    expect(perFillEconomyOf('p', logs)?.distanceKm).toBe(100);
    expect(perFillEconomyOf('nope', logs)).toBeNull();
    // The measured brim-to-brim figure is untouched: 400 km / (3.45 + 10) gal.
    const measured = computeEconomy(logs);
    expect(measured).toHaveLength(1);
    expect(measured[0].kmPerUnit).toBeCloseTo(400 / (partialVolume + 10), 2);
  });
});

describe('perFillEconomy plausibility band (the DS3 on 2.3.1: "≈ 131 km/gal")', () => {
  it('hides a small top-up after a long stretch, keeps the believable ones', () => {
    // Full-to-full 30 km/gal; then 420 km on a 3.2-gal top-up (131) and a sane partial.
    const map = perFillEconomy([
      fill('a', '08-01', 10_000, 10),
      fill('b', '08-08', 10_300, 10),
      fill('c', '08-20', 10_720, 3.2, { isFullTank: false }),
      fill('d', '08-27', 10_900, 6, { isFullTank: false }),
    ]);
    expect(map.has('c')).toBe(false);
    expect(map.get('d')?.kmPerUnit).toBe(30);
    expect(PER_FILL_BAND[0]).toBeLessThan(1);
  });

  it('with no full-to-full figure, centres on the per-fill median (3 or more)', () => {
    const partial = { isFullTank: false } as const;
    const map = perFillEconomy([
      fill('a', '08-01', 10_000, 10, partial),
      fill('b', '08-05', 10_300, 10, partial),
      fill('c', '08-09', 10_600, 10, partial),
      fill('d', '08-13', 10_900, 10, partial),
      fill('e', '08-17', 11_500, 5, partial), // 120
    ]);
    expect([...map.keys()].sort()).toEqual(['b', 'c', 'd']);
  });
});

