/**
 * ADR-63 spirit for AI reads (IMP 03112026 SPEC-B §B2/§B7): every field an AI read can put in the fill-up form must
 * survive the FORM'S OWN parsing and reach the saved draft unchanged. "It does not save" bugs are caught here, not on a phone.
 */
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

import { fuelPrefillFrom, mergeFuelPrefills, type FuelPrefill } from '@/lib/ai/fuelMap';
import type { ReadResult } from '@/lib/ai/read';
import { completeAmounts, parseDecimal } from '@/lib/domain/economy';
import { dateInputFromIso, isoFromDateInput } from '@/lib/format';
import { FUEL_TYPES } from '@/lib/types';

const fld = (value: string | number | null, confidence = 0.9) => ({ value, confidence });
const full: ReadResult = {
  ok: true, kind: 'fuel_express', model: 'm',
  fields: {
    odometer: fld(52830), unit: fld('km'), fuel_level: fld(0.5, 0.3),
    total: fld(2583), gallons: fld(7.51), unit_price: fld(343.9), product: fld('Gasolina Premium'), station: fld('Texaco'),
    date: fld('2026-10-30'), time: fld('18:42'), ncf: fld('B0200000123'), pump: fld('3'),
  },
};

/** The fields FillUpForm.applyRead puts in its inputs. A new FuelPrefill key must be added here AND to the form, or the test fails. */
const FORM_FIELDS = ['date', 'odo', 'fuel', 'vol', 'price', 'total', 'station'] as const;
/** Carried for the screen / the invoice record, not an input of the form. */
const NON_FORM = ['odoUnitMi', 'fuelLevel', 'ncf'] as const;

describe('AI read → fill-up form round trip', () => {
  const { prefill, marks } = fuelPrefillFrom(full);

  it('covers exactly the fields the form knows (no silent field)', () => {
    expect(Object.keys(prefill).filter((k) => k !== 'odoUnitMi').sort()).toEqual([...FORM_FIELDS, 'fuelLevel', 'ncf'].sort());
    for (const k of Object.keys(prefill)) expect([...FORM_FIELDS, ...NON_FORM]).toContain(k);
  });

  it('every form field has a confidence mark', () => {
    for (const k of FORM_FIELDS) expect(marks[k]).toBeGreaterThan(0);
  });

  it('the date reaches the saved ISO day unchanged (no timezone drift)', () => {
    const iso = isoFromDateInput(prefill.date!);
    expect(dateInputFromIso(iso)).toBe('2026-10-30');
  });

  it('the odometer parses to the number that was read', () => {
    expect(parseDecimal(prefill.odo!)).toBe(52830);
  });

  it('volume, price and total survive completeAmounts as read (all three given)', () => {
    const a = completeAmounts({ volume: parseDecimal(prefill.vol!), pricePerUnit: parseDecimal(prefill.price!), totalDop: parseDecimal(prefill.total!) });
    expect(a).not.toBeNull();
    // The form's rule (economy.ts): with all three typed off a receipt, volume and total are the facts and the price is
    // derived from them. So what was READ as volume and total reaches the draft unchanged; the price is total ÷ volume.
    expect(a!.volume).toBeCloseTo(7.51, 3);
    expect(a!.totalDop).toBeCloseTo(2583, 2);
    expect(a!.pricePerUnit).toBeCloseTo(2583 / 7.51, 2);
    expect(Math.abs(a!.pricePerUnit - 343.9) / 343.9).toBeLessThan(0.03); // and it agrees with the printed price
  });

  it('two of three is enough: the form completes the third (a receipt that lost one number)', () => {
    const a = completeAmounts({ volume: 7.5, pricePerUnit: 344, totalDop: null });
    expect(a!.totalDop).toBeCloseTo(2580, 1);
    const b = completeAmounts({ volume: null, pricePerUnit: 344, totalDop: 2580 });
    expect(b!.volume).toBeCloseTo(7.5, 1);
  });

  it('the fuel is a real app fuel id', () => {
    expect(FUEL_TYPES).toContain(prefill.fuel);
    expect(prefill.fuel).toBe('premium');
  });

  it('the station keeps its text', () => {
    expect(prefill.station).toBe('Texaco');
  });

  it('a litre vehicle: converted once, still parses, and gallons×price still reproduces the total within rounding', () => {
    const l = fuelPrefillFrom(full, 'l').prefill;
    const a = completeAmounts({ volume: parseDecimal(l.vol!), pricePerUnit: parseDecimal(l.price!), totalDop: parseDecimal(l.total!) });
    expect(a).not.toBeNull();
    expect(Math.abs(a!.volume * a!.pricePerUnit - a!.totalDop) / a!.totalDop).toBeLessThan(0.03);
  });

  it('a read that found nothing leaves every field out (the form stays as it was)', () => {
    const empty = fuelPrefillFrom({ ...full, fields: { odometer: fld(null, 0), total: fld(null, 0), gallons: fld(null, 0) } });
    expect(empty.prefill).toEqual({});
    expect(empty.marks).toEqual({});
  });

  it('receipt + dashboard merge into one prefill that still round-trips', () => {
    const r = fuelPrefillFrom({ ...full, kind: 'fuel_receipt', fields: { total: fld(2583), gallons: fld(7.51), unit_price: fld(343.9), date: fld('2026-10-30') } });
    const d = fuelPrefillFrom({ ...full, kind: 'odometer', fields: { odometer: fld(52830), unit: fld('km') } });
    const m = mergeFuelPrefills([r, d]).prefill as FuelPrefill;
    expect(parseDecimal(m.odo!)).toBe(52830);
    expect(parseDecimal(m.total!)).toBe(2583);
    expect(m.date).toBe('2026-10-30');
  });
});
