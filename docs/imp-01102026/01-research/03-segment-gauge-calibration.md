# 03 · Segment gauges and learned fuel-level calibration (Car Guy)

> Scope: a per-vehicle gauge type (needle in eighths, N segments, or digital %), plus a calibration the app **learns** from full tanks. With it the app can turn "4 cuadros" into liters and km.
> Sources: Wikipedia *Fuel gauge* (fetched 2026-10-01; facts marked **[W]**). Everything else marked **[K]** comes from general automotive knowledge and was not verified online (no web search was available). All maths was worked out here, and the worked example was **run** as a TypeScript prototype under Node 22. Every number below comes from that run.
> Baseline: this builds on the economy estimator in `imps 29092026/01-research/02-fuel-partial-and-datasets.md` §1.5–1.9. That covers the columns `gauge_before_eighths`, `gauge_after_eighths` and `in_reserve`, `vehicle.reserve_volume_l` (default 10 % C), and the per-reading half-width `C/16 + nonlinK·C` with F mapped to 15/16·C. This report generalises it without changing its contract.

---

## 1. How fuel gauges actually behave

**Sender.** In most cars, a float on an arm moves a wiper along a resistor. Modern senders use printed-ink resistors. As the tank empties, the float drops and the resistance changes. The same resistance threshold often switches the low-fuel light **[W]**. Wikipedia also says OEM gauges "are not designed for high-precision measurement" and can be inaccurate because of terrain and the irregular shape of the tank **[W]**.

**Why a linear map is wrong [K]:**

- **Tank geometry.** Tanks are moulded around the exhaust, the subframe and the spare-wheel well. Liters per centimetre of float travel is far from constant: tanks are usually wider in the middle and narrow and stepped at the top and bottom. A float arm also sweeps an arc, so its vertical travel is not proportional to wiper angle. Manufacturers shape the resistor track to compensate, but only roughly.
- **Stays on F for 50–100 km.** At the top, the float reaches its upper stop while the filler neck and the dome above the stop still hold fuel. Many clusters also bias the display towards F on purpose. The first "eighth" or bar therefore covers more liters than its share. On a 45 L tank at about 17 km/L, one ninth (5 L) is already about 85 km. Add the neck and the stop, and 100 km on F is normal.
- **The bottom is skewed too.** The float bottoms out before the pickup sucks air, and makers keep a buffer below "E". The sock pickup and the fuel pump need to stay submerged. Two patterns are common:
  - The last eighth or segment holds more liters than the others, because E is set high on purpose.
  - The last segment is short and the reserve light covers the rest.

  The reserve light usually comes on at **about 5–8 L or 10–15 % of capacity**. On segment clusters that is typically when **1 bar remains** or when **the last bar disappears**, and some clusters blink or hide the last bar once the light is on.
- **Damping.** Analog needles use bimetal or air-core movements with slow response. Digital clusters low-pass filter the sender signal heavily, with time constants of tens of seconds or more, so slosh in corners and on hills doesn't show. Many clusters also refuse to show an *increase* until the ignition is cycled, to stop the gauge creeping up on a slope.
- **Hysteresis and quantisation (bar gauges).** A bar display is a quantiser with hysteresis. Bar *k* turns off when the filtered level drops below threshold *t_k*, and comes back only above *t_k + δ*. A displayed "4 of 9" therefore means "the level is somewhere in an interval", and the interval widths are not equal. Parked on a slope, the same fuel can show ±1 bar.

**Conclusion.** The display reading is a **monotone but non-linear, vehicle-specific, interval-valued** function of liters in the tank. Any fixed linear map (`liters = C·k/N`) has a systematic error of up to about 10 % of C, which is about ±4.5 L on a 45 L tank. That error is larger than the resolution error. The right model is a **monotone mapping learned per vehicle**: never decreasing, anchored at full, and pulled from a linear prior towards what this car's fills show.

## 2. Data model

### 2.1 Vehicle

