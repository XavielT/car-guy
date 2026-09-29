# Progress — IMP 28092026 (Car Guy 2.1 "Hachi-Gō")

Claude Code appends a report per phase (block in `00-context/04-conventions.md`, plus *Design
check* and *Flags flipped*). "Notes for the next phase" carry context between sessions.

**Started:** 2026-09-28 · **Status:** Phase 6 done

## Phase status

| # | Phase | Status | Branch | Notes |
|---|---|---|---|---|
| 0 | Kickoff | ✅ | `imp-28092026/phase-0-kickoff` | folder rename still pending (manual) |
| 1 | Schema v2 + JDM tokens | ✅ | `imp-28092026/phase-1-schema-tokens` | cloud 009/010 applied; Android verified on the Redmi 2026-09-28 |
| 2 | JDM screens + Garaje | ✅ | `imp-28092026/phase-2-jdm-screens` | web + Android (Redmi) verified 2026-09-28 |
| 3 | Álbum / memoria | ✅ | `imp-28092026/phase-3-album` | web + Android (Redmi) verified 2026-09-28; sql/011 applied |
| 4 | Build log | ✅ | `imp-28092026/phase-4-build` | web verified 2026-09-28; Android device check pending (phone not connected) |
| 5 | DIY | ✅ | `imp-28092026/phase-5-diy` | web verified 2026-09-28; Android device check pending with Phase 4's |
| 6 | Pista | ✅ | `imp-28092026/phase-6-track` | web verified 2026-09-28 (dark + light, web↔web sync); Android device check pending with Phases 4–5 |
| 7 | Compartir | ✅ | `imp-28092026/phase-7-share` | sql/012–014 applied; verify-x-core 23/23, verify-sync 17/17, local-rls 32/32 (2026-09-29); Android checked; WhatsApp preview pending |
| 8 | Release 2.1.0 | 🟡 | `imp-28092026/phase-8-release` (on top of phase 7) | backlog + docs + version done; regression on Android, builds, release pending |

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
| 2 | Web console on Cifras: `Unknown event handler property onStartShouldSetResponder…` (7 warnings) from `react-native-gifted-charts`' bar touchables on react-native-web | low | dev only; charts pass `disablePress`, the library still forwards the responder props |
| 2 | The Garaje's hero cover has only the v2.0 vehicle photo or a favourite album photo to show; the seeded garage has neither, so every card shows the carbon placeholder until Phase 3 | low | by design until FEATURE_ALBUM |
| 3 | Web thumbs have no blurhash: `Image.generateBlurhashAsync` is Android/iOS only. Web cells show the well colour until the (local, fast) thumb loads | low | a JS blurhash encoder would add ~5 KB if it matters |
| 3 | "Guardar original en Google Fotos/Drive" opens the share sheet once per photo (expo-sharing shares one file). In the viewer it shares the stored 1600 px copy — the untouched original only exists at import time, so the viewer's label says "copia" | low | a multi-file share needs a native module |
| 3 | Over-quota refusal verified live against Storage with a 1-byte quota on a throwaway user; the 90 % / 100 % meter states verified in unit tests only (no account holds 270 MB) | low | — |
| 4–6 | ~~Phases 4, 5 and 6 not yet run on the Redmi~~ — **done 2026-09-29** on the 2.1.0 preview (Phase 8 report) | closed | install the latest preview build (Phase 6's is built); check share-as-image (specs + day summary), long-press, the ficha's share sheet, the runner's fluid card, WhatsApp/tel links, the CornerGrid keyboard "next" order natively |
| 6 | Heat cycles count once per tire per **event** (the "Gomas usadas" tick), not per session | low | a per-session tick is a second picker on the session screen if anyone wants it |
| 6 | Personal bests are per venue; `venue.layout` exists but events do not record which layout was run | low | add `track_event.layout` when a venue with two layouts shows up |
| 4 | `inventory_item` has no column linking an item to the mod that used it; "Usar en un mod" prefills the mod form and appends "Usado en: <mod>" to the item's notes | low | a `used_in_mod_id` column needs migration v4 + cloud SQL; not worth it until someone filters by it |
| 4 | The ficha image on web is html2canvas's rendering (fonts and the dark card come through; a long value is clipped at the card edge, as on screen) | low | — |
| 5 | Presets hold only platform facts (bolt pattern, bore, lug thread, brake fluid type, tank, engine code); oil capacities, plug gaps and tire pressures are left null on purpose | low | the user fills them from the manual; a reviewed data source could extend the presets later |
| 5 | vPIC decodes US-market VINs; EU VINs mostly fail (verified with a DS3-shaped VIN → ErrorCode 7) and JDM cars have no VIN — the copy says so and nothing blocks | low | by design (research §D) |

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



## Phase 2 — JDM screens + Garaje + vehicle hub   (branch `imp-28092026/phase-2-jdm-screens`)

**Status:** complete
**Commits:** `feat(ui): JDM identity on every screen, Garaje tab, vehicle hub …`, `chore(i18n): voice additions …`,
`docs(imp-28092026): phase 2 report`

### Changed
- **Navigation** — `app/(tabs)/_layout.tsx`: Inicio · Garaje · Historial · Cifras · Más (Ionicons speedometer /
  car-sport / time / stats-chart / ellipsis; labels Saira uppercase). `app/(tabs)/chequeo.tsx` → `app/chequeo/index.tsx`
  (stack), reached from Inicio's CHEQUEO action, the checklist telltale, Más → Chequeos and notifications.
  `routeOf()` maps the pre-2.1 `/(tabs)/chequeo` route still carried by scheduled notifications. `unstable_settings.anchor`
  kept. Stack headers draw their title in Saira uppercase through `headerTitle` (the `title` option stays sentence case —
  it is also the browser tab title).
- **Inicio** (`app/(tabs)/index.tsx`) per Main.dc.html: CAR GUY 車 · TABLERO header with the hanko → Cuenta; vehicle chips
  (active amber, katakana nick via `toKatakana`, `· PROYECTO` suffix); `ClusterHero` fed by `clusterReading()` over every
  evaluated reminder (PRÓX. SERVICIO line with km and ~date); `TelltaleRow` inside the cluster from `lampStates()` —
  aceite, refrigerante, gomas, batería, marbete/seguro from reminders, chequeo semanal from the last weekly inspection;
  Pendientes top-2 (reminders + tasks merged, Badge + mono countdown); QuickActions GASOLINA · CHEQUEO · MANTENIMIENTO ·
  GASTO (BUILD/PISTA take slots 3–4 when their flags are on); ESTE MES 記録 strip; marbete banner; economy insight.
  `OdometerHero` deleted.
- **Garaje** (`app/(tabs)/garaje.tsx`, new): ACTIVOS · PROYECTO · EX filter chips (toggle; none = all), hero card for the
  active vehicle, 2-up cards, EX · LOS QUE YA NO ESTÁN with dashed cards (ownership line, photo count, 記憶), + Agregar
  vehículo. Cover = `hero_media_id` → first favourite album photo → v2.0 vehicle photo.
  `lib/domain/garage.ts` (new, pure): derived badges (engine code red when the car has installed mods, discipline amber
  from the last track event or mod tags, DAILY/PROYECTO/GUARDADO/EX), `isArchivedFor`, `ownershipLine`, `toKatakana`,
  `lampStates`. `lib/db/garageQueries.ts` (new): `garageFacts()` (mods, tags, discipline, photos, open tasks, ownership,
  favourite cover) and `lastWeeklyCheck()`.
- **Vehicle hub** (`app/vehiculo/[id].tsx`): cover, name + katakana + nick + badges, status pill, ownership line, `LcdDigits`
  odometer; segmented in-page tabs Resumen · Álbum · Build · Ficha · Pista · Docs (tablist/tab roles; `?tab=` deep link) —
  Resumen (story, totals, specs, vida útil) and Docs work, the rest show "Próximamente" unless their flag is on. Actions
  Editar · Cambiar estado (sheet) → Vendido opens the sale sheet (fecha, km ≥ current odometer, precio, a quién, razón)
  → `sellVehicle()` closes `vehicle_ownership`, sets `vendido` + `is_archived`, writes the sale odometer reading
  (`odo_sale_<id>`), then the "Escribe la historia del carro" sheet. Compartir/Libro hidden behind `FEATURE_SHARE`.
  `lib/db/vehicleOps.ts`: `setVehicleStatus()` (guardado ⇔ archived), `sellVehicle()`, `saveVehicleDraft()` writes the
  identity fields and mirrors purchase data into `own_<id>`.
- **VehicleForm**: nickname, chassis code/number, engine code, transmission, drivetrain, origin, imported year, story
  (multiline), status — in a collapsible "Identidad" section.
- **Identity pass**: Historial (month header Saira 800 + mono subtotal, category colours, 56 px amber square FAB), Cifras
  (mono KPIs, chart colours from tokens with the light inks on light), Más (eyebrow section headers, `ScreenTitle`),
  chequeo list/runner/result (BoostRing progress, "Todo al día" green, hanko), PriceBoard as a dark instrument with amber
  mono price boxes, reminders, tasks, documents, onboarding (mark + hanko), cuenta, precios, notificaciones, reporte,
  exportar, +not-found, BootError, AlertHost, Sheet, Field/DateField labels as eyebrows. `components/ui/ScreenTitle.tsx`
  (new). Light mode: ClusterHero and PriceBoard stay dark panels.
- **PDF report** (`lib/report/html.ts`): dark header band, Saira title, derived badges; body pages stay printable on white.
- **Strings**: `es.garage`, `es.hub`, `es.vehicleStatus`, `es.cluster`, `es.voice` (all of 05-design-jdm.md "Voice
  additions").
- **Tests** (679 → 697 … 455 at Phase 0): `__tests__/domain/garage.test.ts` (badges, katakana, ownership line incl. no
  purchase date, lamps), `__tests__/db/vehicle-status.test.ts` (status ⇔ archived, sale closes ownership, favourite
  cover), `__tests__/notifications/route.test.ts` (legacy chequeo route), chart marks ≥ 3:1 in `contrast.test.ts`.

### Dependencies added / removed
- none

### Acceptance criteria
- [x] Five tabs; Chequeo reachable from QuickActions, telltale, Más and notifications; old route mapped — verified on web
  (tabs screenshot, `/chequeo`, runner via the list) and by `route.test.ts`; on the Redmi `am start -d carguy://chequeo` opens the moved Chequeo screen.
- [x] Inicio matches Main.dc.html structurally — header, chips, ClusterHero, TelltaleRow, Pendientes, QuickActions, month
  strip (`imp-28092026-phase-2-inicio-*.png`).
- [x] Garaje with hero card, 2-up cards, EX section; the Jetta seed shows as Ex ("2018 → vendido 2021 · 0 fotos").
- [x] Vehicle hub with in-page tabs; status change incl. the sale sheet → ownership closed, story prompt — web run on the
  seeded C3: sale sheet → story prompt → Garaje shows it under EX; `vehicle-status.test.ts` checks the rows.
- [x] Every legacy screen restyled; light mode verified (screenshots in both schemes); contrast list below.
- [x] Sweep once per cold start (module flag in `gaugeSweep.ts`, unchanged since Phase 1); reduced motion respected.
- [x] Fuel flow + weekly check on web: fill-up 52,400 → 52,800 km → review sheet **400 km, 38.1 km/gal** → Historial;
  weekly check 9/9 OK → "TODO AL DÍA" with the BoostRing and hanko. Android (Redmi, throwaway "Prueba QA borrar", deleted after): two fill-ups 10,100 → 10,500 km → review
  **400 km, 36.4 km/gal, RD$ 8.25/km** → Historial; weekly check 9/9 OK → "TODO AL DÍA"; the chequeo telltale went
  próximo → al día; status → Proyecto from the hub sheet shows on the Garaje card.
- [x] tsc, lint, 697/697 tests, `npm run build` (46/46 pages titled) green.

### Contrast (WCAG, lowest first)
- Dark text pairs: pill urgente 4.59 · text.muted/raised 4.79 · redlineText/raised 4.91 · dangerText/raised 4.91 ·
  white/redline (pill vencido, red badge) 4.97 · dangerInk/danger 4.97 · text.muted/surface 5.12. Chart/category marks
  (3:1 floor): album 3.47 · reparación 5.25 · track 5.65.
- Light text pairs: pill ok 4.55 · pill urgente 4.57 · pill próximo 4.89 · accent ink/raised 5.04 · accent ink/base 5.26 ·
  statusText.ok/surface 5.37 · text.muted/raised 5.39. Marks: mejora 3.98 · otros 3.99 · inspección 4.00.
- Every pair ≥ 4.5 (text) / ≥ 3 (marks) is enforced by `__tests__/theme/contrast.test.ts`;
  `PRINT_CONTRAST=1 npx jest __tests__/theme/contrast.test.ts` prints the list.
- a11y: each telltale is a button labelled "<fuente>: <estado>"; the cluster is `summary`; hub tabs and Segmented are
  `tablist`/`tab` with `selected`; vehicle chips announce name, nick and PROYECTO.

### Decisions made (defaults applied)
- Screenshots are `docs/qa/imp-28092026-phase-2-*.png`: `docs/qa/phase-2-*.png` already holds IMP 17092026's Phase 2 set.
- The engine badge shows only on a modified car (a stock engine code is spec, not a badge); an active stock car is DAILY.
- Garaje filters toggle; with none selected every group shows (the artboard shows all three).
- Pendientes merges reminders and open tasks worst-first (a critical task from a failed check outranks an oil change).
- Ex with no purchase date reads "Vendido 2026", not "¿? → vendido 2026".
- The sale's km may be empty, but never below the current odometer.
- Más' "Build / Pista / DIY / Compartir" sections stay out until their flags turn on; "Datos" keeps backup/restore.

### Deviations from the package
- Tab icons are Ionicons equivalents of Main.dc.html's hand-drawn set (car-sport for the garage).
- The status sheet offers activo/proyecto/guardado/vendido; `perdido` (in the data model) is not offered in the UI yet.

### Observed, deferred
- See the table above (gifted-charts responder warnings on web; placeholder covers until the album).

### Design check
- **Inicio · Cluster** — structure matches: header, chips with katakana/PROYECTO, dial with gradient + redline wedge,
  LCD odometer with the needle-coloured last digit, PRÓX. SERVICIO line, six lamps, Pendientes, 2×2 actions, ESTE MES
  strip. Deviation: slots 3–4 are MANTENIMIENTO · GASTO until FEATURE_BUILD/TRACK (as the prompt says); the account
  card still sits between the cluster and the actions for signed-out users.
- **Garaje** — filters, hero, 2-up, dashed EX with 記憶, add button: match. Covers are the carbon placeholder (no photos
  in the seed; Phase 3).
- **Álbum / Build / Pista** — hub tabs exist and say "Próximamente"; their artboards are Phases 3/4/6.
- **Tokens** — unchanged from Phase 1; chart marks now use the light inks on light.

### Flags flipped
- none

### Android (Redmi Note 10 Pro, 2026-09-28)
- **Build:** `eas build --local --profile preview` (needs `ANDROID_HOME=~/Android/Sdk` in the environment — the first
  attempt failed at Gradle without it). 23 min: every run compiles all 644 tasks in a fresh temp dir, native code for
  four ABIs. Cert SHA-256 `a16450a0…` on both the new APK and the installed one (checked with `apksigner`) →
  `adb install -r`, data kept. No schema change this phase.
- **Real data:** cold start with no JS error; the DS3, 51,900 km and its reminders read correctly on the new Inicio.
- **Canaries:** see the acceptance criteria (fuel, weekly check, deep link, status change), all on a throwaway
  vehicle that was then removed; the DS3 is the only vehicle again.
- Screenshots `docs/qa/imp-28092026-phase-2-android-*.png` (status bar cropped off — it carries notification icons).
- **Found and fixed:** `Sheet` ignored the bottom safe-area inset, so on edge-to-edge Android the last button
  ("Listo" on the fill-up review) sat on the navigation bar and reported zero bounds to accessibility. Pre-existing
  since 2.0; `paddingBottom` now adds `insets.bottom`. **Verified on the Redmi** with the arm64 preview build
  (2026-09-28 16:16): the DS3's "Cambiar estado" sheet ends with padding above the navigation bar; sheet closed with
  Back, nothing picked, status still Activo.
- **Preview builds are arm64-only** since `chore(eas)` (`gradleCommand … -PreactNativeArchitectures=arm64-v8a` in
  `eas.json`): Gradle 23m 25s → 5m 42s, APK 117 → 50 MB, same cert. Production still builds all four ABIs.
- Not measured on the device: the sweep timing and reduced motion (same code as Phase 1); light mode was checked on web.
- The check runner still never lets `uiautomator dump` go idle (timer re-render, noted in Phase 1); driven by
  screenshot coordinates instead.

### Notes for the next phase
- Phase 3 (Álbum): the hub's `album` tab and `garageFacts().favoriteMediaId` / `photos` are ready to read album rows;
  the Garaje and hub covers already fall back to the first favourite. `es.voice.albumEmpty` is the empty state.
- `vehicleBadges()` takes `lastDiscipline`/`tags` — Phase 6's track events light the amber badge with no UI change.
- The phone helper (scratchpad `phone.py` pattern): refuse input unless `mCurrentFocus` is Car Guy, fresh dump per tap.


## Phase 3 — Álbum, fotos viejas, hitos, "así estaba", Ex   (branch `imp-28092026/phase-3-album`)

**Status:** complete
**Commits:** `feat(album): álbum, importar fotos viejas, visor, hitos, así estaba, Ex …`, `docs(imp-28092026): phase 3 report`

### Changed
- **Media pipeline v2** (`lib/media/index.ts`): one `ingest()` for every photo — the date is read **before**
  compressing (the manipulator strips EXIF): EXIF `DateTimeOriginal` → MediaStore creation time / `File.lastModified`
  → the user; then a 1600 px / q0.75 copy and a 400 px / q0.6 thumb (Android `media/<vehicle>/<id>.jpg` +
  `.thumb.jpg`; web `blob` + `thumb_blob`), a blurhash on native, `media` with `taken_at` / `date_precision` / `source`
  / size, and an `album_item`. Duplicates skipped by `(width, height, taken_at, size)` per vehicle (also within one
  batch). `pickCandidates()` (picker, EXIF from the picker natively, exifr on web), `importCandidates()` with progress
  and cancel, `saveOriginal()`; `pickPhoto()` keeps its API and now makes thumbs too. `useMediaUri(id, { thumb })`.
  `lib/media/exif(.web).ts` (exifr **lite**, static import on web only), `lib/media/library(.web).ts` (Android gallery:
  permission `['photo']`, limited access + `presentPermissionsPicker`, years, month counts from one
  `exeForMetadata()`, month photos, candidates; web stubs).
- **Sync** (`lib/sync/mediaBytes.ts`, `lib/db/syncOps.ts`): uploads the thumb first, then the full copy
  (`<user>/<id>.thumb.jpg` / `.jpg`), records `remote_thumb_path`; pre-2.1 rows get their thumb uploaded once a 2.1
  device made it. Downloads stay lazy — thumb for grids, full copy only in the viewer — cached as local bytes (not
  signed URLs: the bytes are then offline too). Deleting a photo removes both objects. **Quota**: the client stops
  before a photo that cannot fit the last reading, and a Storage refusal (403 / RLS) sets `paused`; nothing uploads
  while paused; `refreshStorageMeter()` after every sync reads `storage_usage_bytes()` + the profile quota into a
  local setting and un-pauses when there is room (`lib/sync/storageMeter.ts`).
- **Cloud** (`sql/011_storage_v2.sql`, applied): the `carguy-media` insert policy gains the quota check; a trigger
  pins `profiles.media_quota_bytes` against client writes (003's table-level UPDATE grant would otherwise let a user
  raise their own quota — found while writing the check). `verify-x-core` 12 → **14/14** (13: thumb path allowed for
  the owner, refused for another user; 14: a user cannot raise its quota). Live probe: at a 1-byte quota Storage
  answers `403 new row violates row-level security policy`, which is exactly what the app reads as "full".
- **Screens**: `app/vehiculo/[id]/album/index.tsx` (Línea de tiempo | Cuadrícula, year scrubber, month headers with
  the odometer then, HITO / MEJORA (ANTES/DESPUÉS pair) / PISTA / MANTENIMIENTO (services with photos) / FOTOS cards,
  "+N", the one hazard divider on this month, storage meter; grid rows fixed-height with `getItemLayout`),
  `app/album/importar.tsx` (Android year → month grid with counts → month photos with checkboxes, "Seleccionar mes",
  selection across months; web file input; confirmation sheet with where each date came from, a date for the
  undated ones or "todas", precision DÍA/MES/AÑO, target vehicle (Ex included), originals; progress + cancel;
  "N importadas · M repetidas"), `app/foto/[id].tsx` (dark pager, pinch/pan/double-tap zoom on gesture-handler +
  reanimated, real date + precision, caption, favourite, save/download copy, soft delete; only the page on screen loads its full copy),
  `app/hito/nuevo|[id].tsx` + `components/album/MilestoneForm.tsx` (kind chips, date, km, title, story, photos from
  the album or new, cover), `app/vehiculo/[id]/album/estado.tsx` (date track + month steps, `stateAt()` → odometer,
  mods on the car, ficha with the mod that set each value, photos then, "Fijar como snapshot" → `spec_snapshot`).
  Components `PhotoThumb` (expo-image, blurhash, `recyclingKey`), `StorageMeter`, `ZoomableImage`, `AlbumTab`.
- **Hub / Ex**: the Álbum tab shows the latest photos + the ways in; an Ex opens **read-only** (no edit/status/remove,
  no spec edits, banner) with "Editar historia" to unlock for the visit; its ownership line carries the photo count
  ("2018 → vendido 2021 · 22 fotos"). The album and the importer work for Ex vehicles. Garaje / hub covers already
  fell back to the first favourite (Phase 2).
- **Elsewhere**: Historial opens `hito` rows; its FAB picker gains Hito · Foto al álbum; Cuenta shows the meter;
  `vercel.json` rewrites for the new dynamic routes; stack titles for every new screen; `es.album/importer/viewer/
  hito/estado`; `GhostButton` takes `style`.
- `lib/domain/album.ts` (pure): `parseExifDate` (local wall clock), `resolveTakenAt`, `dateAtPrecision`, `dupKey` /
  `isDuplicate`, `buildTimeline` (precision-aware sections, event-linked photos, service photos, orphans stay in),
  `odometerNear`, `gridSections` / `flattenGrid` / `gridLayout`, `albumYears`, `stateAt`, `storageLevel` /
  `fitsQuota` / `formatBytes`. `lib/db/albumQueries.ts` feeds it.
- `FEATURE_ALBUM = true`.
- **Tests** 697 → **732**: `__tests__/domain/album.test.ts` (26: EXIF parse incl. local time and the unset clock,
  fallbacks, precision dates, duplicates, timeline grouping by precision, pairs, orphans, odometer, grid offsets, years,
  `stateAt` before/after a swap and a removal, meter thresholds), `__tests__/db/album.test.ts` (9, real SQLite: the delete cascade, album
  + service photos, milestone link/unlink, date fix pushes, thumb-before-full upload, quota refusal pauses, early stop
  on a full reading, delete removes both objects).

### Dependencies added / removed
- added `expo-media-library ~57.0.5` (Android month browser; plugin with `granularPermissions: ['photo']`,
  `savePhotosPermission: false`, no media location), `expo-image ~57.0.5` (blurhash, recycling), `exifr ^7.1.3`
  (web EXIF, lite build), `react-native-gesture-handler ~2.32.0` (was only transitive; the viewer's zoom)
- removed: none

### Acceptance criteria
- [x] Media rows carry `taken_at` (+ precision), `source`, thumbs, blurhash (native); sync uploads both and downloads
  thumb-first — `album.test.ts`, web run (22 rows with thumbs).
- [x] Android month browser import with dates — 23 test photos picked across 15 months (2018-01 … 2021-03): "23 de la cámara", 22 imported · 1 repeated. Limited-access banner: code path only (the Redmi is Android 13, which has no partial access). Web multi-file import with EXIF —
  web: 23 files → 19 dated "de la cámara", 4 "del archivo" (no EXIF), 22 imported · 1 repeated.
- [x] Album grid/timeline per spec; year scrubber; before/after pairs (unit-tested; the seed has no mod_media yet —
  Phase 4 creates them); storage chip.
- [x] Photo viewer with zoom, caption, real date, favourite, original/copy save, soft delete — web; on the Redmi: double-tap zooms 2×, a swipe while zoomed pans (stays 13/22), un-zoomed it pages (14/22). Pinch itself not exercised (adb input is single-touch)
- [x] Milestones create/edit; appear on the timeline (web) and in Historial (feed kind since Phase 1; row now opens).
- [x] "Así estaba" + snapshot pin.
- [x] Ex read-only hub + album import for Ex (the Jetta: 22 photos, "2018 → vendido 2021 · 22 fotos").
- [x] Quota policy applied, meter thresholds, upload pause at 100 % (live refusal probe + unit tests).
- [x] `FEATURE_ALBUM` on; tests added; `verify-x-core` 14/14, `verify-sync` 14/14; tsc, lint, 732/732, build
  (52/52 pages titled, `dist` 8.0 MB).

### Decisions made (defaults applied)
- Downloaded bytes are kept locally instead of caching signed URLs in memory: same egress on first view, zero after,
  and photos work offline. Signed URLs arrive with the public page (PROMPT-07).
- The date typed in the confirmation sheet fills only the undated photos; "Todas son de otra fecha" applies it to all.
  Photos keeping their own date keep day precision.
- A photo linked to a record the timeline does not draw (deleted hito, a mod kind it skips) stays in the album as a
  loose photo rather than vanishing.
- Service records' own photos appear on MANTENIMIENTO cards without becoming album items (no duplicate rows).
- The "así estaba" range runs to the later of the sale date and the newest record, so a year-only sale ("2021") does
  not cut off that year's photos; date-only strings are read as local noon.
- Screenshot names `imp-28092026-phase-3-*` (IMP 17092026 already owns `phase-3-*`).
- `sql/011` also pins the quota (trigger) — not in the spec, needed for the quota to mean anything.

### Deviations from the package
- Signed-URL memory cache → local byte cache (above).
- The viewer's "Guardar original…" saves the stored copy (the original exists only at import time, where the
  confirmation sheet offers it).

### Design check
- **Álbum artboard**: eyebrow "<NICK> · ÁLBUM 記録", LÍNEA DE TIEMPO, amber 44 px import button, year scrubber, month
  headers in Saira 800 with the mono odometer and the hazard stripe on the current month, rail + coloured dots,
  HITO red / MEJORA green / JUNTE amber badges, 3-up thumbs with "+N", ANTES/DESPUÉS tags, the storage card at the
  bottom — all present. Deviation: the scrubber is a row of year buttons (tap to jump) rather than a filled progress
  rail; the "Grid" mode and the action row (Agregar hito · Así estaba) are additions.

### Flags flipped
- `FEATURE_ALBUM` → true

### Verification runs
- **Web** (Playwright, fresh profile, seeded garage): 23 generated JPEGs (19 with EXIF 2018–2021, 4 without, one exact
  copy) into the Jetta → confirmation "20 ene 2018 → 28 sept 2026 · 19 de la cámara · 4 del archivo" + the WhatsApp
  warning → "22 importadas · 1 repetida" → timeline Sept 2026 (the 4 file-dated) then Mar 2021 … Jan 2018; grid + jump to
  2019; viewer 1/22; the Jetta hub read-only with "2018 → vendido 2021 · 22 fotos"; a VENTA hito on the timeline;
  "así estaba"; 0 page errors.
- **Sync, web → web** (throwaway account `carguy-ui-…`, removed with 999): the importing profile signed up and pushed;
  Cuenta's meter read **665 KB de 300 MB**. A fresh profile signed in and pulled; opening the album downloaded
  **22 thumbs, 0 full copies**; opening one photo downloaded **1** full copy. (First run: 12 — the pager rendered ten
  pages, each fetching its full image; fixed before the report.)
- **Android** (Redmi Note 10 Pro, Android 13, arm64 preview build, same EAS cert `a16450a0…`, `adb install -r`, data
  kept): 26 generated test JPEGs pushed to `Pictures/CarGuyQA` (a folder of their own; file mtimes set to the EXIF
  dates so MediaStore's DATE_TAKEN is right), a throwaway vehicle "Prueba QA borrar". After Xaviel tapped ALLOW
  (a system dialog — not Claude's to press): year chips 2026 → 2018, month counts, month grids, 23 selected →
  "IMPORTAR 23 FOTOS · 20 ene 2018 → 05 mar 2021 · 23 de la cámara" → "22 importadas · 1 repetida" → timeline Mar 2021
  … Jan 2018, grid jump to Dec 2019, viewer 13/22 with zoom (above). Then the throwaway was removed (dialog checked to
  name it), the test photos deleted from storage and MediaStore (0 rows left), and the DS3 is the only vehicle again,
  51,900 km intact. Screenshots `docs/qa/imp-28092026-phase-3-android-*` show only the test photos; the month grids,
  which show Xaviel's own gallery, were not saved.
- **Found and fixed on the phone:** the year list stopped at 2026 (undated gallery photos sort first ascending —
  `libraryYears` now skips them); the importer's "N seleccionadas · REVISAR" footer sat on the navigation bar with a
  squeezed button (absolute positioning ignores the safe area); grid cells were labelled "1 / 1" for TalkBack (now the
  photo's date).
- **Found and fixed while cleaning up:** `deleteVehicleCascade` tombstoned the photos but none of the v2 rows (album
  items, hitos, ownership, mods, specsheet, snapshots, tires, track events…), which would have been pushed as live
  orphans. The cascade now covers every vehicle-scoped v2 table (inventory stays; `vehicle_member` is the server's);
  test added.
- **Phone connection:** the USB link kept dropping (MIUI's "Use USB for" dialog on every reconnect — dismissed with
  Back, no choice made). The run finished over `adb tcpip`; afterwards adb went back to USB mode and the temporary
  "stay awake on USB" (`svc power stayon usb`) was turned off (`stay_on_while_plugged_in = 0`).

### Notes for the next phase
- Phase 4 (Build): `mod_media` with roles `antes`/`despues` lights the timeline's pairs (`modPairs()`); mod photos
  should go through `ingest(…, { vehicleId, modId })` so they land in the album too. `stateAt()` already applies
  `spec_effects` in install order — the Specs tab can reuse it for "ACTUAL".
- `albumPhotos()` is the one query for "every photo of this car"; the public page (PROMPT-07) should read favourites
  from it.


## Phase 4 — Build log   (branch `imp-28092026/phase-4-build`)

**Status:** complete
**Commits:** `feat(build): build log — mods, specs stock → actual, wishlist, inventario, gomas …`, `docs(imp-28092026): phase 4 report`

### Changed
- **Domain** — `lib/domain/build.ts`: `SPEC_FIELDS` is the one contract for `spec_effects`, `stock` and `overrides`
  (18 keys in Motor · Chasis · Ruedas · Dimensiones; 4 headline fields), `cleanSpecs()` validates on every save (unknown
  keys dropped, numbers coerced, "mucho" is not 0); `currentSpecs()` = stock ⊕ installed mods in `installed_at` order ⊕
  overrides, with `{ value, stock, source: stock | mod:<id,name> | override }` per field — derived, never stored;
  `modTotalDop`, `investedByCategory` / `investedTotal` (installed + removed) / `netInvested` (− `sold_price_dop`),
  `foreignToDop`, `wishlistTotalDop`, `wishlistToModDraft`, tag badges (SWAP, TUNE, DRIFT, TURBO, OEM+, JDM, DIY), and the
  category → reminder map (gomas → cambio_gomas, frenos → pastillas_frenos, enfriamiento → refrigerante).
  `lib/domain/tires.ts`: `parseTireSize` (195/50R15 82V, ZR, 185/60-14, 165SR13 with the assumed 82 %, partial input
  never throws), `tireDiameterMm` / `circumferenceMm` / `revsPerKm`, `compareSizes` (diff % and speedo error),
  `dotAge` (WWYY, ≥ 6 years flagged, pre-2000 three-digit codes flagged old), `offsetDelta` (poke / inset mm),
  `parseWheelSpec` ("15x8 ET0", "7Jx17 ET42", "15x9 -5").
- **DB** — `lib/db/buildQueries.ts`: `buildData()` (mods, categories, row thumbs from `mod_media`, wishlist, specsheet,
  snapshots, wheel sets, tires, the car's + the garage's inventory), `saveMod()` (clean effects, an odometer reading
  `odo_mod_<id>` with the new source **`mod`**, closes the wishlist item, remembers `last_fx_rate_usd`), `modAction()`
  (quitar / vender with price / dañado / reinstalar / reclasificar — nothing deleted), mod photos with roles,
  `reminderResetFor()` / `applyReminderReset()`, stock + overrides, snapshots, wishlist, inventory, `mountWheelSet()`
  (the other set comes off, this set's tires take the corners), tires. `OdometerSource` gains `'mod'`.
  **Migration v3**: `history_feed` only — a mod row's subtitle is `<status>|<brand>` so Historial can say
  Instalado / Quitado (the view is local; no cloud or data change). `importCandidates()` now returns the new media ids.
- **Screens** — `app/vehiculo/[id]/build.tsx` per Build.dc.html: eyebrow "<NICK> · BUILD 改", MODS / SPECS / WISHLIST /
  INVENTARIO chips, invested total + installed count, STOCK → ACTUAL card (tap → SPECS), mods grouped by system with
  subtotals, rows with thumb or system icon, tag badge, mono meta (date · km · who/where · USD · "+ aduana RD$"), total,
  status dot; long-press (native) / "⋯" (web — a mouse has no long-press) → Quitar / Vender / Se dañó / Reinstalar /
  Cambiar categoría / Editar; the open wishlist inline at the end, dashed with the AHORRANDO outline pill; "+ AGREGAR MOD".
  `components/build/SpecsTab.tsx` (grouped Stock | Actual with the source chip, tap → override / clear, stock editor,
  "Fijar snapshot", snapshot list, share as image — native share sheet, PNG download on web). `ModForm` (`app/mod/nuevo|[id]`:
  searchable systems, name/brand/part/variant, status, install date + km with the odometer warning, installer + contact,
  foreign price × tasa = RD$ helper with "Usar como precio", parts/labour/shipping/customs, vendor + link, "Afecta la ficha"
  mini-form, photos with roles (tap cycles DESPUÉS → ANTES → …, long-press removes), replaces, tags, notes; saving a new
  gomas/frenos/refrigerante mod offers to reset its reminder). `WishlistForm` (`app/wishlist/nuevo|[id]`: priority,
  foreign price + currency + envío + aduana → estimate, vendor, link, target, status, "Convertir a mod"). Inventory:
  `app/inventario/nuevo|[id]` (kind, qty, unit, condition, location, cost, garage-level; "Usar en un mod"),
  `app/ruedas/[setId]` (spec parsed as typed, bolt pattern, bore, status, its tires, "Montar en <vehículo>"),
  `app/goma/[id]` (size parsed, DOT decoded live and flagged at 6 years, compound, treadwear, tread, heat cycles, set,
  position, status).
- **Integration** — hub: Build tab (STOCK → ACTUAL, open, add) and on Resumen "N mods · RD$ invertido" + top 3 badges; hub
  "Gasto total" and Cifras now include mods (a mod migrated from a v2.0 "mejora" record is skipped — its record carries
  the cost); Cifras "Inversión en mods" tile (all-time); Historial mod rows open the mod, subtitle Instalado / Quitado ·
  brand, chip MEJORAS → MODS; "Mejora" in the service form (and `/servicio/nuevo?kind=mejora`) opens the mod form, editing
  a v2.0 mejora record stays a record; "Así estaba" labels from `SPEC_FIELDS`. `FEATURE_BUILD = true` (Inicio's BUILD
  quick action was already wired).
- **Tests** 732 → **757**: `__tests__/domain/build.test.ts` (18: the AE85 seed 3A-U → 4A-GE 20V and 13x5 → 15x8 ET0
  derived with sources, removal falls back to stock, later mod and override precedence, planned/cosmetic ignored,
  `cleanSpecs`, money, FX, wishlist estimate + conversion, tags, tires incl. 165SR13 and the speedo, DOT, offsets, wheel
  specs), `__tests__/db/build.test.ts` (7, real SQLite + the real-garage seed: source chips, override/clear, wishlist
  conversion writing the odometer and closing the item, removal keeps history and money, selling, mounting a set, stats
  counting mods once).

### Dependencies added / removed
- added `react-native-view-shot 5.1.0` (share the ficha as an image; web uses its html2canvas path)

### Acceptance criteria
- [x] `build.ts` + `tires.ts` with tests; derived specs with sources.
- [x] Build tab per artboard: grouped, subtotals, badges, lifecycle, wishlist inline, + button.
- [x] Mod form complete incl. FX helper, spec effects, photo roles, odometer reading, reminder offer; "Mejora" alias.
- [x] Specs tab with stock / actual / override / snapshot; share-as-image — web downloads the PNG (verified);
  Android: compiled into the preview APK, not yet run on the phone (see below)
- [x] Wishlist with priorities and conversion; Inventario with wheel sets, tires (DOT, cycles), parts.
- [x] Historial / Cifras / hub integration; `FEATURE_BUILD` on; sync verified web ↔ web (below) — Android sync not run
  (the phone has no account, and signing it in would upload the real garage).
- [x] tsc, lint, 757/757, build (61/61 pages titled), `verify-x-core` 14/14, `verify-sync` 14/14.

### Verification (web, Playwright, the AE85 seed, dark and light)
- Start: RD$ 17,000 invertido · 5 instalados. (1) **USD + aduana, affects the ficha**: Escape 4-1 Tanabe, USD 350 × 60.5
  = RD$ 21,175 → "Usar como precio", aduana 5,200, 52,600 km, hp 168. (2) **Wishlist conversion**: the coilovers form opens
  prefilled ("De tu wishlist…"), aduana 9,000, 52,650 km. (3) Asiento Bride Zeta, RD$ 25,000, tags jdm, drift. →
  **RD$ 140,900 · 8 instalados** (by hand: 17,000 + 26,375 + 72,525 at the remembered 60.5 + 25,000), STOCK → ACTUAL
  HP — → 168 hp. Removed the seat (⋯ → Quitar): it stays listed and in the money. SPECS: sources shown (SWAP 4A-GE 20V,
  ESCAPE 4-1 TANABE, AROS 15X8 ET0…); "Compartir ficha como imagen" downloaded `ficha-hachi-gō.png` (the full table).
  Inventario: DOT "sem 23/2023 · 3.3 años"; a new "Set pista 15x9 ET-5" mounted → Aros 15x8 GUARDADO, Set pista MONTADO.
  Historial: "Quitado", "Instalado · BC Racing"…; Cifras "Inversión en mods RD$ 140,900"; hub "7 mods · RD$ 140,900
  invertido". 0 page errors in both schemes. Screenshots `docs/qa/imp-28092026-phase-4-*-{dark,light}.png`.
- **Sync web → web** (throwaway account, removed with 999): the pushing profile and a fresh pulling profile show the same
  build — RD$ 140,900, the three mods, HP 168, "1 convertidos a mod", Set pista MONTADO / Aros GUARDADO, 4 tires.
- **Found and fixed while verifying**: a mouse cannot long-press — web rows got a "⋯" actions button; that button and
  the wheel set's "Montar" sat inside the card's own button (nested `<button>`, invalid HTML and a React warning) — they
  are siblings now; `cleanSpecs` turned "mucho" into 0 for a number field.

### Android
- The arm64 preview APK builds (Gradle 4m 45s) and is signed with the EAS key (`a16450a0…`); view-shot's native module
  is in it. **Not run on the Redmi**: the phone was not connected when the phase closed, and Xaviel left the call to
  Claude — merged on the web verification, with the device check (a throwaway vehicle: a mod with USD + aduana, STOCK →
  ACTUAL, native long-press actions, the ficha's share sheet, a tire's DOT) to run the next time the phone is plugged in.
- **Android sync not run by design**: the phone has no account, and signing it in would upload the real garage; the
  round trip was verified web ↔ web instead. That stays Xaviel's decision (NEXT.md "Still yours").

### Decisions made (defaults applied)
- The stock value of a field nobody filled is "—", not "OEM" (the artboard's "OEM → tuneada"): Car Guy does not know it
  was OEM.
- Planned / ordered mods are listed but not counted in "invertido" or the ficha; removed / sold / damaged are counted in
  the money and not in the ficha.
- Mods count in Cifras and the hub total as "Mejoras"; a mod migrated from a v2.0 record is skipped there (its record
  already counts), so nothing is double-counted.
- "Usar en un mod" records the link in the item's notes (no schema change this phase).
- The FX rate remembered is USD's (the spec's `last_fx_rate_usd`); other currencies start from it and are edited.

### Deviations from the package
- Web gets a "⋯" button for the row actions (the spec names long-press only).
- Migration v3 is a view-only change (the spec did not plan a v3; needed for Instalado / Quitado in Historial).

### Design check
- **Build artboard**: eyebrow + MODS title + amber mono total with "invertido · N instalados", the four chips, the
  STOCK → ACTUAL mono card with amber actuals, category eyebrows with mono subtotals, rows (48 px thumb, name + red SWAP
  badge, mono meta with "USD 1,050 · + aduana RD$ 9,000", mono total, green dot), the dashed wishlist row with the
  AHORRANDO outline pill, "+ AGREGAR MOD" amber — all present. Deviations: the row thumb is the system's icon until the
  mod has a photo; the "⋯" on web.

### Flags flipped
- `FEATURE_BUILD` → true

### Notes for the next phase
- Phase 5 (DIY): the ficha técnica's presets write `vehicle_specsheet` columns (oil, fluids, torques) — separate from
  `stock` / `overrides`, which stay the build's. `SPEC_FIELDS` is the place to add a field both screens show.
- `CATEGORY_SERVICE` is the one map from a mod system to a reminder; add entries there.


## Phase 5 — DIY: ficha técnica, fluidos, OBD, contactos   (branch `imp-28092026/phase-5-diy`)

**Status:** complete (Android device check pending, as Phase 4)
**Commits:** `feat(diy): ficha técnica con presets y VIN, guía de fluidos, códigos OBD, contactos …`, `docs(imp-28092026): phase 5 report`

### Changed
- **Domain** — `lib/domain/specPresets.ts`: `FICHA_FIELDS` (the 26 service-data columns of `vehicle_specsheet`, by
  section Motor · Fluidos · Encendido y eléctrico · Gomas y aros · Combustible, with units), 15 `SPEC_PRESETS` (AE85 3A-U,
  AE86 4A-GE 16V, 4A-GE 20V engine preset, S13 SR20DET/KA24DE, S14, Civic EG/EK D16/B16, C3 TU5JP4, DS3 EP6 VTi/THP,
  Corolla E120/E150, Hilux N70, Yaris) — **only platform facts**, everything uncertain null, each with its `sources` and
  "Verifica con el manual de tu carro"; `presetsFor()` (chassis + engine > chassis > make + model; spaces/dashes ignored,
  family codes match variants), `applyPreset()` (empty fields only, marked `preset`), `fichaText()` (plain text for
  WhatsApp). `lib/domain/vpic.ts`: `checkVin()` (17 chars, no I/O/Q, and a JDM frame number "AE85-5012345" told apart),
  `vpicErrorCode()` (the leading integer), `mapVpic()` (decoded only with ErrorCode 0/1 **and** a model), `decodeVin()`
  (8 s abort, never throws). `lib/domain/contacts.ts`: `normalizePhone()` (DR 809/829/849 gain the 1), `whatsappLink()`,
  `telLink()`, `formatPhone()`. `lib/domain/fluids.ts`: 8 cards with the checklist's "cómo revisar", `fluidForItem()`
  (inspection label → card), `isTirePressureItem()`. Kinds follow the schema's types (`coolant`, `washer`; `gomera`,
  `pintor`, `dealer`).
- **DB** — `lib/db/diyQueries.ts`: `readFicha` / `setFichaValue` (source TÚ, drops the verified mark) / `setVerified` /
  `loadPreset` (also the build's stock engine code + displacement when empty) / `applyVin` (make, model, year, gearbox,
  drive, stock displacement — empty only); torques; fluids (one card per kind, derived id); OBD `logDtc` (normalised
  code), resolve, `repairsFor`, `linkDtcRepair`, `createRepairForDtc` (a reparación titled "Código P0301", linked);
  contacts + `contactLinks()` (services and mods). `serviceOps` takes `contactId`. **Migration v4**: `history_feed`
  gains `obd` rows (code, abierto/resuelto) — view only, local, v3's mod subtitles kept. (The prompt called this v3;
  Phase 4 had already used v3.)
- **Screens** — `app/vehiculo/[id]/ficha` (sections, value + source chip PRESET/VPIC/TÚ + "Verificado por mí" checkbox,
  tap to edit/clear, "Cargar preset" with the car's matches first, "Decodificar VIN" with honest copy for no VIN / a
  frame number / invalid / not decoded / offline, torques with a photo of the manual page, the car's OBD codes, "Ficha
  lista para el taller" — the share sheet natively, the Web Share API or the clipboard on web); `app/vehiculo/[id]/fluidos`
  (a card per fluid: photo, how-to, notes); `app/obd/index` (search, Spanish + English, generic/manufacturer note, log
  against a car, the log) and `app/obd/[code]`; `app/contactos/index|nuevo|[id]` (by kind, call + WhatsApp buttons,
  rating, notes, what they did). `components/diy/`: `DtcPieces`, `ContactPieces` (`ContactPicker`: saved contacts +
  "Otro (escribir)"), `FichaTab`.
- **Integration** — hub Ficha tab (headline values, open codes, the ways in); the service form's shop field is the
  contact picker (the name still goes to `shop`); the mod form's installer uses it too; the inspection runner shows the
  fluid card inline ("Aquí está el refrigerante en tu DS3") and the OEM psi on "Presión de gomas"; Historial opens `obd`
  rows, FAB "Código OBD"; Más → DIY (Contactos, Códigos OBD). `FEATURE_DIY = true`.
- **Tests** 757 → **778**: `__tests__/domain/diy.test.ts` (15: every ficha field is a real column, every preset parses
  with typed values + caveat + source, matching, empty-only apply, the shop text, vPIC error codes, a **recorded** US decode
  (`__tests__/fixtures/vpic-1HGCM82633A004352.json`) and a recorded EU failure, timeout/network never throw, frame
  numbers, DR phone normalisation and links, P0301 in Spanish, P1300 manufacturer, fluid matching), `__tests__/db/diy.test.ts`
  (6, real SQLite + seed: DS3 preset keeps a user value and fills 3, verify + retype, VIN fills empty only, P0301 → repair
  → feed obd row, contact links).

### Dependencies added / removed
- none

### Acceptance criteria
- [x] Presets with honest nulls and caveats; source chips and verification toggle.
- [x] vPIC decode on demand with graceful failure; chassis code first-class (frame numbers are not VINs).
- [x] Fluids guide with the user's photos, surfaced in the inspection runner.
- [x] OBD lookup + per-vehicle events + link to repair; bundled Spanish table.
- [x] Contacts with WhatsApp/call, linked to services and mods.
- [x] Migration v4 (feed with obd); `FEATURE_DIY` on; tests; tsc, lint, 778/778, build (68/68 pages titled),
  `verify-x-core` 14/14, `verify-sync` 14/14.

### Verification (web, Playwright, the seed, dark and light — 0 page errors)
- DS3: "Cargar preset" → Citroën DS3 (EP6 1.6 VTi) → "4 datos del preset" (flagged PRESET); verified Patrón de tornillos
  and Centro del aro (green checks); a torque "Tuercas de rueda 100 Nm" with a photo; the shop text copied ("FICHA · DS3 ·
  2015 Citroën DS3 / Motor… (Verifica con el manual de tu carro)").
- Fluids: a Refrigerante photo → the weekly check on the DS3 shows "AQUÍ ESTÁ EL REFRIGERANTE EN TU DS3" with it.
- OBD: P0301 → "Fallo de encendido en el cilindro 1" / "Cylinder 1 Misfire Detected", generic; logged at 51,900 km →
  "Vincular a reparación" → "+ Nueva reparación" opens the record "CÓDIGO P0301"; Historial shows the obd row.
- Contacts: "Gomera La 27" (809 555 1234 → Llamar + WhatsApp buttons); a service "Bujías y bobinas" with Taller de Tony
  picked → Tony's page lists it next to the seed's swap and ECU. Más → DIY present.
- Screenshots `docs/qa/imp-28092026-phase-5-*-{dark,light}.png`.
- **Android**: the arm64 preview APK builds (4m 38s, EAS-signed); not run on the phone (not connected) — pending with
  Phase 4's check.

### Decisions made (defaults applied)
- Presets carry only data I am sure is standard for the platform; the DS3's oil norm (PSA B71 2290) is the one oil value
  included. A preset never overwrites a value the user or another source put there.
- A 4x4 from vPIC is stored as `awd` (the schema's Drivetrain has no 4WD).
- The contact picker keeps writing the name to `shop`, so v2.0 screens and the report still show who did it.
- A fluid card appears in the runner only when it has a photo or notes (an empty card says nothing new).

### Deviations from the package
- Migration v4, not v3 (v3 was Phase 4's view change).
- "Vincular a reparación" links via `vehicle_dtc_event.repair_record_id`; the record has no dtc source column, so its
  title/description name the code.

### Design check
- No artboard for this block; the screens follow the identity (eyebrow + Saira title, mono values, source chips in the
  badge face, amber for PRESET/VPIC and green for TÚ/verified, one accent per card).

### Flags flipped
- `FEATURE_DIY` → true

### Notes for the next phase
- Phase 6 (Pista): the hub's Pista tab and `vehicleBadges()`' `lastDiscipline` are waiting; `consumable_usage` + tires
  from Phase 4 (`heat_cycles`, `quemada`) are the consumables' home; `contactPicker` can serve "organizador".

## Phase 6 — Pista: eventos, sesiones, setup copy-forward, tiempos, consumibles   (branch `imp-28092026/phase-6-track`)

**Status:** complete (Android device check pending, with Phases 4–5)
**Commits:** `feat(track): eventos y sesiones de pista con setup copy-forward, tiempos, consumibles y resumen del día …`, `docs(imp-28092026): phase 6 report`

### Changed
- **Domain** — `lib/domain/track.ts`: `parseLap` / `formatLap` (`m:ss.mmm` ⇄ integer ms, "83.456", "1:05,12", rejects
  "1:75"), `formatSeconds`; `SHEET_FIELDS` (the setup sheet's 45 fields with Spanish labels); `copyForward` (the sheet
  only, `changed_from_previous = []`), `diffSheets` (null / missing / hydro-off are the same), `describeChanges` (a pair
  that moved together reads "TI/TD 40 → 42"); `pressureDeltas`, `flagRearGrowth` (> 8 psi, rears only);
  `eventSummary` (sessions, runs, laps, best lap, burned tires, km on track — none when the odometer went backwards —
  and RD$); `isTimed` (drift and junte count runs); `personalBests` (best timed lap per venue); `heatCycles`; `padLife`
  (mm per session since the last pad change, sessions left, `due` under 5 mm track / 3 mm street).
- **DB** — `lib/db/trackQueries.ts`: venues (list, add); events (`listEvents` with summaries, `eventDetail`,
  `saveEvent` → odometer start/end readings with source **`track`** and derived ids, `deleteEvent` tombstones sessions,
  sheets, usage and readings); sessions (`sessionDraft` = next number + the last sheet copied forward, `saveSession`
  recomputes `changed_from_previous` against the previous session, `copyToNextSession`, `deleteSession`); consumables
  (`setTireUsed` — one heat cycle per tire per event, derived id, untick gives it back; `burnTire` → tire `quemada`, off
  the car, the corner kept on the usage row; `measurePads`); `padSeries` / `padStatus`; **`syncPadReminder`** — the
  reminder hook: "Pastillas (pista)" (service type `pastillas_frenos`, metric date, due = next event or +30 d) armed when
  an axle is due, switched off when new pads are measured; `vehicleBests`, `trackLine`, `eventPhotos`.
  `OdometerSource` gains `'track'`. Cifras: `spendRows` adds the events' entrada + gasolina + otros as a new **`pista`**
  category (orange, `categoryColors.track`), `VehicleStats.trackDays`.
- **Screens** — `app/pista/index` (vehicle filter, MEJORES VUELTAS strip, próximos / pasados cards: venue, date,
  discipline badge, sessions, best lap or runs, gomas quemadas); `app/pista/evento/nuevo|[id]` (vehicle, venue chips with
  the seeded Autódromo + "Agregar pista", date, name, organiser, discipline chips TRACK DAY · DRIFT · DRAG · AUTOCROSS ·
  JUNTE · PRUEBA, weather chips + temps, condition, odometer, costs, notes; then its sessions, GOMAS Y PASTILLAS, the
  day summary and photos through the album pipeline with `trackEventId`); `app/pista/sesion/nueva|[id]` per
  Pista.dc.html (eyebrow "SUNIX · 21 SEPT DE 2026 走り", "DRIFT · SESIÓN 2", CLIMA / PISTA / RUNS or MEJOR cards; the
  pressure card with a cold CornerGrid and a hot one comparing against it, the rear over 8 in red and "Traseras +9 psi:
  normal en drift." — on a timed day "bájales en frío"; the live "Cambiaste desde la sesión 1: …" note; tire sets and
  sizes/compounds, camber grid, toe/caster, heights grid, springs, dampers + clicks, sway bars, pads/bias; ÁNGULO · LSD +
  hydro on drift/junte; LAUNCH on drag; TIEMPOS on timed days (laps, best/second as m:ss.mmm, sectors, 0–100, 60 ft, ¼
  mile + trap) else RUNS; incident; feel chips SUBVIRA · NEUTRAL · SOBREVIRA · NERVIOSO · LENTO + stars; notes, driver,
  video link; RESUMEN DEL DÍA; COPIAR A SESIÓN N+1 · COMPARTIR RESUMEN). `components/track/`: `TrackPieces` (EventCard,
  BestsStrip, `DaySummaryCard` + `shareCardImage` / `summaryText` / `shareSummaryText`, the hub's `TrackTab` and
  `TrackSummaryLine`), `EventForm`, `SessionForm`.
- **Integration** — Historial opens `pista` rows (orange, discipline subtitle — the v2 view already had them); Cifras
  "Días de pista" tile (count + RD$ in the period) and the Pista slice in both charts; hub Resumen "N eventos · PB Sunix
  1:23.456" and the Pista tab; Álbum PISTA/JUNTE cards now open the event; Más → DIY → Pista; Inicio's PISTA quick action
  opens the index. `FEATURE_TRACK = true`. Routes registered in `_layout` + `vercel.json`.
- **Seed** — `lib/dev/garage.ts` `seedTrack()`: the AE85's "Drift day Sunix" (7 days before seeding, soleado 33 °C, con
  goma, 52,200 → 52,286 km, RD$ 9,800), session 1 práctica 6 runs (rears 40 → 47/46), session 2 batalla 8 runs copied
  forward with the rears at 42 (→ 51/50, "de lao' fácil", "Temp. subió en run 11"), rears marked used, pads 7/8 mm. A
  garage seeded before Phase 6 gets the drift day on its next "Sembrar garaje".
- **Tests** 778 → **801**: `__tests__/domain/track.test.ts` (17: lap parse/format round trip, copy-forward, diff + the
  paired note, deltas, rear flag at exactly 8, summaries, PBs, heat cycles, pad life incl. new pads and the street
  threshold), `__tests__/db/track.test.ts` (6, real SQLite + seed: the artboard's summary, s2's stored diff + red rears,
  copy-forward without runs/incident, no double heat cycle + burned tire, the pad reminder armed on the next event's date
  and cleared by new pads, track odometer readings + Cifras spend + feed row + delete cascade). The DB test caught a real
  bug: a sheet saved without `spring_unit` "changed" it against a stored default — defaults now count as values.

### Dependencies added / removed
- none (react-native-view-shot from Phase 4, expo-sharing already present)

### Acceptance criteria
- [x] Domain with tests; pad-life reminder hook.
- [x] Events + sessions + copy-forward setup sheet per artboard; drift/timed variants.
- [x] CornerGrid input with cold→hot deltas and rear-growth flag.
- [x] Consumables: heat cycles, burned tires, pad measurements.
- [x] Day summary shareable — image (share sheet on Android; a PNG download on web, captured with html2canvas — it
  worked, so the PDF fallback was not needed) and text (share sheet / Web Share / clipboard).
- [x] Historial/Cifras/hub/Álbum integration; `FEATURE_TRACK` on; sync verified web↔web.
- [x] tsc, lint, 801/801, build (73/73 pages titled), `verify-sync` 14/14, `verify-x-core` 14/14.

### Verification (web, Playwright, fresh profiles, dark and light — 0 page errors)
- Seed → the index shows "SUNIX · 21 SEPT DE 2026 · DRIFT · DRIFT DAY SUNIX · 2 sesiones · 14 runs"; session 2 reads
  "Cambiaste desde la sesión 1: TI/TD 40 → 42 · TI caliente 47 → 51 · TD caliente 46 → 50" and "Traseras +9 psi:
  normal en drift." with the TI cell red.
- Through the UI: a drift event "Drift test web" at the Autódromo (soleado 31 °C, con goma, 52,400 → 52,470, RD$ 5,500)
  → "+ Nueva sesión" → session 1 cold 30/30/40/40, hot 34/34/47/46, 6 runs, 55° → COPIAR A SESIÓN 2 opens "DRIFT ·
  SESIÓN 2" with TI copied at 40 → rears to 42 / 51 / 50 → the same note and red highlight live.
- Consumables: a rear marked USADA (ciclo 1 → 2), the other rear burned (QUEMADA, gone from the usable list), pads 4.5 /
  7 mm → "Menos de 5 mm para la próxima: recordatorio "Pastillas (pista)" creado." and the reminder is in Recordatorios.
- Share: text "DRIFT · Autódromo de las Américas (Sunix) · 28 sept de 2026 / Trueno AE85 / Drift test web / 2 sesiones /
  14 runs / 1 goma quemada / 70 km en pista / RD$ 5,500.00 gasto"; the image downloaded
  (`imp-28092026-phase-6-summary-card-*.png`).
- Historial row "Drift test web · 28 sept de 2026 · 52,400 km · drift"; hub line "2 eventos"; Cifras "DÍAS DE PISTA 2 ·
  RD$ 15,300.00 en el período" and the orange Pista stack; Álbum shows the DRIFT card; Más → Pista; the hub odometer
  reads 52,470 from the track reading.
- **Sync**: the dark profile created an account and pushed; a fresh profile signed in and pulled both events (cards,
  summaries, "1 goma quemada"), session 2's note (setup sheets + `changed_from_previous`) and "Pastillas (pista)".
  Test users cleaned (`leftover_profiles: 0`).
- Screenshots `docs/qa/imp-28092026-phase-6-*-{dark,light}.png`.
- **Android**: the arm64 preview APK is built; not run on the phone (not connected) — pending with Phases 4–5.

### Decisions made (defaults applied)
- A new event defaults to the Autódromo and DRIFT (the garage's reality); both are one tap to change.
- "Gomas usadas" is per event (one heat cycle per day at the track), with a derived id so it cannot double count.
- A burned tire leaves the car (`position = unmounted`, status `quemada`) but stays in the inventory's history.
- The pad reminder is switched off, not deleted, when new pads read above the line — its history stays.
- The pad threshold is 5 mm (measurements are taken on track days); the domain takes 3 mm for street use.
- Venue names show their short form ("Sunix") on cards and eyebrows, the full name in the summary.

### Deviations from the package
- The seed lives in `lib/dev/garage.ts` (where the whole real-garage seed is), not in `app/dev/seed.tsx`, which only
  calls it.
- The "Cambiaste…" note is computed live from the previous sheet (and stored as `changed_from_previous` on save), so it
  is right while editing.
- Web image share is a PNG download (no Web Share for files in Chrome desktop); the PDF fallback was not needed.

### Design check
- Pista.dc.html: eyebrow + kanji, the DISCIPLINE · SESIÓN N title, three stat cards, the PSI card (FRÍO → CALIENTE), the
  red rear with the drift note, the amber "Cambiaste…" line, RESUMEN DEL DÍA with the stat grid, the two buttons. The
  artboard shows pressures as "30 → 34.5" read-only pairs; the screen has two editable grids (cold, then hot with
  deltas), since the same screen is the input.

### Flags flipped
- `FEATURE_TRACK` → true

### Notes for the next phase
- Phase 7 (Compartir): `vehicle_share.show_track` can use `listEvents()` + `summaryText()`; the `DaySummaryCard` is a
  ready piece for the public page; `personalBests()` gives the dossier's PB line.

## Phase 7 — Compartir: ficha pública, libro PDF, garaje compartido   (branch `imp-28092026/phase-7-share`)

**Status:** complete (2026-09-29) — verified live: `verify-x-core` **23/23**, `verify-sync` **17/17** (after Xaviel allowed the runs),
`tools/local-rls` 32/32; test users cleaned. Pending: the WhatsApp preview of a real link after deploy. Earlier status: `sql/012` and `sql/013` were applied
to x-core; the live verification (`verify-x-core` 23 checks, `verify-sync` 17 checks, the public link on a
phone, WhatsApp preview, two-account app scenario, Android) has not run: the auto-mode classifier refused
running the verifiers against production after the RLS swap ("Production Deploy"). Needs Xaviel.

### Changed
- **SQL `012_public_share.sql`** (applied, `--shared`): `carguy.public_dossier(slug) → jsonb` — security definer,
  the only thing anon can do in the schema (EXECUTE + schema USAGE; no table grants). Gated by each `show_*`,
  plate/VIN masked (`A70••••`) when off, costs only with `show_costs`, the share must belong to the vehicle's
  creator. Public bucket `carguy-public` (2 MB, image/jpeg), owner-only write/list by slug, **no anon select
  policy** (verified live as anon: unknown slug → `null`, `GET vehicle` → 42501, bucket list → `[]`).
  Unique slug index. *Deviation:* one definer RPC instead of the spec's `security_invoker` views + anon policies —
  an invoker view needs anon SELECT on the base table, and a row policy cannot hide columns, so VIN/plate/user_id
  would have been readable straight from `vehicle`. The share lives on `vehicle_share` (already synced) — no
  `vehicle.share_enabled/public_slug` columns.
- **SQL `013_members.sql`** (applied, `--shared`, one transaction with a self-check): `vehicle_role(v)` →
  owner/editor/viewer/'free'/null; `can_see / can_edit / can_own`, `vehicle_of(table, id)` for children;
  **generated** policies on 33 tables (select member-or-own-free, insert creator + editor, update/delete editor,
  vehicle delete + vehicle_share writes owner only); `keep_creator` trigger pins `user_id` on update (so the
  client keeps sending its own `user_id` and an editor's push never takes a row over); owner row created by
  trigger on vehicle insert + backfill; `updated_by` on the v1 tables; `vehicle_invite`; RPCs `create_invite`,
  `redeem_invite`, `set_member_role`, `remove_member`; storage policies for both `<uid>/…` and `v/<vehicle>/…`
  (old-layout objects readable by members through `can_read_media_object`); quota charges vehicle folders to the
  owner (and "free" folders to the uploader, so a made-up folder is not free space). Self-check (inside the
  transaction): every account sees exactly its own rows, table by table — passed (the cloud held no real accounts).
- **Client** — `lib/share/dossier.ts` (`slug()`, `publicDossier()` in BaT order, pure, shared by the page and the
  book), `lib/share/html.ts` (self-contained dark page, OG + Twitter tags, `noindex` unless public, escaped, no
  script), `api/c/[slug].ts` (Vercel Node function; `/c/:slug` rewrite first in vercel.json; env
  `SUPABASE_URL/ANON_KEY` falling back to the `EXPO_PUBLIC_` pair already in the Vercel project — no manual step;
  `s-maxage=300, stale-while-revalidate=86400`; 404 page), `lib/share/publish.ts` (enable = row + sync + copy
  favourites ≤ 24 + hero to `carguy-public/<slug>/`; revoke = delete objects, null slug), `lib/db/shareQueries.ts`
  (`localRawDossier()` — the same JSON from SQLite). Screens `vehiculo/[id]/compartir` (visibility, 8 switches,
  photo picker = album favourites, PORTADA, copy/send/preview, revoke), `compartidos` (Más → Links compartidos).
- **Libro PDF** — pdf-lib + @pdf-lib/fontkit (Saira Condensed, Rajdhani, JetBrains Mono embedded, Helvetica
  fallback, glyph-safe text), `lib/book/render.ts` (dark cover with hero, ficha, historia, STOCK → ACTUAL, mods,
  mantenimiento, documentos, pista, photo pages 3×3 centre-cropped by year, ≤ 60), `lib/book/index.ts`, screen
  `vehiculo/[id]/libro` (switches shared with the page, período, fotos, documentos; share sheet / download).
  `buffer` polyfill in `lib/polyfills.ts`; metro resolves `tslib` to its ES build (pdf-lib broke on web otherwise).
- **Sync** — `lib/sync/members.ts` (pure: grants → cursor reset + second pull; revocations → purge prompt; my
  role → `vehicle.garage_role`; `mediaObjectPath`, `UPDATED_BY_TABLES`); push sends `updated_by`; a 42501 batch
  falls back to per-row and a refused row stops retrying (viewer edits stay local); new uploads go to
  `v/<vehicle_id>/`; `purgeVehicleLocal()`; `vehicleScopes()` shared with the delete cascade (which fixes
  consumables being missed — they hang off `event_id`, the cascade looked at `session_id`).
- **Members UI** — `garaje/miembros` (roles, invite code + link, 7 days, optional email lock, role change,
  remove, leave), `invitacion/[code]` (web route + `carguy://invitacion/<code>`), hub: Compartir (owner only) ·
  Libro · Miembros, viewer banner + read-only, "Carro compartido" banner; Garaje: "Ya no tienes acceso" prompt.
  `FEATURE_SHARE = true`.
- **Tools** — `verify-x-core` +9 checks (15–23: anon RPC/list, publish without costs + masked VIN, revoke, B can't
  publish or invite, invite → redeem → sees, editor writes + keep_creator, `v/` storage, viewer refused, removal);
  `verify-sync` +3 (15–17: grant needs the cursor reset, B's push keeps the creator, removal); `999` cleans
  shares/members/invites; `cleanup-probe-media` sweeps `v/<test vehicle>/` and orphaned carguy-public slugs.
- **Tests** 801 → **820** (`__tests__/share/dossier.test.ts`, `api.test.ts`, `__tests__/sync/members.test.ts`;
  album upload paths now `v/veh_a/…`).

### Verified (local, no production access)
- tsc, lint, 820/820, build 78/78.
- Web (dark + light, 0 page errors): Compartir signed out → "Para crear un link necesitas cuenta"; Libro →
  `car-guy_hachi-go_20260928.pdf` (30 KB, cover + content, fonts embedded) downloaded; Miembros / Invitación
  signed out; Más and hub actions. The public page rendered from a fixture
  (`docs/qa/imp-28092026-phase-7-public-page-local.png`). Screenshots `docs/qa/imp-28092026-phase-7-*`.

### Not verified yet (needs Xaviel)
1. `node tools/verify-x-core.mjs` and `node tools/verify-sync.mjs` against x-core (then the 999 cleanup).
2. Merge → push (deploys `api/c/[slug]`), then a real link on a phone without the app, the WhatsApp preview, revoke → 404.
3. The two-account app scenario (A owner, B editor → viewer → removed) and the PDF on Android.
If (1) shows a problem, the rollback block at the end of `sql/013` restores the own-rows policies.

## Phase 8 — Release 2.1.0 "Hachi-Gō"   (branch `imp-28092026/phase-8-release`, stacked on phase 7)

**Status:** in progress. Steps 2 (backlog) and 3 (versions/docs) done; 1 (regression on Android +
upgrade from 2.0.0 with data), 4 (phone table, AAB), 5 (release, web production) and 6 wait for the
phone and for Phase 7's cloud verification + merge.

### Done
- **Backlog** — Cifras y-axis starts at 0 (explicit `yAxisLabelTexts`; gifted-charts rounded its own
  first label to "1"); the 320 px tab label was already fixed in Phase 2 (checked at 320 px); desktop:
  a 560 px centred column on web ≥ 900 px (checked at 1280 px); **PDF documents**: "+ Adjuntar PDF" in
  the document form (expo-document-picker, ≤ 10 MB, stored as a `kind: 'pdf'` media row and synced like a
  photo), "Abrir PDF" on the document (new tab on web, share sheet on the phone) — verified on web.
- **Service worker** — `carguy-v4`; `/c/` and `/api/` are never cached (a revoked public page must not keep
  opening from an installed PWA's cache).
- **Versions** — app.json / package.json 2.1.0; CHANGELOG "2.1.0 — Hachi-Gō" in Spanish by block; README
  feature list; NEXT.md backlog rewritten (closed items, carried items, the dependency blocker below).
- Regression on web (fresh profiles, 0 page errors): the Phase 6 track flow and the Phase 7 share/book flow
  re-run green on this branch.
- tsc, lint, 820/820, build 78/78. Preview APK 2.1.0 building for the phone session.

### Deferred, with reasons
- **SDK patch bumps + `npm audit fix`** — `npx expo install --fix` (expo 57.0.25, @expo/metro-config
  57.0.12) breaks the web dev server: every bundle fails with "Worker chunk not found for
  expo-sqlite/web/worker.ts". Reproduced with expo-sqlite pinned back to 57.0.1 and with the tslib resolver
  disabled, so it is the expo/metro-config bump. `npm audit fix` pulls the same expo within `~57.0.14`, so it
  breaks too. Both reverted; the lockfile is unchanged. Retry with the next expo patch.

### Android (Redmi Note 10 Pro, 2.1.0 preview APK, 2026-09-29)
Installed **over the owner's real garage** (the same-cert 2.0.0-named build from 2026-09-28): installed as an
update, opened on the Tablero with the DS3, El Trueno and C3 intact — the local migrations ran on real data.
Write paths were tested on a throwaway **QA Prueba** car, removed at the end (garage back to 3).

| Check | Phase | Result |
|---|---|---|
| Upgrade over real data, app opens, garage intact | 8 | ✅ |
| Libro del carro PDF (expo-asset fonts, Buffer polyfill, fontkit) → share sheet `car-guy_el-trueno_20260929.pdf` (21 KB) | 7 | ✅ |
| Compartir signed out → "Para crear un link necesitas cuenta…" | 7 | ✅ |
| `carguy://invitacion/ABCD2345` → Aceptar carro with the code, "Entrar o crear cuenta" | 7 | ✅ |
| Documento → "+ Adjuntar PDF" opens the system picker (PDF filter); cancel returns cleanly | 8 | ✅ (no file picked — the picker shows the owner's files) |
| `carguy://vehiculo/nuevo`, `carguy://garaje`, `carguy://contactos/nuevo` deep links | — | ✅ |
| CornerGrid keyboard "next": DI → DD → TI → TD, hot deltas +4/+4/+9/+8 | 6 | ✅ |
| COPIAR A SESIÓN 2 → "Mismo setup que la sesión 1." → rears 42 → "Cambiaste desde la sesión 1: TI/TD 40 → 42" live | 6 | ✅ |
| COMPARTIR RESUMEN → share sheet with the PNG, then the text share | 6 | ✅ (file was named `ReactNative-snapshot-…`; now `pista-<date>-…`, needs the next APK to see) |
| Ficha: Corolla E150 preset → "2 datos del preset", "Ficha lista para el taller" → share sheet | 5 | ✅ |
| Contact "Llamar" → the dialer with (809) 555-0199 prefilled | 5 | ✅ (WhatsApp not opened: the owner's real account) |
| Mod row long-press → Quitar del carro · Vender · Se dañó · Cambiar categoría · Editar | 4 | ✅ |
| Specs "Compartir ficha como imagen" | 4 | not run: disabled on a car without specs; the same capture + share path passed in Phase 6's summary |

Screenshots `docs/qa/imp-28092026-phase-{6,7,8}-android-*.png` (status bar cropped).

### Also found and fixed today
- **sql/014** — `is_member()` returned NULL for outsiders, so `create_invite`'s owner guard never fired (any account could
  invite itself to any car id). Found by `tools/local-rls/run.sh` — the cloud SQL on a throwaway local PostgreSQL 16
  with a Supabase shim, 32 checks as three accounts — before any real account existed. Applied to x-core; 013 fixed in
  place for fresh installs. The local run covers what `verify-x-core` 15–23 and `verify-sync` 15–17 test, minus the
  PostgREST/Storage HTTP layer, which those two still need to prove live.

### Cloud verification (2026-09-29, Xaviel allowed the runs)
- `verify-x-core` **23/23** — incl. 15–17 (anon RPC only, bucket not listable, published share without costs, VIN
  `JT2••••`, revoke → null, B cannot publish A's car) and 18–23 (B cannot invite, invite → redeem → sees, editor writes
  and the car stays A's, `v/<vehicle>/` upload readable by the owner, viewer refused 42501, removal).
- `verify-sync` **17/17** — 15 (after a grant the old cursor misses the car, the reset pull brings it), 16 (B's push with
  its own `user_id` edits the car, `user_id` stays A's, `updated_by` = B), 17 (removed: nothing visible, ended membership
  pulled, push refused). Check 16 first failed on the test itself: check 5 leaves the car's `updated_at` a minute ahead,
  so B's edit at +2 s was correctly dropped by LWW; B's writes are now stamped minutes ahead.
- `sql/999` cleanup: `leftover_profiles: 0`; no probe objects left.

### Production (2026-09-29, after merge)
- Merged phases 7–8 to `main` and pushed. The first deploy's `/c/<slug>` answered 502: the `car-guy` Vercel
  project had **no Supabase env vars at all** — which also meant the production web build ran with the cloud off
  (no account/sync on web since the move to this project). With Xaviel's OK, set `EXPO_PUBLIC_SUPABASE_URL/ANON_KEY`
  (web build) and `SUPABASE_URL/ANON_KEY` (function) for Production + Preview via the Vercel CLI (anon values only),
  redeployed: the web bundle now carries the project URL, and `node tools/smoke-public-page.mjs` passes **6/6** on
  production (renders with OG tags + noindex, unknown slug 404, malformed slug refused at the edge, revoke → 404).
  Test user cleaned. `api/c/[slug]` now sets `X-Car-Guy-Error` (no secrets) on a 502.
- Pending: Xaviel shares a real link in WhatsApp and confirms the preview shows the photo.
