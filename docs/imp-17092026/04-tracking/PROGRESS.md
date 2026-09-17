# Progress — IMP 17092026 (Car Guy)

Claude Code updates this file at the end of every phase (block in `00-context/04-conventions.md`).
The "Notes for the next phase" sections carry context between sessions.

**Started:** 2026-09-17 · **Status:** Phase 0 done

## Phase status

| # | Phase | Status | Branch | Notes |
|---|---|---|---|---|
| 0 | Kickoff | ✅ | `imp-17092026/phase-0-kickoff` | Package in repo, audit checked, baseline green, fixture written |
| 1 | Rebrand + foundation | ⬜ | | |
| 2 | SQLite + importer | ⬜ | | |
| 3 | Garage + navigation | ⬜ | | |
| 4 | Maintenance + Historial | ⬜ | | |
| 5 | Inspections + reminders | ⬜ | | |
| 6 | Identity pass | ⬜ | | |
| 7 | Statistics + reports | ⬜ | | |
| 8 | x-core + account | ⬜ | | |
| 9 | Sync | ⬜ | | |
| 10 | Release | ⬜ | | |

⬜ not started · 🟡 in progress · ✅ done · 🔴 blocked

## Audit corrections (Phase 0)

`00-context/02-repo-audit.md` checked against the code on 2026-09-17 (commit `076c6b2`). It is
accurate on every point that matters: stack versions, the file map, `lib/types.ts` in full,
`lib/storage.ts` `KEY = 'tu-combustible-rd/v1'`, `app.json` identity fields, `vercel.json` headers,
`public/sw.js`, and both `tools/*.mjs`. Three small corrections:

| # | Audit says | Code says | Why it matters |
|---|---|---|---|
| 1 | §2 lists `sortFillUps` among `lib/math.ts`'s exports | `sortFillUps` exists at `lib/math.ts:64` but is **module-private** — not exported | PROMPT-01 moves this math into `lib/domain/economy`; the sort has to be lifted deliberately, it cannot just be re-imported |
| 2 | Conventions §Secrets: "EAS project id — `app.json` `extra.eas.projectId`" | `app.json` has **no `extra` key at all**; the project is not linked to EAS | `eas.json` sets `appVersionSource: "remote"`, which needs a linked project. PROMPT-10 (or PROMPT-01, when the package changes) must run `eas init` first. See also the tooling table: `eas whoami` → not logged in |
| 3 | §1 "Tooling — no tests, no ESLint config, no CI" (accurate) | also **no `lint` and no `test` script** in `package.json` | Conventions require `npx expo lint` and `npm test` green "from PROMPT-01 on" — PROMPT-01 has to *create* both, not just run them |

Verified exactly as described, no deviation: `expo ~57.0.14` / RN `0.86.2` / React `19.2.3` /
TS `~6.0.3` · typed routes on · `android.package` `com.xavieltucombustiblerd.app`, `versionCode 2`,
`version 1.1.0` · `userInterfaceStyle: "light"` · splash and adaptive background `#0B1F1C` ·
`expo-sqlite ~57.0.1` installed and an `app.json` plugin but **never imported** anywhere in
`app/`, `components/`, `lib/`, `constants/` · `constants/theme.ts` carries exactly the 13 colours
and 8 font aliases listed · 5 tabs (`index`, `cargar`, `historial`, `cifras`, `mas`) ·
`vercel.json` `Permissions-Policy: camera=(), microphone=(), geolocation=()` (blocks camera, as
noted for PROMPT-03) · `public/sw.js` `CACHE = 'tu-combustible-rd-v1'` ·
`tools/finalize-web.mjs` `TITLE = 'Tu Combustible RD'` · `lib/format.ts:53` `id()` falls back to
`id_<ts>_<hex>` · `lib/backup.ts` envelope `{app:'tu-combustible-rd', version:1, exportedAt, data}`.

