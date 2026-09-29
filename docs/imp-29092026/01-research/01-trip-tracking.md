# 01 — Automatic + manual trip tracking for Car Guy (Expo SDK 57)

Research date: 2026-09-29. Scope: Android APK (EAS local build, New Architecture) plus a static web export on Vercel. The goal is a drive tracker in the style of "Wheelz": it detects drives on its own, records the GPS route, duration, distance and average/max speed, and shows live speed on the home tachometer. A manual start/stop trip mode runs alongside it.

WebSearch was disabled, so every claim below comes from a page I fetched with WebFetch (listed under Sources) or is marked **unverified (from knowledge)**.

---

## TL;DR recommendation

1. **Use `expo-location` + `expo-task-manager` only. Skip Transistorsoft.** Build one background location task that runs as an Android foreground service with a persistent notification. A small JS state machine in that task decides when a trip opens or closes, using speed and distance heuristics.
2. **Two tracking intensities:**
   - **"Watching" mode** (auto-detect armed, no trip open): `Accuracy.Balanced`, `distanceInterval: 50`, `timeInterval: 15000`.
   - **"Recording" mode** (trip open, auto or manual): `Accuracy.BestForNavigation`, `distanceInterval: 5`, `timeInterval: 1000–2000`.
   - Switch modes by calling `startLocationUpdatesAsync` again on the same task name with new options.
3. **Motion activity.** SDK 56 added `Location.watchMotionActivityAsync`, which returns an `automotive` flag. It is **foreground only**, so it cannot detect drives by itself in the background. Use it only as a confidence boost while the app is open.
4. **Storage.** Write raw samples to SQLite (`trip_point`) in batches from the task. When the trip closes, compute stats, apply Douglas–Peucker, and store an encoded polyline on the `trip` row. Sync only the `trip` row (with the polyline) to Supabase, not the raw points.
5. **Route display.** Default to an **SVG route on a dark card** (react-native-svg). It needs no API key, works on web, and fits the JDM look. A real map (expo-maps on Android, or MapLibre) is an optional later upgrade.
6. **Live speed on the home screen.** Use `watchPositionAsync` at 1 Hz with `BestForNavigation`, EMA smoothing and `useKeepAwake` while a trip is live.
7. **Web.** Offer manual trips only, in the foreground, using the browser Geolocation API (`expo-location` web shim). There is no background mode and no auto-detect.
8. **Xiaomi (Redmi Note 10 Pro, MIUI 13/14, Android 13).** Onboarding must walk the user through Autostart and "Battery saver → No restrictions". Otherwise MIUI kills the service.

---

## 1. expo-location in SDK 57

### 1.1 Config plugin (app.json)

Plugin options, taken from the v57 docs and from the plugin source (`withLocation.ts`):

| Option | Default | Effect |
|---|---|---|
| `locationAlwaysAndWhenInUsePermission` | "Allow $(PRODUCT_NAME) to use your location" | iOS string |
| `locationWhenInUsePermission` | same | iOS string |
| `motionUsagePermission` | "Allow $(PRODUCT_NAME) to detect your current motion activity" | iOS motion string |
| `isAndroidBackgroundLocationEnabled` | `false` | adds `ACCESS_BACKGROUND_LOCATION` |
| `isAndroidForegroundServiceEnabled` | defaults to the value of `isAndroidBackgroundLocationEnabled` | adds `FOREGROUND_SERVICE` + `FOREGROUND_SERVICE_LOCATION` |
| `isAndroidMotionActivityEnabled` (present in plugin source; not listed in the docs table) | — | adds `android.permission.ACTIVITY_RECOGNITION` + `com.google.android.gms.permission.ACTIVITY_RECOGNITION` |
| `androidForegroundServiceIcon` | — | 96×96 white PNG for the FGS notification (added in SDK 55) |

The plugin always adds `ACCESS_COARSE_LOCATION` and `ACCESS_FINE_LOCATION`. The library's own AndroidManifest declares `LocationTaskService` with `android:foregroundServiceType="location"`. That covers the Android 14+ requirement that the service type is declared in the manifest, so you do not need a custom plugin for it.

Recommended `app.json` block:

