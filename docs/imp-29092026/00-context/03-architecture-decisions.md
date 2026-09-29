# Architecture decisions — IMP 29092026 (ADR-25 … ADR-36)

ADR-01…15 (`docs/imp-17092026/00-context/03-architecture-decisions.md`) and ADR-16…24
(`docs/imp-28092026/…`) stay in force. Claude Code applies these as defaults and reports them; it
does not stop to ask.

## ADR-25 — Hotfix first: 2.1.3 before any schema change

Two notes (12, 13) are bugs that real users hit today. Phase 1 fixes them on top of `main` with
**no migration**, ships `v2.1.3` (APK + web), and only then does the cycle branch into schema v6.
**Consequence:** the photo fix and the env fix must not depend on anything from later phases.
The 2.1.3 release also introduces the stable asset name `car-guy.apk` (ADR-34).

## ADR-26 — One migration (v6) for the whole cycle, cloud `sql/018` + `019`

As in ADR-17: every table and column this cycle needs is written once in Phase 2 — `trip`,
`trip_point` (local only), fuel gauge columns, vehicle unit/economy/status columns,
`vehicle_media` ordering, oil columns on `service_record_item`, `feedback` (cloud only). Later
phases that discover a missing column add **v7, v8…**, never edit v6. `sql/018_schema_v3.sql`
(tables + columns + `updated_by`), `sql/019_rls_v3.sql` (policies incl. members), both additive,
`carguy` only. `feedback` gets its own `sql/020_feedback.sql` because its RLS is unusual (anon
insert) and Xaviel should read it before approving.

## ADR-27 — Trips: expo-location + expo-task-manager, no paid SDK

Automatic detection runs in one background location task hosted by Android's foreground service
(persistent notification), with a JS state machine (research 01 §2.1) in two intensities —
*vigilando* (Balanced, 50 m / 15 s) and *grabando* (BestForNavigation, 5 m / 1 s). Transistorsoft
is rejected (paid Android license; research 01 §2). Motion activity (`watchMotionActivityAsync`)
is foreground-only and is used only as a confidence hint. **Consequences:** a dev build/APK is
required (Expo Go cannot run TaskManager on Android); the task is defined at module scope in a
file imported by the entry; the DB is opened lazily inside the task with WAL; the service is
(re)armed only while the app is in the foreground (Android 12+/14+ rules); MIUI needs the
onboarding checklist (Autostart, Sin restricciones, lock in Recents). If reconfiguring the task
from the background proves unreliable on the Redmi, the fallback is a single `High / 2 s / 10 m`
configuration — decided by the Phase 5 device test, recorded in PROGRESS.md, not asked.

## ADR-28 — Trip end and merge rules (the Wheelz complaint)

A trip does not end at a traffic light: **4 minutes** under 1.5 m/s and < 75 m of displacement,
then finalize; a gap in fixes > 10 min finalizes at the last good fix. A trip starting within
**10 min** of the previous end and within **150 m** of it is **merged** into the previous trip
(one row, two segments). Trips < 500 m or < 2 min are discarded (parking-lot moves). Constants live
in `lib/domain/trips.ts` and in Ajustes → Viajes (advanced) so Xaviel can tune on the road.

## ADR-29 — Routes: encoded polyline on the row, raw points local, SVG rendering

`trip.polyline` (Google polyline, precision 5, after Douglas–Peucker at 8 m) and `trip.bbox`
sync; `trip_point` never syncs and is purged 30 days after finalization. Routes are drawn as an
SVG path on the dark card, coloured by speed in five buckets; "Ver en mapa" opens an external maps
URL. No embedded map, no API keys, works on web (research 01 §3). A real map is a later cycle.

## ADR-30 — Trips and the odometer

A finalized trip inserts an `odometer_reading` with `source = 'trip_estimate'` = last typed
reading + Σ GPS distance since it (calibration factor from the last two typed readings, clamped
0.9–1.1). Typed readings always win; the cluster shows the estimate with a "≈" and the next fuel
form pre-fills it as a suggestion, never silently. A trip flagged *pasajero* (or assigned to
another vehicle) contributes nothing.

## ADR-31 — Live speed on the cluster

