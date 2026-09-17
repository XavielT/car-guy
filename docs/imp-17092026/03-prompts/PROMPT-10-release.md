# PROMPT 10 — Release: Android build, new Vercel project, repo rename, PWA, hand-off

**Depends on:** Phase 9 (or Phase 7 if the cloud phases are postponed — see README) · **Branch:** `imp-17092026/phase-10-release` · **ADRs:** 01, 15
**Goal:** G8 — Car Guy is installable on Android and at `car-guy.vercel.app`; repo is `car-guy`.

> **Before running (manual, Xaviel):** `npx eas login` · `npx vercel login` · `gh auth status` OK ·
> Java 17 + Android SDK present if a local gradle build is preferred over EAS · a real Android phone
> connected (`adb devices`) for the final install test.
>
> **How to run:** `cd /home/xaviel/dev2/tu-gasolina-rd && claude`, paste below the line.

---

```
Phase 10 of IMP 17092026: ship Car Guy.

Read first:
- docs/imp-17092026/00-context/03-architecture-decisions.md (ADR-01, ADR-15)
- docs/NEXT.md (the previous release procedure: prebuild --clean, gradle assembleRelease, gh release)
- docs/imp-17092026/04-tracking/PROGRESS.md (EAS project id from Phase 1; preview build from Phase 5)
- docs/imp-17092026/05-manual-checklist.md
- docs/imp-17092026/01-research/03-expo57-technical.md §7

Branch: imp-17092026/phase-10-release

Requirements:

1. PRE-FLIGHT: full regression walk on web + Android (Expo Go): onboarding (new + import legacy),
   garage, fuel, service, expense, task, documents, inspection run with a falla, reminders + test
   notification, cifras + PDF + CSV, account sign-in + sync (if Phases 8–9 shipped), backup v2
   export/import, light/dark. Fix only blockers; log the rest as deferred. tsc/lint/test/build green.

2. VERSIONS: app.json version "2.0.0" (already), android.versionCode 1 (EAS remote will manage it —
   confirm eas.json appVersionSource remote). Add a version + build line to Más → Acerca de
   (expo-constants: Constants.expoConfig.version, plus the git short SHA injected at build via
   app.config.js if you convert app.json → app.config.js; do it only if it stays simple).
   CHANGELOG.md: "2.0.0 — Car Guy" with the feature list by phase.

3. ANDROID BUILD (choose by tooling availability; report which):
   a) EAS (preferred): `npx eas build --platform android --profile preview` (APK, internal) and
      `--profile production` (AAB) — wait for both; download the APK to releases/ (gitignored).
   b) Local: `npx expo prebuild --platform android --clean` → `cd android && ./gradlew assembleRelease`
      (a NEW keystore is generated for the new package — save it under ~/keystores/car-guy/ as the
      manual checklist says; it must never be lost or the app can't be updated).
   Install on the phone (`adb install`), verify: launcher name "Car Guy", new icon (incl. themed
   monochrome on Android 13+), splash, notifications outside Expo Go, camera photo, PDF share.

4. GITHUB RELEASE: `gh release create v2.0.0 --title "Car Guy v2.0.0" --notes-file CHANGELOG.md
   <apk>#car-guy-v2.0.0.apk`. Keep Tu Combustible RD's v1.1.0 release untouched.

5. WEB / VERCEL: create a NEW Vercel project "car-guy" linked to the repo (`npx vercel link` fresh:
   remove .vercel/ first so the old project link is not reused; production branch main; build
   command from package.json; output dist). Deploy production; confirm https://car-guy.vercel.app
   serves the PWA: manifest name Car Guy, icons, SW registers, OPFS works over HTTPS, install prompt
   on Android Chrome, "Add to Home Screen" on iPhone shows the right icon. Old project
   tu-combustible-rd stays as is (Xaviel decides when to remove it); do NOT delete it.

6. REPO RENAME: `gh repo rename car-guy` (GitHub keeps redirects); update `git remote set-url origin`;
   update README badges/links, package.json repository field if any, and the portfolio note:
   xaviel-web-v2's app card for Tu Combustible RD points at `releases/latest` of the OLD repo name —
   redirects will work, but write a note in docs/imp-17092026/04-tracking/PROGRESS.md "Hand-off to
   xaviel-web" listing what that site should change (name, description, URL car-guy.vercel.app,
   release link) so imp 11092026 Phase 4 integrates Car Guy instead of Tu Combustible RD.

7. HOUSEKEEPING: delete docs/NEXT.md content that no longer applies and replace it with the Car Guy
   backlog (from PROGRESS "Observed, deferred" + README "Backlog"); docs/PLAN.md → keep as history
   with a header "Plan original de Tu Combustible RD (2026-08); ver docs/imp-17092026 para Car Guy".
   Ensure .gitignore covers releases/, *.keystore, .env*.local, fixtures/*.real.json.

8. Final report in PROGRESS.md with: build URLs, APK path, Vercel URL, repo URL, keystore location
   (path only, never contents), and the regression table. Merge, push, tag v2.0.0.
```

---

## Acceptance criteria

- [ ] Regression walk recorded; no blockers open.
- [ ] Android APK + AAB built; APK installed on a real phone shows name/icon/splash correctly; notifications, camera, PDF share work in the release build.
- [ ] GitHub release `v2.0.0` with the APK; old v1.1.0 untouched.
- [ ] `https://car-guy.vercel.app` live as an installable PWA; old project untouched.
- [ ] Repo renamed to `car-guy`; remote updated; hand-off note for xaviel-web written.
- [ ] CHANGELOG, README, docs/NEXT.md updated; keystore saved outside the repo (local build) or managed by EAS.
- [ ] Tag `v2.0.0` on `main`.

## Watch for

- A new `android.package` = new keystore. With EAS the keystore is remote; with a local build **back it up** — losing it means no updates ever.
- `vercel link` will happily reuse the old project if `.vercel/` exists — delete the folder first.
- Vercel needs no COOP/COEP headers (async SQLite); do not add them.
- Renaming the repo before the Vercel project is linked can break the Git integration — do step 5 before step 6.