```json
{
  "expo": {
    "plugins": [
      [
        "expo-location",
        {
          "locationAlwaysAndWhenInUsePermission": "Car Guy usa tu ubicación en segundo plano para registrar tus viajes automáticamente.",
          "locationWhenInUsePermission": "Car Guy usa tu ubicación para medir la velocidad y registrar viajes.",
          "motionUsagePermission": "Car Guy detecta si vas conduciendo para iniciar viajes automáticamente.",
          "isAndroidBackgroundLocationEnabled": true,
          "isAndroidForegroundServiceEnabled": true,
          "isAndroidMotionActivityEnabled": true,
          "androidForegroundServiceIcon": "./assets/notification-icon.png"
        }
      ],
      "expo-task-manager"
    ],
    "android": {
      "permissions": ["android.permission.POST_NOTIFICATIONS"]
    }
  }
}
```

`POST_NOTIFICATIONS` (Android 13 runtime permission) is my addition and is **unverified (from knowledge)**. Without it, Android 13+ can hide the FGS notification from the notification shade, although the service still runs. Request it with `expo-notifications` or skip it. Listing `expo-task-manager` as a plugin is harmless. Whether it strictly needs a plugin entry is **unverified**.

### 1.2 Background updates: `startLocationUpdatesAsync(taskName, options)`

`LocationTaskOptions`, quoted from `Location.types.ts` and the v57 docs:

| Field | Notes |
|---|---|
| `accuracy` | `Accuracy` enum, default `Balanced` |
| `timeInterval` | ms, Android only. SDK 56 fixed a bug where `timeInterval`/`distanceInterval` were **ignored in background** on Android, so they are honored on 57. |
| `distanceInterval` | meters |
| `deferredUpdatesInterval` | "Minimum time interval in milliseconds that must pass since last reported location before all later locations are reported in a batched update" (default 0) |
| `deferredUpdatesDistance` | meters, default 0 |
| `deferredUpdatesTimeout` | deferred config |
| `foregroundService` | `{ notificationTitle, notificationBody, notificationColor ('#RRGGBB' / '#AARRGGBB'), killServiceOnDestroy }` |
| `activityType` | **iOS only** (`LocationActivityType.AutomotiveNavigation` etc.) |
| `pausesUpdatesAutomatically` | **iOS only**, default false |
| `showsBackgroundLocationIndicator` | iOS only |
| `mayShowUserSettingsDialog` | Android, default true: asks the user to turn on high-accuracy mode |

`activityType` and `pausesUpdatesAutomatically` have no effect on Android, so Car Guy can ignore them.

`deferredUpdatesInterval` is the batching knob. Locations are still collected at `timeInterval`, but they are delivered to JS in arrays. For example, 1 s sampling with a 10 s deferred interval wakes JS roughly every 10 s with about 10 locations. SDK 55 fixed a bug where "deferred location updates [were] incorrectly applying in foreground", which suggests deferral is now background-only.

**Accuracy enum:** `Lowest`=1 (~3 km), `Low`=2 (~1 km), `Balanced`=3 (~100 m), `High`=4 (~10 m), `Highest`=5, `BestForNavigation`=6 ("highest with navigation sensors").

**`killServiceOnDestroy`.** If true, the service dies when the user swipes the app away. For auto-detect, set it to `false`.

Constraints quoted from the docs:
- "Background location will stop if the user terminates the app."
- Android: "A terminated app will not automatically restart when a location or geofencing event occurs due to platform limitations."

In practice, auto-detect works only while the process is alive, which is what the FGS keeps it. After a reboot or a force-stop, the user must open the app once. On the next cold start, check `Location.hasStartedLocationUpdatesAsync(TASK)` and re-arm the task. `expo-location` does not provide a boot receiver (**unverified (from knowledge)**; Transistorsoft does provide `startOnBoot`).

### 1.3 The `speed` field

From `LocationObjectCoords.speed`: "The instantaneous speed of the device in meters per second." It is typed `number | null`, and the docs say it "Can be `null` on Web if it's not available."

- Android's `Location.getSpeed()` returns **0.0 when not available**, with `hasSpeed() == false`. So on Android a missing speed can look like `0` rather than `null`/`-1`. How Expo maps `hasSpeed()==false` (to 0 or null) could not be verified: the Kotlin record file returned 404. **Unverified.**
- iOS reports `-1` for invalid speed (**from knowledge**).
- Defensive rule: treat `speed == null || speed < 0` as unknown. If `speed === 0` while computed displacement is large, fall back to haversine distance ÷ Δt between consecutive fixes.

