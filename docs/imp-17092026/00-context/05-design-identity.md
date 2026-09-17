# Design identity — Car Guy · "Tablero nocturno"

Xaviel asked for a redesign and for me to propose it (D5). This is the proposal; PROMPT-01 turns it
into tokens, PROMPT-03/04/05/07 build new screens with it, PROMPT-06 restyles the legacy fuel
screens. If something here is impossible in RN/RN-web, the prompt picks the nearest equivalent and
reports it.

## Concept

Tu Combustible RD was a **gas-station price board at dusk** — cream receipt paper, amber LED digits.
That identity is about *buying fuel*. Car Guy is about *taking care of the car*, and the place
where a driver reads the car's state is the **instrument cluster at night**: a dark panel, crisp
white numbers, and telltale lights that are green when everything is fine and amber/red when
something needs attention. That is exactly the app's job — turn "I forgot to check the coolant"
into a lit telltale you cannot miss.

So: **dark by default**, numbers in a monospaced face like an odometer, a single cool accent
(cyan) for actions, and a disciplined **four-state status colour system** that means the same thing
on every screen (reminders, inspections, history, documents). Light mode exists and follows the
system setting, but dark is the identity.

Name usage: **Car Guy** (two words, capital C and G). Tagline for the manifest/description:
*"Tu carro, al día."*

## Palette

### Dark (default)

| Token | Hex | Use |
|---|---|---|
| `bg.base` | `#0E1116` | Screen background ("asfalto") |
| `bg.surface` | `#161B22` | Cards, tab bar, sheets |
| `bg.raised` | `#1E252E` | Inputs, chips, secondary surfaces |
| `line` | `rgba(255,255,255,0.08)` | Hairlines, card borders |
| `text.primary` | `#F3F5F7` | Titles, values |
| `text.secondary` | `#9AA4B2` | Labels, captions |
| `text.muted` | `#6B7683` | Placeholders, disabled |
| `accent` | `#22D3EE` | Primary buttons, active tab, links, focus ring, the odometer needle |
| `accent.pressed` | `#0FB5CF` | Pressed state |
| `accent.ink` | `#062A31` | Text on accent |
| `status.ok` | `#34D399` | "Al día" |
| `status.proximo` | `#FBBF24` | Due soon |
| `status.urgente` | `#FB923C` | ≤ 7 days / ≤ 100 km |
| `status.vencido` | `#F87171` | Overdue / failed inspection item |
| `status.*Bg` | same hue at 16 % alpha | Chip and banner backgrounds |
| `danger` | `#F87171` | Destructive actions (same as vencido on purpose) |

### Light

| Token | Hex |
|---|---|
| `bg.base` `#F5F7FA` · `bg.surface` `#FFFFFF` · `bg.raised` `#EEF1F5` · `line` `rgba(15,23,42,0.10)` |
| `text.primary` `#0F172A` · `text.secondary` `#475569` · `text.muted` `#94A3B8` |
| `accent` `#0891B2` · `accent.pressed` `#0E7490` · `accent.ink` `#FFFFFF` |
| `status.ok` `#059669` · `status.proximo` `#D97706` · `status.urgente` `#EA580C` · `status.vencido` `#DC2626` (bg variants at 12 % alpha) |

### Category colours (charts, history icons — same in both schemes, adjust lightness ±10 % if contrast fails)

| Category | Hex |
|---|---|
| Combustible | `#22D3EE` |
| Mantenimiento | `#A78BFA` |
| Reparación | `#F87171` |
| Mejora | `#34D399` |
| Seguro / marbete / legal | `#60A5FA` |
| Inspección | `#FBBF24` |
| Otros gastos | `#9AA4B2` |

Contrast rule: body text ≥ 4.5:1 on its surface, status text on its `*Bg` ≥ 4.5:1, accent button
label uses `accent.ink`. Verify the light scheme's accent on white (4.5:1) — `#0891B2` passes;
do not lighten it.

## Typography

| Role | Family (Google Fonts via `@expo-google-fonts/*`) | Weights | Where |
|---|---|---|---|
| Display / titles | **Space Grotesk** | 700, 500 | Screen titles (28–34), section titles (20–22), card titles (16–17) |
| UI / body | **Inter** | 400, 500, 600 | Everything else; 15–16 body, 13 captions, 11–12 uppercase eyebrows with +0.08em tracking |
| Numbers | **JetBrains Mono** | 500, 700 | Odometer, money, km/gal, dates in lists, countdowns ("faltan 320 km") — tabular figures so columns align |

Packages: `@expo-google-fonts/space-grotesk`, `@expo-google-fonts/inter`,
`@expo-google-fonts/jetbrains-mono`. Remove Syne/Figtree/IBM Plex Mono once no screen references
them (PROMPT-06). Update `components/T.tsx` faces: `display | title | body | medium | semibold |
mono | monoBold` — same API, new families, so legacy screens keep compiling.

