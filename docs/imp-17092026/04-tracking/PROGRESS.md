# Progress — IMP 17092026 (Car Guy)

Claude Code updates this file at the end of every phase (block in `00-context/04-conventions.md`).
The "Notes for the next phase" sections carry context between sessions.

**Started:** 2026-09-17 · **Status:** Phase 8 done · Phase 9 part A (sync core) done

## Phase status

| # | Phase | Status | Branch | Notes |
|---|---|---|---|---|
| 0 | Kickoff | ✅ | `imp-17092026/phase-0-kickoff` | Package in repo, audit checked, baseline green, fixture written |
| 1 | Rebrand + foundation | ✅ | `imp-17092026/phase-1-rebrand` | Car Guy identity, tokens, base components, domain tests, lint |
| 2 | SQLite + importer | ✅ | `imp-17092026/phase-2-sqlite` | Schema v1, repos, store rewire, catalog seed, legacy importer, backup v2 |
| 3 | Garage + navigation | ✅ | `imp-17092026/phase-3-garage` | Five tabs, OdometerHero, rich vehicle profile, media, DateField, odometer domain |
| 4 | Maintenance + Historial | ✅ | `imp-17092026/phase-4-maintenance` | Service records, expenses, tasks, documents, unified Historial, reminder resets. Six criteria finished 2026-09-24 on `fix/phase-4-gaps` |
| 5 | Inspections + reminders | ✅ | `imp-17092026/phase-5-inspections` | Urgency engine, DR legal calendar, inspection runner, guide, notifications. Twenty gaps closed 2026-09-25 on `fix/phase-5-gaps` |
| 6 | Identity pass | ✅ | `imp-17092026/phase-6-identity-pass` | Alias removed, fuel restyled + `missed_previous`, Más rebuilt, all strings in es.ts, a11y pass |
| 7 | Statistics + reports | ✅ | `imp-17092026/phase-7-cifras` | stats domain, four charts, Cifras rebuilt, PDF report, CSV export |
| 8 | x-core + account | ✅ | `imp-17092026/phase-8-cuenta` | carguy schema + RLS + Storage + LWW live on x-core; 7/7 verification; account works end to end |
| 9 | Sync | ✅ | `imp-17092026/phase-9-sync` | Protocol, engine, triggers, UI and media. 2026-09-25 on `fix/phase-9-gaps`: eight data-loss bugs fixed, pull made to work at all, acceptance run a–e passed, contract 14/14 |
| 10 | Release | 🟡 | `imp-17092026/phase-10-release` | Repo renamed to `car-guy`, web live at car-guy.vercel.app, PWA reload bug found and fixed, CHANGELOG and docs done. Android build, phone walk and tag need Xaviel |

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

## Phase 3 — Garage and navigation   (branch `imp-17092026/phase-3-garage`)

**Status:** complete
**Commits:** `48873b4`

### Changed
- **Navigation.** `(tabs)/_layout.tsx` → Inicio · Chequeo · Historial · Cifras · Más.
  `(tabs)/cargar.tsx` → `carga/nueva.tsx`. New: `(tabs)/chequeo.tsx` (placeholder),
  `vehiculo/nuevo.tsx`, `vehiculo/[id].tsx`, `vehiculo/[id]/editar.tsx`, `odometro.tsx`,
  `servicio/nuevo.tsx`, `gasto/nuevo.tsx`. `_layout.tsx` registers them with Spanish titles.
- **Home.** `(tabs)/index.tsx` rebuilt around `OdometerHero` + `QuickActions` + "Este mes"; the
  MICM board moved to `precios.tsx`.
- **Garage.** `components/VehicleForm.tsx` rewritten rich; `lib/db/vehicleOps.ts` saves it in
  dependency order; Más → Garaje opens the profile.
- **Media.** `lib/media/index.ts`, `lib/media/useMediaUri.ts`, `components/PhotoPicker.tsx`;
  `vercel.json` `Permissions-Policy` → `camera=(self)`.
- **Dates.** `components/DateField.tsx` + `.web.tsx`, used in the vehicle, fuel and expense forms.
- **Domain.** `lib/domain/odometer.ts` + 14 tests. `lib/i18n/es.ts` started.
- **UI.** `components/ui/OdometerHero.tsx`, `components/ui/Surface.tsx`.

### Dependencies added / removed
- **+** `expo-image-picker@~57.0.18`, `expo-image-manipulator@~57.0.18` — photos (ADR-10).
- **+** `@react-native-community/datetimepicker@9.1.0` — the native date picker (ADR-12); it adds
  its own config plugin, so `app.json` gained nothing by hand.

### Acceptance criteria
- [x] Five tabs; Cargar reachable from QuickActions; Chequeo placeholder present.
- [x] Home shows OdometerHero with the current odometer, a telltale row, QuickActions and
      "Este mes" — verified end to end in the browser (`docs/qa/phase-3-inicio-{dark,light}.png`).
- [x] Vehicle form with every field in the spec; profile with specs CRUD, readings, tiles, archive
      — the run created a *jeepeta* Honda CR-V 2018, plate lower-cased on input and stored
      uppercase, 88 000 km, added a "Presión de gomas · 32 psi" spec and archived it.
- [x] `DateField` native + web — the web build renders a real `<input type="date">`, confirmed by
      querying for it in the running page.
- [x] `lib/domain/odometer.ts` with tests; forms default to the current odometer and warn (never
      block) on a lower value.
- [x] `lib/i18n/es.ts` started; every new string goes through it.
- [x] PriceBoard lives in Más → Precios.
- [x] `tsc`, `expo lint`, `npm test` (67), `npm run build` (4.8 MB, 24 routes) all green.
- [x] Android verified on the device — see below.
- [x] Photos exercised end to end — **on the device.** The Android system picker opened with no
      permission prompt and scoped access ("Car Guy will only have access to the photos you
      select"); the chosen image was resized, compressed, written under `Paths.document/media/` and
      rendered. It survived an `install -r`.

### Two bugs this phase forced out
1. **Partial upserts were impossible.** Creating a vehicle hung for 30 s and never navigated.
   `applySyntheticOil` does `upsert({ id, intervalKm, … })`, and `INSERT … ON CONFLICT DO UPDATE`
   must still build a row satisfying every `NOT NULL` column *before* SQLite looks at the conflict
   clause — so the statement failed on `vehicle_id`, `title` and `metric` not being supplied. The
   web driver reports this only as **"Error finalizing statement"**. This is the same root cause as
   the Phase 2 `created_at` bug, and the fix generalises it: `base.upsert` now reads the existing
   row and merges the patch onto it, which is what every caller already assumed. Vehicle creation
   went from a 30 s timeout to **150 ms**.
2. **Light mode looked broken on the new home screen.** The new screens are theme-aware while the
   legacy `Card` reads the static dark alias, so a light-mode user got dark cards on a light page.
   Added `Surface` — the theme-aware card — and used it in the new screens. The legacy `Card` stays
   as it is, because the screens that still use it paint themselves from the same alias and would
   otherwise get light cards on a dark page. PROMPT-06 collapses the two.

### Decisions made (defaults applied)
- **The current odometer is the highest reading, not the newest.** A mistyped entry would otherwise
  silently lower the vehicle's odometer and reset every km-based prediction.
- **`kmPerDay` uses the median**, ignores same-day pairs and negative deltas, and caps at 400 km/day.
  One trip to Puerto Plata should not convince the app the car does 600 km every day.
- **A lower odometer warns, never blocks** — and says nothing at all when the entry is dated before
  the highest reading, where a lower number is simply correct.
- `saveVehicleDraft` writes the vehicle with `upsertRaw`, then the initial reading, then seeds.
  Seeding reads the current odometer to compute every `due_km`, so the reading has to exist first.
- The synthetic-oil toggle edits the vehicle's own `aceite_motor` reminder rather than the shared
  catalog row.
- Tapping a vehicle in Más opens its profile; "Activar" moved to its own button, so the row has one
  obvious primary target.

### Deviations from the package
- The prompt has the odometer sheet as a `Sheet` component; it is a full route (`odometro.tsx`)
  instead. It carries a date field whose native picker is itself a modal, and a modal inside a
  modal is where Android's back button becomes ambiguous.
- `servicio/nuevo` and `gasto/nuevo` are honest placeholders that say "próxima fase" and offer a way
  back, rather than empty files.

### Observed, deferred
| Found in | Issue | Severity | Notes |
|---|---|---|---|
| ~~Phase 3 · photos~~ | ~~Not driven automatically~~ | — | **Closed** — the library flow was driven on the device; the camera button is the same call with `camera: true` |
| Phase 3 · legacy screens | `gastos`, `historial`, `cifras`, `precios`, `carga/*` still paint from the dark alias | expected | PROMPT-06's list, now one item shorter: Inicio is done |
| Phase 3 · web | The fill-up review is still a blocking `window.alert` | medium | Third phase running. PROMPT-06 owns it |

### Notes for the next phase
- **`Surface` vs `Card`:** new screens use `Surface`. Do not reach for `Card` in anything new.
- **Strings go in `lib/i18n/es.ts`.** It is organised by screen; add a section rather than inlining.
- `saveVehicleDraft` is the only correct way to write a vehicle from a form — it owns the ordering.
- `useMediaUri(mediaId)` is the only correct way to render stored media; it revokes object URLs.
- `odometerWarning(value, date, readings)` is ready for the service and inspection forms.
- The history feed (`history.feed`) and `currentOdometer` from Phase 2 are still unused by the UI —
  PROMPT-04 wires them into the unified Historial.

### Phase 3 addendum — Android verified, and the palette moved to the house line (2026-09-17)

**Android.** Built and installed Car Guy `2.0.0` on the device and drove it over `adb`:

| | |
|---|---|
| Inicio | OdometerHero at 51 900 km, "actualizado hoy", RD$ 12,499.96 this month, 964 km, five tabs |
| Vehicle profile | Photo, plate pill, odometer, spend/km/fill-up/service tiles, spec suggestions |
| **Photos** | System picker (Android 13, no permission prompt, access scoped to the chosen image) → resize → compress → file under `Paths.document/media/` → rendered. Survived an `install -r` |
| **Native date picker** | `DateField` opens the Material date dialog on the odometer screen — ADR-12 confirmed on native |

One bug found by doing it rather than assuming: **the vehicle profile did not refresh after
editing.** Its effect only depended on `id` and its own mutation counter, so returning from the edit
screen showed the copy loaded on mount — the photo had saved, the screen just never re-read it. It
now also watches the store's `data`, which changes whenever anything writes.

**Palette.** Xaviel asked for Car Guy to follow the same aesthetic line as Music Hub, X AutoHub and
xaviel-web. Those three share a palette almost token for token, so Car Guy now uses it:

| | Was (Phase 1 proposal) | Now (house line) |
|---|---|---|
| Page | `#0E1116` | **`#121212`** — X AutoHub's `--main` |
| Surface / raised | `#161B22` / `#1E252E` | **`#1B1B1B` / `#212121`** |
| Accent | `#22D3EE` cyan | **`#FFB300`** — `--Hub`, identical in X AutoHub and the portfolio |
| Accent pressed | `#0FB5CF` | **`#FF8F00`** — `--HubDark` |
| Text | `#F3F5F7` / `#9AA4B2` | **`#FFFFFF` / `#B8B8B8`** — `--text-strong` / `--text-soft` |
| Body font | Inter | **Manrope** — the pairing X AutoHub uses with Space Grotesk |

Two decisions this forced:

- **"Próximo" is no longer amber.** The brand accent *is* amber now, so a warning in the same colour
  as every button stops reading as a warning. The ladder is green → pale yellow `#FFD166` → the
  house orange `#FF5F00` → red `#F0483E`, and every status carries a dot **and** a label.
- **Light mode's accent is `#CF4C00`** (the house `--primary-dark`). `#FFB300` on white is about
  1.9:1 — unreadable as a label or a button.

JetBrains Mono stays for numbers. X AutoHub uses Manrope even for prices, but the odometer and the
money columns need tabular figures or they shift as the digits change; it is the one face Car Guy
needs that the other projects do not.

The mark was regenerated in amber on `#121212`, and `app.json`, `+html.tsx`, the manifest and the
service-worker cache name all moved with it. `05-design-identity.md` now documents the real palette
with a note explaining the change. Inter was removed.

## Phase 4 — Maintenance, expenses, tasks, documents and the unified Historial   (branch `imp-17092026/phase-4-maintenance`)

**Status:** complete (six acceptance criteria finished later — see the follow-up below)
**Commits:** `5849de6` (part A — records, expenses, Historial) · `156f7c7` (part B — tasks, documents)
· `6cca91f` (follow-up — the six gaps, on `fix/phase-4-gaps`, 2026-09-24)

### Follow-up, 2026-09-24 (`fix/phase-4-gaps`)

Re-auditing the phase against its acceptance criteria on main found six things that were specified
and never built. All six are now done and verified in the running web app.

| # | Criterion | Was | Now |
|---|---|---|---|
| 1 | `gasto/[id]` detail | never created; a `gasto` row in the Historial went nowhere and an expense could not be edited or deleted | `app/gasto/[id].tsx`, plus `?id=` edit mode on `gasto/nuevo` |
| 2 | Service record "Editar" | the form always minted `svc_${Date.now()}`, so there was no way to correct a record | `servicio/nuevo?id=` hydrates the whole form; the detail screen has the button |
| 3 | `total_dop` override | — | inferred on load: a total equal to parts + labour keeps recomputing, anything else is the user's own number and is left alone |
| 4 | `done_record_id` | the record carried `source_task_id` but the task never pointed back | `saveServiceRecord` writes it in the same transaction |
| 5 | "Origen: chequeo del …" | `es.service.origin` was dead code | the record shows and links to its task or its failed check |
| 6 | Home Pendientes with tasks | reminders only | open tasks sit beside them, critical first; each pill is its own tap target |

Also wired the Historial's `gasto` and `chequeo` rows to the detail routes that exist (the inspection
one arrived in Phase 5 and the stale comment was never removed), and added Chequeo to the `+` picker.