| Column | Type | Meaning |
|---|---|---|
| `gauge_type` | TEXT NOT NULL DEFAULT `'needle8'` CHECK IN (`'needle8'`,`'segments'`,`'percent'`) | How the dash shows fuel |
| `gauge_segments` | INTEGER NULL CHECK BETWEEN 3 AND 20 | N for `segments`; NULL otherwise. The DS3 has 9 |
| `gauge_reserve_at` | INTEGER NULL | Segments still lit when the reserve light comes on: `1`, or `0` for "when the last one disappears". NULL means unknown. For `needle8` it is in eighths; for `percent` it is in % |
| `gauge_calibration_reset_at` | TEXT NULL (ISO) | Logs before this date are ignored by calibration (§7) |

The existing `tank_volume` (liters since v6) and `reserve_volume_l` (NULL means 10 % C) stay as they are.

### 2.2 Fuel log: unit-less fraction plus raw reading

| Column | Type | Meaning |
|---|---|---|
| `gauge_scale` | INTEGER NULL | Denominator in force **when the reading was taken**: 8, N, or 100 |
| `gauge_before_raw` / `gauge_after_raw` | INTEGER NULL | e.g. 4 (of 9), 3 (of 8), 45 (%) |
| `gauge_before` / `gauge_after` | REAL NULL CHECK BETWEEN 0 AND 1 | `raw / scale`. All maths reads only this |
| `in_reserve` | (exists) | "Solo la luz de reserva" applies to the before reading |

Storing `gauge_scale` on the log matters. If the owner later corrects the vehicle from "needle" to "9 segments", old readings are still interpretable, and the calibration knows they came from a different grid (§3.4).

### 2.3 Migration (next local schema version, plus an additive Supabase file)

```sql
-- SQLite (expo-sqlite, PRAGMA user_version bump)
ALTER TABLE vehicle ADD COLUMN gauge_type TEXT NOT NULL DEFAULT 'needle8';
ALTER TABLE vehicle ADD COLUMN gauge_segments INTEGER;
ALTER TABLE vehicle ADD COLUMN gauge_reserve_at INTEGER;
ALTER TABLE vehicle ADD COLUMN gauge_calibration_reset_at TEXT;
ALTER TABLE fuel_log ADD COLUMN gauge_scale INTEGER;
ALTER TABLE fuel_log ADD COLUMN gauge_before_raw INTEGER;
ALTER TABLE fuel_log ADD COLUMN gauge_after_raw INTEGER;
ALTER TABLE fuel_log ADD COLUMN gauge_before REAL;
ALTER TABLE fuel_log ADD COLUMN gauge_after REAL;
UPDATE fuel_log SET gauge_scale = 8,
  gauge_before_raw = gauge_before_eighths, gauge_before = gauge_before_eighths / 8.0,
  gauge_after_raw  = gauge_after_eighths,  gauge_after  = gauge_after_eighths  / 8.0
WHERE gauge_before_eighths IS NOT NULL OR gauge_after_eighths IS NOT NULL;
```

- **Validation.** Enforce the value checks (`gauge_type` enum, N 3–20, fraction 0–1) in the repo layer and in `lib/domain/gauge.ts`. `ALTER … ADD COLUMN` checks are not applied to existing rows in all SQLite builds.
- **Keep `gauge_*_eighths`.** The x-core constraint is additive-only, and pre-update clients still sync. When `gauge_scale = 8`, the repo **dual-writes** the eighths columns. Otherwise it writes them NULL, so an old client sees "no gauge data" and degrades to brim-to-brim, which is correct.
- **Supabase** (`carguy` schema, next `sql/0xx`). Add the same columns: `gauge_before numeric(6,5) check (gauge_before between 0 and 1)`, smallint raws and scale, and the vehicle columns with the same checks. Same RLS, no new policies. LWW sync carries them like any column.

## 3. Calibration from full tanks

### 3.1 Grid and observations

The grid size is `G = 8` (needle), `N` (segments) or `20` (percent, binned to 5 %). A reading maps to `k = round(fraction·G)`. The aim is to learn `f(k)`, the expected liters in the tank when the dash shows `k`, with `f(G) = C` (brim).

