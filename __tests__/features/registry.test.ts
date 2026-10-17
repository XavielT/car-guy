/**
 * ADR-62 (IMP 16102026): every screen under app/ belongs to a registered function or is named internal with its reason,
 * and the function search finds things the way people say them (accents, slips, Spanish and English synonyms).
 */
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { es } from '@/lib/i18n/es';
import { en } from '@/lib/i18n/en';
import { FEATURE_IDS } from '@/lib/features/ids';
import { coveringFeature, FEATURES, featureById, featureHref, internalReason, activeFeatures, type FeatureDef } from '@/lib/features/registry';
import { searchFeatures } from '@/lib/features/search';

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx$/.test(name)) out.push(full);
  }
  return out;
}
const ROOT = join(__dirname, '../..');
const routes = walk(join(ROOT, 'app'))
  .map((f) => 'app/' + f.slice(join(ROOT, 'app').length + 1).split('\\').join('/'))
  .filter((f) => !/_layout|\+html|\+not-found/.test(f));

describe('registry vs routes', () => {
  it('found the routes', () => expect(routes.length).toBeGreaterThan(70));

  it('every screen is covered by a function or named internal', () => {
    const orphans = routes.filter((f) => !coveringFeature(f) && !internalReason(f));
    expect(orphans).toEqual([]);
  });

  it('every id has one definition and a title and description in both languages', () => {
    for (const id of FEATURE_IDS) {
      expect(FEATURES.filter((f) => f.id === id)).toHaveLength(1);
      for (const dict of [es, en]) {
        expect(dict.features.items[id].title.length).toBeGreaterThan(0);
        expect(dict.features.items[id].desc.length).toBeGreaterThan(0);
      }
    }
  });

  it('OBD is featured, a shortcut and a telltale', () => {
    const obd = featureById('obd');
    expect(obd.featured).toBeDefined();
    expect(obd.shortcut).toBeDefined();
    expect(obd.telltale).toBe('check');
  });

  it('the hub offers every active function (2 taps from Inicio: Herramientas → function)', () => {
    expect(activeFeatures().length).toBeGreaterThan(30);
    for (const f of activeFeatures()) expect(f.href.startsWith('/')).toBe(true);
  });

  it('featureHref fills the active vehicle', () => {
    expect(featureHref(featureById('album'), 'v1')).toBe('/vehiculo/v1?tab=album');
    expect(featureHref(featureById('obd'), 'v1')).toBe('/obd?vehicleId=v1');
    expect(featureHref(featureById('repair'), 'v1')).toBe('/servicio/nuevo?kind=reparacion&vehicleId=v1');
    expect(featureHref(featureById('fuel'), 'v1')).toBe('/carga/nueva');
  });
});

const copyOf = (lang: 'es' | 'en') => (def: FeatureDef) => (lang === 'es' ? es : en).features.items[def.id];
const first = (q: string, lang: 'es' | 'en' = 'es') => searchFeatures(q, copyOf(lang))[0]?.id;
const has = (q: string, id: string, lang: 'es' | 'en' = 'es') => searchFeatures(q, copyOf(lang)).some((f) => f.id === id);

describe('function search', () => {
  it.each([
    ['luz del tablero', 'obd'],
    ['check engine', 'obd'],
    ['falla', 'obd'],
    ['código', 'obd'],
    ['OBD', 'obd'],
    ['taller', 'repair'],
    ['arreglo', 'repair'],
    ['cambio de aceite', 'service'],
    ['factura', 'repair'],
  ])('"%s" finds %s', (q, id) => expect(has(q, id)).toBe(true));

  it('the obvious answer comes first', () => {
    expect(first('obd')).toBe('obd');
    expect(first('luz del tablero')).toBe('obd');
    expect(first('echada')).toBe('fuel');
    expect(first('odometro')).toBe('odometer');
  });

  it('ignores accents and case', () => {
    expect(has('ODÓMETRO', 'odometer')).toBe(true);
    expect(has('diagnostico', 'obd')).toBe(true);
    expect(has('Diagnóstico', 'obd')).toBe(true);
  });

  it('forgives a slip', () => {
    expect(has('diagnostco', 'obd')).toBe(true);
    expect(has('gasolna', 'fuel')).toBe(true);
  });

  it('finds English synonyms in either language', () => {
    expect(has('dashboard light', 'obd', 'en')).toBe(true);
    expect(has('oil change', 'service', 'en')).toBe(true);
    expect(has('check engine', 'obd', 'es')).toBe(true);
    expect(has('luz del tablero', 'obd', 'en')).toBe(true);
  });

  it('nonsense finds nothing; an empty query finds everything', () => {
    expect(searchFeatures('zzqxv', copyOf('es'))).toEqual([]);
    expect(searchFeatures('  ', copyOf('es')).length).toBe(activeFeatures().length);
  });
});

describe('depth from Inicio (PROMPT-04: nothing more than 2 taps)', () => {
  const { readFileSync } = require('node:fs') as typeof import('node:fs');
  const read = (f: string) => readFileSync(join(ROOT, f), 'utf8');

  it('Inicio has the Herramientas button and the search magnifier (1 tap to the hub)', () => {
    const home = read('app/(tabs)/index.tsx');
    expect(home).toContain("router.push('/herramientas')");
    expect(home).toContain("focus: 'search'");
  });

  it('Más opens the hub from its first row', () => {
    expect(read('app/(tabs)/mas.tsx')).toContain("router.push('/herramientas')");
  });

  it('the hub draws every active function from the registry (so each is tap 2)', () => {
    const hub = read('app/herramientas.tsx');
    expect(hub).toContain('activeFeatures()');
    expect(hub).toContain('FEATURE_SECTIONS.map');
  });

  it('no active function is left out of a hub section', () => {
    const sections = new Set(['registrar', 'diagnostico', 'vehiculo', 'viajes', 'cuenta']);
    for (const f of activeFeatures()) expect(sections.has(f.section)).toBe(true);
  });
});
