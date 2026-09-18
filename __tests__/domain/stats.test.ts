import {
  costPerKm,
  delta,
  distanceInRange,
  distancePerMonth,
  inRange,
  monthlySpendByCategory,
  periodRanges,
  spendByCategory,
  totalCostOfOwnership,
  totalSpend,
  upcomingCosts,
  type Reading,
  type SpendRow,
} from '@/lib/domain/stats';

/**
 * The fixture month is September 2026, and every expected value in the first
 * block was worked out by hand before the code ran. That is the point of it:
 * the other tests check that the functions behave, this one checks that they
 * are right.
 *
 * September 2026, one vehicle:
 *   3 sept  combustible     3,075.00
 *  12 sept  mantenimiento   4,000.00
 *  12 sept  combustible     2,900.00
 *  20 sept  reparacion     12,500.00
 *  25 sept  legal (marbete)   3,000.00
 *  28 sept  otros (lavado)      500.00
 *   → total 25,975.00
 *   → combustible 5,975.00 · mantenimiento 4,000.00 · reparacion 12,500.00
 *     legal 3,000.00 · otros 500.00
 *   → odometer 51,000 on 3 sept and 52,300 on 28 sept = 1,300 km
 *   → 25,975 / 1,300 = 19.98076… → 19.98 RD$/km
 */
const SEPTEMBER: SpendRow[] = [
  { occurredAt: '2026-09-03T12:00:00.000Z', category: 'combustible', amountDop: 3075 },
  { occurredAt: '2026-09-12T12:00:00.000Z', category: 'mantenimiento', amountDop: 4000 },
  { occurredAt: '2026-09-12T12:00:00.000Z', category: 'combustible', amountDop: 2900 },
  { occurredAt: '2026-09-20T12:00:00.000Z', category: 'reparacion', amountDop: 12500 },
  { occurredAt: '2026-09-25T12:00:00.000Z', category: 'legal', amountDop: 3000 },
  { occurredAt: '2026-09-28T12:00:00.000Z', category: 'otros', amountDop: 500 },
];

const SEPTEMBER_READINGS: Reading[] = [
  { occurredAt: '2026-09-03T12:00:00.000Z', valueKm: 51000 },
  { occurredAt: '2026-09-12T12:00:00.000Z', valueKm: 51400 },
  { occurredAt: '2026-09-20T12:00:00.000Z', valueKm: 51900 },
  { occurredAt: '2026-09-28T12:00:00.000Z', valueKm: 52300 },
];

describe('the September 2026 fixture, checked by hand', () => {
  it('totals 25,975.00', () => {
    expect(totalSpend(SEPTEMBER)).toBe(25975);
  });

  it('splits into five categories, biggest first', () => {
    expect(spendByCategory(SEPTEMBER)).toEqual([
      { category: 'reparacion', total: 12500, share: 0.48 },
      { category: 'combustible', total: 5975, share: 0.23 },
      { category: 'mantenimiento', total: 4000, share: 0.15 },
      { category: 'legal', total: 3000, share: 0.12 },
      { category: 'otros', total: 500, share: 0.02 },
    ]);
  });

  it('covers 1,300 km', () => {
    expect(distanceInRange(SEPTEMBER_READINGS, null, '2026-09-30T12:00:00.000Z')).toBe(1300);
  });

  it('costs 19.98 per kilometre', () => {
    expect(costPerKm(SEPTEMBER, 1300)).toBe(19.98);
  });

  it('puts the whole month in one bucket', () => {
    const [month] = monthlySpendByCategory(SEPTEMBER, 1, '2026-09-30T12:00:00.000Z');
    expect(month.month).toBe('2026-09');
    expect(month.total).toBe(25975);
    expect(month.byCategory).toEqual({
      combustible: 5975,
      mantenimiento: 4000,
      reparacion: 12500,
      mejora: 0,
      legal: 3000,
      otros: 500,
    });
  });
});

describe('periodRanges', () => {
  const today = '2026-09-18T12:00:00.000Z';

  it('offers four windows and labels them in Spanish', () => {
    const ranges = periodRanges(today);
    expect(Object.keys(ranges)).toEqual(['mes', 'trimestre', 'ano', 'todo']);
    expect(ranges.mes.label).toBe('Mes');
    expect(ranges.trimestre.label).toBe('3 meses');
    expect(ranges.ano.label).toBe('Año');
    expect(ranges.todo.label).toBe('Todo');
  });

  it('rolls back 30 days for the month, not to the 1st', () => {
    const { mes } = periodRanges(today);
    expect(mes.from?.slice(0, 10)).toBe('2026-08-19');
    expect(mes.to.slice(0, 10)).toBe('2026-09-18');
  });

  it('gives the previous window the same length, ending where the current one starts', () => {
    const { trimestre } = periodRanges(today);
    expect(trimestre.previous?.to).toBe(trimestre.from);
    expect(trimestre.previous?.from.slice(0, 10)).toBe('2026-03-22');
  });

  it('leaves "todo" unbounded below and with nothing to compare against', () => {
    const { todo } = periodRanges(today);
    expect(todo.from).toBeNull();
    expect(todo.previous).toBeNull();
  });
});