1. **Full fill with a before reading** (`is_full`, not `missed_previous`, `k_before < G`). This gives a **point observation** `f(k_before) ≈ C − L`, clamped at ≥ 0, with weight 1.
   - **"F is not full" tolerance.** Click-off vs topping off, and the filler neck, give about ±0.5–1.5 L of brim noise **[K]**. This noise ends up in the residual band; nothing extra is modelled.
   - **`L > C + 1`.** Raise the warning `over_capacity` and keep the point at y = 0. After two such fills, suggest "Tu tanque parece de ≈ *max L* L — ¿corregir?"
2. **Partial fill with before *b* and after *a*.** This gives a **difference constraint** `f(a) − f(b) = L`. It has no absolute level, so it is turned into two half-weight pseudo-observations against the current fit, `f(b) ≈ f̂(a) − L` and `f(a) ≈ f̂(b) + L`, and refit. Three backfitting passes are deterministic and enough.
3. **Full fill on "Solo la luz de reserva".** This gives `C − L` as a sample of *the level at which you refill on reserve*. Its median replaces `reserve_volume_l·0.75` as the reserve-state estimate once there are 2 or more samples. Their max is a lower bound for the configured reserve.

Observations accumulate over the vehicle's life, from `gauge_calibration_reset_at` onwards. The calibration is a **pure function recomputed on every fuel-log insert, update or delete**. It costs O(logs + G) and is never stored, just like the economy points.

### 3.2 Estimator: shrunk residuals, then isotonic regression

1. **Prior `p_k`.** Piecewise-linear through (0, 0), then (`reserve_at`, `reserveL`) if known, then (G, C). If `reserve_at = 0`, the first knot becomes (0, reserveL/2).
2. **Per-cell residual, shrunk.** `ρ_k = Σw(y − p_k) / (Σw + κ)`. This is the n/(n+κ) blend between the cell mean and the prior. Default **κ = 0.5**: one fill moves a cell 2/3 of the way to the data, and two fills move it 4/5.
3. **Cells without data** interpolate ρ linearly between their neighbours. The anchors are ρ_G = 0 (fixed) and ρ_0 = 0 (soft). This way one observation at 3/9 also lifts 2/9 and 4/9 instead of leaving a kink.
4. **Monotone fit.** `z_k = p_k + ρ_k`, with weights `W_k = Σw + κ`, and `W_G = 10⁶` as the hard anchor. Then **PAV** gives a non-decreasing `f`, which is then clamped to [0, C] with `f(G) = C`.
5. **Band.** Pooled residual variance with a prior: `σ̂² = (ν₀σ₀² + Σw·e²)/(ν₀ + Σw)`, where `σ₀ = C/(2G)` (resolution) and `ν₀ = 2`. Per cell, `band_k = max(C/(4G), σ̂·√(1 + 1/W_k))`, i.e. prediction-style: wider where data is thin.

**Status** (shown in the UI):

| Status | Condition | Message |
|---|---|---|
| `linear` | 0 usable full fills with a before reading | "Estimación lineal — llena el tanque 2 veces marcando el nivel para afinar" |
| `learning` | 1 usable fill, or all at the same reading | "Aprendiendo tu medidor — 1 de 2 llenadas (márcala con otro nivel)" |
| `learned` | ≥ 2 usable full fills at ≥ 2 distinct readings < G | "Medidor aprendido · N llenadas" |

When the status is `linear`, the band stays at the legacy `C/(2G) + nonlinK·C`, so it is honest about non-linearity. The calibration table is still returned.

### 3.3 TypeScript: `lib/domain/gaugeCalibration.ts` (core)

