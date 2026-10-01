import { DEFAULT_PRICE_WEEK, DEFAULT_REFERENCE_PRICES } from '@/lib/fuel';
import {
  boardSourceLabel,
  chartSeries,
  currentBoard,
  importMessage,
  micmWeekOf,
  parseWeekLabel,
  prefillPrice,
  priceHistory,
  shouldPingImporter,
  shortDayLabel,
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

  it.each([
    // MICM's own wording and file names (fixtures, Phase 5)
    ['del sábado veintiséis (26) de septiembre al día viernes dos (02) de octubre de dos mil veintiséis (2026)', '2026-09-26'],
    ['diecinueve (19) al día viernes veinticinco (25) de septiembre de dos mil veintiséis (2026)', '2026-09-19'],
    ['AVISO-PRE.-SEM.CORTE-26-SEP-02-OCT-DE-2026-ESC.-2-ESC.-3.pdf', '2026-09-26'],
    ['AVISO-PRE.-SEM.CORTE-05-11-SEP-DE-2026', '2026-09-05'],
    // English order (the en board writes "26 Sep 2026", people type "Sep 26")
    ['Sep 26 – Oct 2, 2026', '2026-09-26'],
    ['Dec 28 – Jan 3, 2027', '2026-12-28'],
    ['week of Sep 26', '2026-09-26'],
    // the en board's own label round-trips
    ['26 Sep – 2 Oct 2026 (MICM)', '2026-09-26'],
    // a day 0 or 32 is not a day; the next number is
    ['0 – 5 sep 2026', '2026-09-05'],
    ['semana 26 sep (3 oct)', '2026-09-26'],
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

describe('Phase 5 board helpers', () => {
  it('boardSourceLabel: MICM says the week, a user row its source and day', () => {
    expect(shortDayLabel('2026-09-26')).toBe('26 sep');
    expect(boardSourceLabel({ source: 'micm', date: '2026-09-26' })).toBe('MICM · semana del 26 sep');
    expect(boardSourceLabel({ source: 'manual', date: '2026-10-03' })).toBe('Manual · 3 oct');
    expect(boardSourceLabel({ source: 'estacion', date: '2026-09-28' })).toBe('Estación · 28 sep');
  });

  it('a manual row inside the MICM week wins on the board; one from the week before does not', () => {
    const refs = [ref('regular', 317.5, '2026-09-26', '2026-10-02')];
    expect(currentBoard([user('u1', 'regular', 310, '2026-09-26', { source: 'manual' })], refs)[0]).toMatchObject({ origin: 'user', price: 310 });
    expect(currentBoard([user('u1', 'regular', 310, '2026-09-28')], refs)[0].origin).toBe('user');
    expect(currentBoard([user('u1', 'regular', 310, '2026-09-25')], refs)[0]).toMatchObject({ origin: 'ref', price: 317.5 });
  });

  it('micmWeekOf: the Saturday on or before', () => {
    expect(micmWeekOf('2026-09-26')).toBe('2026-09-26'); // Saturday
    expect(micmWeekOf('2026-10-02')).toBe('2026-09-26'); // Friday
    expect(micmWeekOf('2026-09-30')).toBe('2026-09-26');
    expect(micmWeekOf('2027-01-01')).toBe('2026-12-26');
  });

  it('priceHistory: grouped by week, newest first, user before MICM on a tie, current flagged', () => {
    const weeks = priceHistory(
      'regular',
      [
        user('u1', 'regular', 310, '2026-09-26', { source: 'recibo' }),
        user('u2', 'regular', 312, '2026-09-29'),
        user('u3', 'premium', 350, '2026-09-29'),
        user('u4', 'regular', 1, '2026-09-29', { deletedAt: 'x' }),
      ],
      [ref('regular', 317.5, '2026-09-26', '2026-10-02'), ref('regular', 315.5, '2026-09-19', '2026-09-25', true)],
    );
    expect(weeks.map((w) => [w.weekStart, w.weekEnd])).toEqual([
      ['2026-09-26', '2026-10-02'],
      ['2026-09-19', '2026-09-25'],
    ]);
    expect(weeks[0].items.map((i) => [i.key, i.origin, i.current])).toEqual([
      ['u2', 'user', true],
      ['u1', 'user', false],
      ['2026-09-26:regular', 'ref', false],
    ]);
    expect(weeks[1].items[0]).toMatchObject({ origin: 'ref', stale: true, source: 'micm' });
    expect(priceHistory('gnv', [], [])).toEqual([]);
  });

  it('prefillPrice: the board price, per liter when the car counts liters, GNV untouched', () => {
    const board = currentBoard([user('u1', 'gnv', 43.97, '2026-09-01')], [ref('regular', 317.5, '2026-09-26', '2026-10-02')]);
    expect(prefillPrice(board, 'regular')).toMatchObject({ price: 317.5, entry: { source: 'micm' } });
    expect(prefillPrice(board, 'regular', 'l')?.price).toBe(83.87);
    expect(prefillPrice(board, 'gnv', 'l')?.price).toBe(43.97);
    expect(prefillPrice(board, 'premium')).toBeNull();
  });

  it('shouldPingImporter: > 8 days old or none, once a day, never without the table', () => {
    expect(shouldPingImporter('2026-09-26', '2026-10-04', null)).toBe(false); // 8 days
    expect(shouldPingImporter('2026-09-26', '2026-10-05', null)).toBe(true); // 9 days
    expect(shouldPingImporter('2026-09-26', '2026-10-05', '2026-10-05')).toBe(false);
    expect(shouldPingImporter(null, '2026-10-05', '2026-10-04')).toBe(true);
    expect(shouldPingImporter(null, '2026-10-05', null, true)).toBe(false);
  });

  it('chartSeries: both series, last 12 months only, oldest first', () => {
    const s = chartSeries(
      'regular',
      [user('u1', 'regular', 310, '2026-09-28'), user('u0', 'regular', 290, '2025-08-01'), user('u2', 'regular', 300, '2026-01-10')],
      [ref('regular', 317.5, '2026-09-26', '2026-10-02'), ref('regular', 315.5, '2026-09-19', '2026-09-25'), ref('premium', 350, '2026-09-26', '2026-10-02')],
      '2026-09-30',
    );
    expect(s.user.map((p) => p.date)).toEqual(['2026-01-10', '2026-09-28']);
    expect(s.micm).toEqual([
      { date: '2026-09-19', price: 315.5 },
      { date: '2026-09-26', price: 317.5 },
    ]);
  });

  it('importMessage per answer', () => {
    expect(importMessage(null)).toMatch(/importador/);
    expect(importMessage({ ok: true, weekStart: '2026-09-26', weekEnd: '2026-10-02' })).toBe('Importado: 26 sep – 2 oct 2026.');
    expect(importMessage({ ok: true, upToDate: true, weekStart: '2026-09-26', weekEnd: '2026-10-02' })).toMatch(/^Ya estaba al día/);
    expect(importMessage({ ok: false, reason: 'pdf-not-text', weekStart: null, weekEnd: null })).toMatch(/imagen/);
    expect(importMessage({ ok: false, reason: 'no-writer-key', weekStart: null, weekEnd: null })).toMatch(/configurado/);
  });
});
