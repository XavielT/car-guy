import {
  completeAmounts,
  computeEconomy,
  latestEconomyInsight,
  odometerBounds,
  parseDecimal,
  reviewFillUp,
  sortFillUps,
} from '@/lib/domain/economy';
import type { FillUp } from '@/lib/types';
import sample from '../../docs/imp-17092026/fixtures/tu-combustible-rd-backup.sample.json';

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
  it('measures a full tank through the partials before it — no false leak alarm', () => {
    // Found in QA: 40 km/gal every time, then a partial and a full tank.
    const history = [
      fill({ id: 'a', odometerKm: 10000, isFullTank: true }),
      fill({ id: 'b', odometerKm: 10400, isFullTank: true }),
      fill({ id: 'c', odometerKm: 10800, isFullTank: true }),
    ];
    const partial = fill({ id: 'p', odometerKm: 11000, volume: 2, isFullTank: false });
    const full = fill({ id: 'd', odometerKm: 11200, volume: 8, isFullTank: true });

    const partialReview = reviewFillUp(partial, history);
    // Never measured on its own (it used to claim "100 km/gal, buen rendimiento").
    expect(partialReview.status).toBe('partial');
    expect(partialReview.kmPerUnit).toBeNull();

    const fullReview = reviewFillUp(full, [...history, partial]);
    // 400 km on 2 + 8 gal, exactly what Inicio shows (it used to say 25, "posibles fugas").
    expect(fullReview.kmPerUnit).toBe(40);
    expect(fullReview.status).toBe('normal');
  });

  it('calls the first measured tank "no comparison yet", not "estable"', () => {
    const first = fill({ id: 'x1', odometerKm: 5000, isFullTank: true });
    const second = fill({ id: 'x2', odometerKm: 5400, isFullTank: true });
    const review = reviewFillUp(second, [first]);
    expect(review.kmPerUnit).toBe(40);
    expect(review.status).toBe('first');
  });

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
    // A single prior fill-up yields no measured tank, so there is no baseline
    // yet — and "no comparison" is what it says, not "estable".
    expect(review.baseline).toBeNull();
    expect(review.status).toBe('first');
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

/**
 * PROMPT-06 added `missedPrevious` — the driver saying "I forgot to log a
 * fill-up before this one". The odometer climbed on fuel that never reached the
 * log, so anything measured across that gap is flattering and wrong. The chain
 * restarts instead.
 *
 * The first test here is the important one: nothing above this block sets the
 * flag, and every one of those tests still passes, which is what "changes the
 * output only when set" has to mean.
 */
