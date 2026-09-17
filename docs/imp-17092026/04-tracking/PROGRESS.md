# Progress — IMP 17092026 (Car Guy)

Claude Code updates this file at the end of every phase (block in `00-context/04-conventions.md`).
The "Notes for the next phase" sections carry context between sessions.

**Started:** 2026-09-17 · **Status:** Phase 2 done

## Phase status

| # | Phase | Status | Branch | Notes |
|---|---|---|---|---|
| 0 | Kickoff | ✅ | `imp-17092026/phase-0-kickoff` | Package in repo, audit checked, baseline green, fixture written |
| 1 | Rebrand + foundation | ✅ | `imp-17092026/phase-1-rebrand` | Car Guy identity, tokens, base components, domain tests, lint |
| 2 | SQLite + importer | ✅ | `imp-17092026/phase-2-sqlite` | Schema v1, repos, store rewire, catalog seed, legacy importer, backup v2 |
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
| 2 | The real Tu Combustible RD data is not in the repo | ~~Xaviel exports it from the installed app~~ — the export was broken; fixed and the file recovered off the device on 2026-09-17 (see the Phase 0 addendum). It is at `docs/imp-17092026/fixtures/tu-combustible-rd-backup.real.json`, gitignored | ✅ resolved |
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

## Phase 1 — Rebrand + foundation   (branch `imp-17092026/phase-1-rebrand`)

**Status:** complete
**Commits:** `f712011` rebrand · `f35b6ac` tokens, components, domain tests, lint

### Changed
- **Identity.** `app.json` (name/slug/scheme/description, `version 2.0.0`,
  `android.package com.xaviel.carguy` + `versionCode 1`, `userInterfaceStyle automatic`,
  web name/theme), `package.json` name, `app/_layout.tsx` titles, `app/+html.tsx`
  (description, `theme-color`, body background, apple title, `black-translucent`),
  `public/manifest.webmanifest`, `public/sw.js` cache → `carguy-v1`,
  `tools/finalize-web.mjs` `TITLE`, `README.md` rewritten around vehicle care with an
  "Origen" section.
- **Mark.** `tools/make-icons.mjs` redrawn: a 270° gauge sweep with the gap at the bottom, a
  needle at 2 o'clock and a green dot at its tip, on `#0E1116`. All 12 PNGs and 6 SVG sources
  regenerated.
- **Tokens.** `constants/theme.ts` — `palette.dark` / `palette.light`, `categoryColors`,
  `fonts`, `radius`, `space`, plus the legacy `colors` alias.
- **Theme.** `lib/theme/useTheme.ts` (`ThemeProvider`, `useTheme`, `ThemeScope`), wired in
  `app/_layout.tsx`; StatusBar and the Stack/tab-bar chrome follow the scheme.
- **Components.** `components/ui/` — `StatusPill`, `GaugeRing`, `EmptyState`, `QuickActions`,
  `Sheet`; `ui.tsx` moved to `ui/index.tsx` (import paths unchanged) with the four legacy
  controls restyled onto the tokens; `Field` de-hardcoded.
- **Domain.** `lib/domain/economy.ts` (moved from `lib/math.ts`, which is now a barrel),
  `__tests__/domain/economy.test.ts`.
- **Tooling.** `eslint.config.js`, jest preset, `tsconfig` types.
- **Deleted** after grepping: `components/{Themed,StyledText,ExternalLink,useColorScheme*,useClientOnlyValue*}`,
  `constants/Colors.ts`, `assets/fonts/SpaceMono-Regular.ttf`.
- `docs/qa/phase-1-inicio-dark.png`, `docs/qa/phase-1-tokens-dark.png`.

### Dependencies added / removed
- **+** `@expo-google-fonts/space-grotesk`, `@expo-google-fonts/inter`,
  `@expo-google-fonts/jetbrains-mono` — the new type system.
- **+** `react-native-svg@15.15.4` — `GaugeRing`; also what PROMPT-07's charts will sit on.
- **+** `jest-expo@~57.0.5`, `jest@~29.7.0`, `@types/jest`, `eslint`, `eslint-config-expo` (dev).
- **−** `@expo-google-fonts/{syne,figtree,ibm-plex-mono}` — nothing referenced them once the tab
  bar's hardcoded `Figtree_600SemiBold` moved to `fonts.semibold`.
