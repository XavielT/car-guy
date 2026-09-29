# PROMPT 01 — Hotfix 2.1.3: photos on Android, accounts in the APK, no developer text, stable APK name

**Depends on:** Phase 0 · **Branch:** `fix/2.1.3-hotfix` (from `main`) · **ADRs:** 25, 34 · **Size:** M
**Goal:** G1 — nothing broken for real users. Ships the same session.

> **Before running:** the Redmi connected by USB (adb) with Developer options → "Don't keep
> activities" available to toggle; `.env.expo.local` with the EAS token; `.env.local` with the two
> Supabase values (they are public: project URL + anon key). `eas env:create` may prompt once —
> approve it. Nothing here touches x-core SQL.
>
> **How to run:** `cd` to the repo folder, `claude`, paste below the line.

---

```
Phase 1 of IMP 29092026 — hotfix release 2.1.3. Two bugs that real users hit and one distribution
change. No schema change, no new feature.

Read first:
- docs/imp-29092026/01-research/03-bugs-env-feedback-apk-splash.md §1 (the photo bug: expo/expo
  #50217, GC/release of the ImageManipulator context cancels renderAsync on Android — the
  defensive fix), §2 (EXPO_PUBLIC_* in local EAS builds: eas env + eas.json env + build guard), §5
  (stable release asset name).
- docs/imp-29092026/02-specs/02-cloud-v3.md "Sync protocol changes" item 1 (schema gate ships now).
- docs/imp-29092026/02-specs/03-screens.md "Phase 1".
- lib/media/index.ts (compress/ingest), components/PhotoPicker.tsx, components/VehicleForm.tsx,
  lib/cloud/supabase.ts, lib/cloud/auth.ts, app/cuenta.tsx, eas.json, app.config.js,
  lib/sync/merge.ts, tools/ (release scripts from Phase 8 of the last cycle — find the one that
  creates the GitHub release; PROGRESS.md of imp-28092026 "Release (2026-09-29)" says how it was done).

Branch: fix/2.1.3-hotfix

1. PHOTO BUG (note 12). Rewrite compress() in lib/media/index.ts as compressPhoto(): keep the
   context in a local that stays referenced until saveAsync resolves; run resize → renderAsync →
   saveAsync in one async function with no unrelated awaits in between; release() the context and
   the rendered image in `finally` only if those methods exist (feature-detect); on an error whose
   message contains "JobCancellationException" or "has been rejected", retry ONCE after 50 ms;
   after the retry, throw a typed MediaError('render_cancelled'). Add a module-level in-flight map
   so two concurrent compressions of the same uri share one promise. PhotoPicker/PhotoStrip
   callers: on MediaError show es.common.photoErrorRetry ("No se pudo guardar la foto. Inténtalo
   otra vez.") with a Reintentar button; never show the raw message (log it under __DEV__ and push
   it into a lib/diagnostics ring buffer of the last 20 errors for the future feedback form).
   Stable identity: VehicleForm's draftId must be created once (it is — useState initializer;
   confirm PhotoPicker is not re-keyed by it) and the new-vehicle screen must not be remounted by
   the router while the picker is open (check app/vehiculo/nuevo.tsx for a key on the form).
   Pending result: on VehicleForm mount (native only) call
   ImagePicker.getPendingResultAsync(); if it returns assets, run them through ingest() and set
   the photo — this covers the Activity-killed case. Reproduce first: Developer options → "Don't
   keep activities" ON, open Agregar vehículo → Tomar foto → the app comes back; then also test with
   it OFF and a 12 MP gallery photo five times in a row. Both must pass after the fix.
2. ACCOUNTS IN THE APK (note 13). (a) Verify lib/cloud/supabase.ts reads
   `process.env.EXPO_PUBLIC_SUPABASE_URL` with dot access (it does — keep it that way; add a
   comment saying why). (b) `eas env:create` both variables as plaintext for `preview` and
   `production` (values from .env.local; run `eas env:create --help` first to confirm flags;
   `eas env:list --environment production` to verify). (c) eas.json: add a `base` profile with
   `env: { EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY }` (literal values — public by
   design, RLS protects; say so in a comment field `"_comment"` is not allowed in eas.json, so put
   the explanation in docs/NEXT.md and .env.example) and `environment` per profile (preview →
   preview, release-apk/production → production); preview, release-apk, production `extends:
   "base"`. (d) app.config.js: when `process.env.EAS_BUILD === 'true'` and the profile is not
   development, throw if either value is empty (message names the variable — that is a build log,
   fine). (e) A post-export check script tools/check-bundle-env.mjs: after `npx expo export
   --platform android` (or on the APK's bundle via `unzip -p <apk> assets/index.android.bundle`),
   grep for the project ref; wire it into the release script so a build without it never reaches
   GitHub.
3. NO DEVELOPER TEXT (note 13). es.account.notConfigured/notConfiguredCaption and every string
   found in Phase 0 audit (b) become user copy per 03-screens.md "Phase 1"; the technical hint
   moves to es.dev.* and renders only when __DEV__ || setting show_diagnostics. Add the 7-tap
   "modo diagnóstico" on the version row in Más (shows a toast "Diagnóstico activado", persists in
   AsyncStorage, not synced). The Cuenta screen shows the app version + build under the pill.
4. SCHEMA GATE (protects 2.1.3 devices from 2.2 rows): lib/sync/merge.ts — a pulled row whose
   `schema_hint` (new optional column, absent today → null) is greater than SCHEMA_HINT ('v5' now;
   compare as integers after stripping 'v') is skipped and counted; Cuenta shows "Hay N cambios de
   una versión más nueva de Car Guy. Actualiza la app para verlos." Unit test with a fake row.
   (No cloud DDL now: the column arrives in sql/018; a select of a missing column must not break —
   pull with `select *` already tolerates it; assert in the test.)
5. RELEASE 2.1.3: versions 2.1.3 in app.json/package.json; CHANGELOG "2.1.3 (fecha)" in Spanish
   (fotos en Android, cuenta disponible en el APK, mensajes claros); build `release-apk` locally
   (universal), run tools/check-bundle-env.mjs on it, install on the Redmi OVER 2.1.2 with the
   real garage (adb install -r), verify: sign in with Xaviel's existing account works from THIS
   APK (he types the password — you do not), add a photo to a new car, take a photo in a check.
   Create the GitHub release v2.1.3 with TWO assets: `car-guy.apk` (stable name, ADR-34) and
   `car-guy-v2.1.3.apk`; upload with content type application/vnd.android.package-archive if the
   release tool allows; not a pre-release. Verify
   `curl -sIL https://github.com/XavielT/car-guy/releases/latest/download/car-guy.apk | grep -i location`
   resolves. Merge to main, tag v2.1.3, push; web deploys from main (no web change besides copy).
6. Update docs/NEXT.md (2.1.3 row, the eas env explanation) and PROGRESS.md (Phase 1 report,
   notes closed: 12, 13; note 17's asset name prerequisite done).

VERIFY on the Redmi (both with "Don't keep activities" on and off): photo from gallery and camera
on new vehicle, edit vehicle, check runner falla item, service record. Web: nothing regressed
(fuel flow canary, weekly check canary). Report block.
```
