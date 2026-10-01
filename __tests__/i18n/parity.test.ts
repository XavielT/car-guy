/**
 * es ↔ en parity (ADR-39). `en: Dict` already fails the build on a missing key
 * or a wrong function signature; this walks both trees for what types cannot
 * see: an empty or copy-pasted Spanish value, a function with other arity, an
 * array of another length, Spanish words left in English.
 */
import { en } from '@/lib/i18n/en';
import { es } from '@/lib/i18n/es';

type Tree = Record<string, unknown>;

/** Values that are the same word in both languages: car culture, units, brands, names. */
const SAME_OK = new Set([
  // IMP 01102026: the same word in both languages.
  '+ Mod',
  'Spoiler',
  'Car Guy', 'CAR GUY', 'Regular', 'Óptimo', 'Build', 'Links', 'Link', 'Mod', 'Mods', 'MODS', 'Wishlist', 'WISHLIST', 'Color', 'Material',
  'Toyota, Honda, Hyundai…', 'Corolla, CR-V…', '© OpenStreetMap', 'Xiaomi / Redmi / POCO', 'autodromo', 'santiago', 'isla',
  'Manual', 'CVT', 'JDM', 'USDM', 'EUDM', 'Local', 'Docs', 'Total (RD$)', 'Normal', 'Marbete', 'Total', 'PRESET', 'VPIC',
  'Presets', 'TORQUES', '+ Torque', 'Torque (Nm)', 'OBD-II', 'DEALER', 'WhatsApp', 'DIY', 'TRACK DAY', 'DRIFT', 'DRAG',
  'AUTOCROSS', 'RUNS', 'Runs', 'runs', 'Camber (°)', 'LSD', 'LAUNCH', 'Two-step (rpm)', 'Trap (km/h)', 'NEUTRAL', 'Neutral',
  'SPECS', 'IDEA', 'Idea', 'DYNO', 'STOCK', 'stock', 'SNAPSHOTS', 'CORE', 'Treadwear', 'TRACK', 'SWAP', 'ECU',
  'ADMIN · 管理', 'Admin', 'Premium', 'ANDROID · インストール', 'Commit', 'github.com/XavielT/car-guy/releases',
  'Español', 'English', 'MICM', 'App', 'Stock', 'Interior', 'Legal',
]);

/** Proper nouns that contain Spanish words; removed before the leftover check. */
const PROPER = [/Autódromo de las Américas/g, /Tu Combustible RD/g];
const SPANISH = /\b(el|la|los|las|del|para|con|una|que|por|está|están|tus?|sin|más|también|cuando|dónde|aquí|ahora|hoy|ayer|carro|gomas|echada|vehículo)\b/i;

function walk(a: Tree, b: Tree, path: string, out: string[]) {
  for (const key of Object.keys(a)) {
    const p = path ? `${path}.${key}` : key;
    const x = a[key];
    const y = b[key];
    if (!(key in b)) out.push(`missing in en: ${p}`);
    else if (typeof x !== typeof y) out.push(`type differs: ${p}`);
    else if (Array.isArray(x)) {
      if (!Array.isArray(y) || x.length !== y.length) out.push(`array length differs: ${p}`);
      else walk(x as unknown as Tree, y as unknown as Tree, p, out);
    } else if (typeof x === 'function') {
      if ((x as () => unknown).length !== (y as () => unknown).length) out.push(`arity differs: ${p}`);
    } else if (typeof x === 'string') {
      const s = y as string;
      if (!s.trim() && x.trim()) out.push(`empty in en: ${p}`);
      if (s === x && /[a-záéíóúñ]{3,}/i.test(x) && !SAME_OK.has(x)) out.push(`not translated: ${p} = ${JSON.stringify(x)}`);
      const scrubbed = PROPER.reduce((acc, re) => acc.replace(re, ''), s);
      if (SPANISH.test(scrubbed)) out.push(`Spanish left in en: ${p} = ${JSON.stringify(s)}`);
    } else if (x && typeof x === 'object') walk(x as Tree, y as Tree, p, out);
  }
  for (const key of Object.keys(b)) if (!(key in a)) out.push(`extra in en: ${path ? `${path}.` : ''}${key}`);
}

it('en has es’s exact tree, translated', () => {
  const problems: string[] = [];
  walk(es as unknown as Tree, en as unknown as Tree, '', problems);
  expect(problems).toEqual([]);
});

it('every function in en returns a string for plausible arguments, like es', () => {
  const failures: string[] = [];
  const probe = (a: Tree, b: Tree, path: string) => {
    for (const key of Object.keys(a)) {
      const x = a[key];
      const y = b[key];
      const p = `${path}.${key}`;
      if (typeof x === 'function') {
        // Numbers are the common argument; a function that wants something else may throw
        // on a number in both languages — only a difference between them is a finding.
        const args = Array.from({ length: (x as () => unknown).length }, (_, i) => i + 2);
        let ex: unknown;
        let ey: unknown;
        try { ex = typeof (x as (...a: unknown[]) => unknown)(...args); } catch { ex = 'throws'; }
        try { ey = typeof (y as (...a: unknown[]) => unknown)(...args); } catch { ey = 'throws'; }
        if (ex !== ey) failures.push(`${p}: es ${String(ex)} / en ${String(ey)}`);
      } else if (x && typeof x === 'object') probe(x as Tree, y as Tree, p);
    }
  };
  probe(es as unknown as Tree, en as unknown as Tree, '');
  expect(failures).toEqual([]);
});