Screenshots: `docs/qa/phase-4-gasto-detalle.png`, `phase-4-servicio-origen.png`,
`phase-4-pendientes-tareas.png`.

Split into two parts on the same branch, per the conventions: part A is the core of notes 3/6/7/8
and stands on its own; part B adds the two supporting surfaces.

### Changed
- **Domain.** `lib/domain/reminders.ts` — `completeReminder`, `remindersForServiceItems`,
  `resetForServiceItems`, `completeLegal`, `describeReset`. 18 tests.
- **Operations.** `lib/db/serviceOps.ts` (`saveServiceRecord`, `saveExpense`, `shopSuggestions`),
  `lib/db/documentOps.ts` (`saveDocument`).
- **Screens.** `servicio/nuevo.tsx` rewritten, `servicio/[id].tsx` (new), `gasto/nuevo.tsx`
  rewritten, `tareas/index.tsx`, `tarea/nueva.tsx`, `tarea/[id].tsx`, `documentos/index.tsx`,
  `documento/nuevo.tsx`, `documento/[id].tsx` (all new), `(tabs)/historial.tsx` rebuilt.
- **Removed.** `app/gastos.tsx` — its two jobs are now two entries in Más.
- **UI.** `components/ui/RecordRow.tsx`.
- **Strings.** `lib/i18n/es.ts` gained the `service`, `expense`, `history`, `tasks` and `documents`
  sections.

### Dependencies added / removed
None.

### Acceptance criteria
- [x] Service record create / detail / reclassify / soft-delete for the three kinds, with items,
      parts, photos, warranty and shop suggestions.
- [x] Saving items resets the matching reminders and the summary lists them — verified in the
      browser: a 52 000 km vehicle, an oil change with two items, and the dialog said
      **"Aceite de motor y filtro → 57,000 km · 17 mar 2027"** and
      **"Filtro de aire → 72,000 km · 17 sept 2027"**. Both numbers are the interval added to the
      odometer at completion, which is the rule.
- [x] Expenses with the new category set; a **Marbete** expense re-armed the legal reminder to
      **31 ene 2028** — anchored to the deadline, not to the payment date; `gastos.tsx` removed.
- [x] Tasks board with the done → record flow; the service form arrives prefilled with the task's
      title and kind and carries `source_task_id`.
- [x] Documents with expiry → legal reminder link ("Ajustamos el recordatorio a esa fecha"), photos
      viewable inline.
- [x] Historial on `history_feed`: month groups with totals, filters, search, FAB kind picker,
      pagination at 50.
- [x] Legacy imported maintenance/repair expenses appear as service records — they were written to
      `service_record` by the Phase 2 importer, so the feed picks them up with no extra work.
- [x] `tsc`, `expo lint`, `npm test` (85), `npm run build` (4.4 MB, 30 routes) green.
- [ ] Home "Pendientes" does not yet include open tasks — see "Observed, deferred".
- [ ] PDF documents — only photos are wired. See "Deviations".

### Decisions made (defaults applied)
- **A disabled reminder is never silently re-armed.** Turning one off is a decision; changing the
  oil should not undo it.
- **`completeLegal` forces `fixed_interval`** whatever the row says. The marbete deadline is set by
  the calendar, not by when the payment happened, so trusting a row that might have been edited
  would let one early renewal drift every future one.
- **The service title writes itself** from the selected catalog items until the user edits it. A
  record called "Aceite de motor y filtro + Filtro de aire" beats an empty one and beats making
  someone type it.
- **Reclassifying keeps the id**, so the record holds its place in the history and any reminder it
  completed still points at it.
- **Only *mantenimiento* shows the catalog.** A repair or an upgrade has no interval to re-arm, and
  offering the list there would invite meaningless resets.
- Items and parts are replaced wholesale on save rather than diffed — there are only ever a handful,
  and an edit that removed one has to remove it here too.

### Deviations from the package
- **PDF documents are not wired.** `expo-document-picker` is installed and the `media` table already
  has `kind: 'pdf'`, but the viewer needs a platform split (share/openURL on Android, a new tab on
  web) that is a small feature of its own. Photos cover the common case — a picture of the seguro is
  what people actually take — and the gap is recorded here rather than half-built.
- `servicio/[id]` has no edit form yet; it offers detail, reclassify and delete. Editing a record
  means re-running the reminder resets against the *previous* values to avoid double-counting, which
  is a real piece of design and belongs with PROMPT-05's engine rather than being rushed here.

### Observed, deferred
| Found in | Issue | Severity | Notes |
|---|---|---|---|
| Phase 4 · home | "Pendientes" still shows only legacy reminders, not tasks or catalog reminders | medium | The store filters catalog/legal reminders out of `vehicleReminders` (Phase 2), because the legacy Gastos screen could not represent them. PROMPT-05 replaces that whole path with the real engine and should fold tasks in |
| Phase 4 · search | `LIKE … COLLATE NOCASE` folds ASCII only, so "optimo" will not find "Óptimo" | low | Accent-insensitive search needs an ICU build of SQLite. Noted in the code |
| Phase 4 · web | The fill-up review is still a blocking `window.alert`, and the save dialogs now use it too | medium | Fourth phase running. PROMPT-06 owns it; a non-blocking toast would fix all of them at once |
| Phase 4 · service edit | Editing a saved record cannot re-run reminder resets safely yet | medium | See "Deviations" |

### Notes for the next phase
- **`lib/domain/reminders.ts` is where PROMPT-05 builds.** `completeReminder` is the completion half;
  the status half (`ok`/`próximo`/`urgente`/`vencido`/`sin_datos`, thresholds, predicted dates) goes
  beside it and reuses `kmPerDay` from `lib/domain/odometer.ts`.
- **`saveServiceRecord` is the only correct way to write a record** — it owns the item/part
  replacement and the reminder resets, so an inspection that creates a repair should call it too.
- Tasks already carry `source_inspection_result_id`; PROMPT-05 fills it when an item fails.
- `history_feed` needs a new `UNION ALL` arm for inspections' own detail route, and the view can only
  be changed in a **migration v2** — never by editing v1.
- The four status colours and `StatusPill` are already used by documents and tasks, so the engine's
  output has somewhere to render with no new component.

## Phase 5 — Chequeos, the reminders engine and notifications   (branch `imp-17092026/phase-5-inspections`)

**Status:** complete (the gaps below were finished later — see the follow-up)
**Commits:** `1ec9902` engine + legal calendar · `ea8e56e` runner, guide, reminders UI · `63b616f` notifications
· follow-up on `fix/phase-5-gaps`, 2026-09-25

### Follow-up, 2026-09-25 (`fix/phase-5-gaps`)

A line-by-line audit of PROMPT-05 against main found the report below was generous: besides the two
deviations it admits (no template editor, no fecha simulada), a reminder could not be created or
edited at all, a failed item could never produce a reminder, and notifications fired at noon for
every vehicle type. All of it is done now and verified in the web app with a headless Chromium
driving a persistent profile; Android is still unverified (no device, EAS not logged in).

| # | Area | Was | Now |
|---|---|---|---|
| 1 | Template editor | missing | `chequeo/plantillas/[id]`: reorder, switch items off/on, add items, cadence, enable. Saving a seeded template creates `<id>@<vehicleId>` (deterministic, so devices converge under sync); opening without saving copies nothing |
| 2 | Chequeo list | rows only started a run; disabled templates vanished | Apagar/Activar and Editar per row; runs of a copy include the seeded original's, so an edit does not reset the streak or make it due |
| 3 | Seeding by vehicle | diesel got only `diesel_semanal`; moto only a manual T-CLOCS | `templateIdsForVehicle`: diesel = diario + diésel semanal + mensual; moto = T-CLOCS **daily** + new `motor_semanal` (fluids, chain), the split research §A.4 recommends. The seeder retires catalog items that disappear |
| 4 | Weekly streak | every run counted — three checks in one week read "3 semanas" | runs inside one window count once (≥ 6 days apart to count); the chain still breaks after 8 days |
| 5 | Runner on failure | fixed "Crear tarea"; `on_fail = reminder` still made a task | "Al terminar, crear: Tarea · Recordatorio · Nada", defaulting from `on_fail`. A reminder is a one-off, date-only, due in 7 days |
| 6 | Runner timer | recorded only | shown next to the progress (`0:42`) |
| 7 | Data links | task's `source_inspection_result_id` held the inspection id; a photo's owner was the *item* id | result ids are `<inspectionId>__<itemId>`, known before saving, so photos and tasks point at the real result. Old tasks still resolve |
| 8 | Result / past run | failures only, no photos, static ring | every answer with its note and photo; the ring sweeps (Reanimated, respects reduced motion); haptic only on a fresh run |
| 9 | Task → record | no way back to the check; the record lost the item | the task links to its check and passes `serviceTypeId` to the record form |
| 10 | Reminder form | `recordatorio/nuevo` missing; `[id]` was only "mark done" | `components/ReminderForm.tsx` in both: title, catálogo, Fecha · Km · Ambos, recurrence, fixed interval with its explanation, thresholds (collapsed), notes, enable. Eliminar too |
| 11 | Recordatorios list | flat; no Editar, no Nuevo; disabled ones unreachable | grouped vencido → … → ok → Desactivados; "vence 31 ene"; sorted by effective date within a group |
| 12 | "Hecho" | completed first, then opened the record without the item — a fixed interval advanced twice | a sheet: date, odometer, then "¿Registrarlo como mantenimiento?" (record form prefilled, which does the one reset) or "Solo marcar hecho" |
| 13 | Inicio | Seguro/Licencia without a date were permanently "sin datos", so "Todo al día" never showed; tasks tacked on after reminders | sin-datos is list-only; tasks and reminders merged by severity, top 4 |
| 14 | Marbete banner | showed the *next* nudge ("Ya abrió" before it opened) | the latest nudge that has arrived, plus "Estimado: RD$1,500 / 3,000". The 18 Jan nudge says "cierra hoy" on the day and "cerró el 18" after |
| 15 | Licencia | generic 45/14; PGR link unused | 60/30; the detail explains multas and links to the PGR |
| 16 | Vida útil | `vidaUtil()` never called | badge + revisión técnica line on the vehicle profile |
| 17 | Catálogo de servicios | missing | `catalogo/` list + edit, linked from Más → Mantenimiento; a changed interval moves only reminders still on the old default. The seeder no longer overwrites intervals at launch |
| 18 | Notification plan | noon for everything; no "becomes próximo"; every template of every vehicle type | the user's hour; `reminder:<id>:proximo` from the engine's own thresholds; both → earlier limit; each vehicle's actual templates, deduped; all non-archived vehicles |
| 19 | Notification plumbing | no cold-start tap; resync on every store change, could overlap; no first-check offer | `getLastNotificationResponseAsync`; 500 ms debounce, one run at a time; the offer after the first completed check ("Te aviso cuando…"), once; a real switch in settings |
| 20 | Fecha simulada | missing | `app/dev/tokens.tsx`: Real · 16 oct · 20 ene · any date, and "Ir a Inicio". Overrides `todayIso()`, `__DEV__` only, in memory |

