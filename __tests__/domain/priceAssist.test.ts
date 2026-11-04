import { paidVsReference, perGallon, receiptPriceOffer, SAME_BAND } from '@/lib/domain/priceAssist';

const REF = { regular: 280, premium: 300, gasoil_regular: 250 };

describe('paidVsReference', () => {
  it('more than the reference: positive, with the percentage', () => {
    const r = paidVsReference({ pricePerUnit: 292, fuelType: 'regular', reference: REF })!;
    expect(r).toMatchObject({ paidPerGal: 292, refPerGal: 280, diffPerGal: 12, tone: 'above' });
    expect(r.pct).toBeCloseTo(4.3, 1);
  });
  it('less than the reference: negative', () => {
    expect(paidVsReference({ pricePerUnit: 270, fuelType: 'regular', reference: REF })).toMatchObject({ diffPerGal: -10, tone: 'below' });
  });
  it(`within RD$ ${SAME_BAND} counts as the same`, () => {
    expect(paidVsReference({ pricePerUnit: 280.4, fuelType: 'regular', reference: REF })!.tone).toBe('same');
    expect(paidVsReference({ pricePerUnit: 279.6, fuelType: 'regular', reference: REF })!.tone).toBe('same');
    expect(paidVsReference({ pricePerUnit: 280.5, fuelType: 'regular', reference: REF })!.tone).toBe('above');
  });
  it('a car that counts in litres is compared per gallon', () => {
    const r = paidVsReference({ pricePerUnit: 77, fuelType: 'regular', volumeUnit: 'l', reference: REF })!;
    expect(r.paidPerGal).toBeCloseTo(291.47, 1);
    expect(r.tone).toBe('above');
  });
  it('no reference, no price, or GNV (per m³) → null', () => {
    expect(paidVsReference({ pricePerUnit: 100, fuelType: 'glp', reference: REF })).toBeNull();
    expect(paidVsReference({ pricePerUnit: 0, fuelType: 'regular', reference: REF })).toBeNull();
    expect(paidVsReference({ pricePerUnit: Number.NaN, fuelType: 'regular', reference: REF })).toBeNull();
    expect(paidVsReference({ pricePerUnit: 40, fuelType: 'gnv', reference: { gnv: 40 } })).toBeNull();
    expect(perGallon(40, 'gnv', 'gal')).toBeNull();
  });
});

describe('receiptPriceOffer', () => {
  const fillUp = { fuelType: 'regular' as const, pricePerUnit: 292, occurredAt: '2026-11-03T14:20:00.000Z', station: 'Shell Churchill' };
  it('a receipt with a station and a plausible price becomes a recibo row, nothing else', () => {
    expect(receiptPriceOffer({ fillUp, reference: REF, existing: [] })).toEqual({ fuelType: 'regular', price: 292, validFrom: '2026-11-03', station: 'Shell Churchill', source: 'recibo', note: '' });
  });
  it('no station → nothing to share', () => {
    expect(receiptPriceOffer({ fillUp: { ...fillUp, station: '  ' }, reference: REF, existing: [] })).toBeNull();
  });
  it('a price far from the reference is a probable misread, not offered', () => {
    expect(receiptPriceOffer({ fillUp: { ...fillUp, pricePerUnit: 29.2 }, reference: REF, existing: [] })).toBeNull();
    expect(receiptPriceOffer({ fillUp: { ...fillUp, pricePerUnit: 900 }, reference: REF, existing: [] })).toBeNull();
  });
  it('with no reference for the fuel the plausibility check cannot run, so it is offered', () => {
    expect(receiptPriceOffer({ fillUp: { ...fillUp, fuelType: 'glp', pricePerUnit: 120 }, reference: REF, existing: [] })).not.toBeNull();
  });
  it('not offered twice: same fuel, same day, same station (case and spacing ignored); a tombstone does not count', () => {
    const row = { fuelType: 'regular' as const, validFrom: '2026-11-03', station: 'shell   churchill', source: 'recibo' };
    expect(receiptPriceOffer({ fillUp, reference: REF, existing: [row] })).toBeNull();
    expect(receiptPriceOffer({ fillUp, reference: REF, existing: [{ ...row, deletedAt: '2026-11-03T20:00:00Z' }] })).not.toBeNull();
    expect(receiptPriceOffer({ fillUp, reference: REF, existing: [{ ...row, validFrom: '2026-11-02' }] })).not.toBeNull();
    expect(receiptPriceOffer({ fillUp, reference: REF, existing: [{ ...row, station: 'Texaco' }] })).not.toBeNull();
  });
  it('litres are converted to the board unit before saving', () => {
    const o = receiptPriceOffer({ fillUp: { ...fillUp, pricePerUnit: 77 }, volumeUnit: 'l', reference: REF, existing: [] })!;
    expect(o.price).toBeCloseTo(291.47, 1);
  });
});