**Package copies.** `docs/imp-17092026/` was copied from
`/home/xaviel/improvements/imps car guy/september 2026/imps 17092026/` on 2026-09-17; both were
identical at that moment (all 26 files, mtime 13:54). From here on the prompts read the repo copy;
if the `~/improvements` original is edited later it will be the newer one and wins.

No code was changed to fix any of this — Phase 0 changes no product code.

## Baseline (Phase 0)

Run on 2026-09-17 from a clean `imp-17092026/phase-0-kickoff` off `main` @ `076c6b2`.

| Step | Result |
|---|---|
| `npm ci` | ✅ 622 packages in 10 s. The lockfile **is** in sync (`npm ci` fails outright when it is not), so `npm install` was not needed. `npm audit`: 22 vulnerabilities (15 moderate, 7 high) — transitive, not addressed in this phase |
| `npx tsc --noEmit` | ✅ clean, exit 0, no output |
| `npm run build` | ✅ `expo export -p web` + `finalize-web` titled 17/17 pages. **`dist/` = 5.2 MB, 80 files**: `assets/` 3.5 MB (fonts dominate), `_expo/` 1.3 MB (one JS bundle, `entry-2d631e93….js` 1.3 MB), 17 static routes at 20–32 KB each |
| `npx expo start --web` | ✅ Metro bundled in 7.3 s, HTTP 200 on `localhost:8081` within 1 s of the port opening. App renders the **onboarding screen** ("El carro que vas a cargar" — vehicle form, fuel chips, tank field), which is the correct entry state for a browser profile with no saved data |
| Screenshot | ✅ `docs/qa/baseline-web.png` — Playwright 1.63.0, chromium, 430×932, 5 s settle |

### Tooling

