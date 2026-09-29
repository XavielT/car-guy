# Car Guy research 02: partial fill-ups, volume units, make/model data, reference lists

Scope: Expo SDK 57 / React Native app, local-first SQLite, Spanish UI, Dominican Republic (DR). WebSearch was disabled; only known URLs were fetched with WebFetch. Anything not confirmed by a fetched page is marked **unverified (from knowledge)**.

---

## 1. Partial fill-ups and fuel economy

### 1.1 What the reference apps do

| App | Documented behaviour | Evidence |
|---|---|---|
| **Fuelio** | "To see fuel consumption ... you need at least two full fillups." Uses a "full tank algorithm", which it calls the most accurate. It rejects an empty-tank method as less accurate and unsafe, and says other algorithms may come later. | Fetched fuel.io/faq_fuel_consumption.html |
| **Drivvo** | The FAQ has a "Full tank?" toggle and says "the average [is] calculated only between full tank fuel entries". It shows a "previous fuel entry missing" message, and "the last fuel entry [does] not show an average". There is also a question "Can I calculate the average without filling the tank?", but its answer text did not load. | Fetched drivvo.com/en/faq (questions only) |
| **Fuelly** | The FAQ lists "How do I account for partial fuel-ups?", "How do I account for missed fuel-ups?" and "Why doesn't my fuel-up have a calculated MPG?". The answer pages returned 404. From knowledge: Fuelly marks a fill-up as partial and carries its volume into the next full fill-up. A "missed fuel-up" flag suppresses MPG for that segment. **Unverified (from knowledge).** | Fetched fuelly.com/faq (titles only) |
| **Simply Auto, aCar** | No help URL could be guessed. From knowledge, both use full-to-full with "partial" and "missed previous" flags. Neither is known to offer a gauge-based estimator. **Unverified (from knowledge).** | none |

**Conclusion:** all the mainstream apps are brim-to-brim only. A gauge-based estimate would set Car Guy apart, which matters in DR because people often buy a peso amount ("échale 500") instead of filling the tank. It has to be labelled clearly as an estimate.

### 1.2 The maths

Definitions:
- `C` is the tank capacity in liters, from the vehicle.
- `g` is a gauge reading in eighths (0 means E, 8 means F). The fuel level is `L = g/8 · C`.
- `reserveL` is the fuel left when the reserve light is on. It is set per vehicle; the default is `0.1·C` with a half-width of `0.05·C`. **Unverified (from knowledge):** most warning lights come on at roughly 8–15 % of capacity.

Fuel burned between log *i* and log *i+1*:

```
consumed(i→i+1) = levelAfter(i) − levelBefore(i+1)
```

This is the same as the owner's formula. Starting from the before-reading of log *i*, `levelAfter(i) = levelBefore(i) + added(i)`, so `consumed = added(i) − (levelBefore(i+1) − levelBefore(i)) = added − Δ(level·C)`.

Since both the before and after readings are recorded, there are **two independent estimates of levelAfter(i)**:
1. from the gauge: `gAfter/8 · C`
2. from the pump: `levelBefore(i) + added(i)`

Combine them with inverse-variance weighting, which is a plain average when the uncertainties are equal. The gap between the two also works as a **consistency check**.

If the log is an explicit full tank, `levelAfter = C`. This is the anchor.

### 1.3 Error bars

| Source | Magnitude | Note |
|---|---|---|
| 1/8 resolution | ±C/16 per reading (uniform half-step) | 45 L tank: ±2.81 L |
| Gauge non-linearity, damping, tank shape | extra ±k·C, suggested k = 0.03–0.05 | **Unverified (from knowledge).** Many gauges are deliberately non-linear: they stay on F for a while and fall faster below 1/4. Parked on a slope, the reading shifts. |
| "Full" at pump click-off | about ±0.5 L | **Unverified (from knowledge).** Depends on click-off and topping-off. |
| Reserve light | ±0.05·C | Wide band. Improves if the user enters `reserve_l`. |

Combine with root-sum-square (RSS) for the displayed interval. A worst-case (linear sum) bound is about 1.4× wider. Use RSS for the interval and keep worst case for validation thresholds.

