# Design spec — Car Guy 2.1 "Cluster JDM 90s"

Mockups: Design artifact **"Car Guy — JDM Cluster"** (six artboards: Inicio · Cluster, Garaje,
Álbum · Línea de tiempo, Build · Mods, Pista · Sesión, Tokens JDM). This document is what Claude
Code implements; the artboards are what it compares against. Full research and rationale:
`01-research/01-jdm-design-language.md`.

## Concept

An instrument cluster from a 90s Japanese performance car (R32, Supra MK4, Integra Type R,
AE86/AE85): black matte panel, white condensed numerals, orange needle, a solid red redline wedge,
a strip of telltales that are visibly *there* even when off, and an LCD odometer whose last digit is
orange like the AE86's red tenths drum. Textures belong to trim (carbon on frames and gauge
bezels), never behind text. The one saturated element per screen is amber (action) — red is
reserved for danger and badges, exactly like a Type R badge on a black dash.

Nickname convention: the AE85 is **ハチゴー (hachi-gō)**; the wordmark stays "CAR GUY".

## Tokens (replace `constants/theme.ts` values; keep the `Palette` shape, add the new keys)

### Dark (default)

| Token | Value |
|---|---|
| `bg.base` / `bg.surface` / `bg.raised` | `#121212` / `#1B1B1B` / `#212121` |
| `bg.well` (new — LCD inset) | `#0E0E0E` |
| `line` / `lineStrong` (new) | `rgba(255,255,255,0.09)` / `#2A2A2A` |
| `text.primary` / `secondary` / `muted` / `disabled` (new) | `#EDEDED` / `#B3B3B3` / `#8C8C8C` / `#6E6E6E` |
| `accent` / `accentPressed` / `accentInk` | `#FFB300` / `#FF8F00` / `#121212` |
| `needle` (new) | `#FF5F00` |
| `redline` (new, fills) / `redlineText` (new) | `#E10600` / `#FF4D45` |
| `status.ok / proximo / urgente / vencido` | `#3DDC84` / `#FFB300` / `#FF5F00` / `#E10600` |
| `statusText.vencido` (new) | `#FF4D45` |
| `statusBg.*` | same hue at 16 % (vencido: solid `#E10600` with `#FFFFFF` text) |
| `danger` / `dangerInk` | `#E10600` / `#FFFFFF` (4.97:1) |
| `telltaleOff` (new) | icon `#3F3F3F` on `#161616` |
| `glow.amber` / `glow.red` (new) | `rgba(255,179,0,0.35)` / `rgba(225,6,0,0.45)` |
| `gaugeGradient` (new) | `['#3DDC84' 0, '#FFB300' .55, '#FF5F00' .78, '#FF5F00' .9]` + solid `#E10600` last 10 % |
| `carbonOpacity` (new) | `0.08` |

### Light

`bg.base #F5F4F0`, `surface #FFFFFF`, `raised #EFEFF1`, `well #E6E4DE`, `lineStrong #D9D6CE`, text
`#121212 / #4A4A4A / #616161`, `accent #8F5A00` (as text/ink; amber fills keep `#FFB300` with dark
ink), `accentPressed #6E4500`, `needle #B84300`, `redline #C2000A`, `redlineText #C2000A`, status
`#1F7A3E / #8F5A00 / #B84300 / #C2000A`, `dangerInk #FFFFFF`. Card shadow on. PriceBoard and the
cluster hero stay dark panels in light mode (they are "instruments").

### Category colours (unchanged from v2.0 unless contrast fails): combustible `#22D3EE`,
mantenimiento `#A78BFA`, reparación `#FF4D45`, mejora/mod `#3DDC84`, legal `#60A5FA`, chequeo
`#FFB300`, track `#FF5F00` (new), álbum/hito `#E10600` (new), otros `#9AA4B2`.

## Typography