```ts
export function effectiveSpeed(prev: Fix | undefined, cur: Fix): number | null {
  const s = cur.coords.speed;
  if (s != null && s >= 0 && !(s === 0 && prev && movedFast(prev, cur))) return s;
  if (!prev) return null;
  const dt = (cur.timestamp - prev.timestamp) / 1000;
  if (dt <= 0 || dt > 30) return null;
  return haversine(prev.coords, cur.coords) / dt; // m/s
}
```

### 1.4 Foreground: `watchPositionAsync`

```ts
watchPositionAsync(options: LocationOptions, callback: (l: LocationObject) => void,
                   errorHandler?: (reason: string) => void): Promise<LocationSubscription>
```

`LocationOptions` has `accuracy`, `timeInterval` ("Minimum time to wait between each update in milliseconds"), `distanceInterval` and `mayShowUserSettingsDialog`. Call `.remove()` on the subscription to stop it.

### 1.5 Motion activity (new in SDK 56, present in 57)

The API consists of `getMotionActivityAsync()`, `watchMotionActivityAsync(cb, err)`, `requestMotionActivityPermissionsAsync()`, `getMotionActivityPermissionsAsync()` and `useMotionActivityPermissions()`. `MotionActivityObject` holds a timestamp plus `{ automotive, cycling, running, walking, stationary, unknown }`. Each entry is `{ detected: boolean, confidence: Low|Medium|High }`. It uses Google Play Services activity recognition on Android.

The critical limit, quoted: **"Only foreground use is supported — updates pause when the app is backgrounded and resume when it returns to the foreground."** That means it cannot trigger background auto-start. It can still confirm `automotive` when the user opens the app mid-drive, and it can help avoid logging a walk as a trip.

### 1.6 Permission flow

From the v57 docs and developer.android.com:
- Foreground permission must be granted first. You cannot obtain background permission without it.
- `requestBackgroundPermissionsAsync()` "will open the system settings page" on Android 11+. On Android 11+ the system dialog has no "Allow all the time" option; the user has to pick it on the settings page. Show an explanation screen first, and let the user decline and still use the app.
- If the user grants only *approximate* location in the foreground, background location is approximate too. That breaks speed tracking, so detect it and warn the user.
- Android 14+: a location FGS requires `FOREGROUND_SERVICE_LOCATION` plus the manifest service type (the library handles both). Google Play also requires an FGS-type declaration in the Console. Car Guy ships as an APK outside Play, so the Play requirement does not apply yet.
- Android 12+ apps "can't start foreground services while the app is running in the background" except for specific exemptions, such as geofencing/activity-transition events or user interaction with a notification or widget. On Android 14+, starting a location FGS from the background throws `SecurityException` unless the app holds `ACCESS_BACKGROUND_LOCATION`. **Consequence: call `startLocationUpdatesAsync` while the app is in the foreground** (on app open, or from a button), and keep the service alive. Do not stop and restart it from the background.

```ts
// permissions.ts
import * as Location from 'expo-location';
import { Platform, Linking } from 'react-native';

export async function ensureTripPermissions(): Promise<'full' | 'foreground' | 'denied'> {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== 'granted') return 'denied';
  // Android: fg.android?.accuracy === 'coarse' means approximate only -> warn (unverified field name)
  if (Platform.OS === 'web') return 'foreground';

  // Show our own explanation screen BEFORE this call (it jumps to Settings on Android 11+)
  const bg = await Location.requestBackgroundPermissionsAsync();
  if (bg.status !== 'granted') return 'foreground';

  await Location.requestMotionActivityPermissionsAsync().catch(() => {}); // ACTIVITY_RECOGNITION (optional)
  return 'full';
}
// MIUI: after 'full', show a checklist with Linking.openSettings() + instructions (see §1.7)
```

### 1.7 Caveats

- **Expo Go:** "With Expo Go, `TaskManager` is not available on Android". A dev build or APK is required, which fits the EAS local build workflow already in use.
- `defineTask` "must be called in the global scope of your JavaScript bundle… cannot be called in any of React lifecycle methods". When the OS launches the app in the background, "no views are mounted".
- **Doze / battery.** An FGS is exempt from most Doze throttling (**from knowledge**). OEM killers are the real problem.
- **Xiaomi/MIUI** (from dontkillmyapp.com): "In default settings, background processing simply does not work right". User-side fixes:
  1. Settings › Apps › Car Guy › App permissions › **Background autostart** (MIUI 14+).
  2. Settings › Additional settings › Battery & performance › Manage apps' battery usage › Car Guy › **No restrictions**.
  3. **Lock the app in Recents** (drag the card down).
  4. Optionally disable "MIUI optimizations" in Developer options.

  For developers, dontkillmyapp points to the `XomaDev/MIUI-autostart` library to detect the autostart state. That is a native Java library and would need a small Expo module; this is optional. At minimum, build an in-app "Seguimiento automático" checklist screen with `Linking.openSettings()`.

