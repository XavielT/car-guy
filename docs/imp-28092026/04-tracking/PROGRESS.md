# Progress — IMP 28092026 (Car Guy 2.1 "Hachi-Gō")

Claude Code appends a report per phase (block in `00-context/04-conventions.md`, plus *Design
check* and *Flags flipped*). "Notes for the next phase" carry context between sessions.

**Started:** 2026-09-28 · **Status:** Phase 1 done

## Phase status

| # | Phase | Status | Branch | Notes |
|---|---|---|---|---|
| 0 | Kickoff | ✅ | `imp-28092026/phase-0-kickoff` | folder rename still pending (manual) |
| 1 | Schema v2 + JDM tokens | ✅ | `imp-28092026/phase-1-schema-tokens` | cloud 009/010 applied; Android verified on the Redmi 2026-09-28 |
| 2 | JDM screens + Garaje | ⬜ | | |
| 3 | Álbum / memoria | ⬜ | | |
| 4 | Build log | ⬜ | | |
| 5 | DIY | ⬜ | | |
| 6 | Pista | ⬜ | | |
| 7 | Compartir | ⬜ | | |
| 8 | Release 2.1.0 | ⬜ | | |

⬜ not started · 🟡 in progress · ✅ done · 🔴 blocked

## Audit corrections (Phase 0)

Checked `00-context/02-state-of-the-repo.md` against the code on 2026-09-28. Everything not listed
matched (versions, `app.json`, theme `Palette`/fonts/radius, `SYNC_TABLES` order and `keyedBy`,
`BOOLEAN_COLUMNS`, tools list, 76 RLS policies, `es.ts` 46 KB, screens).

| Doc says | Code says |
|---|---|
| "Tables (19)" as the local schema | **18 local tables** (the 18 names listed) + view `history_feed`. The cloud has **19**: the same 18 plus `carguy.profiles` (cloud-only, created by the `handle_new_user` trigger, not in `SYNC_TABLES`). 76 policies = 19 × 4 |
| sql files `001…008, 999, rollback` | also `sql/000_inspect.sql` (read-only inspection queries) |
| "`database.types.ts` regen" | the file is `lib/cloud/database.types.ts`; `npm run types:gen` targets project `nakgrkcqyuycadeuenuw`, schema `carguy` |
| "450 tests, tsc/lint green" | 450 tests pass, but **`npm test` exited 1**: jest collected `__tests__/helpers/sqlite.ts` as a suite with no tests (since the 2026-09-25 sync fixes). Fixed in this phase with `testPathIgnorePatterns` — test config only |
| `lib/db` ops files: vehicleOps, serviceOps, inspectionOps, syncOps, statsQueries | also `catalogOps`, `documentOps`, `reminderQueries`, `reset.ts`, `client.ts` |
| UI kit `index (PrimaryButton, GhostButton, Chip, Card, Field…)` | `components/ui/index.tsx` exports PrimaryButton, GhostButton, Chip, SectionHeader, KeyValueRow, Segmented, NavRow…; cards are `Surface`, `Field` is `components/Field.tsx` |
| npm audit (NEXT.md): 22 findings, 15 moderate / 7 high | `npm ci` today: **18** (16 moderate, 2 high) |
| `vercel.json` static | also one explicit `rewrites` entry per dynamic route (`/vehiculo/:id` → `/vehiculo/[id]` …) and `X-Frame-Options: DENY`. PROMPT-07's `/c/<slug>` needs its own entry (or an `api/` function route) |
| PROMPT-00 "replace the demo vehicles" | the old dev seed created no vehicles — it wrote history onto whichever vehicle was active — and had no inspection sample data |

## Baseline (Phase 0)

Taken 2026-09-28 on `main` @ `9924c03` (before any change), from `~/dev2/tu-gasolina-rd`.

