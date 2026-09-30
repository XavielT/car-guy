# 01 — Interactive trip maps with MapLibre (Expo SDK 57, Android + static web)

Research date: 2026-09-30. Fetched live with WebFetch. Anything not confirmed on a fetched page is marked **unverified (from knowledge)**.

## TL;DR

- **Native:** use `@maplibre/maplibre-react-native` **v11.x** (npm `latest` = **11.4.0**). It supports **only the New Architecture**, needs RN >= 0.80 and React >= 19.1, and lists `expo >= 54` as an optional peer. Expo SDK 57 ships **RN 0.86 / React 19.2.3**, so it fits. Install with `npx expo install` and add `"@maplibre/maplibre-react-native"` to `plugins`. It does not run in Expo Go, so you need a dev build or an EAS local build.
- **v11 renamed the API** (this matters because most tutorials online show v10): `MapView→Map`, `styleURL→mapStyle`, `ShapeSource→GeoJSONSource`, and `LineLayer/HeatmapLayer/...` became one `<Layer type="line" paint={{ "line-color": ... }}>` that uses the GL-JS style-spec keys. On `Camera`, `followUserLocation/followUserMode` became `trackUserLocation: "default" | "heading" | "course"`. `PointAnnotation` became `ViewAnnotation`.
- **Web:** use `maplibre-gl` directly in `TripMap.web.tsx`. Expo Metro **does support global CSS imports on web by default**, so `import "maplibre-gl/dist/maplibre-gl.css"` works and you don't need to inline the CSS. The catch is that **maplibre-gl v6 (latest 6.11.2) is ESM-only and loads its worker from a separate URL**, which is awkward under Metro. Recommendation: **pin `maplibre-gl@5.24.0`**, the last v5, which is a single UMD file with the worker inlined, or use v6 and copy its worker files into `public/`.
- **Tiles: OpenFreeMap** for both platforms. It needs no key, has no request limits, allows commercial use, and **has a `dark` style** (`https://tiles.openfreemap.org/styles/dark`). The trade-off is that it is "as-is" with no SLA. **Fallback: MapTiler free tier** (`streets-v2-dark` / `dataviz-dark`, key required, 100k requests and 5k sessions/month, **non-commercial only**, logo required).
- **Streets-following route:** the straight segments come from **sparse points**, not from missing map matching. Record at 1 s / 5 m and simplify at 3–5 m. Keep raw points for 30 days. **Skip map matching** for a personal app. If you ever want it, Stadia's free tier includes map matching.

---

## 1. `@maplibre/maplibre-react-native`

### Version and requirements (verified)
- npm `latest`: **11.4.0**. Peer dependencies: `react >=19.1.0`, `react-native >=0.80.0`, `expo >=54.0.0` (optional), `@types/geojson` (optional). Runtime dependencies are Turf helpers and `@maplibre/maplibre-gl-style-spec` 26.2.1.
- The Getting Started docs say: "From v11 onwards, only the new architecture is supported". They also require Android API >= 23. Bundled native versions: Android **13.6.1**, iOS **6.31.0**.
- Recent GitHub releases include v11.3.4 (June 2026), "Android compatibility update for React Native >= 0.87", and v11.3.6, an Android fix to "guard stale map child indexes". The library is actively tracking new RN releases, so **RN 0.86 (SDK 57) is inside the supported range**.
- Expo SDK 57 = RN 0.86, React 19.2.3, react-native-web 0.21.0 (docs.expo.dev/versions/latest).

### Expo config plugin (verified)
```json
{ "expo": { "plugins": ["@maplibre/maplibre-react-native"] } }
```
- Per the docs, the plugin is **essential on iOS** because it adds Podfile post-install steps. **On Android it "primarily handles customizations"**, which means Android autolinking works without any manual Gradle edits. `expo prebuild` and `eas build --local` should work as-is.
- Plugin props: `{ android: { nativeVersion }, ios: { nativeVersion } }`.
- Android Gradle properties, prefix `org.maplibre.reactnative.`:
  - `nativeVersion`, `nativeVariant` (`opengl` default, or `vulkan`), `pluginVersion`, `turfVersion`, `okhttpVersion`.
  - `locationEngine`: `default` (device-native) or `google` (Play Services). Keep **`default`** so you don't pull in Play Services location.
