import fs from 'fs';
import path from 'path';

import {
  bodyTypes,
  colors,
  DEFAULT_FIRST_YEAR,
  fluids,
  modelById,
  modelsFor,
  oil,
  searchMakes,
  yearsFor,
} from '@/lib/domain/refdata';

/**
 * The refdata files are bundled into the app, so these guard the budget, the
 * `{source, license, items}` contract that carries the credit, stable unique
 * ids, and the accent-insensitive search the pickers will lean on.
 */

const DIR = path.join(__dirname, '../../lib/domain/refdata');
const FILES = ['makes.json', 'colors.json', 'bodyTypes.json', 'oil.json', 'fluids.json'];
const read = (f: string) => JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));

describe('refdata files', () => {
  it('stay within 50 KB raw together', () => {
    const bytes = FILES.reduce((sum, f) => sum + fs.statSync(path.join(DIR, f)).size, 0);
    expect(bytes).toBeLessThanOrEqual(50 * 1024);
  });

  it.each(FILES)('%s has source, license and items', (f) => {
    const file = read(f);
    expect(Object.keys(file).sort()).toEqual(['items', 'license', 'source']);
    expect(file.source.length).toBeGreaterThan(10);
    expect(file.license.length).toBeGreaterThan(5);
    expect(file.items.length).toBeGreaterThan(0);
  });

  it.each(FILES)('%s has unique ids', (f) => {
    const ids: string[] = read(f).items.map((i: { id: string }) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it('has unique model ids across all makes', () => {
    const makes: { id: string }[] = read('makes.json').items;
    const ids = makes.flatMap((m) => modelsFor(m.id).map((x) => x.id));
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    expect(makes.length).toBeGreaterThanOrEqual(55);
  });

  it('has sane year ranges', () => {
    const makes: { id: string }[] = read('makes.json').items;
    for (const m of makes) {
      for (const x of modelsFor(m.id)) {
        if (x.from != null) expect(x.from).toBeGreaterThanOrEqual(1930);
        if (x.from != null && x.to != null) expect(x.to).toBeGreaterThanOrEqual(x.from);
      }
    }
  });
});

describe('searchMakes', () => {
  it('ignores accents and case', () => {
    expect(searchMakes('citroen')[0].make.name).toBe('Citroën');
    expect(searchMakes('CITROËN')[0].make.id).toBe('citroen');
    expect(searchMakes('skoda')[0].make.name).toBe('Škoda');
  });

  it('finds a model by name or alias and returns it under its make', () => {
    const trueno = searchMakes('trueno');
    expect(trueno.map((r) => r.make.id)).toEqual(['toyota']);
    expect(trueno[0].models.map((m) => m.name)).toEqual(['Sprinter Trueno']);

    const ae86 = searchMakes('ae86')[0].models.map((m) => m.id);
    expect(ae86).toEqual(expect.arrayContaining(['toyota-corolla-levin', 'toyota-sprinter-trueno']));
  });

  it('matches make aliases and make + model', () => {
    expect(searchMakes('vw')[0].make.id).toBe('volkswagen');
    expect(searchMakes('chevy')[0].make.id).toBe('chevrolet');
    const hilux = searchMakes('toyota hilux');
    expect(hilux[0].make.id).toBe('toyota');
    expect(hilux[0].models[0].id).toBe('toyota-hilux'); // Fortuner follows via its "Hilux SW4" alias
    expect(searchMakes('toyota')[0].models).toEqual([]);
    expect(searchMakes('megane')[0].models[0].name).toBe('Mégane');
  });

  it('lists every make, top first, for an empty query', () => {
    const all = searchMakes('  ');
    expect(all.length).toBeGreaterThanOrEqual(55);
    const firstNonTop = all.findIndex((r) => !r.make.top);
    expect(all.slice(firstNonTop).every((r) => !r.make.top)).toBe(true);
  });

  it('returns nothing for gibberish', () => {
    expect(searchMakes('zzqx')).toEqual([]);
  });
});

describe('modelsFor', () => {
  it('lists Toyota with the DR models', () => {
    const names = modelsFor('toyota').map((m) => m.name);
    expect(names).toEqual(expect.arrayContaining(['Hilux', 'Land Cruiser Prado', 'Hiace', 'Fortuner', 'Starlet', 'Tercel']));
    expect(modelsFor('toyota').find((m) => m.name === 'Hilux')?.id).toBe('toyota-hilux');
  });

  it('is empty for an unknown make', () => {
    expect(modelsFor('nope')).toEqual([]);
  });
});

describe('yearsFor', () => {
  const now = new Date('2026-09-29T12:00:00');

  it('defaults to DEFAULT_FIRST_YEAR..next year, newest first', () => {
    const ys = yearsFor(undefined, now);
    expect(ys[0]).toBe(2027);
    expect(ys[ys.length - 1]).toBe(DEFAULT_FIRST_YEAR);
    expect(yearsFor('no-such-model', now)).toEqual(ys);
  });

  it("uses a model's range", () => {
    const trueno = yearsFor('toyota-sprinter-trueno', now);
    expect(trueno[0]).toBe(modelById('toyota-sprinter-trueno')?.to);
    expect(trueno).toContain(1985);
    expect(yearsFor('toyota-hilux', now)[0]).toBe(2027);
  });
});

describe('other lists', () => {
  it('has 18 exterior colours plus Otro, and interiors', () => {
    expect(colors('exterior').filter((c) => c.id !== 'otro')).toHaveLength(18);
    expect(colors('interior').length).toBeGreaterThan(5);
    expect(colors('material').map((m) => m.es)).toContain('Tela');
  });

  it('has the oil types, grades and specs', () => {
    expect(oil('type').map((t) => t.id)).toEqual(['mineral', 'semisintetico', 'sintetico']);
    expect(oil('grade').map((g) => g.es)).toEqual(expect.arrayContaining(['0W-20', '5W-30', '20W-50']));
    expect(oil('spec').map((s) => s.es)).toEqual(expect.arrayContaining(['API SP', 'ILSAC GF-6A', 'ACEA C3']));
    expect(oil('brand').length).toBeGreaterThan(8);
  });

  it('has body types and fluids', () => {
    expect(bodyTypes().find((b) => b.id === 'suv')?.es).toBe('SUV / Jeepeta');
    expect(fluids('brake').map((b) => b.es)).toContain('DOT 4');
    expect(fluids('coolant').length).toBeGreaterThanOrEqual(5);
  });
});
