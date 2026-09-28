# Research 1 — "Cluster JDM 90s" design language for Car Guy

*2026-09-28. Method: web search was disabled for the org and the proxy blocked wikipedia/fonts.google;
verified live: every `@expo-google-fonts/*` package on npm (versions, weight exports), the TTF
glyph coverage/digit widths/`tnum`, the DSEG repo, and all contrast ratios (computed per WCAG 2.1).
Cluster descriptions in §1 are from knowledge; URLs are for verification.*

## 1. Visual references

**Nissan Skyline GT-R R32/R33/R34.** Black dial faces, tachometer centred and dominant, speedo left,
small oil/water dials. Numerals: medium-weight grotesque sans, slightly condensed, white; 1 000-rpm
majors and fine minors. Redline: a **solid red wedge from ~8 000 rpm**, outside the tick ring.
Needles orange-red, slim, tapered, dark hub; night illumination warm white/amber. JDM speedos top
at 180 km/h. R34 MFD: low-res raster LCD with boost/oil temp/G in green/amber bar graphs — the
"TURBO/BOOST" data-screen look is dot-matrix, not 7-segment.

**Toyota Supra MK4 (JZA80).** Driver-wrapped cockpit; gauges in deep binnacles, matte black bezels;
white geometric numerals; orange needles; red arc ~6 800–7 000. The Eurostile feel comes from
badges/80s digital dashes, not the analog dials → square face for wordmarks/labels only.