```ts
/** Pool Adjacent Violators: weighted least-squares non-decreasing fit. O(n). */
export function pav(y: number[], w: number[]): number[] {
  const n = y.length;
  if (n !== w.length) throw new Error('pav: length mismatch');
  const val: number[] = [], wt: number[] = [], len: number[] = [];
  for (let i = 0; i < n; i++) {
    if (!(w[i] > 0)) throw new Error('pav: weights must be > 0');
    val.push(y[i]); wt.push(w[i]); len.push(1);
    while (val.length > 1 && val[val.length - 2] > val[val.length - 1]) {
      const b = val.length - 1, a = b - 1, W = wt[a] + wt[b];
      val[a] = (val[a] * wt[a] + val[b] * wt[b]) / W;
      wt[a] = W; len[a] += len[b];
      val.pop(); wt.pop(); len.pop();
    }
  }
  const out: number[] = [];
  for (let j = 0; j < val.length; j++) for (let k = 0; k < len[j]; k++) out.push(val[j]);
  return out;
}

type FullObs = { before: number; addedL: number };            // grid index, liters
type PartialObs = { before: number; after: number; addedL: number };
export function calibrate(G: number, C: number, full: FullObs[], partial: PartialObs[],
  opts: { kappa?: number; reserveAt?: number | null; reserveL?: number; iters?: number } = {}) {
  const kappa = opts.kappa ?? 0.5, iters = opts.iters ?? 3, resL = opts.reserveL ?? 0.1 * C;
  const knots: [number, number][] = [[0, opts.reserveAt === 0 ? resL / 2 : 0]];
  if (opts.reserveAt != null && opts.reserveAt > 0 && opts.reserveAt < G) knots.push([opts.reserveAt, resL]);
  knots.push([G, C]);
  const prior = Array.from({ length: G + 1 }, (_, k) => {
    for (let j = 1; j < knots.length; j++) {
      const [x0, y0] = knots[j - 1], [x1, y1] = knots[j];
      if (k <= x1) return y0 + (y1 - y0) * (k - x0) / (x1 - x0);
    }
    return C;
  });
  const pts = full.filter(o => o.before < G).map(o => ({ x: o.before, y: Math.max(0, C - o.addedL), w: 1 }));
  const fit = (extra: { x: number; y: number; w: number }[]) => {
    const sw = new Array(G + 1).fill(0), swr = new Array(G + 1).fill(0);
    for (const p of [...pts, ...extra]) { sw[p.x] += p.w; swr[p.x] += p.w * (p.y - prior[p.x]); }
    const rho: (number | null)[] = sw.map((s, k) => (s > 0 ? swr[k] / (s + kappa) : null));
    rho[G] = 0; if (rho[0] == null) rho[0] = 0;
    for (let k = 1; k < G; k++) if (rho[k] == null) {          // interpolate empty cells
      let a = k - 1; while (rho[a] == null) a--;
      let b = k + 1; while (rho[b] == null) b++;
      rho[k] = rho[a]! + (rho[b]! - rho[a]!) * (k - a) / (b - a);
    }
    const z = prior.map((p, k) => p + rho[k]!);
    const W = sw.map(s => s + kappa); W[G] = 1e6;
    const f = pav(z, W).map(v => Math.min(C, Math.max(0, v))); f[G] = C;
    return { f, z, W };
  };
  let res = fit([]);
  for (let it = 0; it < iters && partial.length; it++) {
    res = fit(partial.flatMap(p => [
      { x: p.before, y: Math.max(0, res.f[p.after] - p.addedL), w: 0.5 },
      { x: p.after, y: Math.min(C, res.f[p.before] + p.addedL), w: 0.5 },
    ]).filter(e => e.x < G));
  }
  const sigma0 = C / (2 * G), nu0 = 2;
  let ssr = 0, swt = 0;
  for (const p of pts) { ssr += p.w * (p.y - res.f[p.x]) ** 2; swt += p.w; }
  const s2 = (nu0 * sigma0 ** 2 + ssr) / (nu0 + swt);
  const band = res.W.map((Wk, k) => (k === G ? 0.5 : Math.max(C / (4 * G), Math.sqrt(s2 * (1 + 1 / Wk)))));
  return { prior, ...res, band, sigma: Math.sqrt(s2) };
}
```

The public wrapper `calibrateVehicle(vehicle, logs)` does four things:
- maps logs to grid indices through `lib/domain/gauge.ts`;
- applies the reset date and the rise/F filters from §7;
- computes `status` and the reserve-state estimate;
- returns `{ table: {k, liters, band}[], status, nFull, sigma }`.

### 3.4 Worked example: C = 45 L, N = 9, κ = 0.5, `reserve_at` unknown

The observations are:

