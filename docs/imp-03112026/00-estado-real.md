# 00 — Real state (PROMPT-00, 2026-11-03, branch `imp-03112026` from `main` @ `0afede6`)

## BRIEF numbers vs the repo
| Item | BRIEF said | Repo says | Where | Package fix |
|---|---|---|---|---|
| App version | 2.6.0 | **2.6.0** | `package.json`, `app.json`, tag `v2.6.0` | none |
| Local schema | v12 | **v12** (`{ version: 12, up: migrationV12() }`) | `lib/db/migrations.ts:306` | none |
| Last `sql/` | 041 | **041** (`041_repairs_done_by_media.sql`; then `999_cleanup_test_users.sql`, `rollback.sql`) | `sql/` | none — next is **042** (A: 042/043, round 2: 044 as the package already says) |
| Last ADR | 64 | **64** (IMP 16102026 = ADR-59…64) | `docs/imp-16102026/00-context/03-architecture-decisions.md` | none — this cycle starts at **ADR-65** |
| Expo | 57 | `expo ~57.0.26`, RN 0.86.3, React 19.2.3 | `package.json` | none |
| Native fingerprint | — | `f4613b33…` for 2.6.0, recorded 2026-10-21 | `releases/fingerprint.json` | none |
So **no package number needed correcting**. Content corrections (not numbers) are listed in `PROGRESS.md → Decisions taken` (D-02, D-03): SGC's STT is OpenAI/Groq not Azure; model defaults moved to the 5.5 family.

## Flags (`lib/flags.ts`, `flagsV8.ts`, `flagsV10.ts`)
`FEATURE_SYNC, ALBUM, BUILD, DIY, TRACK, SHARE, TRIPS, FEEDBACK, GARAGE_V2, LAUNCH_ANIM` · `FEATURE_MAP_V2, DRIVE_MODE, I18N, EVENTS, ONBOARDING_V2, LEGAL` · `FEATURE_GAUGE_SEGMENTS, OTA, SUPPORT, SOCIAL, JUNTES, JUNTE_CHAT`. No AI/Google flag exists yet; `FEATURE_AI` / `FEATURE_GOOGLE_PLACES` are new (Google default OFF, see verdict). No AI code anywhere in `app/`, `components/`, `lib/`.

## `api/` and `supabase/`
- `api/` (Vercel serverless): `apk.ts`, `c/[slug].ts`, `eliminar-cuenta.ts`, `j/[code].ts`, `junte-push.ts`, `precios.ts`, `u/[handle].ts`. Cron: `/api/precios` Saturdays 12:00 UTC.
- **`supabase/` does not exist in the repo.** x-core SQL lives in `sql/`, applied with `tools/apply-sql.mjs`. Edge Functions `cg-*` will therefore need a new `supabase/functions/` folder (PROMPT-01) — new, additive.

## Env / build config
- `eas.json`: `base.env` holds only `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` (public by design). Profiles `development`, `preview` (apk, arm64), `production` (aab), `release-apk` (apk). `appVersionSource: remote`. No third-party key anywhere in the repo config.
- `.env.example` names: only those two. A `.env.supabase` and `.env.local` may exist locally — not opened.
- `app.config.js` refuses an EAS release build without the two Supabase values; `tools/check-bundle-env.mjs` refuses an APK/bundle without the project URL (second check for `sk-ant-`/`AIza`/`AZURE` comes in PROMPT-01).
- No `.gitleaks.toml` yet.

## Vercel (`vercel.json`)
Static `dist/` + 38 rewrites (dynamic routes + `/c /u /j` → `api/`), `cleanUrls`, cron, cache headers, SW no-cache. Current security header:
`Permissions-Policy: camera=(self), microphone=(), geolocation=(self)` ← **`microphone=()` blocks voice on web; becomes `microphone=(self)` in the voice phase** (PROMPT-02). `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`.

## Permissions registry (ADR-59)
`lib/permissions/types.ts` ids: `location_foreground, location_background, notifications, camera, photos, battery_unrestricted, storage_persist, install_unknown_apps`. **No `microphone`** — add it (+ `usedBy: ['voice']`, android+web) in the voice phase. `app.json` has no mic permission today (Android `REQUEST_INSTALL_PACKAGES` only).

