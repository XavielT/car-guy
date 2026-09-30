# PROMPT 03 — Language switch (es/en) + skeleton on every screen

**Depends on:** Phase 2 · **Branch:** `imp-30092026/phase-3-i18n-skeletons` · **ADRs:** 39, 40 · **Size:** XL (mechanical; two parts)
**Goal:** G2.

> **Before running:** nothing to approve. This phase touches almost every file; run it in a fresh
> session with the tests green. Part A = language, Part B = skeletons; both can be one session if
> context allows, else two.
>
> **How to run:** `cd` to the repo folder, `claude`, paste part A; then part B.

---

## Part A — language

```
Phase 3A of IMP 30092026: Spanish and English with a switch. Note 2. ADR-39.

Read first:
- docs/imp-30092026/01-research/02-i18n-skeleton-onboarding-avatars-legal.md §1 (recommendation:
  typed en.ts = typeof es, store, expo-localization, catalogue translation map, Intl, app.json
  locales, expo-localization plugin supportedLocales, foreground re-check)
- lib/i18n/es.ts (all of it — you will translate it), lib/domain/catalog.ts (seed ids), lib/format.ts
  (dates/numbers), app/_layout.tsx (providers), lib/notifications/* (strings outside React),
  lib/trips/task.ts (background strings), lib/i18n usage: grep -rn "from '@/lib/i18n/es'" | wc -l

Branch: imp-30092026/phase-3-i18n-skeletons

1. INFRA: lib/i18n/index.ts — LanguageStore (Zustand or the existing store pattern) with
   `app_language` ('system'|'es'|'en') persisted in AsyncStorage, `resolved` from
   expo-localization getLocales() when system; useT() returns the typed dictionary for the
   resolved language; t() for non-React code reads the store synchronously; AppState foreground
   listener re-resolves 'system'. npx expo install expo-localization; app.json plugin
   ["expo-localization", { "supportedLocales": ["es", "en"], "supportsRTL": false }] and
   "locales": { "es": "./locales/es.json", "en": "./locales/en.json" } (app name only).
2. DICTIONARY: lib/i18n/en.ts = full English translation of es.ts with the exact same shape
   (functions with the same parameters; plurals handled as es does). Proper nouns / DR vocabulary
   allow-list (Car Guy, MICM, RD$, Autódromo de las Américas, junte, tirar tiro…) stays in both.
   Tone: the same voice as Spanish (car guy, direct), not corporate. __tests__/i18n/parity.test.ts
   walks both trees: same keys, same types, same arity, no identical strings outside the allow-list,
   no leftover Spanish words from a small blacklist (el, la, de, y, para…) in en values.
3. CALL SITES: replace every `import { es }` outside lib/i18n with useT()/t() (a codemod: sed +
   tsc as the safety net; components get `const t = useT();` and `es.` → `t.`). Non-React:
   notifications, background task, PDF/book/report renderers, share texts, CSV headers — t().
   ESLint no-restricted-imports rule for '@/lib/i18n/es' outside lib/i18n and tests.
4. CATALOGUE: lib/i18n/catalogTranslations.en.json keyed by seed id (service types, check
   templates + items incl. how/warning texts, mod categories, venues, fluid guide, DTC descriptions
   stay Spanish? — DTC: keep the bundled ES table; English users see the code + the ES text with a
   note "descripción en español" — say so); helper `catalogLabel(row)` → English when the row is
   an unmodified seed (compare name to the seed name) else what the user typed.
5. FORMAT: lib/format.ts → Intl with 'es-DO' / 'en-US' from the store (dates: "mié 25 sep" /
   "Wed, Sep 25"; numbers; RD$ stays "RD$ 1,234.50" in both; units km/gal ↔ km/gal, L/100 km).
6. UI: Más → Idioma row (Sistema · Español · English) with immediate effect; Cuenta shows nothing
   about language. The public page /c/<slug> keeps the owner's language (share row locale =
   the owner's resolved language at publish; the Vercel function renders both? — no: renders the
   stored locale; add `locale` to vehicle_share in a later cycle if needed — record as deferred).
7. TESTS: parity, format in both locales, catalogLabel, store resolution (system → device), t()
   outside React. Flag FEATURE_I18N → true when the parity test passes.

VERIFY web + Android: switch to English in Más → every tab, the fill-up flow, a check run, Viajes,
Build, Pista, Novedades, the feedback form, a notification text (schedule one), the PDF report
header; switch back; set the phone to English with Sistema → the app follows on foreground.
Screenshots of Inicio/Garaje/Historial in both. Report block; Notes closed: 2.
```

## Part B — skeletons

```
Phase 3B of IMP 30092026: a skeleton on every screen. Note 4. ADR-40.

Read first:
- research 02 §2 (in-house Skeleton, 150 ms delay, expo-router has no loading.tsx convention)
- PROGRESS.md "Screen audit" from Phase 0 (route → what shows while loading)
- components/ui/index.tsx, components/ui/EmptyState.tsx, app/(tabs)/_layout.tsx (boot spinner),
  lib/store.tsx (`ready`), the screens' data hooks (useEffect + Promise.all patterns)

1. COMPONENT: components/ui/Skeleton.tsx (Rect, Circle, Lines(n), Card presets; shimmer =
   expo-linear-gradient sweep with Reanimated withRepeat — the loader exception; useReducedMotion
   → static tone; colours from the theme's raised/line tokens; web works). hooks/useDelayedLoading.ts.
2. ONE TWIN PER SCREEN listed in the audit: `<Name>Skeleton` next to each screen (Inicio: cluster
   outline + tiles + quick actions; Garaje: three cards; Historial: 8 rows; Cifras: KPI tiles +
   chart box; Más: rows; vehicle hub: header + tabs + cards; album grid: 12 cells; Build/Pista/
   Viajes lists; trip detail: map box + tiles; forms that load initial data: field outlines;
   admin screens; public page? no — SSR). Replace every `return null` / empty `View` while
   loading with the twin behind useDelayedLoading. The tab layout's ActivityIndicator → InicioSkeleton.
3. AUDIT TEST: __tests__/ui/skeletons.test.ts — a list of routes that render data with their
   twin component; fails when a route in app/ (excluding forms without async data, listed
   explicitly) has no twin.
4. PERF: no shimmer on more than one screen at a time (stack: only the focused screen animates).

VERIFY: throttle the DB (dev flag `SLOW_QUERIES=800ms` in lib/dev) → every screen shows its
skeleton then content; fast path (no flag) shows no flash (record a 60 fps screen capture on
the Redmi for Inicio and Historial). Report block; Notes closed: 4; "Screens with skeleton: N/N".
```
