# PROMPT 00 — Kickoff: package in repo, baseline, audit, Wheelz first-hand over adb

**Depends on:** nothing · **Branch:** `imp-30092026/phase-0-kickoff` · **Size:** S–M

> **Before running:** the Redmi on USB (or Wi-Fi adb), unlocked, with Wheelz installed and
> signed in. Xaviel authorised a **read-only** walk of Wheelz (research 03 §C). If you still have
> not: `mv ~/dev2/tu-gasolina-rd ~/dev2/car-guy` with no session open. The package folder is
> `~/improvements/imps car guy/september 2026/imps 30092026`.
>
> **How to run:** `cd` to the repo folder, `claude`, paste below the line.

---

```
Phase 0 of IMP 30092026 (Car Guy 2.4 "Tōge"). Fourth cycle; 2.3.0 shipped today. Seventeen notes
from Xaviel after using 2.2/2.3 on his phone.

Read first:
- CLAUDE.md → AGENTS.md, docs/NEXT.md ("Cycle 3", "Carried"), CHANGELOG.md (2.2.0 → 2.3.0)
- ~/improvements/imps car guy/september 2026/imps 30092026/README.md, then 00-context/01-project-brief.md
  (note → prompt map), 02-state-of-the-repo.md, 03-architecture-decisions.md (ADR-37…47: defaults,
  report them, never stop to ask), 04-conventions.md, 01-research/03-micm-prices-stations-wheelz-adb.md §C.

Branch: imp-30092026/phase-0-kickoff (from main at 2.3.0)

1. PATH + PACKAGE: print pwd (rename pending? say so); copy the package to docs/imp-30092026/;
   pointer lines in docs/RESUME.md and docs/NEXT.md ("Cycle 4").
2. BASELINE table in docs/imp-30092026/04-tracking/PROGRESS.md: npm ci, tsc, lint, npm test
   (count), build (pages), verify-x-core (28), verify-sync, local-rls, smoke-public-page (6),
   smoke-apk (3), npm audit, eas/vercel/gh whoami, adb devices, disk free (last cycle hit 91 %).
3. AUDIT 02-state-of-the-repo.md vs the code — confirm/deny with file:line: (a) app/carga/nueva.tsx
   re-keys the form on focus and the review sheet's "Listo" returns to the same form; whether a
   second tap on Guardar can create a duplicate (is the button disabled while saving? is there any
   dedupe?); (b) app/carga/[id].tsx is the editor and where Historial/Inicio route fuel rows;
   (c) the gauge picker's reserve chip label and behaviour (in_reserve, gauge_before) — note 12;
   (d) lib/trips: live.ts options, machine.ts recording options for auto mode, finalize.ts
   simplify tolerance (8?), geo.ts cleanTrack/excursion thresholds, the purge of trip_point, and
   what the trip screens draw from (polyline vs points) — note 16; (e) STATIONS list; (f) milestone
   columns and album_item roles; (g) vehicle_specsheet fields that already cover note 6; (h)
   carguy.profiles columns (display_name? avatar?); (i) every screen that renders null/empty while
   loading — produce the "Screen audit" table (route → what shows while loading → skeleton needed)
   for Phase 3; (j) Cifras' current location in the tab bar and every `router.push('/(tabs)/cifras')`.
4. EXPORT XAVIEL'S TRIPS (note 16, read-only): write tools/export-trips.mjs? No — the DB is on
   the phone. Instead: add a hidden "Exportar puntos GPS (GeoJSON)" action to the trip detail's
   diagnostics (long-press the map) that shares a .geojson with raw points (if still present),
   the stored polyline and the diagnostics; ship it in this phase's build? No build in Phase 0 —
   write the code now (small), Phase 1 ships it and Xaviel exports his straight-line trip for the
   audit. Record in PROGRESS.md that the audit answer arrives in Phase 1.
5. WHEELZ FIRST-HAND (note 14): follow research 03 §C exactly (read-only; never start/stop a
   drive, never change a setting, never touch the account; Back on any dialog). Save PNGs + UI
   dumps under docs/imp-30092026/01-research/wheelz/ (crop personal data), and write
   docs/imp-30092026/01-research/05-wheelz-firsthand.md: per screen three lines (what it shows,
   what it lets you do, what Car Guy takes / does not), plus a section "Drive Tracking settings
   as they really are" and "What the drive detail shows" (map, stats, distribution, replay, share).
   Stop at 25 screenshots. If the phone is not connected, write the file with "pending" and go on.
6. SEED: dev garage gets 3 events (accidente grave on the C3 with 2 photos + cost, sobrecalentamiento
   leve on the DS3, dano_menor "espejo" pendiente "pintar") only as data prepared for Phase 2 —
   keep behind a `SEED_V8` flag off until the migration exists (or write the seed additions in
   Phase 2). Prices: nothing yet.
7. TRACKING: PROGRESS.md baseline, audit, screen audit, Wheelz status; phase table Phase 0 ✅.
   Commit, merge to main (docs + tiny hidden export action), no tag.

Report block (04-conventions.md §8); Notes closed: 14 (or "pending phone").
```
