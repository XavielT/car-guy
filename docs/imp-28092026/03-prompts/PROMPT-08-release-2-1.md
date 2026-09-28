# PROMPT 08 — Release Car Guy v2.1.0 "Hachi-Gō"

**Depends on:** Phase 7 (or Phase 6 if sharing is postponed) · **Branch:** `imp-28092026/phase-8-release` · **Size:** M

> **Before running:** EAS token in `.env.expo.local` (docs/NEXT.md recipe), `gh auth status`,
> `vercel whoami`; phone connected (`adb devices`). Xaviel backs up the keystore if not yet done
> (NEXT.md §1).
>
> **How to run:** `cd ~/dev2/car-guy && claude`, paste below the line.

---

```
Phase 8 of IMP 28092026: ship v2.1.0.

Read first: docs/NEXT.md (release recipe, backlog), docs/imp-28092026/04-tracking/PROGRESS.md
(all phase reports, "Observed, deferred"), CHANGELOG.md.

1. PRE-FLIGHT: full regression walk on web + Android (Expo Go, then the preview APK): onboarding,
   garage (status changes, Ex), album import + viewer + sync, build (mods/specs/wishlist/inventario),
   DIY (ficha, fluidos, OBD, contactos), track (event/session/copy-forward/summary), share (link,
   PDF, members), fuel flow, chequeo, reminders + notifications, cifras + report, backup v2
   export/import, light/dark, gauge sweep once. Fix blockers only; log the rest as deferred.
   Migration check: install v2.0.0 APK on the phone with data, then install the v2.1.0 preview APK
   over it → data intact, migration v2/v3 applied, sync still works.
2. BACKLOG PASS (from docs/NEXT.md §3, small ones): Cifras y-axis origin; the 320 px tab label;
   desktop max width (content column 560 px centred on web ≥ 900 px); wire PDF documents into the
   documents screen; npm audit fixes that are non-breaking; expo-doctor patch bumps
   (`npx expo install --fix`) with a retest on the phone.
3. VERSIONS: app.json version 2.1.0 (versionCode by EAS remote); CHANGELOG.md "2.1.0 — Hachi-Gō"
   in Spanish, by block (Look JDM · Álbum y memoria · Build · DIY · Pista · Compartir · Arreglos),
   with the "Antes de publicar" testing note; README.md feature list + screenshots refreshed
   (docs/qa/phase-2/3/4/6 pngs); docs/NEXT.md rewritten with the post-2.1 backlog.
4. BUILDS: `set -a; . ./.env.expo.local; set +a` then
   `npx eas-cli@24.8.0 build --platform android --profile preview --local --non-interactive` (APK)
   and `--profile production` (AAB). Install the APK on the phone: launcher icon (new tach mark),
   splash, sweep, notifications, camera, album import permission flow, PDF share, WhatsApp share
   of a public link. Record the table.
5. RELEASE: `gh release create v2.1.0 --title "Car Guy v2.1.0 — Hachi-Gō" --notes-file CHANGELOG.md
   releases/car-guy-v2.1.0.apk#car-guy-v2.1.0.apk`; tag on main; push. Web: main deploy; confirm
   `/c/<slug>` works on production and the SW cache name was bumped so installed PWAs refresh.
   Vercel env vars for the function set (manual step recorded).
6. HAND-OFF: docs/NEXT.md "Hand-off to xaviel-web" updated (new tagline "Tu carro, al día. Con
   historia.", new screenshots, public page example link), and a note for the old Vercel project.
7. FINAL REPORT in PROGRESS.md: build ids, APK path, release URL, regression tables, deferred list.
```

---

## Acceptance criteria

- [ ] Regression walk recorded; upgrade from v2.0.0 with data verified on the phone.
- [ ] Backlog items done or explicitly deferred with reasons.
- [ ] CHANGELOG/README/NEXT updated; version 2.1.0.
- [ ] APK + AAB built; phone table; GitHub release + tag; web production verified incl. `/c/<slug>`.
- [ ] Hand-off note updated.
