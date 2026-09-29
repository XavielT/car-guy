# PROMPT 05 — Viajes: manual + automatic trips, live speed on the cluster, routes, stats

**Depends on:** Phase 2 (schema); can run before 3/4 if wanted · **Branch:** `imp-29092026/phase-5-viajes` · **ADRs:** 27–31 · **Size:** XL (two parts)
**Goal:** G2 — a drive is recorded without touching the phone.

> **Before running:** the Redmi on USB; the emulator with GPX playback (Android Studio → Extended
> controls → Location → Routes/GPX) for repeatable tests. `expo-location` background needs a
> **new preview build** (config plugin changes) — Expo Go cannot run it. Part B ends with a real
> drive by Xaviel (manual checklist). No x-core SQL here (sql/018–019 already created `trip`).
>
> **How to run:** `cd` to the repo folder, `claude`, paste part A; when it is done (its VERIFY
> passed) paste part B in the same or a new session.

---

## Part A — manual trips, live speed, trip list/detail

```
Phase 5A of IMP 29092026: manual trips + live speed on the cluster + the trip screens. Notes 1, 2.
Part B (automatic detection) comes after; design part A so B only adds the background task and
the state machine — the trip screens, the stats and the odometer suggestion are shared.

Read first:
- docs/imp-29092026/01-research/01-trip-tracking.md (all; §1.3 speed field, §1.4 watchPosition,
  §3 routes/stats/SVG, §4 odometer, §5 live speed, §7 web)
- docs/imp-29092026/01-research/04-wheelz-observed.md (what we copy, what we don't; check the
  last section for screenshots Xaviel may have added)
- docs/imp-29092026/02-specs/01-data-model-v6.md §1.4, §2 (trips domain), 03-screens.md "Phase 5"
- docs/imp-29092026/00-context/03-architecture-decisions.md ADR-28…31
- Expo 57 docs: expo-location (config plugin options, watchPositionAsync, permissions),
  expo-keep-awake, expo-task-manager (read now even if used in B)
- components/ui/ClusterHero.tsx, lib/motion/gaugeSweep.ts, app/(tabs)/index.tsx, lib/store.tsx,
  app/vehiculo/[id].tsx (hub tabs), app/(tabs)/historial.tsx, app/(tabs)/cifras.tsx,
  lib/domain/stats.ts, lib/db/statsQueries.ts, components/track/TrackPieces.tsx (share-as-image
  pattern), lib/domain/odometer.ts

Branch: imp-29092026/phase-5-viajes

1. INSTALL + PLUGIN: npx expo install expo-location expo-task-manager expo-keep-awake
   @mapbox/polyline simplify-js (+ types). app.json plugin block from research §1.1 (Spanish
   permission strings; isAndroidBackgroundLocationEnabled + isAndroidForegroundServiceEnabled true
   now so Part B does not need another native rebuild; androidForegroundServiceIcon 96 px white
   from the existing notification icon; POST_NOTIFICATIONS already handled by expo-notifications —
   confirm). Web: expo-location's web shim for foreground only; lib/trips/task.ts gets a
   task.web.ts no-op.
2. DOMAIN (pure, tested, no React): lib/trips/geo.ts (haversine, equirectangular projection,
   Douglas–Peucker via simplify-js at 8 m, encodePolyline/decode (precision 5), stats(points) →
   distance_m with jitter suppression, duration/moving, avg/avgMoving, max as 3-sample median with
   acc ≤ 20, buckets <30/30–60/60–90/90–120/120+, bbox), effectiveSpeed(prev, cur) (Android reports
   0 when unknown: fall back to displacement/Δt), emaSpeed. lib/trips/machine.ts: step() with the
   thresholds of ADR-28 as a cfg object — even though Part A only uses manual start/stop, the
   machine already handles `manual_start`/`manual_stop` events and the merge rule; tests with
   synthetic fix sequences (start, traffic light 3 min, real stop 5 min, GPS gap, jump filter,
   merge within 10 min/150 m, discard < 500 m).
3. RECORDING (foreground, Part A): lib/trips/live.ts — startManualTrip(vehicleId) creates the
   trip row, subscribes watchPositionAsync({ accuracy: BestForNavigation, timeInterval: 1000,
   distanceInterval: 3 }), feeds machine.step() with the fixes, batches trip_point inserts every
   5 s / 20 points, publishes a live snapshot to a small store (speed km/h smoothed, distance,
   elapsed, gps quality, maxSoFar) for the cluster; stopTrip() finalizes: stats, simplify, polyline,
   bbox, status done, odometer suggestion (ADR-30: odometer_reading source trip_estimate, skipped
   for pasajero), a Historial row via the view. The subscription survives tab changes (module
   scope), stops on stopTrip or app kill (Part B makes it survive). useKeepAwake while recording
   and Inicio is focused (setting trips_keep_awake, default on).
4. CLUSTER SPEED MODE (ADR-31): ClusterHero gains mode 'speed' (scale 0–200 with 20-step marks,
   red arc from vehicle.limit_kmh, needle from the live store via Reanimated shared value — no
   re-render per fix; LcdDigits shows trip km; tap cycles km · tiempo · media · máx; telltales
   GPS (3 states) · REC (1 Hz blink, the only allowed loop, stops when the trip ends) · PASAJERO;
   caption "GPS · no sustituye el velocímetro"). Inicio: "Viaje en curso" card and the "Iniciar
   viaje" row per 03-screens.md; both hidden when trips_enabled = off. Smooth transition between
   odometer and speed mode (crossfade 300 ms; reduced motion: cut).
5. SCREENS: app/viajes/index.tsx (list with filters, header strip, swipe actions), app/viaje/
   [id].tsx (SVG route coloured by bucket, start dot/end flag, replay scrubber, tiles,
   distribution bar, vehicle/role chips, Ver en mapa (https://www.google.com/maps/dir/?api=1&
   origin=lat,lng&destination=lat,lng — opens externally), Compartir as image, notas, etiquetas,
   eliminar), app/viajes/ajustes.tsx (mode selector — Part A offers Solo manual · Apagado, the
   Automático option appears in Part B — keep-awake toggle, redline per vehicle, permission status),
   app/viajes/permisos.tsx (explanation cards; Part A needs only the foreground permission).
   Vehicle hub: tab Viajes. Más: row Viajes. Historial: `viaje` rows. Cifras: block Viajes with
   the DR equivalences (vueltas al Autódromo de las Américas 3.5 km, SD–Santiago 155 km, vuelta a
   la isla 1,000 km — constants in es.ts with the source note "aprox.").
6. ODOMETER: the Tablero LCD shows the trip_estimate reading with "≈" when it is newer than the
   last typed one; the fuel form pre-fills it as a placeholder suggestion, never as the value.
   Typed readings remain the truth (odometerBounds unchanged).
7. PURGE: trip_point rows of trips done > 30 days ago deleted at launch (lib/db/reset.ts pattern).
8. FLAG: FEATURE_TRIPS = true when Part A's VERIFY passes (Part B extends it).
9. STRINGS; TESTS: geo (haversine known distances, simplify reduces ≥ 80 % on a noisy line,
   polyline round-trip, stats on a synthetic drive, max-speed spike rejection, buckets sum to
   duration), machine (the sequences above), live store reducer, odometer suggestion clamp.

VERIFY: emulator with docs/imp-29092026/fixtures/drive-synthetic.gpx (write it: ~12 km, 25 min,
speeds 0–95 km/h with two 2-min stops and one 5-min stop — the manual trip must not end on its
own in Part A, but the machine's stop detection is unit-tested); web: manual trip in Chrome with
the DevTools sensor override (Location) — live speed can't be simulated well on web; verify start/
stop/list/detail render. Android (Redmi, preview build with a test account): start a manual trip
in the parking lot, walk 300 m (it should discard as < 500 m — say so in a toast), then a short
real drive by Xaviel if he is available (manual checklist), else keep for Part B. Screenshots
docs/qa/imp-29092026-phase-5a-*.png. Report block; notes closed: 2, and the manual half of 1.
```

