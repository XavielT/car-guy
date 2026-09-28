import { categoryColors, categoryInkLight, palette } from '@/constants/theme';
import { contrast, textPairs } from '@/lib/theme/contrast';

describe('contrast()', () => {
  it('matches known WCAG values', () => {
    expect(contrast('#FFFFFF', '#000000')).toBeCloseTo(21, 0);
    expect(contrast('#FF4D45', '#121212')).toBeGreaterThan(5.5);
    // The reason red text has its own token: #E10600 on the panel fails.
    expect(contrast('#E10600', '#121212')).toBeLessThan(4.5);
  });
});

for (const scheme of ['dark', 'light'] as const) {
  describe(`${scheme}: every text pair on the tokens page is ≥ 4.5:1`, () => {
    for (const pair of textPairs(palette[scheme])) {
      it(pair.name, () => {
        expect(contrast(pair.fg, pair.bg, pair.under)).toBeGreaterThanOrEqual(4.5);
      });
    }
  });
}

// Phase 2: chart marks and the category icons on Historial rows are graphics,
// held to 3:1 (WCAG 1.4.11) against the card they sit on — bright tokens on
// dark, the computed inks on light.
describe('category marks are ≥ 3:1 on their card', () => {
  for (const key of Object.keys(categoryColors) as (keyof typeof categoryColors)[]) {
    it(`dark ${key}`, () => expect(contrast(categoryColors[key], palette.dark.bg.surface)).toBeGreaterThanOrEqual(3));
    it(`light ${key}`, () => expect(contrast(categoryInkLight[key], palette.light.bg.surface)).toBeGreaterThanOrEqual(3));
  }
});

// `PRINT_CONTRAST=1 npx jest __tests__/theme/contrast.test.ts` prints the list for the phase report.
if (process.env.PRINT_CONTRAST) {
  it('prints the lowest pairs', () => {
    for (const scheme of ['dark', 'light'] as const) {
      const rows = textPairs(palette[scheme])
        .map((p) => ({ name: p.name, ratio: contrast(p.fg, p.bg, p.under) }))
        .sort((a, b) => a.ratio - b.ratio)
        .slice(0, 8);
      const marks = (Object.keys(categoryColors) as (keyof typeof categoryColors)[])
        .map((k) => ({ name: `mark ${k}`, ratio: contrast(scheme === 'dark' ? categoryColors[k] : categoryInkLight[k], palette[scheme].bg.surface) }))
        .sort((a, b) => a.ratio - b.ratio)
        .slice(0, 3);
      console.log(scheme, [...rows, ...marks].map((r) => `${r.name} ${r.ratio.toFixed(2)}`).join(' | '));
    }
  });
}