---

## 2. Automatic drive detection strategies

| Strategy | How | Battery | Reliability on MIUI | Cost / effort | Verdict |
|---|---|---|---|---|---|
| **(a) Always-on FGS + speed heuristic** (expo-location) | Balanced/50 m while watching, BestForNavigation/1 s while recording | Medium. Balanced relies largely on Wi-Fi/cell (**from knowledge**), roughly a few %/day extra. | Good once Autostart + No restrictions are set | Free, pure JS | **Recommended** |
| (b) Activity Recognition (`IN_VEHICLE`) | `expo-location` motion activity (foreground only). `react-native-activity-recognition` last published **2017-09-26** (v3.2.0, RN ^0.35), abandoned. | Very low | n/a | Background transitions need a custom native module (ActivityTransition API + PendingIntent) | Use only as a foreground hint. A custom module is a future option. |
| (c) Transistorsoft `react-native-background-geolocation` v5 | Accelerometer/gyro motion detection; stops GPS when stationary; Expo config plugin (`react-native-background-geolocation`), `npx expo prebuild` | Best in class | Good (plus startOnBoot etc.) | Android **release builds need a paid license**: Starter **$399** (1 app, perpetual, 1 yr updates), Venture $599, Pro $749, Studio $999; 30-day trial. Debug builds are free. | Overkill for a personal app. Revisit only if (a) disappoints. |
| (d) Geofencing | `startGeofencingAsync` (Android limit 100 regions). When a trip ends, drop a ~150 m geofence at the parking spot; EXIT means "probably driving". Android lets a geofence event start an FGS from the background. | Very low while parked | Only works while the process is alive (Expo: terminated app is not restarted on geofence events) | Free | Optional add-on to (a): lets "watching" mode run at `Low` accuracy while parked, then jump to High on EXIT. Whether Expo's task can then call `startLocationUpdatesAsync` from a background geofence event is **unverified**; test on device. |

Significant-location-change is an iOS concept. There is no Android equivalent in expo-location beyond a large `distanceInterval` (**from knowledge**).

### 2.1 Heuristic state machine (runs inside the task)

```
IDLE(watching) --speed>=5.5 m/s (~20 km/h) for 3 consecutive fixes, acc<=50 m--> RECORDING
                    (or accumulated displacement > 300 m within 2 min)
RECORDING --speed<1.5 m/s AND displacement<75 m for 4 min--> CLOSING -> finalize
RECORDING --gap in fixes > 10 min--> finalize at last good fix
finalize: discard trip if distance < 500 m or duration < 2 min (walks, parking-lot moves)
```

Suggested constants (tune on device): `START_SPEED = 5.5 m/s`, `START_SAMPLES = 3`, `STOP_SPEED = 1.5 m/s`, `STOP_MINUTES = 4` (long enough to cover traffic lights and Santo Domingo traffic), `MIN_TRIP_M = 500`. Reject fixes with `accuracy > 50` for start detection and `> 30` for the track. Reject jumps implying more than 70 m/s (about 250 km/h).

Manual mode sets `trip.source='manual'`. Its start and stop come from the user and bypass the heuristic, apart from the accuracy filters. If an auto-trip is open when the user taps Start, **adopt it**: convert it to manual and keep its points, so there are never two concurrent trips. If the user taps Stop, finalize immediately.

### 2.2 TaskManager task + batched SQLite writes