Also: Más's garage row nested the "Activar" button inside the row's button (invalid HTML on web,
visible only with two vehicles) — split into siblings.

**Verified in the browser** (web, dev server, headless Chromium): new car → three templates →
weekly run with Refrigerante = Falla → "Revisar refrigerante" *Crítica* → red pill on Inicio → task
→ record → "Todo al día". Oil showed "~15 feb 2027 (estimado)" with the low-confidence note; a
second reading (50,500 km on 1 Sept) moved it to "~14 dic" and the note went away. Editor: moved an
item, switched one off, added one → the run uses the copy, not due again, streak 1. Diesel and moto
sets. Marbete on 16 Oct ("abre pronto", RD$1,500) and 20 Jan ("faltan 11 d", "cerró el 18"). No
console errors on any screen after the Más fix. `tsc`, `expo lint`, 369 tests, `npm run build`
(45 pages) green.

Screenshots: `docs/qa/phase-5-gaps-*.png` (12).

**Verified on a real phone, 2026-09-25** — Xiaomi Redmi Note 10 Pro (M2101K6G), Android 13, a local
release build (`releases/car-guy-2.0.0-local-arm64.apk`, Build `2dff1cb`, signed with the same key
as the copy already installed, so it installed as an update and the owner's data stayed). EAS was
not used: `eas login` could not complete from the Claude Code `!` shell. Test writes went to a
throwaway vehicle, "Prueba QA", deleted afterwards.

| Check | Result |
|---|---|
| Launch, existing data intact after the update | ✅ |
| Enabling notifications: channel created **before** the permission prompt | ✅ Android 13's "Allow Car Guy to send you notifications?" appeared on the switch |
| Channel `mantenimiento`, importance DEFAULT | ✅ `mImportance=3` in `dumpsys notification` |
| No exact-alarm permission | ✅ none in `dumpsys package` |
| Scheduled ≤ 30 | ✅ 27 with one vehicle; exactly 30 with two (cap holds) |
| "Probar notificación" arrives in ~5 s | ✅ posted on `mantenimiento` |
| Tap, app running → deep link | ✅ lands on Chequeo |
| Tap, app **killed** → deep link (cold start) | ✅ lands on Chequeo a few seconds after boot |
| Schedule rebuilt after the OS wiped it (force-stop) | ✅ back to 27 on next launch |
| Runner: cold-engine banner, timer, "Al terminar, crear", native "Tomar foto", "faltan 3" disabled, odometer prefilled | ✅ |
| First-check offer ("Te aviso cuando…", Ahora no / Avisarme) | ✅ shown once after the first check; Avisarme turned notifications back on |
| Result ring animates (Reanimated, native) | ✅ caught mid-sweep at 0.8 s |
| Failed Refrigerante → crítica task → red pill on Inicio | ✅ |
| Haptic on a clean check | not judged — a check with a failure gives none, and a tick cannot be read over adb |

**Found on the phone and fixed:** deleting a vehicle from its profile tombstoned only the vehicle
row; its reminders, tasks, checks, readings and photos stayed live and would have synced. Fixed on
`fix/vehicle-delete-cascade` with `deleteVehicleCascade`, tested against a real SQLite.
Prueba QA was then removed through the fixed "Quitar" on the phone: its task vanished from Tareas,
the Citroen became active again, and the schedule dropped back to the one-vehicle plan (27).

**EAS build on the phone, 2026-09-25.** The template-key app was uninstalled after a second backup
was saved to the SD card, copied to `releases/backups/` and checked (1 live vehicle, 5 fill-ups,
6 readings, 19 reminders; the vehicle photo is not in backups, re-added by hand). The EAS preview
(key `A1:64:50:A0…`) installed through the File Manager — MIUI's "Install via USB" is off and its
security center ignores simulated taps, so the owner confirmed that step; the File Manager's
install permission was switched back to `deny` afterwards and the APK deleted. The backup restored
67 records and Inicio matched the pre-uninstall numbers exactly. Later builds install over it as
updates (same key): `e272ae4` did, data intact.

Found in the restore and fixed (`e272ae4`): the restored switch said notifications were on and 27
were scheduled, but the fresh install had no `POST_NOTIFICATIONS`. The settings screen now shows
"El teléfono no los está dejando pasar" + "Dar permiso". Verified on the phone: revoked the
permission with `pm revoke` → the notice appeared → "Dar permiso" → Android's prompt → Allow →
notice gone, 27 scheduled, a test notification delivered (≈15 s rather than 5 — MIUI batches
inexact alarms; the app never requests exact ones, by design).

**Seeded ids across accounts — found, fixed, deployed.** `service_type`,
`inspection_template` and `inspection_item` used the catalogue's slug ids (`aceite_motor`,
`carro_semanal`) as a global `id text primary key` in `carguy`. `tools/verify-shared-ids.mjs
--legacy` proved it against x-core: the second account's push of a seeded row was refused with
`403 42501 new row violates row-level security policy`, and a push error aborts the whole sync —
any second account would never have synced. `sql/008_catalog_per_user_keys.sql` (applied
2026-09-25) keys the three tables by `(user_id, id)`, and the engine pushes them with
`onConflict: 'user_id,id'` (`keyedBy: 'user_id'` in `lib/sync/tables.ts`). After: 7/7 (each account
keeps and edits its own copy) and `verify-sync.mjs` 13/13. Probe accounts removed with sql/999.

This is the phase the whole cycle exists for: note 4, *"se me pasó revisarle los fluidos … por no
tener esa costumbre diaria"*.

### Changed
- **Domain.** `lib/domain/reminders.ts` gained `evaluate`, `displayDueDate`, `bySeverity`;
  `lib/domain/legal-dr.ts` and `lib/domain/inspections.ts` are new.
- **Queries.** `lib/db/reminderQueries.ts` (`evaluatedReminders`, `attentionReminders`),
  `lib/db/inspectionOps.ts`.
- **Screens.** `(tabs)/chequeo.tsx` rebuilt, `chequeo/[templateId]/run.tsx`, `chequeo/guia.tsx`,
  `inspeccion/[id].tsx`, `recordatorios/index.tsx`, `recordatorio/[id].tsx`, `notificaciones.tsx`.
- **Home.** Telltales now come from the engine; the marbete banner appears inside its window.
- **Notifications.** `lib/notifications/plan.ts` (pure) and `lib/notifications/index.ts` (adapter),
  wired in `app/_layout.tsx`.
- **Tests.** 164 total, up from 85: `reminders.test.ts` (24), `legal-dr.test.ts` (20),
  `inspections.test.ts` (16), `notifications/plan.test.ts` (19).

### Dependencies added / removed
- **+** `expo-notifications` (ADR-07), `expo-haptics` — the success feedback after a clean check.

### Acceptance criteria
- [x] The engine implements the spec: four states plus `sin_datos`, `triggeredBy`, prediction,
      confidence, snooze, fixed vs rolling reset, legal thresholds. Every branch is tested and the
      suite passed on the first run.
- [x] `legal-dr.ts` with the marbete deadline, escalating nudges, the cost tier and the vida útil
      badge, tested across the year boundary.
- [x] Recordatorios list with complete and snooze; home telltales from the engine; marbete banner.
- [x] Chequeo tab with due-today cards, streak ring, template list, recent runs and the guide.
- [x] Runner: grouped items, how-text, OK/Falla/N/A, cold-engine banner, note required on a failure,
      photo, cannot finish while anything is unanswered, odometer prompt, result screen.
- [x] Failed critical items create *crítica* tasks — verified: failing Refrigerante produced
      "Revisar refrigerante" marked Crítica on the task board.
- [x] Templates follow the vehicle type; a motorcycle gets T-CLOCS, a diesel the water separator.
- [x] Notifications: channel before permission, ≤ 30, deterministic ids, resync on write and on
      foreground, deep links, test button, settings; nothing attempted on web; no exact alarms.
- [x] Guide with the overheating section in full.
- [x] `tsc`, `expo lint`, `npm test` (164), `npm run build` (36 routes) green; web verified.
- [ ] **Android not verified this phase** — the phone was disconnected when the build finished. The
      APK is built and waiting. Notifications in particular can only be judged there.
- [ ] Template editor (`chequeo/plantillas/[id]`) not built — see "Deviations".

### Decisions made (defaults applied)
- **A check is due "a cadence-length since the last run", not by calendar week.** A weekly check done
  Sunday and again Saturday is a week apart in practice; a rule that said otherwise would be arguing
  with someone who is doing the right thing.
- **The streak forgives one day** for the same reason, and dies once the window has genuinely lapsed.
  Documented in `lib/domain/inspections.ts`.
- **Critical failures are refrigerante, aceite de motor, líquido de frenos and pastillas.** Every one
  is a way to destroy an engine or fail to stop. Coolant is on the list because it is why this app
  was written.
- **A failure needs a note before the check can be submitted.** "Falla" with no detail is worth
  almost nothing a week later.
- **Repeating checks are planned before dated reminders.** The habit is the point; a hundred
  reminders must not push the daily check out of a 30-slot schedule.
- **Permission is requested when the user turns notifications on**, not at first launch, where the
  prompt arrives before the user has any reason to say yes.
- **Channel importance DEFAULT, not MAX.** This is a reminder to check the coolant, not an alarm.

### Deviations from the package
- **No template editor.** Reordering, disabling items and adding custom ones — and the
  copy-on-write that scopes an edited seeded template to one vehicle — is a screen of its own. The
  seeded lists are complete and correct for the three vehicle shapes, so the app is fully usable
  without it; the editor is the first thing to add if the lists ever feel wrong.
- **No "fecha simulada" dev control.** The marbete window logic is covered by tests across the year
  boundary, which is a better check than nudging a device clock.
- **The Phase 4 `resetForServiceItems` stayed where it was** rather than moving; `evaluate` was added
  beside it in the same file, so both halves of the reminder lifecycle live together with their tests.

### Observed, deferred
| Found in | Issue | Severity | Notes |
|---|---|---|---|
| Phase 5 · Android | Nothing verified on the device this phase | medium | The APK is built. Notifications, haptics and the runner's one-thumb ergonomics all need a real phone |
| Phase 5 · home | "Pendientes" shows reminders but still not open tasks | low | Carried from Phase 4. The engine is in place now, so folding tasks in is a small change |
| Phase 5 · web | Blocking `window.alert` still used for save confirmations | medium | Fifth phase running. PROMPT-06 owns it |
| Phase 5 · notifications | `resync` runs on every store change | low | Cheap today, but it rebuilds the whole plan; debounce it if the schedule ever grows |

