# Project brief — IMP 30092026 · Car Guy 2.4 "Tōge" (峠)

Fourth cycle on `github.com/XavielT/car-guy`. Written 2026-09-30. Claude Code ran the whole third
cycle in one day: **2.2.0 "Kaidō" → 2.2.1 → 2.2.2 → 2.2.3 → 2.3.0** are released (local schema v7,
cloud `sql/024`, 1,178+ tests, OpenStreetMap tile mosaic under trips since 2.2.2, roles + admin panel
in 2.3.0). Xaviel used it and wrote seventeen notes. Every one is mapped below; none waits on a
decision (his answers in §2, defaults in ADR-37…47).

## 1. Xaviel's note → where it lands

| # | Note (condensed) | Prompt | What it becomes |
|---|---|---|---|
| 1 | **Fuel prices editor**: easier date (date picker), a **list of sources**, and a **history of prices over time with analytics** | **05** | `fuel_price` table replaces the two settings strings: rows (valid_from, fuel_type, price, source ∈ MICM · estación · recibo · app · otro, note); date picker; history list + line chart per fuel in Cifras; **weekly MICM import** through `api/precios.ts` (Vercel Cron) with manual override |
| 2 | **Language switch** es/en (he wants English; others want Spanish) | **03** | Typed `en.ts` = `typeof es`; language store (device default → Ajustes → Idioma); catalogue translations by seed id; `Intl` dates/numbers; Android per-app language; a missing-key test |
| 3 | **Tires changed** on a project (burnouts/drift): a counter/badge and the app **tells the user things** based on the quantity; asked for questions → answered | **05** | Per-car + garage counters (from `tire` rows and Pista consumables), **badges** at 4/10/25/50/100 with dates, **contextual messages** (this year, RD$, pace → next set ETA, heat-cycle warnings), **shareable card** + optional public-page block |
| 4 | **Skeleton on every screen** while loading | **03** | In-house `<Skeleton>` (rect/circle/lines, shimmer, reduced-motion static) + one `*.skeleton.tsx` per screen + `useDelayedLoading(150 ms)`; audit list of every screen that shows blank |
| 5 | **Save events** of the car (overheat without damage, the accident, a motorcycle broke the mirror) with proofs/photos — history for the day he paints it | **05** | Milestones grow into **Eventos**: type (accidente · daño menor · avería · sobrecalentamiento · robo/intento · multa · viaje largo · junte · otro), severity, what happened, cost, **pendiente** ("pintar"), proofs (photos/PDF via album_item role `evento`), links to services/mods/checks; Historial/álbum/libro PDF |
| 6 | **Save details of the vehicle** to remember later: tire numbers, exact oil, oil filter he buys… | **05** | "**Mi carro, de memoria**" (Ficha v2): the specsheet already holds oil grade/spec, filter PN, tire sizes; add *what I actually buy* (brand/model/PN per consumable, where, price) + free key/value facts; searchable; shows in the check runner and the service form ("Igual que siempre: Castrol 5W-30 + filtro Fram PH…") |
| 7 | **Extend the fuel station list** (Petronan etc.) | **01** | `refdata/stations.json` (~20 brands, GLP-only flagged), filtered by fuel, recent-first, free text kept |
| 8 | Saving an **echada** stays in the editor → duplicates; "Listo" stays; tapping an echada opens the editor instead of a detail | **01** | Save → **detail screen** (review + map of spend) with *Editar*; double-tap guard + same-draft dedupe (60 s); list rows open the detail; the editor only from *Editar* |
| 9 | **Partials must count** (refills of RD$1000 between full tanks) | **01** | Besides the gauge estimate (2.2): "**≈ rendimiento por echada**" = km since the previous log ÷ volume added, labelled approximate, dotted series in Cifras, never in the official average (Xaviel's choice) |
| 10 | **Profile picture** (upload/camera) + **default avatars** | **06** | `profiles.avatar_id` / `avatar_path`; 16 in-house JDM SVG avatars; square crop; local for anonymous users, `avatars/<uid>/` for accounts |
| 11 | **Tutorial/guide** for new users, with avatar choice inside | **06** | `/bienvenida` (5–6 slides: idioma → nombre y avatar → primer carro → qué puedes hacer → permisos → cuenta) + first-visit tip cards; repeatable from Más → Ayuda |
| 12 | Gauge: mark "**only the reserve light** was on" (digital dot gauges) | **01** | Verify the existing "En reserva" chip; relabel "Solo la luz de reserva" with the dots-gauge explanation; sets `in_reserve` + `gauge_before = 0`; the estimate uses `reserve_volume_l` |
| 13 | See the route **on a real map** | **04** | MapLibre (native `@maplibre/maplibre-react-native` v11, web `maplibre-gl@5`), **OpenFreeMap dark** style, route as GeoJSON coloured by speed, fit bounds, heatmap layer, follow-me in drive mode |
| 14 | **Study Wheelz first-hand** on his phone via adb | **00** | Read-only adb walk (screens + UI dumps) → `05-wheelz-firsthand.md`, which PROMPT-04 reads before the drive mode |
| 15 | **Legal**: terms, disclaimer, data-use consent; Play Store later | **06** | `/terminos`, `/privacidad`, `/eliminar-cuenta` on the web + in-app; versioned acceptance (`legal_acceptance`); prominent disclosure for background location; in-app account deletion + web request path; "not legal advice — lawyer review" note |
| 16 | The map shows a **straight line** instead of following the streets | **01** (+04) | Audit his real trips' points (export); recording at 1 s / 3 m already — the loss is elsewhere (auto mode intervals, `simplify(track, 8)`, excursion filter, purge, or the tile mosaic's zoom); fix: simplify at 3 m, keep raw points 30 days, draw from raw points when present, minimum zoom 15 in the mosaic; the real map in 04 removes the rest |
| 17 | **Drive mode** as a module with a **central icon** in the nav bar (Wheelz-style); use /design | **04** | Tab bar becomes Inicio · Garaje · **[CONDUCIR]** · Historial · Más (Cifras moves to Más + Inicio quick action); the centre button opens the full-screen **Modo conducir** (cluster + live map + trip controls); Design artboards added |

