import { carMemory, searchMemory, suggestionForFluid, suggestionsFor, type MemorySpecsheet, type VehicleFactRow } from '@/lib/domain/carMemory';

/** The seed's DS3 (Phase 2 §4): "what I buy" filled in. Fram PH6607 is a fictional PN for the seed. */
const DS3: MemorySpecsheet = {
  vehicleId: 'ds3',
  oilGrade: '5W-30',
  oilSpec: 'PSA B71 2290',
  oilCapacityFilterL: 4.25,
  oilFilterPn: 'PH6607',
  sparkPlugPn: 'NGK LKR7DIX',
  coolantType: 'Revkogel 2000',
  batterySpec: '60 Ah 640 A',
  tireSizeOemF: '205/55R16',
  tireSizeOemR: '205/55R16',
  psiOemF: 33,
  psiOemR: 30,
  lugTorqueNm: 100,
  oilBrand: 'Castrol Edge',
  oilProduct: '5W-30 Full Synthetic 1 gal',
  oilFilterBrand: 'Fram',
  airFilterPn: 'CA11213',
  cabinFilterPn: 'CF11920',
  fuelFilterPn: null,
  wiperSizes: '26/16',
  bulbLow: 'H7',
  bulbHigh: 'H1',
  tireCurrentF: '205/55R16 Michelin Primacy 4',
  tireCurrentR: '205/55R16 Michelin Primacy 4',
  batteryBrand: 'Bosch',
  whereBought: 'Amazon / Repuestos Gómez',
};

/** The seed's Trueno facts. */
const FACTS: VehicleFactRow[] = [
  { id: 'f1', vehicleId: 'trueno', label: 'Código de radio', value: '4471', groupName: 'electrico', sortOrder: 1 },
  { id: 'f2', vehicleId: 'trueno', label: 'Torque tapa de válvulas', value: '8 N·m', groupName: 'motor', sortOrder: 0 },
  { id: 'f3', vehicleId: 'trueno', label: 'Llave de ruedas', value: 'Maletero, lado izquierdo', groupName: 'gomas', sortOrder: 0 },
  { id: 'f4', vehicleId: 'trueno', label: 'Póliza', value: 'Seguros Universal 12345', groupName: 'papeles', sortOrder: 0 },
  { id: 'f5', vehicleId: 'trueno', label: 'Borrado', value: 'x', groupName: 'otros', sortOrder: 0, deletedAt: '2026-09-01T00:00:00Z' },
  { id: 'f6', vehicleId: 'trueno', label: 'Vacío', value: '  ', groupName: 'otros', sortOrder: 0 },
];

const TRUENO: MemorySpecsheet = { vehicleId: 'trueno', oilGrade: '10W-30', oilCapacityFilterL: 3.7, sparkPlugPn: 'BKR6E', tireSizeOemF: '185/60R14' };

describe('carMemory', () => {
  it('groups the DS3’s specsheet into sections in the Ficha order', () => {
    const sections = carMemory(DS3);
    expect(sections.map((s) => s.title)).toEqual(['Aceite y filtros', 'Motor', 'Gomas', 'Eléctrico', 'Carrocería', 'Otros']);
    const oil = sections[0].rows.map((r) => [r.label, r.value]);
    expect(oil).toEqual([
      ['Aceite (marca)', 'Castrol Edge'],
      ['Aceite (producto)', '5W-30 Full Synthetic 1 gal'],
      ['Viscosidad', '5W-30'],
      ['Norma del aceite', 'PSA B71 2290'],
      ['Capacidad con filtro', '4.25 L'],
      ['Filtro de aceite (marca)', 'Fram'],
      ['Filtro de aceite', 'PH6607'],
      ['Filtro de aire', 'CA11213'],
      ['Filtro de cabina', 'CF11920'],
    ]);
    expect(sections.every((s) => s.rows.every((r) => r.source === 'ficha'))).toBe(true);
    expect(sections.find((s) => s.id === 'gomas')?.rows.find((r) => r.key === 'psiOemF')?.value).toBe('33 psi');
    expect(sections.find((s) => s.id === 'gomas')?.rows.find((r) => r.key === 'lugTorqueNm')?.value).toBe('100 N·m');
  });

  it('adds the Trueno’s facts in their groups (live, non-empty, by sort order)', () => {
    const sections = carMemory(TRUENO, FACTS);
    expect(sections.map((s) => s.id)).toEqual(['aceite', 'motor', 'gomas', 'electrico', 'papeles']);
    const motor = sections.find((s) => s.id === 'motor')!;
    expect(motor.rows.map((r) => r.label)).toEqual(['Bujías', 'Torque tapa de válvulas']);
    expect(motor.rows[1]).toMatchObject({ source: 'dato', factId: 'f2', key: 'fact:f2', value: '8 N·m' });
    expect(sections.flatMap((s) => s.rows).some((r) => r.label === 'Borrado' || r.label === 'Vacío')).toBe(false);
  });

  it('an unknown fact group lands in Otros; no specsheet is fine', () => {
    const sections = carMemory(null, [{ id: 'z', vehicleId: 'v', label: 'Color', value: 'Blanco', groupName: 'raro' as never, sortOrder: 0 }]);
    expect(sections).toEqual([{ id: 'otros', title: 'Otros', rows: [expect.objectContaining({ label: 'Color', value: 'Blanco' })] }]);
    expect(carMemory(undefined)).toEqual([]);
  });
});