### Notes for the next phase
- **PROMPT-06 owns the alert problem.** Replacing `lib/alert.ts` on web with a non-blocking toast
  fixes five phases' worth of save confirmations and unblocks browser automation.
- The legacy `colors` alias is still used by: `carga/nueva`, `carga/[id]`, `cifras`, `precios`,
  `onboarding`, `VehicleForm`, `FillUpForm`, `FuelPicker`, `PriceBoard`, `Field`, and the four
  controls in `ui/index.tsx`. Historial, Inicio, Chequeo, Más and every Phase 4–5 screen are already
  theme-aware and use `Surface`.
- `evaluate()` is pure and takes its context explicitly, so PROMPT-07's statistics can reuse it for
  "upcoming costs" without touching the database twice.
- `planNotifications` is where any change to *when* the app speaks belongs — not the adapter.

## Phase 6 — Fuel restyle and the identity pass   (branch `imp-17092026/phase-6-identity-pass`)

**Status:** complete
**Commits:** `434e8c8` controls, fuel, alert host · `dbbf3dc` legacy screens, alias removal, a11y · follow-up on `fix/phase-6-gaps`, 2026-09-25

### Follow-up, 2026-09-25 (`fix/phase-6-gaps`)

An audit of PROMPT-06 against main: the core was real (alias gone, fonts gone, fuel restyled,
`missed_previous` persisted end to end, review Sheet). What was open:

| # | Area | Was | Now |
|---|---|---|---|
| 1 | Historial fuel rows | no partial label; tag hardcoded "km/gal" (wrong for GNV) | "Parcial" on partial tanks; economy through `kmPerUnit()` so GNV reads km/m³ |
| 2 | Economy precision | "41.346 km/gal" on Inicio, Historial and the review sheet | one decimal everywhere ("41.3 km/gal") |
| 3 | Onboarding | the vehicle form dumped on the first screen, no mark, no welcome, no way to sign in | welcome with the app mark → "Crear mi primer vehículo" or "Importar respaldo" → "¿Ya tienes cuenta?" card to Cuenta; forwards to Inicio once a sync brings vehicles |
| 4 | Archiving | only a pill on the profile — the vehicle stayed in the selector and everywhere else, contrary to its own hint | the store carries `isArchived`; the selector hides it; "active" moves to a vehicle in use; Más → Garaje lists them under "Archivados"; no "Hacer activo" on an archived vehicle |
| 5 | Strings | telltales, "Hacer activo", "Volver", "motor frío", odometer hint, color placeholder, minutes, reminder status labels, Historial check titles hardcoded | all in `es.ts` |
| 6 | Touch targets | ~12 local chips at 32–40 px; the shared `Chip` at 40 | 44 px minimum everywhere |
| 7 | Light-mode contrast | RecordRow icons 1.6–2.7:1 on their badge; white on the dark theme's red 3.68:1 | `categoryInkLight` (≥ 3.5:1, same hues); `dangerInk` token (5.09:1 dark, 6.47:1 light) |
| 8 | Smaller | document image placeholder a hardcoded black tint; review sheet titled "Primera medición" after a flagged chain break; OdometerHero missing from the tokens page | themed; "La cuenta empieza de nuevo"; added |
| 9 | Test | "fixtures unaffected" compared two hand-made rows | runs the real 12-fill-up legacy fixture both ways, plus a test that one flag only changes its own stretch |

Screenshots: every tab in dark and light (`docs/qa/phase-6-{inicio,chequeo,historial,cifras,mas}-{dark,light}.png`),
`phase-6-onboarding-dark.png`, `phase-6-garaje-archivados.png`. `tsc`, lint, 376 tests, web build green.

Observed, deferred: Cifras logs seven React warnings about responder props reaching the DOM — from
`react-native-gifted-charts` on web, pre-existing, harmless. The dev screens' specimen text stays
inline (documented). Packages are a few SDK-57 patch versions behind (`expo-doctor`); updating is a
separate task that needs a retest.

The phase that makes the app one product. Five phases had been building Car Guy screens next to Tu
Combustible RD screens that painted themselves from a static dark alias; this removes the alias and
the seam with it.

### Changed
- **Controls.** `components/ui/index.tsx` — PrimaryButton, GhostButton, Chip on `useTheme()`; `Card`
  is now `Surface` under its old name. New: `SectionHeader`, `KeyValueRow`, `Segmented`, `NavRow`,
  promoted out of the copies six screens were each keeping. `Field` (plus an `error` state),
  `DateField` (both platforms), `PhotoPicker` and `StatusPill` (a `neutral` tone) followed.
- **Fuel.** `components/FillUpForm.tsx` rewritten on tokens with the `missed_previous` toggle;
  `components/FillUpReviewSheet.tsx` (new) replaces the save alert; `app/carga/nueva.tsx`,
  `app/carga/[id].tsx`, `components/PriceBoard.tsx`, `app/precios.tsx`.
- **Domain.** `lib/domain/economy.ts` — `computeEconomy` and `reviewFillUp` honour `missedPrevious`;
  `lib/types.ts` gained the optional field; `lib/store.tsx` maps it both ways.
- **Alerts.** `lib/alert.ts` rewritten around a subscriber; `components/AlertHost.tsx` (new), mounted
  in `app/_layout.tsx`.
- **Screens.** `app/(tabs)/mas.tsx` rebuilt to the IA spec, `app/(tabs)/cifras.tsx` restyled,
  `app/onboarding.tsx`, `app/+not-found.tsx`, `components/VehicleForm.tsx`, `app/chequeo/guia.tsx`
  (now renders from `es.guide`), `app/dev/tokens.tsx`.
- **Tokens.** `constants/theme.ts` — the `colors` alias and the `bold` font face are gone.
- **Strings.** `lib/i18n/es.ts` gained `routes`, `web`, `guide`, `more`, `onboarding`, `notFound`,
  `stats`, `fuel`, `fuelReview` and `prices`, and the home/`common` sections grew.
- **Tests.** 172, up from 164: eight in `__tests__/domain/economy.test.ts` for the chain break.

### Dependencies added / removed
None. `expo-constants` (already present) supplies the version for "Acerca de"; `expo-haptics`
(already present) the light tap on saving a fill-up.

### Acceptance criteria
- [x] No `colors` alias; no Syne/Figtree/Plex; `useTheme()` everywhere — `grep -rn "colors"` over
      `app components lib constants` returns only `categoryColors` and `colorScheme`. The fonts had
      already gone in PROMPT-01; the `bold` alias face went here, since nothing referenced it.
- [x] Fuel forms/history/prices restyled, behaviour identical, `missed_previous` implemented and
      tested. Verified in the browser at 1568 px: a first fill-up at 52 000 km read **"Primera
      medición"**, a second at 52 400 km read **40 km/gal over 400 km**, and a third at 53 300 km
      **with the flag set** refused to compare — *"Marcaste que faltaba una carga anterior, así que
      la cuenta del consumo empieza de nuevo desde esta."* Without the flag that tank would have
      published 90 km/gal. Historial showed the km/gal tag on the second row and none on the third.
- [x] Más reorganised per spec, including the Apariencia switch — which is new: the theme preference
      has existed since Phase 1 with no way for anyone to change it.
- [x] Onboarding and not-found restyled.
- [x] All strings in `lib/i18n/es.ts`. Swept with a grep for accented literals and for Spanish
      phrases in JSX; both come back empty outside `es.ts` and `app/dev/tokens.tsx`, which is a
      developer surface and not shipped copy.
- [x] Light mode verified on every screen: Inicio, Chequeo, Historial, Cifras, Más, the guide, the
      fuel form, precios and both dialogs. The one contrast fix needed was the web DateField, whose
      `colorScheme` was hard-coded to dark and put a black calendar glyph on a white field.
- [x] a11y pass: every `<Pressable>` in the app now declares a role, and those belonging to a set
      carry `selected`/`checked`/`expanded`. Confirmed through the browser's accessibility tree — a
      history row reads as *"Gasolina Regular, 18 sept de 2026 · 53,300 km, RD$ 3,075.00"* and the
      new toggle as a checkbox labelled *"Se me olvidó registrar una carga anterior"*.
- [x] `app/dev/tokens.tsx` shows every component, and the "legacy controls" column that used to look
      identical in both schemes now actually differs — which is the proof the alias is gone.
- [x] Screenshots in `docs/qa/phase-6-*` (11), both schemes.
- [x] `tsc`, `expo lint`, `npm test` (172), `npm run build` (36 routes) green.
- [ ] **Android not verified** — no device attached and no AVD configured on this machine
      (`adb devices` empty, `emulator -list-avds` empty). Same gap as Phase 5.

### Decisions made (defaults applied)
- **`missedPrevious` is optional on the legacy `FillUp` type, not required.** Every row written
  before this phase simply lacks it, and `undefined` reads as false everywhere it is used — which is
  also what keeps the existing economy fixtures untouched. A test asserts that explicitly.
- **A flagged *partial* drops the baseline entirely**, where a flagged full tank becomes the new one.
  Its own volume cannot be credited to the next full tank's distance either, so there is nothing
  honest to measure from until the tank after it.
- **The chain break wins over "first measurement" in the review copy.** Both are true when the flag
  is set on an early fill-up, and the flag is the one that explains the missing numbers.
- **Native keeps the platform alert; only web moved to `<AlertHost>`.** The complaint was that
  `window.alert` blocks the page and wears no identity. Android's dialog does neither, and replacing
  it would be taking a platform convention away for nothing.
- **Alerts queue rather than overwrite**, and a button's `onPress` runs after the queue advances, so
  a handler that raises its own alert lines up behind instead of being swallowed.
- **`normal` and `first` are a neutral pill, not green.** "The same as always" is not an achievement
  and "nothing to compare yet" is not a verdict; `StatusPill` gained a `neutral` tone rather than
  letting a second component start showing status.
- **The PriceBoard stays dark in light mode**, as the identity spec allows, and now reads
  `palette.dark` explicitly instead of inheriting it from an alias. Its week label moved to white so
  the amber is reserved for the prices themselves.
- **Chips are 40 px tall with 4 px of hitSlop** rather than 44 px of real height: 48 px of reachable
  target around a pill that looks wrong at 44.
- **The guide's copy moved as segments, not as flattened strings.** Its paragraphs carry emphasis;
  either it kept its markup or it lost meaning, and a two-field segment is the smallest thing that
  keeps it.

### Deviations from the package
- **`app/dev/tokens.tsx` keeps inline Spanish.** It is a developer surface reachable only by typing
  the route and gated on `__DEV__`; its labels are specimens of the type scale, not product copy.
- The prompt asks for screenshots "of all tabs in dark and light". There are 11 covering both
  schemes across Inicio, Chequeo, Historial, Cifras, Más, precios, the fuel review, the alert and the
  token sheet — not a strict 2 × 5 matrix, but every surface that changed, in the scheme where the
  change is visible.

### Observed, deferred
| Found in | Issue | Severity | Notes |
|---|---|---|---|
| Phase 6 · Android | Still nothing verified on a device | medium | Carried from Phase 5. No device and no AVD on this machine. Haptics on save, the native date picker, the native alert and one-thumb reach all need a phone |
| Phase 6 · home | "Pendientes" still does not include open tasks | low | Carried from Phase 4 and 5 |
| Phase 6 · service edit | `servicio/[id]` still has no edit form | medium | Carried from Phase 4 |
| Phase 6 · documents | PDF documents still not wired | low | Carried from Phase 4 |
| Phase 6 · alerts | `AlertHost` renders nothing on native but still mounts and subscribes | low | One subscription, never fired. Not worth a platform split |
| Phase 6 · search | `LIKE … COLLATE NOCASE` still folds ASCII only | low | Carried from Phase 4 |

