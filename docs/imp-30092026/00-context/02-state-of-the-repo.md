# State of the repo — 2026-09-30, after v2.3.0

Read from the laptop the same day. PROMPT-00 re-audits it and records corrections in PROGRESS.md.

## Delivery

| | |
|---|---|
| Repo / folder | `github.com/XavielT/car-guy`, `main` at **2.3.0**; folder still `~/dev2/tu-gasolina-rd` |
| Releases today | 2.2.0 (versionCode 5), 2.2.1 (6), 2.2.2 (7), 2.2.3 (8), 2.3.0 — each a GitHub release with `car-guy.apk` + `car-guy-v<ver>.apk`; `bash tools/release-apk.sh --publish` does build → check-bundle-env → release; `tools/smoke-apk.mjs`, `tools/smoke-public-page.mjs` |
| Web | car-guy.vercel.app: `/instalar`, `/api/apk`, `/api/c/[slug]`, `Permissions-Policy: geolocation=(self)` |
| Cloud | `x-core` schema `carguy` at `sql/024` (018 app membership, 019–020 schema v3 + RLS, 021 feedback, 022 share status/costs, 023 inventory link, 024 roles); `carguy-feedback` bucket; `verify-x-core` 28 checks; `local-rls` many |
| Local schema | **v7** (v6 = IMP 29092026 tables; v7 = share status/costs summary, inventory `used_in_mod_id`) |
| Tests | 1,178+ ; no React Native Testing Library (v14 does not load under RN 0.86 — tried and removed) |
| Phone | Redmi Note 10 Pro, Android 13/MIUI 14, real garage, signed in as the admin account; a 300 m walk test and a mock GPX run done; **the real drive with Automático is still pending** |

## Code facts this cycle touches

| Area | Today |
|---|---|
| Fuel prices | `app/precios.tsx` + `components/PriceBoard.tsx`: settings `reference_prices` (Record<FuelType, number>) and `price_week_label` (free text "15–21 ago 2026 (MICM)"); no history, no date, no source; `lib/fuel.ts` `FUEL_CATALOG`/`FUEL_ORDER`/`DEFAULT_REFERENCE_PRICES` |
| Fill-up flow | `app/carga/nueva.tsx`: `FillUpForm` + `FillUpReviewSheet`; after save the form is **re-keyed on focus** (stays on the editor; the sheet closes to the same form → note 8); `app/carga/[id].tsx` is the **editor** (no detail screen); Historial rows route to it |
| Partial fills | `lib/domain/partialEconomy.ts` (gauge estimates, `fuelCfgFor`), `components/fuel/GaugePicker.tsx`, `in_reserve` on `fuel_log` (2.2.0) |
| Stations | `lib/fuel.ts` `STATIONS` = Texaco, Shell, TotalEnergies, Next, Isla, Esso, Pueblo, Otra; chips in `FillUpForm` |
| Trips | `lib/trips/*`: `live.ts` (foreground watch 1 s / 3 m BestForNavigation), `machine.ts` (auto state machine; watching/recording options), `finalize.ts` (`simplify(s.track, 8)` → polyline, stats, odometer estimate), `geo.ts` (cleanTrack + excursion filter since 2.2.1), `tiles.ts` (OSM raster mosaic, MAX_ZOOM 17), `present.ts` (SVG route/heatmap), `settings.ts` (mode, thresholds, keep awake, map on/off), `auto.ts`, `task.ts` (+ `.web.ts`), `liveStore.ts`; screens `app/viajes/*`, `app/viaje/[id].tsx`; `modules/miui-autostart` (Kotlin, 2.2.2) |
| Tabs | `app/(tabs)/_layout.tsx`: Inicio · Garaje · Historial · Cifras · Más (Ionicons, uppercase Saira labels) |
| Milestones | `MilestoneKind` = compra · swap · restauracion · primer_track · accidente · venta · pintura · estado · otro; `milestone` has title/story/cover/odometer; album timeline + Historial `hito` rows |
| Specsheet | `vehicle_specsheet`: presets, oil capacity/grade/spec, **oilFilterPn**, coolant, trans/diff oil, brake/PS fluid, plug PN/gap, battery, **tireSizeOemF/R**, psi, bolt pattern, bore, lug torque/thread… (`app/vehiculo/[id]/ficha.tsx`) |
| Tires | `tire` rows (DOT, heat cycles, status montado/guardado/vendido, wheel sets), `consumable_usage` per track session, `lib/domain/tires.ts` |
| Profiles / roles | `carguy.profiles` (cloud-only) + `role` (sql/024, `lib/cloud/roles.ts`: admin/member/premium), admin panel `app/admin/*`, comments inbox |
| Strings | `lib/i18n/es.ts` (~95 KB, typed object, function keys with params) — Spanish only |
| Loading states | `ActivityIndicator` in the tab layout while the store loads; screens render empty/`null` until their queries resolve (note 4) |
| Onboarding | `app/onboarding.tsx` = "add your first vehicle" (redirect when `vehicles.length === 0`); no tutorial, no avatar |
| Legal | nothing: no terms, no privacy page, no consent record; permission explanations exist for trips |
| Flags | `lib/flags.ts` — all features true; add `FEATURE_MAP_V2`, `FEATURE_DRIVE_MODE`, `FEATURE_I18N`, `FEATURE_EVENTS`, `FEATURE_ONBOARDING_V2` |

## Carried from NEXT.md (do not lose)

- Xaviel's real drive with Automático (traffic lights, km vs odometer, battery).
- OSM standard tiles only tolerable at tiny scale (moves to MapLibre/OpenFreeMap here).
- Play Store: not now. Music Hub: a Car Guy account can still sign in there (other repo).
- `decode-uri-component` audit findings (3 moderate) until expo-router drops query-string 7.
- Keystore backup off the machine; folder rename.