describe('inRange', () => {
  it('includes both bounds', () => {
    const rows = [
      { occurredAt: '2026-09-01T12:00:00.000Z' },
      { occurredAt: '2026-09-15T12:00:00.000Z' },
      { occurredAt: '2026-09-30T12:00:00.000Z' },
    ];
    expect(
      inRange(rows, '2026-09-01T12:00:00.000Z', '2026-09-30T12:00:00.000Z'),
    ).toHaveLength(3);
  });

  it('treats a null lower bound as "everything so far"', () => {
    const rows = [{ occurredAt: '2019-01-01T12:00:00.000Z' }];
    expect(inRange(rows, null, '2026-09-30T12:00:00.000Z')).toHaveLength(1);
  });
});

describe('spendByCategory', () => {
  it('drops categories that spent nothing rather than listing a zero', () => {
    const totals = spendByCategory([
      { occurredAt: '2026-09-01T12:00:00.000Z', category: 'combustible', amountDop: 100 },
    ]);
    expect(totals.map((t) => t.category)).toEqual(['combustible']);
    expect(totals[0].share).toBe(1);
  });

  it('is empty, not a divide by zero, with no rows at all', () => {
    expect(spendByCategory([])).toEqual([]);
  });
});

describe('monthlySpendByCategory', () => {
  it('keeps months with no spending so the axis does not compress', () => {
    const rows: SpendRow[] = [
      { occurredAt: '2026-07-10T12:00:00.000Z', category: 'combustible', amountDop: 1000 },
      { occurredAt: '2026-09-10T12:00:00.000Z', category: 'combustible', amountDop: 2000 },
    ];
    const months = monthlySpendByCategory(rows, 3, '2026-09-18T12:00:00.000Z');
    expect(months.map((m) => m.month)).toEqual(['2026-07', '2026-08', '2026-09']);
    expect(months.map((m) => m.total)).toEqual([1000, 0, 2000]);
  });

  it('ignores rows older than the window', () => {
    const rows: SpendRow[] = [
      { occurredAt: '2025-01-10T12:00:00.000Z', category: 'combustible', amountDop: 9999 },
      { occurredAt: '2026-09-10T12:00:00.000Z', category: 'combustible', amountDop: 2000 },
    ];
    const months = monthlySpendByCategory(rows, 2, '2026-09-18T12:00:00.000Z');
    expect(months.reduce((sum, m) => sum + m.total, 0)).toBe(2000);
  });

  it('crosses the year boundary', () => {
    const months = monthlySpendByCategory([], 3, '2027-01-15T12:00:00.000Z');
    expect(months.map((m) => m.month)).toEqual(['2026-11', '2026-12', '2027-01']);
  });
});

describe('distanceInRange', () => {
  it('is zero with fewer than two readings — one moment is not a distance', () => {
    expect(distanceInRange([{ occurredAt: '2026-09-01T12:00:00.000Z', valueKm: 51000 }], null, '2026-09-30T12:00:00.000Z')).toBe(0);
    expect(distanceInRange([], null, '2026-09-30T12:00:00.000Z')).toBe(0);
  });

  it('spans lowest to highest even when a reading arrives out of order', () => {
    const readings: Reading[] = [
      { occurredAt: '2026-09-20T12:00:00.000Z', valueKm: 52000 },
      { occurredAt: '2026-09-01T12:00:00.000Z', valueKm: 51000 },
    ];
    expect(distanceInRange(readings, null, '2026-09-30T12:00:00.000Z')).toBe(1000);
  });

  it('only counts readings inside the window', () => {
    const readings: Reading[] = [
      { occurredAt: '2026-01-01T12:00:00.000Z', valueKm: 10000 },
      { occurredAt: '2026-09-01T12:00:00.000Z', valueKm: 51000 },
      { occurredAt: '2026-09-28T12:00:00.000Z', valueKm: 52300 },
    ];
    expect(
      distanceInRange(readings, '2026-09-01T12:00:00.000Z', '2026-09-30T12:00:00.000Z'),
    ).toBe(1300);
  });
});

describe('distancePerMonth', () => {
  it('attributes each gap to the month of the later reading', () => {
    const readings: Reading[] = [
      { occurredAt: '2026-07-01T12:00:00.000Z', valueKm: 50000 },
      { occurredAt: '2026-08-01T12:00:00.000Z', valueKm: 50800 },
      { occurredAt: '2026-09-01T12:00:00.000Z', valueKm: 51500 },
    ];
    const months = distancePerMonth(readings, 3, '2026-09-18T12:00:00.000Z');
    // July has only the baseline reading, so nothing is attributed to it.
    expect(months.map((m) => m.km)).toEqual([0, 800, 700]);
  });

  it('ignores a reading that went backwards', () => {
    const readings: Reading[] = [
      { occurredAt: '2026-09-01T12:00:00.000Z', valueKm: 51000 },
      { occurredAt: '2026-09-10T12:00:00.000Z', valueKm: 51000 },
      { occurredAt: '2026-09-20T12:00:00.000Z', valueKm: 51500 },
    ];
    const [month] = distancePerMonth(readings, 1, '2026-09-30T12:00:00.000Z');
    expect(month.km).toBe(500);
  });
});

