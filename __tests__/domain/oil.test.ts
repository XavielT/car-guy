/**
 * The Aceite block's pure rules (IMP 29092026 note 16): which items get it,
 * how the four columns read back as one line, and the spec chips' round trip.
 */
import {
  isOilItem,
  joinSpecs,
  normalizeOil,
  oilBrands,
  oilGrades,
  oilSummary,
  sameOil,
  specsFor,
  splitSpecs,
} from '@/lib/domain/oil';

describe('oilSummary', () => {
  it('renders all four columns: grade + type, brand, spec', () => {
    expect(
      oilSummary({ oilViscosity: '5W-30', oilType: 'sintetico', oilBrand: 'Castrol Edge', oilSpec: 'API SP' }),
    ).toBe('5W-30 sintético · Castrol Edge · API SP');
  });

  it('renders what is there when partial', () => {
    expect(oilSummary({ oilViscosity: '5W-30', oilType: 'sintetico', oilBrand: 'Castrol' })).toBe('5W-30 sintético · Castrol');
    expect(oilSummary({ oilType: 'semisintetico' })).toBe('semisintético');
    expect(oilSummary({ oilBrand: 'Motul', oilSpec: 'API SP · ILSAC GF-6A' })).toBe('Motul · API SP · ILSAC GF-6A');
    expect(oilSummary({ oilViscosity: ' 10W-40 ', oilBrand: '  ' })).toBe('10W-40');
  });

  it('is null when empty', () => {
    expect(oilSummary(null)).toBeNull();
    expect(oilSummary({})).toBeNull();
    expect(oilSummary({ oilViscosity: null, oilType: null, oilSpec: '', oilBrand: '   ' })).toBeNull();
  });
});

describe('isOilItem', () => {
  it('is the engine oil change, whatever its category', () => {
    expect(isOilItem({ id: 'aceite_motor', category: 'motor', name: 'Aceite de motor y filtro' })).toBe(true);
  });

  it('is any fluid whose name says aceite, accent- and case-insensitive', () => {
    expect(isOilItem({ id: 'aceite_transmision', category: 'fluidos', name: 'Aceite de transmisión (ATF/CVT)' })).toBe(true);
    expect(isOilItem({ id: 'x', category: 'fluidos', name: 'ACEÍTE del diferencial' })).toBe(true);
  });

  it('is not a fluid without aceite, nor aceite outside fluidos, nor nothing', () => {
    expect(isOilItem({ id: 'liquido_frenos', category: 'fluidos', name: 'Líquido de frenos' })).toBe(false);
    expect(isOilItem({ id: 'x', category: 'motor', name: 'Fuga de aceite' })).toBe(false);
    expect(isOilItem(undefined)).toBe(false);
  });
});

describe('specs', () => {
  it('join and split round-trip, deduplicated', () => {
    const joined = joinSpecs(['API SP', 'ILSAC GF-6A', 'API SP']);
    expect(joined).toBe('API SP · ILSAC GF-6A');
    expect(splitSpecs(joined)).toEqual(['API SP', 'ILSAC GF-6A']);
    expect(joinSpecs([])).toBeNull();
    expect(splitSpecs(null)).toEqual([]);
  });

  it('offers the fuel\'s specs plus the shared ones, and keeps a saved one', () => {
    const gas = specsFor('gasolina').map((s) => s.es);
    expect(gas).toContain('API SP');
    expect(gas).toContain('ACEA C3');
    expect(gas).not.toContain('API CK-4');
    expect(specsFor('gasolina', ['API CK-4']).map((s) => s.es)).toContain('API CK-4');
    expect(specsFor('diesel').map((s) => s.es)).not.toContain('API SP');
  });

  it('grade and brand lists leave "Otro" to the pickers', () => {
    expect(oilGrades().map((g) => g.es)).toContain('5W-30');
    expect(oilGrades().some((g) => g.es === 'Otro')).toBe(false);
    expect(oilBrands().map((b) => b.es)).toContain('Castrol');
    expect(oilBrands().some((b) => b.es === 'Otro')).toBe(false);
  });
});

it('normalizeOil keeps only the four columns, blanks as null, unknown types dropped', () => {
  expect(normalizeOil({ oilViscosity: ' ', oilType: 'raro' as never, oilBrand: 'Castrol', oilSpec: undefined })).toEqual({
    oilViscosity: null,
    oilType: null,
    oilSpec: null,
    oilBrand: 'Castrol',
  });
  expect(sameOil({ oilBrand: 'Castrol' }, { oilBrand: 'Castrol', oilSpec: '' })).toBe(true);
});
