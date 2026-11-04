# Speed: before and after (PROMPT-10, SPEC-I, ADR-72)

Reproduce: `npx jest __tests__/trips/speed-replay.test.ts` prints both tables. The drives are **synthetic with ground truth** (`__tests__/helpers/speed/simDrive.ts`: a speed profile along a curving road; position errors that drift from fix to fix; Doppler noise; the platform quirks), averaged over three seeds. They prove the *method* on known inputs. They do **not** prove it on a real phone in a real car: that is the calibration drive in `docs/CALIBRATION-DRIVE.md`.

Metrics (km/h unless noted): RMSE of the needle against the true speed in steady / accelerating / braking phases; error of the live max and of the saved max against the true top speed; the gap between the live and the saved max (they must be the same number); distance error in %; seconds the needle is late at the midpoint of a 6 m/s² brake.

## I0 confirmed (with the old code)
| Claim | Evidence |
|---|---|
| The live max and the saved max are two different numbers | urban canyon: gap **27.0 km/h**; Android "0 while moving": gap **5.2 km/h** (the live max was the max of an EMA-smoothed value, the saved max a median of reported speeds) |
| Android "speed 0 while moving" loses almost half the distance | **45.5 %** short: `segmentDistance` read the reported 0 as "parked jitter" |
| An urban canyon (30–60 m noise) inflates distance | **45.5 %** too long, live top speed **27.7 km/h** off |
| The needle lags: fixed EMA α = 0.35 ≈ 3 s at 1 Hz | highway accelerating RMSE **5.8**, braking **4.2**; a 6 m/s² brake is followed **1.9 s** late |
| The web / iPhone (no Doppler) pair difference is noisy | steady RMSE **2.4–5.0**, top speed **7–8.5 km/h** off |

## OLD pipeline
| Case | RMSE steady | RMSE accel | RMSE brake | Top (live) err | Top (saved) err | live↔saved gap | Distance err % | Brake lag s |
|---|---|---|---|---|---|---|---|---|
| Highway cruise, 1 Hz, Doppler | 0.3 | 5.8 | 4.2 | 0.7 | 0.9 | 0.2 | 0.25 | – |
| Highway cruise, 0.2 Hz, Doppler | 4.3 | 19.9 | 13.1 | 0.4 | 0.6 | 0.2 | 0.19 | – |
| City stop-go, 1 Hz, Doppler | 0.4 | 6.3 | 7.8 | 0.5 | 0.8 | 0.4 | 2.10 | – |
| City, urban canyon (30–60 m noise) | 4.1 | 8.7 | 8.5 | 27.7 | 0.9 | 27.0 | 45.53 | – |
| Hard braking at 6 m/s² | 0.7 | 7.0 | 23.1 | 0.7 | 0.6 | 0.2 | 0.44 | 1.9 |
| Highway with a 12 s tunnel | 0.2 | 5.8 | 4.2 | 0.7 | 0.9 | 0.2 | 0.17 | – |
| Android "speed 0 while moving" | 12.7 | 23.4 | 13.7 | 2.0 | 7.2 | 5.2 | 45.49 | – |
| iOS speed −1 (invalid) | 2.4 | 7.1 | 6.0 | 7.1 | 8.5 | 1.5 | 0.27 | – |
| Web, no speed at all, 1 Hz | 2.4 | 7.1 | 6.0 | 7.1 | 8.5 | 1.5 | 0.27 | – |
| Web, no speed at all, city | 5.0 | 7.3 | 10.8 | 6.0 | 7.2 | 1.9 | 10.03 | – |