The headless context runs the same JS bundle without React. Rules (partly **from knowledge**, not fully in the docs):
- Define the task in a module imported from the app entry (for example `app/_layout.tsx` imports `./tasks/tripTask` at top level). With expo-router, a top-level import in the root layout works. Importing it in `index.ts` before `expo-router/entry` is the safest option.
- No React, no hooks, no context, no Zustand stores that rely on mounted providers, no UI APIs. Plain modules and native modules (`expo-sqlite`, `expo-location`) are fine.
- **Open the DB lazily inside the task module** with the same file name the app uses, e.g. `openDatabaseAsync('carguy.db')`. Do not rely on the `SQLiteProvider` instance. Enable WAL; the v57 docs recommend WAL mode, and it helps UI and task writers coexist. Use `withExclusiveTransactionAsync`, because the docs warn that `withTransactionAsync` also captures unrelated concurrent queries.
- Persist the state machine state (current trip id, stationary-since, consecutive-fast count) in SQLite, e.g. a `kv` table. JS memory may be reset between wakes.

```ts
// src/tasks/tripTask.ts  — imported at the top of the entry file
import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import * as SQLite from 'expo-sqlite';

export const TRIP_TASK = 'carguy-trip-location';
let dbP: Promise<SQLite.SQLiteDatabase> | null = null;
const db = () => (dbP ??= SQLite.openDatabaseAsync('carguy.db').then(async d => {
  await d.execAsync('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=3000;');
  return d;
}));

TaskManager.defineTask<{ locations: Location.LocationObject[] }>(TRIP_TASK, async ({ data, error }) => {
  if (error || !data?.locations?.length) return;
  const d = await db();
  const st = await loadState(d);                  // from kv table
  const out = stepStateMachine(st, data.locations); // pure fn: returns {state, pointsToInsert, openTrip?, closeTrip?}
  await d.withExclusiveTransactionAsync(async tx => {
    if (out.openTrip) await tx.runAsync('INSERT INTO trip (id, vehicle_id, source, started_at, status) VALUES (?,?,?,?,\'recording\')',
      [out.openTrip.id, out.openTrip.vehicleId, out.openTrip.source, out.openTrip.startedAt]);
    if (out.pointsToInsert.length) {
      const stmt = await tx.prepareAsync('INSERT INTO trip_point (trip_id, t, lat, lng, speed, acc, alt, heading) VALUES (?,?,?,?,?,?,?,?)');
      try { for (const p of out.pointsToInsert) await stmt.executeAsync([p.tripId, p.t, p.lat, p.lng, p.speed, p.acc, p.alt, p.heading]); }
      finally { await stmt.finalizeAsync(); }
    }
    await saveState(tx, out.state);
  });
  if (out.closeTrip) await finalizeTrip(d, out.closeTrip.id);        // stats + polyline + odometer suggestion
  if (out.switchTo) await Location.startLocationUpdatesAsync(TRIP_TASK, OPTIONS[out.switchTo]); // re-config same task (unverified: allowed while in bg? service is already running)
});

export const OPTIONS = {
  watching: {
    accuracy: Location.Accuracy.Balanced, timeInterval: 15000, distanceInterval: 50,
    deferredUpdatesInterval: 60000,
    foregroundService: { notificationTitle: 'Car Guy', notificationBody: 'Detección automática de viajes activa',
      notificationColor: '#E10600', killServiceOnDestroy: false },
  },
  recording: {
    accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: 5,
    deferredUpdatesInterval: 10000,
    foregroundService: { notificationTitle: 'Viaje en curso', notificationBody: 'Registrando ruta y velocidad',
      notificationColor: '#E10600', killServiceOnDestroy: false },
  },
} satisfies Record<string, Location.LocationTaskOptions>;
```

Mode switching needs caution. Re-calling `startLocationUpdatesAsync` while the task is already running updates its options (**from knowledge**). Doing that from the background only reconfigures an already-running FGS, which should not count as a new FGS start, but this is **unverified on Android 14+/MIUI**. The safe fallback is to always run at `High` / `timeInterval 2000` / `distanceInterval 10` and apply the heuristic in JS. That costs more battery but has no reconfiguration risk.

Suggested schema additions:
- `trip(id, vehicle_id, source 'auto'|'manual', status, started_at, ended_at, distance_m, duration_s, moving_s, avg_kmh, avg_moving_kmh, max_kmh, polyline, bbox, start_lat, start_lng, end_lat, end_lng, updated_at, deleted_at)`
- `trip_point(trip_id, t, lat, lng, speed, acc, alt, heading)` with an index on `(trip_id, t)`

Keep `trip_point` local only, and purge it N days after finalization.

---

## 3. Route storage and display

