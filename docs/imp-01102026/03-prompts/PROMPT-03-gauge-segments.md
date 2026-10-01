# PROMPT 03 — Medidor por cuadros + calibración aprendida + litros/km restantes

**Depends on:** Phase 2 · **Branch:** `imp-01102026/phase-3-gauge` · **ADRs:** 51 · **Size:** M
**Goal:** G2.

> **Before running:** nothing to approve. Xaviel's DS3: 9 squares; reserve light at 0 or 1 square
> (the prompt asks him once via the form, not via chat).
>
> **How to run:** `cd` to the repo folder, `claude`, paste below the line.

---

```
Phase 3 of IMP 01102026: the gauge speaks each car's language. Notes 1, 3.

Read first:
- docs/imp-01102026/01-research/03-segment-gauge-calibration.md (all: behaviour, model, PAV, worked
  example, UI picker spec, economy generalisation, edge cases)
- docs/imp-01102026/02-specs/02-screens.md "Phase 3"; 01-data-model-v10.md §1
- lib/domain/gauge.ts + gaugeCalibration.ts (Phase 2), lib/domain/partialEconomy.ts,
  components/fuel/GaugePicker.tsx, components/VehicleForm.tsx (sections), app/vehiculo/[id].tsx
  (hub rows), components/ui/ClusterHero.tsx + TelltaleRow (fuel telltale), app/vehiculo/[id]/ficha.tsx

Branch: imp-01102026/phase-3-gauge

1. VEHICLE FORM: "¿Cómo marca la gasolina tu carro?" — three illustrated chips (aguja · cuadros ·
   porcentaje); cuadros → stepper N (3–20) with live preview + "¿Con cuántos cuadros prende la
   reserva?" (0 · 1 · 2); saving converts existing readings' raw labels (fractions unchanged).
2. FILL-UP FORM: GaugePicker becomes a switch over SegmentsPicker (N rounded squares, amber,
   lowest red, tap/drag, accessible values "4 de 9"), the arc (eighths) and a 5 % slider; "Solo la
   luz de reserva" for all; after the Antes reading: "≈ 22 L en el tanque (18–24)" when learned,
   "≈ 20 L (estimación lineal — llena el tanque 2 veces marcando el nivel para afinar)" otherwise.
3. CALIBRATION: recompute on every fuel-log change (store hook) → vehicle.gauge_calibration (synced);
   partialEconomy uses fractions + the learned grid when status ≠ linear, resolution C/(2N) for
   segments; reconciliation unchanged; tests from the research pass against real code.
4. REMAINING: vehicle hub fuel row "Tanque: 4/9 ≈ 22 L · ≈ 390 km (300–450) · hace 2 días"
   (decays with km driven since the reading at recent km/L; hides after 30 days); cluster fuel
   telltale amber ≤ 2 squares / ≤ 2/8, red when the reserve light was marked; Ficha → "Medidor"
   section: the learned table with bands, n tanques, "Reiniciar calibración"; tank-capacity edit
   > 2 L → offer reset.
5. Flags FEATURE_GAUGE_SEGMENTS → true. Strings in both languages.

VERIFY web + Android: seed DS3 → the hub shows the learned table (values of the research example),
a new partial with 2 → 6 squares shows an estimate with a band; switch the Trueno to percent and
back; a needle vehicle's numbers unchanged. Screenshots. Report block; Notes closed: 1, 3.
```
