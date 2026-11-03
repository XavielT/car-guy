# SPEC-H — Automatic trips that actually record (P5)

Xaviel (03-nov, round 2): "the app has trouble registering when I start a trip; usually if I don't do it manually it doesn't register." Answers: it **never starts** and it **only works with the app open**; he drives with **both** a Redmi (APK) and an iPhone (PWA).

## H0. What the code does today (verified 2026-11-03, `main` 0afede6) — hypotheses to confirm in PROMPT-09 step 1
1. **Default mode is Manual** (`lib/trips/settings.ts`: `trips_enabled` defaults to `'manual'`); Automático is opt-in and needs fg + bg location.
2. **The service is armed only from the foreground** (`lib/trips/auto.ts`: `armAuto()` on open and on every return to the front; the header says so: Android 12+ blocks starting a foreground service from the background, and "a terminated app is not restarted by the OS"). So when the app is swiped away or MIUI kills it, **nothing detects anything until the next time he opens it** — this is the "only with the app open" symptom.
3. The Redmi diagnosis of 2026-10-01 (`docs/imp-01102026/04-tracking/PROGRESS.md`): no location permission at all, MIUI autostart off, battery-optimised, RARE standby bucket, MIUI kills the app. Whether he later granted everything is **not recorded** ("closes with his drive").
4. **Start rule vs the watching config**: idle watching runs `Balanced`, 15 s / 50 m, deferred 60 s (`taskOptions().watching`). Balanced often yields network/cell fixes with accuracy > 50 m and no speed; the start rule needs 3 consecutive fixes ≥ 5.5 m/s (~20 km/h) with accuracy ≤ 50 m, or 300 m of displacement in 2 min. In Santo Domingo stop-go traffic at 15 s spacing that is slow to satisfy or never satisfied.
5. **iPhone PWA cannot detect trips by itself** (ADR-48): web location stops when the page is suspended.

## H1. Evidence first (don't tune blind)
- `lib/trips/diagnostics.ts` exists: extend it into a **"Why didn't it record?" timeline** stored locally for 14 days: every `armAuto` outcome + reason, every task invocation (time, fixes count, best accuracy), service running yes/no, machine phase changes, trip auto-created/discarded (+ reason), and **the system's own record of why the process died**: a small native call to `ApplicationExitInfo` (Android 11+: reasons like `REASON_USER_REQUESTED`, `REASON_LOW_MEMORY`, `REASON_OTHER`, `REASON_FREEZER`…) so the first real answer is data, not guessing.
- If the Redmi is on USB/Wi-Fi adb: repeat the 2026-10-01 dump (permissions, standby bucket, deviceidle whitelist, MIUI autostart op, exit reasons) and record before/after in `findings.md`.

## H2. Make it the default path, with a wizard that verifies each step
- New installs on Android: **Automático is the default** after a short "Activar viajes automáticos" wizard (not a settings maze). Each step re-reads the real state (ADR-59 registry) and shows a green check: location while using → **location all the time** → notifications (Android 13+) → **activity recognition** (new, H3) → battery "sin restricciones" → MIUI/Xiaomi autostart and "lock in recents" with the vendor-specific steps (existing `modules/miui-autostart`) → test.
- A persistent **health card** (extends `AutoBlockedCard`) when anything regresses: "Los viajes automáticos no están grabando: falta X" with the one-tap fix and "last trip recorded automatically: 2 days ago". Also shown in Viajes and Conducir.
- Existing users on Manual get one non-blocking suggestion card, never a forced switch.

## H3. Make the OS start the recording (the real fix for "app closed")
New local Expo native module `modules/trip-trigger` (Kotlin, Expo 57 module API — read its docs; precedent: `modules/miui-autostart`). Triggers that Android delivers to the app **even when it is not running**, each starting (or re-arming) the same foreground location service the app uses today, and handing off to `engine.feed()` so the state machine, merge and discard rules stay the single brain (ADR-71):
1. **Activity Recognition transitions** (Google Play Services `ActivityTransition` API: `IN_VEHICLE` enter/exit) via a PendingIntent receiver. Needs `ACTIVITY_RECOGNITION` runtime permission. **Verify in the Android docs for the target SDK** that a transition/geofence event is an exemption that allows starting a location foreground service from the background (Android 12+ rules) — if it is not, the receiver instead raises a high-priority "Viaje detectado — tocar para grabar" notification with a full-screen/auto action, and the finding is recorded.
2. **Bluetooth car trigger**: the user picks the car's Bluetooth device(s) in the wizard (`BLUETOOTH_CONNECT` on Android 12+); `ACL_CONNECTED/DISCONNECTED` for that device starts/ends the trip, and **maps the device to a vehicle** (answers "which car?" for free in a multi-car garage).
3. **Geofence exit** around the last parked position (`GeofencingClient`, ~150 m) as the fallback when 1 and 2 are unavailable.
4. **`BOOT_COMPLETED`** re-arms triggers after a reboot; the app's own `armAuto` on open stays as before.
The module exposes `getCapabilities()`, `registerTriggers(config)`, `unregister()`, `lastExitReasons()`; no network, no new third party except Google Play Services (already part of Android; declare in `docs/DATA-AND-THIRD-PARTIES.md` and the data-safety notes). Permissions go through the ADR-59 registry; `app.json`/manifest additions listed in PROMPT-09. **Native change ⇒ APK.**