- "Can't be used with Expo Go".

### v11 component map (verified from the v11 migration guide)
| Need | v11 API |
|---|---|
| Map view | `<Map mapStyle="https://…/style.json">` (it was `MapView`/`styleURL`). `mapStyle` also accepts a style object. |
| Camera | `<Camera ref initialViewState center zoom bearing pitch padding duration easing trackUserLocation>` |
| Fit route | `cameraRef.current.fitBounds([w,s,e,n] as LngLatBounds, { padding, duration })` |
| GeoJSON | `<GeoJSONSource id data lineMetrics tolerance maxzoom buffer>`. `tolerance` defaults to 0.375 (Douglas–Peucker applied at tile level). |
| Line / heatmap / circle | `<Layer id type="line" source=… paint={{ "line-color": …, "line-width": … }} layout={…} beforeId>` |
| Markers | `ViewAnnotation` (was `PointAnnotation`); `Marker` (RN children, always on top); `LayerAnnotation`. The docs recommend Circle/Symbol layers for many points. |
| User puck | `UserLocation` (props `animated`, `accuracy`, `heading`, `minDisplacement`), plus `NativeUserLocation` for native rendering. The `useCurrentPosition` hook replaces `onUpdate`. |
| Permissions | `LocationManager.requestPermissions()` |
| Ornaments | `Map` props: `attribution`, `attributionPosition`, `logo`, `compass`, `scaleBar`, each taking a `{top/bottom/left/right}` position |
| Android view | `androidView: "surface" \| "texture"` (default `surface`). Use `texture` if the map sits inside animated or scrolling views and shows clipping or z-order glitches. **Unverified (from knowledge):** this is the usual fix. |

**Naming gotcha:** `Map` shadows the JS global `Map`. Import it as `import { Map as MLMap } from "@maplibre/maplibre-react-native"`.

### Per-segment colors (speed-colored route)
- `line-color` supports data-driven expressions (style spec). The simplest approach: split the route into N LineString features, each carrying a `speed` property. Then use `"line-color": ["interpolate", ["linear"], ["get","speed"], 0,"#3b82f6", 60,"#22c55e", 100,"#eab308", 130,"#ef4444"]`. **Merge consecutive segments that fall in the same speed bucket** to keep the feature count low.
- `line-gradient` gives a smooth gradient along one line. It requires `lineMetrics: true` on the source and is driven by `["line-progress"]`, which runs from 0 to 1. It is **not** property-driven, so you would build the stops yourself as pairs of `(cumulativeDistance/totalDistance, color)`. That works, but multi-feature `line-color` is easier to debug. Use `line-gradient` only if you want a perfectly smooth blend.
- Add a wider, darker "casing" line layer under the colored line so the route reads well on both dark and light styles.

### Styles, dark mode, attribution
- `mapStyle` takes the style URL. The OpenFreeMap styles are listed in §3. Switch to the `dark` URL for night or JDM mode.
- On native, attribution comes from the style's `attribution` fields and shows in the ornament. **Keep `attribution` enabled.** OpenFreeMap requires "OpenFreeMap © OpenMapTiles Data from OpenStreetMap", and the OpenFreeMap part is optional.

### Offline
- `OfflineManager` exists. In v11, packs use a UUID `id`, `createPack` returns the pack, and listeners use `addListener`/`removeListener`. The ambient tile cache works automatically.
- **Do not bulk-prefetch OpenFreeMap or OSM regions.** OpenFreeMap's ToS says automated data collection requires permission. If you need an offline area, self-host (see Protomaps/OpenFreeMap self-host in §3).