- **npm `overrides`: `@react-native/jest-preset` pinned to `0.86.3`.** Needed, not cosmetic:
  `jest-expo@57.0.5` requires `^0.86.3` while `react-native@0.86.2` — the version SDK 57's
  `bundledNativeModules.json` pins — peer-depends on exactly `0.86.2`. Without the override
  `npm install` fails with ERESOLVE. `--legacy-peer-deps` would have hidden it across the whole
  tree; this states the one package involved.

### Acceptance criteria
- [x] Identity everywhere, `android.package` = `com.xaviel.carguy`, no user-facing "Tu Combustible"
      string left — verified by grep. The three surviving mentions are deliberate: `lib/storage.ts`
      `KEY` (Phase 2 imports from it), `lib/backup.ts` `KNOWN_APPS` (the import contract, D1), and
      the "no es un respaldo válido de Car Guy ni de Tu Combustible RD" error, which has to name
      the old app to be useful. `docs/PLAN.md` and `docs/NEXT.md` keep the old name as historical
      records of the v1 app.
- [x] Icon set regenerated from SVG; every manifest size exists; splash background `#0E1116`.
- [x] Palettes, category colours, fonts, radius, spacing exported; legacy alias keeps old screens
      compiling — `npx tsc --noEmit` clean with zero screen edits for that reason.
- [x] `useTheme()` + provider; preference persisted; StatusBar, Stack and tab bar follow.
- [x] All five new components exist; `app/dev/tokens.tsx` previews them in both schemes —
      see `docs/qa/phase-1-tokens-dark.png`.
- [x] `lib/domain/economy.ts` + 24 tests, `npm test` green, `lib/math.ts` re-exports.
- [x] `npx expo lint` clean · `npx tsc --noEmit` clean · `npm run build` green.
- [x] Fuel flow verified **on web**, end to end, against Xaviel's real data: `/cargar` →
      odometer 51 900 + RD$310.50/gal + RD$3 500 → the two-of-three line resolved to
      `11.272 gal · RD$ 310.50/gal · RD$ 3,500.00` → saved → Historial shows the entry at
      **19.872 km/gal** (224 km ÷ 11.272 gal, brim-to-brim against the 51 676 km full tank) →
      Cifras recomputed to RD$ 12,500.00 for the month, 964 km, 28.66 km/gal average, and flagged
      the tank "Bajo" against the 37.45 baseline.
- [ ] Fuel flow on **Android** — not verified. Expo Go was not exercised this phase; the identity
      changes that only a native build can show (launcher name, icon, splash) need PROMPT-10's
      build anyway. Nothing in this phase is native-only: the tokens, fonts and components are all
      JS, and the web run covers them.
- [ ] EAS linked to slug `car-guy` — **skipped, not logged in** (`eas whoami` → "Not logged in").
      Recorded in the manual checklist. The exact commands:
      `npx eas-cli login` then `npx eas-cli init` in the repo root, which writes
      `extra.eas.projectId`. `app.json` has no `extra` block at all right now, so there is no stale
      id to remove first.

### Decisions made (defaults applied)
- **The legacy controls read the static `colors` alias, not `useTheme()`.** The prompt asked for
  them to be restyled with the tokens, which they are — but making them scheme-aware while the
  screens around them still paint from the alias would put light buttons on a dark screen in light
  mode. They go theme-aware in PROMPT-06, in the same change that migrates those screens.
- **`fonts.bold` resolves to Inter 600**, same as `semibold`. The identity specifies Inter at
  400/500/600 only; `bold` is a legacy face the old screens still ask for, so it maps to the
  heaviest weight that exists rather than pulling a 700 the design does not use.
- `fonts.title` is Space Grotesk **500**, `display` is **700** — the two weights the identity lists.
- The tokens preview lives at `app/dev/tokens.tsx` and renders a one-line notice when `!__DEV__`
  rather than being excluded from the export; expo-router has no per-route export exclusion, and a
  stub route costs 24 KB.

### Deviations from the package
- **The prescribed alias mapping produced invisible text.** `receipt → bg.surface` is right where
  the legacy screens used `receipt` as a background, but three call sites used it as *light ink on
  a dark panel* — `PriceBoard.grade` and the home screen's selected-vehicle chip. Mapped that way
  they rendered dark-on-dark. Rather than bend the mapping (which would break the background uses),
  those three call sites now read `colors.ink`, and the selected chip uses the accent with dark ink
  to match the restyled `Chip`. Four hardcoded amber `rgba()` values in `PriceBoard` were tokenised
  in the same pass; they were invisible-adjacent too and the last amber on the home screen.