describe('costPerKm', () => {
  it('is null rather than Infinity when nothing was driven', () => {
    expect(costPerKm(SEPTEMBER, 0)).toBeNull();
    expect(costPerKm(SEPTEMBER, -5)).toBeNull();
  });
});

describe('delta', () => {
  it('reports a fall as a negative percentage', () => {
    expect(delta(800, 1000)).toEqual({
      current: 800,
      previous: 1000,
      percent: -20,
      direction: 'down',
    });
  });

  it('reports a rise as a positive percentage', () => {
    expect(delta(1200, 1000).direction).toBe('up');
    expect(delta(1200, 1000).percent).toBe(20);
  });

  it('calls anything inside ±1 % flat', () => {
    expect(delta(1005, 1000).direction).toBe('flat');
  });

  it('refuses a percentage when the previous window was empty', () => {
    expect(delta(500, 0)).toEqual({ current: 500, previous: 0, percent: null, direction: 'up' });
    expect(delta(0, 0).direction).toBe('flat');
  });
});

describe('totalCostOfOwnership', () => {
  const today = '2026-09-18T12:00:00.000Z';

  it('is null without a purchase price — there would be nothing extra to say', () => {
    expect(
      totalCostOfOwnership(
        { purchaseDate: '2024-09-18T12:00:00.000Z', purchasePrice: null, soldDate: null, soldPrice: null },
        50000,
        today,
      ),
    ).toBeNull();
  });

  it('adds the purchase price to the spend while the car is still owned', () => {
    const tco = totalCostOfOwnership(
      { purchaseDate: '2024-09-18T12:00:00.000Z', purchasePrice: 900000, soldDate: null, soldPrice: null },
      100000,
      today,
    );
    expect(tco?.total).toBe(1000000);
    // Two years to the day: 730 / 30.44 = 23.98… → 23 whole months.
    expect(tco?.monthsOwned).toBe(23);
    expect(tco?.costPerMonth).toBe(43478.26);
  });

  it('subtracts what it sold for', () => {
    const tco = totalCostOfOwnership(
      {
        purchaseDate: '2024-09-18T12:00:00.000Z',
        purchasePrice: 900000,
        soldDate: '2026-09-18T12:00:00.000Z',
        soldPrice: 700000,
      },
      100000,
      today,
    );
    expect(tco?.total).toBe(300000);
  });

  it('refuses a cost per month before a month has passed', () => {
    const tco = totalCostOfOwnership(
      { purchaseDate: '2026-09-15T12:00:00.000Z', purchasePrice: 900000, soldDate: null, soldPrice: null },
      0,
      today,
    );
    expect(tco?.monthsOwned).toBe(0);
    expect(tco?.costPerMonth).toBeNull();
  });
});

describe('upcomingCosts', () => {
  it('takes open tasks with an estimate and due reminders with a last cost', () => {
    const result = upcomingCosts(
      [
        { id: 't1', title: 'Cambiar gomas', status: 'pendiente', estimatedCostDop: 24000 },
        { id: 't2', title: 'Revisar A/C', status: 'en_progreso', estimatedCostDop: 3500 },
      ],
      [{ id: 'r1', title: 'Marbete', dueDate: '2027-01-31T12:00:00.000Z', lastCostDop: 3000, isDue: true }],
    );
    // Sorted by amount, not by source: 24,000 · 3,500 · 3,000.
    expect(result.items.map((i) => i.id)).toEqual(['t1', 't2', 'r1']);
    expect(result.total).toBe(30500);
  });

  it('skips finished tasks, estimate-less tasks and reminders with no history', () => {
    const result = upcomingCosts(
      [
        { id: 'done', title: 'Hecha', status: 'hecha', estimatedCostDop: 9999 },
        { id: 'noEstimate', title: 'Sin estimado', status: 'pendiente', estimatedCostDop: null },
        { id: 'zero', title: 'Cero', status: 'pendiente', estimatedCostDop: 0 },
      ],
      [
        { id: 'notDue', title: 'Aceite', dueDate: null, lastCostDop: 4000, isDue: false },
        { id: 'noCost', title: 'Filtro', dueDate: null, lastCostDop: null, isDue: true },
      ],
    );
    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
  });

  it('says where each number came from', () => {
    const result = upcomingCosts(
      [{ id: 't1', title: 'Gomas', status: 'pendiente', estimatedCostDop: 100 }],
      [{ id: 'r1', title: 'Marbete', dueDate: null, lastCostDop: 200, isDue: true }],
    );
    expect(result.items.map((i) => i.basis)).toEqual(['ultimo_costo', 'estimado']);
  });
});