### Known Android issues
- I could not read the GitHub issue list: the tree and issues pages are blocked by robots.txt for the fetcher. From release notes: stale child index crash (fixed 11.3.6), RN 0.87 compatibility (11.3.4), source-layer bounds (11.3.2). Pin **>= 11.3.6**.
- **Unverified (from knowledge):** reported pitfalls are map flicker or black flashes inside `react-native-screens` transitions (switching to `androidView="texture"` helps), and a slower first style load on cold start.

---

## 2. Web: `maplibre-gl` inside React Native Web (static export)

### Facts (verified)
- `maplibre-gl` latest = **6.11.2** (dist-tags). **v6 is ESM-only.** The UMD `maplibre-gl.js` and CSP builds were removed. The worker loads as a real URL (`maplibre-gl-worker.mjs`, set with `setWorkerUrl()`/`workerUrl`), shared code is split into `maplibre-gl-shared.mjs`, and WebGL2 is mandatory.
- v6 dist sizes (raw, minified): `maplibre-gl.mjs` 590 KB, `maplibre-gl-shared.mjs` 516 KB, `maplibre-gl-worker.mjs` 19 KB, `maplibre-gl.css` 83 KB.
- The last v5 is **5.24.0**. Its dist has `maplibre-gl.js` at 1.06 MB minified (worker inlined as a blob) and `maplibre-gl.css` at 70 KB.
- Expo Metro: **global CSS imports are enabled by default on web and ignored on native**, including CSS from `node_modules`. `public/` is copied into `dist/` on export (avoid `public/assets`). Metro web workers are "alpha". Package `exports` are supported (SDK 53+). The maplibre-gl exports map exposes `dist/*`.
- CSP: not set in this app. If one is added later, v6 needs `worker-src 'self'` and `img-src data: blob: 'self'`.

### Recommendation
**Option A (simplest, recommended): `npx expo install maplibre-gl@5.24.0`.**
- It is a single file, the worker is inlined, and there is no worker-URL plumbing under Metro.
- The API is the same for everything we need: `Map`, `addSource`, `addLayer`, `fitBounds`, `line-gradient`, `heatmap`.
- Import the CSS from the `.web.tsx` file: `import "maplibre-gl/dist/maplibre-gl.css"`.

**Option B (v6):**
1. Copy `node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs` and `maplibre-gl-shared.mjs` into `public/maplibre/` with a `postinstall` script.
2. Call `setWorkerUrl("/maplibre/maplibre-gl-worker.mjs")` before creating the map.

Whether Metro transforms v6's internal `import.meta`/worker URL logic cleanly is **unverified**. Test it with `expo export -p web` before committing to it.

**Fallback for CSS:** `<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/maplibre-gl@5.24.0/dist/maplibre-gl.css">`, injected at runtime. The app has no CSP, so this is allowed. With the Metro CSS import available, you shouldn't need it.

**Lazy loading:**
- Keep `TripMap.web.tsx` free of top-level `maplibre-gl` imports.
- Do `const maplibregl = (await import("maplibre-gl")).default` inside `useEffect`. With v6 use `import * as maplibregl`.
- Expo Router with bundle splitting emits a separate chunk, so the ~1 MB (min) only loads on trip screens. **Unverified (from knowledge):** in static export, async `import()` produces a split chunk when `web.output: "static"` is used with async routes. Verify by checking `dist/_expo/static/js/web/` for a separate chunk.

### `react-map-gl` as an alternative
`react-map-gl/maplibre` (v8) supports maplibre-gl 4, 5 and 6. It gives declarative `<Source>`/`<Layer>` components that are nearly identical to the native v11 API, which is nice for keeping the two files symmetric. It adds another dependency and the same CSS and worker concerns. It is optional: for two screens, the imperative `maplibre-gl` code is small enough.

---

## 3. Free vector tiles and styles

