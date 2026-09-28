import { palette } from '@/constants/theme';
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
