import { DEFAULT_PRICE_WEEK, DEFAULT_REFERENCE_PRICES } from '@/lib/fuel';
import {
  currentBoard,
  parseWeekLabel,
  referencePricesFromBoard,
  series,
  weekRangeLabel,
  type FuelPriceRefRow,
  type FuelPriceRow,
} from '@/lib/domain/fuelPrices';
import type { FuelType } from '@/lib/types';

const TODAY = new Date(2026, 8, 30, 10, 0, 0); // 30 Sep 2026, local

function user(id: string, fuelType: FuelType, price: number, validFrom: string, over: Partial<FuelPriceRow> = {}): FuelPriceRow {
  return {
    id,
    fuelType,
    price,
    validFrom,
    source: 'estacion',
    station: 'Shell',
    note: '',
    createdAt: `${validFrom}T12:00:00.000Z`,
    updatedAt: `${validFrom}T12:00:00.000Z`,
    deletedAt: null,
    ...over,
  };
}

function ref(fuelType: FuelType, price: number, weekStart: string, weekEnd: string, stale = false): FuelPriceRefRow {
  return {
    id: `${weekStart}:${fuelType}`,
    fuelType,
    price,
    weekStart,
    weekEnd,
    pdfUrl: 'https://micm.gob.do/precios.pdf',
    importedAt: `${weekStart}T09:00:00.000Z`,
    stale,
  };
}

describe('parseWeekLabel', () => {
  it.each([
    ['15–21 ago 2026 (MICM)', '2026-08-15'],
    ['15-21 ago 2026', '2026-08-15'],
    ['15 – 21 ago 2026', '2026-08-15'],
    ['15—21 AGO. 2026', '2026-08-15'],
    ['25 sep – 2 oct 2026', '2026-09-25'],
    ['25 sept - 2 oct 2026', '2026-09-25'],
    ['25 septiembre – 2 octubre 2026', '2026-09-25'],
    ['25 set – 2 oct 2026', '2026-09-25'],
    ['28 dic 2026 – 3 ene 2027', '2026-12-28'],
    ['28 dic – 3 ene 2027', '2026-12-28'],
    ['Semana del 5 al 11 de septiembre de 2026', '2026-09-05'],
    ['1–7 mar 2025', '2025-03-01'],
    ['2026-08-15', '2026-08-15'],
    ['15/08/2026', '2026-08-15'],
  ])('%s → %s', (label, iso) => {
    expect(parseWeekLabel(label, TODAY)).toBe(iso);
  });

  it('a label with no year takes today’s year', () => {
    expect(parseWeekLabel('15–21 ago', TODAY)).toBe('2026-08-15');
  });

  it.each(['', '   ', 'precios de la semana', 'MICM', '99 ago 2026', '31 feb 2026', 'abc 2026'])('garbage %p → today', (label) => {
    expect(parseWeekLabel(label, TODAY)).toBe('2026-09-30');
  });

  it('null/undefined → today', () => {
    expect(parseWeekLabel(null, TODAY)).toBe('2026-09-30');
    expect(parseWeekLabel(undefined, TODAY)).toBe('2026-09-30');
  });

  it('today is the local calendar day, not UTC', () => {
    // 23:30 local on 30 Sep is already 1 Oct in UTC for UTC−4.
    expect(parseWeekLabel('', new Date(2026, 8, 30, 23, 30))).toBe('2026-09-30');
  });
});