Implication: one estimated segment over a short distance is noisy. For a 45 L tank with both ends read off the gauge (±2.81 L each), the fuel uncertainty is about ±4 L. On a 100 km segment using 8 L, that is ±50 %. **Require `fuelL ≥ 4 × u(fuel)` (about ±25 %) or the segment is "unknown".** In short: estimates are meaningful only when the gauge has moved at least about 3/8 between logs.

### 1.4 The "gauge at F is not full" ambiguity

- The gauge float reaches the top of its travel before the tank is actually full. Many cars read F for the first 30–80 km after a fill. **Unverified (from knowledge).**
- A filler neck can hold 2–4 L beyond the nominal capacity, which is why "liters added" sometimes exceeds `C − levelBefore`.
- **Rule:** only the explicit toggle **"Tanque lleno (hasta que la bomba disparó)"** makes a log a full anchor, meaning `levelAfter = C`.
  - If the user sets after = F without the toggle, treat it as level `C·(15/16)` with a half-width of `C/16`. That means "somewhere between 7/8 and full".
  - The UI should suggest turning on the toggle when after = F.
- **Capacity calibration:** keep `levelBefore + added − C` for each full log. If its median is steadily above 0, say "Tu tanque parece aceptar ≈ X L más de lo indicado" and offer to update the effective capacity. Never change it silently.

### 1.5 Segment classification

| Status | When | Display |
|---|---|---|
| `measured` | Full to full, with no `missed_previous` on any log in the span. Fuel = the sum of volumes of every log in (fullA, fullB]. This is the current brim-to-brim result. | Solid dot. Counts in the headline averages. |
| `reconciled` | A gauge-estimated sub-segment inside a measured span, adjusted so the sub-segments add up to the measured total (see 1.6). | Solid dot with a thin ring. Counts. |
| `estimated` | Gauge-based, with no enclosing full-to-full span yet (usually the latest logs), and passing the 25 % uncertainty rule. | **Hollow dot**, "≈" prefix, whisker or band for the range. Excluded from the headline average unless the user enables "incluir estimados". |
| `unknown` | Missing gauge reading at either end, `missed_previous`, odometer not increasing, fuel ≤ 0, or relative uncertainty > 25 %. | Gap in the line. The list shows "—" plus the reason. |

Rules for mixing them in one series:
1. **A full tank resets the chain.** Estimates never carry uncertainty across a full anchor.
2. **Measured beats estimated.** Once a later full log closes a span, its sub-segments are recomputed as `reconciled`.
3. **`missed_previous` breaks both** the gauge chain and the full-to-full span. It works like Fuelly and Drivvo's "missing entry".
4. **Averages are distance-weighted**: Σkm / ΣL. Never average the ratios.
5. Every point exposes `status`, `fuelL`, `fuelLowL`, `fuelHighL`, `reason?`. The UI decides how to render them, and the pure function stays free of UI concerns.

### 1.6 Reconciliation

Take a measured span with total `M` that contains sub-segment estimates `e_j` with variances `σ_j²`. Spread the discrepancy `D = Σe_j − M` in proportion to variance. This is the constrained least-squares solution.

```
r_j = e_j − D · σ_j² / Σσ²
```

If any sub-segment in the span is `unknown`, emit only the single measured span point and no sub-points.

### 1.7 Schema additions (SQLite)

```sql
ALTER TABLE fuel_logs ADD COLUMN gauge_before_eighths INTEGER NULL CHECK (gauge_before_eighths BETWEEN 0 AND 8);
ALTER TABLE fuel_logs ADD COLUMN gauge_after_eighths  INTEGER NULL CHECK (gauge_after_eighths  BETWEEN 0 AND 8);
ALTER TABLE fuel_logs ADD COLUMN in_reserve           INTEGER NOT NULL DEFAULT 0;  -- applies to the BEFORE reading; overrides gauge_before
ALTER TABLE fuel_logs ADD COLUMN missed_previous      INTEGER NOT NULL DEFAULT 0;
-- existing: is_full (full_tank) INTEGER, odometer_km, volume (see §2 -> volume_l)

ALTER TABLE vehicles ADD COLUMN reserve_l REAL NULL;          -- optional; default 0.1*C at compute time
ALTER TABLE vehicles ADD COLUMN economy_unit TEXT NOT NULL DEFAULT 'km_gal'; -- km_gal | km_l | l_100km | mpg_us
```

