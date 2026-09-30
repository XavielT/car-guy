# Architecture decisions — IMP 30092026 (ADR-37 … ADR-47)

ADR-01…36 stay in force (`docs/imp-17092026`, `docs/imp-28092026`, `docs/imp-29092026`). Claude Code
applies these as defaults and reports them; it does not stop to ask.

## ADR-37 — Fix pack 2.3.1 first, no schema change

Notes 7, 8, 9, 12, 16 are usability bugs in flows people use daily. Phase 1 fixes them on `main`
with **no migration** (the "≈ por echada" number is derived; stations are a data file; the
fill-up detail is a screen), ships `v2.3.1`, then the cycle branches into schema v8.

## ADR-38 — One migration (v8) for the cycle, cloud `sql/025–027`

As ADR-17/26: `fuel_price` (+ cloud `fuel_price_ref` for MICM rows), milestone → event columns,
`vehicle_fact` + specsheet "what I buy" columns, profile avatar columns, `legal_acceptance`,
`app_language` setting, `trip_point` retention flag, tire counter needs no table. Later phases add
v9+; never edit v8. Cloud files: `025_schema_v4.sql`, `026_rls_v4.sql`, `027_fuel_price_ref.sql`
(anon SELECT on reference prices only; writes only by the Vercel function through a service-role
key stored **in Vercel env**, never in the repo — the first place Car Guy uses a service key; it is
scoped to one table by a `security definer` RPC `upsert_fuel_price_ref(jsonb)` granted to a
dedicated Postgres role, so the function's key is that role's JWT, not the project service role).
If creating a custom role on the shared project is refused by Xaviel, the fallback is a plain
`SUPABASE_SERVICE_ROLE_KEY` in Vercel used only by `api/precios.ts` — documented, his call in the
manual checklist (default: the scoped role).

## ADR-39 — i18n without a library: typed `en.ts`, a language store, catalogue translation map

`en.ts` is `typeof es` (functions included). `lib/i18n/index.ts` exports `useT()` (hook) and `t()`
(non-React, for the background task and notifications) bound to a small store persisted in
AsyncStorage (`app_language`: `'system' | 'es' | 'en'`, default `system` → `getLocales()[0]`), and
re-evaluated on foreground (Android does not restart the app on a locale change). Seeded catalogue
rows (service types, check templates/items, mod categories, venues, fluid guide) keep Spanish in
the DB; a `catalogTranslations.en.json` keyed by seed id renders them in English; user-created or
renamed rows show what was typed. Dates/numbers via `Intl` with `es-DO` / `en-US`. `es.ts` stays the
source of truth; a Jest test walks both trees for missing keys, wrong arity and untranslated
strings (identical text is allowed only for proper nouns listed in an allow-list). `app.json`
`locales` for the app name; `expo-localization` plugin with `supportedLocales: ['es','en']` for
Android 13+ per-app language and `supportsRTL: false`.

## ADR-40 — Skeletons: in-house component, one per screen, 150 ms delay

`components/ui/Skeleton.tsx` (rect, circle, lines; shimmer with `expo-linear-gradient` +
Reanimated loop — the loader exception to "no idle animation"; `useReducedMotion` → static).
Each screen with async data gets `<Name>Skeleton` mirroring its layout, shown by
`useDelayedLoading(loading, 150)` so fast loads never flash. Lists use `FlatList`
`ListEmptyComponent` = skeleton while loading, `EmptyState` after. The store's boot spinner in the
tab layout becomes the Inicio skeleton.

## ADR-41 — Map: MapLibre v11 native + `maplibre-gl@5` web, OpenFreeMap `dark` style