- **Raw vs encoded.** 1 Hz for a 30-minute drive gives about 1,800 points, roughly 70 KB of rows. Keep the raw points locally for recomputation. For sync and display, store an **encoded polyline**. `@mapbox/polyline` v1.2.1 (BSD-3) provides `encode(coords, precision)` / `decode(str, precision)` with `[lat, lng]` order, default precision 5 (~1 m); precision 6 is also supported. It also offers `toGeoJSON`/`fromGeoJSON`. After simplification a drive typically encodes to 1–4 KB (**estimate**), which fits in a Supabase `text` column.
- **Simplification.** `simplify-js` v1.2.4 (BSD-2, Agafonkin) provides `simplify(points, tolerance, highQuality)` with `{x,y}` points. Project lat/lng to meters first, using an equirectangular projection around the trip centroid (`x = lng·cos(lat0)·111320`, `y = lat·110540`), so the tolerance is in meters. Tolerance of 5–10 m with `highQuality=true` usually cuts a track by 80–95% (**from knowledge**).
- **Distance.** Sum haversine distances between consecutive *accepted* fixes:

```ts
const R = 6371008.8;
export function haversine(a: {latitude:number;longitude:number}, b: {latitude:number;longitude:number}) {
  const toR = Math.PI / 180, dLat = (b.latitude - a.latitude) * toR, dLng = (b.longitude - a.longitude) * toR;
  const h = Math.sin(dLat/2)**2 + Math.cos(a.latitude*toR) * Math.cos(b.latitude*toR) * Math.sin(dLng/2)**2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
```

  To avoid "jitter inflation" while stopped, skip a segment when its length is smaller than the combined accuracy radius and the speed is below 1 m/s.
- **Stats.**
  - `duration = ended − started`.
  - `moving_s` = sum of Δt where segment speed ≥ 1.5 m/s. `idle_s = duration − moving_s`.
  - `avg_kmh = distance/duration·3.6`, and also report `avg_moving_kmh`.
  - `max_kmh`: the maximum of a 3-sample median of reported speed. This prevents one spurious spike from becoming the "top speed". Also require `acc ≤ 20 m` at that sample.
- **Maps on Expo 57:**
  - `expo-maps`: **alpha** ("will frequently experience breaking changes"). Android uses Google Maps and needs `android.config.googleMaps.apiKey`. Supports `polylines` (`coordinates`, `color`, `width`) and `colorScheme: DARK`. **No web support.** Not in Expo Go.
  - `react-native-maps` (≥1.26.1 for RN ≥0.81.1, New Architecture): has `<Polyline>` and a config plugin. Android needs a Google key. **iOS + Android only**, no web.
  - `@maplibre/maplibre-react-native` v11.4.0 (MIT): peer deps `expo >=54` (optional), `react-native >=0.80`, ships `app.plugin.js`. **No API key**, but you must supply a style URL. The public OSM tile servers forbid heavy use, require a real User-Agent and attribution, forbid prefetch/offline, and "may block access, without notice". Use an OSM-derived provider with a free tier instead (MapTiler/Stadia/OpenFreeMap, **unverified tiers**). No web in the RN package; web would need `maplibre-gl` separately.
  - **SVG fallback (recommended default).** Decode the polyline, project it to meters, fit it to a box with padding while preserving the aspect ratio, and draw it with `<Path d="M…L…">` in react-native-svg on the dark card. Add a neon/red stroke, a glow (duplicate path, wider, low opacity), a start dot and an end checkered flag. Optionally color segments by speed with small `<Line>`s bucketed into 5 colors. It works identically on Android and web, and needs no keys, tiles or network. A real map can later be an optional "Ver en mapa" button: `expo-maps` on Android behind a Google key, or an OSM link on web.

---

## 4. Odometer integration

- Treat trips as **suggested** odometer readings, never authoritative. Keep a vehicle-level `estimated_odometer = last_typed_reading + Σ trip.distance since that reading`. Only write an `odometer_reading` row with `source='trip_estimate'` if the user opts into "auto-mileage". Typed or photo readings (`source='manual'`) must always win. When a manual reading arrives, compute the drift factor `(manual − last_manual) / Σ gps_km` and show it. It is a good calibration signal, and the factor can scale future estimates.
- **Error margins (from knowledge, unverified).**
  - Smartphone GPS track distance typically ends up within about 1–3% of the true distance on open roads with 1 Hz sampling.
  - Sparse sampling cuts corners and under-reads.
  - Jitter while stopped over-reads unless it is filtered.
  - Urban canyons and tunnels cause gaps.
  - Car odometers themselves commonly read 1–3% high.

  Expect GPS and odometer to disagree by a few percent. That is a reason to present trip distance as "estimated".