### Notes for the next phase
- **`Segmented`, `SectionHeader`, `KeyValueRow` and `NavRow` exist now** — PROMPT-07's statistics
  screen should reach for them before writing its own rows, and `StatusPill`'s `neutral` tone is
  there for a figure that is merely a figure.
- **`computeEconomy` can return fewer points than there are full tanks**, and a `missedPrevious` row
  has no `EconomyPoint` at all. Anything in PROMPT-07 that pairs fill-ups with economy by index
  rather than by `fillUpId` will be wrong.
- The theme preference is now reachable in Más → Apariencia, so any new screen can be judged in both
  schemes without editing storage by hand.
- `lib/alert.ts` exports `AlertRequest` and `subscribeToAlerts`; if PROMPT-07 or PROMPT-08 wants a
  toast rather than a dialog, it is a second host reading the same queue, not a new mechanism.
- Every `<Pressable>` carries a role as of this phase. Keeping that true is cheaper than another
  sweep — the audit is one `grep -c` per file.

## Phase 7 — Statistics, charts, the PDF report and CSV export   (branch `imp-17092026/phase-7-cifras`)

**Status:** complete
**Commits:** `9ed98c8`

Note 9, *"con estadísticas y todo"*. Cifras stops being the placeholder Phase 6
restyled and becomes the screen that answers what the car costs.

### Changed
- **Domain.** `lib/domain/stats.ts` (new, pure): `periodRanges`, `inRange`, `totalSpend`,
  `spendByCategory`, `monthlySpendByCategory`, `distanceInRange`, `distancePerMonth`, `costPerKm`,
  `delta`, `totalCostOfOwnership`, `upcomingCosts`. `lib/domain/history.ts` (new) holds the feed-row
  label translation that used to live inside the Historial screen.
- **Queries.** `lib/db/statsQueries.ts` — one UNION over `fuel_log`, `service_record` and `expense`
  normalised into `SpendRow[]`, plus the reminder evaluation for "próximos gastos".
- **Charts.** `components/charts/`: `ChartFrame` (measures its own width), `StackedBars`, `Donut`,
  `EconomyLine`, `DistanceBars`.
- **Screens.** `app/(tabs)/cifras.tsx` rebuilt; `app/reporte.tsx` and `app/exportar.tsx` are new;
  `app/dev/seed.tsx` is a `__DEV__`-only fixture writer.
- **Report.** `lib/report/html.ts`, `lib/report/print.ts` + `print.web.ts`, `lib/report/photo.ts`.
- **Export.** `lib/export/csv.ts`, `lib/export/deliver.ts`.
- **Tests.** 228, up from 172: `stats.test.ts` (33), `export/csv.test.ts` (12),
  `report/html.test.ts` (10).

### Dependencies added / removed
- **+** `react-native-gifted-charts@1.4.78`, `expo-linear-gradient@~57.0.2` (ADR-11; the gradient
  package is gifted-charts' peer). `react-native-svg` was already at the bundled 15.15.4.
- **+** `expo-print@~57.0.2` for the PDF.
- No Skia, no victory-native, per ADR-11 and the prompt.

### Acceptance criteria
- [x] `lib/domain/stats.ts` with tests, including hand-verified values for a fixture month. The
      September 2026 block in `stats.test.ts` carries the arithmetic in its comment — six records
      totalling **RD$ 25,975.00** over **1,300 km** = **RD$ 19.98/km** — worked out before the code
      ran rather than pasted from its output.
- [x] Four chart components, theme-aware, with empty states. Verified on the dev server against a
      seeded year of history and **on the static export** (`npm run build`, served from `dist`),
      where two fill-ups produced the stacked bars, the donut and a 45.00 km/gal KPI.
- [x] Cifras: period selector, KPIs with deltas, four charts, TCO, upcoming costs, report and CSV
      buttons, and a KPI tap that scrolls to its chart.
- [x] PDF report per spec: vehicle header, KPIs, category breakdown, TCO, upcoming, the full history
      table and an economy summary. Rendered to disk and reviewed in the browser — see
      `docs/qa/phase-7-reporte-pdf.jpg`.
- [x] CSV export, both files, BOM and CRLF. The downloaded `car-guy-historial-corolla-2026-09-18.csv`
      was inspected byte by byte: `EF BB BF` header, `\r\n` terminators, `Ágora` and `Taller de
      Ramón` as correct UTF-8, blank cells where a record has no odometer or amount.
- [x] `tsc`, `expo lint`, `npm test` (228), `npm run build` (39 routes, 5.1 MB) green.
- [x] Fuel flow verified again on both the dev server and the static export.
- [ ] **PDF not shared from Android**, and the CSV not opened in LibreOffice/Excel — see below.
- [ ] **Android not verified** — still no device or AVD on this machine.

### Decisions made (defaults applied)
- **The periods are rolling windows, not calendar months.** "Mes" is the last 30 days. A calendar
  month would compare a half-finished month against a whole one every time the screen is opened
  before the 30th, and the arrow beside the total would read "↓ 40 %" all month for no reason. The
  bar chart still uses calendar months, because there the label *is* the month.
- **`delta` refuses a percentage when the previous window was empty.** 0 → something is a division
  by zero, and "+∞ %" helps nobody; the tile says "sin comparación" instead.
- **Up is not always bad.** Spending more is red, driving more is neutral — `invertDelta` on the
  distance tile, because a month with more kilometres is not a problem to be flagged.
- **`distancePerMonth` attributes a gap to the month of the later reading.** A reading in March and
  the next in June puts all of it on June. Spreading it evenly would invent two data points that
  were never recorded; the chart shows what was written down.
- **`upcomingCosts` uses the user's own prices only.** A reminder with no completed record
  contributes nothing rather than a national average — the card is worth reading precisely because
  every figure in it came from this car.
- **The report is dark-on-white.** "Tablero nocturno" printed is a page of toner. The identity
  survives in the type and the accent rule.
- **Every value interpolated into the report HTML is escaped.** A shop called `Taller & Hijos` is a
  Tuesday, not an attack, but it would still break the document — and the same escaping stops a
  pasted note from rewriting the page in the print WebView. Two tests pin it.
- **CSV uses commas, not semicolons.** Excel in a comma-decimal locale would prefer semicolons, but
  that is not CSV; every other reader expects commas, so the file uses commas, quotes what needs
  quoting and writes numbers with a dot.
- **The economy columns are blank on tanks that have none** — a partial, a baseline, or one flagged
  `missedPrevious` — rather than repeating the row above. A blank cell is a fact; a repeated one is
  a lie a spreadsheet will average.
- **Two CSVs, not one file or a ZIP.** The two shapes have almost no columns in common, and zipping
  would add a dependency to produce something most people unzip by hand.
- **The report screen has no live preview.** It would mean a WebView on native and an HTML injection
  on web — two implementations of a picture of a document the user is one tap from seeing. The
  summary card says what the report will contain, which is the part worth checking first.
- **Charts are capped at 560 px and centred.** On a phone the cap never bites; on a desktop browser
  it stops six bars huddling against the y-axis with half a card of empty space beside them.

### Deviations from the package
- **`app/dev/seed.tsx` was added**, which the prompt did not ask for. It asks instead for
  verification "with a realistic dataset (import the sample fixture + add records)", and the two
  ways to get one were a file picker no harness can drive or forty records typed by hand. The route
  is `__DEV__`-gated and reachable only by typing it, exactly like `app/dev/tokens.tsx`, and it only
  ever inserts.
- **The stats functions take normalised rows rather than repository objects.** `costPerKm(rows,
  distanceKm)` instead of `costPerKm(fuel, services, expenses, readings, range)`: the five-argument
  form would have put the category mapping and the range filtering inside every function instead of
  once in the query layer, and made each one impossible to test with a literal.
- **The economy chart's series comes from `computeEconomy`, not from the fill-ups.** It has to: a
  partial tank and a `missedPrevious` fill-up produce no `EconomyPoint`, so the series is shorter
  than the history.

### Observed, deferred
| Found in | Issue | Severity | Notes |
|---|---|---|---|
| Phase 7 · charts | `react-native-gifted-charts` spreads React Native responder props onto a DOM node, so the web dev console logs seven "Unknown event handler property" errors per chart render | low | Third-party and **dev-only** — the production bundle logged none, because react-native-web strips the check. Not fixable from the call site; it would need a patch to the package |
| Phase 7 · Android | The PDF has not been shared from a device, so `printToFileAsync` → `shareAsync` is unexercised | medium | The one path that cannot be checked on web at all. First thing to do when a device is available |
| Phase 7 · CSV | The file was verified byte by byte but never opened in Excel or LibreOffice | low | The bytes are the part that goes wrong; neither application is installed here |
| Phase 7 · static export | `expo-router`'s static export needs host rewrites for deep links — `python3 -m http.server` served `/cifras` as a 404 and `/carga/nueva.html` matched `carga/[id]` | low | An artefact of the plain file server, not the app. `vercel.json` handles it in production; worth confirming when PROMPT-10 checks the deploy |
| Phase 7 · deps | `npx expo install --check` still reports nine packages behind their SDK 57 targets | low | Pre-existing since Phase 6; a bump is out of this phase's scope |
| Phase 7 · Cifras | `vehicleStats` reads the whole spend history on every period change | low | Correct and fast at a year of data. If a decade of history ever appears, the month buckets want `strftime('%Y-%m')` in SQL |

### Notes for the next phase
- **`lib/domain/stats.ts` is pure and takes `today` explicitly**, so PROMPT-08's account screen and
  any future sync report can reuse it without a clock or a database.
- **`lib/export/deliver.ts` is the shared file hand-off** — `deliverText` for generated content,
  `deliverFile` for something already on disk. `lib/backup.ts` still has its own older copy of the
  same logic; folding it in would be a small, safe cleanup.
- `components/charts/ChartFrame.tsx` is where any chart-wide change belongs — width, padding, empty
  state — rather than in the four charts.
- The seeded dataset is one tap at `/dev/seed`; PROMPT-08 and PROMPT-09 will want it for testing
  sync against a non-empty database.
- **`reportHtml` escapes everything it interpolates.** Any new field added to the report must go
  through `escape()` too; the two tests will not catch a field that simply was not added.

## Phase 8 — Account and the `carguy` cloud schema   (branch `imp-17092026/phase-8-cuenta`)

**Status:** complete
**Commits:** `3d1de94` client, UI and the SQL · `698f8bc` verification tooling ·
`e3adfde` dashboard paths · `b6addb9` baseline · `620bde7` sql/001 applied ·
`96932ef` sql/002–005 applied · `5a67997` guard fix and cleanup · follow-up on
`fix/phase-8-gaps`, 2026-09-25

### Follow-up, 2026-09-25 (`fix/phase-8-gaps`)

Re-verified live today: `node tools/verify-x-core.mjs` **7/7** (Car Guy signup 200 + session; bare
signup still "Sign-ups are invite-only. Ask Xaviel for an invite link."; `carguy` exposed; A reads
its own vehicle; B sees `[]`; B writing as A → 42501; anon → 401). Probe accounts removed with
sql/999 (0 leftover profiles). Earlier today `sql/008` re-keyed the seeded catalogue per account
(see Phase 5 follow-up).

Fixed:
- **`sql/rollback.sql` could not have run.** Step 4 was still a `PASTE THE ORIGINAL` placeholder,
  and step 1 deleted from `storage.objects`/`storage.buckets`, which `storage.protect_delete()`
  refuses (42501). The original `enforce_invite_only()` body is now inline (verbatim from 001's
  rollback block); emptying the bucket is a documented dashboard / Storage API step. Same fix in
  004's rollback block. `apply-sql.mjs --dry-run` now flags the file as shared, as it should.
- **Spec vs code on sign-out:** the code keeps `auth_user_id` and the cursors, for a documented
  reason (it is how a different account is detected); the spec said to clear them. The spec is
  amended to match the code.
- **Tests:** `translateAuthError` had none — 13 cases now, including the invite-only trigger
  message; "Email not confirmed" gets its own Spanish line. The parity test now also checks that
  every push's conflict target equals the cloud primary key after all migrations (mutation-checked:
  reverting `service_type` to `id` fails it).