## Part B — automatic detection in the background

```
Phase 5B of IMP 29092026: automatic drive detection. Note 1 (the Wheelz part). Part A is done.

Read first:
- docs/imp-29092026/01-research/01-trip-tracking.md §1.1, §1.2, §1.6, §1.7, §2 (state machine,
  TaskManager task, MIUI), the "Implementation checklist"
- ADR-27, ADR-28; 03-screens.md "Phase 5" (Ajustes → Viajes, permisos)
- Expo 57 docs: expo-task-manager (defineTask at module scope, headless constraints),
  expo-location startLocationUpdatesAsync options, foregroundService
- lib/trips/* from Part A; index.ts (entry) — the task module must be imported before
  expo-router/entry

Branch: imp-29092026/phase-5-viajes (continue)

1. TASK: lib/trips/task.ts — defineTask('carguy-trip-location') at module scope; lazy DB open
   (openDatabaseAsync('carguy.db') + WAL + busy_timeout), loadState/saveState in trip_state,
   machine.step() on each batch, batched trip_point inserts in withExclusiveTransactionAsync,
   finalize via the same finalizeTrip() Part A wrote (move it to lib/trips/finalize.ts, no React),
   mode switch: when the machine says switchTo 'recording'/'watching', call
   startLocationUpdatesAsync again with OPTIONS[mode] (research §2.2). If the device test shows
   the switch from the background is unreliable on the Redmi, fall back to a single High/2 s/10 m
   configuration (ADR-27) — decide by the test, record in PROGRESS.md.
2. ARMING: lib/trips/auto.ts — armAuto() called on app foreground when trips_enabled = 'auto' and
   background permission is granted: hasStartedLocationUpdatesAsync → start if not. Never call it
   from the background. disarmAuto() on mode change. On cold start, re-arm (research §1.2:
   terminated apps are not restarted by the OS).
3. PERMISSIONS + MIUI: permisos.tsx gains the Automático card → foreground → explanation →
   requestBackgroundPermissionsAsync (jumps to settings on Android 11+; on return re-check);
   approximate-only detection → warning; the MIUI checklist card (Autostart, Sin restricciones,
   bloquear en Recientes) with Linking.openSettings() shown when Device.manufacturer is Xiaomi/
   Redmi/POCO; the foreground-service notification copy per research (title "Car Guy",
   body "Detección automática de viajes activa" / "Viaje en curso · grabando ruta", colour
   #E10600 — check it renders on the Redmi).
4. LIVE VIEW while auto-recording: Inicio subscribes to the trip_state row (poll 1 s while
   focused, or a lightweight event from the task via the DB) so the cluster enters speed mode
   when a trip opened in the background; manual "Terminar" on an auto trip finalizes it;
   "Iniciar viaje" while auto is watching adopts the open trip (ADR-28 rule: never two trips).
5. AJUSTES: mode Automático + manual (default after permission), Solo manual, Apagado; advanced
   thresholds editable (start speed, start samples, stop minutes, min distance, merge window)
   stored in trips_thresholds and read by the task on each batch.
6. BATTERY NOTE in Ajustes ("Con detección automática el teléfono usa el GPS solo cuando te
   mueves; en un día normal gasta poco, pero en Xiaomi hay que quitar las restricciones").
7. TESTS: machine already; task glue tested with a fake TaskManager (module mock) delivering
   batches → rows in an in-memory DB; arm/disarm idempotence.

VERIFY: emulator GPX playback with the app in the background and the screen off: the trip
opens by itself within 3 fixes over 20 km/h, survives the 2-min stops, ends 4 min after the
5-min stop, appears in the list with route + stats; kill the app from Recents → the notification
stays and the next playback still records (if it does not, document and re-arm on open). Redmi:
Xaviel drives (manual checklist): trip appears without touching the phone, no stop at traffic
lights, the notification shows, battery drop noted after a day. Screenshots docs/qa/
imp-29092026-phase-5b-*.png. Report block; note closed: 1 (with 19).
```