## Native impact of the voice recorder (step 9) → APK
- Module: **`expo-audio ~57.0.5`** (in Expo 57's `bundledNativeModules.json`; not yet in `package.json`). Docs read: https://docs.expo.dev/versions/v57.0.0/sdk/audio/
- Install: `npx expo install expo-audio`; `app.json` plugin `["expo-audio", { "microphonePermission": "Car Guy usa el micrófono para dictar lo que quieres anotar.", "recordAudioAndroid": true }]` (ES string; `locales/` carries the EN text if used).
- Adds **`android.permission.RECORD_AUDIO`** and iOS **`NSMicrophoneUsageDescription`**. Do **not** enable `enableBackgroundRecording` (would add FOREGROUND_SERVICE_MICROPHONE + POST_NOTIFICATIONS; not needed for tap-to-dictate).
- Hook flow: `useAudioRecorder(RecordingPresets.HIGH_QUALITY)` + `AudioModule.requestRecordingPermissionsAsync()` (through the ADR-59 registry, not called directly) + `setAudioModeAsync({ allowsRecording: true })`; output `.m4a` (Android AAC) in cache by default. **Web** uses MediaRecorder → `audio/webm`, HTTPS only, Chrome webm may lack duration metadata → `cg-stt` must accept `audio/webm` and `audio/mp4`.
- Fingerprint: new package + plugin + Android permission are all hashed (`fingerprint.config.js` skips only version/extra/scripts/gitignore) → **fingerprint changes → `tools/ota-gate.cjs check` returns `apk` → the voice release is an APK, not an OTA** (BRIEF note 7 confirmed). Same for Release A (`modules/trip-trigger`, ADR-71).
- Existing local native module for reference: `modules/miui-autostart` (Expo module, `expo-module.config.json` + `android/`).

## Baseline (before any change)
Machine default Node **20.20.0**; repo needs **≥ 22** (EBADENGINE on install; tests import `node:sqlite`). Node 22.22.3 is installed under nvm (`C:\Users\xavie\AppData\Local\nvm\v22.22.3`). Results:
| Check | Node 20 (default) | Node 22.22.3 |
|---|---|---|
| `npm ci` | ✔ 1157 pkgs (EBADENGINE warnings) | — |
| `tsc --noEmit` | ✖ 4× TS2882 (`maplibre-gl/dist/maplibre-gl.css` side-effect import in `components/map/*.web.tsx`) | ✔ 0 errors |
| `npm run lint` | ✔ 0 errors, 2 warnings (`app/cuenta.tsx:30 dateLabel` unused; `app/vehiculo/[id]/reparaciones.tsx:59` `all` in useMemo deps) | — |
| `jest` | ✖ 33 suites / 8 tests (26 `__tests__/db/*` need `node:sqlite`) | ✖ **4 suites / 9 tests**: `changelog/parse`, `legal/markdown` ("generated outputs … is current"), `ui/skeletons` (`.each` over an empty route list), `db/track` |
| web build | ✖ `npm run build` — script uses POSIX `VAR=x cmd`, cmd.exe fails | ✔ `EXPO_PUBLIC_GIT_SHA=$(git rev-parse --short HEAD) npx expo export -p web && node tools/finalize-web.mjs` → 113/116 pages titled |
Unrelated reds were **not fixed** (they look Windows-specific: line endings in the "is current" generated-output tests, path glob in skeletons). Future phases must run tests under Node 22 and use the bash form of the build. The 4 remaining suites are the red baseline to compare against.

## Phone vs laptop baseline
Screens in `04-tracking/screens/f0-*-390.png` (compact baseline for SPEC-F §F1) and `f0-*-1440.png` (before). Dev server + `/dev/seed` garage (AE85, DS3, C3, Jetta), Playwright-core with local Chromium 1228, outside the repo. 8 routes × 2 viewports. Defects → `findings.md` (D-1…D-9).