describe('searchMemory', () => {
  const sections = carMemory({ ...TRUENO, ...DS3 }, FACTS);

  it('folds accents and case', () => {
    const hits = searchMemory(sections, 'codigo RADIO');
    expect(hits).toHaveLength(1);
    expect(hits[0].rows.map((r) => r.value)).toEqual(['4471']);
  });

  it('matches values and part numbers', () => {
    expect(searchMemory(sections, 'ph6607').flatMap((s) => s.rows.map((r) => r.key))).toEqual(['oilFilterPn']);
    expect(searchMemory(sections, 'válvulas')[0].rows[0].label).toBe('Torque tapa de válvulas');
  });

  it('a section title matches its rows; empty query returns all; no match returns none', () => {
    expect(searchMemory(sections, 'electrico')[0].rows.length).toBe(sections.find((s) => s.id === 'electrico')!.rows.length);
    expect(searchMemory(sections, '  ')).toEqual(sections);
    expect(searchMemory(sections, 'turbo')).toEqual([]);
  });
});

describe('suggestionsFor', () => {
  it('oil change on the DS3: "Igual que siempre: Castrol Edge 5W-30 · Fram PH6607"', () => {
    const s = suggestionsFor('aceite_motor', DS3)!;
    expect(s.summary).toBe('Castrol Edge 5W-30 · Fram PH6607');
    expect(s.label).toBe('Igual que siempre: Castrol Edge 5W-30 · Fram PH6607');
    expect(s.oil).toEqual({ oilViscosity: '5W-30', oilBrand: 'Castrol Edge', oilSpec: 'PSA B71 2290' });
    expect(s.rows.map((r) => r.key)).toEqual([
      'oilBrand', 'oilProduct', 'oilGrade', 'oilSpec', 'oilCapacityFilterL', 'oilFilterBrand', 'oilFilterPn', 'whereBought',
    ]);
  });

  it('with no grade, the product line stands in', () => {
    expect(suggestionsFor('aceite_motor', { oilBrand: 'Mobil 1', oilProduct: 'Extended Performance' })!.summary).toBe('Mobil 1 Extended Performance');
  });

  it('other service types read their own columns', () => {
    expect(suggestionsFor('filtro_aire', DS3)!.summary).toBe('CA11213');
    expect(suggestionsFor('limpiavidrios', DS3)!.summary).toBe('26/16');
    expect(suggestionsFor('bujias', TRUENO)!.summary).toBe('BKR6E');
    expect(suggestionsFor('cambio_gomas', DS3)!.summary).toBe('205/55R16 Michelin Primacy 4 · 205/55R16');
  });

  it('null when nothing to say', () => {
    expect(suggestionsFor('filtro_combustible', DS3)).toBeNull(); // only whereBought would show
    expect(suggestionsFor('lavado', DS3)).toBeNull();
    expect(suggestionsFor('aceite_motor', null)).toBeNull();
    expect(suggestionsFor(null, DS3)).toBeNull();
    expect(suggestionsFor('aceite_motor', {})).toBeNull();
  });
});

describe('suggestionForFluid (the check runner\'s fluid card)', () => {
  it('maps a fluid kind to the service type that remembers it', () => {
    expect(suggestionForFluid('aceite', DS3)!.summary).toBe('Castrol Edge 5W-30 · Fram PH6607');
    expect(suggestionForFluid('coolant', DS3)!.summary).toBe('Revkogel 2000');
    expect(suggestionForFluid('bateria', DS3)!.summary).toBe('Bosch · 60 Ah 640 A');
    expect(suggestionForFluid('filtro_aire', DS3)!.label).toBe('Igual que siempre: CA11213');
  });

  it('null for the washer, an unknown kind, no kind or no sheet', () => {
    expect(suggestionForFluid('washer', DS3)).toBeNull();
    expect(suggestionForFluid('nitro', DS3)).toBeNull();
    expect(suggestionForFluid(null, DS3)).toBeNull();
    expect(suggestionForFluid('aceite', null)).toBeNull();
  });
});

describe('search fold, more cases', () => {
  const sections = carMemory(DS3, FACTS);
  it('every word must appear, in any order, across label, value and section', () => {
    expect(searchMemory(sections, 'radio 4471')[0].rows.map((r) => r.label)).toEqual(['Código de radio']);
    expect(searchMemory(sections, 'radio 9999')).toEqual([]);
    expect(searchMemory(sections, 'GOMEZ').flatMap((s) => s.rows.map((r) => r.key))).toEqual(['whereBought']);
  });
  it('a hit keeps its section title and drops the other rows', () => {
    const hits = searchMemory(sections, 'póliza');
    expect(hits.map((h) => h.title)).toEqual(['Papeles']);
    expect(hits[0].rows).toHaveLength(1);
  });
});
