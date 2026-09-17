import {
  completeAmounts,
  computeEconomy,
  latestEconomyInsight,
  reviewFillUp,
  sortFillUps,
} from '@/lib/domain/economy';
import type { FillUp } from '@/lib/types';

/**
 * These tests pin the behaviour Tu Combustible RD shipped with. The brim-to-brim
 * maths is correct — it has been checked against real fill-ups — so a failure
 * here means a later phase changed it by accident, not that the maths is wrong.
 */

let seq = 0;

function fill(over: Partial<FillUp> = {}): FillUp {
  seq += 1;
  const volume = over.volume ?? 10;
  const pricePerUnit = over.pricePerUnit ?? 300;
  return {
    id: over.id ?? `f${seq}`,
    vehicleId: 'v1',
    occurredAt: over.occurredAt ?? `2026-01-${String(seq).padStart(2, '0')}T16:00:00.000Z`,
    odometerKm: over.odometerKm ?? 1000,
    volume,
    pricePerUnit,
    totalDop: over.totalDop ?? volume * pricePerUnit,
    fuelType: 'regular',
    isFullTank: over.isFullTank ?? true,
    station: '',
    notes: '',
    createdAt: over.createdAt ?? `2026-01-${String(seq).padStart(2, '0')}T16:05:00.000Z`,
    ...over,
  };
}

describe('completeAmounts — two of three', () => {
  it('derives the total from volume and price', () => {
    expect(completeAmounts({ volume: 10, pricePerUnit: 307.5 })).toEqual({
      volume: 10,
      pricePerUnit: 307.5,
      totalDop: 3075,
    });
  });

  it('derives the price from volume and total', () => {
    expect(completeAmounts({ volume: 10, totalDop: 3075 })).toEqual({
      volume: 10,
      pricePerUnit: 307.5,
      totalDop: 3075,
    });
  });

  it('derives the volume from price and total', () => {
    expect(completeAmounts({ pricePerUnit: 307.5, totalDop: 3075 })).toEqual({
      volume: 10,
      pricePerUnit: 307.5,
      totalDop: 3075,
    });
  });

  it('rounds money to cents and volume to thousandths', () => {
    // 1000 / 307.5 = 3.2520325… gallons
    expect(completeAmounts({ pricePerUnit: 307.5, totalDop: 1000 })).toEqual({
      volume: 3.252,
      pricePerUnit: 307.5,
      totalDop: 1000,
    });
  });

  it('returns null with only one of the three', () => {
    expect(completeAmounts({ volume: 10 })).toBeNull();
    expect(completeAmounts({ totalDop: 3075 })).toBeNull();
    expect(completeAmounts({})).toBeNull();
  });

  it('treats zero and negatives as missing', () => {
    expect(completeAmounts({ volume: 0, pricePerUnit: 307.5 })).toBeNull();
    expect(completeAmounts({ volume: -2, pricePerUnit: 307.5 })).toBeNull();
  });
});

describe('sortFillUps', () => {
  it('orders by odometer first', () => {
    const a = fill({ id: 'a', odometerKm: 2000 });
    const b = fill({ id: 'b', odometerKm: 1000 });
    expect(sortFillUps([a, b]).map((f) => f.id)).toEqual(['b', 'a']);
  });

  it('breaks an odometer tie by date, then by createdAt', () => {
    const later = fill({
      id: 'later',
      odometerKm: 1000,
      occurredAt: '2026-02-02T16:00:00.000Z',
      createdAt: '2026-02-02T16:00:00.000Z',
    });
    const earlier = fill({
      id: 'earlier',
      odometerKm: 1000,
      occurredAt: '2026-02-01T16:00:00.000Z',
      createdAt: '2026-02-01T16:00:00.000Z',
    });
    const sameDayFirst = fill({
      id: 'sameDayFirst',
      odometerKm: 1000,
      occurredAt: '2026-02-02T16:00:00.000Z',
      createdAt: '2026-02-02T08:00:00.000Z',
    });
    expect(sortFillUps([later, earlier, sameDayFirst]).map((f) => f.id)).toEqual([
      'earlier',
      'sameDayFirst',
      'later',
    ]);
  });

  it('does not mutate its input', () => {
    const input = [fill({ id: 'a', odometerKm: 2000 }), fill({ id: 'b', odometerKm: 1000 })];
    sortFillUps(input);
    expect(input.map((f) => f.id)).toEqual(['a', 'b']);
  });
});

