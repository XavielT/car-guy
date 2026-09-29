# Progress — IMP 29092026 (Car Guy 2.2 "Kaidō")

Claude Code appends a report per phase (block in `00-context/04-conventions.md` §9: the usual
sections plus *Design check*, *Flags flipped*, *Notes closed*). "Notes for the next phase" carry
context between sessions.

**Started:** 2026-09-29 · **Status:** Phase 1 done (2.1.3 released)

## Phase status

| # | Phase | Status | Branch | Notes |
|---|---|---|---|---|
| 0 | Kickoff | ✅ | `imp-29092026/phase-0-kickoff` | package, baseline, audit, portfolio live, seed |
| 1 | Hotfix 2.1.3 | ✅ | `fix/2.1.3-hotfix` | photos, cloud in the APK, Car Guy-only accounts, reset link, released |
| 2 | Schema v6 + liters + refdata | ⬜ | | |
| 3 | Forms v2 | ⬜ | | |
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
| 3 | Photos on check issues / new parts, in history | 3 | ⬜ |
| 4 | Carga parcial | 4 | ⬜ |
| 5 | Historial de versiones | 6 | ⬜ |
| 6 | Bug reports / comments | 6 | ⬜ |
| 7 | Animated launch icon | 6 | ⬜ |
| 8 | Mod costs + car price + what it cost me | 3 + 6 | ⬜ |
| 9 | Portfolio | 0 + 7 | 🟡 live card verified in Phase 0; APK button in 7 |
| 10 | Several vehicle photos | 3 | ⬜ |
| 11 | Liters/gallons, colour picker, make/model/year pickers, body types | 3 | ⬜ |
| 12 | Photo error on Android | 1 | ✅ compressPhoto + pending result; 8/8 on the Redmi; phone photo *upload* fixed too |
| 13 | Sign-in message / accounts configured | 1 | ✅ cloud values in every EAS build, user copy, Car Guy-only accounts, reset link to Car Guy |
| 14 | Garage view with all photos, user-arranged | 6 | ⬜ |
| 15 | More statuses (the C3 case) | 2 + 3 | ⬜ |
| 16 | Oil types picker | 3 | ⬜ |
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