**Toyota AE86 / AE85.** Rectangular upright binnacle, two big dials + small fuel/temp, **a row of
rectangular telltales across the top**, "km/h" small under the numerals, 180 scale, red zone
(4A-GE ~7 700; the AE85's 3A-U tach is modest — the *hachi-gō* is the humble sibling). Needles
orange with black hub; mechanical drum odometer with **the tenths drum in red** — stolen for the
LCD odometer's last digit.

**Honda NSX / Integra Type R.** Cleanest: thin white numerals, hairline ticks, **red needles on the
Type R**, red zone from 8 000/8 400, the red badge as the only saturated element. Red on black plus
Championship White; restraint everywhere else.

**Nissan Silvia S13/S14/S15.** Simpler two-dial clusters, 180 km/h, tach to 9 000, orange needles.
Aftermarket boost pods (Defi/HKS/GReddy): black face, white scale −1.0 to +2.0, "BOOST"/"TURBO"
label under the pivot, amber/white illumination, red peak-hold needle → model for ring gauges.

**Telltales (ISO 2575, 90s execution):** rectangular/round lamps in a strip; red = brake, oil,
battery, coolant temp, seatbelt; amber = check-engine, ABS, 4WD; green = turn; blue = high beam.
Off state is a visible dark-grey ghost.

**Textures:** clusters are matte black plastic with fine grain, **not** carbon. Carbon twill and
brushed aluminium belong to trim (shift surround, gauge pods, badges). Rule: texture on frames
only, never behind numbers.

## 2. Typography (Google Fonts, `@expo-google-fonts/*` verified 2026-09-28)

| Family | pkg / ver | Weights | Digits | Verdict |
|---|---|---|---|---|
| **Saira Condensed** | `saira-condensed` 0.4.1 | 100–900 | proportional, no `tnum` | **Display/gauge numerals** — closest free match to Nissan/Toyota dial numerals |
| Saira Extra Condensed | 0.4.2 | 100–900 | prop. | tick labels ≥ 10 px only |
| Barlow Condensed | 0.4.1 | 100–900 + it | **has `tnum`** | runner-up display |
| **Rajdhani** | `rajdhani` 0.4.1 | 300–700 | prop. | **UI body** — squared sans, tall x-height, legible at 13–14 px |
| Chakra Petch | 0.4.1 | 300–700 | prop. | noisier in Spanish paragraphs |
| Teko | 0.4.1 | 300–700 | prop. | big numbers only |
| Oxanium | 0.4.2 | 200–800 | mono digits | "MFD" tables |
| Orbitron | 0.4.2 | 400–900 | prop. | wordmark only |
| **Michroma** | `michroma` 0.4.2 | 400 | near-tabular | Eurostile clone → **badges/wordmark** |
| Audiowide / Russo One | 0.4.1 | 400 | — | skip |
| Share Tech Mono | 0.4.1 | 400 | tabular | cheap mono |
| **JetBrains Mono** | 0.4.1 | 100–800 + it | tabular | **data** |
| Doto | `doto` 0.4.1 | 100–900 | — | dot-matrix MFD readouts |
| Noto Sans JP | `noto-sans-jp` 0.4.3 | — | — | kana/kanji (Latin faces have none) |

**System:** Saira Condensed 600 dial numbers / 800 hero values / 400 tracked labels; Rajdhani 500
body, 600 labels, 700 titles (min 13 px, lh 1.35); JetBrains Mono 500/700 for VIN, plates, money,
dates; Michroma 400 for badges ≥ 12 px uppercase; Noto Sans JP 500 for kana. Saira has no
tabular digits → odometer digits in fixed-width boxes.

## 3. Colour system (contrast computed)

Neutrals: bg `#121212`, panel `#1B1B1B`, raised `#212121`, hairline `#2A2A2A`, text `#EDEDED`
(16.0:1), `#B3B3B3` (8.9), muted `#8C8C8C` (5.6), disabled `#6E6E6E` (3.7, large only).

| Token | Hex | on #121212 | on #212121 | Use |
|---|---|---|---|---|
| amber | `#FFB300` | 10.44 | 8.97 | primary actions, gauge arc, needle glow, selected tab; ink `#121212` |
| orange | `#FF5F00` | 6.15 | 5.28 | needle, "urgente", gradient mid-stop; dark text on it |
| red (JDM) | `#E10600` | **3.77** | 3.24 | **fills only**; white on it 4.97 ✓ |
| red text | `#FF4D45` | 5.71 | 4.91 | red *as text* |
| green | `#3DDC84` | 10.5 | 9.02 | ok |

Light (`#F5F4F0`, text `#121212` 17.0): amber-text → `#8F5A00` (5.26), orange-text → `#B84300`
(4.97), red → `#C2000A` (5.79; white on it 6.37), green → `#1F7A3E` (4.88), muted `#616161`.
Fills keep `#FFB300/#FF5F00/#E10600` with dark text.

**Redline gradient:** `#3DDC84` 0 → `#FFB300` 55 % → `#FF5F00` 78 % → **solid `#E10600` wedge** for
the last 8–12 % (not gradient — that is what reads as redline). Track `#2A2A2A`. In react-native-svg:
`LinearGradient` on a `Path` stroke, or 3–4 flat arc segments with 2 px gaps.

Status: ok green (fill or text); próximo amber lamp; urgente orange lamp + orange band; vencido
`#E10600` fill + `#EDEDED` text / `#FF4D45` as text, blinking lamp, hazard divider.

## 4. Signature components

**4.1 Hero gauge.** 240° sweep (210°→450°), r≈140. Layers: panel disc `#1B1B1B` + 1 px `#2A2A2A`
rim → 40 minor ticks 1 px `#6E6E6E` + 9 major 2 px `#EDEDED` → numerals Saira 600 outside → track
arc → progress arc (gradient, `strokeLinecap="butt"`) → needle `Polygon` 6 px hub → 1.5 px tip
`#FF5F00`, 12 px `#121212` hub with 1 px `#FFB300` ring → centre readout (odometer + "PRÓX.
SERVICIO 1 250 km"). `interpolate(value,[0,max],[210,450])`; 0.5 px dark outline on the needle.

**4.2 Telltale row.** 6–8 rounded rects 36×24 r4 on `#1B1B1B`; off = icon `#3F3F3F` on `#161616`;
on = red/amber/green icon + 6 px `RadialGradient` glow at 35 %. Icons: oil can, coolant, tire "!",
battery, brake "(!)", clipboard, fuel pump, wrench — 24 px stroke `Path`s at 1.75 px, ISO 2575
silhouettes; no emoji/Material.

**4.3 Boost ring.** 270°, 14 px stroke, 0/25/50/75/100, tiny "BOOST"/"CHEQUEO" label under the hub,
Michroma "%" readout, red peak-hold needle; amber fill only for completion (don't redline safe
metrics).

**4.4 LCD odometer.** Options: DSEG (SIL OFL, npm `dseg` 0.46.0, `DSEG7Classic-Bold.ttf` via
expo-font; quirks: colon/space share width, period zero width, "!" = all off, "8"/"~" = all on);
**SVG segments (recommended)**: 7 `Path`s per digit (a–g), ghost at opacity 0.08, active 1.0; map
`{0:'abcdef',1:'bc',2:'abged',3:'abgcd',4:'fgbc',5:'afgcd',6:'afgedc',7:'abc',8:'abcdefg',9:'abfgcd'}`;
fixed 22×36 boxes; Doto for dot-matrix trip/consumption. Digits `#EDEDED` on `#0E0E0E` inset with
1 px `#2A2A2A` bevel; **last digit `#FF5F00`**.

**4.5 Carbon (react-native-svg Pattern, 2×2 twill):**
```jsx
<Defs>
  <LinearGradient id="cfA" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#2C2C2C"/><Stop offset="1" stopColor="#151515"/></LinearGradient>
  <LinearGradient id="cfB" x1="1" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#262626"/><Stop offset="1" stopColor="#101010"/></LinearGradient>
  <Pattern id="carbon" patternUnits="userSpaceOnUse" width="12" height="12">
    <Rect width="12" height="12" fill="#141414"/>
    <Rect x="0" y="0" width="6" height="6" fill="url(#cfA)"/><Rect x="6" y="6" width="6" height="6" fill="url(#cfA)"/>
    <Rect x="6" y="0" width="6" height="6" fill="url(#cfB)"/><Rect x="0" y="6" width="6" height="6" fill="url(#cfB)"/>
    <Rect x="0" y="0" width="6" height="1" fill="#000" opacity="0.4"/><Rect x="6" y="6" width="6" height="1" fill="#000" opacity="0.4"/>
  </Pattern>
</Defs>
<Rect width="100%" height="100%" fill="url(#carbon)"/>
```
Use at 6–10 % opacity over `#1B1B1B`, on card headers/gauge bezels/avatar frame only. Android:
rasterise once to PNG at 2× and tile with `ImageBackground resizeMode="repeat"`.

**4.6 Hazard divider:** `Pattern` 16×8 rotated −45° (amber/black; red/black for vencido), 4 px tall;
fallback explicit `Polygon`s on web if `patternTransform` misbehaves.

**4.7 Badge "Type R":** 20 px, fill `#E10600`, 1 px inner stroke `#FF4D45` @40 %, Michroma 10–11
uppercase white +12 % tracking ("TURBO", "4AGE 20V", "MOD", "STOCK"). One per card.

**4.8 Kanji/katakana (sparingly):** 車 kuruma (car) · 改 kai (modified — the tuner mark) · 走り
hashiri (driving) · 走り屋 hashiriya · 峠 tōge · 整備 seibi (maintenance) · 点検 tenken (inspection) ·
給油 kyūyu (refuel) · 燃費 nenpi (economy) · 記録 kiroku (log) · ハチロク hachi-roku (86) /
**ハチゴー hachi-gō (85 — the owner's car; default nickname)**. Rules: 8–10 px muted secondary
labels next to the Spanish word, never alone, never navigation, one per section, Noto Sans JP 500
`#8C8C8C`.

**4.9 Hanko avatar:** 40–48 px circle/rounded square, 2 px `#E10600` stroke, transparent or 12 %
fill, initial in Michroma or kanji (車/改) Noto JP 700, −4° rotation, worn-ink second stroke at 30 %
offset 1 px. Light: `#C2000A`. Also the "registrado" stamp on completed entries.

## 5. Motion (Reanimated 4 + react-native-svg)

`Animated.createAnimatedComponent(Path|Polygon|G)` + `useAnimatedProps`.
1. **Gauge sweep on launch:** needle 210 → 450 → target: `withSequence(withTiming(450,{600,
   Easing.out(cubic)}), withTiming(target,{900, bezier(0.2,0.9,0.3,1)}))`; arc via
   `strokeDasharray`/`strokeDashoffset`; light every telltale 500 ms then fade to state. Once per
   cold start; skip on tab changes.
2. **Telltale blink (vencido):** `withRepeat(withSequence(withTiming(1,{120}), withTiming(0.25,{480})),
   -1)` on opacity; ≤ 1 Hz, stop after 10 s; respect `AccessibilityInfo.isReduceMotionEnabled`.
3. **LCD roll:** segment odometer = 80 ms fade out/in flicker (authentic); mechanical-drum feel
   for garage totals = clipped vertical strip translate `withTiming(-digit*36,{400+idx*60})`
   staggered from the right.
Test `patternTransform` and `RadialGradient` early on react-native-web — the two most divergent.

## 6. Icon concept

Rounded `#121212` square, faint twill (8 %) lower half. 240° tach arc, 14 % thick, track
`#2A2A2A`, amber fill 7 → ~3 o'clock, **solid red `#E10600` last 40°**, orange needle into the red
zone, dark hub with amber ring, tiny 7-segment "085" in `#EDEDED` under the hub. Monochrome: arc +
needle silhouette. Strokes ≥ 1/24 of the canvas.

## 7. Anti-patterns

1 neon/glow everywhere (glow only on lit telltales and the needle tip) · 2 texture under text ·
3 display fonts as UI (Orbitron/Audiowide/Teko body = 2012 racing menu) · 4 three accents fighting
(amber + one status colour per screen) · 5 redline gradient on safe metrics · 6 random kanji ·
7 chevrons/speed lines/skews (one hazard divider per screen max) · 8 contrast ignored (`#E10600`
text fails; amber text on light fails) · 9 chrome bevels · 10 permanent animation.

## Sources

Verified: npm registry entries for the listed `@expo-google-fonts/*` packages and `dseg`;
https://github.com/keshikan/DSEG ; WCAG 2.1 contrast formula (w3.org/TR/WCAG21). For
verification: Wikipedia pages for Skyline GT-R, Supra, AE86, Integra Type R, Silvia; ISO 2575;
fonts.google.com specimens; Reanimated docs (`useAnimatedProps`, `withSequence`, `withRepeat`);
react-native-svg README (Pattern, gradients, web).