| Provider | Key | Free quota | Commercial | Dark style | Notes |
|---|---|---|---|---|---|
| **OpenFreeMap** | none | "no limits on the number of map views or requests" | allowed (ToS doesn't restrict) | **yes: `dark`**, plus `fiord` (dark blue-grey) | "no SLA guarantees"; can be discontinued "at any time without notice"; self-hostable |
| **MapTiler Cloud Free** | required | 5,000 map sessions and 100,000 API requests per month | **not allowed** | `streets-v2-dark`, `dataviz-dark`, `basic-v2-dark` | MapTiler logo required; the service **pauses until next month** when over limit; Flex plan $30/mo |
| **Stadia Maps Free** | API key on mobile; domain auth on web | 200,000 credits/month | **not allowed** | Alidade Smooth Dark | Starter plan $20/mo (commercial); localhost works keyless; map matching included |
| **Protomaps (self-host PMTiles)** | none (your CDN) | pay-per-storage and egress | yes | light/dark "flavors" | planet ≈ 120 GB (z0–15); extract a region with `pmtiles extract --bbox … --maxzoom`; each extra zoom level ~doubles the size |
| **OSM raster (`tile.openstreetmap.org`)** | none | best-effort | limited | no | see below |

**OpenFreeMap style URLs (verified):**
- `https://tiles.openfreemap.org/styles/liberty`
- `…/bright`
- `…/positron`
- `…/dark`
- `…/fiord`

"For mobile apps, you can use the same styles with MapLibre Native." The `3D` style is also listed on the home page.

**Why the current OSM raster mosaic is only tolerable at tiny scale.** The OSMF tile policy:
- requires a **specific User-Agent**, not a library default;
- requires local caching, honouring headers or a minimum of 7 days;
- has no SLA, and access "may be blocked without notice";
- **bans bulk downloading**, meaning any tile fetch the user isn't actively viewing, so offline pre-seeding is out;
- requires visible attribution.

A static mosaic that fetches tiles for trip thumbnails is borderline pre-fetching and runs without a proper UA from RN `Image`. Moving to OpenFreeMap vector tiles removes that exposure.

**Protomaps sizing for the Dominican Republic:**
- **Unverified (from knowledge):** a DR extract at maxzoom 15 is roughly 100–250 MB. Storage and egress on Cloudflare R2 are effectively free at personal scale, since R2 has no egress fees.
- On native, MapLibre Native supports the `pmtiles://` protocol in recent versions. **Unverified (from knowledge):** check the MLN Android 13.x changelog before relying on it.
- On web, the `pmtiles` npm protocol add-on is needed.
- This is the best path if OpenFreeMap ever disappears or if you want real offline maps.

**Recommendation:** **OpenFreeMap** for both platforms. Use `dark` as the default in the JDM UI and `liberty` for light mode. Put the URL in one constant (`MAP_STYLES`) so switching providers is a one-line change. **Fallback:** a MapTiler free key in an env var, acceptable because this is personal and non-commercial. Long-term offline or robustness: self-hosted Protomaps DR extract on R2.

---

## 4. Making the route follow the streets

**Why it looks like straight segments.** The map isn't the problem; the geometry is:
1. **Sparse sampling.** `timeInterval` or `distanceInterval` are too large. At 60 km/h, a 10 s interval is 167 m between points, which cuts every curve.
2. **Deferred updates.** `deferredUpdatesInterval`/`deferredUpdatesDistance` only batch *delivery* in the background. On Android, combined with low accuracy or Doze, they can also thin the fixes.
3. **Douglas–Peucker tolerance too high.** At 8 m, gentle curves collapse into chords, and at intersections the line cuts corners visibly at zoom 16+.
4. **Rendering only the encoded simplified polyline**, or only start and end after raw points are purged.
5. The map-side `GeoJSONSource tolerance` (default 0.375 px) is fine and not the cause.

**Settings to use while recording** (expo-location `startLocationUpdatesAsync`):
- `accuracy: Location.Accuracy.BestForNavigation`
- `timeInterval: 1000` (Android only)
- `distanceInterval: 5`
- `activityType: AutomotiveNavigation` (iOS)
- `foregroundService` notification (required for background on Android)
- Keep deferred values small (`deferredUpdatesInterval: 1000–5000`) or leave them unset.

**Storage policy:**
- Keep **raw points for 30 days** so detail maps use them.
- Store a **3–5 m Douglas–Peucker polyline** on the trip row permanently (for thumbnails and history after the purge). 1 Hz for a 1 h drive is about 3,600 points; simplified at 4 m, that is typically a few hundred. **Unverified (from knowledge):** typical reduction ratio.
- Drop fixes with `accuracy > 25–30 m`, plus speed/jump outliers, before simplifying.

**Map matching (optional):**
- **OSRM demo** (`router.project-osrm.org`, `/match/v1/driving/{coords}`): "Do not exceed 1 request per second", "reasonable, non-commercial use-cases", no uptime guarantee. OK for experiments; don't ship an app on it.
- **Stadia Map Matching** (`https://api.stadiamaps.com/map_match/v1`, Valhalla-based): **available on the Free plan**. It accepts encoded polyline6 or coordinate arrays and has high point limits. Credit cost per request was not shown.
- **Mapbox Map Matching:** 100,000 requests/month free, then $2.00 per 1,000. It needs a Mapbox account and token, and Mapbox terms may require showing results on Mapbox maps (**unverified**).
- **Recommendation:** **don't map-match by default.** Denser points at 1 s / 5 m already hug the streets on OSM geometry. The Dominican Republic's OSM road coverage outside Santo Domingo and Santiago is patchier (**unverified**), and a bad match is worse than an honest GPS trace. If you add it later: a one-time "Snap to roads" action per trip through Stadia Free, store the result as a separate polyline, and keep the raw one.

---

## 5. Heatmap of all trips

- **Option 1: `heatmap` layer** (`<Layer type="heatmap">` natively; `addLayer({type:"heatmap"})` on web).
  - Feed a FeatureCollection of **Points**, not lines.
  - Sample each trip's simplified polyline at a fixed spacing, for example **every 25–50 m**, so dense city driving doesn't dominate from GPS density alone.
  - Paint: `heatmap-weight` (1, or scaled by the number of trips), `heatmap-intensity` interpolated by zoom, `heatmap-radius` 8→20 px by zoom, and `heatmap-color` interpolated on `["heatmap-density"]` using the JDM palette. Fade `heatmap-opacity` to 0 at z15 and switch to lines there.
- **Option 2: stacked lines.** All trip polylines go into one source as one `line` layer with `line-opacity: 0.08–0.15` and `line-width` 2–3. Overlaps accumulate, which gives a "most driven roads" look that stays street-accurate at every zoom.
- **Recommendation:** use Option 2 as the default ("Mis rutas"), since it's cheap and readable, and add a heatmap toggle for the zoomed-out view.
- Precompute the GeoJSON once and cache it as a file or SQLite blob. Pass it by `data` URL or object. Tens of thousands of points are fine for MapLibre. **Unverified (from knowledge):** exact limits depend on the device.

---

## 6. Live "drive mode" map

- **Camera:** `<Camera trackUserLocation="course" zoom={16} pitch={45}>` gives course-up navigation. `"heading"` uses the compass, which is worse in a car. `onTrackUserLocationChange` fires when the user pans and breaks tracking; show a "recenter" button then.
- **Puck:** `<UserLocation heading animated />` or `NativeUserLocation`.
- **Trail performance:** each change to `data` on `GeoJSONSource` re-serializes the whole object across JSI and re-tiles it. **Unverified (from knowledge):** fine up to a few thousand vertices at 1 Hz, but it degrades over long drives. Use two sources:
  - `trail-committed`: all points so far, pre-segmented by speed bucket, updated every 10–15 s;
  - `trail-tail`: the last ~15 points, updated every second.

  Keep the arrays in a ref and build GeoJSON outside render. Don't call React `setState` per fix on the whole screen; isolate the map in a memoized component. Also consider `preferredFramesPerSecond={30}` to save battery.
- **Keep-awake:** `expo-keep-awake` (`useKeepAwake()`) only on the drive-mode screen.
- **Night style:** switch `mapStyle` to OpenFreeMap `dark` based on the app theme or time of day. Swapping the style reloads it; declarative `GeoJSONSource`/`Layer` children are re-added automatically by the library (**unverified (from knowledge)**, test it).

---

## 7. Size impact

- **APK.** **Unverified (from knowledge):** the MapLibre Native Android `.so` is roughly 4–7 MB per ABI. A universal APK with 4 ABIs grows by about 15–25 MB, while an arm64-only APK grows by about 5–8 MB. Mitigation: build only `arm64-v8a` for the personal APK with `reactNativeArchitectures=arm64-v8a` in `gradle.properties`, settable through the `expo-build-properties` plugin or a small config plugin (**unverified**). Measure before and after with `eas build --local` and compare the APK size.
- **Web.**
  - v5.24.0: `maplibre-gl.js` is 1.06 MB minified; v6 is `mjs` 590 KB plus `shared` 516 KB plus worker. **Unverified (from knowledge):** about 250–300 KB gzip on the wire.
  - CSS: 70–83 KB raw.
  - **Lazy-load** it with dynamic `import()` inside `TripMap.web.tsx`, so it only loads on trip, drive and heatmap screens.
  - Tiles and fonts come from OpenFreeMap at runtime and are not bundled.

---

## 8. Concrete install and config plan

```bash
npx expo install @maplibre/maplibre-react-native   # native, v11.x (>=11.3.6)
npx expo install maplibre-gl@5.24.0               # web (see §2 Option A)
npx expo install expo-keep-awake                  # drive mode
```

`app.json`:
```json
{
  "expo": {
    "plugins": [
      ["@maplibre/maplibre-react-native", { "android": {} }]
    ]
  }
}
```
Optionally add `android/gradle.properties` via a config plugin: `org.maplibre.reactnative.locationEngine=default`. After that, run `npx expo prebuild --clean` and then `eas build -p android --profile preview --local`.

`src/features/map/mapStyles.ts`:
```ts
export const MAP_STYLES = {
  dark: "https://tiles.openfreemap.org/styles/dark",
  light: "https://tiles.openfreemap.org/styles/liberty",
} as const;
export const MAP_ATTRIBUTION = "OpenFreeMap © OpenMapTiles · Datos © colaboradores de OpenStreetMap";
```

`routeGeoJSON.ts` (shared by both platforms):
```ts
import type { FeatureCollection, LineString } from "geojson";
type P = { lat: number; lng: number; speedKmh: number };
const bucket = (s: number) => (s < 20 ? 0 : s < 60 ? 1 : s < 90 ? 2 : s < 120 ? 3 : 4);

export function routeToSegments(pts: P[]): FeatureCollection<LineString, { speed: number }> {
  const features: any[] = [];
  let cur: [number, number][] = [], curB = -1, speedSum = 0, n = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], b = bucket(p.speedKmh);
    if (curB !== -1 && b !== curB && cur.length > 1) {
      features.push({ type: "Feature", properties: { speed: speedSum / n },
        geometry: { type: "LineString", coordinates: cur } });
      cur = [cur[cur.length - 1]]; speedSum = 0; n = 0;       // share the joint vertex
    }
    cur.push([p.lng, p.lat]); speedSum += p.speedKmh; n++; curB = b;
  }
  if (cur.length > 1) features.push({ type: "Feature", properties: { speed: speedSum / n },
    geometry: { type: "LineString", coordinates: cur } });
  return { type: "FeatureCollection", features };
}

export function bbox(pts: P[]): [number, number, number, number] {
  let w = 180, s = 90, e = -180, n = -90;
  for (const p of pts) { w = Math.min(w, p.lng); e = Math.max(e, p.lng); s = Math.min(s, p.lat); n = Math.max(n, p.lat); }
  return [w, s, e, n];
}

export const SPEED_COLOR = ["interpolate", ["linear"], ["get", "speed"],
  0, "#3b82f6", 40, "#22c55e", 80, "#eab308", 110, "#f97316", 130, "#ef4444"] as const;
```

`TripMap.tsx` (native):
```tsx
import { useRef } from "react";
import { Map as MLMap, Camera, GeoJSONSource, Layer, type CameraRef } from "@maplibre/maplibre-react-native";
import { MAP_STYLES } from "./mapStyles";
import { routeToSegments, bbox, SPEED_COLOR } from "./routeGeoJSON";

export function TripMap({ points, dark = true }: { points: P[]; dark?: boolean }) {
  const cam = useRef<CameraRef>(null);
  const data = routeToSegments(points);                 // memoize in real code
  const b = bbox(points);
  return (
    <MLMap mapStyle={dark ? MAP_STYLES.dark : MAP_STYLES.light}
           attribution attributionPosition={{ bottom: 8, right: 8 }}
           logo={false} compass scaleBar={false} style={{ flex: 1 }}
           onDidFinishLoadingMap={() => cam.current?.fitBounds(b, { padding: { top: 40, right: 40, bottom: 40, left: 40 }, duration: 0 })}>
      <Camera ref={cam} initialViewState={{ bounds: b } as any} />
      <GeoJSONSource id="route" data={data}>
        <Layer id="route-casing" type="line" source="route"
               layout={{ "line-cap": "round", "line-join": "round" }}
               paint={{ "line-color": "#000", "line-width": 7, "line-opacity": 0.6 }} />
        <Layer id="route-line" type="line" source="route"
               layout={{ "line-cap": "round", "line-join": "round" }}
               paint={{ "line-color": SPEED_COLOR as any, "line-width": 4 }} />
      </GeoJSONSource>
    </MLMap>
  );
}
```
Check the exact shape of `initialViewState` and whether `Layer` inherits `source` from its parent in the v11 typings. Layers nested under a source typically inherit it (**unverified**).

`TripMap.web.tsx`:
```tsx
import { useEffect, useRef } from "react";
import { View } from "react-native";
import "maplibre-gl/dist/maplibre-gl.css";              // Metro web CSS (ignored on native)
import { MAP_STYLES } from "./mapStyles";
import { routeToSegments, bbox, SPEED_COLOR } from "./routeGeoJSON";

export function TripMap({ points, dark = true }: { points: P[]; dark?: boolean }) {
  const ref = useRef<View>(null);
  useEffect(() => {
    let map: any, cancelled = false;
    (async () => {
      const maplibregl = (await import("maplibre-gl")).default;   // v5; v6: import * as
      if (cancelled || !ref.current) return;
      map = new maplibregl.Map({
        container: ref.current as unknown as HTMLElement,
        style: dark ? MAP_STYLES.dark : MAP_STYLES.light,
        bounds: bbox(points), fitBoundsOptions: { padding: 40 },
        attributionControl: { compact: true },
      });
      map.on("load", () => {
        map.addSource("route", { type: "geojson", data: routeToSegments(points) });
        map.addLayer({ id: "route-casing", type: "line", source: "route",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": "#000", "line-width": 7, "line-opacity": 0.6 } });
        map.addLayer({ id: "route-line", type: "line", source: "route",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": SPEED_COLOR as any, "line-width": 4 } });
      });
    })();
    return () => { cancelled = true; map?.remove(); };
  }, [points, dark]);
  return <View ref={ref} style={{ flex: 1, minHeight: 280 }} />;
}
```
In RN-Web, a `View` ref resolves to the DOM `div`. The container needs an explicit height.

**Attribution requirements (text to keep visible):**
- OpenFreeMap: "OpenFreeMap © OpenMapTiles Data from OpenStreetMap". MapLibre adds this automatically from the style, so keep the attribution control on and don't hide it behind a toggle.
- If using the MapTiler fallback: the MapTiler logo is also required on the free plan.
- Also list "© OpenStreetMap contributors (ODbL)" on the app's About screen.

**Rollout order:**
1. Native `TripMap` on the trip detail screen.
2. Web `TripMap` with lazy import; verify with `expo export -p web` and Vercel.
3. Recording settings to 1 s / 5 m, DP 3–5 m, keep raw points 30 days.
4. Drive mode (course-up, two-source trail, keep-awake).
5. "Mis rutas" stacked lines plus heatmap toggle.
6. Remove the OSM raster mosaic.

---

## Sources (fetched)
- https://github.com/maplibre/maplibre-react-native
- https://raw.githubusercontent.com/maplibre/maplibre-react-native/main/README.md
- https://github.com/maplibre/maplibre-react-native/releases
- https://registry.npmjs.org/@maplibre/maplibre-react-native/latest
- https://maplibre.org/maplibre-react-native/
- https://maplibre.org/maplibre-react-native/docs/setup/getting-started
- https://maplibre.org/maplibre-react-native/docs/setup/expo
- https://maplibre.org/maplibre-react-native/docs/setup/library-customizations
- https://maplibre.org/maplibre-react-native/docs/setup/migrations/v10
- https://maplibre.org/maplibre-react-native/docs/setup/migrations/v11
- https://maplibre.org/maplibre-react-native/docs/components/map
- https://maplibre.org/maplibre-react-native/docs/components/camera
- https://maplibre.org/maplibre-react-native/docs/components/layer
- https://maplibre.org/maplibre-react-native/docs/components/sources/geo-json-source
- https://maplibre.org/maplibre-react-native/docs/components/annotations/user-location
- https://maplibre.org/maplibre-react-native/docs/guides/annotations
- https://registry.npmjs.org/maplibre-gl/latest
- https://registry.npmjs.org/-/package/maplibre-gl/dist-tags
- https://data.jsdelivr.com/v1/packages/npm/maplibre-gl@6.11.2
- https://data.jsdelivr.com/v1/packages/npm/maplibre-gl@5.24.0
- https://raw.githubusercontent.com/maplibre/maplibre-gl-js/main/CHANGELOG.md
- https://maplibre.org/maplibre-gl-js/docs/
- https://maplibre.org/maplibre-style-spec/layers/
- https://visgl.github.io/react-map-gl/docs/get-started
- https://docs.expo.dev/versions/latest/
- https://docs.expo.dev/versions/latest/config/metro/
- https://docs.expo.dev/guides/customizing-metro/
- https://docs.expo.dev/versions/latest/sdk/location/
- https://openfreemap.org/
- https://openfreemap.org/quick_start/
- https://openfreemap.org/tos/
- https://www.maptiler.com/cloud/pricing/
- https://docs.maptiler.com/cloud/api/maps/
- https://stadiamaps.com/pricing/
- https://docs.stadiamaps.com/
- https://docs.stadiamaps.com/authentication/
- https://docs.stadiamaps.com/routing/map-matching/
- https://docs.protomaps.com/
- https://docs.protomaps.com/basemaps/downloads
- https://operations.osmfoundation.org/policies/tiles/
- https://github.com/Project-OSRM/osrm-backend/wiki/Demo-server
- https://www.mapbox.com/pricing

Not fetchable (robots/404/403): GitHub `tree/main/docs` and the issues list (robots.txt), `docs.stadiamaps.com/map-matching/` (403), maplibre-gl-js v6 migration guide URL (404).
