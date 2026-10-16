/**
 * The "Negro" swatch was invisible on the dark form (IMP 16102026 X3): #111 on #121212. Every swatch of the colour
 * list must read ≥ 3:1 against the screen in both themes — by its own colour or by its outline — and so must the
 * ring of the selected one.
 */
import { palette } from '@/constants/theme';
import { contrastRatio, luminance, MIN_GRAPHIC_CONTRAST, needsOutline } from '@/lib/domain/contrast';
import colors from '@/lib/domain/refdata/colors.json';

const swatches = (colors.items as { id: string; kind: string; hex?: string | null }[]).filter((c) => c.hex);

describe('contrast maths', () => {
  it('black on white is 21:1 and a colour on itself 1:1', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrastRatio('#336699', '#336699')).toBeCloseTo(1, 5);
  });

  it('understands #RGB and rejects anything that is not a plain hex', () => {
    expect(luminance('#fff')).toBeCloseTo(1, 5);
    expect(luminance('rgba(0,0,0,0.5)')).toBeNull();
    expect(needsOutline('', ['#121212'])).toBe(false);
  });
});

describe.each(['dark', 'light'] as const)('every colour swatch on the %s theme', (scheme) => {
  const theme = palette[scheme];
  const screens = [theme.bg.base, theme.bg.surface, theme.bg.raised];

  it('is seen: its own colour is ≥ 3:1, or it gets an outline that is', () => {
    for (const s of swatches) {
      const fillOk = screens.every((bg) => (contrastRatio(s.hex!, bg) ?? 99) >= MIN_GRAPHIC_CONTRAST);
      const ringOk = screens.every((bg) => (contrastRatio(theme.text.muted, bg) ?? 0) >= MIN_GRAPHIC_CONTRAST);
      expect([s.id, fillOk || (needsOutline(s.hex!, screens) && ringOk)]).toEqual([s.id, true]);
    }
  });

  it('the selected ring (accent) is ≥ 3:1 too', () => {
    for (const bg of screens) expect(contrastRatio(theme.accent, bg)).toBeGreaterThanOrEqual(MIN_GRAPHIC_CONTRAST);
  });
});

it('Negro (exterior and interior) needs its outline on the dark theme', () => {
  const dark = palette.dark;
  for (const id of ['negro', 'interior-negro']) {
    const hex = swatches.find((s) => s.id === id)!.hex!;
    expect(needsOutline(hex, [dark.bg.base, dark.bg.surface, dark.bg.raised])).toBe(true);
  }
});
