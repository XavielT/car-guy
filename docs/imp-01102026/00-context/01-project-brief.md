# Project brief — IMP 01102026 · Car Guy 2.5 "Nakama" (仲間)

Fifth cycle on `github.com/XavielT/car-guy`. Written 2026-10-01. The fourth cycle ran to the end
in one day: **2.3.1 → 2.4.0 "Tōge" → 2.4.1 → 2.4.2** (local schema **v9**, cloud `sql/032`,
MapLibre map + Modo conducir + centre button, es/en, skeletons, events, memory, tires, prices + MICM,
profile/avatars, welcome, legal, account deletion). Xaviel used 2.4.x — **on his iPhone as a PWA
and on the Redmi as the APK** — and wrote eighteen notes. Every one is mapped below; none waits on
a decision (his answers in §2, defaults in ADR-48…58).

## 0. The one finding that reframes two notes

The trip that was not recorded and the "far away" location (notes 7, 8) happened **on the iPhone,
in the PWA**. Safari gives a Home-Screen web app **no background location and no background
tasks**; automatic trip detection cannot exist there, and the first fix after the screen unlocks is
often a cached one from hours earlier. That is not a bug in Car Guy's Android service. Xaviel's
decision: **stay on the PWA for now, explain its limits** (no native iOS app this cycle). So note 7
becomes (a) an honest iOS capability banner and (b) a diagnostics pass on the Redmi so the Android
path is proven; note 8 becomes a freshness filter on every platform.

## 1. Xaviel's note → where it lands

| # | Note (condensed) | Prompt | What it becomes |
|---|---|---|---|
| 1 | Fuel gauge **by squares/segments** like his DS3 (9 squares), as a per-vehicle choice at register/edit | **03** | `vehicle.gauge_type` (`needle8` · `segments` · `percent`), `gauge_segments` N, illustrated picker in the vehicle form, a segments picker in the fill-up form; readings stored as a unit-less fraction + raw |
| 2 | The **iPhone PWA did not open** once | **01** | Service worker: network-first for `index.html`, versioned cache, `clients.claim`; iOS standalone detection; "PWA en iPhone" capability banner; `navigator.storage.persist()` |
| 3 | After two full tanks the app **learns** what each square means and estimates **gallons left** | **03** | Per-vehicle calibration (monotone regression with a linear prior) from full tanks and partials; "4/9 ≈ 22 L ≈ 390 km" in the fill-up form, the vehicle hub and the cluster's fuel telltale; honest bands |
| 4 | **Ads** without annoying users? worth it with 20–30 users? Supabase Pro someday; not a money machine | **04** (+ answer in chat) | No ads now (AdMob needs a store listing; ~cents/month at this size). "Apoyar Car Guy" screen (voluntary), Premium role as thanks, **usage meter** in the admin panel (DB, storage, MAU vs free-tier limits) so the Pro decision is data, not fear |
| 5 | Cuenta → **última sincronización with the time** | **01** | "30 sep 2026 · 3:58 p. m." (Intl, both languages) |
| 6 | The app must **receive updates by itself** | **04** | **EAS Update** (OTA for JS, `fingerprint` runtime policy, check on launch, "Reiniciar" banner) + **in-app APK update** when native changed (compare with `/api/apk`, download with progress, open the installer) |
| 7 | He did a drive and the app did not record it automatically | **00** + **01** | iPhone: impossible by platform (§0) → banner. Redmi: Phase 0 runs the diagnostics on his phone (service alive? permissions? MIUI autostart? last fixes?) and Phase 1 fixes what it finds; the real drive on the Redmi is the acceptance test |
| 8 | The app shows an **old, far-away location** | **01** | Freshness filter: ignore fixes older than 15 s or worse than 50 m before drawing the user dot; "buscando GPS…" state; `enableHighAccuracy` + `maximumAge: 0` on web; `getCurrentPositionAsync` over last-known on Android |
| 9 | The **top-right logo on Inicio** (改) is not understandable | **01** | Replace the kanji seal with the **user's avatar** (tap → Cuenta/Perfil); the 改 stays as the Build tab's seal where it means "modified" |
| 10 | The welcome must explain **how the home odometer increases** | **01** | New welcome slide + a tip on first Inicio: "El odómetro sube con lo que registras: echadas, servicios, chequeos y viajes (≈ hasta que escribes el real). Toca el LCD para corregirlo." |
| 11 | **Influencers** share stats; followers find them, add them, see their profile | **05** | Public profile `@handle` + `/u/<handle>` page with OG tags; blocks the owner enables (carros, stats, fichas); follow |
| 12 | **Friends** | **05** | Follow (IG-style) + mutual = friends; requests for private accounts; block/report |
| 13 | **Routes with friends** | **06** | **Juntes**: create, invite by code/link, members, **live map** during the junte (Realtime broadcast + presence, only while "en vivo"), after: everyone's trimmed routes, km, photos, a `junte` event per car; **chat** as a later stage behind a flag |
| 14 | As an influencer, **choose what is public** (never location/route by default) | **05** | Privacy settings per block; trips never public by default; **privacy zones** (home/work 300 m) and endpoint trimming on every shared route |
| 15 | **Garage labels** have UI issues | **01** | The outline status badge on the cover photo is unreadable (screenshot): solid dark chip with the status colour text + scrim; check every label on the three garage views at 360 px |
| 16 | On the map, **show me** as a circle / my profile pic; profile pic can be public | **01** (dot) + **05** (public pic) | Drive mode: user marker = avatar in a ring (course arrow), fallback circle; `profiles.photo_public` switch |
| 17 | No **clear way to add mods** from Garaje/Vehículo; mods on **dailies**; **accessories/looks** mods (valve caps, tint, radio); cost mainly **DOP** | **01** | "+ Mod" on the vehicle hub header and in the garage card sheet; mods allowed on any vehicle status (audit); new categories *Accesorios* and *Estética* with quick presets (tapones de válvula, polarizado, radio, alfombras, emblemas…); DOP first, USD optional |
| 18 | Add a **paint job** done months ago to the DS3 — no official way | **01** | Service category **Carrocería y pintura** (service record with cost/shop/photos/date) + the existing `pintura` event; the service form's "¿Qué le hiciste?" shows it; before/after photos |