describe('currentBoard', () => {
  it('per fuel, the newest of user and ref rows, in FUEL_ORDER', () => {
    const board = currentBoard(
      [user('u1', 'regular', 305, '2026-09-20'), user('u2', 'premium', 338, '2026-08-01')],
      [ref('premium', 341.1, '2026-09-26', '2026-10-02'), ref('regular', 307.5, '2026-09-13', '2026-09-19'), ref('gnv', 43.97, '2026-09-26', '2026-10-02')],
    );
    expect(board.map((e) => [e.fuelType, e.price, e.origin, e.source])).toEqual([
      ['premium', 341.1, 'ref', 'micm'],
      ['regular', 305, 'user', 'estacion'],
      ['gnv', 43.97, 'ref', 'micm'],
    ]);
    expect(board[0]).toMatchObject({ date: '2026-09-26', dateEnd: '2026-10-02', station: '', stale: false, rowId: '2026-09-26:premium' });
    expect(board[1]).toMatchObject({ date: '2026-09-20', dateEnd: null, station: 'Shell', rowId: 'u1' });
  });

  it('a tie on the date goes to the user row', () => {
    const board = currentBoard([user('u1', 'regular', 300, '2026-09-26', { source: 'recibo' })], [ref('regular', 307.5, '2026-09-26', '2026-10-02')]);
    expect(board).toHaveLength(1);
    expect(board[0]).toMatchObject({ origin: 'user', price: 300, source: 'recibo' });
  });

  it('a user valid_from with a time still ties on the day', () => {
    const board = currentBoard([user('u1', 'regular', 300, '2026-09-26T15:00:00.000Z')], [ref('regular', 307.5, '2026-09-26', '2026-10-02')]);
    expect(board[0]).toMatchObject({ origin: 'user', date: '2026-09-26' });
  });

  it('deleted user rows are ignored', () => {
    const board = currentBoard(
      [user('u1', 'regular', 1, '2026-09-29', { deletedAt: '2026-09-29T13:00:00.000Z' }), user('u2', 'regular', 305, '2026-09-01')],
      [ref('regular', 307.5, '2026-09-13', '2026-09-19')],
    );
    expect(board[0]).toMatchObject({ origin: 'ref', price: 307.5 });
    expect(currentBoard([user('u1', 'glp', 135, '2026-09-29', { deletedAt: 'x' })], [])).toEqual([]);
  });

  it('two user rows on the same day: the one written last wins', () => {
    const board = currentBoard(
      [
        user('a', 'regular', 300, '2026-09-20', { createdAt: '2026-09-20T10:00:00.000Z' }),
        user('b', 'regular', 302, '2026-09-20', { createdAt: '2026-09-20T18:00:00.000Z' }),
      ],
      [],
    );
    expect(board[0].rowId).toBe('b');
  });

  it('carries the stale flag from a ref row (0/1 from SQLite too)', () => {
    const stale = { ...ref('premium', 341.1, '2026-09-26', '2026-10-02'), stale: 1 };
    expect(currentBoard([], [stale])[0].stale).toBe(true);
    expect(currentBoard([], [{ ...stale, stale: 0 }])[0].stale).toBe(false);
  });

  it('empty in, empty out', () => {
    expect(currentBoard([], [])).toEqual([]);
  });
});

describe('series', () => {
  it('both origins, oldest first, one point per date preferring the user row', () => {
    const pts = series(
      'regular',
      [
        user('u1', 'regular', 300, '2026-09-13'),
        user('u2', 'regular', 310, '2026-09-24'),
        user('u3', 'premium', 999, '2026-09-24'),
        user('u4', 'regular', 1, '2026-09-25', { deletedAt: 'x' }),
      ],
      [ref('regular', 307.5, '2026-09-06', '2026-09-12'), ref('regular', 308, '2026-09-13', '2026-09-19'), ref('regular', 309, '2026-09-20', '2026-09-26')],
    );
    expect(pts).toEqual([
      { date: '2026-09-06', price: 307.5, origin: 'ref', source: 'micm' },
      { date: '2026-09-13', price: 300, origin: 'user', source: 'estacion' },
      { date: '2026-09-20', price: 309, origin: 'ref', source: 'micm' },
      { date: '2026-09-24', price: 310, origin: 'user', source: 'estacion' },
    ]);
  });

  it('same-day user rows collapse to the newest written', () => {
    const pts = series(
      'glp',
      [
        user('b', 'glp', 136, '2026-09-20', { createdAt: '2026-09-20T18:00:00.000Z' }),
        user('a', 'glp', 135, '2026-09-20', { createdAt: '2026-09-20T10:00:00.000Z' }),
      ],
      [],
    );
    expect(pts).toEqual([{ date: '2026-09-20', price: 136, origin: 'user', source: 'estacion' }]);
  });
});

