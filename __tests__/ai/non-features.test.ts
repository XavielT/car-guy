/** @jest-environment node */
/**
 * IMP 03112026 SPEC-G §G3 and §G8 are DELIBERATE non-features (ADR-76). This test is what keeps them that way: it fails if code under
 * trips / Conducir / Juntes / profiles / community starts importing an AI module, calling a cg-* function, or calling a Google Maps
 * Platform service (which the terms forbid beside a non-Google map).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = join(__dirname, '../..');
const AREAS = [
  // G3: trips and Conducir
  'app/viaje', 'app/viajes', 'app/conducir.tsx', 'app/pista', 'components/trips', 'components/drive', 'components/track', 'lib/trips',
  // G8: Juntes, profiles, follows, public pages, community
  'app/junte', 'app/juntes', 'app/comunidad.tsx', 'app/u', 'app/perfil.tsx', 'app/compartidos.tsx', 'components/junte', 'components/social', 'lib/junte', 'lib/social', 'lib/profile.ts', 'lib/share',
];

function files(rel: string): string[] {
  const p = join(root, rel);
  let st;
  try {
    st = statSync(p);
  } catch {
    return [];
  }
  if (st.isFile()) return [p];
  return readdirSync(p).flatMap((n) => files(join(rel, n)));
}

const FORBIDDEN: [RegExp, string][] = [
  [/from ['"](@\/|(\.\.?\/)+)lib\/ai\//, 'imports an AI module'],
  [/from ['"](@\/|(\.\.?\/)+)components\/ai\//, 'imports an AI component'],
  [/\bcallAi\b|\bcg-(ai|stt|places)/, 'calls a cg-* function'],
  [/places\.googleapis\.com|maps\.googleapis\.com\/maps\/api\/(geocode|directions|place)|routes\.googleapis\.com/, 'calls a Google Maps Platform API'],
];

describe('trips, Conducir, Juntes, profiles and community carry no AI and no Google Maps Platform call', () => {
  const all = AREAS.flatMap(files).filter((f) => /\.(ts|tsx)$/.test(f));
  it('the guard actually looks at files', () => expect(all.length).toBeGreaterThan(20));
  it.each(FORBIDDEN)('%s: %s', (re, why) => {
    const hits = all.filter((f) => re.test(readFileSync(f, 'utf8'))).map((f) => f.replace(root, ''));
    expect({ why, hits }).toEqual({ why, hits: [] });
  });
});