## 2. Answers Xaviel gave (2026-10-01)

- The unrecorded drive and the stale location were on the **iPhone PWA** (he left the Redmi with Claude Code); he uses both.
- The PWA failure happened **once**; it opens now.
- Friends: **follow + mutual friends, IG style**, public profile by @handle.
- Routes with friends: **all four** — live map, juntes with everyone's routes, sharing a trip to a friend/profile, and chat (chat as a later stage).
- iOS: **not now** — keep the PWA and explain the limits.
- Updates: **EAS Update OTA + in-app APK prompt**.
- Money: **no ads now; prepare "Apoyar Car Guy"**.
- Public by default for a follower: **photo, @handle, bio, cars (name/model/cover)** — nothing else unless enabled.

## 3. State when this cycle starts (02-state-of-the-repo.md)

2.4.2; schema v9; `sql/032`; `fuel_log.gauge_*_eighths` + `in_reserve`; `vehicle.reserve_volume_l`
editable; `profiles` with avatar/display name/locale; `GaugePicker` (arc, eighths); trips with
MapLibre, Modo conducir, auto mode on Android; SW `carguy-v4` cache-first for the shell; the Hanko
改 on Inicio opens Cuenta; `/api/apk` + `/instalar`; feedback inbox; roles; legal pages; account
deletion; service-role key in Vercel (rotation pending).

## 4. Goals

- **G1 — Truthful on every device**: the iPhone PWA says what it can do; the Redmi records drives
  by itself (proven on his phone); the dot is where he is.
- **G2 — The gauge speaks his car's language**: squares, learned liters, range.
- **G3 — The app keeps itself current** and tells the admin what it costs.
- **G4 — People**: profiles, follows, privacy by default, juntes with a live map.

## 5. Phase order (fixed)

**00 kickoff + Redmi drive diagnostics → 01 fix pack 2.4.3 → 02 schema v10 + cloud → 03 gauge by
segments + calibration → 04 updates + Apoyar + usage meter → 05 profiles · follows · privacy ·
shared trips → 06 juntes (live, after, chat-flagged) + release 2.5.0.** 03 and 04 are independent;
05 before 06.

## 6. Definition of done

- 2.4.3 in the first session (fixes + banners), 2.5.0 at the end with OTA enabled and the
  updater proven (a JS-only 2.5.1 arrives without an APK).
- Xaviel drives with the **Redmi** (Automático) and the trip appears by itself; the route follows
  the streets; the dot is at his house at night.
- The DS3 shows "N/9 ≈ L ≈ km" after two full tanks with readings; the welcome explains the odometer.
- A follower can open `/u/<handle>`, follow, see the enabled blocks, and never a route or a plate;
  a junte with two phones shows both live; chat stays off by flag.
- Tests ≥ 1,700, tsc/lint clean, verify-x-core / verify-sync / local-rls green, smokes green
  (+ `smoke-profile` for `/u/<handle>`), Music Hub untouched, `realtime.messages` policies
  scoped to `carguy:` topics.
