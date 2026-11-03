# SPEC-I — Speed that can be trusted, and thin, stylised route lines (P6, P6a)

Xaviel (03-nov): "the speed recording is not as accurate as it should be" — he noticed it in **the live needle, the trip's top speed, average speed/distance, and the route map** — and "the thickness of the heat line of the routes I usually take is too thick; make it thinner and stylised."

## I0. What the code does today (verified; confirm in PROMPT-10 step 1)
- Speed to believe = the reported (Doppler) speed when ≥ 0, else displacement ÷ Δt from the previous fix (`lib/trips/geo.ts effectiveSpeed`); null when accuracy > 50 m.
- Live needle: `reduceLive` (`lib/trips/liveStore.ts`) smooths with a **fixed EMA α = 0.35** per fix (≈ 3 s lag at 1 Hz) and `displayKmh` dead-band 0.8 m/s. The **live max (`maxKmh`) is the max of the smoothed speed**, so it under-reports peaks, while the **saved max** (`geo.ts stats()`, finalize) is a median of reported speeds of accurate fixes — **two different methods for the same number**, hence "top speed" disagrees between the cluster and the trip detail.
- Foreground watcher uses `distanceInterval: 3`; background recording batches ≤ 5 s; web/iPhone has no reported speed (null/−1) so speed is **pairwise displacement over 1 s**, which is noisy (±3–7 km/h).
- Distance = GPS polyline with jitter filter and accuracy gating: typically 1–3 % short of the real road distance, and a car's **odometer reads high** (tyre size, calibration) — so "km don't match the odometer" is partly physics.
- A car's **speedometer over-reads by design** (commonly +2–6 %); GPS is the truth. Without a calibration the app will "look wrong" next to the dash even when it is right.
- Heat layer: MapLibre `heatmap` (`heatmapPaint()` in `lib/trips/geojson.ts`: radius 8→22 px, intensity up to 1.6) rendered by `components/map/HeatMap.tsx` / `HeatMap.web.tsx` from points sampled every 35 m (`sampleAlong`); route lines use width 4.5 over an 8 px casing (`ROUTE_LINE_WIDTH`, `ROUTE_CASING_PAINT`).

## I1. One `SpeedEngine` for everything (ADR-72) — `lib/trips/speed.ts`, pure TS
Used by the live needle, the saved stats, the replay, the map segment colours and the recaps, so **the same trip gives the same numbers everywhere**.
- **Input gate**: accuracy ≤ 50 m for a speed sample (≤ 20 m for peaks); drop fixes that imply impossible acceleration (> ~9 m/s² accelerating, > ~14 m/s² braking) or a jump (existing `isJump`).
- **Fusion**: two measurements per fix — Doppler speed (variance from accuracy, tiny when present) and displacement speed (variance grows with accuracy/Δt) — fused by a 1-D Kalman filter with **adaptive process noise** (higher when recently accelerating) so it follows braking quickly and is calm at cruise; reset on gaps > 5 s. Where Doppler is missing (web/iOS), use a **3–5 s sliding-window regression of distance**, not a pair difference, and mark the value "estimada".
- **Stop logic**: hysteresis — show 0 only when Doppler < 0.5 m/s and displacement is inside the accuracy radius for ≥ 2 fixes; stops "creeping" numbers at a red light.
- **Display**: the needle uses the fused value with a small predictive lead, not the fixed EMA.
- **Top speed** = the highest fused speed **sustained ≥ 2 s** (≥ 3 consecutive fixes within 10 % of the peak) with accuracy ≤ 20 m; never a single spike; identical function live and at finalize (`stats()` calls it). Show it with the time it happened and a "GPS" label.
- **Averages**: *promedio en movimiento* = moving distance ÷ moving time (stops excluded) and *promedio total* = distance ÷ elapsed; both labelled, so nobody compares the wrong one with their expectation.
- **Segment speeds** for the route colours come from the fused series smoothed over ±2 fixes (existing 5 buckets).