- **Per-weight font imports, not package-root imports.** The prompt's font step says to install the
  three families; importing them the obvious way took `dist/` from 5.2 MB to **15 MB** — the
  packages ship every weight *and* every italic, and Metro bundles the lot. Deep subpath imports
  (`@expo-google-fonts/inter/400Regular`) plus `@expo/vector-icons/Ionicons` instead of the barrel
  brought it to **3.9 MB**, below the 5.2 MB baseline, with exactly 8 `.ttf` in the output.
- The npm `overrides` entry above is a dependency change the prompt did not anticipate.

### Observed, deferred
| Found in | Issue | Severity | Notes |
|---|---|---|---|
| Phase 1 · web | Saving a fill-up fires `window.alert` through `lib/alert.ts`, which freezes the tab for any automation and is a poor web experience | medium | PROMPT-06 owns the Más/alert pass; a non-blocking toast would fix both. It also cost a browser tab during this phase's QA |
| Phase 1 · `app/(tabs)/*` | Every legacy screen still paints from the static alias, so light mode does nothing for them | expected | This is the documented Phase 6 list: `index`, `cargar`, `historial`, `cifras`, `mas`, `gastos`, `precios`, `onboarding`, `vehiculo`, `carga/[id]`, plus `FillUpForm`, `VehicleForm`, `FuelPicker`, `PriceBoard`, `Field` and the four controls in `ui/index.tsx` |
| Phase 1 · `npx expo install --check` | Reports 12 packages that "may need updating" | low | Not touched — out of phase, and the repo is on the versions SDK 57 pins |

### Notes for the next phase
- **Token file shape** is `palette.{dark,light}` with nested `bg`/`text`/`status`/`statusBg`, plus
  flat `accent`, `accentPressed`, `accentInk`, `line`, `danger`, `cardShadow`. Read it through
  `useTheme()`, never by importing `palette` directly, except where a static value is unavoidable.
- **`colors` alias removal is the Phase 6 gate.** The screen list is in "Observed, deferred".
- `lib/storage.ts` `KEY` and `lib/types.ts` are untouched, as PROMPT-02 requires. `lib/backup.ts`
  now writes `{app:'car-guy', version:2}` and reads both envelopes — Phase 2 rewrites the payload
  but must keep reading `tu-combustible-rd` v1 forever.
- **The real backup fixture is in place** (`docs/imp-17092026/fixtures/…real.json`, gitignored) and
  its 5 ids are all the `id_<ts>_<hex>` fallback. Phase 2's importer will meet non-UUID keys on its
  first run, which is the point.
- `react-native-svg` is already installed, so PROMPT-07's charts need no new native dependency.
- `npm test` and `npx expo lint` are now part of the required green set for every later phase.

## Phase 2 — SQLite data layer, schema v1, legacy import, backup v2   (branch `imp-17092026/phase-2-sqlite`)

**Status:** complete
**Commits:** `923dc29` (the migration, as one change — the schema, repos and store rewire only make
sense together; splitting them would have left `main` with a store that could not read its own data)

### Changed
- **Engine.** `metro.config.js` (new), `lib/db/client.ts`, `lib/db/migrations.ts`, `lib/db/reset.ts`.
- **Data.** `lib/db/types.ts`, `lib/db/repos/{base,index}.ts`, `lib/db/seed.ts`,
  `lib/domain/catalog.ts`, `lib/domain/dates.ts`.
- **Import/backup.** `lib/import/tucombustible.ts` (new), `lib/backup.ts` (rewritten for v2).
- **Wiring.** `app/_layout.tsx` (SQLiteProvider + client-only boot), `lib/store.tsx` (rewritten onto
  repos, surface unchanged), `app/onboarding.tsx` and `app/(tabs)/mas.tsx` (import entry points),
  `public/sw.js` (worker/wasm rule, cache → `carguy-v2`), `lib/types.ts` (`Legacy*` aliases),
  `README.md`.
- **Tests.** `__tests__/domain/catalog.test.ts`, `__tests__/import/tucombustible.test.ts` — 53 tests
  total with the existing economy suite.

### Dependencies added / removed
None. `expo-sqlite ~57.0.1` was already a dependency and an `app.json` plugin — dead weight since
the beginning, per `docs/NEXT.md`. It is the engine now.