describe('referencePricesFromBoard', () => {
  it('matches the store’s settings shape, missing fuels from the defaults', () => {
    const board = currentBoard([user('u1', 'regular', 305, '2026-09-20')], [ref('premium', 345, '2026-09-26', '2026-10-02')]);
    const out = referencePricesFromBoard(board);
    expect(out.referencePrices).toEqual({ ...DEFAULT_REFERENCE_PRICES, premium: 345, regular: 305 });
    expect(out.priceWeekLabel).toBe('26 sep – 2 oct 2026 (MICM)');
  });

  it('the v8-migrated manual rows keep the 2.3.1 numbers', () => {
    const rows = (Object.keys(DEFAULT_REFERENCE_PRICES) as FuelType[]).map((f) =>
      user(`m-${f}`, f, DEFAULT_REFERENCE_PRICES[f], parseWeekLabel('15–21 ago 2026 (MICM)', TODAY), { source: 'manual', station: '' }),
    );
    const out = referencePricesFromBoard(currentBoard(rows, []));
    expect(out.referencePrices).toEqual(DEFAULT_REFERENCE_PRICES);
    expect(out.priceWeekLabel).toBe('15 ago 2026 (Manual)');
  });

  it('the newest user row’s note is the label verbatim (the migrated 2.3 week label)', () => {
    const rows = (Object.keys(DEFAULT_REFERENCE_PRICES) as FuelType[]).map((f) =>
      user(`m-${f}`, f, DEFAULT_REFERENCE_PRICES[f], '2026-08-15', { source: 'manual', station: '', note: '15–21 ago 2026 (MICM)' }),
    );
    const board = currentBoard(rows, []);
    expect(board[0].note).toBe('15–21 ago 2026 (MICM)');
    expect(referencePricesFromBoard(board)).toEqual({ referencePrices: DEFAULT_REFERENCE_PRICES, priceWeekLabel: '15–21 ago 2026 (MICM)' });
  });

  it('a newer ref row wins the label over an older noted user row', () => {
    const board = currentBoard(
      [user('m', 'regular', 307.5, '2026-08-15', { source: 'manual', note: '15–21 ago 2026 (MICM)' })],
      [ref('premium', 345, '2026-09-26', '2026-10-02')],
    );
    expect(board.find((e) => e.origin === 'ref')?.note).toBe('');
    expect(referencePricesFromBoard(board).priceWeekLabel).toBe('26 sep – 2 oct 2026 (MICM)');
  });

  it('a blank note falls back to the date label', () => {
    const board = currentBoard([user('u', 'regular', 305, '2026-09-20', { note: '   ' })], []);
    expect(referencePricesFromBoard(board).priceWeekLabel).toBe('20 sep 2026 (Estación)');
  });

  it('an empty board → the defaults and 2.3’s default week', () => {
    expect(referencePricesFromBoard([])).toEqual({ referencePrices: DEFAULT_REFERENCE_PRICES, priceWeekLabel: DEFAULT_PRICE_WEEK });
  });
});

describe('weekRangeLabel', () => {
  it('reads back what parseWeekLabel reads', () => {
    expect(weekRangeLabel('2026-08-15', '2026-08-21')).toBe('15–21 ago 2026');
    expect(weekRangeLabel('2026-09-25', '2026-10-02')).toBe('25 sep – 2 oct 2026');
    expect(weekRangeLabel('2026-12-28', '2027-01-03')).toBe('28 dic 2026 – 3 ene 2027');
    for (const l of ['15–21 ago 2026', '25 sep – 2 oct 2026', '28 dic 2026 – 3 ene 2027']) {
      expect(parseWeekLabel(l, TODAY)).toBe(parseWeekLabel(weekRangeLabel(parseWeekLabel(l, TODAY)), TODAY));
    }
    expect(weekRangeLabel('2026-08-15')).toBe('15 ago 2026');
  });
});
