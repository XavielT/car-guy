# Progress — IMP 28092026 (Car Guy 2.1 "Hachi-Gō")

Claude Code appends a report per phase (block in `00-context/04-conventions.md`, plus *Design
check* and *Flags flipped*). "Notes for the next phase" carry context between sessions.

**Started:** 2026-09-28 · **Status:** Phase 0 done

## Phase status

| # | Phase | Status | Branch | Notes |
|---|---|---|---|---|
| 0 | Kickoff | ✅ | `imp-28092026/phase-0-kickoff` | folder rename still pending (manual) |
| 1 | Schema v2 + JDM tokens | ⬜ | | |
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