| Check | Result |
|---|---|
| `npm ci` | ok · 18 vulnerabilities (16 moderate, 2 high) |
| `npx tsc --noEmit` | clean |
| `npx expo lint` | clean |
| `npm test` | **450/450 tests, 19/20 suites — exit 1** (empty helper suite, see above). After the fix: 20/20 suites, 455 tests (5 new for the seed) |
| `npm run build` | ok · 45/45 pages titled · `dist` 6.6 MB (6,386,645 bytes) |
| `node tools/verify-x-core.mjs` | 7/7 |
| `node tools/verify-sync.mjs` | 14/14 |
| node / npm | v24.15.0 / 11.12.1 |
| `eas whoami` (token from `.env.expo.local`, eas-cli 24.8.0) | `xavieldev` (Owner), `xavieldevs-team` (Owner) |
| `vercel whoami` | `xavielt` |
| `gh auth status` | `XavielT`, ssh, scopes `admin:public_key, gist, read:org, repo` |
| `adb devices` | adb not on `PATH` (it is at `~/Android/Sdk/platform-tools/adb`); no device attached |

## Decisions made along the way

## Deviations from the package

## Observed, deferred

| Found in | Issue | Severity | Notes |
|---|---|---|---|
| 0 | `adb` is not on `PATH` | low | use `~/Android/Sdk/platform-tools/adb` |
| 1 | A **2.0.0 install signed in to sync** can no longer pull `vehicle`, `media` or `service_record`: it pulls `select *`, and 009 added columns it cannot store, so those rows park until it updates to 2.1. Push still works; nothing is lost. Other v1 tables (fuel_log included) are unaffected — `updated_by` on them was deferred to PROMPT-07 for this reason. 2.1 drops unknown cloud columns on pull, so it will not recur | medium | Xaviel's phone has no account yet (NEXT.md "Still yours" 3); ship 2.1 before anyone syncs on 2.0.0 |
| 1 | DTC table: 126 generic P0 rows whose CSV text is off-by-one and that have no hand-written override show "descripción sin verificar"; the 428 overrides were written from SAE J2012 knowledge by an agent, spot-checked (30 codes) but not reviewed line by line by a person | low | `tools/data/dtc-overrides.json` is the file to review; PROMPT-05 surfaces it |
| 1 | `seedCatalog()` does not refresh `mod_category` / `venue` names — migration v2 seeds them once (INSERT OR IGNORE). A renamed category needs a migration | low | fine until a label changes |
| 1 | Web console: RN-web deprecation warnings for `shadow*` style props and `props.pointerEvents` (pre-existing `shadow*` in Surface) | low | cosmetic, dev only |
| 1 | `expo` 57.0.14 → 57.0.25 and 14 packages behind (Metro banner; same as NEXT.md's expo-doctor note) | low | one `npx expo install --check` pass |
| 1 | `dist` 6.6 → 7.3 MB: the bundled DTC table (546 KB JSON) is in the JS entry | low | could move to a lazily fetched asset if first load matters |

## Blockers

| Phase | Blocker | Needs | Status |
|---|---|---|---|
| 0 | Folder rename `~/dev2/tu-gasolina-rd` → `~/dev2/car-guy` | Xaviel, in a terminal with no session open there | open |
| 0 | Throwaway users from the baseline verify runs (`carguy-test-1790608644357-%`, `carguy-sync-1790608647648@example.com`) still in `auth.users` — `apply-sql.mjs sql/999_cleanup_test_users.sql --shared` was refused by the auto-mode classifier | Xaviel allowed it | resolved 2026-09-28 — applied, `leftover_profiles = 0` |

---

## Phase reports

## Phase 0 — Kickoff   (branch `imp-28092026/phase-0-kickoff`)

**Status:** complete (folder rename pending — manual)
**Commits:** `chore(imp-28092026): kickoff — package, audit, baseline, real-garage seed`

### Changed
- `docs/imp-28092026/` — the package copied from `~/improvements/imps car guy/september 2026/imps 28092026`
  (`00-context`, `01-research`, `02-specs`, `03-prompts`, `04-tracking`, `README.md`). The two
  copies were identical at copy time. `05-manual-checklist.md` stays only in the master (not in
  the list to copy). From now on prompts read `docs/imp-28092026/…`; if the master is newer
  (mtime), use it and say so.
- `docs/NEXT.md` (Local folder row), `docs/RESUME.md` — the repo's home is `~/dev2/car-guy`; the
  rename on this laptop is recorded as pending.
- `lib/dev/garage.ts` (new) — `seedRealGarage()`: Toyota Sprinter Trueno AE85 1985, Citroën DS3 2015,
  Citroën C3 2003, VW Jetta 2003, fixed ids `dev_ae85/dev_ds3/dev_c3/dev_jetta`, v1 columns only,
  no plate/VIN. Idempotent (a second run finds the AE85 and writes nothing). The previous seed's
  fuel/service/expense/task data is kept and split: DS3 gets the year of regular fill-ups (rebased
  to 96,000 km), both oil services, the water pump, marbete/seguro/lavado/peaje and the gomas task;
  AE85 gets 8 premium fill-ups ending at 52,400 km, the mejora (retitled "Radiador y abanicos
  racing"), multa and parqueo. C3 gets the 4 open tasks. The Jetta is sold + archived and gets no
  reminders. `GARAGE_V2` holds the `// TODO(v2): nickname/status/story/ownership` block
  (nickname, status, chassis/engine code, transmission, drivetrain, origin, story, the Jetta's
  2018 → 2021 ownership, the C3's `accidente` milestone) for PROMPT-01 to write.
- `app/dev/seed.tsx` — one button, "Sembrar garaje", calls `seedRealGarage()`; no longer needs an
  active vehicle.
- `lib/backup.ts` — `buildBackup` exported (for the fixture). No behaviour change.
- `__tests__/dev/garage.test.ts` (new, 5 tests) — seeds into a real SQLite and checks vehicles,
  history placement, the AE85's 52,400 km, idempotency and the backup shape.
  `WRITE_FIXTURE=1 npx jest __tests__/dev/garage.test.ts` regenerates the fixture.
- `docs/imp-28092026/fixtures/car-guy-v2.0-backup.sample.json` — v2 backup of the seeded DB
  (4 vehicles, 20 fill-ups, 26 odometer readings, 4 services, 6 expenses, 5 tasks, 56 reminders,
  the catalogues). `.gitignore` gains `docs/imp-28092026/fixtures/*.real.json`.
- `package.json` — jest `testPathIgnorePatterns` skips `__tests__/helpers/` so `npm test` exits 0.

### Dependencies added / removed
- none

### Acceptance criteria
- [x] `docs/imp-28092026/` in the repo; path docs updated; rename status recorded — `pwd` is still
  `/home/xaviel/dev2/tu-gasolina-rd`, so the rename is pending (Blockers).
- [x] Audit corrections and baseline recorded — tables above; tests 450 → 455, build 6.6 MB,
  verify-x-core 7/7, verify-sync 14/14.
- [x] Dev seed shows AE85 / DS3 / C3 / Jetta with the v1 fields; v2 TODO block present — verified
  by `__tests__/dev/garage.test.ts` against the real migrations; the screen itself was not opened
  in a browser (dev-only route, one call into the tested function).
- [x] Sample v2.0 backup fixture exists; real fixtures gitignored.
- [x] `main` green and deployed — tsc, lint, 455/455 tests, build all green before the merge; push
  to `main` deploys Vercel.

### Decisions made (defaults applied)
- Model is written "Sprinter Trueno" (the AE85 Trueno's catalogue name); name on screen "Trueno AE85".
- The fixture is generated through the real migrations + repositories in node's SQLite (the same
  path as the other DB tests), not by exporting from a browser — reproducible and scriptable.
- Dates known only to the year (Jetta 2018 → 2021) are stored as 1 January and commented as such.
- The C3 and Jetta have no odometer (unknown; no invented numbers). The AE85's 47,000 start and the
  DS3's 96,000 are placeholders chosen so the history reads right; the AE85 lands on ~52,400 as asked.
- Fixed the empty-suite jest failure (test config, not product code) because "main green" needs it.

### Deviations from the package
- The v1 seed had no demo vehicles and no inspection data to move; see Audit corrections.

### Observed, deferred
- Cleanup of the baseline's throwaway users: done after Xaviel allowed it (Blockers).
- `adb` not on `PATH`.

### Design check
- n/a — no UI changes beyond the dev-only seed screen's copy.

### Flags flipped
- none

### Notes for the next phase
- PROMPT-01: write `GARAGE_V2` into the new columns/tables inside `seedRealGarage()` and delete the
  TODO. The migration test imports `docs/imp-28092026/fixtures/car-guy-v2.0-backup.sample.json`
  (schema v1 rows, backup format v2) and should migrate it 1 → 2.
- The Jetta is `sold_date` + `is_archived = 1`; the v2 data migration rule in 01-data-model-v2.md
  ("status `vendido` when `sold_date` is set") takes precedence over "archived → guardado" for it.
- Local tables are 18 (+ cloud-only `profiles`); count accordingly in parity tests.


## Phase 1 — Schema v2 + JDM tokens   (branch `imp-28092026/phase-1-schema-tokens`)

**Status:** complete (Android verified by bundle only — no device or emulator attached)
**Commits:** `feat(db): schema v2 …`, `feat(ui): JDM identity …`, `docs(imp-28092026): phase 1 report`

### Changed
**Part A — schema v2**
- `lib/db/migrationV2.ts` (new), `lib/db/migrations.ts` — `{ version: 2 }`: the §1 DDL verbatim (v1 untouched), the
  seeded `mod_category` (21) and `venue` (Autódromo de las Américas / Sunix), the bundled `dtc_code` table, and the data
  steps: status from `sold_date`/`is_archived`, one `vehicle_ownership` per vehicle, every `mejora` → a `mod`
  (category `otro`, record kept), an empty `vehicle_specsheet` per vehicle. Derived rows use **deterministic ids**
  (`own_<vehicle>`, `mod_<record>`, specsheet id = vehicle id), so two devices migrating the same synced garage
  converge instead of duplicating; rows it changes are left dirty so the next sync uploads them.
- `lib/db/types.ts`, `lib/db/repos/index.ts` — types and a repo for every new table; `specsheets.getForVehicle`,
  `setupSheets.getForSession` (1:1), read-only `dtcCodes`; `media` repo gains `isFavorite`; `history.feed` orders by
  `occurred_at, created_at` (fixes the same-day order backlog item) and returns `createdAt`. `ALL_TABLES` (backup,
  reset) gains the v2 tables, `dtc_code` excluded. `repos/base.ts` snake/camel now treat digits as a word
  (`zero_100_ms` ↔ `zero100Ms`).
- `lib/domain/catalog.ts` — `MOD_CATEGORIES`, `VENUES`. `lib/domain/history.ts`, `components/ui/RecordRow.tsx`,
  `app/(tabs)/historial.tsx` — feed kinds `mod` / `hito` / `pista`; a migrated mod opens its v2.0 record; the Mejoras
  chip also finds mods.
- DTC (delegated to a sub-agent, reviewed): `tools/build-dtc-es.mjs` + `tools/data/obd-trouble-codes.csv` (mytrile,
  MIT, `lib/domain/LICENSE-mytrile.txt`) + `tools/data/dtc-overrides.json` → `lib/domain/dtc.es.json` (3,142 rows);
  `lib/domain/dtc.ts` (`normalizeCode`, `lookup`, `isManufacturerSpecific`, `describe`). **The source CSV is shifted by
  one to three codes from P0126 onward** (its P0301 is P0300's text, its P0420 is secondary air…). The generator
  replaces 357 rows and adds 71 with hand-written SAE definitions, and gives the 126 generic rows it cannot fix the
  text "Código genérico — descripción sin verificar (consulta un manual)". Glossary translation for the rest,
  deterministic, no API.
- Sync: `lib/sync/tables.ts` — the 23 synced v2 tables in §3 order, `mod_category`/`venue` keyed by `user_id`,
  `media.thumbBlob` and `vehicle.garageRole` local-only, `vehicle_member` **pull-only** (new `pullOnly` flag; the
  engine skips its push and its pending count); `BOOLEAN_COLUMNS` for every v2 boolean. `lib/db/syncOps.ts` —
  `applyRemoteRows` now drops any cloud column the local table lacks (PRAGMA table_info), and `updated_by`, so a
  future cloud column cannot park a whole table again (see Observed, deferred).
- Cloud: `sql/009_schema_v2.sql` (mirror, generated from the local DDL; `updated_by` on the new vehicle-scoped
  tables; `vehicle_member` in §5's shape plus a generated `id`) and `sql/010_rls_v2.sql` (own-rows template;
  `vehicle_member` select-only with writes revoked; `profiles.media_quota_bytes` 300 MB;
  `carguy.storage_usage_bytes()`). **Applied** to x-core with `tools/apply-sql.mjs` (no `--shared`).
  `lib/cloud/database.types.ts` regenerated (needs `SUPABASE_ACCESS_TOKEN` = the `ACCESS_TOKEN` in `.env.supabase`).
  `tools/verify-x-core.mjs` checks 8–12 added.
- Seed: `lib/dev/garage.ts` — the TODO(v2) block is gone: identity/status/story on the four cars, ownership periods,
  AE85 build (swap 4A-GE 20V `{engine_code, hp: 160}` — an estimate —, ECU, the radiator mod linked to its v2.0-style
  record, aros 15x8 ET0, gomas 195/50R15), wishlist "Coilovers BC Racing BR" USD 1,050, a wheel set + 4 tires DOT 2323,
  fichas (AE85 stock 3A-U / 13x5; DS3 4x108, 50 L, EP6 — only values I am sure of), milestones (swap Aug 2025, C3
  choque), contact "Taller de Tony". AE85 economy made realistic (~37 km/gal).
- Tests: `__tests__/db/migrate-v2.test.ts` (0→2; v1 + Phase 0 fixture → 2 with ownership, mejora→mod, counts
  preserved, feed kinds, idempotency, same ids on two devices), `__tests__/db/backup-v2.test.ts` (export → wipe →
  restore, every table), `__tests__/domain/dtc.test.ts`, `__tests__/domain/cluster.test.ts`,
  `__tests__/theme/contrast.test.ts`, `__tests__/dev/garage.test.ts` (v2 half), `__tests__/sync/schema-parity.test.ts`
  now parses **002 + 009** including `ALTER … ADD COLUMN` on both sides, inline per-user keys and inline cascades.

**Part B — JDM identity**
- `constants/theme.ts` — the 05-design-jdm.md token tables for dark and light; `Palette` keeps its shape and adds
  `bg.well, lineStrong, text.disabled, accentFill/accentFillInk, needle, redline, redlineText, statusText,
  dangerText, telltaleOff, glow, gaugeGradient, carbonOpacity`; category colours per spec plus `track`, `album` with
  computed light inks; `radius` card 16 / button 12 / `tag` 6 / `lamp` 4 (`chip` stays 999 for filters).
  Every red-as-text call site moved to `dangerText` / `statusText.vencido`.
- Fonts: Saira Condensed 400/600/800, Michroma 400 (`@expo-google-fonts/*`), JetBrains Mono kept; **Rajdhani and
  Noto Sans JP are subset** into `assets/fonts/` by `tools/subset-fonts.sh` (Rajdhani 360 → 39 KB per weight — the
  package carries Devanagari; Noto JP 5.4 MB → 70 KB, ADR-16 kanji + kana). Space Grotesk and Manrope removed.
  `components/T.tsx` faces: display/title/eyebrow/body/medium/semibold/mono/monoBold/badge/kana.
- `components/ui/`: `ClusterHero`, `TelltaleRow` (9 hand-drawn 24 px icons), `BoostRing` (`GaugeRing` is now an alias,
  same API), `LcdDigits` (7-segment SVG, ghost segments, fixed boxes), `Badge`, `HazardDivider`, `CarbonFrame`,
  `Hanko`, `CornerGrid`, `Timeline`; `OdometerHero` is a thin wrapper over `ClusterHero` until Phase 2.
  `StatusPill` vencido = solid red + white; buttons/chips use `accentFill`, labels in Saira uppercase.
  `lib/domain/cluster.ts` — what the needle reads (fraction of the nearest interval used). Home passes it, so the
  gauge is live now.
- `lib/motion/gaugeSweep.ts` — sweep once per cold start (module flag), 500 ms lamp test, vencido blink 1 Hz × 10 s,
  80 ms LCD flicker; all honour reduced motion, nothing loops idle.
- `app/dev/tokens.tsx` — every token and component in both schemes, "Repetir el barrido", a live contrast list.
  Screenshots `docs/qa/imp-28092026-phase-1-tokens-{dark,light}.png` (the `phase-1-*` names belong to IMP 17092026).
- Icon + splash: `tools/make-icons.mjs` redraws the mark (240° tach, amber → red wedge, needle into the red, hub,
  "085"; twill on the lower half) and generates the carbon tile; all icons regenerated. Native assets refresh at the
  next EAS build.
- `lib/flags.ts` — `FEATURE_ALBUM/BUILD/DIY/TRACK/SHARE = false`.

### Dependencies added / removed
- added `@expo-google-fonts/saira-condensed@^0.4.1`, `@expo-google-fonts/michroma@^0.4.2` — the display and badge faces
- added `expo-asset@~57.0.18` — resolve the carbon tile's URL on web (it was only a transitive dependency)
- removed `@expo-google-fonts/space-grotesk`, `@expo-google-fonts/manrope` — replaced
- not added: `@expo-google-fonts/rajdhani`, `@expo-google-fonts/noto-sans-jp` — subset files ship instead
  (`npm i --no-save` both before re-running `tools/subset-fonts.sh`)

### Acceptance criteria
- [x] Migration v2 exactly per spec; v1 untouched; data migration idempotent; tests for 0→2 and 1→2 with the fixture —
  `migrate-v2.test.ts` (one deliberate difference in the view, see Deviations).
- [x] All new repos and types; `history_feed` v2 with `created_at` ordering.
- [x] DTC table bundled (MIT notice), Spanish for 100 % of rows, generator committed — 3,142 rows; 126 of them honestly
  "sin verificar" rather than a wrong translation.
- [x] `sql/009` + `sql/010` applied; types regenerated; `SYNC_TABLES`/`BOOLEAN_COLUMNS` updated; parity test covers
  002 + 009; `verify-x-core` **12/12**, `verify-sync` **14/14**. Plus an end-to-end run: the real engine on web pushed
  the seeded v2 garage to a throwaway account (all 15 checked tables present, nickname/status/chassis intact, 0 parked)
  and a second browser profile pulled it back (0 parked). Test users removed with `999` (`leftover_profiles = 0`).
- [x] Backup v2 includes the new tables; import round-trips — `backup-v2.test.ts`.
- [x] Fonts swapped; Space Grotesk and Manrope gone (no reference left in app/components/lib/constants/tools).
- [x] Tokens per spec in both schemes; every text pair on the tokens page ≥ 4.5:1 — 31 pairs × 2 schemes in
  `contrast.test.ts`. Lowest: dark — pill urgente 4.59, text.muted/raised 4.79, redlineText/raised 4.91, white/redline
  4.97; light — pill ok 4.55, pill urgente 4.57, pill próximo 4.89, accent ink/raised 5.04. Full list on the page.
- [x] Components: all ten previewed in `dev/tokens` (dark + light screenshots).
- [x] Gauge sweep once per cold start; reduced motion respected; nothing loops idle — by construction in
  `gaugeSweep.ts` (module flag, finite sequences); seen sweeping on web. Not measured on a device.
- [~] Icon/splash regenerated and flags added — yes. **Fuel flow + weekly check verified on web** (Playwright: fill-up
  52,950 km → review sheet 50.0 km/gal → Historial; weekly check 9/9 OK → "Todo al día" with the new BoostRing).
  **Android: not verified on a device** — none attached and no AVD on this machine; `npx expo export -p android`
  compiles the Hermes bundle cleanly. Needs a phone run (Expo Go or a preview build).

### Decisions made (defaults applied)
- **240° = 8 → 4 o'clock.** The spec says "240° (7 → 5 o'clock)", which is 300°; the mockup's arc is ~230° and
  symmetric, so the dial and the icon use 240° symmetric about the top.
- Deterministic ids for every derived row (see Part A) — not in the spec, needed so two devices converge.
- `vehicle.garage_role` is local-only (not in the cloud): it is *my* role and would be wrong for other members.
- `vehicle_member`: §5's cloud shape now (PK vehicle + user, generated `id`), select-only for clients, pull-only in the
  engine. Nobody can write it until PROMPT-07's RPCs.
- `updated_by` only on the new tables; the v1 tables get it in PROMPT-07 (protects 2.0.0 pulls of fuel_log & co.).
- Carbon: one tiled PNG everywhere (CSS background on web, `resizeMode="repeat"` natively) instead of an SVG pattern.
- Telltales and the cluster are always dark panels, also in light mode (spec: instruments stay dark).
- Fonts subset for size (Rajdhani, Noto JP) — ~1.8 MB less on first load than installing the packages.
- The Phase 0 fixture is frozen (v2.0 shape); `garage.test.ts` no longer rewrites it.
- The cluster's reading is live on Inicio now (nearest km interval, else days), rather than waiting for Phase 2.

### Deviations from the package
- `history_feed`: a `mejora` record is hidden **only when a live mod stands for it** (spec hides all of them). Until
  PROMPT-04 makes "Mejora" create a mod, the v2.0 form still writes plain mejora records, and the spec's view would
  make each new one vanish from Historial. Tested both ways.
- `CornerGrid` labels DI/DD/TI/TD per the spec; the setup-sheet wiring is PROMPT-06.
- Screens were not restyled beyond what the tokens do on their own (Phase 2 is the identity pass).

### Observed, deferred
- See the table above (2.0.0 pull parking, DTC review, catalogue names, web warnings, expo patches, bundle size).

### Design check
- Tokens artboard: palette, type, pills, telltales, dividers, carbon, hanko, LCD all present on `dev/tokens`.
- Inicio artboard (partial — Phase 2 rebuilds the screen): ClusterHero matches the mockup's arc, gradient, red wedge,
  numerals and LCD; the header/chips/QuickActions are still v2.0 layout. Pills still sit under the dial (TelltaleRow
  not wired to reminders yet).
- Deviation: 240° symmetric vs the spec's "7 → 5" wording (above).

### Flags flipped
- none (all five added as `false`)

### Notes for the next phase
- Home: replace `OdometerHero` with `ClusterHero` + `TelltaleRow` and delete the wrapper; `clusterReading()` already
  feeds the needle. Map reminders to lamps by service type (oil/coolant/tire/battery/brake/document/fuel/checklist).
- `T face="eyebrow"`/`"badge"` apply uppercase + tracking themselves; pass a `fontSize`, the tracking scales with it.
- Use `theme.accentFill` for amber *fills* (light mode's `accent` is the dark ink); red text is always
  `redlineText`/`dangerText`/`statusText.vencido`.
- Web dev server: do **not** start it with `CI=1` — it disables Metro's file watching and serves a stale bundle.
  The PWA service worker also caches in dev; the Playwright helpers unregister it first.
- Types regen: `SUPABASE_ACCESS_TOKEN=<ACCESS_TOKEN from .env.supabase> npm run types:gen`.

### Addendum — Android on the phone (2026-09-28, branch `imp-28092026/phase-1-android-check`)

- **Build:** `eas build --local --profile preview` (EAS key, cert SHA-256 `a16450a0…`, the same as the installed
  2.0.0 — checked with `apksigner` before installing). A `gradlew assembleRelease` build is signed with the RN debug
  key (`fac61745…`) and would have needed an uninstall, wiping the real garage; it was built and **not** installed.
  The first EAS attempt died with the disk full (13 MB free): freed ~10 GB (the failed build's own 5 GB workdir,
  regenerable build outputs, `npm cache verify`).
- **Backup:** Xaviel made one himself before the install (`adb backup`'s on-phone confirm is not a button Claude may
  press, and the in-app export only offers messaging apps on this phone).
- **Migration on the real data:** installed with `adb install -r` over 2.0.0; first launch ran v2 with no JS error;
  the DS3, its 51,900 km and its history are intact (September's RD$ 12,499.96 matches the pre-upgrade home screen).
- **Identity:** Saira/Rajdhani/Michroma render; ClusterHero, LCD and the carbon tile (tiled via `resizeMode="repeat"`)
  look right natively.
- **Canaries, on a throwaway vehicle "Prueba QA borrar" (removed afterwards):** two fill-ups → review sheet 400 km,
  **36.4 km/gal**, RD$ 8.39/km ✓; weekly check 9/9 OK → "Todo al día" with the BoostRing ✓.
- **Bug found and fixed:** the needle was fed only *due* reminders (`attentionReminders`), so an all-green car read
  "Nada pendiente". Home now passes every evaluated reminder to `clusterReading()`. JS-only; it ships with the next build.
- **Observed:** the check runner's elapsed timer re-renders every second, so `uiautomator dump` never reaches idle on
  that screen (pre-existing since 2.0; not an animation of this phase). The home screen does go idle.
- **Incident, no harm done:** during the fill-up, taps made on a stale screen dump landed in Telegram (the chat where
  the backup had just been sent) and typed "305" into its message box. It was cleared without sending; nothing was
  sent. The phone helper now refuses any input unless Car Guy is the foreground app, and fails loudly on a stale dump.