### Acceptance criteria
- [x] `carguy.db` with schema v1 exactly as the spec, `PRAGMA user_version = 1` — 17 tables, the
      four indexes and the `history_feed` view, transcribed statement for statement.
- [x] Async API only — a grep for `Sync(` and `withExclusiveTransactionAsync` across `lib/`, `app/`
      and `components/` finds only the comment in `client.ts` explaining why the latter is unusable.
- [x] Works on web in dev **and** from the static export served locally with **no COOP/COEP
      headers** — the serving script deliberately sets none, and the page reports
      `crossOriginIsolated === false` while the database works. SW rule documented in `public/sw.js`.
- [x] Repos for every table; no SQL in screens or components; every read excludes tombstones;
      `updated_at` written on every mutation.
- [x] `useStore()` surface unchanged — not one screen needed editing, which is the proof. Economy
      numbers identical: 500 km on 12.883 gal = **38.811 km/gal**, the partial counted into the
      following full tank exactly as before.
- [x] Catalog and templates seeded idempotently; a new vehicle gets its catalog reminders plus
      marbete/seguro/licencia, and `revisión técnica` disabled.
- [x] Legacy importer: both envelope shapes, idempotent, counts reported, odometer readings created,
      categories split between `service_record` and `expense`; entry points on onboarding and Más.
- [x] Backup v2 exports on web (real download, verified by intercepting it: `app: 'car-guy'`,
      `version: 2`, 17 tables, `mediaBytesIncluded: false`) and on Android through the share sheet;
      import merges v2 by `updated_at` or delegates v1 to the importer.
- [x] Tests for catalog, dates and import mapping; `tsc`, `expo lint`, `npm test`, `npm run build`
      all green.
- [x] **Real backup import — counts match.** Driven through the actual UI: the file holds 1 vehicle
      and 4 fill-ups, the app reported *"1 vehículo, 4 cargas"*, Historial showed 4 rows, and
      **re-importing the same file left it at 4**. Survived a reload.
- [x] **Android — verified on the real device** (see the addendum below).

### Three bugs found by verifying rather than assuming
1. **Writes vanished on reload.** The vehicle was written, read back within the session, and the
   OPFS file even grew — but after a reload the app went back to onboarding. The cause was two
   levels down: `base.upsert` omitted `created_at` on the UPDATE branch, and an `INSERT … ON
   CONFLICT DO UPDATE` still has to produce a row that satisfies every `NOT NULL` column before
   SQLite reaches the conflict clause. The web build reports that as **"Error finalizing
   statement"**, naming neither column nor table, and it only ever fired on the *second* launch
   (the first had nothing to conflict with). `created_at` is now always bound and still excluded
   from `DO UPDATE SET`, so an existing row keeps its original value.
2. **A redirect loop that pegged the renderer.** With writes now asynchronous, onboarding navigated
   to `(tabs)` before the vehicle existed, `(tabs)/_layout` redirected back to onboarding, and the
   two bounced. Fixed by applying the vehicle and fill-up to local state before the write lands;
   the reload reconciles.
3. **Silent failures.** All three of the above were invisible because the store's fire-and-forget
   writes and its startup `catch` swallowed errors. Both now report, which is what finally made the
   first bug findable.

### Decisions made (defaults applied)
- **`journal_mode` is WAL on native, MEMORY on web.** OPFS's `AccessHandlePoolVFS` offers no shared
  memory, which WAL needs. Also: `PRAGMA journal_mode` returns a row, so it goes through
  `getFirstAsync`, not `execAsync`.
