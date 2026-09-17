/**
 * Car Guy — "Tablero nocturno".
 *
 * The identity is an instrument cluster at night: dark panel, crisp numbers in a
 * monospaced face, one cool accent for actions, and four status colours that mean
 * the same thing on every screen. See docs/imp-17092026/00-context/05-design-identity.md.
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
  /** Cards get a shadow in light only; in dark, depth comes from base → surface → raised. */
  cardShadow: boolean;
};

const dark: Palette = {
  bg: { base: '#0E1116', surface: '#161B22', raised: '#1E252E' },
  line: 'rgba(255, 255, 255, 0.08)',
  text: { primary: '#F3F5F7', secondary: '#9AA4B2', muted: '#6B7683' },
  accent: '#22D3EE',
  accentPressed: '#0FB5CF',
  accentInk: '#062A31',
  status: { ok: '#34D399', proximo: '#FBBF24', urgente: '#FB923C', vencido: '#F87171' },
  statusBg: {
    ok: 'rgba(52, 211, 153, 0.16)',
    proximo: 'rgba(251, 191, 36, 0.16)',
    urgente: 'rgba(251, 146, 60, 0.16)',
    vencido: 'rgba(248, 113, 113, 0.16)',
  },
  danger: '#F87171',
  cardShadow: false,
};

const light: Palette = {
  bg: { base: '#F5F7FA', surface: '#FFFFFF', raised: '#EEF1F5' },
  line: 'rgba(15, 23, 42, 0.10)',
  text: { primary: '#0F172A', secondary: '#475569', muted: '#94A3B8' },
  accent: '#0891B2',
  accentPressed: '#0E7490',
  accentInk: '#FFFFFF',
  status: { ok: '#059669', proximo: '#D97706', urgente: '#EA580C', vencido: '#DC2626' },
  statusBg: {
    ok: 'rgba(5, 150, 105, 0.12)',
    proximo: 'rgba(217, 119, 6, 0.12)',
    urgente: 'rgba(234, 88, 12, 0.12)',
    vencido: 'rgba(220, 38, 38, 0.12)',
  },
  danger: '#DC2626',
  cardShadow: true,
};

export const palette: Record<Scheme, Palette> = { dark, light };

/** Charts and history icons. Same in both schemes. */
export const categoryColors = {
  combustible: '#22D3EE',
  mantenimiento: '#A78BFA',
  reparacion: '#F87171',
  mejora: '#34D399',
  legal: '#60A5FA',
  inspeccion: '#FBBF24',
  otros: '#9AA4B2',
} as const;

export type CategoryKey = keyof typeof categoryColors;

/**
 * Space Grotesk for titles, Inter for UI, JetBrains Mono for every number so
 * columns line up. `bold` is a compatibility face for the legacy screens — it
 * resolves to Inter 600, the heaviest UI weight the identity uses. PROMPT-06
 * drops it.
 *
 * Every family named here must also be passed to useFonts in app/_layout.tsx:
 * a missing weight falls back to the system font on web with no warning.
 */
export const fonts = {
  display: 'SpaceGrotesk_700Bold',
  title: 'SpaceGrotesk_500Medium',
  body: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_600SemiBold',
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

/**
 * Compatibility alias for the screens written against Tu Combustible RD's token
 * names. Mapping them onto the dark palette makes every legacy screen compile
 * and go dark at once, without touching it. PROMPT-06 restyles those screens
 * properly and deletes this.
 *
 * It is deliberately flat and static: legacy screens read it at module scope, so
 * it cannot follow the active scheme. New code uses useTheme() instead.
 */
export const colors = {
  canopy: dark.bg.base,
  canopyLift: dark.bg.raised,
  ink: dark.text.primary,
  muted: dark.text.secondary,
  receipt: dark.bg.surface,
  receiptDeep: dark.bg.raised,
  led: dark.accent,
  ledDim: dark.accentPressed,
  nozzle: dark.accent,
  teal: dark.status.ok,
  line: dark.line,
  white: dark.bg.raised,
  danger: dark.status.vencido,
};
