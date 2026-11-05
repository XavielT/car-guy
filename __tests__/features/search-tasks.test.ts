/**
 * SPEC-K §K4: a person types what they WANT TO DO, in their own words. For each of the 15 everyday tasks (SPEC-K §K0) a few real phrasings
 * must put the right function first (or, where two functions honestly answer, within the first two).
 */
import { en } from '@/lib/i18n/en';
import { es } from '@/lib/i18n/es';
import { activeFeatures } from '@/lib/features/registry';
import { searchFeatures } from '@/lib/features/search';
import { SYNONYM_GROUPS, synonymsOf } from '@/lib/features/synonyms';

const copy = (lang: 'es' | 'en') => (def: { id: string }) => (lang === 'es' ? es : en).features.items[def.id as keyof typeof es.features.items];
const top = (q: string, n = 1, lang: 'es' | 'en' = 'es') => searchFeatures(q, copy(lang) as never, activeFeatures()).slice(0, n).map((f) => f.id as string);

const TASKS: [string, string, string[]][] = [
  ['cargar gasolina', 'fuel', ['cargar gasolina', 'echar gasolina', 'llenar el tanque', 'combustible', 'fui a la bomba']],
  ['iniciar un viaje', 'trip', ['iniciar un viaje', 'empezar un viaje', 'grabar la ruta']],
  ['ver mis viajes', 'trips', ['ver mis viajes', 'mis rutas', 'recorridos']],
  ['registrar un servicio', 'service', ['registrar un servicio', 'cambio de aceite', 'mantenimiento']],
  ['registrar una reparación', 'repair', ['registrar una reparacion', 'lo llevé al taller', 'arreglo del mecanico']],
  ['cuánto gasté este mes', 'stats', ['cuanto gaste este mes', 'mis gastos', 'cuanto he gastado']],
  ['poner un recordatorio (marbete)', 'reminders', ['recordatorio del marbete', 'avisame cuando venza el seguro', 'poner una alarma']],
  ['guardar un documento', 'docs', ['guardar un documento', 'subir la matricula', 'mis papeles']],
  ['ver el último kilometraje', 'odometer', ['ver el kilometraje', 'cuantos kilometros tiene', 'odometro']],
  ['agregar una modificación', 'mod', ['agregar una modificacion', 'le puse una pieza nueva', 'upgrade']],
  ['subir fotos', 'photo', ['subir fotos', 'agregar imagenes', 'fotos del carro']],
  ['compartir mi garaje', 'share', ['compartir mi garaje', 'invitar a alguien']],
  ['escanear un código OBD', 'obd', ['escanear un codigo', 'luz del tablero', 'check engine', 'falla del motor']],
];

describe('the 15 everyday tasks, in the words people use', () => {
  for (const [task, id, phrases] of TASKS) {
    it(`${task} → ${id}`, () => {
      for (const p of phrases) expect({ p, hits: top(p, 2) }).toEqual({ p, hits: expect.arrayContaining([id]) });
    });
  }
  it('the main verbs put their function FIRST', () => {
    expect(top('cargar gasolina')[0]).toBe('fuel');
    expect(top('iniciar un viaje')[0]).toBe('trip');
    expect(top('registrar un servicio')[0]).toBe('service');
    expect(top('guardar un documento')[0]).toBe('docs');
    expect(top('escanear un codigo')[0]).toBe('obd');
  });
  it('English phrasings work too', () => {
    expect(top('log fuel', 2, 'en')).toContain('fuel');
    expect(top('start a trip', 2, 'en')).toContain('trip');
    expect(top('how much did I spend', 3, 'en')).toContain('stats');
  });
});

describe('synonym groups', () => {
  it('a word belongs to one group only', () => {
    const seen = new Map<string, number>();
    SYNONYM_GROUPS.forEach((g, i) => g.forEach((w) => {
      expect({ w, dup: seen.has(w) && seen.get(w) !== i }).toEqual({ w, dup: false });
      seen.set(w, i);
    }));
  });
  it('a word outside every group maps to itself', () => {
    expect(synonymsOf('zzz')).toEqual(['zzz']);
    expect(synonymsOf('gomera')).toContain('llanta');
  });
});