describe('computeEconomy — missedPrevious breaks the chain', () => {
  it('leaves fill-ups without the flag exactly as they were', () => {
    const logs = [
      fill({ id: 'base', odometerKm: 1000, isFullTank: true, volume: 11 }),
      fill({ id: 'next', odometerKm: 1400, isFullTank: true, volume: 10 }),
    ];
    const withUndefined = computeEconomy(logs);
    const withExplicitFalse = computeEconomy(logs.map((f) => ({ ...f, missedPrevious: false })));
    expect(withUndefined).toEqual(withExplicitFalse);
    expect(withUndefined).toHaveLength(1);
  });

  it('leaves the real legacy fixture exactly as it was when nothing is flagged', () => {
    // The Tu Combustible RD sample export: twelve fill-ups with partials in the
    // chain, none of which has ever heard of missedPrevious.
    const fixture = sample.data.fillups as unknown as FillUp[];
    for (const vehicleId of new Set(fixture.map((f) => f.vehicleId))) {
      const logs = fixture.filter((f) => f.vehicleId === vehicleId);
      const untouched = computeEconomy(logs);
      expect(untouched.length).toBeGreaterThan(0);
      expect(computeEconomy(logs.map((f) => ({ ...f, missedPrevious: false })))).toEqual(untouched);
    }
  });

  it('flagging one fill-up in the fixture only changes the stretch it starts', () => {
    const fixture = (sample.data.fillups as unknown as FillUp[])
      .filter((f, _, all) => f.vehicleId === all[0].vehicleId)
      .sort((a, b) => a.odometerKm - b.odometerKm);
    const before = computeEconomy(fixture);
    // Flag a full tank that currently has an economy point of its own.
    const target = fixture.find((f) => f.isFullTank && before.some((p) => p.fillUpId === f.id))!;
    const after = computeEconomy(fixture.map((f) => (f.id === target.id ? { ...f, missedPrevious: true } : f)));

    // The flagged tank loses its point, and nothing measured before it moves.
    expect(after.some((p) => p.fillUpId === target.id)).toBe(false);
    const earlier = (points: typeof before) =>
      points.filter((p) => fixture.findIndex((f) => f.id === p.fillUpId) < fixture.indexOf(target));
    expect(earlier(after)).toEqual(earlier(before));
  });

  it('yields no point for the flagged tank and makes it the new baseline', () => {
    const points = computeEconomy([
      fill({ id: 'base', odometerKm: 1000, isFullTank: true, volume: 11 }),
      // 900 km on 10 gal would be 90 km/gal — the giveaway that a fill-up is
      // missing. Flagged, it publishes nothing at all.
      fill({ id: 'gap', odometerKm: 1900, isFullTank: true, volume: 10, missedPrevious: true }),
      fill({ id: 'after', odometerKm: 2300, isFullTank: true, volume: 10 }),
    ]);
    expect(points.map((p) => p.fillUpId)).toEqual(['after']);
    // Measured from 'gap', not from 'base': 2300 − 1900 on the 10 gal it took.
    expect(points[0]).toMatchObject({ distanceKm: 400, volume: 10, kmPerUnit: 40 });
  });

  it('would have produced a wrong point without the flag', () => {
    const points = computeEconomy([
      fill({ id: 'base', odometerKm: 1000, isFullTank: true, volume: 11 }),
      fill({ id: 'gap', odometerKm: 1900, isFullTank: true, volume: 10 }),
      fill({ id: 'after', odometerKm: 2300, isFullTank: true, volume: 10 }),
    ]);
    expect(points.map((p) => p.fillUpId)).toEqual(['gap', 'after']);
    expect(points[0].kmPerUnit).toBe(90);
  });

  it('drops the baseline entirely when the flagged fill-up is a partial', () => {
    const points = computeEconomy([
      fill({ id: 'base', odometerKm: 1000, isFullTank: true, volume: 11 }),
      // A partial we cannot place: its volume must not be credited to the next
      // full tank's distance, so that tank becomes a baseline of its own.
      fill({ id: 'partial', odometerKm: 1600, isFullTank: false, volume: 5, missedPrevious: true }),
      fill({ id: 'full', odometerKm: 1900, isFullTank: true, volume: 8 }),
      fill({ id: 'after', odometerKm: 2300, isFullTank: true, volume: 10 }),
    ]);
    expect(points.map((p) => p.fillUpId)).toEqual(['after']);
    expect(points[0]).toMatchObject({ distanceKm: 400, volume: 10, kmPerUnit: 40 });
  });

  it('keeps an unflagged partial folded into the next full tank', () => {
    const points = computeEconomy([
      fill({ id: 'base', odometerKm: 1000, isFullTank: true, volume: 11 }),
      fill({ id: 'partial', odometerKm: 1600, isFullTank: false, volume: 5 }),
      fill({ id: 'full', odometerKm: 1900, isFullTank: true, volume: 5 }),
    ]);
    expect(points.map((p) => p.fillUpId)).toEqual(['full']);
    expect(points[0]).toMatchObject({ distanceKm: 900, volume: 10, kmPerUnit: 90 });
  });

  it('a flag on the very first fill-up changes nothing — it was already a baseline', () => {
    const flagged = computeEconomy([
      fill({ id: 'base', odometerKm: 1000, isFullTank: true, volume: 11, missedPrevious: true }),
      fill({ id: 'next', odometerKm: 1400, isFullTank: true, volume: 10 }),
    ]);
    expect(flagged).toHaveLength(1);
    expect(flagged[0]).toMatchObject({ fillUpId: 'next', distanceKm: 400, kmPerUnit: 40 });
  });
});