- **Competitors (from knowledge, unverified; not fetched).** Mileage apps such as MileIQ and Driversnote auto-detect drives for logbooks and do not overwrite the car's odometer. Fuelio and Drivvo treat the typed odometer at fill-up as the source of truth. Wheelz (below) presents distance per trip, and its public description mentions "Mileage Tracking". Recommendation: keep "Distancia GPS" and "Odómetro" as separate concepts, and use trips to fill gaps and to remind the user ("¿Tu odómetro marca ~84 312 km?").

---

## 5. Live speed on the home tachometer

```ts
// useLiveSpeed.ts — foreground only
import * as Location from 'expo-location';
import { useKeepAwake } from 'expo-keep-awake';

export function useLiveSpeed(active: boolean) {
  const [kmh, setKmh] = useState(0);
  useEffect(() => {
    if (!active) return;
    let sub: Location.LocationSubscription | undefined, ema = 0, prev: Location.LocationObject | undefined;
    Location.watchPositionAsync(
      { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: 0 },
      loc => {
        const s = effectiveSpeed(prev, loc); prev = loc;
        if (s == null || (loc.coords.accuracy ?? 99) > 30) return;
        const alpha = 0.35;                       // EMA: ~3 s response
        ema = alpha * s + (1 - alpha) * ema;
        setKmh(ema < 0.8 ? 0 : ema * 3.6);        // dead-band so parked shows 0
      }
    ).then(s => (sub = s));
    return () => sub?.remove();
  }, [active]);
  return kmh;
}
// In the Home tachometer component: if (tripLive) useKeepAwake('trip');   (hook must be called unconditionally -> put it in a child <KeepAwakeWhileDriving/> rendered only when live)
```

- Convert with km/h = m/s × 3.6. Drive the needle through a reanimated `withTiming(kmh, { duration: 900 })` so the 1 Hz updates look continuous.
- When a background trip is recording and the user opens the app, start this watcher as well. Two location clients at once is fine on Android (**from knowledge**). Show the "EN VIAJE" state from the `trip` row.
- `expo-keep-awake` offers `useKeepAwake(tag?, options?)` ("keep the screen awake for as long as the owner component is mounted"), `activateKeepAwakeAsync(tag)`, `deactivateKeepAwake(tag)` and `isAvailableAsync()`. On web it uses the Wake Lock API, and support is limited per browser.

---

## 6. Wheelz

- `wheelz.app`, `www.wheelz.app` and `wheelzapp.com` could not be fetched (robots/connect errors). `getwheelz.com` redirects to a GoDaddy for-sale page. `play.google.com` is blocked by robots.
- **APKPure lists "Wheelz - Social Drive Tracker"** by **Vortac Labs Inc**, package `com.gigamow.wheelz`, v4.6, updated 2026-09-16, Android 8.0+. Tagline: "Track your Drives, Share with Friends, Speedometer and Mileage Tracking". The listed features below come from the fetch tool's summary, not verbatim text:
  - automatic trip detection and background tracking
  - live drive view with real-time speed
  - post-trip breakdown (top speed, average speed, distance, duration, route)
  - timeline of drives
  - speed leaderboards
  - vehicle profile (make/model/year)
  - dark map interface
  - disclaimer: "Wheelz is not a competition, you must follow all road laws…"
- `vortaclabs.com` also redirects to a for-sale page. I found nothing about how Wheelz detects drives internally, so I have not claimed anything about its implementation.
- What maps to Car Guy: auto trips, live speed, per-trip stats, a timeline and the dark route visual. The leaderboards and social features are out of scope. If a "top speed" is ever shown prominently, add a similar road-law disclaimer.

---

## 7. Web (static export on Vercel)

