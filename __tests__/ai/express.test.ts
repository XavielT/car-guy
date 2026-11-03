/**
 * IMP 03112026 SPEC-B §B7 (Fuel Express): the card logic: compact vs expanded, defaults the person never types, the full-tank
 * question, closest-vehicle choice, and the same validation the manual form applies on Save.
 */
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

import { buildExpressCard, cardFrom, closestVehicle, expressToDraft, suggestFullTank, type ExpressContext, type ExpressValues } from '@/lib/ai/express';
import { fuelPrefillFrom } from '@/lib/ai/fuelMap';
import type { ReadResult } from '@/lib/ai/read';
import { dateInputFromIso } from '@/lib/format';
import type { FillUp } from '@/lib/types';

const ctx: ExpressContext = { today: '2026-11-03', defaultFuel: 'regular', lastOdometerKm: 84300, tankVolume: 14, referencePrice: 340 };
const fld = (value: string | number | null, confidence = 0.9) => ({ value, confidence });
const express = (fields: Record<string, ReturnType<typeof fld>>): ReadResult => ({ ok: true, kind: 'fuel_express', model: 'm', fields });
const good = express({
  odometer: fld(84830), unit: fld('km'), fuel_level: fld(0.6, 0.4),
  total: fld(2580), gallons: fld(7.5), unit_price: fld(344), product: fld('Gasolina Premium'), station: fld('Texaco'), date: fld('2026-11-02'),
});
const card = (r: ReadResult, c: ExpressContext = ctx) => {
  const { prefill, marks } = fuelPrefillFrom(r);
  return buildExpressCard(prefill, marks, c);
};

describe('buildExpressCard — compact when there is nothing to ask', () => {
  it('everything confident, nothing missing, no flag → compact: Confirmar is the only thing to do', () => {
    const c = card(good);
    expect(c.compact).toBe(true);
    expect(c.flags).toEqual([]);
    expect(c.missing).toEqual([]);
    expect(c.values).toMatchObject({ date: '2026-11-02', odo: '84830', fuel: 'premium', vol: '7.5', price: '344', total: '2580', station: 'Texaco', full: true });
  });

  it('defaults the person never types: date = today, fuel = last used, tanque lleno = yes', () => {
    const c = card(express({ odometer: fld(84830), unit: fld('km'), total: fld(2580), gallons: fld(7.5) }));
    expect(c.values.date).toBe('2026-11-03');
    expect(c.values.fuel).toBe('regular');
    expect(c.values.full).toBe(true);
  });

  it('one unsure field (< 0.6) expands the card even with no flag', () => {
    const r = express({ ...good.fields, total: fld(2580, 0.4) });
    expect(card(r).compact).toBe(false);
  });

  it('a failed check expands only that field and names the question', () => {
    const c = card(express({ ...good.fields, odometer: fld(84030) }));
    expect(c.compact).toBe(false);
    expect(c.flagBy.odo?.code).toBe('odo_below_last');
    expect(c.flagBy.total).toBeUndefined();
    expect(c.flagBy.vol).toBeUndefined();
  });

  it('gallons × price vs total off by more than 3 % → a total question', () => {
    expect(card(express({ ...good.fields, total: fld(3000) })).flagBy.total?.code).toBe('total_mismatch');
  });

  it('a dashboard in miles keeps the reading, flags the unit and offers the conversion', () => {
    const c = card(express({ ...good.fields, odometer: fld(52500), unit: fld('mi') }));
    expect(c.milesRead).toBe(true);
    expect(c.flagBy.odo?.code).toBe('odo_miles');
    expect(c.compact).toBe(false);
  });

  it('a receipt with a date older than 7 days asks', () => {
    expect(card(express({ ...good.fields, date: fld('2026-10-20') })).flagBy.date?.code).toBe('date_old');
  });
});

describe('what the photos did not give', () => {
  it('only a receipt (no dashboard): the odometer is missing and the card says so', () => {
    const c = card(express({ total: fld(2580), gallons: fld(7.5), unit_price: fld(344) }));
    expect(c.missing).toEqual(['odo']);
    expect(c.compact).toBe(false);
  });
  it('only a dashboard (no receipt): the amounts are missing', () => {
    const c = card(express({ odometer: fld(84830), unit: fld('km') }));
    expect(c.missing).toEqual(['amounts']);
  });
  it('two of the three amounts are enough (the form completes the third)', () => {
    expect(card(express({ odometer: fld(84830), unit: fld('km'), total: fld(2580), gallons: fld(7.5) })).missing).toEqual([]);
  });
  it('both unreadable → everything missing, the card is the manual form with empty fields', () => {
    const c = card(express({ odometer: fld(null, 0), total: fld(null, 0) }));
    expect(c.missing).toEqual(['odo', 'amounts']);
    expect(c.values.odo).toBe('');
  });
});