Computed points are **derived and not stored**, because the function is cheap. If they are cached (`economy_points`), give each row `status TEXT` and an `estimated INTEGER` (1 for estimated or reconciled). Recompute the cache whenever a log in the vehicle changes.

UI picker for the gauge: `E · 1/8 · 1/4 · 3/8 · 1/2 · 5/8 · 3/4 · 7/8 · F` plus a chip **"En reserva"**. Both are optional, so the old brim-to-brim flow still works.

### 1.8 Pure function spec (TypeScript)

```ts
type FuelLog = { id: string; odometerKm: number; volumeL: number; isFull: boolean;
  gaugeBefore8: number | null; gaugeAfter8: number | null; inReserve: boolean; missedPrevious: boolean };
type VehicleFuelCfg = { capacityL: number; reserveL?: number;
  nonlinK?: number /*0.03*/; fullHalfL?: number /*0.5*/; maxRelUnc?: number /*0.25*/ };
type EconomyStatus = 'measured' | 'reconciled' | 'estimated' | 'unknown';
type EconomyPoint = { fromId: string; toId: string; distanceKm: number; fuelL: number | null;
  fuelLowL: number | null; fuelHighL: number | null; kmPerL: number | null;
  status: EconomyStatus; reason?: 'missing_gauge'|'missed_fill'|'odometer'|'nonpositive'|'too_uncertain';
  warnings?: ('gauge_pump_mismatch'|'over_capacity')[] };

export function computeEconomy(logs: FuelLog[], v: VehicleFuelCfg): {
  segments: EconomyPoint[];      // consecutive-log segments (estimated/reconciled/unknown)
  spans: EconomyPoint[];         // full→full measured spans
  averageKmPerL: number | null;  // Σkm/ΣL over measured+reconciled
};
```

Algorithm:
1. Sort by odometer, breaking ties by date. Reject non-increasing odometers with `odometer`.
2. For each log, compute `levelBefore` as (value, σ): `inReserve` gives `reserveL`; otherwise `gaugeBefore8/8·C`; otherwise null.
3. Compute `levelAfter`: `isFull` gives `C ± fullHalfL`. Otherwise combine by inverse variance: the gauge value (with after = F mapped to 15/16·C) and `levelBefore + volumeL`. If both are null, it is null. If they disagree by more than 2·RSS, add the warning `gauge_pump_mismatch`.
4. Each consecutive pair gives `fuel = after(i) − before(i+1)` and `u = RSS`. Classify it as in 1.5.
5. Spans: for each pair of full logs with no `missed_previous` in (a, b], `M = Σ volumeL` over (a, b]. This is `measured`. A single-segment span replaces its segment. For multi-segment spans, reconcile (1.6) or drop the sub-points.
6. Per-reading σ uses a half-width of `C/16 + nonlinK·C`. `fuelLow/High = fuel ∓ u`, and `kmPerL` bounds are `distance/fuelHigh` and `distance/fuelLow`.

### 1.9 Worked example: 45 L tank, reserveL = 5 L (±2.5), nonlinK = 0 for clean numbers

u(reading) = 45/16 = 2.8125 L; full = ±0.5 L.

| Log | Odo | Before | After | Added | Full? |
|---|---|---|---|---|---|
| A | 10 000 | 2/8 | F | 34.0 L | yes |
| B | 10 300 | 3/8 | 6/8 | 13.5 L | no |
| C | 10 650 | en reserva | F | 39.5 L | yes |

- **A after** = 45.0 ± 0.5 (anchor).
- **B before** = 3/8·45 = 16.875 ± 2.81.
- **B after**: the gauge gives 33.75 ± 2.81 and the pump gives 16.875 + 13.5 = 30.375 ± 2.81. Combined, that is **32.06 ± 1.99**. The mismatch is 3.4 L, under the 2·RSS limit of 7.95, so no warning.
- **A→B**: fuel = 45 − 16.875 = 28.125 ± √(0.5² + 2.81²) = ±2.86 L. Over 300 km that is **10.67 km/L (9.68–11.87)**, or 40.4 km/gal (36.7–44.9). Relative uncertainty is 10 %, so the segment is valid.
- **C before** = 5.0 ± 2.5. Check: 5 + 39.5 = 44.5, close to 45, so no `over_capacity` warning.
- **B→C**: fuel = 32.06 − 5.0 = 27.06 ± √(1.99² + 2.5²) = ±3.19 L. Over 350 km that is **12.93 km/L (11.57–14.66)**.
- **Measured span A→C**: M = 13.5 + 39.5 = 53.0 L over 650 km, giving **12.26 km/L (46.4 km/gal)**, about ±1.3 %.
- **Reconcile**: D = 55.19 − 53.0 = 2.19 L. The variances are 8.16 and 10.21. A→B becomes 28.125 − 0.97 = **27.15 L, or 11.05 km/L**. B→C becomes 27.06 − 1.22 = **25.85 L, or 13.54 km/L**. They sum to 53.0 L.
- Before log C existed, both segments would have been `estimated` (hollow dots). After C, they are `reconciled` and the span is `measured`.

