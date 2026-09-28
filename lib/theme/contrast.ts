import type { Palette } from '@/constants/theme';

/**
 * WCAG 2.x contrast, and the list of text/background pairs the identity uses.
 * The dev tokens page renders the list; __tests__/theme/contrast.test.ts holds
 * every pair to 4.5:1 in both schemes. Translucent backgrounds (the 16 % status
 * tints) are composited over the surface they sit on before measuring.
 */
const rgb = (hex: string): [number, number, number] => {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
};

function parse(color: string): { rgb: [number, number, number]; alpha: number } {
  const m = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)/);
  if (m) return { rgb: [+m[1], +m[2], +m[3]], alpha: m[4] == null ? 1 : +m[4] };
  return { rgb: rgb(color), alpha: 1 };
}

/** `top` over `bottom`, both CSS colours; the result is opaque. */
export function composite(top: string, bottom: string): [number, number, number] {
  const t = parse(top);
  const b = parse(bottom).rgb;
  return t.rgb.map((c, i) => Math.round(c * t.alpha + b[i] * (1 - t.alpha))) as [number, number, number];
}

function luminance([r, g, b]: [number, number, number]): number {
  const f = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

export function contrast(fg: string, bg: string, under = '#000000'): number {
  const back = composite(bg, under);
  const front = composite(fg, `rgb(${back.join(',')})`);
  const [hi, lo] = [luminance(front), luminance(back)].sort((a, b) => b - a);
  return (hi + 0.05) / (lo + 0.05);
}

export type Pair = { name: string; fg: string; bg: string; under?: string };

/** Every text-on-background pair the tokens page shows. Disabled text is exempt (WCAG 1.4.3). */
export function textPairs(t: Palette): Pair[] {
  const pairs: Pair[] = [];
  const grounds = { base: t.bg.base, surface: t.bg.surface, raised: t.bg.raised };
  for (const [g, bg] of Object.entries(grounds)) {
    pairs.push({ name: `text.primary / ${g}`, fg: t.text.primary, bg });
    pairs.push({ name: `text.secondary / ${g}`, fg: t.text.secondary, bg });
    pairs.push({ name: `text.muted / ${g}`, fg: t.text.muted, bg });
    pairs.push({ name: `accent (ink) / ${g}`, fg: t.accent, bg });
    pairs.push({ name: `redlineText / ${g}`, fg: t.redlineText, bg });
    pairs.push({ name: `dangerText / ${g}`, fg: t.dangerText, bg });
  }
  for (const s of ['ok', 'proximo', 'urgente', 'vencido'] as const) {
    pairs.push({ name: `statusText.${s} / surface`, fg: t.statusText[s], bg: t.bg.surface });
    if (s !== 'vencido') {
      pairs.push({ name: `pill ${s}: statusText / statusBg on surface`, fg: t.statusText[s], bg: t.statusBg[s], under: t.bg.surface });
    }
  }
  pairs.push({ name: 'pill vencido: white / redline', fg: '#FFFFFF', bg: t.redline });
  pairs.push({ name: 'badge: white / redline', fg: '#FFFFFF', bg: t.redline });
  pairs.push({ name: 'button: accentFillInk / accentFill', fg: t.accentFillInk, bg: t.accentFill });
  pairs.push({ name: 'accentInk / accent', fg: t.accentInk, bg: t.accent });
  pairs.push({ name: 'dangerInk / danger', fg: t.dangerInk, bg: t.danger });
  return pairs;
}