| Role | Face (`@expo-google-fonts/*`) | Weights | Sizes |
|---|---|---|---|
| Display / screen titles / gauge numerals | **Saira Condensed** (`saira-condensed`) | 400 (tracked labels), 600 (dial numbers, chips), 800 (titles, hero values) | titles 30–34 uppercase; section eyebrows 11 tracked +0.16em uppercase; chips 12–14 tracked +0.08em |
| UI body | **Rajdhani** (`rajdhani`) | 500 body, 600 labels/buttons, 700 card titles | body 14–15 (min 13), line-height 1.35 |
| Data | **JetBrains Mono** (existing) | 500, 700 | odometer 34–48, money 15–18, meta 11–12 |
| Badges / wordmark | **Michroma** (`michroma`) | 400 | 10–13 uppercase tracked +0.12em, one badge per card max |
| Kanji accents | **Noto Sans JP** (`noto-sans-jp`) | 500 | 8–10, `#8C8C8C`, next to the Spanish word |

`components/T.tsx` faces: `display`→SairaCondensed_800, `title`→SairaCondensed_600,
`eyebrow` (new)→SairaCondensed_400 uppercase tracked, `body`→Rajdhani_500, `medium`→Rajdhani_600,
`semibold`→Rajdhani_700, `mono`/`monoBold` unchanged, `badge` (new)→Michroma_400, `kana`
(new)→NotoSansJP_500. Legacy call sites keep compiling.

Digits: Saira Condensed has no `tnum` → the odometer renders each digit in a fixed 0.62em box
(`LcdDigits` component) so columns never shift; JetBrains Mono is tabular by design elsewhere.

## Signature components (build in `components/ui/`, preview all in `app/dev/tokens.tsx`)

