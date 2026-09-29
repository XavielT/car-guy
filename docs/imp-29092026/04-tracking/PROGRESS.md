# Progress — IMP 29092026 (Car Guy 2.2 "Kaidō")

Claude Code appends a report per phase (block in `00-context/04-conventions.md` §9: the usual
sections plus *Design check*, *Flags flipped*, *Notes closed*). "Notes for the next phase" carry
context between sessions.

**Started:** 2026-09-29 · **Status:** Phase 3 done (branch `imp-29092026/phase-3-forms`)

## Phase status

| # | Phase | Status | Branch | Notes |
|---|---|---|---|---|
| 0 | Kickoff | ✅ | `imp-29092026/phase-0-kickoff` | package, baseline, audit, portfolio live, seed |
| 1 | Hotfix 2.1.3 | ✅ | `fix/2.1.3-hotfix` | photos, cloud in the APK, Car Guy-only accounts, reset link, released |
| 2 | Schema v6 + liters + refdata | ✅ | `imp-29092026/phase-2-schema-v6` | migration v6, liters (canary green), trip table, statuses, refdata, sql/019–020 applied; native check pending (no AVD) |
| 3 | Forms v2 | ✅ | `imp-29092026/phase-3-forms` | pickers, gallery, statuses, oil, check photos + atención; web verified, Android pending |
| 4 | Carga parcial | ⬜ | | |
| 5A | Viajes — manual + live | ⬜ | | |
| 5B | Viajes — automático | ⬜ | | |
| 6 | Garaje v2 · launch · versiones · comentarios · costos | ⬜ | | |
| 7 | Web APK · portfolio · release 2.2.0 | ⬜ | | |

⬜ not started · 🟡 in progress · ✅ done · 🔴 blocked

## Notes from the brief (00-context/01-project-brief.md §1)

| # | Note | Closed in | Status |
|---|---|---|---|
| 1 | Wheelz-style trips | 5A/5B | ⬜ |
| 2 | Live speed on the home cluster | 5A | ⬜ |
| 3 | Photos on check issues / new parts, in history | 3 | ✅ ≤5 photos on falla/atención, 📷 N in Historial, CHEQUEO card in the album |
| 4 | Carga parcial | 4 | ⬜ |
| 5 | Historial de versiones | 6 | ⬜ |
| 6 | Bug reports / comments | 6 | ⬜ |
| 7 | Animated launch icon | 6 | ⬜ |
| 8 | Mod costs + car price + what it cost me | 3 + 6 | 🟡 price + date visible in the form (3); Cifras in 6 |
| 9 | Portfolio | 0 + 7 | 🟡 live card verified in Phase 0; APK button in 7 |
| 10 | Several vehicle photos | 3 | ✅ gallery strip, cover, 1/N pager |
| 11 | Liters/gallons, colour picker, make/model/year pickers, body types | 3 | ✅ |
| 12 | Photo error on Android | 1 | ✅ compressPhoto + pending result; 8/8 on the Redmi; phone photo *upload* fixed too |
| 13 | Sign-in message / accounts configured | 1 | ✅ cloud values in every EAS build, user copy, Car Guy-only accounts, reset link to Car Guy |
| 14 | Garage view with all photos, user-arranged | 6 | ⬜ |
| 15 | More statuses (the C3 case) | 2 + 3 | ✅ nine statuses, Desde + Nota, status line everywhere, milestone on change |
| 16 | Oil types picker | 3 | ✅ |
| 17 | APK from the web page | 1 (name) + 7 | 🟡 stable `car-guy.apk` asset from 2.1.3; the web button is Phase 7 |
| 18 | Folder rename | 0 (manual) | ✅ path check done (still `tu-gasolina-rd`); the rename itself is Xaviel's |
| 19 | Where trips live in the app | 5A | ⬜ |

## Audit corrections (Phase 0)