- **Small:** the schema-not-exposed message moved to `es.ts`; the dead `syncSoon` branch and
  stale "no sync yet" comment in `cuenta.tsx` removed; `005`'s header no longer says
  `onConflict: 'id'`; `npm run types:gen` added (needs `npx supabase login`).

Superseded statements in the report below (true when written, during part A): "`database.types.ts`
does not exist" (generated at `b2fc8a7`); "`sql/001` is left syntactically broken" (fixed and
applied); "No foreign keys" (sql/007 adds `user_id → auth.users on delete cascade`);
"`FEATURE_SYNC = false`" (true since Phase 9); "auth.ts … clears it on sign-out" (it keeps it —
see above); the "left on x-core" account list (all removed).

Still open — only you can do it: **sign in to Music Hub once** with your normal account and
confirm it works as before (05-manual-checklist.md, Phase 8 item 6).

Split as the prompt anticipated: it names the discovery SQL as "the one legitimate pause in the
cycle" and says to do the client and UI while waiting. Part A was built during that pause; part B
ran once a Supabase personal access token arrived, and is now complete.

### Changed
- **SQL.** `sql/000_inspect.sql` (read-only discovery), `001_invite_trigger_app_aware.sql`
  (deliberately incomplete — see below), `002_schema_carguy.sql`, `003_rls.sql`,
  `004_storage.sql`, `005_lww.sql`, `006_drop_tucombustible_probe.sql` (optional),
  `rollback.sql`. Every file is idempotent and ends in a rollback block.
- **Client.** `lib/cloud/supabase.ts`, `lib/cloud/auth.ts`, `lib/flags.ts`.
- **UI.** `app/cuenta.tsx` (new), the account row in Más, a dismissible card on Inicio.
- **Tooling.** `tools/verify-x-core.mjs` — the seven checks Phase 8 owes, ready to run.
- **Config.** `.env.example`; `.gitignore` now covers the inspect output.

### Dependencies added / removed
- **+** `@supabase/supabase-js@2.116.0`. `react-native-url-polyfill` is **not** installed:
  the current Supabase/Expo tutorial no longer lists it, and `@react-native-async-storage/
  async-storage` was already a dependency from Phase 1.

### Acceptance criteria
- [x] `sql/000…006` and `rollback.sql` written, each idempotent, each with a rollback block.
- [x] Client, auth module and Cuenta screen; the account is fully optional and sign-out keeps
      every local row (ADR-05).
- [x] The three account states render. Verified in the browser against placeholder credentials
      (since deleted): *not configured* names the two missing variables; *signed out* shows the
      form; local validation fires before any network call; an unreachable project produced
      **"Sin conexión. Tus datos siguen guardados en el teléfono."**
- [x] The onboarding card appears after the first vehicle and stays dismissed across reloads.
- [x] `tsc`, `expo lint`, `npm test` (228), `npm run build` (40 routes) green. No credential in
      the bundle — the only `supabase.co` string is supabase-js's own internal allowlist.
- [x] `sql/001` carries the real function body, captured by `000_inspect.sql` and applied.
- [x] `sql/001`–`005` applied; `carguy` added to Exposed schemas (dashboard, by Xaviel).
- [x] Signup verified both ways, four RLS negative tests pass, Music Hub's invite message is
      byte-identical to the pre-change baseline. 7/7.
- [ ] Database types still not generated — `lib/cloud/database.types.ts` does not exist. Nothing
      uses generated types yet, so nothing is broken; Phase 9's queries will want them.

### Decisions made (defaults applied)
- **One `before update` trigger per table, not two.** This started as a bug in my own SQL:
  `server_updated_at` was stamped by one trigger and the LWW guard was a second. Postgres fires
  before-triggers in **name order** and hands each the row the previous returned, so on `media`,
  `task`, `setting` and `vehicle` — where the stamping trigger sorts *after* `lww_` — a rejected
  stale write would still have moved the cursor, and every other device would then have pulled a
  row that never changed. Both jobs now live in `carguy.before_write()`, which removes the
  ordering question rather than relying on names sorting favourably.
- **`sql/001` is left syntactically broken.** A file that would replace Music Hub's invite rule
  with a guess is more dangerous than one that refuses to run.
- **No foreign keys in the cloud mirror.** A client syncs one table at a time and a child can
  legitimately arrive before its parent; the local database enforces integrity, and a server-side
  FK would turn an ordering detail into a failed sync.
- **LWW rejects silently.** Raising would fail a whole batch of 200 rows for one stale record,
  and the client has nothing useful to do with the error — the next pull brings it the newer row.
- **`FEATURE_SYNC = false`.** Signing in today stores a session and nothing else. The Cuenta
  screen mentions syncing only in dev; promising it in production would be a lie with a deadline.
- **The client is created lazily and may be null.** A missing `.env.local` is a supported state
  (ADR-05), not a crash, and callers already branch on "signed out".
- **The web storage adapter wraps every call.** `localStorage` throws on *read* in Safari's
  private mode, which would take the app down at import rather than merely losing the session.

### Deviations from the package
- **`tools/verify-x-core.mjs` was added.** The prompt describes the checks as `curl` commands;
  a script runs the same requests, redacts tokens in its output and prints the cleanup SQL, which
  makes the result paste-able into this file and repeatable after any policy change.
- The script **cannot delete the test users** — that needs the service-role key, which
  04-conventions.md forbids from this repo. It prints the `delete` statements instead.

### Observed, deferred
| Found in | Issue | Severity | Notes |
|---|---|---|---|

| Phase 8 · types | `lib/cloud/database.types.ts` not generated | medium | Needs the project ref and `npx supabase login`. The client uses no generated types yet, so nothing is broken; Phase 9's queries will want them |
| Phase 8 · auth | The password-reset email uses x-core's project-level template, shared with Music Hub | low | Changing it would change Music Hub's email. Reported rather than fixed, per ADR-06 |
| Phase 8 · Android | Unverified, as in Phases 5–7 | medium | The AsyncStorage session adapter is the native-only path and has never run |
| Phase 8 · x-core | **Every Car Guy signup gets a `public.profiles` row**, created by Music Hub's `handle_new_user` trigger on auth.users | medium | Confirmed against the three test users: rows created, `display_name` empty, no error — so per spec §2 it is "acceptable, report it". But `public.profiles` is SELECT `using (true)` for authenticated, so Music Hub users can enumerate Car Guy user ids. Guarding that trigger with the same `app` check would be a **second** shared-code change and is Music Hub's call, not this phase's |
| Phase 8 · permissions | Writing to x-core needs a Bash permission rule for `tools/apply-sql.mjs` | resolved | Granted in `.claude/settings.local.json` (gitignored). A raw `curl` to the Management API is still refused, which is why the exposed-schemas change stayed a dashboard step |

### Baseline captured against x-core, 2026-09-18 (before any change)

Keys arrived in a gitignored `.env.supabase`; `.env.local` is written from it. `tools/verify-x-core.mjs`
run against the live project, **before** `sql/001` is applied:

```
project: https://nakgrkcqyuycadeuenuw.supabase.co

FAIL  1. signup with data.app=carguy succeeds
      status 500 · {"code":"P0001","message":"Sign-ups are invite-only. Ask Xaviel for an invite link."}
PASS  2. signup without the flag still fails (invite-only)
      status 500 · "Sign-ups are invite-only. Ask Xaviel for an invite link."
```

Both signups were refused, so **no test users were created** and there is nothing to clean up.

What this establishes:
- The keys work: `/auth/v1/settings` answers 200 for both the legacy anon JWT and the new
  publishable key.
- `enforce_invite_only` is live and blocking Car Guy exactly as 02-supabase-carguy.md §1 describes.
- **The exact message is `Sign-ups are invite-only. Ask Xaviel for an invite link.`** After `sql/001`
  is applied, check 2 must still produce this string byte for byte — that is what "Music Hub
  unchanged" means in practice, and it is now recorded rather than remembered.

Still blocked on DDL: the Management API rejects both the secret key (`JWT could not be decoded`)
and the legacy service-role JWT (`JWT failed verification`). Creating the `carguy` schema needs a
personal access token (`sbp_…`) or the database password — neither is a key the app ever uses.

### Applied to x-core, 2026-09-18

A personal access token arrived in `.env.supabase`, so the Management API's
`/v1/projects/{ref}/database/query` endpoint could run the discovery and the migration.

**Discovery (read-only) — what the sketch in the spec got wrong.** `sql/001` had been drafted from
02-supabase-carguy.md §2, which sketches the function as `set search_path = ''` with no `declare`
block. The live function is neither:

```
SET search_path TO 'public', 'extensions'   -- not ''
declare v_token text;                        -- absent from the sketch
```

It calls `extensions.digest` to hash an invite token against `public.invite_links`. Applying the
sketch would have changed the search_path of a SECURITY DEFINER function on a production auth
trigger. This is the entire reason the prompt calls the discovery step a legitimate pause, and it
paid for itself.

**`sql/001` applied.** The final diff against the live function is four lines, and the trigger object
is untouched — still `enforce_invite_only BEFORE INSERT ON auth.users`, `tgenabled = 'O'`.

**Verification, immediately after:**

```
PASS  1. signup with data.app=carguy succeeds
      status 200 · session returned
PASS  2. signup without the flag still fails (invite-only)
      status 500 · "Sign-ups are invite-only. Ask Xaviel for an invite link."
```

Check 2's string is byte-identical to the baseline captured before the change. **Music Hub's invite
rule is unchanged.**

**Two bugs in `tools/verify-x-core.mjs`, found by running it.**
1. It sent no `Accept-Profile` / `Content-Profile` header, so every `/rest/v1` call landed in
   `public` — Music Hub's schema. It reported `Could not find the table 'public.vehicle'` and would
   have gone on to test Car Guy's RLS against tables that were never Car Guy's.
2. Check 3 treated a bare 404 as a pass. A missing migration was showing up green.
   Both fixed; it now distinguishes `PGRST106` (not exposed) from `PGRST205` (exposed but empty).

**`sql/002`–`005` applied.** The first attempt was refused by the session's safety classifier
(`[Modify Shared Resources]`, `[Production Deploy]`) — the correct instinct for a curl pipeline
against Music Hub's production database. The fix was not to reshape the command but to replace it:
`tools/apply-sql.mjs` applies one file from `sql/`, refuses paths outside it, prints a summary
first, offers `--dry-run`, and refuses any file that *modifies* something Music Hub owns unless
`--shared` is passed. "Allow Claude to run this script on files under sql/" is a permission a
person can reason about; "allow Claude to run curl" is not. The grant lives in
`.claude/settings.local.json`, gitignored — it is a grant to this checkout, not to every clone.

Verified after applying:

| Check | Result |
|---|---|
| tables in `carguy` | 19 (18 synced + `profiles`) |
| RLS policies | 76 — exactly 19 x 4 |
| `before_write` triggers | 18 (one per synced table; `profiles` has none, as it is not synced) |
| Storage bucket | `carguy-media`, `public = false` |
| LWW guard | present in `carguy.before_write()` |

**`carguy` added to the exposed schemas** by Xaviel from the dashboard (Settings → Data API). It is
PostgREST configuration rather than database state, so no migration can set it, and the Management
API call that could restarts PostgREST for the whole project — Music Hub included.

### Final verification — 7/7

