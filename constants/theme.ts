/**
 * Car Guy — "Cluster JDM 90s" (IMP 28092026, ADR-16), on Xaviel's house palette.
 *
 * An instrument cluster from a 90s Japanese performance car: black matte panel,
 * white condensed numerals, an orange needle and a solid red redline wedge.
 * The house amber stays the one saturated action colour; JDM red `#E10600` is
 * for *fills* only (redline, badges, the vencido lamp) — as text on dark it
 * fails AA, so red text is `redlineText` / `statusText.vencido` / `dangerText`
 * (`#FF4D45`, 5.7:1).
 *
 *   --Hub      #FFB300   the signature amber (identical in X AutoHub and the portfolio)
 *   --HubDark  #FF8F00
 *   --primary  #FF5F00   the shared orange — now the needle
 *   --main     #121212   near-black page
 *
 * Values: docs/imp-28092026/00-context/05-design-jdm.md "Tokens". Dark is the
 * default; light follows the system setting. The cluster hero and the price
 * board stay dark panels in light mode — they are instruments.
 */

export type Scheme = 'dark' | 'light';

type StatusSet = { ok: string; proximo: string; urgente: string; vencido: string };

export type Palette = {
  bg: { base: string; surface: string; raised: string; /** LCD inset. */ well: string };
  line: string;
  /** Hairline that has to be seen: gauge tracks, dividers between instruments. */
  lineStrong: string;
  text: { primary: string; secondary: string; muted: string; disabled: string };
  /** Action colour as ink/text (light: the dark amber that passes 4.5:1). */
  accent: string;
  accentPressed: string;
  accentInk: string;
  /** Amber as a *fill* — always #FFB300, with dark ink, in both schemes. */
  accentFill: string;
  accentFillInk: string;
  needle: string;
  /** Red for fills: the redline wedge, badges, the vencido lamp. */
  redline: string;
  /** Red when it is text. */
  redlineText: string;
  status: StatusSet;
  statusBg: StatusSet;
  /** Status as text on the page background — only vencido differs from `status`. */
  statusText: StatusSet;
  danger: string;
  /** Text on a `danger` fill. */
  dangerInk: string;
  /** Danger as text (error lines, destructive labels). */
  dangerText: string;
  /** An unlit telltale: icon on its lamp. */
  telltaleOff: { icon: string; lamp: string };
  glow: { amber: string; red: string };
  /** Arc stops for the cluster; the last 10 % is a solid `redline` wedge. */
  gaugeGradient: { color: string; offset: number }[];
  carbonOpacity: number;
  /** Cards get a shadow in light only; in dark, depth comes from base → surface → raised. */
  cardShadow: boolean;
};

const GAUGE_GRADIENT = [
  { color: '#3DDC84', offset: 0 },
  { color: '#FFB300', offset: 0.55 },
  { color: '#FF5F00', offset: 0.78 },
  { color: '#FF5F00', offset: 0.9 },
];

const dark: Palette = {
  bg: { base: '#121212', surface: '#1B1B1B', raised: '#212121', well: '#0E0E0E' },
  line: 'rgba(255, 255, 255, 0.09)',
  lineStrong: '#2A2A2A',
  text: { primary: '#EDEDED', secondary: '#B3B3B3', muted: '#8C8C8C', disabled: '#6E6E6E' },
  accent: '#FFB300',
  accentPressed: '#FF8F00',
  accentInk: '#121212',
  accentFill: '#FFB300',
  accentFillInk: '#121212',
  needle: '#FF5F00',
  redline: '#E10600',
  redlineText: '#FF4D45',
  // próximo is amber now (it was #FFD166 in v2.0 to keep clear of the accent):
  // on a cluster a lit amber lamp *is* "attention", and every pill carries a label.
  status: { ok: '#3DDC84', proximo: '#FFB300', urgente: '#FF5F00', vencido: '#E10600' },
  statusBg: {
    ok: 'rgba(61, 220, 132, 0.16)',
    proximo: 'rgba(255, 179, 0, 0.16)',
    urgente: 'rgba(255, 95, 0, 0.16)',
    vencido: 'rgba(225, 6, 0, 0.16)',
  },
  statusText: { ok: '#3DDC84', proximo: '#FFB300', urgente: '#FF5F00', vencido: '#FF4D45' },
  danger: '#E10600',
  dangerInk: '#FFFFFF', // 4.97:1
  dangerText: '#FF4D45',
  telltaleOff: { icon: '#3F3F3F', lamp: '#161616' },
  glow: { amber: 'rgba(255, 179, 0, 0.35)', red: 'rgba(225, 6, 0, 0.45)' },
  gaugeGradient: GAUGE_GRADIENT,
  carbonOpacity: 0.08,
  cardShadow: false,
};

