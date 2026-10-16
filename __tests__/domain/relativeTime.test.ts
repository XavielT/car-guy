/**
 * "hace 0 s" split across two lines in "Tanque: 4/12 ≈ 4.5 gal · ≈ 120 km (70–190) · hace 0 s" (IMP 16102026 X2).
 * The relative time never says "0 s", and a status line breaks only at its " · " separators.
 */
import { agoText, noBreak } from '@/lib/format';
import { __setLanguageForTests } from '@/lib/i18n';

const NB = ' ';
const S = 1000;
const MIN = 60 * S;
const H = 60 * MIN;
const D = 24 * H;

afterEach(() => __setLanguageForTests('es'));

describe('agoText (es)', () => {
  beforeEach(() => __setLanguageForTests('es'));

  it('says "ahora" for the first seconds — never "0 s"', () => {
    for (const ms of [0, 1, 400, 4 * S, 9 * S]) expect(agoText(ms)).toBe('ahora');
    expect(agoText(-5 * S)).toBe('ahora'); // a clock a little ahead
  });

  it('seconds, minutes, hours', () => {
    expect(agoText(12 * S)).toBe(`hace${NB}12${NB}s`);
    expect(agoText(59 * S)).toBe(`hace${NB}59${NB}s`);
    expect(agoText(5 * MIN)).toBe(`hace${NB}5${NB}min`);
    expect(agoText(2 * H)).toBe(`hace${NB}2${NB}h`);
    expect(agoText(23 * H + 59 * MIN)).toBe(`hace${NB}23${NB}h`);
  });

  it('"ayer" for the next day, then days', () => {
    expect(agoText(24 * H)).toBe('ayer');
    expect(agoText(47 * H)).toBe('ayer');
    expect(agoText(3 * D)).toBe(`hace${NB}3${NB}d`);
  });

  it('has no breaking space inside, so it never wraps', () => {
    for (const ms of [12 * S, 5 * MIN, 2 * H, 3 * D]) expect(agoText(ms)).not.toMatch(/ /);
  });
});

describe('agoText (en)', () => {
  beforeEach(() => __setLanguageForTests('en'));

  it('reads in English', () => {
    expect(agoText(2 * S)).toBe('now');
    expect(agoText(12 * S)).toBe(`12${NB}s${NB}ago`);
    expect(agoText(5 * MIN)).toBe(`5${NB}min${NB}ago`);
    expect(agoText(2 * H)).toBe(`2${NB}h${NB}ago`);
    expect(agoText(30 * H)).toBe('yesterday');
    expect(agoText(3 * D)).toBe(`3${NB}d${NB}ago`);
  });
});

describe('noBreak', () => {
  it('turns every space into a non-breaking one', () => {
    expect(noBreak('Tanque: 4/12 ≈ 4.5 gal')).toBe(`Tanque:${NB}4/12${NB}≈${NB}4.5${NB}gal`);
  });

  it('a joined status line can only break at the separators', () => {
    const line = ['Tanque: 4/12 ≈ 4.5 gal', '≈ 120 km (70–190)', agoText(0)].map(noBreak).join(' · ');
    const breakable = line.split(' ');
    expect(breakable).toEqual([`Tanque:${NB}4/12${NB}≈${NB}4.5${NB}gal`, '·', `≈${NB}120${NB}km${NB}(70–190)`, '·', 'ahora']);
  });
});