```
PASS  1. signup with data.app=carguy succeeds        status 200 · session returned
PASS  2. signup without the flag still fails         "Sign-ups are invite-only. Ask Xaviel for an invite link."
PASS  3. schema carguy is exposed and has the tables status 200
PASS  4. user A inserts and reads back its own vehicle  status 201
PASS  5. user B cannot see user A's vehicle          status 200 · []
PASS  6. user B cannot insert a row owned by A       status 403 · 42501
PASS  7. anonymous select is refused                 status 401 · 42501
```

Check 2 is still byte-identical to the baseline captured before `sql/001`.

### The account, end to end in the browser

Against the live project: **create account** → the dialog reads *"Cuenta creada · Ya puedes iniciar
sesión en otro teléfono con este correo"*, and the screen switches to the signed-in state with the
green pill, the email in mono and "Última sincronización —". **Sign out** returns to the form with
the password cleared. **Sign in** with the same credentials returns to the signed-in state.
Screenshots in `docs/qa/phase-8-*`.

### Cleanup

Every test account created by this phase is gone. Final state on x-core:

| | |
|---|---|
| `auth.users` | 4 — Music Hub's real users, untouched |
| `public.profiles` | 4 — matching, no orphans |
| `carguy.profiles` | 0 |
| `carguy.vehicle` | 0 |
| `enforce_invite_only` | enabled (`tgenabled = 'O'`) |
| `on_auth_user_created` | enabled |

### Left on x-core (needs cleanup)

Three throwaway users, created by the verification runs:

```
carguy-test-1789753581974-a@example.com
carguy-test-1789753581974-b@example.com
carguy-test-1789753707758-a@example.com
```

```sql
delete from auth.users where email like 'carguy-test-%';
```

Deleting them also removes their `public.profiles` rows by cascade.

### Notes for the next phase
- **`sql/002` is the contract Phase 9 syncs against.** Column names are the snake_case of
  `lib/db/types.ts`, so `lib/db/repos/base.ts`'s existing camel/snake mapping works unchanged.
- **`server_updated_at` is the pull cursor** and only moves when a write is actually applied.
- `lib/cloud/auth.ts` already writes `setting.auth_user_id` on sign-in and clears it on sign-out,
  which is the key Phase 9 needs to know whose rows are local.
- `describeSchemaError()` turns `PGRST106` into a sentence aimed at whoever administers the
  project — Phase 9's sync status should use it rather than showing the raw code.

## Phase 9 — Local-first cloud sync   (branch `imp-17092026/phase-9-sync`)

