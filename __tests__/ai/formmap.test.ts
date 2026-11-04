/**
 * IMP 03112026 SPEC-B §B3/§B4: invoice → service/expense form, dashboard → odometer, and the warranty phrase.
 */
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

import { addToDate, expensePrefillFrom, invoicePrefillFrom, odometerFrom, parseWarranty } from '@/lib/ai/formMap';
import type { ReadResult } from '@/lib/ai/read';

const f = (value: string | number | null, confidence = 0.9) => ({ value, confidence });
const read = (kind: ReadResult['kind'], fields: ReadResult['fields'], items?: ReadResult['items']): ReadResult => ({ ok: true, kind, model: 'm', fields, items });

describe('parseWarranty', () => {
  it.each([
    ['6 meses o 10,000 km', { months: 6, days: null, km: 10000 }],
    ['6 MESES / 10.000 KM', { months: 6, days: null, km: 10000 }],
    ['1 año', { months: 12, days: null, km: null }],
    ['2 años o 20000 km', { months: 24, days: null, km: 20000 }],
    ['90 días', { months: null, days: 90, km: null }],
    ['1 año y 6 meses', { months: 18, days: null, km: null }],
    ['sin garantía', { months: null, days: null, km: null }],
    ['', { months: null, days: null, km: null }],
    ['0 meses', { months: null, days: null, km: null }],
  ])('%j → %j', (text, want) => {
    expect(parseWarranty(text)).toEqual(want);
  });
  it('null and undefined are nothing', () => {
    expect(parseWarranty(null)).toEqual({ months: null, days: null, km: null });
    expect(parseWarranty(undefined)).toEqual({ months: null, days: null, km: null });
  });
});

describe('addToDate', () => {
  it('adds months and clamps the day to the target month', () => {
    expect(addToDate('2026-08-31', 6, 0)).toBe('2027-02-28');
    expect(addToDate('2026-11-03', 6, 0)).toBe('2027-05-03');
    expect(addToDate('2026-11-03', 12, 0)).toBe('2027-11-03');
  });
  it('adds days across a month end, and months across a year', () => {
    expect(addToDate('2026-11-03', 0, 90)).toBe('2027-02-01');
    expect(addToDate('2026-12-15', 1, 0)).toBe('2027-01-15');
  });
  it('rejects a non-date', () => {
    expect(addToDate('03/11/2026', 6, 0)).toBeNull();
  });
});

describe('odometerFrom', () => {
  it('reads the total and its confidence', () => {
    expect(odometerFrom(read('odometer', { odometer: f(84830, 0.95), unit: f('km') }))).toEqual({ value: '84830', milesRead: false, confidence: 0.95 });
  });
  it('flags miles instead of converting silently', () => {
    expect(odometerFrom(read('odometer', { odometer: f(52500), unit: f('mi') }))?.milesRead).toBe(true);
  });
  it('nothing read → null (the form stays untouched)', () => {
    expect(odometerFrom(read('odometer', { odometer: f(null, 0), unit: f(null, 0) }))).toBeNull();
  });
});

describe('invoicePrefillFrom', () => {
  const invoice = read(
    'invoice',
    { shop: f('Taller Díaz'), rnc: f('131234567'), ncf: f('B0100000123'), date: f('2026-11-02'), total: f(8850), warranty_text: f('6 meses o 10,000 km') },
    [
      { description: f('Pastillas delanteras'), qty: f(1), unit_price: f(3500), kind: f('part') },
      { description: f('Disco'), qty: f(2), unit_price: f(1800), kind: f('part') },
      { description: f('Mano de obra'), qty: f(1), unit_price: f(1750), kind: f('labour') },
    ],
  );

  it('fills shop, date, parts, labour and the warranty counted from the invoice date', () => {
    const { prefill, marks } = invoicePrefillFrom(invoice, '2026-11-03');
    expect(prefill).toMatchObject({ shop: 'Taller Díaz', date: '2026-11-02', costParts: '7100', costLabor: '1750', warrantyDate: '2027-05-02', warrantyKm: '10000' });
    expect(prefill.parts).toEqual([
      { name: 'Pastillas delanteras', quantity: 1, unitCostDop: 3500 },
      { name: 'Disco', quantity: 2, unitCostDop: 1800 },
    ]);
    expect(prefill.noteLines).toEqual(['NCF B0100000123', 'RNC 131234567']);
    expect(marks.shop).toBe(0.9);
  });

  it('a total that equals parts + labour is left to the form to compute', () => {
    expect(invoicePrefillFrom(invoice, '2026-11-03').prefill.totalOverride).toBeUndefined();
  });

  it('a printed total that disagrees with the lines is kept as the total (what was printed wins)', () => {
    const r = read('invoice', { ...invoice.fields, total: f(9500) }, invoice.items);
    expect(invoicePrefillFrom(r, '2026-11-03').prefill.totalOverride).toBe('9500');
  });

  it('a total without line items becomes the override (no invented split)', () => {
    const r = read('invoice', { shop: f('Gomera'), total: f(4200) });
    const { prefill } = invoicePrefillFrom(r, '2026-11-03');
    expect(prefill.totalOverride).toBe('4200');
    expect(prefill.costParts).toBeUndefined();
    expect(prefill.costLabor).toBeUndefined();
  });

  it('with no invoice date the warranty counts from the form date', () => {
    const r = read('invoice', { total: f(1000), warranty_text: f('3 meses') });
    expect(invoicePrefillFrom(r, '2026-11-03').prefill.warrantyDate).toBe('2027-02-03');
  });

  it('lines with no price or no description are skipped, not guessed', () => {
    const r = read('invoice', { total: f(1000) }, [
      { description: f('Filtro'), qty: f(1), unit_price: f(null, 0), kind: f('part') },
      { description: f(null, 0), qty: f(1), unit_price: f(500), kind: f('part') },
    ]);
    const { prefill } = invoicePrefillFrom(r, '2026-11-03');
    expect(prefill.parts).toEqual([]);
    expect(prefill.costParts).toBeUndefined();
  });

  it('the least confident line sets the confidence of the cost fields', () => {
    const r = read('invoice', { total: f(500) }, [{ description: f('Filtro'), qty: f(1), unit_price: f(500, 0.4), kind: f('part') }]);
    expect(invoicePrefillFrom(r, '2026-11-03').marks.costParts).toBe(0.4);
  });

  it('an unreadable photo changes nothing', () => {
    const { prefill, marks } = invoicePrefillFrom(read('invoice', {}), '2026-11-03');
    expect(prefill).toEqual({ parts: [], noteLines: [] });
    expect(marks).toEqual({});
  });
});

describe('expensePrefillFrom', () => {
  it('amount, date and vendor only; never a category', () => {
    const { prefill, marks } = expensePrefillFrom(read('invoice', { shop: f('Seguros Universal'), total: f(12400, 0.8), date: f('2026-10-30'), ncf: f('B0100000007') }));
    expect(prefill).toEqual({ amount: '12400', date: '2026-10-30', vendor: 'Seguros Universal', noteLines: ['NCF B0100000007'] });
    expect(marks).toEqual({ amount: 0.8, date: 0.9, vendor: 0.9 });
    expect(prefill).not.toHaveProperty('category');
  });
  it('nothing read → empty', () => {
    expect(expensePrefillFrom(read('invoice', {})).prefill).toEqual({ noteLines: [] });
  });
});