- **Fulls:** 3/9 + 28 L → 17 L in the tank; 5/9 + 19 L → 26 L; 1/9 + 36 L → 9 L.
- **Partial:** 2/9 → 6/9 with 18 L.

The prior is 5 L per segment.

| k | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
|---|---|---|---|---|---|---|---|---|---|---|
| prior | 0 | 5 | 10 | 15 | 20 | 25 | 30 | 35 | 40 | 45 |
| ρ (after 3 passes) | 0 | +2.67 | +0.81 | +1.33 | +1.00 | +0.67 | −0.50 | −0.33 | −0.17 | 0 |
| **f (L)** | 0 | **7.67** | **10.81** | **16.33** | **21.00** | **25.67** | **29.50** | **34.67** | **39.83** | 45 |
| ± band | 2.98 | 2.22 | 2.44 | 2.22 | 2.98 | 2.22 | 2.44 | 2.98 | 2.98 | 0.5 |

- Pooled σ̂ = 1.72 L.
- Without the partial, f(2) = 12.00 and f(6) = 30.50. The partial (which says f(6) − f(2) = 18) pulls them to 10.81 and 29.50, a difference of 18.69. It is a half-weight compromise against the full-tank evidence, as intended.
- The data says this car reads **low in the bottom half**, by about +2.7 L at 1/9. This matches the "E is set high" pattern.
- **PAV in action:** fulls at 3/9 + 22 L and 4/9 + 30 L would say 23 L at 3 and 15 L at 4. Here z₃ = 20.33 > z₄ = 16.67, so PAV pools both to **18.50**.

### 3.5 Tests: `__tests__/domain/gaugeCalibration.test.ts`

All of these pass in the prototype:

- **PAV.**
  - `pav([1,2,3],[1,1,1])` returns its input unchanged.
  - `pav([1,3,2,4,3.5,5], ones)` → `[1,2.5,2.5,3.75,3.75,5]`.
  - `pav([10,4,6],[1,2,1])` → `[6,6,6]`.
  - `pav([3,2,1], ones)` → `[2,2,2]`.
  - Mismatched lengths or a weight ≤ 0 throws.
- **Worked example.**
  - The `f` row above, to ±0.01.
  - Monotone everywhere.
  - `f[6] − f[2] = 18.69`.
  - `band[4] = 2.98`, `σ = 1.72`.
- **Violation.** The 22 L / 30 L case gives `f[3] = f[4] = 18.50`.
- **Status.**
  - `[]` and `[{before: 9}]` → `linear`.
  - `[{before: 3}]` → `learning`.
  - `[{before: 3}, {before: 3}]` → `learning`.
  - `[{before: 3}, {before: 5}]` → `learned`.
- **Prior.**
  - `reserveAt 1, reserveL 6` → f₀..₂ = 0, 6.00, 10.88.
  - `reserveAt 0, reserveL 6` → f₀ = 3.00.
- **Regression.** No gauge data gives the same measured spans as before. The existing §1.9 example (eighths) gives the same numbers with `gauge_scale = 8`, status `linear`.

## 4. Liters and km remaining

```ts
export function remaining(litersMid: number, band: number, kpl: number | null, rel: number,
  reserveL: number, onReserve: boolean) {
  let lo = Math.max(0, litersMid - band), hi = litersMid + band;
  if (onReserve) { lo = reserveL / 2; hi = reserveL; }        // light on ⇒ liters ≤ reserveL
  if (kpl == null) return { lo, hi, kmLo: null, kmHi: null };
  return { lo, hi, kmLo: Math.floor(lo * kpl * (1 - rel) / 10) * 10,
                   kmHi: Math.ceil(hi * kpl * (1 + rel) / 10) * 10 };
}
```

**Recent km/L.** Use the last 3 `measured` spans, distance-weighted, i.e. `ΣD/ΣL`. The relative band is the distance-weighted SD of the spans' km/L divided by the mean, with a floor of 5 %. Fall back to the vehicle's lifetime average. With neither, show liters only.

**Example.** Spans of 600 km/34 L, 420/24 and 510/29 give 17.59 km/L, ±5 % (the floor). Results:

