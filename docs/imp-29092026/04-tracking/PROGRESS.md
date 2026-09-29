# Progress — IMP 29092026 (Car Guy 2.2 "Kaidō")

Claude Code appends a report per phase (block in `00-context/04-conventions.md` §9: the usual
sections plus *Design check*, *Flags flipped*, *Notes closed*). "Notes for the next phase" carry
context between sessions.

**Started:** 2026-09-29 · **Status:** Phase 0 done

## Phase status

| # | Phase | Status | Branch | Notes |
|---|---|---|---|---|
| 0 | Kickoff | ✅ | `imp-29092026/phase-0-kickoff` | package, baseline, audit, portfolio live, seed |
| 1 | Hotfix 2.1.3 | ⬜ | | |
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
| 12 | Photo error on Android | 1 | ⬜ |
| 13 | Sign-in message / accounts configured | 1 | ⬜ |
| 14 | Garage view with all photos, user-arranged | 6 | ⬜ |
| 15 | More statuses (the C3 case) | 2 + 3 | ⬜ |
| 16 | Oil types picker | 3 | ⬜ |
| 17 | APK from the web page | 1 (name) + 7 | ⬜ |
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

The cloud checks leave throwaway `carguy-test-*` users; cleanup (`sql/999_cleanup_test_users.sql --shared`) needs Xaviel's OK in this conversation — see Blockers.

## Portfolio (Phase 0)

**The Car Guy card is live.** `https://xaviel-web-v2.vercel.app` production bundle contains "Car Guy",
`car-guy.vercel.app` and `car-guy/releases` once each, and no "Tu Combustible" anywhere. `vercel ls
xaviel-web-v2 --prod`: latest production deploy **Ready, 3 h old** (from `main` `7a228f1` "feat: Tu Combustible
RD card becomes Car Guy 2.1"). The card's APK link is `releases/latest` (lands on v2.1.2 today). Local repo: on
branch `imp-11092026/phase-3-admin-shell` (in sync with origin; also carries the card as `2e3057a`), one
untracked `README-1.md`. Nothing deployed from here; Phase 7 points the button at the stable `car-guy.apk`.

## Decisions made along the way

## Deviations from the package

## Observed, deferred

| Found in | Issue | Severity | Notes |
|---|---|---|---|

## Blockers

| Phase | Blocker | Needs | Status |
|---|---|---|---|
| 0 | Folder rename `~/dev2/tu-gasolina-rd` → `~/dev2/car-guy` | Xaviel, no session open | open |
| 0 | Cleanup of the baseline's `carguy-test-*` users on x-core (auto-mode refuses `999_cleanup_test_users.sql --shared` without a per-conversation OK) | Xaviel's OK | open |

---

## Phase reports

## Phase 0 — Kickoff   (branch `imp-29092026/phase-0-kickoff`)

**Status:** complete (folder rename pending — manual; test-user cleanup waiting on an OK)
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