---

## 2. Fuel volume units

- **Store canonical liters.** Use `fuel_logs.volume_l REAL` and `vehicles.tank_capacity_l REAL`, plus `vehicles.volume_unit TEXT CHECK (volume_unit IN ('L','gal_us'))` for display and input.
  - Convert at the input and output edges only. All maths (§1) runs in liters.
- **Factor:** 1 US gal = **3.785411784 L** exactly (231 in³). The imperial gallon is 4.54609 L (both verified on Wikipedia).
  - DR sells fuel by the **US gallon**. **Unverified (from knowledge):** official weekly fuel prices are published per galón, and pumps are US-spec.
  - Do not offer the imperial gallon, or hide it behind "avanzado".
- **Round-trip fidelity:** keep `volume_input REAL` and `volume_input_unit TEXT` on each log. Then a user who typed `8.250 gal` sees exactly that when editing, not 8.2499…
  - The same applies to capacity: store `tank_capacity_input` + unit, so the vehicle form shows "Capacidad: [ 12 ] [gal ▾]" with a L/gal segmented control.
- **Migration:** for existing rows where the vehicle unit is gal, set `volume_l = volume · 3.785411784`, `volume_input = volume`, `volume_input_unit = 'gal_us'`. Run it in one transaction and bump `PRAGMA user_version`.
- **Economy display** is a per-vehicle `economy_unit` with a default of **km/gal**. **Unverified (from knowledge):** that is the colloquial unit in DR.
  - km/L = km / L.
  - km/gal = km/L × 3.785411784.
  - L/100 km = 100 / (km/L).
  - mpg (US) = km/L × 2.352145833.
  - L/100 km is inverted, so "better" means lower. Flip the chart's "good" direction and trend colours for it.
- **Display precision:** volume to 3 decimals in gal and 2 in L; economy to 1 decimal. Price per gallon comes from the station entry, so compute price per liter as price/gal ÷ 3.785411784.

---

## 3. Make / model / year pickers

### 3.1 NHTSA vPIC (fetched)

| Endpoint | Findings |
|---|---|
| `GetAllMakes` | **12,364 makes.** Very noisy: "280 TRAILERS", "357 GOLF CARTS", "A & E TRAILERS". Not usable as a picker. |
| `GetMakesForVehicleType/car` | **195 makes**, about 15–18 KB JSON. Includes Peugeot, Daihatsu, Isuzu, Suzuki, Toyota, Kia, Hyundai. **Citroën is missing.** |
| `GetModelsForMake/peugeot` | 8 models: 505, 405, 604, 504, plus 4 scooters (Speedfight2, Vivacity, …). Only 1980s US-market cars. |
| `GetModelsForMake/citroen` | 1 placeholder model, "Citroen". |
| `GetModelsForMake/daihatsu` | 3 models: Charade, Rocky, Low Speed Vehicle. **No Terios.** |
| `GetModelsForMake/toyota` | 58 models, US market. **No Hilux, Land Cruiser Prado, Fortuner, Hiace, Vitz, Rush, Corolla Levin/Sprinter.** |
| `GetModelsForMake/hyundai` | 40 models. **No H-1/Grand Starex, Grand i10, Creta, Porter/H100.** |
| `GetModelsForMakeYear` | Needs ModelYear > 1995. The API is rate-limited ("automated traffic rate control"). |

Verdict: vPIC is US-only and online-only. It misses the vans, pickups and small cars most common in DR. **Do not use it as the picker source.** Its real value is **VIN decoding** of US-import used cars, which are a large share of the DR fleet (**unverified, from knowledge**). That can come later as an optional online feature.