| Tool | State | Detail |
|---|---|---|
| node | ✅ available | v24.15.0 (≥ 20 ✓) |
| npm | ✅ available | 11.12.1 |
| `npx expo` | ✅ available | 57.0.16 |
| Playwright | ✅ available | 1.63.0, chromium present — QA screenshots work |
| `gh` | ✅ logged in | account `XavielT`, ssh, scopes `admin:public_key, gist, read:org, repo`. `repo` covers the PROMPT-10 repo rename and release upload |
| `vercel` | ✅ logged in | CLI 59.20.0, user `xavielt`. `.vercel/project.json` links project `tu-combustible-rd` (`prj_sBmtG1kj9tWkjTFL8mk4ZMcsYH7y`) — PROMPT-10 creates a **new** `car-guy` project, it does not repoint this one |
| `java` | ✅ available | OpenJDK 17.0.20 (Ubuntu 24.04) — fine for the PROMPT-10 gradle `assembleRelease` |
| `eas-cli` | ⚠️ available, **not logged in** | 24.7.0 via `npx`. `eas whoami` → "Not logged in". Also no `extra.eas.projectId` in `app.json` (audit correction #2). **Xaviel must run `npx eas-cli login` before PROMPT-10** |
| `sqlite3` (CLI) | ❌ missing | `command not found`. Not needed by the app — `expo-sqlite` ships its own engine — but it is the convenient way to inspect the device/browser DB by hand in PROMPT-02. `sudo apt install sqlite3` if wanted |
| `adb` | ✅ available (**corrected**) | Not on `PATH`, but the full Android SDK is at `~/Android/Sdk` — `platform-tools/adb` 1.0.41, `build-tools/37.0.0` (`apksigner`, `aapt2`), NDK and CMake. Xaviel's phone (`M2101K6G`, Android 13) authorises USB debugging. Local gradle release builds work: one took 9m31s. Export `ANDROID_HOME=$HOME/Android/Sdk` |

Nothing was installed — per the prompt, this phase only records the inventory.

## Decisions made along the way

- **Phase 0** — the sample fixture deliberately mixes both ID shapes `id()` can produce
  (`crypto.randomUUID()` UUIDs and the `id_<ts>_<hex>` fallback) so the PROMPT-02 importer is
  forced to handle non-UUID ids from its first test, matching ADR-03.
- **Phase 0** — fixture dates are written as local noon in AST (UTC-4, no DST) → `…T16:00:00.000Z`,
  the exact output of `lib/format.ts` `isoFromDateInput`. Keep that convention in the importer.

## Deviations from the package

_(where the code forced a different path than a spec/prompt — what and why)_

## Observed, deferred

| Found in | Issue | Severity | Notes |
|---|---|---|---|
| Phase 0 · `package.json` | 22 npm audit vulnerabilities (15 moderate, 7 high), all transitive | low | Untouched: fixing them means bumping outside the phase. Worth one pass before the PROMPT-10 release |
| Phase 0 · `app.json` | No `extra.eas.projectId`; `eas.json` already expects `appVersionSource: "remote"` | medium | Blocks an EAS build until `eas init` runs. Natural home is PROMPT-01 (the package changes there anyway) or PROMPT-10 |
| Phase 0 · `lib/math.ts:64` | `sortFillUps` is private although four exported functions depend on it | low | Export it when the economy math moves to `lib/domain/economy` in PROMPT-01 |
| Phase 0 · environment | `sqlite3` CLI is not installed | low | Does not block anything: `expo-sqlite` embeds its own engine. A convenience for inspecting the DB by hand in PROMPT-02 |
| Phase 0 · repo root | Untracked stray directory `Claude outputs/` (one copy of the package README) | low | Left alone — not mine to delete. Xaviel can remove it |

## Blockers

| Phase | Blocker | Needs | Status |
|---|---|---|---|
| 2 | The real Tu Combustible RD data is not in the repo | Xaviel exports it from the installed app (**Más → Crear respaldo JSON**) and drops it at `docs/imp-17092026/fixtures/tu-combustible-rd-backup.real.json` (gitignored) | ⏳ waiting on Xaviel — not blocking Phase 1 |
| 10 | `eas whoami` → not logged in, and no EAS project is linked | `npx eas-cli login`, then `eas init` to write `extra.eas.projectId` | ⏳ waiting on Xaviel — not blocking Phases 1–9 |

## Hand-off to xaviel-web (written in Phase 10)

_(name, description, URLs and release link the portfolio must change)_

---

## Phase reports

_(appended by Claude Code, newest last)_

## Phase 0 — Kickoff   (branch `imp-17092026/phase-0-kickoff`)

**Status:** complete
**Commits:** `chore(imp-17092026): kickoff — package, audit corrections, baseline`

### Changed
- `docs/imp-17092026/**` — the whole planning package copied in from
  `~/improvements/imps car guy/september 2026/imps 17092026/`, sub-folder structure intact
  (26 files: `00-context` ×5, `01-research` ×3, `02-specs` ×3, `03-prompts` ×11, `04-tracking` ×2,
  `README.md`, `05-manual-checklist.md`).
- `docs/imp-17092026/04-tracking/PROGRESS.md` — audit corrections, baseline, tooling, this report.
- `docs/imp-17092026/fixtures/tu-combustible-rd-backup.sample.json` — new, the Phase 2 importer's
  test input (see below).
- `docs/qa/baseline-web.png` — new, the baseline render.
- `.gitignore` — ignores `docs/imp-17092026/fixtures/tu-combustible-rd-backup.real.json`.

**No product code, no `app.json`, no dependency was touched.**

### Dependencies added / removed
None. `npx tsx` and `npx playwright` were used ad hoc for verification and not installed
(`tsx` came from the npx cache, Playwright was already present).

### Acceptance criteria
- [x] `docs/imp-17092026/` exists with every file of the package — verified: `find | wc -l` = 26,
      matching the source folder file-for-file.
- [x] "Audit corrections" lists the deviations — three found (private `sortFillUps`, missing
      `extra.eas.projectId`, missing `lint`/`test` scripts); everything else verified as written.
- [x] Baseline records tsc, build, web start and the tooling table — all four present above;
      `tsc` clean, build 5.2 MB / 80 files, web renders onboarding, 10 tools inventoried.
- [x] Sample backup fixture matches `lib/backup.ts` format — verified by *running the app's own
      code* over it (`normalizeData` from `lib/storage.ts` + `computeEconomy` from `lib/math.ts`
      under `tsx`): envelope `{app, version:1, exportedAt, data}` accepted, no orphan rows, every
      `totalDop` equals `roundMoney(volume × pricePerUnit)`, odometers monotonic per vehicle.
      Content: **2 vehicles** (Corolla 2016 / regular / 13 gal, Hilux camioneta / gasoil regular /
      20 gal), **12 fill-ups** incl. **2 partials**, **4 expenses** across 4 categories
      (maintenance, insurance, repair, tax), **3 reminders** incl. **1 completed**, settings with
      edited MICM prices and week label `12–18 sep 2026 (MICM)`. Economy comes out realistic —
      Corolla 38.3 km/gal over 6 brim-to-brim points, Hilux 22.0 km/gal over 2.
- [x] `.gitignore` ignores the real backup — verified with `git check-ignore -v`.
- [x] Phase 0 report written; merged to `main`.
- [x] `main` still deploys — nothing outside `docs/` and `.gitignore` changed, and
      `npm run build` (the Vercel build command) passes on this branch.

### Decisions made (defaults applied)
- The fixture is **generated** by a script rather than hand-typed, so `totalDop` is exactly
  `roundMoney(volume × pricePerUnit)` and the dates are exactly what `isoFromDateInput` emits.
  The generator lives in the session scratchpad, not the repo — the JSON is the artefact.
- Both ID shapes appear in the fixture on purpose (see "Decisions made along the way").
- The stray untracked `Claude outputs/` directory at the repo root was left untouched.

### Deviations from the package
None. Every step of PROMPT-00 ran as written.

### Observed, deferred
Logged in the table above — npm audit debt, no EAS project id, private `sortFillUps`, missing
`sqlite3`/`adb`, stray `Claude outputs/`.

### Notes for the next phase
- **PROMPT-01 must create the tooling the conventions assume**: there is no `lint` script, no
  `test` script and no test runner. "`npx expo lint` clean, `npm test` green from PROMPT-01 on"
  means setting both up first.
- When the economy math moves to `lib/domain/economy`, **export `sortFillUps`** — `computeEconomy`,
  `reviewFillUp`, `distanceInLogs` and `lastOdometer` all depend on it.
- Identity lives in more places than `app.json`: `constants/theme.ts` (13 colours, 8 font aliases),
  `app/+html.tsx` (body background, `theme-color`), `public/manifest.webmanifest` (name, colours,
  description), `public/sw.js` (`CACHE = 'tu-combustible-rd-v1'`), `tools/finalize-web.mjs`
  (`TITLE`), `app/_layout.tsx` screen titles, `lib/backup.ts` (the export *filename* and dialog
  title — the envelope `app: 'tu-combustible-rd'` must still be *read* forever, per D1).
- `npx eas-cli login` + `eas init` are on Xaviel (manual checklist) before any EAS build.
- Before Phase 2, Xaviel exports his **real** backup (Más → Crear respaldo JSON) to
  `docs/imp-17092026/fixtures/tu-combustible-rd-backup.real.json`. The sample fixture is enough to
  build and test the importer in the meantime; the real file is the "counts match" proof from the
  definition of done.

## Phase 0 addendum — Android backup rescue (2026-09-17, branch `fix/android-backup-share-uri`)

Xaviel reported that **Crear respaldo JSON** failed on the installed Android app, which blocked the
"export your real backup before Phase 2" item. Diagnosed, fixed and the real data recovered the
same day.

### The bug

`lib/backup.ts` passed `file.contentUri ?? file.uri` to `Sharing.shareAsync`. On Android
`contentUri` is always defined, so the `??` never fell through — and `expo-sharing` rejects it:

```kotlin
// expo-sharing/android/.../SharingModule.kt  getLocalFileFoUrl()
if ("file" != uri.scheme) throw InvalidArgumentException(
  "Only local file URLs are supported (expected scheme to be 'file', got '" + uri.scheme + "'.")
```

`shareAsync` builds its own content URI through `SharingFileProvider`; it wants the plain `file://`
URI. So the export threw on **every** Android attempt. The file itself was always written correctly
— only the share failed — and `handleExport`'s bare `catch` reported it as
"No se pudo crear el archivo de respaldo", which pointed the blame at the wrong step.

Fixed by passing `file.uri`, and the alert now appends the real error message.

### Audit correction #4

`00-context/02-repo-audit.md` §5 says "Backup/restore via share sheet and document picker **works on
Android**". It never worked. The web half of that sentence ("silently does nothing on web") is also
understated — `expo-file-system` has no web implementation at all in SDK 57; its web module is a
stub whose `File` constructor only calls `console.warn`, so the export **throws** on web rather than
doing nothing. PROMPT-02 still owns the web path (Blob download); it is untouched here.

### How the data was recovered

The installed app is not debuggable and the phone is not rooted, so `run-as` and `adb backup` cannot
reach `/data/user/0/com.xavieltucombustiblerd.app`. The app's own export was the only way out.

1. Confirmed the shipped v1.1.0 APK is signed with cert `fac61745…`, byte-identical to the repo's
   `android/app/debug.keystore` (`apksigner verify --print-certs`), and that
   `expo prebuild --platform android --clean` regenerates that same keystore — so a rebuild could be
   installed **over** the existing app without an uninstall and without losing data.
2. Built `v1.1.1` / `versionCode 3` with the fix (`./gradlew assembleRelease`, 9m31s).
3. `adb install -r` — upgrade succeeded, data intact (home screen still showed the Citroen and
   37.446 km/gal).
4. Drove the UI over `adb shell input`: Más → Crear respaldo JSON → share sheet → "Copy to…" →
   SD card/Download, then `adb pull`. The share sheet opening at all is the proof the fix works.

### The real backup

Saved to `docs/imp-17092026/fixtures/tu-combustible-rd-backup.real.json` (gitignored, verified with
`git check-ignore`). Verified by running the app's own `normalizeData` and `computeEconomy` over it:

| | |
|---|---|
| Envelope | `app: 'tu-combustible-rd'`, `version: 1`, `exportedAt: 2026-09-17T20:05:22.323Z` |
| Contents | **1 vehicle** (Citroen DS3 2015, A709426, regular, 13.2 gal tank), **4 fill-ups** (2 partials), **0 expenses**, **0 reminders** |
| Range | 2026-08-27 → 2026-09-15, odometer 51 676 km, RD$10 000.00 total, 1 brim-to-brim point at 37.45 km/gal |
| Integrity | no orphan `vehicleId`s, every `fuelType` valid |

**All 5 ids are the `id_<ts>_<hex>` fallback — not one UUID.** ADR-03's `text` primary keys are not a
precaution, they are a requirement: a Postgres `uuid` column would reject every row of Xaviel's real
data. PROMPT-08 must not be tempted back to `uuid`.

The dataset is small, so the generated `…backup.sample.json` fixture stays the primary test input for
the PROMPT-02 importer (it is the one with expenses, reminders and two vehicles). The real file is
the "counts match" proof for the definition of done.

### Still open

- The phone now runs **v1.1.1**, which is ahead of the `v1.1.0` GitHub release. Publishing a v1.1.1
  release with this APK is Xaviel's call — nothing was pushed or published.
- A copy of the backup is sitting at `/storage/3931-3532/Download/tu-combustible-rd-2026-09-17.json`
  on the phone's SD card. It holds real vehicle data; delete it when convenient.
- `importBackup` (**Restaurar desde archivo**) was **not** exercised. It reads the picked file with
  `new File(result.assets[0].uri)`, and `DocumentPicker` hands back a `content://` URI on Android —
  the same class of mismatch that broke the export. Worth testing before PROMPT-02 relies on it.
