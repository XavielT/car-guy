# Resume prompt — Car Guy, finishing IMP 17092026

Paste everything below the line into a fresh `claude` session started in the repo root.

The repo may have been renamed on disk by then; `cd` to wherever it lives.

---

```
Continue IMP 17092026 for Car Guy. Phases 0–10 are merged into local `main`; what
remains is the release itself.

Read first:
- docs/NEXT.md — the backlog, with commands
- docs/imp-17092026/04-tracking/PROGRESS.md — the Phase 9 and Phase 10 reports at
  the end, especially "Observed, deferred"
- AGENTS.md — read https://docs.expo.dev/versions/v57.0.0/ before writing code

State:
- Repo: github.com/XavielT/car-guy (renamed from tu-combustible-rd; old name redirects)
- Web: https://car-guy.vercel.app is live, Vercel project `car-guy`, git-connected to main
- Local `main` has one unpushed merge: Phase 10, which includes a fix for a bug that is
  still live in production (the PWA could not be reloaded — OPFS access-handle race,
  see components/BootError.tsx)
- 332 tests, tsc and lint green, `npm run build` green
- Cloud: Supabase x-core, schema `carguy`. `node tools/verify-sync.mjs` is 13/13

Do these in order.

1. PUSH THE FIX. `git push origin main`. Both Vercel projects are git-connected to
   main, so this deploys production — that is the point: production currently has the
   reload bug. Then reload https://car-guy.vercel.app twice and confirm you get the app
   and not a black-on-white English "Something went wrong". Confirm Más → Acerca de shows
   `Versión 2.0.0` and a `Build <sha>` line.

2. ANDROID BUILD. I will log in when you ask. Run:
     npx eas-cli@latest login      (I type the password — you must not)
     npx eas-cli@latest init       (writes extra.eas.projectId into app.json)
     npx eas-cli@latest build --platform android --profile preview      # APK
     npx eas-cli@latest build --platform android --profile production   # AAB
   eas.json is already correct (appVersionSource remote, preview=apk, production=aab).
   Download the APK into releases/ (gitignored). If EAS is not workable, the local gradle
   recipe in docs/NEXT.md is proven — but it generates a NEW keystore for
   com.xaviel.carguy: save it to ~/keystores/car-guy/ and tell me to back it up off the
   machine. Losing it means no Android update is ever accepted as the same app again.

3. PHONE WALK. I will connect the phone; adb is at ~/Android/Sdk/platform-tools/adb.
   The app has NEVER run on a device — this is the largest untested surface in the repo.
   Install the APK and verify, recording results in PROGRESS.md as a table:
   launcher name "Car Guy", icon incl. Android 13+ themed monochrome, splash,
   notifications outside Expo Go (schedule one and tap it through to its screen),
   camera capture + photo compression, PDF report share (printToFileAsync → shareAsync —
   the one path web cannot test at all), native date picker, haptics on save,
   one-thumb reach in the chequeo runner, and lib/sync/mediaBytes.ts's
   expo-file-system branch (a photo synced from web must download and display).

4. SYNC ACCEPTANCE RUN (PROMPT-09 scenarios a–e). Never been done: no row has ever
   crossed between two devices. Stage it:
     npm run build
     # serve dist on two ports — two origins = two independent OPFS databases
   A resolver that mirrors Vercel's cleanUrls is needed because expo-router exports both
   dist/chequeo.html and dist/chequeo/; prefer the .html sibling.
   I will create the test account and type the password — you must not do either.
   Then drive a–e and record the result. Use phone + web for b/e if the phone is up,
   which is what the prompt actually asks for.

5. RELEASE. Once the APK exists:
     gh release create v2.0.0 --title "Car Guy v2.0.0" --notes-file CHANGELOG.md \
       <apk>#car-guy-v2.0.0.apk
   Leave v1.1.0 and v1.1.1 alone. Tag v2.0.0 on main and push the tag.

6. HAND-OFF NOTE for xaviel-web is already written in docs/NEXT.md ("Hand-off to
   xaviel-web"). Check it is still accurate and leave it.

7. FINAL REPORT in PROGRESS.md: build URLs, APK path, Vercel URL, repo URL, keystore
   location (path only, never contents), and the regression table from step 3.

Then, only if time allows, from docs/NEXT.md §3:
- Inicio's "Pendientes" still omits open tasks (carried since Phase 4)
- servicio/[id] has no edit form
- one pass over the 22 npm audit findings / 9 outdated SDK 57 packages

Constraints, so you do not waste a turn discovering them:
- You must not create accounts or type passwords into a browser or CLI. Ask me and wait.
- Do not trigger the PDF's print button in a browser — window.print() froze the renderer
  earlier in this package. reportHtml is a tested pure function; trust the tests.
- Production deploys may be blocked for you. `git push origin main` is the deploy path;
  if a direct `vercel --prod` is refused, say so rather than working around it.
- Storage objects cannot be deleted with SQL (storage.protect_delete). Use
  tools/cleanup-probe-media.mjs.
- Writing to x-core goes through `node tools/apply-sql.mjs <file>` (add --shared only when
  the file genuinely touches public/auth/storage, and read the SELECTs first). x-core is
  shared production with Music Hub — ADR-06 allows one IF in their code, nothing more.
- Clean up test users afterwards: node tools/apply-sql.mjs sql/999_cleanup_test_users.sql --shared

Housekeeping I could not do: the folder is still ~/dev2/tu-gasolina-rd. Rename it to
car-guy now if no session is holding it (the old path only appears in docs, which are
history). The old Vercel project `tu-combustible-rd` is still git-connected to this repo
and has been auto-deploying Car Guy to the old URL all cycle — delete the project when I
say so, not before.
```