### 3.2 Bundleable open datasets (fetched)

| Dataset | License | Size | Coverage | DR fit |
|---|---|---|---|---|
| **abhionlyone/us-car-models-data** | **CC BY 4.0** (attribution required) | 471 KB total. 36 CSVs of 1992–2026 at about 11–19 KB/year. Columns `year,make,model,body_styles`. | 15,000+ rows. The 2018 file has 54 US-market makes. **No Peugeot, Citroën, Daihatsu, Isuzu, Suzuki.** Free version no longer updated. | Useful seed for US-market models and body styles. Needs non-US additions. |
| **arthurkao/vehicle-make-model-data** | MIT | Unknown (GitHub API returned 403). Likely MBs, since it includes the SQL dump. | 2001–2015, 19,722 models, including motorcycles, trucks, UTVs. Flat `{year, make, model}`. | Stale (ends 2015). Likely US-centric. Not recommended. |
| **car-models** (npm) | **GPL-2.0** | 26 KB | Model names only, from Wikipedia sales lists (2018) | GPL is a bad fit for app bundling, and there is no make hierarchy. Reject. |
| back4app Car Make Model | Page does not state a license | n/a | US makes 1992–2022, JSON via their platform | Requires an account; unclear license. Reject. |
| `car-makes-models`, `vehicle-makes-models` (npm) | n/a | n/a | Both 404 on the registry | Do not exist under those names. |

### 3.3 Recommendation: (c) hybrid curated list

Ship a hand-curated **`makes-models.es.json`** with about 60 makes and 15–40 models each. Seed the US-market names from abhionlyone (CC BY 4.0: add "Datos parciales: us-car-models-data, CC BY 4.0" in Acerca de). Then add the DR and LATAM models by hand:
- Hilux, Prado, Fortuner, Hiace, Rush, Vitz
- H-1/Grand Starex, Grand i10, Creta, Porter
- Picanto, K2700, Sportage, Sorento
- Swift, Vitara, Alto, Jimny
- Terios, Bego
- Frontier/NP300, Navara, Sentra, Versa, March
- L200, Montero, Montero Sport
- D-Max, MU-X
- 208, 2008, 3008, Partner
- C3, C4, Berlingo
- Gol, Amarok
- and so on.

Always offer **"Otro…"** with free text for both make and model.

```json
{ "v": 1, "updated": "2026-09",
  "makes": [
    { "id": "toyota", "name": "Toyota", "aliases": ["toyota"], "origin": "JP", "top": true,
      "models": ["Corolla","Camry","Yaris","Vitz","RAV4","Hilux","Land Cruiser","Land Cruiser Prado",
                 "4Runner","Fortuner","Rush","Hiace","Tacoma","Tundra","Highlander","C-HR","Prius","Corolla Cross"] },
    { "id": "citroen", "name": "Citroën", "aliases": ["citroen"], "origin": "FR", "top": false,
      "models": ["C3","C4","C-Elysée","C3 Aircross","C5 Aircross","Berlingo","Jumpy"] }
  ] }
```

Stored on the vehicle: `make_id TEXT NULL`, `make_text TEXT`, `model_text TEXT`, `year INTEGER`. The text copy survives dataset edits and holds "Otro" values.

**Size:** 60 makes × about 25 models × about 14 bytes, plus overhead, is **about 25–35 KB raw and about 8–10 KB gzip/brotli**. For comparison, per-year model lists like abhionlyone's run about 470 KB raw. That is negligible for the APK and for Metro's web bundle, so the list can be imported statically (no lazy loading needed).

**Search:** normalise with `s.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase()`. Match against the name and aliases ("vw", "mercedes", "benz", "chevy"), and sort `top` makes first. Implement with `FlatList` + `TextInput`, which works on native and web.

**Years:** generate `currentYear+1` down to 1950. No dataset is needed.

Cross-platform detail: skip model-year filtering. The DR used-import market makes year-specific model lists more annoying than useful.

---

## 4. Reference lists to bundle (all from knowledge unless noted)

### 4.1 Body types, about 1 KB