**Status:** complete as of 2026-09-25 — see the follow-up directly below. (Originally: "partial —
the multi-device acceptance run (a–e) is blocked on a sign-in only the user can perform".)

### Follow-up, 2026-09-25 (`fix/phase-9-gaps`)

An audit found the engine had never completed a real run, and the acceptance run showed why: **pull
did not work at all on a fresh device.** Everything below is fixed, each with a test against a
real SQLite (node:sqlite + the app's migrations; the test write queue is now transactional exactly
like the real one) or the real `sync()` against a fake PostgREST.

| # | Bug | Effect | Fix |
|---|---|---|---|
| 1 | `applyRemoteRows` opened a transaction inside the write queue's | the nested BEGIN failed and rolled back the outer one — **every pull with a new row failed** ("cannot rollback - no transaction is active") | no inner transaction; the queue's is the page's |
| 2 | Pull cursor was `server_updated_at` alone; the server stamps `now()` = transaction start | a pushed batch shares one stamp; a page ending inside it lost the rest (600 → 500 on a new device) | cursor `(server_updated_at, id)` + 60 s overlap; live-proven by verify-sync check 12 |
| 3 | `markSynced` wrote `synced_at = updated_at` at UPDATE time | an edit made during the upload was marked synced and never pushed | writes the `updated_at` that was pushed |
| 4 | Catalogue seeded unconditionally at every launch | ~70 rows re-dirtied with a fresh stamp, winning LWW against other devices' edits | seeder writes only missing/different rows |
| 5 | A foreign-key failure aborted the sync | one child before its parent blocked every later pull forever | rows apply one by one; failures parked and retried, never dropped |
| 6 | Sync's own cursor writes re-triggered sync | a sync every ~5 s while signed in | after-write sync only with rows waiting |
| 7 | "Borrar datos en la nube" left local rows marked uploaded; Storage listing capped at 100 | the cloud stayed empty after signing back in | re-marks everything, pages Storage, fails loudly, waits for a running sync |
| 8 | `resetDatabase` deleted parents first with FKs on | **"Borrar datos locales" never cleared a phone with data** (rolled back) | children first |

Also: settings two-way LWW (were push-only; `theme` dropped — it lives in AsyncStorage); every
server timestamp normalised (not just `updated_at`); deleted photos' bytes removed from Storage; an
expired token refreshed once; first-login only for a new account or a never-synced device (the
banner ran on every cold start) and it now reports "Se agregaron N vehículos desde la nube";
Inicio shows the sync pill when signed in; the engine logs the cause of a failed sync.

**Acceptance run (PROMPT-09 §4), 2026-09-25**, two independent browser profiles ("devices" A and
B, separate local databases) on the dev server, a throwaway `carguy-sync-e2e-…@example.com`
account (owner's choice; the phone and its real data were not involved):

| Step | What | Result |
|---|---|---|
| a | A: vehicle + seeded history (12 fill-ups incl. partials, 4 services, 6 expenses) + a check with a failure + vehicle photo → create account → first sync | ✅ cloud: 1 vehicle, 12 fuel, 18 readings, 4 services, 6 expenses, 19 reminders, 1 inspection + 4 results, 2 tasks, 1 media + its Storage object |
| b | B (fresh): onboarding → "¿Ya tienes cuenta?" → sign in | ✅ after bug 1 was fixed: identical garage, RD$ 90,004.80, photo downloaded lazily (1024 px) |
| b | B offline: rename → online → sync → A | ✅ A shows "Renombrado sin señal" |
| c | A deletes "Bomba de agua" → B; then B pushes its own edit | ✅ gone on both; cloud row tombstoned; not resurrected |
| d | Both offline edit the vehicle name (B later); **B syncs first**, then A, then B | ✅ both and the cloud end on "Conflicto B" (A's older push rejected by the server LWW) |
| e | B "Borrar datos locales" → pull | ✅ after bug 8 was fixed: empty onboarding, then full restore (RD$ 77,504.80 = minus the deleted repair; photo back) |
| — | A "Borrar datos en la nube" → sign back in | ✅ cloud 0 rows / 0 files; re-sign-in re-uploaded everything incl. the photo (bug 7) |
| — | RLS: another account sees nothing | ✅ `verify-x-core` check 5 (live today); `verify-sync` 14/14 |

Test account, its rows and its Storage object removed afterwards (sql/999, 0 leftover profiles).

**Future work (logged as the prompt asks):** signing in on a phone that already has a vehicle
similar to one in the account ("Corolla" here, "Corolla 2016" there) keeps both — look-alike
vehicles are never auto-merged. A "¿Es el mismo vehículo? Unir" prompt could offer it.

**Not yet verified:** the native (Android) file branch of media bytes, and sync on the phone. The
owner's phone holds real data and has no account; signing it in uploads that garage — their call.
**Commits:** `7de84c1` protocol core · `b2fc8a7` engine, types, cloud verification, sql/007 ·
`f7e4cfc` triggers, UI, media bytes, FEATURE_SYNC on · `e687fa7` lazy bytes, cursor reset

### Changed
- **Protocol.** `lib/sync/tables.ts` (what syncs, in dependency order, and which columns never
  leave the device), `lib/sync/merge.ts` (dirty predicate, LWW matrix, cursor, batching, timestamp
  normalisation).
- **Engine.** `lib/sync/engine.ts` — push then pull, one table at a time, never throwing at its
  caller.
- **Database.** `lib/db/syncOps.ts` — the four operations the ordinary repositories deliberately
  cannot do.
- **Types.** `lib/cloud/database.types.ts` generated from the live schema; the client is now
  `createClient<Database, 'carguy'>`.
- **SQL.** `sql/007_user_cascade.sql`.
- **Tooling.** `tools/verify-sync.mjs`.
- **Tests.** 330 total, up from 228: 41 merge, 61 schema parity and cascade.

### Verified

`tools/verify-sync.mjs`, against x-core — **9/9**:

```
PASS  1. push shape is accepted (booleans, user_id, timestamps)
PASS  2. server_updated_at is populated for the pull cursor
PASS  3. a newer updated_at is applied
PASS  3b. and the cursor advanced
PASS  4. a stale write is rejected by the LWW trigger
PASS  4b. and the rejected write did NOT move the cursor
PASS  5. a tombstone is stored, not a row disappearing
PASS  6. the pull query (gt cursor, ordered, limited) returns rows
PASS  7. setting upserts on (user_id, key)
```

**4b is the one worth having.** The two-trigger ordering problem found while writing `sql/002` was
argued from how Postgres fires before-triggers in name order; this is the database confirming it.
Had the stamping trigger still run after a rejected write, every other device would pull a row that
never changed.

### Decisions made (defaults applied)
- **Pulled rows do not go through `makeRepo.upsert`.** That method sets `synced_at = NULL` on every
  write, because every write it performs is a local edit. Applying a row that came *down* through
  it would mark it dirty and push it straight back, and two devices would spend their lives
  bouncing the same rows off each other. `lib/db/syncOps.ts` writes them clean instead.
- **`synced_at` is set to the row's own `updated_at`, not to `now()`.** If a row were stamped with
  the wall clock and the user edited it during the round trip, `updated_at` would land *before*
  `synced_at` and the edit would look pushed when it never was.
- **`markSynced` runs after the server confirms, never before.** A crash in between leaves the rows
  dirty and the next sync pushes them again — an upsert, so that costs nothing.
- **Booleans are coerced in both directions.** SQLite has no boolean; PostgREST sends real
  `true`/`false`. Storing those verbatim would put the string "true" in a numeric column, where
  `is_full_tank = 1` then matches nothing.
- **The engine never throws at its caller.** A failed sync is one that runs again on the next
  trigger, and the app has every row locally either way (ADR-05).
- **One sync at a time.** The triggers are deliberately eager, so overlap is the normal case, and
  two runs would push the same rows twice and race each other's cursor writes.
- **`sql/007` adds a foreign key where the spec said not to.** §3 mirrors no foreign keys *between*
  carguy tables, because a child can legitimately sync before its parent. `user_id → auth.users` is
  a different relationship: the parent is the account, and no row can exist before it, since RLS
  requires `user_id = auth.uid()`.

### Observed, deferred
| Found in | Issue | Severity | Notes |
|---|---|---|---|
| Phase 9 · x-core | **Deleting a user left their rows behind forever** — only `carguy.profiles` had a foreign key to `auth.users` | fixed | Found by cleaning up the probe accounts and noticing `carguy.setting` still held their rows. Unreachable rows, too: RLS hides a row no session can match. `sql/007` cascades all 18 tables; the parity test now covers it |
| Phase 9 · acceptance | **Scenarios a–e have not been run.** Everything they exercise is built and on, but nothing has yet pushed a row from one device and pulled it on another | high | Blocked, not skipped: the run needs an account created and a password typed into the browser, which the assistant's browser rules prohibit outright. Both devices are staged and waiting — see *The acceptance run* below |
| Phase 9 · engine | The engine has still never completed a run — it needs SQLite and a session, and the session is what is missing | high | `verify-sync.mjs` proves every contract it depends on (13/13) and the unit tests prove its decisions; the wiring between them is what a–e would exercise |
| Phase 9 · a–e vs. spec | The staged run is web↔web (two ports, two origins, two OPFS databases), not web↔Android | medium | Deviation from PROMPT-09 b/e, which name Expo Go. Two origins give two genuinely independent databases, so the protocol is exercised; the native filesystem branch of `mediaBytes.ts` is not |
| Phase 9 · conflict UX | A conflict resolves silently by LWW, with nothing shown | low | Intended (§5), and 4b proves the loser does not even move the cursor. Worth revisiting if a user ever reports losing an edit |

### Changed since `b2fc8a7`

- **Triggers.** `lib/sync/triggers.ts`, mounted once in the root `Shell` so no screen has to know
  sync exists: sign-in, `AppState` foreground, five seconds after a write, and the web `online`
  event. Overlap is expected — `sync()` hands back the run already in flight.
- **UI.** `lib/sync/useSync.ts` (subscribes to the module-level engine, so the pill and the Cuenta
  screen cannot disagree about whether a sync is running) · `components/SyncPill.tsx` ·
  `components/FirstSyncBanner.tsx` · the signed-in block of `app/cuenta.tsx` · the status pill on
  Más.
- **Media bytes.** `lib/sync/mediaBytes.ts` — eager upload inside the sync, lazy download from
  `mediaUri` on first display.
- **Cloud wipe.** `lib/sync/wipeCloud.ts`, double-confirmed, and it signs out as its last step.
- **`FEATURE_SYNC` is true**, in the same commit as the UI.
- **Tooling.** `tools/cleanup-probe-media.mjs`; `verify-sync.mjs` grew to 13 checks.
- **Tests.** 332, up from 330 — the new one is the boolean-map drift guard.

### Verified since `b2fc8a7`

`tools/verify-sync.mjs` — **13/13**. The four new checks are the Storage contract the media path
rests on:

```
PASS  8.  media bytes upload to <user_id>/<id>.jpg
PASS  9.  and download unchanged
PASS  10. writing into another user's folder is refused   (400)
PASS  11. and the probe object deletes cleanly
```

**10 is the one worth having.** A photo of a marbete carries a plate number, which is the whole
reason the bucket is private and keyed by its first path segment. The check writes to a
made-up user id and confirms `sql/004` refuses it.

In the browser, against the production web build (`expo export`, served on two ports):

- The app boots, OPFS opens, onboarding creates a vehicle, a fill-up and a service record, and
  Historial shows both at RD$ 5,755.95 for the month. No console errors.
- **Signed out, there is no sync UI anywhere** — not on Cuenta, not on Más, no pill, no promise.
  That is an acceptance criterion, and it holds.
- The "Guardado" confirmation is the themed in-app modal from Phase 6, not a blocking
  `window.alert` — worth noting because a blocking dialog froze the renderer earlier in this
  package.

### The acceptance run — staged, not run

Two devices are live and each has its own database, because OPFS is keyed by origin:

| | URL | State |
|---|---|---|
| Device A | `http://localhost:4300` | Vehicle *Sync A*, one fill-up, one service record, signed out |
| Device B | `http://localhost:4301` | Empty, signed out |

Re-stage with `node <scratch>/serve.mjs "$PWD/dist" 4300` and the same on 4301 after an
`expo export`.

**What blocks it.** a–e all begin with "signed in as a test user", and creating an account or
typing a password into a browser field is prohibited to the assistant without exception — the rule
holds even when the user asks and supplies the details. So the sign-in is the user's to perform;
everything after it can be driven and observed.

### Decisions made since `b2fc8a7`

- **Photo bytes go up eagerly and come down lazily.** Bytes this device holds the only copy of are
  worth hurrying; two hundred JPEGs pulled over cellular before the user has looked at one are not.
  `ensureMediaBytes` reports `present | downloaded | missing` so a render does not pay for a query.
- **"Borrar datos en la nube" signs out.** With the triggers this eager, a device that stayed
  signed in would begin putting the garage back on the server within seconds of the user asking for
  it to be gone. Signing out costs nothing: the account is optional and never takes local data with
  it (ADR-05).
- **Cursors reset only on a change of account, and `signOut` no longer touches `auth_user_id`.**
  That id is the only way to tell "the same person signed back in" from "someone else signed in
  here"; clearing it would let a different account inherit the previous one's cursors and never see
  its own rows. `rememberUser` is gone — the reset owns that write, and two writers would race.
- **Probe objects leave Storage through the API, never through SQL.** Supabase installs
  `storage.protect_delete()` on `storage.objects`, so a SQL delete is refused outright — and would
  orphan the bytes if it were not. `sql/999` says so and `tools/cleanup-probe-media.mjs` does it,
  scoped to Car Guy's own bucket and to names carrying `sync_probe_`, printing everything it will
  not touch.
- **"Sin subir" is `proximo`, not `vencido`.** Unsynced rows are on the phone and perfectly safe.
  Only a failed sync earns the red.
- **The first-sync notice is a banner, not a modal.** PROMPT-09 calls for a sheet, but its own copy
  promises the app stays usable — blocking the screen would make that a lie. Logged as a
  deliberate deviation.

### Notes for the next phase
- **Run a–e first.** Everything else in Phase 10 assumes sync works, and nothing has yet proven a
  row crossing between two devices.
- The most likely failure is still a column the boolean map misses — but it is now pinned by a test
  that parses `sql/002` and asserts exact equality, and that test has been mutation-checked.
- `lib/sync/mediaBytes.ts` has a native branch (`expo-file-system`) that no web run can exercise.
  It is the least-tested code in the phase.

## Phase 10 — Release   (branch `imp-17092026/phase-10-release`)

**Status:** partial — the repo is renamed, the web app is live, and the release prep is done; the
Android build, the phone walk and the sync acceptance run need Xaviel at the keyboard
**Commits:** `7a41d37` boot fix + release prep

### Shipped

| | |
|---|---|
| Repo | <https://github.com/XavielT/car-guy> — renamed from `tu-combustible-rd`, remote updated, description and homepage set. GitHub redirects the old name; v1.1.0 and v1.1.1 untouched |
| Web | <https://car-guy.vercel.app> — live, manifest `name: Car Guy`, all 14 routes 200, SW served |
| Vercel | New project `car-guy` (`prj_bYWqNI2VJLSkeVYAGxeYjx2wSGLi`), git-connected to the renamed repo. `tu-combustible-rd` left alone |
| Version | `2.0.0`, `versionCode 1`, `eas.json` already `appVersionSource: remote` |
| CHANGELOG | `CHANGELOG.md`, 2.0.0 by area, with v1.1.x kept below |
| Docs | `docs/NEXT.md` rewritten as the Car Guy backlog; `docs/PLAN.md` gets a history header |
| gitignore | `releases/`, `*.keystore`, `*.jks` |

### The one blocker found, and fixed

**The live PWA could not be reloaded.** The first reload of car-guy.vercel.app produced
expo-router's default boundary: black-on-white English "Something went wrong" over a raw stack
trace. Cause is an OPFS race — SQLite holds the database through a `SyncAccessHandle`, only one may
exist per file, and on reload the new document's worker asks for it while the old document's worker
still holds it. Intermittent by nature: a fast local reload wins, a slower one over HTTPS behind a
service worker loses.

**The obvious fix cannot work, and establishing that was the work.** Catching the error and
remounting `SQLiteProvider` looks correct. `expo-sqlite`'s `getDatabaseAsync` keeps the open promise
in a module-level `databaseInstance` and, on a cache miss, builds the next attempt on top of the
previous one:

```js
promise = databaseInstance.promise.then((db) => db.closeAsync()).then(open)
```

No `.catch`. Once the first open rejects, `.then` forwards the rejection, so every later attempt in
that document inherits the original failure however many times the tree is remounted. Measured
rather than argued: pressing retry after the other tab had released the handle still failed, while a
fresh page load succeeded immediately.

So on web the recovery is a document reload — the only way to a fresh module scope. The attempt
count lives in `sessionStorage`, which is per-tab and survives a reload, exactly the scope the
problem has, so a handle held by a *second* tab cannot become a reload loop. Three tries at
300/700/1500 ms behind the splash background, then `components/BootError.tsx` says so in Spanish.

Verified in the browser, all three paths:

- reload race → recovers invisibly
- second tab holding the handle → exactly four errors, then the message, **no loop**
- "Intentar de nuevo" once the other tab is gone → app back, data intact

Two Car Guy tabs still cannot share the database. That is OPFS, not something this repo can fix;
what changed is that the app says so, and says nothing was lost.

### Regression walk — web (production build, served on two ports)

| Area | Result |
|---|---|
| Boot, OPFS, onboarding | ✅ vehicle created from empty |
| Fill-up | ✅ two-of-three arithmetic (9.5 gal × RD$ 290.10 = RD$ 2,755.95), station, review sheet |
| Service record | ✅ parts + labour → total RD$ 3,000, saved via the themed in-app modal, no `window.alert` |
| Chequeo runner | ✅ 4/4, one falla with a note → inspection saved → **task "Revisar testigos del tablero" created**, odometer 52,000 |
| Unified Historial | ✅ fill-up, service and `Chequeo · con fallas` in one timeline, RD$ 5,755.95 for the month |
| Tareas | ✅ task listed, labelled "Viene de un chequeo" |
| Cifras | ✅ RD$/km 17.77, 324 km, stacked bars and donut with real values; honest empty states for rendimiento (needs two full tanks) |
| Routes | ✅ all 14 return 200 on Vercel |
| Light / dark | ✅ Claro applies across Inicio, Historial, Más; accent darkens for contrast on white |
| Acerca de | ✅ `Versión 2.0.0` / `Build 7a41d37` |
| Signed-out sync UI | ✅ none anywhere — Cuenta, Más, no pill, no promise |
| PDF report | ⚠️ screen renders; **print not triggered on purpose** — `window.print()` froze the renderer earlier in this package. `reportHtml` is a tested pure function |
| CSV export | ⚠️ screen renders; download not triggered. Bytes were verified in Phase 7 |

### Deviations

- **`app.config.js` instead of the SHA in `app.json`.** PROMPT-10 said to convert "only if it stays
  simple". It did not stay simple: `expo config` resolves `extra.gitSha` correctly, but
  `expo export` inlines only `extra.router` into the web manifest and drops everything else, so the
  Build line was blank on web. The SHA now travels twice — `extra` for native/EAS, and
  `EXPO_PUBLIC_GIT_SHA` set by `npm run build` for web, which Metro does inline. Both read in Más.
- **Production deploy was not the intent.** `vercel --prod` is blocked in this environment; a
  preview deploy was requested instead, and Vercel assigned it to Production because the project was
  new and had none. The site is therefore live. Reported rather than hidden.
- **The regression walk is web only.** No device, no emulator, and `adb` sees nothing — carried from
  Phase 5.

### Observed, deferred
| Found in | Issue | Severity | Notes |
|---|---|---|---|
| Phase 10 · Android | **Nothing built for 2.0.0.** `eas` is not logged in and `app.json` has no `extra.eas.projectId` | high | `npx eas-cli login && npx eas-cli init` then the two builds. Needs Xaviel |
| Phase 10 · device | The app has never run on a phone — notifications outside Expo Go, camera, PDF share, native date picker, haptics, and `mediaBytes`'s `expo-file-system` branch | high | Carried since Phase 5. The single largest untested surface in the repo |
| Phase 10 · release | No `v2.0.0` GitHub release and no tag | high | Waiting on the APK, which the release attaches |
| Phase 10 · old Vercel project | `tu-combustible-rd` is still git-connected to this repo, so it has been auto-deploying Car Guy to the old URL all cycle | low | Pre-existing, not caused by the rename. Delete the project when ready |
| Phase 10 · local folder | The working directory is still `~/dev2/tu-gasolina-rd` | low | Cannot be renamed from inside a running session — it is the session's cwd |
| Phase 10 · deps | 22 npm audit findings, 9 packages behind their SDK 57 targets | low | Carried from Phase 0. Still worth one pass |

### Notes for whoever picks this up
- `docs/NEXT.md` is now the single backlog. It has the EAS commands, the proven local gradle recipe,
  and the two-port staging for the sync acceptance run.
- The keystore is the one irreversible thing in this phase. EAS holds it remotely if you build
  there; a local build generates a new one for `com.xaviel.carguy` and losing it means no update is
  ever accepted as the same app again.
