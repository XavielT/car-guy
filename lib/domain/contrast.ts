/** WCAG relative luminance and contrast ratio (sRGB). Pure. */

function channel(v: number): number {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** "#RRGGBB" or "#RGB" → luminance 0..1; null when it is not a hex colour (rgba(), names). */
export function luminance(hex: string): number | null {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].split('').map((c) => c + c).join('') : m[1];
  const n = Number.parseInt(h, 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

/** 1..21; null when either colour is not a plain hex. */
export function contrastRatio(a: string, b: string): number | null {
  const la = luminance(a);
  const lb = luminance(b);
  if (la == null || lb == null) return null;
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** WCAG's floor for graphical objects (non-text contrast). */
export const MIN_GRAPHIC_CONTRAST = 3;

/**
 * Does a colour dot need an outline to be seen on these backgrounds? True when it is under 3:1 against any of
 * them — a black swatch on the dark theme (IMP 16102026 X3), a white one on the light theme.
 */
export function needsOutline(fill: string, backgrounds: string[]): boolean {
  return backgrounds.some((bg) => {
    const c = contrastRatio(fill, bg);
    return c != null && c < MIN_GRAPHIC_CONTRAST;
  });
}
