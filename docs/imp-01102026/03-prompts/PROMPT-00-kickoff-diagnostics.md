# PROMPT 00 — Kickoff: package in repo, baseline, audit, Redmi auto-trip diagnostics

**Depends on:** nothing · **Branch:** `imp-01102026/phase-0-kickoff` · **Size:** S–M

> **Before running:** the Redmi on USB with 2.4.2, Viajes → Ajustes in **Automático** and the
> permission "todo el tiempo" granted. Package: `~/improvements/imps car guy/september 2026/imps 01102026`
> (yes, the September folder — same tree as the others). The `mv ~/dev2/tu-gasolina-rd ~/dev2/car-guy`
> is still pending; the prompt works in either path.
>
> **How to run:** `cd` to the repo folder, `claude`, paste below the line.

---

```
Phase 0 of IMP 01102026 (Car Guy 2.5 "Nakama"). Fifth cycle; 2.4.2 shipped today. Eighteen notes.
Key fact: Xaviel used the app on his iPhone as a PWA for the drive that was not recorded — Safari
has no background location, so that part is a platform limit, not a bug (brief §0). The Android
side must still be proven on his Redmi: that is this phase's diagnostics.

Read first:
- CLAUDE.md → AGENTS.md, docs/NEXT.md ("Cycle 4", "Carried"), CHANGELOG.md (2.3.1 → 2.4.2)
- the package: README.md, 00-context/01-project-brief.md (note → prompt map, §0), 02-state-of-the-repo.md,
  03-architecture-decisions.md (ADR-48…58), 04-conventions.md; 01-research/01 §1–2 (iOS PWA, freshness)

Branch: imp-01102026/phase-0-kickoff

1. PATH + PACKAGE: pwd (rename pending? say so); copy the package to docs/imp-01102026/; pointers in
   docs/RESUME.md and docs/NEXT.md ("Cycle 5").
2. BASELINE table in docs/imp-01102026/04-tracking/PROGRESS.md (the usual: ci, tsc, lint, tests,
   build, verify-x-core 38, verify-sync, local-rls, smokes, audit, whoami ×3, adb, disk).
3. AUDIT 02-state-of-the-repo.md vs code, with file:line: (a) GaugePicker + partialEconomy inputs
   (eighths); (b) where the user dot is drawn in Conducir/TripMap and whether any freshness check
   exists (ADR-49); (c) public/sw.js strategy for index.html; iOS standalone detection anywhere?;
   (d) the Inicio Hanko 改 target; (e) cuenta.tsx dateLabel for lastSyncAt; (f) garage badge
   rendering over covers (tone outline) and other label overflow at 360 px (list them with
   screenshots on web at 360 px); (g) every entry point to /mod/nuevo and whether any status blocks
   adding a mod; mod categories seeded; cost currency default; (h) service types in category
   carroceria; (i) welcome slides list; (j) expo-updates present? (no) — and what `expo fingerprint`
   reports today; (k) profiles columns live on x-core (`\d carguy.profiles` via apply-sql's inspect).
4. REDMI DIAGNOSTICS (note 7, ADR-50) — read-only, write everything into PROGRESS.md "Auto-trip
   diagnostics": `adb shell dumpsys package com.xaviel.carguy | grep -A2 -i "ACCESS_BACKGROUND_LOCATION\|FOREGROUND_SERVICE\|POST_NOTIFICATIONS"`;
   `adb shell dumpsys deviceidle whitelist | grep carguy`; `adb shell cmd appops get com.xaviel.carguy`
   (incl. the MIUI autostart op 10008); `adb shell dumpsys activity services | grep -i -A5 carguy`
   (is LocationTaskService running?); `adb logcat -d | grep -i -E "carguy|expo-location|LocationTask|TaskManager" | tail -200`;
   the trip_state row and trips_* settings (via the app's diagnostics export — add a "Exportar
   diagnóstico de viajes" action in Viajes → Ajustes that shares a JSON: mode, permission states,
   hasStartedLocationUpdatesAsync, last 20 fixes' timestamps/accuracy, trip_state, MIUI autostart
   state, battery optimisation state); then background the app, walk 2 minutes with the phone,
   and read logcat again: did the task receive fixes? Conclude: green / specific failure (permission
   not "always", service not armed on cold start, MIUI killed it, no fixes while screen off…).
   Write the fix list for Phase 1 from the finding; do not change behaviour in this phase.
5. SEED: a second seed profile ("@trueno_ae85" + "@amigo_prueba") data file for Phase 5's local
   tests (no cloud writes now).
6. TRACKING: PROGRESS.md baseline, audit, diagnostics, phase table Phase 0 ✅. Commit; merge to main
   (docs + the diagnostics export action); no tag.

Report block; Notes closed: 7 (Android half: finding recorded; the fix lands in Phase 1).
```