## I2. Calibration per vehicle (what makes it match "my" car)
- `vehicle.speed_factor` (default 1.000) and `vehicle.odo_factor` (default 1.000). Local schema bump + additive cloud SQL (next `sql/` numbers; synced columns; add to the ADR-63 round-trip test).
- **Speed**: "Calibrar velocidad" — hold a steady speed (cruise control helps), type what the dash says; the app averages the fused GPS speed over the last ~10 steady seconds; after ≥ 3 samples it proposes the median factor ("Tu tablero marca 4.2 % más que el GPS"). Setting **"Mostrar velocidad: GPS real / como mi tablero"** (default GPS real; the saved trip always stores GPS truth, the factor only changes display).
- **Odometer**: learned automatically from `Σ GPS km between two odometer readings` vs the odometer difference (`odometer.ts` sources already include `trip_estimate`); once ≥ 3 intervals ≥ 100 km exist, suggest `odo_factor` and let the odometer estimates (`trip_estimate`) use it so `lastOdo` hints stay closer to the dash.
- Both live in Ficha del vehículo → "Calibración", with the explanation in plain Spanish.

## I3. Prove it (don't claim it)
- **Replay harness** (extend `tools/gen-drive-gpx.mjs`; tests in `__tests__/trips/`): synthetic ground-truth drives — city stop-go, highway cruise, hard braking, tunnel/underpass dropout, urban canyon (30–60 m noise), Android "speed 0 while moving", iOS −1, 1 Hz vs 0.2 Hz — with injected noise; metrics: speed RMSE vs truth, top-speed error, distance error, time-to-react at braking. **Old vs new table in PROGRESS.** Targets: steady-state RMSE ≤ 1.5 km/h, accelerating ≤ 3 km/h, top speed ±2 km/h, distance ±1.5 %; no spike ever becomes top speed.
- **Raw-fix recorder** (Ajustes → Viajes → avanzado, off by default): keeps the raw fixes of the last N trips (accuracy, speed, timestamps) and exports GeoJSON/CSV through the existing exporter — so a real bad trip can be replayed.
- **Calibration drive** protocol `docs/CALIBRATION-DRIVE.md` (manual checklist): steady 60/80/100 km/h, photo of the dash at each (or compare against a second phone running Google Maps/Waze), plus a fill-up-to-fill-up odometer check.

## I4. Route lines: thin, stylised, informative
Replace the blob heatmap in "Por dónde manejas" with a **route-frequency line layer** (native `HeatMap.tsx` and `HeatMap.web.tsx` stay the same component API, so callers do not change):
- Build segment frequency: resample each route every 15 m, snap consecutive points to a ~15 m grid-edge key, count passes per edge (pure function `routeFrequency()` in `lib/trips/geojson.ts`, tested; cap 20k edges, merge opposite directions).
- Paint: **`line-width` 0.8 px at z10 → 2.4 px at z16 for one pass, +up to 1 px by log(count)**; amber → orange → red by count (existing JDM ramp); a faint **glow** underneath (same geometry, width × 2.5, `line-blur` 2–3, opacity 0.18–0.25); round caps/joins; **no radius blobs, no casing**; opacity rises with zoom instead of fading out.
- Legend "pocas veces → muchas veces"; tapping a line shows "Por aquí pasaste N veces" (optional, if cheap); same palette tokens as the cluster; respects reduced motion; light and dark map styles checked.
- Individual route lines (`ROUTE_LINE_WIDTH` 4.5, casing 8) are tokenised and slimmed to ~3 px over a 5 px casing, zoom-interpolated, so the whole map language is one system.

## I5. Acceptance
Replay table meets the targets (or the report says which case misses and why); live max == saved max on the same trip (test); calibration flow works end to end on the web build with a fake fix stream; the heat layer at zoom 10/13/16 is visibly thin in Playwright screenshots (before/after in `04-tracking/screens/`); no heatmap layer left in either component; i18n es/en; the existing trip detail, share GeoJSON and Libro still render.
