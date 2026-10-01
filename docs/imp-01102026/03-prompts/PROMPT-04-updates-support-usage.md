# PROMPT 04 — Actualizaciones solas (EAS Update + APK en la app), Apoyar Car Guy, Uso y costos

**Depends on:** Phase 2 (app_config) · **Branch:** `imp-01102026/phase-4-updates` · **ADRs:** 52, 53 · **Size:** M
**Goal:** G3.

> **Before running:** EAS token in `.env.expo.local`; approve `eas update:configure` changes;
> **native rebuild** needed once (expo-updates is a native module). Tell the prompt whether a
> PayPal.me test payment to your account worked (manual checklist) — until then the Apoyar
> screen shows only the text and "Pronto".
>
> **How to run:** `cd` to the repo folder, `claude`, paste below the line.

---

```
Phase 4 of IMP 01102026: the app updates itself; a voluntary way to support it; the admin sees
what it costs. Notes 4, 6.

Read first:
- docs/imp-01102026/01-research/01-ios-pwa-updates-ads-costs.md §3 (EAS Update: fingerprint policy,
  channels, local builds, check options, the update hook; APK download + install intent code; what
  needs a new APK), §4 (AdMob conclusion, PayPal/Ko-fi notes, Supabase limits and the usage meter
  SQL), §5 (Vercel limits; donations are not commercial use)
- ADR-52, ADR-53; 02-screens.md "Phase 4"; Expo 57 docs for expo-updates, expo-file-system (File
  API, contentUri), expo-intent-launcher, expo-application
- eas.json, app.json, app.config.js, tools/release-apk.sh, tools/check-bundle-env.mjs, api/apk.ts,
  lib/release/apk.ts, app/versiones.tsx, app/admin/*, lib/cloud/roles.ts

Branch: imp-01102026/phase-4-updates

1. EAS UPDATE: npx expo install expo-updates; `eas update:configure`; runtimeVersion policy
   fingerprint; channels: preview (preview profile), production (release-apk + production);
   app.json updates.checkAutomatically ON_LOAD, fallbackToCacheTimeout 0; lib/updates/ota.ts hook
   (check → fetch → banner "Actualización lista · Reiniciar"); Novedades y versiones shows
   Updates.channel/updateId and "Buscar actualización" (OTA + APK). Verify a local build embeds the
   channel (Updates.channel non-null in a preview build; else set the request header per research).
   tools/release-apk.sh --ota: `expo fingerprint` compare with the last native release's
   fingerprint (stored in releases/fingerprint.json) → if equal: `eas update --channel production
   --message "<version>"` + GitHub release notes without APK; if different: refuse --ota and run
   the APK path. CHANGELOG + version bump apply to both.
2. APK UPDATER: lib/updates/apk.ts — compare Application.nativeApplicationVersion with /api/apk
   version (semver) once per launch (and from Novedades); banner "Nueva versión X · NN MB ·
   Descargar e instalar" → File.downloadFileAsync to cache with progress → contentUri →
   IntentLauncher startActivityAsync('android.intent.action.VIEW', { data, type:
   'application/vnd.android.package-archive', flags: READ_URI | NEW_TASK }); REQUEST_INSTALL_PACKAGES
   in app.json android.permissions; the user does the install taps; a "¿Por qué?" sheet explains
   the unknown-sources prompt once. Web: SW update → toast "Nueva versión · Recargar".
3. APOYAR CAR GUY (note 4, ADR-53): Más row (last in the list, no badge/popup) → screen: why
   (backend costs), this month's estimated cost (from app_config.support_text written by the admin
   meter), links from app_config.support_links (PayPal.me if Xaviel confirmed the test; bank
   transfer text otherwise; empty → "Pronto"), opt-in "Gracias" list (premium role granted by the
   admin shows a small hanko on the public profile later). No tracking, no ads, no slot.
4. USO Y COSTOS (admin): RPC admin_usage() (pg_database_size, storage totals from the existing
   per-user RPC summed, MAU = profiles with activity 30 d, junte message counters placeholder) →
   admin screen with bars vs Free limits (500 MB DB, 1 GB storage, 50k MAU, 2M realtime msgs) and
   a slope-based "Pro necesario ≈ <mes>"; writes app_config.support_text monthly estimate when the
   admin taps "Publicar en Apoyar".
5. Flags FEATURE_OTA + FEATURE_SUPPORT → true. Strings in both languages. Tests: semver compare,
   fingerprint gate script (unit with fixtures), usage slope maths.

VERIFY: build a preview APK with expo-updates, install on the Redmi, publish a JS-only update to
the preview channel (a visible string change) → reopen twice → the banner → Reiniciar → change
visible. Then a native change (bump a permission) → the APK banner appears from /api/apk (point it
at a test release or mock) → download progress → installer opens. Admin: Uso y costos shows real
numbers; Apoyar shows the configured text. Report block; Notes closed: 4, 6.
```
