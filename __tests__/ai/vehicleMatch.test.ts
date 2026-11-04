/**
 * IMP 03112026 SPEC-C §C2: scanned text → the refdata ids the vehicle form's pickers use.
 */
import { matchColor, matchMake, matchMakeModel, matchModel } from '@/lib/ai/vehicleMatch';
import { colors, modelsFor } from '@/lib/domain/refdata';

describe('matchMake / matchModel', () => {
  it('finds a make case- and accent-insensitively, by name or alias', () => {
    expect(matchMake('TOYOTA')?.id).toBe('toyota');
    expect(matchMake('  toyota ')?.id).toBe('toyota');
    expect(matchMake('Citroen')?.id).toBe(matchMake('Citroën')?.id);
    expect(matchMake('Marca Inventada')).toBeNull();
    expect(matchMake(null)).toBeNull();
  });
  it('a model by exact name, or as whole words inside a longer description', () => {
    const toyota = modelsFor('toyota');
    expect(toyota.length).toBeGreaterThan(0);
    const hilux = toyota.find((m) => m.name.toLowerCase() === 'hilux');
    expect(hilux).toBeDefined();
    expect(matchModel('toyota', 'HILUX')?.id).toBe(hilux!.id);
    expect(matchModel('toyota', 'Hilux SR5 4x4')?.id).toBe(hilux!.id);
    expect(matchModel('toyota', 'Zzzzz')).toBeNull();
  });
  it('the match never crosses makes: a Toyota model name under another make is not found', () => {
    expect(matchModel('honda', 'Hilux')).toBeNull();
  });
  it('matchMakeModel: ids and catalog names when known, the scanned text when not', () => {
    const known = matchMakeModel('TOYOTA', 'HILUX');
    expect(known.makeId).toBe('toyota');
    expect(known.modelId).toBe('toyota-hilux');
    expect(known.make).toBe('Toyota');
    const unknownModel = matchMakeModel('Toyota', 'Modelo Raro 3000');
    expect(unknownModel).toMatchObject({ makeId: 'toyota', modelId: null, model: 'Modelo Raro 3000' });
    const unknownMake = matchMakeModel('Marca Rara', 'X1');
    expect(unknownMake).toEqual({ makeId: null, make: 'Marca Rara', modelId: null, model: 'X1' });
    expect(matchMakeModel(null, null)).toEqual({ makeId: null, make: '', modelId: null, model: '' });
  });
});

describe('matchColor', () => {
  it('finds a catalog colour by its Spanish or English name', () => {
    const first = colors('exterior').find((c) => c.hex)!;
    expect(matchColor(first.es.toUpperCase())?.id).toBe(first.id);
    expect(matchColor(first.en)?.id).toBe(first.id);
  });
  it('anything else is null (the form keeps the text as the "Otro" colour)', () => {
    expect(matchColor('Verde jaspe con rayas')).toBeNull();
    expect(matchColor('')).toBeNull();
  });
});