## H4. Detection tuning (after H1 evidence; replayed, not guessed)
- Watching config: while the OS trigger says "in vehicle" (or BT connected) raise to `High` accuracy at 2–5 s; while still, stay on the cheap passive/Balanced mode. (Records the intensity switch as the existing `switchIntensity`, same ADR-27 single-config fallback.)
- Start thresholds (defaults in `DEFAULT_TRIP_CFG`, still user-overridable): `startSpeedMs` 5.5 → ~3.5 m/s, `startSamples` 3 → 2, `startAccM` 50 → 65, displacement alternative 300 m/120 s → 150 m/60 s, **and** an OS trigger counts as a start vote by itself (so the machine opens the trip on trigger + first good fix). The machine's `recent` ring buffer back-fills the first minute so the route does not begin late (verify and add if missing).
- Keep stop (4 min) and merge (10 min / 150 m) rules; keep discard < 500 m or < 2 min. Add: a **fuel-stop tolerance** (merge window 10 → 20 min when the stop is within 150 m of a known gas-station/`contacto` or the person logs a fill-up inside the gap).
- Every threshold change ships with a **replay test**: the real traces from the diagnostics export (and synthetic stop-go/urban-canyon traces from `tools/gen-drive-gpx.mjs`) run through `stepAll`; assertions: trip opens within 60 s / 400 m of departure, no split at lights, no false trip for a 300 m parking-lot move.

## H5. Which car, which role
Auto trip vehicle = Bluetooth-mapped car → else last driven → else default (today `defaultVehicleId`). Post-trip card on Inicio ("¿Fue en el Civic? Sí · Cambiar · Fui de pasajero") — the existing `role` (`conductor|pasajero`) is set from it; never blocks recording.

## H6. iPhone (PWA): honest limits + assisted start
- Say it plainly in the app (extends the existing banner): iOS suspends a web page's location, so a PWA cannot detect a trip on its own.
- **Assisted start**: deep link `https://car-guy.vercel.app/conducir?auto=start&vehicle=<id>` starts a manual trip as soon as the PWA opens (permission already granted; keep-awake on). `/instalar` gets a "Iniciar al conectar el carro" section: step-by-step iOS **Atajos → Automatización → Bluetooth/CarPlay → Abrir URL** (text steps, es/en), with the link prefilled for his car and an explanation that the screen must stay on.
- At the end: the PWA closes a stationary trip after 4 min **while it is in the foreground** (existing machine); if the page was suspended mid-trip the trip is closed at the last fix with a clear note, never lost.
- A native iOS app stays out of scope (ADR-48, US$99/yr) and is recorded as the only way to get true background detection on iPhone.

## H7. Status you can trust (Viajes → Ajustes → "Estado de la detección")
Triggers registered (activity / Bluetooth / geofence), last trigger fired + time, service state, last fix age, permissions chips, "Probar detección ahora" (starts a 60 s test recording and reports each stage), last 7 days: trips recorded auto vs manual vs missed-by-app (a trigger fired but no trip opened → reason).

## H8. Acceptance
- Redmi: with the app **swiped away** and the phone locked, a real drive from home produces an **automatic trip** whose start is within ~60 s / 400 m of leaving, no split at lights, correct stop; works after a reboot; the wizard shows all green; the timeline explains any miss with a system reason.
- iPhone: tapping the Shortcut opens Car Guy and records; no claim of background detection anywhere.
- Unit/replay tests for H4; machine tests unchanged for manual trips; native module builds in the EAS cloud build; `check-bundle-env` and fingerprints updated; new permissions in the registry with primer text (es/en).
- Honest limit recorded in the report: no code can guarantee survival on every MIUI build; the exit-reason evidence tells what to do next.