```json
[{"id":"sedan","es":"Sedán"},{"id":"hatchback","es":"Hatchback"},{"id":"coupe","es":"Coupé"},
 {"id":"convertible","es":"Convertible"},{"id":"wagon","es":"Familiar (wagon)"},
 {"id":"suv","es":"SUV / Jeepeta"},{"id":"pickup","es":"Pickup / Camioneta"},
 {"id":"minivan","es":"Minivan"},{"id":"van","es":"Van / Guagua"},{"id":"truck","es":"Camión"},
 {"id":"motorcycle","es":"Motor / Motocicleta"},{"id":"utv","es":"Buggy / UTV / Four-wheel"},{"id":"other","es":"Otro"}]
```

Note on DR usage (**unverified, from knowledge**): "jeepeta" means an SUV, and "guagua" usually means a van or minibus, which is why it sits with the van. abhionlyone's `body_styles` column (Sedan, SUV, Coupe, …) can pre-fill the body type when a model is chosen.

### 4.2 Exterior colors, about 1.5 KB

```json
[{"id":"blanco","es":"Blanco","hex":"#F5F5F5"},{"id":"negro","es":"Negro","hex":"#111111"},
 {"id":"gris","es":"Gris","hex":"#6B6E70"},{"id":"plateado","es":"Plateado","hex":"#C0C4C8"},
 {"id":"rojo","es":"Rojo","hex":"#B3131B"},{"id":"azul","es":"Azul","hex":"#1F5FBF"},
 {"id":"azul_marino","es":"Azul marino","hex":"#1B2A4A"},{"id":"verde","es":"Verde","hex":"#2E7D32"},
 {"id":"amarillo","es":"Amarillo","hex":"#F2C200"},{"id":"naranja","es":"Naranja","hex":"#E86A10"},
 {"id":"marron","es":"Marrón / Café","hex":"#5D4037"},{"id":"beige","es":"Beige","hex":"#D8C8A8"},
 {"id":"dorado","es":"Dorado","hex":"#B8952E"},{"id":"vino","es":"Vino / Burdeos","hex":"#6D1A2A"},
 {"id":"morado","es":"Morado","hex":"#5E3A8C"},{"id":"rosado","es":"Rosado","hex":"#E68FAC"},
 {"id":"turquesa","es":"Turquesa","hex":"#1AA7A1"},{"id":"crema","es":"Crema","hex":"#F1E6C8"},
 {"id":"otro","es":"Otro","hex":null}]
```

Draw a 1 px border around the light swatches (blanco, crema) so they show in light mode. Optional `finish`: sólido, metálico, perlado, mate.

**Interior** is a separate field: `interior_color` (negro, gris, beige, crema, marrón, rojo, blanco, azul) plus `interior_material` (tela, cuero, piel sintética, vinil, alcántara). "Beige tela" is then color = beige with material = tela.

### 4.3 Engine oil, about 2 KB

- **SAE J300 grades (verified, Wikipedia):**
  - Winter grades: 0W, 5W, 10W, 15W, 20W, 25W.
  - Non-winter grades: 8, 12, 16, 20, 30, 40, 50, 60. Grade 16 was added in 2013; 8 and 12 in 2015.