describe('computeEconomy — brim to brim', () => {
  it('treats the first full tank as the baseline and yields no point for it', () => {
    const points = computeEconomy([fill({ odometerKm: 1000, isFullTank: true })]);
    expect(points).toEqual([]);
  });

  it('measures between two full tanks', () => {
    const points = computeEconomy([
      fill({ id: 'base', odometerKm: 1000, isFullTank: true, volume: 11 }),
      fill({ id: 'next', odometerKm: 1400, isFullTank: true, volume: 10 }),
    ]);
    expect(points).toHaveLength(1);
    // 400 km on the 10 gal it took to refill — the baseline tank's own volume
    // does not count toward the distance it was not used for.
    expect(points[0]).toMatchObject({ fillUpId: 'next', distanceKm: 400, volume: 10, kmPerUnit: 40 });
  });

  it('counts a partial in the middle toward the next full tank', () => {
    const points = computeEconomy([
      fill({ id: 'base', odometerKm: 1000, isFullTank: true, volume: 11 }),
      fill({ id: 'partial', odometerKm: 1200, isFullTank: false, volume: 4 }),
      fill({ id: 'next', odometerKm: 1400, isFullTank: true, volume: 6 }),
    ]);
    // One point only — the partial never becomes a tank of its own.
    expect(points).toHaveLength(1);
    expect(points[0]).toMatchObject({ fillUpId: 'next', distanceKm: 400, volume: 10, kmPerUnit: 40 });
  });

  it('spreads cost per km across every litre added since the last full tank', () => {
    const points = computeEconomy([
      fill({ id: 'base', odometerKm: 1000, isFullTank: true, volume: 11, totalDop: 3300 }),
      fill({ id: 'partial', odometerKm: 1200, isFullTank: false, volume: 4, totalDop: 1200 }),
      fill({ id: 'next', odometerKm: 1400, isFullTank: true, volume: 6, totalDop: 1800 }),
    ]);
    // (1200 + 1800) / 400 km
    expect(points[0].costPerKm).toBe(7.5);
  });

  it('produces one point per full tank after the first', () => {
    const points = computeEconomy([
      fill({ id: 'a', odometerKm: 1000, isFullTank: true, volume: 11 }),
      fill({ id: 'b', odometerKm: 1400, isFullTank: true, volume: 10 }),
      fill({ id: 'c', odometerKm: 1800, isFullTank: true, volume: 10 }),
    ]);
    expect(points.map((p) => p.fillUpId)).toEqual(['b', 'c']);
  });

  it('skips a tank that covered no distance', () => {
    const points = computeEconomy([
      fill({ id: 'a', odometerKm: 1000, isFullTank: true, volume: 11 }),
      fill({ id: 'b', odometerKm: 1000, isFullTank: true, volume: 10 }),
    ]);
    expect(points).toEqual([]);
  });

  it('ignores trailing partials with no full tank to close them', () => {
    const points = computeEconomy([
      fill({ id: 'a', odometerKm: 1000, isFullTank: true, volume: 11 }),
      fill({ id: 'b', odometerKm: 1200, isFullTank: false, volume: 4 }),
    ]);
    expect(points).toEqual([]);
  });
});