## Shape, spacing, elevation

- Radius: cards 20, inputs/buttons 14, chips 999, sheets 24 (top corners).
- Spacing scale: 4 · 8 · 12 · 16 · 20 · 24 · 32. Screen gutter 20 (unchanged).
- Dark: **no shadows**; depth comes from `bg.base → surface → raised` and 1 px `line`.
  Light: subtle shadow on cards (`0 1 2 rgba(15,23,42,0.06)`).
- Tab bar: `bg.surface`, top hairline, active `accent`, inactive `text.muted`, labels Inter 600 11.

## Signature components (build once in `components/ui/`)

1. **`OdometerHero`** — the home hero. Active vehicle name (Space Grotesk 500, secondary colour),
   the **current odometer** in JetBrains Mono 700 at 44–48 px with thin separators every three
   digits, the unit "km" small, and under it a **telltale row**: up to 4 status pills summarising
   what is due ("Aceite · 320 km", "Marbete · 18 ene", "Chequeo semanal · hoy"). If nothing is due:
   one green pill "Todo al día". Tap → Recordatorios. This replaces the PriceBoard as the hero;
   the MICM board moves to the Combustible section (still available).
2. **`StatusPill`** — dot + label, colour from `status.*`; the *only* way status is shown anywhere.
3. **`GaugeRing`** — `react-native-svg` arc (270°) used for inspection completion and the streak
   ("3 semanas seguidas"); needle/arc in `accent`, track in `line`.
4. **`RecordRow`** — one row for every history kind: leading category icon in its category colour
   on a 16 % tint circle, title, meta line (date · km · shop), trailing amount in mono.
5. **`QuickActions`** — 2×2 grid of large buttons on Inicio: *Combustible*, *Chequeo*,
   *Mantenimiento*, *Gasto*. Accent icon, surface background. (Complaint from research: "no plus
   button on the home screen" — this is the fix.)
6. **`EmptyState`** — icon, one sentence, one CTA. Copy in the tone below.
7. **`Sheet`** — bottom sheet for quick add flows (plain `Modal` + animated translate; no new dep).

Icons: `@expo/vector-icons` **Ionicons** (already installed). Speedometer for Inicio, flash for
Combustible, clipboard-check for Chequeo, construct for Mantenimiento, time for Historial,
stats-chart for Estadísticas, ellipsis for Más.

## App icon and splash

Rounded dark tile `#0E1116`. A **gauge arc** (270°, stroke in `#22D3EE`, ends rounded) with a
**needle** pointing to ~2 o'clock and a small **green dot** (`#34D399`) at the needle's tip — a
cluster that says "OK". No letters. Monochrome variant: arc + needle in one colour. Maskable variant
keeps everything inside the 80 % safe zone. Splash: same mark centred, background `#0E1116`.
Sources as SVG in `assets/pwa/` and generated with the existing `tools/make-icons.mjs` (update its
colours and shapes; keep the 0.78 foreground scale — see `docs/NEXT.md`).

Web: `theme-color` `#0E1116`, `+html.tsx` body background `#0E1116` (it must match the default
scheme to avoid the flash), `apple-mobile-web-app-status-bar-style` `black-translucent`.

## Motion and feedback

- `expo-haptics` light impact on save, medium on "Marcar hecho", success notification on completing
  an inspection. Never on web (guard).
- Transitions: default stack/tab transitions; one custom animation only — the GaugeRing filling on
  inspection completion (Reanimated is already installed).

## Voice

Second person, direct, DR Spanish, no exclamation marks except on the one celebratory line after a
completed inspection. Say what the number means. Examples:

- Home telltale: "Aceite · faltan 320 km" · "Marbete · vence 31 ene" · "Chequeo semanal · hoy"
- Empty history: "Aquí va quedando la vida de tu carro. Empieza con una carga o un chequeo."
- Coolant item help: "Revisa el refrigerante solo con el motor frío. Nunca abras el tapón del
  radiador caliente."
- Failed item: "Marcaste *Refrigerante* como falla. ¿Creamos una tarea para resolverlo?"
- Streak: "3 semanas seguidas con chequeo. Así se cuida un carro."
- Account card: "Sin cuenta la app funciona igual. Con cuenta, si cambias de teléfono, tus datos te
  siguen."

## What stays from the old identity

- The information density and the "explain the number" captions ("Necesitas dos tanques llenos").
- The PriceBoard component, restyled with the new tokens (dark panel, mono digits in
  `text.primary`, accent eyebrow), living in the Combustible section.
- `T`, `Field`, `Card`, `Chip`, `PrimaryButton`, `GhostButton` APIs — restyled, not renamed, so the
  migration of legacy screens is mechanical.