- expo-location on web wraps `navigator.geolocation`. It works in the foreground only, needs HTTPS (a secure context; Vercel qualifies) and stops when the tab is hidden or the screen locks (**from knowledge**). MDN: `speed` is in m/s and "null if the implementation is not able to measure it", so the haversine fallback matters even more on web.
- TaskManager, background location, motion activity and FGS are not available on web. Gate them with `Platform.OS !== 'web'` and never call `defineTask` or `startLocationUpdatesAsync` there. Put the task import in a `.native.ts` file (`tripTask.native.ts` plus an empty `tripTask.ts`) so the web bundle never pulls it in.
- Web UI: offer a manual "Iniciar viaje" only, with a warning to keep the tab open, and use `useKeepAwake` where the Wake Lock API is supported. Show the rest (history, SVG routes, stats) from synced data. expo-sqlite on web is **alpha** and needs COOP/COEP headers (`Cross-Origin-Embedder-Policy: credentialless`, `Cross-Origin-Opener-Policy: same-origin`). The app presumably handles this already; add the headers in `vercel.json` if it doesn't.

---

## Implementation checklist

1. Plugin config (§1.1), then rebuild the APK. Background location will not work until native permissions are compiled in.
2. `src/tasks/tripTask.native.ts` with `defineTask` at module scope, imported from the entry.
3. Pure `stepStateMachine()` and `finalizeTrip()` with unit tests on recorded GPX-like fixtures.
4. SQLite migration for `trip`, `trip_point` and `kv`, plus Supabase sync for `trip` only.
5. Onboarding: permission sequence, then a MIUI checklist, then `startLocationUpdatesAsync(TRIP_TASK, OPTIONS.watching)` while in the foreground. On every app open, check `hasStartedLocationUpdatesAsync` and re-arm.
6. Home: `useLiveSpeed` wired to the tachometer, a Start/Stop button, and keep-awake while live.
7. Trip detail: an SVG route card and stats. Odometer: an estimate plus a "confirm reading" prompt.
8. Field test on the Redmi: screen off for 30+ minutes, one drive, one walk (must be rejected) and traffic-light stops (the trip must not split).

---

## Sources (actually fetched)

- https://docs.expo.dev/versions/v57.0.0/sdk/location/ (fetched 3 times: options, motion activity, permissions)
- https://docs.expo.dev/versions/v57.0.0/sdk/task-manager/
- https://docs.expo.dev/versions/v57.0.0/sdk/maps/
- https://docs.expo.dev/versions/v57.0.0/sdk/keep-awake/
- https://docs.expo.dev/versions/v57.0.0/sdk/sqlite/
- https://raw.githubusercontent.com/expo/expo/main/packages/expo-location/plugin/src/withLocation.ts
- https://raw.githubusercontent.com/expo/expo/main/packages/expo-location/src/Location.types.ts
- https://raw.githubusercontent.com/expo/expo/main/packages/expo-location/android/src/main/AndroidManifest.xml
- https://raw.githubusercontent.com/expo/expo/main/packages/expo-location/CHANGELOG.md
- (404) https://raw.githubusercontent.com/expo/expo/main/packages/expo-location/android/src/main/java/expo/modules/location/records/LocationResponse.kt
- https://developer.android.com/develop/sensors-and-location/location/permissions/background
- https://developer.android.com/develop/background-work/services/fgs/restrictions-bg-start
- https://developer.android.com/develop/background-work/services/fgs/service-types
- https://developer.android.com/reference/android/location/Location#getSpeed()
- https://developer.mozilla.org/en-US/docs/Web/API/GeolocationCoordinates/speed
- https://dontkillmyapp.com/xiaomi
- https://github.com/transistorsoft/react-native-background-geolocation
- https://docs.transistorsoft.com/react-native/ and https://docs.transistorsoft.com/react-native/setup/
- https://www.transistorsoft.com/shop/products/react-native-background-geolocation (redirected) → https://shop.transistorsoft.com/
- https://registry.npmjs.org/react-native-activity-recognition
- https://github.com/maplibre/maplibre-react-native
- https://registry.npmjs.org/@maplibre/maplibre-react-native/latest
- https://github.com/react-native-maps/react-native-maps
- https://operations.osmfoundation.org/policies/tiles/
- https://registry.npmjs.org/@mapbox/polyline/latest and https://github.com/mapbox/polyline
- https://registry.npmjs.org/simplify-js/latest
- https://apkpure.com/search?q=wheelz and https://apkpure.com/wheelz-social-drive-tracker/com.gigamow.wheelz
- Not reachable: https://wheelz.app, https://www.wheelz.app, https://wheelzapp.com (robots/connect errors); https://getwheelz.com and https://vortaclabs.com (redirect to GoDaddy for-sale); https://play.google.com/store/search?q=wheelz%20car%20trips (robots)
