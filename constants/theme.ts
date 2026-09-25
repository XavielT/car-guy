/**
 * Car Guy — "Tablero nocturno", on Xaviel's house palette.
 *
 * The identity is an instrument cluster at night: dark panel, crisp numbers in a
 * monospaced face, one accent for actions, and four status colours that mean the
 * same thing on every screen.
 *
 * The colours are the ones Music Hub, X AutoHub and xaviel-web already share, so
 * Car Guy reads as part of the same family rather than a stranger:
 *
 *   --Hub      #FFB300   the signature amber (identical in X AutoHub and the portfolio)
 *   --HubDark  #FF8F00
 *   --primary  #FF5F00   the shared orange
 *   --main     #121212   near-black page
 *   --secondary#212121   raised surface
 *   --text-strong/soft   #FFFFFF / #B8B8B8
 *
 * Dark is the default; light follows the system setting.
 */

export type Scheme = 'dark' | 'light';

export type Palette = {
  bg: { base: string; surface: string; raised: string };
  line: string;
  text: { primary: string; secondary: string; muted: string };
  accent: string;
  accentPressed: string;
  accentInk: string;
  status: { ok: string; proximo: string; urgente: string; vencido: string };
  statusBg: { ok: string; proximo: string; urgente: string; vencido: string };
  danger: string;
  /** Text on a `danger` fill — dark on the dark scheme's bright red, white on the light one's deep red. */
  dangerInk: string;
  /** Cards get a shadow in light only; in dark, depth comes from base → surface → raised. */
  cardShadow: boolean;
};

const dark: Palette = {
  bg: { base: '#121212', surface: '#1B1B1B', raised: '#212121' },
  line: 'rgba(255, 255, 255, 0.09)',
  text: { primary: '#FFFFFF', secondary: '#B8B8B8', muted: '#929090' },
  accent: '#FFB300',
  accentPressed: '#FF8F00',
  accentInk: '#121212',
  // The accent is amber, so "próximo" cannot also be amber or a warning becomes
  // indistinguishable from a button. The ladder runs green → pale yellow →
  // the house orange → red, and every pill carries a dot *and* a label.
  status: { ok: '#34D399', proximo: '#FFD166', urgente: '#FF5F00', vencido: '#F0483E' },
  statusBg: {
    ok: 'rgba(52, 211, 153, 0.16)',
    proximo: 'rgba(255, 209, 102, 0.16)',
    urgente: 'rgba(255, 95, 0, 0.18)',
    vencido: 'rgba(240, 72, 62, 0.18)',
  },
  danger: '#F0483E',
  dangerInk: '#121212', // 5.09:1 (white would be 3.68)
  cardShadow: false,
};

const light: Palette = {
  bg: { base: '#F7F7F8', surface: '#FFFFFF', raised: '#EFEFF1' },
  line: 'rgba(18, 18, 18, 0.10)',
  text: { primary: '#121212', secondary: '#4A4A4A', muted: '#8A8A8A' },
  // #FFB300 on white is about 1.9:1 — unreadable as text or as a button label
  // background. Light mode uses the house palette's --primary-dark instead,
  // which is the same hue family and passes 4.5:1.
  accent: '#CF4C00',
  accentPressed: '#A63C00',
  accentInk: '#FFFFFF',
  status: { ok: '#047857', proximo: '#B45309', urgente: '#C2410C', vencido: '#B91C1C' },
  statusBg: {
    ok: 'rgba(4, 120, 87, 0.12)',
    proximo: 'rgba(180, 83, 9, 0.12)',
    urgente: 'rgba(194, 65, 12, 0.12)',
    vencido: 'rgba(185, 28, 28, 0.12)',
  },
  danger: '#B91C1C',
  dangerInk: '#FFFFFF', // 6.47:1
  cardShadow: true,
};

export const palette: Record<Scheme, Palette> = { dark, light };

/**
 * Charts and history icons. Same in both schemes.
 *
 * Anchored on the brand amber for fuel — the category Car Guy grew out of — and
 * then spread far enough apart in hue to stay legible side by side in a chart,
 * which is a functional requirement rather than a brand one.
 */
export const categoryColors = {
  combustible: '#FFB300',
  mantenimiento: '#7C9EFF',
  reparacion: '#F0483E',
  mejora: '#34D399',
  legal: '#B58AFF',
  inspeccion: '#FF8C5C',
  otros: '#929090',
} as const;

export type CategoryKey = keyof typeof categoryColors;

/**
 * The category colours as an icon ink on a light surface.
 *
 * The bright hues read well on dark, but on white each one sits on a 16 % tint
 * of itself and falls to 1.6–2.7:1 — under the 3:1 a graphic needs. These are
 * the same hues darkened only as far as ~3.5:1 against that tint, so a fuel row
 * is still amber and a repair still red.
 */
export const categoryInkLight: Record<CategoryKey, string> = {
  combustible: '#AB7800',
  mantenimiento: '#617BC7',
  reparacion: '#DA4238',
  mejora: '#238F68',
  legal: '#8F6DC9',
  inspeccion: '#BD6844',
  otros: '#7F7D7D',
};

/**
 * Space Grotesk for titles and Manrope for UI — the same pairing X AutoHub uses —
 * and JetBrains Mono for every number so columns line up.
 *
 * The `bold` compatibility face that stood in for Tu Combustible RD's heaviest
 * weight is gone with PROMPT-06: `semibold` is the heaviest UI weight the
 * identity actually uses, and two names for one file invited the wrong one.
 *
 * Every family named here must also be passed to useFonts in app/_layout.tsx:
 * a missing weight falls back to the system font on web with no warning.
 */
export const fonts = {
  display: 'SpaceGrotesk_700Bold',
  title: 'SpaceGrotesk_500Medium',
  body: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  // JetBrains Mono stays: the odometer, money and km/gal are tabular figures, and
  // proportional digits make those columns shift as the numbers change. It is the
  // one face Car Guy needs that the other projects have no use for.
  mono: 'JetBrainsMono_500Medium',
  monoBold: 'JetBrainsMono_700Bold',
};

export const radius = {
  card: 20,
  input: 14,
  button: 14,
  chip: 999,
  sheet: 24,
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  /** Screen gutter, unchanged from Tu Combustible RD. */
  gutter: 20,
} as const;