While a trip is `recording` and Inicio is visible, the cluster switches to **speed mode**:
the same dial with a 0–200 km/h scale (0–120 for `motor`/`buggy`? no — 0–200 for all; the redline
segment starts at the vehicle's `limit_kmh` setting, default 120), needle = EMA-smoothed km/h
from `watchPositionAsync` at 1 Hz, LCD = trip km, telltales: GPS (green good / amber weak /
red none), REC (red dot blinking 1 Hz — the one allowed loop, ends when the trip ends),
*pasajero*. `expo-keep-awake` while in speed mode (toggle in Ajustes). Tap the LCD to cycle
km · tiempo · vel. media · vel. máx. Speed mode is never a speedometer for legal purposes — a
one-line caption says "GPS · no sustituye el velocímetro".

## ADR-32 — Partial fills: gauge eighths, estimated points, reconciliation

`fuel_log.gauge_before_eighths`, `gauge_after_eighths` (0–8, nullable), `in_reserve` (before
reading), `vehicle.reserve_volume` (nullable, default 10 % of tank at compute time). Economy
points get `status: measured | reconciled | estimated | unknown` with a `[low, high]` band; only
the explicit "Tanque lleno" toggle is a full anchor; an "F" without the toggle is 15/16 ± 1/16.
Estimated points are excluded from the headline average unless "incluir estimados" is on
(setting). The pure function replaces `computeEconomy` behind the same tests plus new ones —
brim-to-brim results must not change for logs without gauge data (research 02 §1).

## ADR-33 — Volume unit per vehicle, canonical storage in liters

New `vehicle.volume_unit` (`'gal' | 'l'`, default `'gal'` for existing rows) and
`vehicle.economy_unit` (`km_gal | km_l | l_100km`, default `km_gal`). **Storage becomes liters**:
migration v6 converts existing `fuel_log.volume`, `vehicle.tank_volume`, `price_per_unit` (per
liter) and `service_record_item`/`part` volumes where they exist, in one transaction, keeping
`volume_entered` + `volume_entered_unit` so an edit shows what was typed. All display goes through
`lib/domain/units.ts` (1 US gal = 3.785411784 L). Cloud: `sql/018` adds the same columns; the sync
sends liters; a 2.1.x device that pulls a 2.2 row sees liters in a gallons field — **2.1.x
installs must update before syncing**; the pull refuses rows whose `schema_hint = 'v6'` on old
clients (add the column, gate in `merge.ts`), the same protection the last cycle lacked.

## ADR-34 — Distribution: stable `car-guy.apk` + `api/apk.ts`

Every GitHub release uploads **two** assets: `car-guy.apk` (stable name, what
`releases/latest/download/car-guy.apk` resolves to) and `car-guy-v<version>.apk` (archive).
Releases are never marked pre-release. The web reads `/api/apk` (Vercel function, CDN-cached
10 min, `stale-if-error`) and shows "Descargar APK vX.Y.Z · NN MB" on Android browsers only;
inside the native app the button does not exist. The portfolio keeps `releases/latest`.

## ADR-35 — Feedback inbox on x-core, admin by email

`carguy.feedback` with anon **INSERT** through a `security definer` RPC `submit_feedback(...)`
that rate-limits 5/h per `device_id` and returns nothing (no SELECT for anon); owners read their
own rows; admin = `auth.jwt() ->> 'email' = 'tecnologia@constructorasd.com'` (lower-cased
compare), listed in the app under Más → Comentarios recibidos (visible only for the admin
session). Optional screenshot goes to a new bucket `carguy-feedback` (insert-only, 2 MB, private;
admin reads via signed URL). Music Hub untouched (ADR-06).

## ADR-36 — Animated launch as a JS overlay; native splash stays static

expo-splash-screen keeps the static PNG (needle at rest, same artwork). The root layout mounts
`components/LaunchOverlay.tsx` — same background `#121212`, same geometry as the PNG — and calls
`SplashScreen.hide()` on its first layout, so there is no flash; the needle sweeps 0 → 100 and the
arc fills over ~900 ms (Reanimated + react-native-svg), the LCD counts 000 → 100, then the overlay
fades and unmounts. Reduced motion: final frame, 250 ms fade. Plays once per cold start (the
cluster's own `gaugeSweep` then does **not** replay — one sweep per launch, ADR-16).