| # | Claim in 02-state-of-the-repo.md | Finding in the code | Consequence |
|---|---|---|---|
| a | `fuel_log.volume` / `vehicle.tank_volume` are gallons for all data | **Mostly.** `lib/fuel.ts`: every fuel type is `gal` **except `gnv`, which is `m3`** (label m³, RD$/m³, economy km/m³). No liters anywhere (`grep 'l'/litros` → none; the only "litres" is vPIC displacement). `tank_volume` is always labelled "Tanque (gal)" (`es.vehicle.tank`), even for a GNV car | Phase 2's liters migration must **not** convert GNV fill-ups (m³ stays m³, or GNV gets its own unit path); a GNV car's tank field needs a thought too |
| b | The Cuenta text with `.env.example` | `es.account.notConfigured` = "La cuenta todavía no está configurada en esta instalación." + `notConfiguredCaption` = "Faltan EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_ANON_KEY. Mira .env.example." (es.ts:1137–1139). Other developer text a user can reach: `inviteOnly` "El servidor todavía no acepta cuentas de Car Guy. Falta aplicar sql/001." (1153) and `schemaNotExposed` "El schema carguy no está expuesto en Supabase (Settings → Data API → Exposed schemas)." (1158–1159). No other string names a file or env var (the `.json` in `notJson`, es.ts:948, is the user's backup file type — fine) | Phase 1 rewrites all four |
| c | schema-parity parses `002` + `009` | It parses **`002`, `009`, `013_members.sql` and `017_track_layout.sql`** (the `LATER` list, added in 2.1.2), plus `007` for the cascade test | New cloud files (018–020) go into `LATER` |
| d | TCO in Cifras (note 8) | **Yes, and more.** `totalCostOfOwnership` = purchase − sale + lifetime spend; `spendRows` sums fuel + service records + expenses + mods (not linked to a service record, so no double count) + track days (entrada + gasolina + otros). Returned **only when a purchase price exists**, per vehicle; no garage-wide total | Phase 6's "lo que me ha costado" can reuse it; the total across cars and the "no purchase price" case are new |
| e | Check-runner photo on `falla` works on Android | Same `PhotoPicker` → `pickPhoto` → `compress()` (`ImageManipulator.manipulate` → `renderAsync` → `saveAsync`, lib/media/index.ts:65–70) as the vehicle photo of note 12 — assumed broken the same way until Phase 1. **Also: there is no `atencion` verdict** — the runner and `inspection_result.result` are `ok | falla | na` only | Note 3's "falla **and** atención" needs a new verdict (schema v6) or is scoped to `falla` — Phase 2/3 decide |
| f | Mod and service photos in history_feed / album | **Album: yes / yes** — mod photos are `album_item`s (`importCandidates` default `album: true`), service-record photos are unioned into the album grid (albumQueries.ts:71) and their records show on the timeline. **Historial: no / no** — `history_feed` has no media column and the Historial screen renders no thumbs. Inspection-result photos are in neither | Phase 3 adds thumbs to Historial rows (and check photos to both) |
| g | eas.json has no env/environment | Confirmed: no `env` block, no `environment` field in any profile | Phase 1 |

Also: `05-manual-checklist.md` was copied into `docs/imp-29092026/` this time (the prompt says "all of it"; last cycle kept it only in the master).

## Baseline (Phase 0)

Run 2026-09-29 on `imp-29092026/phase-0-kickoff` (from `main` at v2.1.2 + docs), path `~/dev2/tu-gasolina-rd`.

| Check | Result |
|---|---|
| `npm ci` | ok; patch-package applied 2 patches (metro-config, react-native-svg) |
| `npx tsc --noEmit` | clean |
| `npx expo lint` | clean |
| `npm test` | **826/826** before the seed change → **830/830** after (4 new seed tests) |
| `npm run build` | ok, **78/78** pages titled |
| `node tools/verify-x-core.mjs` | **23/23** |
| `node tools/verify-sync.mjs` | **17/17** |
| `bash tools/local-rls/run.sh` | **39/39** |
| `node tools/smoke-public-page.mjs` | **6/6** (production) |
| `npm audit` | **3 moderate** (`decode-uri-component` under expo-router's `query-string`; expo-router 57.0.24 is the latest and still on query-string 7) |
| `eas whoami` (token) | ok — `xavieldevs-team` (Owner) |
| `vercel whoami` | `xavielt` |
| `gh auth status` | XavielT, git protocol ssh (`~/.ssh/config` pins the key since 2026-09-29) |
| `adb devices` | **none attached** at baseline time (the Redmi was on USB earlier today) |

The cloud checks leave throwaway `carguy-test-*` users; cleanup (`sql/999_cleanup_test_users.sql --shared`) was run after Xaviel's OK ("clean the test users"): `leftover_profiles` 0.

## Portfolio (Phase 0)

**The Car Guy card is live.** `https://xaviel-web-v2.vercel.app` production bundle contains "Car Guy",
`car-guy.vercel.app` and `car-guy/releases` once each, and no "Tu Combustible" anywhere. `vercel ls
xaviel-web-v2 --prod`: latest production deploy **Ready, 3 h old** (from `main` `7a228f1` "feat: Tu Combustible
RD card becomes Car Guy 2.1"). The card's APK link is `releases/latest` (lands on v2.1.2 today). Local repo: on
branch `imp-11092026/phase-3-admin-shell` (in sync with origin; also carries the card as `2e3057a`), one
untracked `README-1.md`. Nothing deployed from here; Phase 7 points the button at the stable `car-guy.apk`.

## Decisions made along the way

- **Car Guy accounts are Car Guy's own** (Xaviel, 2026-09-29, Phase 1). x-core has one auth.users, so a
  Music Hub email + password signed in to Car Guy. A separate Supabase project would give real isolation
  (same email, two accounts) but the free org is at its 2-project limit (x-core, x-autohub); Xaviel chose
  "stay on x-core, app-tagged". Marker: a `carguy.profiles` row, created only by the Car Guy signup
  trigger (sql/002). Consequence: an email already used in another x-core app cannot become a Car Guy
  account — the user picks another address (Gmail `+carguy` works).

## Deviations from the package

- **`sql/018` is `018_app_membership.sql`** (Phase 1), not the `schema_hint` column the specs reserved it
  for. The 2.2 schema file moves to 019+ (update 02-specs/02-cloud-v3.md references when Phase 2 starts).

## Observed, deferred

| Found in | Issue | Severity | Notes |
|---|---|---|---|
| 1 | A Car Guy account can still sign in to **Music Hub** (it checks invites at signup only) | medium | Music Hub repo change: refuse accounts that have a `carguy.profiles` row and no invite. Not done — other repo |
| 1 | The recovery email is Supabase's generic English template ("Reset your password"), project-level on x-core | low | Changing it changes Music Hub's email too; a neutral Spanish/English one could serve both |
| 1 | No hook-testing library, so useSession's event-order guard is verified on the phone only | low | add `@testing-library/react-native` when a phase needs hook tests |
| 2 | Native (Android) run of migration v6 not done: no AVD on this laptop, disk 91 % full; the Redmi holds the real garage | medium | before 2.2 ships: create an AVD (~1.5 GB) or install a preview build on a second phone; Phase 7's release check covers it at the latest |
| 2 | Economy unit L/100 km is stored and has its maths (units.ts) but screens show km per the vehicle's *volume* unit (km/gal or km/L) | low | Phase 3's unit picker decides; `economyFromKmPerLiter` + `higherIsBetter` are ready |
| 2 | A 2.1.x device editing a v6 fuel row rewrites the gallons only; the bridge detects the stale liters and trusts the gallons — but `schema_hint` stays 'v6' on that row, so *other* 2.1.x devices keep skipping it | low | acceptable while Xaviel is the only multi-device user; 2.2 re-stamps it on its next push |
| 2 | New settings keys (garage_layout, trips_*) are local: not in SYNCED_SETTING_KEYS yet | low | Phases 5/6 decide which travel |
| 3 | Public dossier does not show the status: vehicle_share has no "estado" option | low | needs a share column + public_dossier() change (cloud) — with Phase 6 or 7 |
| 3 | Gallery reorder is "Mover ←/→" in the photo's sheet, not drag | low | same on native and web and reachable with a screen reader; drag can come with Phase 6's garage |
| 3 | Garaje card badge sits on the cover photo and can be hard to read (outline on a busy photo) | low | Phase 6 restyles the cards |

## Blockers

| Phase | Blocker | Needs | Status |
|---|---|---|---|
| 0 | Folder rename `~/dev2/tu-gasolina-rd` → `~/dev2/car-guy` | Xaviel, no session open | open |
| 0 | Cleanup of the baseline's `carguy-test-*` users on x-core (auto-mode refuses `999_cleanup_test_users.sql --shared` without a per-conversation OK) | Xaviel's OK | ✅ done 2026-09-29, 0 leftover |

---

## Phase reports

## Phase 0 — Kickoff   (branch `imp-29092026/phase-0-kickoff`)

**Status:** complete (folder rename pending — manual)
**Commits:** `chore(imp-29092026): kickoff — package, baseline, audit, portfolio check, seed`

### Changed
- `docs/imp-29092026/` — the whole package (00-context, 01-research incl. mockups, 02-specs, 03-prompts,
  04-tracking, 05-manual-checklist.md, README.md) from `~/improvements/imps car guy/september 2026/imps 29092026`.
- `docs/RESUME.md` — pointer to the current cycle; `docs/NEXT.md` — "Cycle 3" section.
- `lib/dev/garage.ts` — purchase prices on all four cars (DS3 875,000 as before; AE85 350,000, C3 180,000,
  Jetta 420,000 — placeholders, commented); the DS3's last six fill-ups mix full and partial (partials at
  i = 4, 2, 1 plus the old i = 6; no gauge data yet); a DS3 "Chequeo semanal" through `saveInspection` with
  one failure ("Luces" — bombillo de freno fundido; its on_fail applies as in the runner); costs on two
  standalone Trueno mods (Aros 15x8: USD 480 × 60 + RD$3,500 envío; Gomas 195/50R15: RD$16,000 + 800).
- `__tests__/dev/garage.test.ts` — 4 tests for the above.

### Dependencies added / removed
- none

### Acceptance criteria
- [x] Path printed: `/home/xaviel/dev2/tu-gasolina-rd` → rename still pending (manual, Blockers).
- [x] Package in `docs/imp-29092026/`; RESUME + NEXT pointers.
- [x] Baseline table (above) — every number as expected (826 / 78 / 23 / 17 / 39 / 6 / 3 moderate).
- [x] Audit corrections (a)–(g) (above) — two real corrections: GNV is m³, and there is no `atencion` verdict.
- [x] Portfolio: card live, no deploy needed now.
- [x] Seed extended; `npm test` 830/830, tsc and lint clean.

### Decisions made (defaults applied)
- "6 fuel logs on the DS3 with a mix" read as: the DS3's six most recent fill-ups are a mix (3 partial / 3 full)
  rather than six more rows — keeps the 12-fill history, the odometer and the dates the other tests rely on.
- Seed purchase prices other than the DS3's are placeholders; the frozen v2.0 backup fixture is untouched.

### Deviations from the package
- none beyond the reading above.

### Observed, deferred
- GNV volumes are m³ (audit a) — Phase 2 must special-case them in the liters migration.
- No `atencion` verdict (audit e) — Phase 2/3.
- `xaviel-web-v2` has an untracked `README-1.md` (not ours; left alone).

### Design check
- n/a — no UI change.

### Flags flipped
- none

### Notes closed
- 18 (path check) — the rename itself is Xaviel's. Note 9 verified live (the APK button remains for Phase 7).

### Notes for the next phase
- Phase 1: the four developer strings are es.ts:1137–1139, 1153, 1158–1159. eas.json has no env at all.
- The seed now has a failed check item without a photo — Phase 3 can demo multi-photo on it.

---

## Phase 1 — Hotfix 2.1.3   (branch `fix/2.1.3-hotfix`)

**Status:** complete — v2.1.3 released
**Commits:** `fix(2.1.3): photos on Android …, Supabase in the APK, no developer text, schema gate` ·
`docs(2.1.3): how the Supabase values reach an EAS build` · `fix(2.1.3): Car Guy accounts only, and the reset
link comes back to Car Guy` · `fix(2.1.3): clear the reset tokens …` · `fix(2.1.3): photos upload from
Android (ArrayBuffer, not Blob); sync failures name their step` · `fix(2.1.3): useSession applies only the
newest auth event`

### Changed
- **Photos (note 12):** `lib/media/compress.ts` `compressPhoto()` — context/image held to `saveAsync`,
  released in `finally` when the methods exist, one retry on JobCancellationException / "has been rejected",
  then `MediaError('render_cancelled')`; in-flight map per uri. PhotoPicker shows
  `es.common.photoErrorRetry` + Reintentar with the same photo; raw causes go to `lib/diagnostics.ts`
  (ring buffer, 20). VehicleForm recovers `getPendingResultAsync()` on mount (native).
- **Phone photo upload** (found in verification): `uploadMediaBytes` and the public-share upload built a
  `Blob` from bytes, which React Native refuses — every phone upload threw inside the per-row catch and
  was skipped silently since sync shipped. They send the `ArrayBuffer` now.
- **Cloud in the APK (note 13):** `eas.json` `build.base.env` + `environment` per profile; EAS env vars in
  `preview` and `production`; `app.config.js` refuses an EAS release build without them;
  `tools/check-bundle-env.mjs`; `tools/release-apk.sh` (build → bundle check → cert → versionName →
  `--publish` with `car-guy.apk` + `car-guy-vX.Y.Z.apk`).
- **User copy:** the four developer strings → es.account copy; hints in `es.dev.*` behind `__DEV__` or the
  7-tap modo diagnóstico (Más → versión, AsyncStorage, not synced); version + build on Cuenta; UserError /
  userMessage for backup, export, report, template and onboarding errors; a test blocks developer text.
- **Schema gate:** pulled rows with a newer `schema_hint` are skipped, counted, re-read after an update;
  Cuenta says "Hay N cambios de una versión más nueva…".
- **Car Guy-only accounts:** `sql/018_app_membership.sql` (applied to x-core) — `carguy.is_app_user()`,
  `profiles_own_insert` dropped, restrictive `carguy_app_only` on every carguy table and on the
  carguy-media / carguy-public objects, `redeem_invite` guarded. Client: `lib/cloud/membership.ts`;
  `signIn` signs another app's account back out with `es.account.errors.otherApp`; `useSession` hides
  such sessions and applies only the newest auth event.
- **Reset link:** `resetPasswordForEmail(…, { redirectTo })` → `carguy://nueva-contrasena` /
  `<origin>/nueva-contrasena` (added to x-core's redirect allow list; Site URL still Music Hub);
  `app/nueva-contrasena.tsx` sets the password only for a Car Guy account; web clears the tokens from the
  address bar.
- **Sync diagnostics:** a failed sync records `sync <step>: <code · message · details>`; Cuenta lists the
  last three in modo diagnóstico.
- Local RLS harness: seed users are Car Guy signups, plus an other-app account `d`; 12 new checks.

### Dependencies added / removed
- none

### Acceptance criteria
- [x] Photo on the Redmi, "Don't keep activities" on and off: new vehicle, edit vehicle, check falla item,
  service record — camera and gallery (12 MP) — 8/8, no MediaError. (The crash did not reproduce on this
  phone before the fix either: 10/10 on 2.1.2 — the fix is the upstream-recommended defence.)
- [x] APK bundle carries `nakgrkcqyuycadeuenuw.supabase.co`; EAS cert a16450a0…; versionName 2.1.3.
- [x] Account from the APK: Xaviel's Car Guy account created on the phone; after the upload fix the sync
  completes and the photos are in the cloud (meter 2 MB / 300 MB).
- [x] Reset: email → link → **Car Guy** "Nueva contraseña" on the phone (not Music Hub).
- [x] Other-app account refused: unit tests + local RLS (12a–12h). Not tried with a live Music Hub account
  (no password at hand).
- [x] Web canaries (fuel; weekly check with a photo on the failed item) pass; `/nueva-contrasena` with an
  expired or bogus link shows the Spanish message and leaves no tokens in the URL.
- [x] tsc, lint, 855 tests.

### Decisions made (defaults applied)
- Membership marker = `carguy.profiles` row (already created only for Car Guy signups) rather than JWT
  app_metadata: no write to auth.users, no new trigger on a shared table.
- Implicit flow kept for the reset link (tokens in the fragment).
- The new password on the phone is typed by Xaviel, not by Claude.

### Deviations from the package
- sql/018 is the membership file (see Deviations above). The account rule was not in the prompt; Xaviel
  asked for it mid-phase.

### Observed, deferred
- See the table above (Music Hub reverse direction, generic recovery email, hook tests).
- The first APK sync ended in "Sin conexión" after "Todo subido"; with the upload fix the same account
  syncs clean. The cause was not captured (release builds drop console output) — the new diagnostics
  line would show it if it returns.

### Design check
- Cuenta and Nueva contraseña reuse Cuenta's type scale, Surface and buttons; checked on the Redmi.

### Flags flipped
- none

### Notes closed
- 12, 13. Note 17's asset-name prerequisite done (`car-guy.apk`).

### Notes for the next phase
- Phase 2's cloud file is **019** (018 is taken).
- Wi‑Fi adb works on the Redmi (`adb tcpip 5555`, then `adb connect 192.168.0.183:5555`); the USB cable
  drops every few minutes.

---

## Phase 2 — Schema v6 + liters + refdata   (branch `imp-29092026/phase-2-schema-v6`)

**Status:** complete (native run pending — see Observed)
**Commits:** `feat(imp-29092026 phase 2): schema v6, liters, trips table, statuses, refdata; cloud sql/019–020` ·
`docs(imp-29092026): Phase 2 report, units before/after`

### Changed
- `lib/db/migrationV6.ts` (+ registered as v6): 01-data-model-v6.md §1.1–1.8 in one transaction — vehicle
  unit/status/identity/trip columns, `album_item.role`, fuel gauges + `in_reserve` + typed volume, oil on
  `service_record_item`, `trip` + local-only `trip_point` / `trip_state`, history_feed v5 (`viaje` rows,
  `photos` column counting check photos). Volumes → liters.
- `lib/domain/units.ts`: GAL_L, to/from liters, price per liter, labels (gal/L/m³, km/gal / km/L / L/100 km),
  `economyFromKmPerLiter`, `higherIsBetter`, and the store boundary `fuelForDisplay` / `fuelForStorage` /
  `tankForDisplay` / `tankForStorage`.
- `lib/store.tsx` converts at the boundary: the UI, computeEconomy and the charts keep working in the
  vehicle's display unit, so a gallons car reads exactly as before. Writes: `saveVehicleDraft`, the edit
  screen, the Tu Combustible importer and the dev seed store liters.
- Unit-aware labels (vehicle's `volumeUnit`, default gal): `lib/format.ts` volume/kmPerUnit,
  `lib/fuel.ts` economyLabel/unitLabelFor/perUnitLabelFor, FillUpForm (+ "litros" word), FillUpReviewSheet,
  Inicio (`app/(tabs)/index.tsx`), Cifras + EconomyLine, Historial tag, PDF report (`lib/report/html.ts`,
  `es.report.economySummary`), CSV export (`lib/export/csv.ts`, `app/exportar.tsx`). No volume in the
  public dossier or the book PDF (checked). Fuel prices board stays RD$/gal (display only, no prefill).
- Backups: `schemaVersion` in the file; `restoreV2` converts a pre-v6 file (`backupInLiters`).
- Sync: `trip` in SYNC_TABLES + UPDATED_BY_TABLES, `in_reserve` boolean, SCHEMA_HINT 'v6',
  `lib/sync/unitBridge.ts` (push liters + legacy gallons + hint on vehicle/fuel_log/trip; pull prefers
  liters unless a 2.1.x edit made them stale).
- Types: `lib/db/types.ts` (Vehicle v6 fields, nine VehicleStatus values, FuelLog gauges, oil, AlbumRole,
  Trip, TripPoint, MilestoneKind 'estado', HistoryEntry 'viaje' + photos); `lib/cloud/database.types.ts`
  regenerated from the live schema (Management API typegen — the CLI is not logged in).
- `lib/domain/vehicleStatus.ts` (labels, isArchivedFor, isEx, badge text, statusLine); garage badges
  all outline; `setVehicleStatus` stamps status_since and writes a milestone 'estado'.
- `lib/db/tripOps.ts`: trips repo, tripPoints insertBatch/forTrip/purgeOlderThan (30 days), vehicleGallery,
  garageLayout get/set. `ALL_TABLES` + reset include trip (points and state are cleared, never backed up).
- `lib/domain/refdata/` (by a helper agent): makes.json (60 makes, 863 models, every DR model on the list,
  AE85/AE86/Trueno aliases), colors, bodyTypes, oil, fluids — 42.7 KB; `searchMakes`/`modelsFor`/`yearsFor`
  with the accent fold. `docs/CREDITS.md`; credit line in Más → Acerca de.
- Flags FEATURE_TRIPS, FEATURE_FEEDBACK, FEATURE_GARAGE_V2, FEATURE_LAUNCH_ANIM — all false.
- Cloud: `sql/019_schema_v3.sql`, `sql/020_rls_v3.sql` (applied to x-core). `tools/local-rls` 13a–13i,
  `tools/verify-sync.mjs` 18–20.

### Dependencies added / removed
- none

### Acceptance criteria
- [x] Migration canary (written first): v5 DB with 6 gallon fill-ups → v6; km/gal and cost/km identical to 3
  decimals, with and without the typed value (`__tests__/db/migrate-v6.test.ts`, 10 tests).
- [x] Fresh 0 → 6; v2.0 fixture still migrates (migrate-v2); 2.1.x backup → v6 converted; v6 backup
  round-trips (`backup-v2.test.ts`).
- [x] Parity test reads sql/019; trip cascade; booleans incl. in_reserve (179 checks).
- [x] local-rls: all pass incl. 13a–13i (owner CRUD, editor inserts on a shared car, viewer cannot,
  outsider and Music Hub account see nothing, dossier has no trips, anon refused) — BEFORE applying.
- [x] verify-x-core 23/23, verify-sync 21/21 (18 hinted row skipped by v5, 19 liters round-trip, 19b gauge
  check, 20 trip LWW incl. stale write ignored); throwaway users cleaned (0 left).
- [x] Web, same seeded garage in 2.1.3 (main worktree) and Phase 2: Inicio, Cifras, Historial text
  byte-identical for AE85 and DS3 (partials included); the same new fill-up gives an identical review sheet
  and Historial. `docs/qa/imp-29092026-phase-2-units-before-after.png`.
- [ ] Android native run of v6 — no emulator image, and the Redmi is the real garage (see Observed).
- [x] tsc, lint, 917 tests.

### Decisions made (defaults applied)
- Liters keep 6 decimals (spec: 3): 3 moved km/gal in the third decimal on the round trip.
- GNV (m³) is never converted — local, cloud, backup, import.
- `schema_hint` only on vehicle, fuel_log, trip (the tables whose meaning changed / are new); stamping every
  table would break pushes to tables without the column.
- The migration does not mark rows dirty: the cloud keeps its gallons; liters arrive with the next edit.
- Screens show km per the vehicle's volume unit; the L/100 km display waits for Phase 3's picker.

### Deviations from the package
- sql/018 → 019, 019 → 020, 020 (feedback) → 021 (2.1.3 took 018). Noted in 02-cloud-v3.md and PROMPT-06.
- `trip` also gets 018's `carguy_app_only` policy (not in the package; required by the 2.1.3 rule).
- verify-x-core got no new checks — the trip policies are covered by local-rls 13a–13i and verify-sync 20.

### Observed, deferred
- See the table above: native v6 run, L/100 km display, stale-hint edge case, settings sync.

### Design check
- n/a beyond "numbers read the same" — no screen changed except the Acerca de credit line.

### Flags flipped
- none (four new flags, all false)

### Notes closed
- 15 (schema part). Groundwork for 1, 4, 10, 11, 16.

### Notes for the next phase
- Phase 3's forms write through `saveVehicleDraft` / the store: pass the unit the user picked and the
  conversion is already there (`tankForStorage`, `fuelForStorage`). A unit change on an existing car must
  re-express `tank_volume_entered`.
- Refdata ids: make `toyota`, model `toyota-hilux`; `searchMakes` returns `{ make, models }[]`.

---

## Phase 3 — Vehicle form v2, oil picker, check photos   (branch `imp-29092026/phase-3-forms`)

**Status:** complete on web (Android run pending, as for Phase 2)
**Commits:** `feat(imp-29092026 phase 3): vehicle form v2, gallery, statuses, oil picker, check photos` ·
`docs(imp-29092026): Phase 3 report`

Built by me plus two helper agents working on separate files (oil; check photos), merged on the branch.

### Changed
- `components/pickers/`: PickerField, SearchSheet (accent-insensitive via `lib/domain/text.ts` foldText,
  sections, "Otro…" → text), SwatchGrid (18 colours + Otro), YearWheel (next year → 1950, the model's years
  highlighted, decade jumps). `lib/domain/refdata` uses the shared fold now.
- `components/VehicleForm.tsx` rewritten in 03-screens.md order, split into `components/vehicle/`
  (PhotosSection, MakeModelYear, IdentitySection). Body type chips derive the legacy `type`
  (`legacyTypeFor` / `bodyTypeFromLegacy` in refdata). Tank: number + gal | L; the number converts when the
  unit flips (same liters stored) and a caption shows the other unit. Precio + fecha de compra visible
  (note 8). Estado: activo, proyecto, en taller, accidentado, guardado, restauración, prestado (+ Desde,
  Nota). `lib/domain/vehicleForm.ts`, `lib/domain/gallery.ts` hold the pure rules.
- `lib/db/vehicleOps.ts`: saveVehicleDraft writes the v6 columns (unit from the form, economy unit
  follows it), the gallery (`syncVehicleGallery`: album items role 'vehicle', in order; dropping a photo
  removes it from the gallery, not the database) and a milestone 'estado' on a status change
  ("Cambió a ACCIDENTADO · esperando piezas"); setVehicleStatus uses the same title.
- Hub: cover = gallery cover, "1/N" pill → `/foto/[id]?gallery=1` pages the gallery in order; status detail
  beside the pill; "Cambiar estado" offers the new statuses (scrolls). Garaje: cover first, status line on
  hero and small cards. Inicio switcher: any non-active status tag.
- Oil (agent): `lib/domain/oil.ts`, `lib/db/oilQueries.ts`, `components/service/OilBlock.tsx`, service
  form/detail, Historial meta line, and (me) "La última vez: …" on the oil-change reminder; the block sits
  above the catalogue list.
- Checks (agent): verdict **ATENCIÓN** (`atencion`), status **con_avisos**; up to 5 photos per falla/atención
  (`components/checks/CheckPhotoStrip.tsx`, media owned by the result, first also in `media_id`); result
  screen thumbs → viewer; Historial "📷 N" (history_feed v5 counts owned media; service/mod counts too);
  album: check photos captioned "CHEQUEO · <item>" and (me) a CHEQUEO card on the timeline.

### Dependencies added / removed
- none

### Acceptance criteria
- [x] Web: C3 registered from scratch through the pickers with 3 photos, ACCIDENTADO desde + "esperando
  piezas" — scripted run 8 s; Garaje card shows "ACCIDENTADO · desde 29 sept · esperando piezas"
  (`docs/qa/imp-29092026-phase-3-c3-garage-card.png`, form: `…-vehicle-form.png`).
- [x] Tank 12 gal → L shows 45.4 with "45.4 L ≈ 12 gal"; the same liters stored either way (db test).
- [x] Service "Aceite de motor" 5W-30 sintético Castrol → Historial "5W-30 sintético · Castrol" (agent's web run).
- [x] Check with a falla + 2 photos → result thumbs, Historial "Chequeo · con fallas · 📷 2", album CHEQUEO
  card (`docs/qa/imp-29092026-phase-3-check-photos.png`).
- [ ] Android — same situation as Phase 2 (no AVD; the Redmi holds the real garage).
- [x] tsc, lint, 975 tests.

### Decisions made (defaults applied)
- Reminders by status (existing `isArchivedFor`): guardado, prestado, vendido, perdido leave the selector and
  get **no** reminder notifications (all of them, not only km); en_taller, accidentado, restauración,
  proyecto keep running — the car comes back.
- A status's "Desde" defaults to the day of the change; back to activo clears Desde and Nota.
- Interior material ids are refdata's without the prefix (`piel-sintetica` included), so the column is text.

### Deviations from the package
- Reorder by "Mover ←/→" instead of long-press drag (see Observed).
- The public dossier does not show the status yet (see Observed).
- history_feed v5 (in migration v6, unshipped) was edited in place for the photo counts.

### Design check
- Pickers use the existing Sheet, Chip, Segmented and Field look; 44 px targets; labelled for screen
  readers. Screenshots in docs/qa.

### Flags flipped
- none

### Notes closed
- 3, 10, 11, 15 (UI), 16; the form half of 8.

### Notes for the next phase
- Phase 4 (carga parcial) writes gauges through the store: `fuelForStorage` already stores liters; the
  form knows the vehicle's unit from `data.vehicles[].detail.volumeUnit`.
- `vehicleGallery` lives in lib/db/tripOps.ts next to the other v6 helpers.