| Reading | Liters | Range |
|---|---|---|
| 4/9, learned | 21 L (18–24) | **≈ 370 km (300–450)** |
| 4/9, linear | 20 ± 3.85 L | 260–450 km |
| Light on (reserveL 4.5) | 2–4.5 L | **≈ 30–90 km** |

The learned range is narrower than the linear one, and it tightens as σ̂ shrinks with more fills. With 3 fills it is still about ±3 L, and the app should say so rather than print "390 km". Display rule: liters rounded to 1 L, km rounded to 10, and always "≈" plus a range.

**Where it is shown:**

- **Fill-up form.** After a reading is chosen: "≈ 21 L en el tanque (18–24)". Also show `liters + added` vs C as a sanity line: "quedaría ≈ 39 L de 45".
- **Vehicle hub.** "Tanque: 4/9 ≈ 21 L · ≈ 370 km". The value comes from the last log's after-level (C if full, else the §6 combined after-level), minus `km_since/kpl`, where `km_since` is the latest odometer from any source (fuel, trip, odometer entry). The band grows as `√(b² + (km_since/kpl·rel)²)`. The displayed segments come from inverting `f` ("≈ 3/9 ahora").
  - Show "desde la última echada" with the date.
  - Hide the km estimate if the last log is more than 14 days old or the estimate goes below 0. Show "Registra una echada para estimar".
- **Cluster fuel telltale** (Inicio):
  - **Amber** at ≤ 2 segments, or ≤ 2/8 (needle), or ≤ 20 % (percent).
  - **Red** when the last log is `in_reserve`, when the estimated `hi` is ≤ reserveL, or when estimated k is ≤ `reserve_at`.
  - Off otherwise.

## 5. UI picker (`components/fuel/GaugePicker.tsx`, maths in `lib/domain/gauge.ts`)

- **`segments`.** Draw N rounded squares in a row:
  - Square width `min(28, (W − 4(N−1))/N)`. At N = 20 on a 343 px row that is about 13 px; still tappable because the whole row is the hit area.
  - Filled squares use amber `#FFB300`, empty ones are outlined, and **the lowest one is always JDM red** (filled or outline).
  - Tap square *i* to set *i*. Tapping the current top square again sets *i − 1*, so 0 is reachable. Drag horizontally: `k = clamp(round(x/W·N), 0, N)`.
  - Haptic tick per step (`expo-haptics`), and a caption "4 de 9".
- **`needle8`.** Keep the existing arc with `E · 1/8 … 7/8 · F`.
- **`percent`.** A slider in 5 % steps (snap `round(p/5)·5`), with an LCD readout "45 %".
- **"Solo la luz de reserva" chip** for all types. It sets `in_reserve = 1` and greys the picker.
- **Accessibility.** `accessibilityRole="adjustable"`, `accessibilityValue {min:0, max:N, now:k, text:"4 de 9 cuadros"}`, and increment/decrement actions.
- **Vehicle form: "¿Cómo marca la gasolina tu carro?"**
  - Three illustrated chips: **Aguja** (mini arc), **Cuadritos / barras** (mini squares), **Porcentaje** ("45 %").
  - For segments: a stepper "Cuántos cuadros tiene" (3–20, default 8) with a **live preview** of the squares.
  - Then "¿Cuándo se prende la luz de reserva?" with options: *Queda 1 cuadro* / *Al apagarse el último* / *No sé* (NULL).
  - Show a hint: "Cuenta los cuadros con el tanque lleno."
- **`gauge.ts` API:**
  - `gridSize(cfg)`
  - `toFraction(raw, scale)`, `toGrid(fraction, G)`
  - `snapPercent(p)`, `hitTestSegment(x, width, N)`
  - `formatReading(raw, cfg)`: "4/9", "3/8", "45 %"
  - `validateGaugeCfg(cfg)`
  - `amberThreshold(cfg)`

  Tests in `__tests__/domain/gauge.test.ts`: `3/8 → 0.375 → toGrid(·, 9) = 3`; `hitTestSegment(0.47·W, W, 9) = 4`; `snapPercent(47) = 45`; N = 2 or 21 rejected.

