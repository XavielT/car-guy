# PROMPT 01 — Schema v2 (all tables) + JDM tokens, fonts and signature components

**Depends on:** Phase 0 · **Branch:** `imp-28092026/phase-1-schema-tokens` · **ADRs:** 16, 17, 23, 24 · **Size:** L
**Goal:** the two foundations every later phase needs: the complete v2 schema (local + cloud +
sync) and the JDM design system as tokens + components. No new screens yet except the tokens page.

> **Before running:** `.env.local` has the Supabase vars; `node tools/verify-x-core.mjs` passes.
> Fonts: `npm i --no-save sharp` for icons later.
>
> **How to run:** `cd ~/dev2/car-guy && claude`, paste below the line.

---

```
Phase 1 of IMP 28092026: write schema v2 (local migration + cloud mirror + sync) and the JDM
identity tokens/components.

Read first:
- CLAUDE.md → AGENTS.md; Expo 57 docs for expo-font (Google fonts packages), react-native-svg,
  reanimated 4 (useAnimatedProps), expo-image.
- docs/imp-28092026/02-specs/01-data-model-v2.md   ← the migration; authoritative
- docs/imp-28092026/02-specs/02-cloud-v2.md §1–2
- docs/imp-28092026/00-context/03-architecture-decisions.md (ADR-16, 17, 23, 24)
- docs/imp-28092026/00-context/05-design-jdm.md   ← tokens and components; authoritative
- docs/imp-28092026/01-research/01-jdm-design-language.md (fonts verified, SVG snippets, motion)
- lib/db/migrations.ts, lib/db/types.ts, lib/sync/tables.ts, __tests__/sync/schema-parity.test.ts,
  constants/theme.ts, components/T.tsx, components/ui/*, app/dev/tokens.tsx

Branch: imp-28092026/phase-1-schema-tokens

PART A — SCHEMA v2

1. lib/db/migrations.ts: add { version: 2, up: [...] } with EXACTLY the SQL in 01-data-model-v2.md
   §1, including the data migration steps (ownership rows, mejora → mod, specsheet rows, seeds for
   mod_category and venue, dtc_code load from lib/domain/dtc.es.json). Never edit v1.
2. lib/db/types.ts: add/extend the TS types for every new table and column (camelCase, Syncable).
   lib/db/repos: a repo per new table with the standard surface (list/getById/upsert/softDelete);
   specsheet and setup_sheet are 1:1 repos (getForVehicle / getForSession). Update `media` repo
   for the new columns; `history` feed reader for the new kinds.
3. DTC data: fetch https://raw.githubusercontent.com/mytrile/obd-trouble-codes/master/obd-trouble-codes.csv
   (MIT), generate lib/domain/dtc.es.json = [{code, system, descEn, descEs, isGeneric}] with a
   Spanish description. Translate with a deterministic, reviewable approach: a glossary-driven
   replacement for the ~120 recurring terms (Circuit → Circuito, Malfunction → Falla, Bank 1 →
   Banco 1, Sensor → Sensor, Low/High Input → Señal baja/alta, Misfire → Fallo de encendido, …)
   applied in a script tools/build-dtc-es.mjs; keep descEn verbatim; add LICENSE-mytrile.txt.
   Do not call any paid API. Mark isGeneric=0 for P1xxx/P3xxx/B1/C1/U1 manufacturer ranges.
4. Seeds: lib/domain/catalog.ts gains MOD_CATEGORIES (ids/names/icons per spec), VENUES
   (autodromo_americas: "Autódromo de las Américas (Sunix)", Santo Domingo Este, circuito) and the
   Jetta/AE85 dev seed v2 fields (fill the TODO(v2) block from Phase 0: nickname, status, story,
   ownership rows, a few mods for the AE85 with spec_effects: 4A-GE 20V swap {engine_code, hp
   ~160 est}, ECU tuneada, radiador + abanicos, aros 15x8 ET0 {wheel_f, wheel_r}, gomas 195/50R15;
   a wishlist item "Coilovers BC Racing BR" USD 1050; one wheel_set + 4 tires DOT 2323; a
   specsheet for the DS3 from the preset; a milestone swap Aug 2025; a contact "Taller de Tony").
5. Cloud: write sql/009_schema_v2.sql and sql/010_rls_v2.sql per 02-cloud-v2.md §1–2 (idempotent,
   rollback block). Apply with node tools/apply-sql.mjs (no --shared needed for these two; the
   profiles column and the RPC are in carguy). Then npm run types:gen. Then update
   lib/sync/tables.ts (order in 01-data-model-v2.md §3, keyedBy for mod_category/venue, localOnly
   thumb_blob), BOOLEAN_COLUMNS, and make __tests__/sync/schema-parity.test.ts parse BOTH sql/002
   and sql/009. node tools/verify-x-core.mjs and node tools/verify-sync.mjs must pass (extend
   verify-x-core with the v2 table list).
6. Tests: __tests__/db/migrate-v2.test.ts — fresh DB migrates 0→2; a v1 DB seeded with the
   Phase 0 fixture (docs/imp-28092026/fixtures/car-guy-v2.0-backup.sample.json imported at v1)
   migrates to v2 with: ownership rows created, every 'mejora' service_record has a mod, counts
   preserved, history_feed returns the new kinds. Backup v2 export/import must include the new
   tables (extend lib/backup.ts table list from SYNC_TABLES + dtc excluded) — test it.
   Also __tests__/domain/dtc.test.ts (lookup, generic flag, Spanish present for all rows).

PART B — JDM TOKENS + COMPONENTS (05-design-jdm.md)

7. Fonts: npx expo install @expo-google-fonts/saira-condensed @expo-google-fonts/rajdhani
   @expo-google-fonts/michroma @expo-google-fonts/noto-sans-jp (keep jetbrains-mono). Load the
   weights listed in the spec in app/_layout.tsx. Remove space-grotesk and manrope packages and
   their imports (T.tsx faces re-mapped; grep for any direct fontFamily string).
8. constants/theme.ts: apply the token tables (dark + light), keep the Palette shape and ADD the
   new keys (bg.well, lineStrong, text.disabled, needle, redline, redlineText, statusText.vencido,
   telltaleOff, glow, gaugeGradient, carbonOpacity, category track/album). Update every consumer
   that used status.proximo as a non-amber colour (search `proximo`) and re-check the four pill
   states visually.
9. components/T.tsx: faces display/title/eyebrow/body/medium/semibold/mono/monoBold/badge/kana.
10. New components in components/ui/: ClusterHero (replace OdometerHero — keep the old export as
    a thin wrapper until Phase 2 removes its call sites), TelltaleRow, BoostRing (GaugeRing
    re-skin, keep API), LcdDigits, Badge, HazardDivider, CarbonFrame, Hanko, CornerGrid,
    Timeline (list scaffold with month headers + rail; items rendered by a renderItem prop).
    StatusPill/RecordRow/Chip/Card/Buttons restyled to the tokens (radius: card 16, button 12,
    chip 6 for "technical" chips — the spec's rounded-rect chips; keep `chip: 999` for filter pills).
    Carbon: SVG Pattern on web; on Android generate assets/images/carbon@2x.png with
    tools/make-icons.mjs and tile it with ImageBackground.
11. Motion: lib/motion/gaugeSweep.ts (Reanimated shared values; once per cold start; reduced-motion
    aware) used by ClusterHero + TelltaleRow; telltale blink util; LCD flicker; all off on web
    when prefers-reduced-motion.
12. app/dev/tokens.tsx: every token and component in both schemes, with a "Cluster" section that
    animates the sweep on demand. Take screenshots docs/qa/phase-1-tokens-{dark,light}.png.
13. Icon + splash: update assets/pwa/*.svg per 05-design-jdm.md "Icon and splash" (tach arc,
    red wedge, needle, tiny 085), regenerate with tools/make-icons.mjs; app.json adaptive icon
    background stays #121212. (Native assets refresh at the next EAS build.)
14. Feature flags in lib/flags.ts: FEATURE_ALBUM/BUILD/DIY/TRACK/SHARE = false.

VERIFY: tsc, lint, npm test (≥ 450 + new), npm run build; web + Android (Expo Go): the app boots
on the new fonts, every existing screen renders with the new tokens (visual diff acceptable — the
identity pass is Phase 2), the fuel flow and the weekly check work; migration runs on an existing
device DB (test with a copy of the v2.0 DB exported from the phone if available: back it up
first). Report (incl. Design check + Flags), merge, push.
```

