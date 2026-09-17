# PROMPT 00 — Kickoff: bring the package into the repo, verify the audit, baseline

**Depends on:** nothing · **Branch:** `imp-17092026/phase-0-kickoff` · **Time:** short (≤ 30 min)

> **Before running:** `cd /home/xaviel/dev2/tu-gasolina-rd && git status` clean; Node ≥ 20;
> `npx expo --version` works. EAS/Vercel logins are checked here but not required yet.
>
> **How to run:** `cd /home/xaviel/dev2/tu-gasolina-rd && claude`, paste everything below the line.

---

```
Kickoff of the IMP 17092026 cycle: "Tu Combustible RD" becomes "Car Guy", a full vehicle-care app.
This phase changes no product code. It brings the planning package into the repo, checks that the
package's description of the repo is still true, and records a baseline.

Read first:
- CLAUDE.md → AGENTS.md (Expo 57 docs rule — applies to every later phase)
- /home/xaviel/improvements/imps car guy/september 2026/imps 17092026/README.md
- /home/xaviel/improvements/imps car guy/september 2026/imps 17092026/00-context/01-project-brief.md
- /home/xaviel/improvements/imps car guy/september 2026/imps 17092026/00-context/02-repo-audit.md
- /home/xaviel/improvements/imps car guy/september 2026/imps 17092026/00-context/04-conventions.md

Do:

1. Create branch imp-17092026/phase-0-kickoff.

2. Copy the whole package folder into the repo as docs/imp-17092026/ (keep the sub-folder
   structure: 00-context, 01-research, 02-specs, 03-prompts, 04-tracking, README.md,
   05-manual-checklist.md). From now on every prompt reads from docs/imp-17092026/…; the copy in
   /home/xaviel/improvements is the original that I keep editing by hand, so if both exist and
   differ, tell me which one is newer (mtime) and use the newer one.

3. Verify the audit (docs/imp-17092026/00-context/02-repo-audit.md) against the code: stack
   versions in package.json, the file map, lib/types.ts, lib/storage.ts KEY, app.json identity
   fields, vercel.json headers, public/sw.js cache name, tools/*.mjs. Write the differences (if
   any) at the top of docs/imp-17092026/04-tracking/PROGRESS.md under "Audit corrections". Do not
   fix code.

4. Baseline: run and record the output summary (not the full logs) in PROGRESS.md → "Baseline":
   - npm ci (or npm install if the lockfile is out of date — say which)
   - npx tsc --noEmit
   - npm run build   (web static export; note dist size)
   - npx expo start --web for 30 s and confirm the app renders (screenshot to docs/qa/baseline-web.png with Playwright if available: npx playwright screenshot --browser=chromium http://localhost:8081 docs/qa/baseline-web.png; if Playwright is not installed, skip and say so)
   - tooling presence: node -v, npm -v, npx eas-cli --version && npx eas whoami (logged in? which account), npx vercel whoami, gh auth status, sqlite3 --version, java -version (for a later gradle build), adb devices. Record each as available / missing / not logged in. Do not install anything now.

5. Export a real backup from the current app data if the repo contains any sample data file
   (grep for "tu-combustible-rd" JSON fixtures). If none exists, write a realistic fixture
   docs/imp-17092026/fixtures/tu-combustible-rd-backup.sample.json in the exact format of
   lib/backup.ts (app, version 1, exportedAt, data with 2 vehicles, ~12 fill-ups incl. partials,
   4 expenses across categories, 3 reminders incl. one completed, settings with prices). It is the
   test input for the importer in Phase 2. Note in PROGRESS.md that Xaviel must also export his
   REAL backup from the installed Tu Combustible RD app (Más → Crear respaldo JSON) before Phase 2
   and drop it at docs/imp-17092026/fixtures/tu-combustible-rd-backup.real.json (gitignored — add
   that path to .gitignore).

6. Fill PROGRESS.md "Phase 0" using the reporting block in 04-conventions.md, commit
   ("chore(imp-17092026): kickoff — package, audit corrections, baseline"), merge to main, push.

Do not change app.json, dependencies, or any source file in this phase.
```

---

## Acceptance criteria

- [ ] `docs/imp-17092026/` exists in the repo with every file of the package.
- [ ] "Audit corrections" section lists deviations or states "none".
- [ ] Baseline section records tsc, build, web start, tooling table.
- [ ] Sample backup fixture exists and matches `lib/backup.ts` format; `.gitignore` ignores the real one.
- [ ] Phase 0 report written; merged to `main`; `main` still deploys (Vercel unaffected).