1. **`ClusterHero`** (replaces `OdometerHero`): 240° arc (7 → 5 o'clock), track `lineStrong`,
   progress with `gaugeGradient`, solid red wedge for the last 10 %, 6 major + minor ticks, dial
   numerals in Saira 600, tapered `needle` polygon with dark hub + amber ring, centre `LcdDigits`
   odometer (last digit `needle` colour), caption "KM · ODÓMETRO", under it "PRÓX. SERVICIO 1 250 km
   · ~12 oct". Progress = distance consumed toward the nearest due reminder (km-based) or days
   toward the nearest date; wedge = the *urgente* band. Tap → Recordatorios. Launch sweep animation
   (Reanimated `useAnimatedProps`, once per cold start, skipped with reduced motion).
2. **`TelltaleRow`**: 6–8 rounded lamps 36×24 (radius 4) on `bg.surface`; off = `telltaleOff`;
   on = status colour + 6 px radial glow; icons redrawn as 24 px stroke SVG (oil can, coolant,
   tire, battery, brake, document, fuel, wrench, checklist). Vencido blinks ≤ 1 Hz for 10 s.
   Accessible: each lamp has `accessibilityLabel` "Aceite: próximo".
3. **`BoostRing`** (re-skin of `GaugeRing`): 270° ring, 14 px stroke, labels 0/25/50/75/100, "BOOST"
   or "CHEQUEO" label under the hub, `%` readout in Michroma; amber fill only (completion is not
   dangerous); optional red peak-hold needle.
4. **`LcdDigits`**: SVG 7-segment digits with ghost segments at 8 % (the LCD look); fixed 22×36
   boxes; last digit in `needle` colour; used in ClusterHero and the garage total-km card. Digit
   change = 80 ms flicker (authentic), garage total uses a drum roll (staggered translate).
5. **`Badge`**: 20 px pill/rect, `redline` fill, 1 px inner stroke `#FF4D45` at 40 %, Michroma
   10–11 white uppercase; variants amber (dark ink) and green. Content examples: `4AGE 20V`, `DRIFT`,
   `SWAP`, `DAILY`, `PROYECTO`, `EX`, `STOCK`.
6. **`HazardDivider`**: 4 px repeating 45° stripes (amber/black urgente, red/black vencido) — max
   one per screen; also used as the month separator in the album for the current month.
7. **`CarbonFrame`**: wrapper that paints the 2×2 twill pattern at `carbonOpacity` behind its
   children's *frame area only* (card header, gauge bezel, avatar frame) — SVG `Pattern` on web,
   tiled 2× PNG (`assets/images/carbon@2x.png` generated by `tools/make-icons.mjs`) on Android.
8. **`Hanko`**: 40–48 px circle or rounded square, 2 px `redline` stroke, −4° rotation, initial in
   Michroma or one kanji (車/改) in Noto Sans JP 700; used as avatar and as the "registrado" stamp on
   completed maintenance and inspections.
9. **`StatusPill`**: unchanged API, new colours; vencido = solid red with white text; always dot +
   label.
10. **`CornerGrid`** (track): 2×2 car-top-view input for per-corner values (psi, heights), tap a
    corner → numeric keyboard, auto-advance DI→DD→TI→TD; cold→hot pair shows the delta.
11. **`Timeline`** (album/history): vertical 2 px rail with coloured dots per record kind, month
    headers in Saira 800 with the odometer at that time, photo grids 3-up (thumbs), before/after
    pairs labelled ANTES/DESPUÉS.

## Screens (what each artboard shows; details in `02-specs/03-screens.md`)

- **Inicio**: header `CAR GUY 車` + `TABLERO` + hanko avatar; vehicle chips (active = amber, nick in
  katakana, `· PROYECTO` in orange for C3); ClusterHero; TelltaleRow; top-2 pending rows with
  badge + mono countdown; QuickActions 2×2 (GASOLINA · CHEQUEO · BUILD · PISTA) — *Mantenimiento*
  and *Gasto* move into the FAB kind picker and Más; "ESTE MES 記録" strip.
- **Garaje** (new tab, replaces *Chequeo* in the tab bar; Chequeo moves into Inicio's QuickActions
  and Más): filter chips ACTIVOS · PROYECTO · EX; hero card for the active vehicle (cover photo,
  badges, katakana nick, km/mods/vencidos); 2-up cards for the others with a status badge; "EX ·
  LOS QUE YA NO ESTÁN" dashed cards with `2018 → vendido 2021 · 12 fotos` and 記憶.
- **Álbum**: year scrubber, month headers with hazard divider for the current month, timeline
  items (HITO red, MEJORA green, JUNTE amber, MANTENIMIENTO purple…), photo grids and before/after
  pairs, storage meter footer.
- **Build**: header with total invested and count; tabs MODS · SPECS · WISHLIST · INVENTARIO; the
  *STOCK → ACTUAL* mono card; mods grouped by system with per-group subtotal, thumb, badge (SWAP…),
  meta line with vendor and customs, cost, status dot; wishlist rows dashed with AHORRANDO outline
  pill; `+ AGREGAR MOD` full-width amber button.
- **Pista**: event header (venue, date, 走り), 3 stat cards (clima, pista, runs), pressures card
  with CornerGrid and "FRÍO → CALIENTE" pill (rears highlighted red when > +8 psi), change note
  ("Cambiaste desde la sesión 1: TI/TD 40 → 42"), 2×2 detail cards (gomas traseras + ciclo, ángulo/
  LSD, sensación, incidente), day summary, media strip, buttons COPIAR A SESIÓN 3 / COMPARTIR
  RESUMEN.
- **Tokens**: the palette, type, pills, telltales, dividers, carbon, hanko, LCD.

## Icon and splash

Rounded `#121212` tile, faint twill on the lower half, a 240° tach arc (amber fill to ~3 o'clock,
solid red last 40°), orange needle into the red zone, dark hub with amber ring, tiny 7-segment
"085" under the hub (the hachi-gō nod). Monochrome layer: arc + needle silhouette. Splash: mark
centred on `#121212`. Regenerate with `tools/make-icons.mjs`.

## Voice additions (DR car-guy)

- Empty album: "Aquí va la historia del carro. Sube las fotos viejas antes de que se pierdan."
- Ex vehicle card caption: "Ya no está, pero aquí sigue."
- Session feel labels: Subvira · Neutral · Sobrevira · Nervioso · Lento; drift note hint: "¿Cómo
  se sintió de lao'?"
- Mod saved with `spec_effects`: "Ficha actualizada: 3A-U → 4A-GE 20V."
- Wishlist converted: "Instalado. Eso ta' clean."
- Public page enabled: "Link listo. Lo que no marcaste no se ve."

## Anti-patterns (enforced in code review)

Glow on text; texture under text; Orbitron/Teko/Audiowide anywhere; amber + orange + red + green
on one card; redline gradient on non-dangerous metrics; random kanji; skewed cards; chrome bevels;
idle loops; `#E10600` as text on dark; amber text on light.