---

## Acceptance criteria

- [ ] Migration v2 exactly per spec; v1 untouched; data migration idempotent; tests for 0→2 and 1→2 with the fixture.
- [ ] All new repos and types; `history_feed` v2 (also fixes same-day ordering with `created_at`).
- [ ] DTC table bundled (MIT notice), Spanish descriptions for 100 % of rows, generator script committed.
- [ ] `sql/009` + `sql/010` applied; types regenerated; `SYNC_TABLES`/`BOOLEAN_COLUMNS` updated; parity test covers 002 + 009; verify scripts green.
- [ ] Backup v2 includes the new tables; import round-trips.
- [ ] Fonts swapped (Saira Condensed / Rajdhani / JetBrains / Michroma / Noto JP); Space Grotesk and Manrope gone.
- [ ] Tokens per spec in both schemes; contrast of every text/background pair in the tokens page ≥ 4.5:1 (list them).
- [ ] Components: ClusterHero, TelltaleRow, BoostRing, LcdDigits, Badge, HazardDivider, CarbonFrame, Hanko, CornerGrid, Timeline; previewed in `dev/tokens`.
- [ ] Gauge sweep once per cold start; reduced motion respected; nothing loops idle.
- [ ] Icon/splash regenerated; flags added; fuel flow + weekly check verified on web + Android.

## Watch for

- `ALTER TABLE ADD COLUMN` in SQLite cannot add `NOT NULL` without a default — every new column has one.
- `DROP VIEW` + `CREATE VIEW` must be inside the same migration transaction.
- The parity test parses SQL by regex — keep `sql/009` in the same formatting style as `sql/002`.
- Saira Condensed has no tabular digits → LcdDigits uses fixed boxes; never use it for money columns.
- `#E10600` as text fails AA — use `redlineText`.
- Web: `Pattern` + `patternTransform` diverge on react-native-web; test the carbon and hazard early, fall back to CSS `repeating-linear-gradient` via a `.web.tsx` if needed.