- **Picker list (multigrades as sold):** 0W-8, 0W-12, 0W-16, 0W-20, 0W-30, 0W-40, 5W-20, 5W-30, 5W-40, 10W-30, 10W-40, 15W-40, 15W-50, 20W-50, plus straight SAE 30, SAE 40, and "Otro".
- **Types:** mineral (convencional), semisintético, sintético, and alto kilometraje as an optional flag.
- **Specs** (verified list in Wikipedia's Motor oil article):
  - API SP / SN / SN Plus / SM / SL for gasoline.
  - API CK-4 / CJ-4 / CI-4 / FA-4 for diesel.
  - ILSAC GF-6A and GF-6B. GF-6B is for 0W-16.
  - ACEA A3/B3, A3/B4, A5/B5, C1–C6, E-series.
  - **Unverified (from knowledge):** API SQ and ILSAC GF-7 (2025) are newer; plus OEM approvals such as VW 504.00/507.00, MB 229.5, dexos1 Gen 3.
  - Store specs as free-text tags plus suggestions.
- **Brands:** Castrol, Mobil 1 / Mobil, Shell Helix, Valvoline, TotalEnergies, Motul, Liqui Moly, Pennzoil, Havoline, AMSOIL, plus OEM (Toyota Genuine, Honda, Mopar, ACDelco), "Otro". Presence in DR is **unverified (from knowledge)**.

```json
{"grades":["0W-8","0W-16","0W-20","5W-30","..."],"types":[{"id":"mineral","es":"Mineral"},{"id":"semi","es":"Semisintético"},{"id":"synthetic","es":"Sintético"}],
 "specs":["API SP","API SN Plus","ILSAC GF-6A","ACEA C3","..."],"brands":["Castrol","Mobil 1","..."]}
```

### 4.4 Other fluids (brief, about 2 KB, all unverified from knowledge)

- **ATF:**
  - Generic: Dexron III/VI, Mercon V/LV.
  - Toyota: ATF WS / T-IV.
  - Honda: ATF DW-1 / Z1.
  - Nissan: Matic S/J.
  - Mitsubishi / Hyundai-Kia: SP-III, SP-IV.
  - Multi-vehicle ATF, DCT fluid.
- **CVT:** Nissan NS-2/NS-3, Toyota CVT FE / TC, Honda HCF-2, Subaru CVTF.
- **Manual/differential:** 75W-90 or 80W-90, GL-4 vs GL-5.
- **Coolant technologies:** IAT (usually green), OAT (orange, Dexcool), HOAT (yellow; Ford/Chrysler), P-HOAT (Asian; Toyota SLLC pink, Honda Type 2 blue), Si-OAT (VW G13 purple).
  - Store the technology plus a free-text brand. **Color is not a standard**; the UI should say so.
  - Mix option: 50/50 premezclado vs concentrado.
- **Brake fluid:** DOT 3, DOT 4, DOT 5.1 (glycol) and DOT 5 (silicone, incompatible with the others).
- **Power steering:** ATF or PSF.

### Bundle totals

| File | Est. raw size |
|---|---|
| Makes/models | 25–35 KB |
| Body types | ~1 KB |
| Colors (exterior + interior) | ~2 KB |
| Oil | ~2 KB |
| Fluids | ~2 KB |
| **Total** | **~35–45 KB raw (~12–15 KB compressed)** |

Keep all files under `src/data/reference/*.json` with a `v` field so SQLite rows can reference stable `id`s.

---

## Sources (actually fetched)

- https://www.fuelly.com/faq (question titles only; answer URLs 404)
- https://fuel.io/faq.html
- https://fuel.io/faq_fuel_consumption.html
- https://www.drivvo.com/en/faq and https://www.drivvo.com/en/faq/ (question titles only)
- https://vpic.nhtsa.dot.gov/api/
- https://vpic.nhtsa.dot.gov/api/vehicles/GetAllMakes?format=json
- https://vpic.nhtsa.dot.gov/api/vehicles/GetMakesForVehicleType/car?format=json
- https://vpic.nhtsa.dot.gov/api/vehicles/GetModelsForMake/toyota?format=json
- https://vpic.nhtsa.dot.gov/api/vehicles/GetModelsForMake/peugeot?format=json
- https://vpic.nhtsa.dot.gov/api/vehicles/GetModelsForMake/citroen?format=json
- https://vpic.nhtsa.dot.gov/api/vehicles/GetModelsForMake/daihatsu?format=json
- https://vpic.nhtsa.dot.gov/api/vehicles/GetModelsForMake/hyundai?format=json
- https://github.com/abhionlyone/us-car-models-data
- https://api.github.com/repos/abhionlyone/us-car-models-data/contents/
- https://raw.githubusercontent.com/abhionlyone/us-car-models-data/master/LICENSE
- https://raw.githubusercontent.com/abhionlyone/us-car-models-data/master/2018.csv
- https://github.com/arthurkao/vehicle-make-model-data
- https://raw.githubusercontent.com/arthurkao/vehicle-make-model-data/master/README.md
- https://registry.npmjs.org/car-models
- https://www.back4app.com/database/back4app/car-make-model-dataset
- https://en.wikipedia.org/wiki/Motor_oil
- https://en.wikipedia.org/wiki/SAE_J300
- https://en.wikipedia.org/wiki/Gallon

Failed: fuelio.zendesk.com (404), fuelly partial-fuel-up answer pages (404), npm `car-makes-models` and `vehicle-makes-models` (404), arthurkao GitHub contents API (403).
