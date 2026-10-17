/**
 * ADR-60 (IMP 16102026): a choice of a value is a SelectField (or a FilterBar pill, or a ToggleRow for a yes/no) — never
 * a row of `Chip`s or a `Segmented` laid out on the screen. This fails the day a screen brings one back as a value
 * selector. Navigation (tabs, a sign-in / sign-up switch, a view switch) is not a value, so those files are named here
 * with the reason; adding to this list needs a reason too.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join(__dirname, '../..');

/** Files that may still render `Chip` / `Segmented`, and why. Paths use `/`. */
const NAVIGATION: Record<string, string> = {
  'components/ui/index.tsx': 'defines Chip and Segmented',
  'components/pickers/YearWheel.tsx': 'decade shortcuts that scroll the wheel (an action, not a value)',
  'app/dev/tokens.tsx': 'the design-token gallery shows every component',
  'app/comunidad.tsx': 'tabs: Amigos / Seguidores / Solicitudes… switch the list',
  'app/cuenta.tsx': 'Entrar / Crear cuenta switches the form',
  'app/vehiculo/[id]/album/index.tsx': 'Línea de tiempo / Cuadrícula switches the view',
  'app/vehiculo/[id]/ficha.tsx': 'Ficha / Memoria tabs',
  'app/vehiculo/[id]/build.tsx': 'Modificaciones / Specs / Wishlist tabs',
};

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx$/.test(name)) out.push(full);
  }
  return out;
}

describe('no Chip / Segmented as a value selector', () => {
  it('only the navigation files render them', () => {
    const offenders: string[] = [];
    for (const dir of ['app', 'components']) {
      for (const file of walk(join(ROOT, dir))) {
        const rel = relative(ROOT, file).split('\\').join('/');
        if (rel in NAVIGATION) continue;
        if (/<(Chip|Segmented)\b/.test(readFileSync(file, 'utf8'))) offenders.push(rel);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('every allowed file still renders one (the list does not rot)', () => {
    const stale = Object.keys(NAVIGATION).filter((rel) => {
      if (rel === 'components/ui/index.tsx') return false;
      return !/<(Chip|Segmented)\b/.test(readFileSync(join(ROOT, rel), 'utf8'));
    });
    expect(stale).toEqual([]);
  });
});

/**
 * A hand-made row of `Pressable`s with role tab/radio is the same thing as a Chip row (the service form's "Tipo" was
 * one, found in the phase-6 review). Only these may exist, each with its reason.
 */
const HAND_MADE: Record<string, string> = {
  'app/(tabs)/garaje.tsx': 'Portadas / Cuadrícula / Lista: how the garage is drawn (a view switch)',
  'app/perfil.tsx': 'the avatar grid: a picture picker, not a list of named options',
  'app/vehiculo/[id].tsx': 'the vehicle’s page tabs (with "Todas las secciones")',
  'components/pickers/SwatchGrid.tsx': 'inside the colour sheet',
  'components/ui/index.tsx': 'defines Chip and Segmented',
};

describe('no hand-made option rows either', () => {
  it('only the named files render a tab/radio Pressable group', () => {
    const offenders: string[] = [];
    for (const dir of ['app', 'components']) {
      for (const file of walk(join(ROOT, dir))) {
        const rel = relative(ROOT, file).split('\\').join('/');
        if (rel in HAND_MADE || rel.startsWith('components/tabbar/')) continue;
        if (/accessibilityRole="(radio|tab)"/.test(readFileSync(file, 'utf8'))) offenders.push(rel);
      }
    }
    expect(offenders).toEqual([]);
  });
  it('the list does not rot', () => {
    const stale = Object.keys(HAND_MADE).filter((rel) => !/accessibilityRole="(radio|tab)"/.test(readFileSync(join(ROOT, rel), 'utf8')));
    expect(stale).toEqual([]);
  });
});