const light: Palette = {
  bg: { base: '#F5F4F0', surface: '#FFFFFF', raised: '#EFEFF1', well: '#E6E4DE' },
  line: 'rgba(18, 18, 18, 0.10)',
  lineStrong: '#D9D6CE',
  text: { primary: '#121212', secondary: '#4A4A4A', muted: '#616161', disabled: '#9A9A9A' },
  // #FFB300 on white is ~1.9:1 — never text. Ink is the dark amber; fills keep
  // the house amber with dark ink (accentFill).
  accent: '#8F5A00',
  accentPressed: '#6E4500',
  accentInk: '#FFFFFF',
  accentFill: '#FFB300',
  accentFillInk: '#121212',
  needle: '#B84300',
  redline: '#C2000A',
  redlineText: '#C2000A',
  status: { ok: '#1F7A3E', proximo: '#8F5A00', urgente: '#B84300', vencido: '#C2000A' },
  statusBg: {
    ok: 'rgba(31, 122, 62, 0.12)',
    proximo: 'rgba(143, 90, 0, 0.12)',
    urgente: 'rgba(184, 67, 0, 0.12)',
    vencido: 'rgba(194, 0, 10, 0.12)',
  },
  statusText: { ok: '#1F7A3E', proximo: '#8F5A00', urgente: '#B84300', vencido: '#C2000A' },
  danger: '#C2000A',
  dangerInk: '#FFFFFF',
  dangerText: '#C2000A',
  // Instruments stay dark panels in light mode, lamps included.
  telltaleOff: { icon: '#3F3F3F', lamp: '#161616' },
  glow: { amber: 'rgba(255, 179, 0, 0.35)', red: 'rgba(225, 6, 0, 0.45)' },
  gaugeGradient: GAUGE_GRADIENT,
  carbonOpacity: 0.06,
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
  combustible: '#22D3EE',
  mantenimiento: '#A78BFA',
  reparacion: '#FF4D45',
  mejora: '#3DDC84',
  legal: '#60A5FA',
  inspeccion: '#FFB300',
  track: '#FF5F00',
  album: '#E10600',
  otros: '#9AA4B2',
} as const;

export type CategoryKey = keyof typeof categoryColors;

/**
 * The category colours as an icon ink on a light surface.
 *
 * The bright hues read well on dark, but on white each one sits on a 16 % tint
 * of itself and falls under the 3:1 a graphic needs. These are the same hues
 * darkened only as far as ~3.5:1 against that tint (computed, not eyeballed),
 * so a fuel row is still cyan and a repair still red.
 */
export const categoryInkLight: Record<CategoryKey, string> = {
  combustible: '#168B9D',
  mantenimiento: '#866FC8',
  reparacion: '#DB423B',
  mejora: '#289157',
  legal: '#4B81C3',
  inspeccion: '#A87600',
  track: '#D14E00',
  album: '#E10600',
  otros: '#78808B',
};

/**
 * Type (ADR-16): Saira Condensed for display and gauge numerals, Rajdhani for
 * UI, JetBrains Mono for every number that must line up, Michroma for the
 * wordmark and badges, Noto Sans JP for the few kanji accents.
 *
 * Saira Condensed has no tabular figures — never use it for a money column;
 * the odometer draws its own fixed-width digits (LcdDigits).
 *
 * Every family named here must also be passed to useFonts in app/_layout.tsx:
 * a missing weight falls back to the system font on web with no warning.
 */
export const fonts = {
  display: 'SairaCondensed_800ExtraBold',
  title: 'SairaCondensed_600SemiBold',
  eyebrow: 'SairaCondensed_400Regular',
  body: 'Rajdhani_500Medium',
  medium: 'Rajdhani_600SemiBold',
  semibold: 'Rajdhani_700Bold',
  mono: 'JetBrainsMono_500Medium',
  monoBold: 'JetBrainsMono_700Bold',
  badge: 'Michroma_400Regular',
  kana: 'NotoSansJP_500Medium',
  kanaBold: 'NotoSansJP_700Bold',
};

/**
 * Card 16 / button 12 (JDM: tighter, more technical). `chip` stays a pill for
 * filters; `tag` is the rounded-rect "technical" chip the spec draws.
 */
export const radius = {
  card: 16,
  input: 12,
  button: 12,
  chip: 999,
  tag: 6,
  lamp: 4,
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
