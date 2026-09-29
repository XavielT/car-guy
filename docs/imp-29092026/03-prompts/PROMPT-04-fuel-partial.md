# PROMPT 04 — Carga parcial: gauge levels, estimated economy, reconciliation

**Depends on:** Phase 3 · **Branch:** `imp-29092026/phase-4-fuel` · **ADRs:** 32, 33 · **Size:** M
**Goal:** G4 — fuel numbers even without full tanks.

> **Before running:** nothing to approve.
>
> **How to run:** `cd` to the repo folder, `claude`, paste below the line.

---

```
Phase 4 of IMP 29092026: partial fill-ups produce numbers. Note 4.

Read first:
- docs/imp-29092026/01-research/02-fuel-partial-and-datasets.md §1 (all: maths, error bars, the
  "F is not full" rule, segment statuses, reconciliation, function spec, worked example — the
  worked example becomes a test)
- docs/imp-29092026/02-specs/03-screens.md "Phase 4"
- lib/domain/economy.ts (keep every existing test green: brim-to-brim results must not change
  for logs without gauge data — the migration canary from Phase 2 already pins this),
  components/FillUpForm.tsx, components/FillUpReviewSheet.tsx, app/(tabs)/index.tsx (consumption
  line + insight), app/(tabs)/cifras.tsx + components/charts/EconomyLine.tsx, lib/domain/stats.ts,
  lib/report/html.ts, lib/share/dossier.ts (economy shown publicly)

Branch: imp-29092026/phase-4-fuel

1. DOMAIN: computeEconomy(logs, cfg) per §1.8: cfg from the vehicle (capacityL = tank_volume,
   reserveL = reserve_volume_l ?? 0.10·C, nonlinK 0.03, fullHalfL 0.5, maxRelUnc 0.25). Output
   segments + spans + averageKmPerL; each point carries status, band, reason, warnings. Keep
   the exported EconomyPoint shape backward compatible (add fields, do not rename) so charts and
   the review sheet keep working, then extend them. reviewFillUp uses the same function.
   Averages: Σkm/ΣL over measured + reconciled; + estimated when setting
   economy_include_estimates = 1. Tests: the worked example of §1.9 (numbers to 2 decimals), the
   F-without-toggle rule, missed_previous breaking both chains, a reserve reading, the
   gauge_pump_mismatch warning, uncertainty > 25 % → unknown with reason, all existing tests.
2. FORM: GaugePicker component (components/fuel/GaugePicker.tsx): a small SVG fuel-gauge arc with
   9 stops E…F, drag or tap, label under it (E, 1/8 … F), 44 px hit areas, works on web; the
   "En reserva" chip on Antes sets in_reserve and disables the Antes arc (or sets it to E with the
   chip highlighted — pick one and keep it consistent). Both pickers optional; a one-line hint.
   When Después = F and the tank is marked Parcial: soft prompt to switch to Tanque lleno.
   Edit form shows the saved levels. missedPrevious unchanged.
3. REVIEW SHEET: estimated → "≈ X km/gal (entre A y B) · estimado por el medidor"; unknown →
   the reason in Spanish; measured/reconciled as today. Inicio's consumption line: "≈" prefix and
   muted colour for an estimated latest point; the low/great insight only on measured points
   (never alarm on an estimate).
4. CIFRAS: EconomyLine renders four styles (solid, ringed, hollow with band, gap) + legend +
   "Incluir estimados" toggle (setting). Reports/CSV: a `estado` column (medido/estimado/…).
   Public dossier: only measured/reconciled averages.
5. PRECIOS board: unchanged (RD$/gal as posted) but the "what it costs to fill my tank" helper (if
   it exists) converts with the vehicle unit.
6. STRINGS; TESTS as in 1 + GaugePicker snapshot on web; flags: none.

VERIFY web + Android with the seed's DS3: log a partial with Antes 1/4 → Después 3/4 (no full):
review says estimado with a band; log another partial 1/2 → F without the toggle → prompt; then a
full tank → the earlier estimates turn reconciled on the chart and the Inicio line loses the ≈.
Screenshots docs/qa/imp-29092026-phase-4-*.png. Report block; note closed: 4.
```