Native `@maplibre/maplibre-react-native` ≥ 11.4 (New Architecture only; config plugin in app.json;
`Map` imported as `MLMap`, `mapStyle`, `GeoJSONSource` + `Layer type="line"`, `Camera`
`trackUserLocation`). Web `maplibre-gl@5.24` (single-file worker; `import()` inside
`TripMap.web.tsx`; CSS import allowed by Expo's bundler). Style
`https://tiles.openfreemap.org/styles/dark` (no key, no limits, commercial ok, no SLA) with a
one-line fallback to a MapTiler free key (`EXPO_PUBLIC_MAPTILER_KEY`, empty by default) if
OpenFreeMap is down (health check at first map mount, cached 1 h). Attribution "© OpenFreeMap ©
OpenMapTiles Data from OpenStreetMap" always visible. The OSM raster mosaic (`tiles.ts`) stays only
as the **static share image** renderer and the offline fallback. No map matching (research 01 §4).

## ADR-42 — Routes follow streets by keeping the points

Recording stays 1 s / 3 m; **simplify at 3 m** (was 8); the map draws from `trip_point` when they
still exist (30 days) and from the polyline afterwards; automatic mode's *recording* options match
manual (`timeInterval 1000, distanceInterval 3`); the excursion filter keeps its thresholds but logs
what it dropped (count in the trip's diagnostics) so the real drive can be audited. PROMPT-01 first
**exports Xaviel's existing trips' points** (`tools/export-trip.mjs` → GeoJSON) to see which stage
straightened them, and records the answer in PROGRESS.md before changing constants.

## ADR-43 — Drive mode is a module with the centre button

Tab bar: Inicio · Garaje · **CONDUCIR** (raised 64 px red disc with the tachometer glyph, amber
ring while a trip records) · Historial · Más; Cifras moves to Más (first row) and to Inicio's quick
actions. `app/conducir.tsx` is a full-screen modal route (no tab bar): live map (follow-me,
course-up, speed-coloured growing trail), the speed cluster (compact, top), trip stats strip, big
**INICIAR / TERMINAR** and **PASAJERO**, keep-awake, brightness untouched, landscape allowed,
"GPS · no sustituye el velocímetro". When no trip is recording it shows the last trip's card and
the mode switch. Web: same screen with the maplibre map and manual trips only.

## ADR-44 — Events are milestones with more columns

`milestone` gains `event_type`, `severity` (leve · moderado · grave), `cost_dop`, `pending` (text),
`resolved_at`, `linked_service_id`, `linked_mod_id`, `linked_inspection_id`; proofs are
`album_item` rows with role `evento` (photos, and PDFs via the existing `media.kind = 'pdf'`).
`MilestoneKind` stays for the "nice" kinds; the UI calls the whole thing **Eventos** (a milestone is
an event with `event_type = 'hito'`). Historial gets `evento` rows; the album timeline shows them
with a red marker when severity ≥ moderado; the book PDF has an "Eventos" chapter; the public page
never shows events (privacy) unless a future switch says so.

## ADR-45 — Tires burned: derived, never stored

`lib/domain/tireStats.ts` computes per car and garage: tires mounted/retired (`tire` rows with
status changes and `consumable_usage` "goma quemada"), by year, RD$ spent (tire purchases from
inventory/mods/expenses tagged goma), pace (sets per month over the last 6), heat cycles per tire.
Badges are thresholds in code (4 · 10 · 25 · 50 · 100 with JDM names and the date reached = the
date of the nth tire); messages are templates in `es.ts`/`en.ts` fed by the stats; the share card
uses the view-shot pattern; the public page gets a `show_tires` switch (sql/025). Nothing is
persisted except the switch.

## ADR-46 — Prices: table + MICM importer with a manual override

`fuel_price` (user rows) and `fuel_price_ref` (cloud, MICM rows) are separate: the app shows the
newest of the two per fuel and says which; a user row for the same week wins on the board. The
importer is a Vercel Cron (Saturday) + on-demand GET; it never overwrites a manual row; it stores the
PDF url and raw text; a failed parse leaves the previous week flagged `stale`. The old settings
strings are migrated into one `fuel_price` row per fuel (source `manual`, valid_from = the label's
first date if parseable, else the migration date).

## ADR-47 — Legal floor: public pages + versioned in-app acceptance; not legal advice

`/terminos`, `/privacidad`, `/eliminar-cuenta` as web routes (static, ES + EN, versioned
`LEGAL_VERSION = '2026-10'`), the same Markdown rendered in-app (Más → Legal); acceptance recorded
in `legal_acceptance` (version, accepted_at, locale, device) on first launch after 2.4.0 and at
signup; background-location **prominent disclosure** screen kept as the Automático explanation;
in-app **Eliminar cuenta** (RPC `delete_my_account()` that removes `carguy.*` rows, Storage objects
and the auth user, with a 7-day grace e-mail-less confirmation = type the word ELIMINAR) and the web
page explaining how to request deletion without the app (mailto Tecnologia@constructorasd.com with
a template). Texts are drafted from research 02 §5 with a visible line "Estos textos no son
asesoría legal; revísalos con un abogado antes de Play Store".