describe('reviewFillUp — missedPrevious', () => {
  it('refuses to compare across the gap', () => {
    const previous = [
      fill({ id: 'a', odometerKm: 1000, isFullTank: true, volume: 10 }),
      fill({ id: 'b', odometerKm: 1400, isFullTank: true, volume: 10 }),
    ];
    const current = fill({
      id: 'c',
      odometerKm: 2300,
      isFullTank: true,
      volume: 10,
      missedPrevious: true,
    });

    const review = reviewFillUp(current, previous);
    expect(review.distanceKm).toBeNull();
    expect(review.kmPerUnit).toBeNull();
    expect(review.costPerKm).toBeNull();
    expect(review.status).toBe('first');
    // The price paid is a fact about this fill-up alone, so it survives.
    expect(review.pricePerUnit).toBe(300);
  });

  it('still compares normally without the flag', () => {
    const previous = [
      fill({ id: 'a', odometerKm: 1000, isFullTank: true, volume: 10 }),
      fill({ id: 'b', odometerKm: 1400, isFullTank: true, volume: 10 }),
    ];
    const current = fill({ id: 'c', odometerKm: 1800, isFullTank: true, volume: 10 });

    const review = reviewFillUp(current, previous);
    expect(review.distanceKm).toBe(400);
    expect(review.kmPerUnit).toBe(40);
  });
});

describe('parseDecimal', () => {
  it.each([
    ['11.4', 11.4],
    ['11,4', 11.4], // a comma typed as the decimal mark
    ['2,583', 2583], // thousands, as the app itself prints money
    ['1,500.50', 1500.5],
    ['3,487.26', 3487.26],
    ['3.487,26', 3487.26], // the other convention, still unambiguous
    ['1,234,567', 1234567],
    ['1.234.567', 1234567],
    ['RD$ 3,500', 3500],
    [' 305.9 ', 305.9],
    ['0', 0],
    ['.5', 0.5],
  ])('%s → %s', (raw, expected) => {
    expect(parseDecimal(raw)).toBe(expected);
  });

  it.each(['', '   ', 'abc', '-200', '1..2', '1,2,3', '12a'])('rejects %j', (raw) => {
    expect(parseDecimal(raw)).toBeNull();
  });
});

describe('completeAmounts with all three filled', () => {
  it('keeps the receipt total and volume, and derives the price', () => {
    // 10 gal at 300 would be 3,000 — but the receipt says 5,000 was paid.
    expect(completeAmounts({ volume: 10, pricePerUnit: 300, totalDop: 5000 })).toEqual({
      volume: 10,
      pricePerUnit: 500,
      totalDop: 5000,
    });
  });
});

describe('odometerBounds', () => {
  const logs = [
    fill({ id: 'a', odometerKm: 10000, occurredAt: '2026-09-01T16:00:00.000Z' }),
    fill({ id: 'b', odometerKm: 10400, occurredAt: '2026-09-08T16:00:00.000Z' }),
    fill({ id: 'c', odometerKm: 10800, occurredAt: '2026-09-15T16:00:00.000Z' }),
  ];
  it('bounds an edited fill-up by its neighbours, not by its own old value', () => {
    // Found in QA: editing b to 9,500 went through and bent every km/gal around it.
    expect(odometerBounds(logs, '2026-09-08T16:00:00.000Z', 'b')).toEqual({ min: 10000, max: 10800 });
  });
  it('bounds a backdated new fill-up too', () => {
    expect(odometerBounds(logs, '2026-09-10T16:00:00.000Z')).toEqual({ min: 10400, max: 10800 });
  });
  it('is open-ended at the ends of the history', () => {
    expect(odometerBounds(logs, '2026-09-20T16:00:00.000Z')).toEqual({ min: 10800, max: null });
    expect(odometerBounds([], '2026-09-20T16:00:00.000Z')).toEqual({ min: null, max: null });
  });
});