- **The root layout renders a boot screen until the client owns the tree** (`useSyncExternalStore`,
  not a `setState` effect, which the lint rightly rejects). Car Guy's content comes from a database
  that exists only in the browser: static rendering in Node otherwise abandons the Suspense boundary
  (React #419) or mismatches on hydration (#418). Both are gone.
- **Odometer readings derive their id from their source** (`odo_<recordId>`), which makes the mirror
  idempotent without a lookup.
- **Seeded catalog reminders are hidden from the legacy Gastos screen.** It can only show a title, a
  date and a km, so the ~24 catalog and legal reminders would misrepresent themselves there. They
  are in the database and belong to the PROMPT-05 engine.
- **The store's mutations still return synchronously.** Keeping the exact surface is what let the
  persistence layer change without touching a screen; nothing reads the returned id.

### Deviations from the package
- The prompt splits repos across `lib/db/repos/*.ts` per table. They are a typed factory in
  `base.ts` plus one `index.ts` holding the per-table configuration and the three repos with real
  behaviour (vehicles, fuel, serviceRecords). Fifteen near-identical files would have been fifteen
  places for the tombstone filter to drift out of step.
- `vehicles.upsertRaw` exists alongside `upsert`: the importer needs to write vehicles without
  triggering the seeding side effect mid-transaction, because seeding reads the odometer readings
  the same transaction is still writing.

### Observed, deferred
| Found in | Issue | Severity | Notes |
|---|---|---|---|
| ~~Phase 2 · Android~~ | ~~Verified on web only~~ | — | **Closed 2026-09-17** — see the Android addendum below |
| Phase 2 · web | Saving a fill-up still fires `window.alert` | medium | Carried over from Phase 1. It froze the browser automation repeatedly during this phase; PROMPT-06 owns the fix |
| Phase 2 · `lib/store.tsx` | The legacy `AppData` shape is still rebuilt in full on every change | low | Fine at this size and it goes away with the screens in PROMPT-04/06. A per-vehicle query would be the fix if it ever bites |
| Phase 2 · seeding | `seedCatalog()` runs on every launch (~73 upserts) | low | Idempotent and fast, but it could check a version marker once the catalog stops changing |

### Notes for the next phase
- **Repo API:** `list(vehicleId?, {orderBy, direction, limit, includeDeleted})`, `listWhere(filter)`,
  `getById`, `count`, `upsert(input, db?)`, `softDelete(id, db?)`, `restore`, `listAllForBackup`.
  Passing `db` runs inline inside a caller's transaction; omitting it goes through the write queue.
- **The write queue is `enqueue()` in `lib/db/client.ts`.** Never call it from inside a function that
  is already running in it — pass the handle down instead.
- **Adding migration v2:** append `{ version: 2, up: [...] }` to `MIGRATIONS`. Never edit v1.
- **Mappers:** `mapLegacy` / `countsOf` / `describeCounts` in `lib/import/tucombustible.ts` are pure
  and tested; `importTuCombustible` is the transactional wrapper.
- **The SW rule** lives in `public/sw.js` as `isSqliteEngine` — network-first, never the HTML shell.
- `currentOdometer(vehicleId)` and `history.feed(vehicleId, filters)` are ready for PROMPT-03/04.
- `lib/domain/dates.ts` has `addMonths` (day-clamping), `addDays`, `daysBetween` and `nextJanuary31`,
  which PROMPT-05's reminder engine needs.

### Phase 2 addendum — Android verified on the device (2026-09-17)

Expo Go is not installed on the phone, so rather than add it the **real Car Guy APK** was built and
installed: `com.xaviel.carguy`, `versionName 2.0.0`, `versionCode 1`, arm64-v8a, 45 MB. It sits
beside Tu Combustible RD instead of replacing it — both packages are installed at once, which is
decision D1 working exactly as intended.

One thing the prebuild caught: `userInterfaceStyle: "automatic"` does nothing on Android without
**`expo-system-ui`**, which Phase 1 never installed. Added (`~57.0.4`) and the warning is gone.

What was exercised, all on the device over `adb`:

| | |
|---|---|
| Install | Coexists with `com.xavieltucombustiblerd.app`; dark identity and the new mark |
| Legacy import | Picked the real backup off the SD card through the system document picker → *"Datos importados · Listo: 1 vehículo, 4 cargas"* |
| Imported data | Home shows Citroen DS3 2015, RD$ 9,000.00, 3 cargas, **37.446 km/gal** — identical to web and to the old app |
| Odometer readings | The fuel form prefilled "Última carga: 51 676 km", so the derived `odometer_reading` rows came across |
| **Persistence** | `am force-stop` then relaunch → everything still there. Native WAL path confirmed |
| Fuel flow | Two-of-three resolved to `11.272 gal · RD$ 310.50/gal · RD$ 3,499.96`; saved; review said **19.872 km/gal over 224 km**, the same number the web run produced |
| Historial | All five entries, imported ones keeping their dates, odometers, stations and partial flags |

Screenshots: `docs/qa/phase-2-android-{import,inicio,historial}.png`.

No SQLite or JS errors in `logcat` throughout. The APK is **not published** — it is a verification
build, and Phase 10 owns releasing Car Guy.
