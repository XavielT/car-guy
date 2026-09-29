# PROMPT 00 — Kickoff: package into the repo, baseline, audit, portfolio check

**Depends on:** nothing · **Branch:** `imp-29092026/phase-0-kickoff` · **Size:** S

> **Before running:** if you have not yet, with no Claude session open in the folder:
> `mv ~/dev2/tu-gasolina-rd ~/dev2/car-guy`. The prompt works in either path.
> The package folder is `~/improvements/imps car guy/september 2026/imps 29092026`.
>
> **How to run:** `cd ~/dev2/car-guy && claude` (or `~/dev2/tu-gasolina-rd`), paste below the line.

---

```
Phase 0 of IMP 29092026 (Car Guy 2.2 "Kaidō"). You are in the Car Guy repo (Expo SDK 57). Third
improvement cycle; v2.1.2 shipped today. Nineteen notes from Xaviel after using 2.1.x on his phone.

Read first:
- CLAUDE.md → AGENTS.md (standing rules), docs/NEXT.md, CHANGELOG.md
- ~/improvements/imps car guy/september 2026/imps 29092026/README.md, then
  00-context/01-project-brief.md (the note → prompt map: every note must end up closed),
  00-context/02-state-of-the-repo.md, 00-context/03-architecture-decisions.md (ADR-25…36 — apply
  as defaults, report them, never stop to ask), 00-context/04-conventions.md.

Branch: imp-29092026/phase-0-kickoff (from main at v2.1.2)

1. PATH: print `pwd`. If it is ~/dev2/tu-gasolina-rd, print in the report that the rename is still
   pending (manual) and continue; do not rename it yourself.
2. PACKAGE IN REPO: copy the package folder to docs/imp-29092026/ (all of it, incl. 01-research
   and 04-tracking). Add a line to docs/RESUME.md and a "Cycle 3" pointer in docs/NEXT.md.
3. BASELINE: `npm ci`, `npx tsc --noEmit`, `npx expo lint`, `npm test` (826 expected), `npm run
   build` (page count), `node tools/verify-x-core.mjs` (23), `node tools/verify-sync.mjs` (17),
   `tools/local-rls/run.sh` (39), `node tools/smoke-public-page.mjs` (6), `npm audit` count,
   `eas whoami`, `vercel whoami`, `gh auth status`, `~/Android/Sdk/platform-tools/adb devices`.
   Write the table into docs/imp-29092026/04-tracking/PROGRESS.md "Baseline".
4. AUDIT 02-state-of-the-repo.md against the code (table "Audit corrections" in PROGRESS.md):
   confirm/deny in particular: (a) `fuel_log.volume` and `vehicle.tank_volume` are gallons for all
   existing data (lib/fuel.ts, any 'l' unit anywhere?); (b) the exact text a user sees on Cuenta
   when the cloud is not configured (es.account.notConfiguredCaption) and every other string in
   es.ts that mentions .env, EXPO_PUBLIC, "configur" or a file name — list them; (c) which sql files
   __tests__/sync/schema-parity.test.ts parses; (d) whether the TCO in Cifras already sums purchase
   price + mods + services + fuel (lib/domain/stats.ts) — note 8 depends on it; (e) the check
   runner's photo on 'falla' works on Android today (it uses the same compress() path as the bug
   in note 12 — assume it fails the same way until Phase 1); (f) mods and service records photos
   appear in history_feed / album timeline (yes/no each); (g) eas.json has no env/environment.
5. PORTFOLIO CHECK (note 9): fetch https://xaviel-web-v2.vercel.app (curl or WebFetch) and search
   the HTML/JS for "Car Guy" and "car-guy.vercel.app". Also `cd ~/dev2/xaviel-web-v2 && git log
   -3 --oneline main && git status -sb` and `vercel ls` there if logged in. Report: is the Car Guy
   card live? If the deploy is missing, do NOT deploy now — PROMPT-07 does it with the APK button;
   write the finding in PROGRESS.md "Portfolio".
6. SEED: extend lib/dev/garage.ts (the real garage: DS3 daily, El Trueno AE85 4A-GE 20V, C3 2003
   restoring, Jetta 2003 1.8T ex; never real plate/VIN/phone) with data the new phases need to
   demo: 6 fuel logs on the DS3 with a mix of full/partial (partials without gauge data for now —
   Phase 4 adds the gauge fields), 1 failed check item, 2 mods with costs on the Trueno, purchase
   prices on all four. Keep `npm test` green (seed tests).
7. TRACKING: docs/imp-29092026/04-tracking/PROGRESS.md gets the baseline, audit corrections,
   portfolio finding, and the phase table with Phase 0 ✅. ROADMAP.md unchanged.
8. Commit on the branch, merge to main (docs + seed only, no app behaviour), do not tag.

Report block per 04-conventions.md §9 (add "Notes closed: 18 (path check) — the rename itself is
Xaviel's").
```