## 2. Answers Xaviel gave (2026-09-30)

- Gomas: counter per car + total, badges, contextual messages, shareable — **all four**.
- Map: **MapLibre + free tiles** (OpenFreeMap / MapTiler free), no Google account.
- Language: **automatic from the phone + selector in Ajustes**.
- Legal: **public pages on car-guy.vercel.app + inside the app**, acceptance recorded.
- Events: **extend milestones → Eventos** with types and severity (one concept).
- Avatars: **in-house JDM SVG set (16)**.
- Refills without gauge: **show "≈ rendimiento por echada" marked approximate**.
- Prices: **source list + weekly MICM import** with manual override.
- Nav: **central raised button + 4 tabs** (Cifras → Más).
- Wheelz over adb: **yes, navigate and capture, read-only**.
- Tutorial: **5–6 slides at install + first-visit tips**.
- Saving a fill-up: **go to the fill-up's detail with the review**.

## 3. State when this cycle starts (02-state-of-the-repo.md)

2.3.0 on `main`; local schema **v7**; cloud `carguy` at **sql/024** (roles); trips: manual + automatic,
live speed cluster, OSM raster mosaic + heatmap (2.2.2), excursion filter (2.2.1); prices are two
settings strings (`reference_prices`, `price_week_label`); fill-up flow `carga/nueva` (form + review
sheet, form resets on focus) and `carga/[id]` (editor only); stations 8 hard-coded; milestones with
9 kinds; specsheet with oil/filter/tire fields; roles admin/member/premium; feedback inbox live.
Folder still `~/dev2/tu-gasolina-rd`.

## 4. Goals

- **G1 — Trust the numbers and the flow.** No duplicate fill-ups, detail before editor, partials
  visible, reserve light understood, routes that follow streets. (2.3.1 within the first session.)
- **G2 — Two languages, no blank screens.**
- **G3 — A real map and a real drive mode**, reachable from the centre of the bar.
- **G4 — The car's memory**: events with proofs, details to remember, tires burned with pride,
  fuel prices over time.
- **G5 — People**: profile, avatars, a welcome, and the legal floor for friends and, later, Play.

## 5. Phase order (fixed)

**00 kickoff + Wheelz first-hand → 01 fix pack 2.3.1 → 02 schema v8 + cloud → 03 i18n + skeletons
→ 04 map + drive mode + nav bar → 05 events · details · tires · prices → 06 profile · onboarding ·
legal · release 2.4.0.** 03 is mechanical and large; 04 needs a native rebuild; 05 and 06 are
independent of each other (either order).

## 6. Definition of done

- 2.3.1 on GitHub in the first session; 2.4.0 with `car-guy.apk` at the end; web deployed with the
  legal pages and `api/precios`.
- Every note has a ✅ with its phase in `04-tracking/PROGRESS.md`; the missing-keys test passes for
  `en`; every screen has a skeleton (audit table in PROGRESS.md); a real drive of Xaviel shows the
  route on the streets on the MapLibre map (manual checklist).
- `npm test` green (≥ 1,300), `tsc`/lint clean, verify-x-core / verify-sync / local-rls green with
  the new tables, smoke-public-page + smoke-apk + new `smoke-legal` (3 pages) green; Music Hub untouched.