## NEW pipeline (SpeedEngine)
| Case | RMSE steady | RMSE accel | RMSE brake | Top (live) err | Top (saved) err | live↔saved gap | Distance err % | Brake lag s |
|---|---|---|---|---|---|---|---|---|
| Highway cruise, 1 Hz, Doppler | 0.5 | 1.3 | 1.1 | 0.5 | 0.5 | 0.0 | 0.03 | – |
| Highway cruise, 0.2 Hz, Doppler | 0.5 | 0.8 | 0.6 | 0.6 | 0.6 | 0.0 | 0.06 | – |
| City stop-go, 1 Hz, Doppler | 0.4 | 1.4 | 1.7 | 0.5 | 0.5 | 0.0 | 0.13 | – |
| City, urban canyon (30–60 m noise) | 0.6 | 1.3 | 1.5 | 17.4 | 17.4 | 0.0 | 0.43 | – |
| Hard braking at 6 m/s² | 0.5 | 1.8 | 4.1 | 0.2 | 0.2 | 0.0 | 0.11 | -0.1 |
| Highway with a 12 s tunnel | 0.5 | 1.3 | 1.0 | 0.5 | 0.5 | 0.0 | 0.04 | – |
| Android "speed 0 while moving" | 3.1 | 12.1 | 16.2 | 2.0 | 2.0 | 0.0 | 0.97 | – |
| iOS speed −1 (invalid) | 2.4 | 8.6 | 6.5 | 2.9 | 2.9 | 0.0 | 0.05 | – |
| Web, no speed at all, 1 Hz | 2.4 | 8.6 | 6.5 | 2.9 | 2.9 | 0.0 | 0.05 | – |
| Web, no speed at all, city | 3.2 | 11.7 | 16.4 | 2.0 | 2.0 | 0.0 | 4.07 | – |

## Targets (SPEC-I §I3) and where they are met
| Target | Doppler cases (highway 1 Hz and 0.2 Hz, city, hard brake, tunnel) | Without a Doppler (web, iPhone −1, Android 0) |
|---|---|---|
| Steady RMSE ≤ 1.5 km/h | **met** (0.3–0.5) | **MISSED**: 2.4–3.2 |
| Accelerating RMSE ≤ 3 km/h | **met** (0.8–1.8) | **MISSED**: 8.6–12.1 |
| Top speed ±2 km/h | **met** (0.2–0.6) | Android 2.0 (at the limit), iOS/web 2.9 (missed by < 1) |
| Distance ±1.5 % | **met** (0.03–0.13 %) | iOS/web **met** (0.05 %), Android **met** (0.97 %), web city **MISSED** (4.07 %) |
| No spike becomes the top speed | **met** (unit tests) | **met** |
| Live max = saved max | **met**, exactly | **met**, exactly |

### Why the no-Doppler cases miss, honestly
Without a Doppler the only evidence of speed is the change of position, and GPS position errors **drift** (they are correlated from fix to fix) instead of flickering. A slope over a window then has an error floor of ~1.5–2 km/h that no filter can remove, and a change of speed is invisible until the car has moved farther than the fix's own error circle (several metres), about 3–4 s after a start. The old needle was *faster* at a start but noisier, and stayed stuck near 10 km/h for ~7 s after a real stop; the new one is smoother and settles to 0, but it is no better while the speed is changing. Those readings are marked **ESTIMADA** on the cluster so nobody mistakes them for a Doppler measurement. The unit tests pin the current numbers (steady ≤ 3.5, brake < 25 in stop-and-go) so they cannot get worse unnoticed.

The urban-canyon case: the top speed is **not** trusted to ±2 km/h there (no fix is accurate to 20 m) and is flagged `topApprox`; distance and the steady needle are far better than before (distance 45.5 % → 0.4 %, steady 4.1 → 0.6).

## Root causes: confirmed vs hypothesised
| Cause | Status |
|---|---|
| Two implementations of speed (needle EMA vs saved median) | **Confirmed** (gap above) |
| Fixed EMA lag at the needle | **Confirmed** (accelerating/braking RMSE, brake lag) |
| Reported 0 read as "parked" in distance and speed | **Confirmed** (Android case) |
| Position-jump noise inflating distance / live max | **Confirmed** (canyon case) |
| GPS speed vs the car's own speedometer (the dash over-reads by design) | **Not measurable here**: needs a real drive. Calibration is the answer. |
| Odometer mismatch (GPS km vs the dash) | **Hypothesis**: partly physics (tyre size). The calibration drive measures it. |

## What the engine does (`lib/trips/speed.ts`)
One class used by the live needle, the live max, the saved trip (`lib/trips/stats.ts`), the map colours (`segmentSpeedsKmh`) and the live trail: Doppler and a 10 s position window (plus a 3 s fast one and the pair difference where there is no Doppler) fused in a 1-D Kalman filter whose process noise rises with acceleration; a plausibility gate that a consistent value overrides after three refusals; evidence-based stop logic (a real stop reaches 0; a Doppler of exactly 0 is only declared a lie after several in a row while the last 3 s of positions keep moving); top speed = the highest value held ≥ 2 s on fixes ≤ 20 m (the more conservative of the fused value and the plain window slope without a Doppler); distance = the integral of the fused speed, plus the straight chord across a gap; moving and total averages kept apart.