describe('reviewFillUp', () => {
  it('reports "first" when there is nothing to compare against', () => {
    const current = fill({ odometerKm: 1000 });
    expect(reviewFillUp(current, []).status).toBe('first');
  });

  it('measures against the previous odometer reading', () => {
    const previous = fill({ id: 'p', odometerKm: 1000, isFullTank: true, volume: 11 });
    const current = fill({ id: 'c', odometerKm: 1400, isFullTank: true, volume: 10, totalDop: 3000 });
    const review = reviewFillUp(current, [previous]);
    expect(review.distanceKm).toBe(400);
    expect(review.kmPerUnit).toBe(40);
    expect(review.costPerKm).toBe(7.5);
    // A single prior fill-up yields no measured tank, so there is no baseline yet.
    expect(review.baseline).toBeNull();
    expect(review.status).toBe('normal');
  });

  it('flags a tank 15% or more below the baseline as low', () => {
    const history = [
      fill({ id: 'a', odometerKm: 1000, isFullTank: true, volume: 10 }),
      fill({ id: 'b', odometerKm: 1400, isFullTank: true, volume: 10 }), // 40 km/gal
    ];
    // 320 km on 10 gal = 32 km/gal, 20% under the 40 baseline.
    const current = fill({ id: 'c', odometerKm: 1720, isFullTank: true, volume: 10 });
    const review = reviewFillUp(current, history);
    expect(review.baseline).toBe(40);
    expect(review.kmPerUnit).toBe(32);
    expect(review.status).toBe('low');
  });

  it('flags a tank 15% or more above the baseline as great', () => {
    const history = [
      fill({ id: 'a', odometerKm: 1000, isFullTank: true, volume: 10 }),
      fill({ id: 'b', odometerKm: 1400, isFullTank: true, volume: 10 }), // 40 km/gal
    ];
    // 480 km on 10 gal = 48 km/gal, 20% over.
    const current = fill({ id: 'c', odometerKm: 1880, isFullTank: true, volume: 10 });
    expect(reviewFillUp(current, history).status).toBe('great');
  });

  it('stays normal inside the ±15% band', () => {
    const history = [
      fill({ id: 'a', odometerKm: 1000, isFullTank: true, volume: 10 }),
      fill({ id: 'b', odometerKm: 1400, isFullTank: true, volume: 10 }), // 40 km/gal
    ];
    // 380 km on 10 gal = 38 km/gal, 5% under.
    const current = fill({ id: 'c', odometerKm: 1780, isFullTank: true, volume: 10 });
    expect(reviewFillUp(current, history).status).toBe('normal');
  });

  it('ignores fill-ups logged ahead of the current odometer', () => {
    const behind = fill({ id: 'behind', odometerKm: 1000 });
    const ahead = fill({ id: 'ahead', odometerKm: 9000 });
    const current = fill({ id: 'c', odometerKm: 1400, volume: 10 });
    expect(reviewFillUp(current, [behind, ahead]).distanceKm).toBe(400);
  });
});

describe('latestEconomyInsight', () => {
  it('needs two measured tanks before it says anything', () => {
    expect(latestEconomyInsight([])).toBeNull();
    expect(
      latestEconomyInsight([
        fill({ odometerKm: 1000, isFullTank: true }),
        fill({ odometerKm: 1400, isFullTank: true }),
      ]),
    ).toBeNull();
  });

  it('compares the newest tank against the average of the earlier ones', () => {
    const insight = latestEconomyInsight([
      fill({ id: 'a', odometerKm: 1000, isFullTank: true, volume: 10 }),
      fill({ id: 'b', odometerKm: 1400, isFullTank: true, volume: 10 }), // 40
      fill({ id: 'c', odometerKm: 1800, isFullTank: true, volume: 10 }), // 40
      fill({ id: 'd', odometerKm: 2120, isFullTank: true, volume: 10 }), // 32
    ]);
    expect(insight).not.toBeNull();
    expect(insight!.baseline).toBe(40);
    expect(insight!.current.kmPerUnit).toBe(32);
    expect(insight!.differencePercent).toBeCloseTo(-20);
    expect(insight!.status).toBe('low');
  });
});