describe('suggestFullTank — §B7.5', () => {
  it.each([
    [0.2, 4, 14, { full: false, ask: true }], // low gauge AND few gallons
    [0.2, 12, 14, { full: true, ask: false }], // low gauge but a big fill
    [0.8, 4, 14, { full: true, ask: false }], // few gallons but the gauge is not low
    [undefined, 4, 14, { full: true, ask: false }], // no gauge hint
    [0.2, null, 14, { full: true, ask: false }],
    [0.2, 4, null, { full: true, ask: false }],
    [0.35, 4, 14, { full: true, ask: false }], // exactly the threshold is not "clearly low"
  ])('level %j, %j gal of %j → %j', (level, vol, tank, want) => {
    expect(suggestFullTank(level as number | undefined, vol as number | null, tank as number | null)).toEqual(want);
  });
  it('asking is part of the card: a clearly low gauge with a small fill expands it', () => {
    const c = card(express({ ...good.fields, fuel_level: fld(0.2, 0.7), gallons: fld(3), total: fld(1032), unit_price: fld(344) }));
    expect(c.askPartial).toBe(true);
    expect(c.values.full).toBe(false);
    expect(c.compact).toBe(false);
  });
});

describe('closestVehicle — several cars', () => {
  const cars = [{ id: 'ae85', lastOdometerKm: 52400 }, { id: 'ds3', lastOdometerKm: 101622 }, { id: 'c3', lastOdometerKm: null }];
  it('picks the car whose last odometer is nearest the photo', () => {
    expect(closestVehicle(52810, cars)).toBe('ae85');
    expect(closestVehicle(100900, cars)).toBe('ds3');
  });
  it('with one car, no reading or no data it never overrides the active car', () => {
    expect(closestVehicle(50000, [cars[0]])).toBeNull();
    expect(closestVehicle(null, cars)).toBeNull();
    expect(closestVehicle(5, [{ id: 'a', lastOdometerKm: null }, { id: 'b', lastOdometerKm: null }])).toBeNull();
  });
});

describe('expressToDraft — the manual form’s Save, for the card', () => {
  const values: ExpressValues = { date: '2026-11-02', odo: '84830', fuel: 'premium', vol: '7.5', price: '344', total: '2580', station: ' Texaco ', full: true };
  const fill = (id: string, km: number, date: string): FillUp => ({
    id, vehicleId: 'v1', occurredAt: `${date}T12:00:00.000Z`, odometerKm: km, volume: 8, pricePerUnit: 340, totalDop: 2720, fuelType: 'premium',
    isFullTank: true, missedPrevious: false, station: '', notes: '', createdAt: 't',
  } as FillUp);

  it('produces the same draft shape the form saves', () => {
    const r = expressToDraft(values, 'v1', [fill('a', 84300, '2026-10-20')]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.draft).toMatchObject({ vehicleId: 'v1', odometerKm: 84830, fuelType: 'premium', isFullTank: true, station: 'Texaco', missedPrevious: false, inReserve: false });
    expect(dateInputFromIso(r.draft.occurredAt)).toBe('2026-11-02');
    expect(r.draft.totalDop).toBeCloseTo(2580, 1);
  });
  it('an odometer below the previous fill-up is refused with the bound (same rule as the form)', () => {
    const r = expressToDraft({ ...values, odo: '84000' }, 'v1', [fill('a', 84300, '2026-10-20')]);
    expect(r).toEqual({ ok: false, reason: 'odometer_low', bound: 84300 });
  });
  it('an odometer above a LATER fill-up is refused too', () => {
    const r = expressToDraft({ ...values, date: '2026-10-10', odo: '90000' }, 'v1', [fill('a', 84300, '2026-10-20')]);
    expect(r).toMatchObject({ ok: false, reason: 'odometer_high', bound: 84300 });
  });
  it('no odometer, or fewer than two amounts, is refused', () => {
    expect(expressToDraft({ ...values, odo: '' }, 'v1', [])).toEqual({ ok: false, reason: 'odometer_missing' });
    expect(expressToDraft({ ...values, vol: '', price: '' }, 'v1', [])).toEqual({ ok: false, reason: 'amounts' });
  });
  it('miles are converted to km only when the card says the dashboard was in miles', () => {
    const r = expressToDraft({ ...values, odo: '52500' }, 'v1', [], true);
    expect(r.ok && r.draft.odometerKm).toBe(Math.round(52500 * 1.609344));
    expect(expressToDraft({ ...values, odo: '52500' }, 'v1', [], false).ok && true).toBe(true);
  });
  it('editing a failing field in place clears its flag (cardFrom)', () => {
    const bad = card(express({ ...good.fields, odometer: fld(84030) }));
    expect(bad.flagBy.odo).toBeDefined();
    const fixed = cardFrom({ ...bad.values, odo: '84830' }, {}, ctx, false, false);
    expect(fixed.flagBy.odo).toBeUndefined();
    expect(fixed.compact).toBe(true);
  });
});
