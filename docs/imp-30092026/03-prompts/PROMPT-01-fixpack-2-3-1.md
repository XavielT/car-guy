# PROMPT 01 — Fix pack 2.3.1: fill-up flow, stations, reserve light, per-fill economy, routes

**Depends on:** Phase 0 · **Branch:** `fix/2.3.1-fixpack` (from `main`) · **ADRs:** 37, 42 · **Size:** M
**Goal:** G1. Ships the same session. No migration.

> **Before running:** Redmi connected; `.env.expo.local`; nothing to approve on x-core.
> During the session Xaviel exports the "straight line" trip from the phone (Phase 0's hidden
> action, or this build's) — the prompt tells him when.
>
> **How to run:** `cd` to the repo folder, `claude`, paste below the line.

---

```
Phase 1 of IMP 30092026 — fix pack 2.3.1. Notes 7, 8, 9, 12, 16. No schema change.

Read first:
- docs/imp-30092026/02-specs/03-screens.md "Phase 1"; ADR-37, ADR-42
- docs/imp-30092026/01-research/03-micm-prices-stations-wheelz-adb.md §B (stations)
- docs/imp-30092026/01-research/01-maplibre-expo.md §4 (why routes look straight)
- Phase 0 audit answers (a)–(e) in PROGRESS.md
- app/carga/nueva.tsx, app/carga/[id].tsx, components/FillUpForm.tsx, components/FillUpReviewSheet.tsx,
  components/fuel/GaugePicker.tsx, lib/domain/economy.ts, lib/domain/partialEconomy.ts, lib/fuel.ts,
  app/(tabs)/historial.tsx (fuel rows), app/(tabs)/index.tsx (last fill-up), lib/trips/live.ts,
  lib/trips/machine.ts (recording options), lib/trips/finalize.ts, lib/trips/geo.ts, lib/trips/present.ts,
  lib/trips/tiles.ts, app/viaje/[id].tsx

Branch: fix/2.3.1-fixpack

1. FILL-UP DETAIL (note 8): new app/carga/[id].tsx = detail per 03-screens.md; move the editor to
   app/carga/[id]/editar.tsx (typed routes + vercel.json rewrite); "Listo" in the review sheet
   after a NEW save → router.replace('/carga/<id>') + toast "Echada guardada"; the form never stays
   mounted with the saved values (remove the focus re-key: the screen is left). Historial fuel
   rows, Inicio's "última echada", and any deep link open the detail. Save guard: disable the
   button while saving (state in the form), and refuse a draft equal to a log saved < 60 s ago
   on the same vehicle (odometer, volume, total, date ± 1 min) with "Esta echada ya se guardó ·
   Ver". Test the dedupe rule.
2. STATIONS (note 7): lib/domain/refdata/stations.json per research 03 §B (Petronan, Sunix, Sigma,
   Nativa, United Petroleum, Petromóvil, Gulf, Ecopetróleo, Coastal, Propagas (GLP), Tropigas (GLP)
   + the current eight); FillUpForm: chips → SearchSheet (recent-first from the vehicle's logs,
   then brands allowed for the fuel type, then Otra free text); accent-insensitive normalisation
   of typed names to a brand; existing logs untouched.
3. RESERVE LIGHT (note 12): GaugePicker's chip becomes "Solo la luz de reserva" with the dots-
   gauge caption; behaviour = in_reserve + before at E (verify what partialEconomy expects and
   keep the estimate maths; reserve_volume_l default 10 %). Edit screen shows it.
4. ≈ POR ECHADA (note 9): lib/domain/perFillEconomy.ts (spec 01-data-model-v8.md §2 — pure,
   tested: increasing odometer, missed_previous excluded, > 60-day gap excluded, units via
   units.ts); shown in the review sheet (muted, "aproximado"), in Historial fuel rows and in the
   fill-up detail; Cifras: dotted grey series behind a toggle "Por echada (aprox.)" (setting
   economy_per_fill, default on); never in averages, never in the public page. Copy explains in
   one line why it is approximate (the tank level at each stop is unknown).
5. ROUTES (note 16, ADR-42): (a) ship the hidden "Exportar puntos GPS" action from Phase 0 and
   ask Xaviel to export the straight-line trip now; read the GeoJSON: how many raw points, how
   many in the polyline, dropped excursions, mode; write the finding in PROGRESS.md. (b) Whatever
   the finding: simplify tolerance 8 → 3 m in finalize; auto-mode recording options = manual's
   (1 s / 3 m, BestForNavigation); the trip screens draw from trip_point when present (30 days),
   else the polyline; the OSM mosaic's fit uses zoom ≥ 15 when the bbox allows; the excursion
   filter records what it dropped in trip.diagnostics? — no column yet: log to the diagnostics
   ring buffer + include in the export. (c) If the export shows the raw points themselves are
   sparse (auto mode watching → recording switch lag), lower the watching→recording switch to
   the first fast fix and add a 60 s "pre-roll" buffer of watching fixes into the trip. Tests for
   simplify at 3 m on the synthetic GPX (point count ≥ 4× the old).
6. RELEASE 2.3.1: versions, CHANGELOG 2.3.1 (Spanish), regenerate lib/changelog.generated.ts,
   `bash tools/release-apk.sh --publish` (build, check-bundle-env, GitHub release with car-guy.apk),
   install over 2.3.0 on the Redmi with the real data (backup first: tools or Más → Datos), verify:
   save a real fill-up → lands on the detail, no duplicate on double tap; Petronan in the list;
   reserve chip; "≈ por echada" on his DS3 refills; the trip detail of a new short drive (if he
   can) shows the street shape on the mosaic. Merge to main, tag, push; smoke-apk 3/3.

Report block; Notes closed: 7, 8, 9, 12; 16 partially (the map itself is Phase 4).
```