## 6. Partial-fill economy with fractions

The existing `computeEconomy` keeps its shape. Only `levelBefore` and `levelAfter` change source:

- **Level from a reading.**
  - Linear (status `linear`): `C·fraction`, half-width `C/(2G) + nonlinK·C`.
    - Needle: this is exactly today's `C/16 + nonlinK·C`.
    - DS3 with 9 segments: 2.50 + 1.35 = ±3.85 L.
    - Percent (G = 20): ±1.125 L + nonlin.
  - Learned/learning: `f(k)` from the table, half-width `band_k`. `nonlinK` is dropped, because the residuals already contain non-linearity.
- **"F" without `is_full`.** Generalises "F = 15/16·C" to `C·(1 − 1/(2G)) ± C/(2G)`.
- **Reserve.** Uses the learned reserve-state median when there are 2 or more samples, otherwise `reserveL ± reserveL/2`.
- **Unchanged:** inverse-variance combination of after-levels, `gauge_pump_mismatch`, classification, measured spans, and **reconciliation** (r_j = e_j − D·σ_j²/Σσ²).
- **Honest caveat.** The calibration is learned from the same logs it later evaluates. For display that is acceptable: measured spans still fix the totals, and reconciliation redistributes within them. Expect estimated points to shift slightly as the gauge is learned. They are derived, never stored.

## 7. Edge cases

1. **Reading at F without `is_full`.**
   - Not a calibration point: F is a plateau, so it says little.
   - For economy, use the §6 rule.
   - If `L` puts the level above C, raise `over_capacity`.
2. **Reading rises without a fill.** If the next before reading is more than **1 grid step** above the previous after reading, flag `gauge_rise`.
   - Likely causes: a slope, damping, or the wrong square tapped.
   - Exclude that before-reading from calibration (weight 0), and offer "¿Corregir lectura?" on the log detail.
   - A rise of 1 step is tolerated (hysteresis or slope).
3. **Clusters that hide or blink the last bar with the light on.** Set `reserve_at = 0`. "Solo la luz de reserva" then means 0 bars and level ≤ reserveL. A reading of 0 without the light is allowed, and calibration learns it like any cell.
4. **Gauge config changed** (type or N). Old readings convert through their own `gauge_scale` → fraction → new grid at **weight 0.5**. No reset is needed, because the user was probably correcting a wrong setup.
5. **Tank capacity changed** (mod, aux tank) or **sender replaced.** Changing `tank_volume` by more than 2 L asks "¿Reiniciar el aprendizaje del medidor?" and sets `gauge_calibration_reset_at = now`. A "Reiniciar calibración" action in the vehicle's fuel settings does the same.
6. **GNV (m³) or electric.** The gauge-calibration UI is hidden and `calibrate` is never called. Economy is unaffected.
7. **`missed_previous`.** That fill can't anchor economy spans, but it is **still a valid calibration point**. `C − L` doesn't depend on history. Keep it.
8. **Very large N (12–20).** Few fills per cell, so interpolation of ρ and κ do most of the work. That is fine, and the band stays honest.
9. **Sharing calibration across owners of the same model** (e.g. every DS3 with 9 bars). **Not now.** In future, an opt-in, anonymised per-model prior `p_k` would replace the linear prior, with the same shrinkage. It needs a server aggregate and consent copy, so it goes on the roadmap only.

## 8. Files

- `lib/domain/gauge.ts`: types (`GaugeType`, `GaugeCfg`, `GaugeReading`), fractions and grid, picker maths, formatting, thresholds.
- `lib/domain/gaugeCalibration.ts`: `pav`, `calibrate`, `calibrateVehicle`, `status`, `remaining`, `tankNow` (hub decay), `recentKmPerL`.
- `lib/domain/economy.ts`: `levelFromReading(fraction, cfg, calibration?)` replaces the eighths lookup.
- `__tests__/domain/gauge.test.ts` and `__tests__/domain/gaugeCalibration.test.ts`, with the cases in §3.5 and §5.
- Migration: the next `PRAGMA user_version`, plus an additive Supabase `sql/0xx`.
