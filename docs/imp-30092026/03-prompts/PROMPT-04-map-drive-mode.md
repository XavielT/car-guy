# PROMPT 04 — Real map (MapLibre), Modo conducir, centre button in the tab bar

**Depends on:** Phase 2 (Phase 3 preferred, for strings) · **Branch:** `imp-30092026/phase-4-map-drive` · **ADRs:** 41, 42, 43 · **Size:** XL
**Goal:** G3.

> **Before running:** the Redmi on USB; a **new native build** is needed (MapLibre native module);
> disk space for the build; no x-core SQL. Xaviel's real drive is the final check (manual checklist).
>
> **How to run:** `cd` to the repo folder, `claude`, paste below the line.

---

```
Phase 4 of IMP 30092026: the route on a real map, a full-screen drive mode, and the centre button.
Notes 13, 16 (map half), 17.

Read first:
- docs/imp-30092026/01-research/01-maplibre-expo.md (ALL — v11 API renames, web maplibre-gl@5 pin,
  OpenFreeMap dark style + MapTiler fallback, per-segment colours, heatmap, drive mode camera,
  attribution, install plan with the TripMap/TripMap.web pair)
- docs/imp-30092026/01-research/05-wheelz-firsthand.md (from Phase 0) and 04-wheelz-observed.md
  from the last cycle: what the drive view and drive detail look like first-hand
- docs/imp-30092026/02-specs/03-screens.md "Phase 4"; ADR-41, 42, 43
- docs/imp-30092026/01-research/04-mockups/NavConducir.dc.html, ModoConducir.dc.html
- app/(tabs)/_layout.tsx, app/viaje/[id].tsx, app/viajes/*, lib/trips/present.ts, tiles.ts,
  liveStore.ts, live.ts, components/ui/ClusterHero.tsx (speed mode), lib/trips/settings.ts,
  vercel.json (Permissions-Policy geolocation), app/+html.tsx

Branch: imp-30092026/phase-4-map-drive

1. INSTALL: npx expo install @maplibre/maplibre-react-native (≥ 11.4; pin), maplibre-gl@5.24.x
   (web only import), app.json plugin "@maplibre/maplibre-react-native"; lib/map/config.ts
   (STYLE_DARK = OpenFreeMap dark, MAPTILER fallback key from EXPO_PUBLIC_MAPTILER_KEY when
   set, health check cached 1 h, attribution text); components/map/TripMap.tsx (native: MLMap,
   mapStyle, GeoJSONSource + Layer line with data-driven line-color by speed bucket, Camera fit
   bounds with padding, start/end ViewAnnotations, replay marker) and TripMap.web.tsx (dynamic
   import of maplibre-gl + CSS import, same GeoJSON, fitBounds); components/map/HeatMap.* (heatmap
   layer from sampled points, opacity by density); components/map/LiveMap.* (trackUserLocation
   course, growing trail source updated ≤ 1 Hz, re-centre button after a pan). Expo Go guard card.
   Everything else imports only from components/map.
2. ROUTE GEOJSON: lib/trips/geojson.ts — from trip_point (≤ 30 d) else the decoded polyline;
   segments with speed bucket property; bbox. Tests.
3. TRIP DETAIL: TripMap replaces the OSM mosaic in app/viaje/[id].tsx (the mosaic remains for the
   share image and as the offline fallback when the style fails to load — show a banner "Sin mapa
   en línea"); replay dot moves on the map; "Ver en mapa" external link removed (it is the map);
   attribution footer; long-press → diagnostics (raw/simplified/dropped + export).
4. HEATMAP: app/viajes "Por dónde manejas" → HeatMap over the MapLibre map with period chips.
5. TAB BAR (note 17, ADR-43): custom tabBar for expo-router Tabs: Inicio · Garaje · [centre] ·
   Historial · Más per the mockup — the disc (64 px, #E10600, white tachometer glyph, ring, shadow,
   raised 18 px), amber pulsing ring + "REC" while liveStore says recording (the loop ends with
   the trip), label CONDUCIR; accessibilityLabel/role button; safe-area aware; web identical.
   Cifras leaves the bar → Más first row (icon + "Cifras") and an Inicio quick-action tile; every
   push to '/(tabs)/cifras' updated (audit (j)); route file moves to app/cifras.tsx (stack) with
   the same content. Deep links to /cifras keep working (vercel rewrite).
6. MODO CONDUCIR: app/conducir.tsx modal per 03-screens.md — LiveMap full-bleed, compact speed
   cluster overlay (reuse ClusterHero speed mode at 0.6 scale or a new CompactSpeed), scrim,
   bottom sheet with vehicle chip, mode, INICIAR/TERMINAR, PASAJERO, keep-awake, orientation
   unlocked on this screen only (expo-screen-orientation), Back keeps recording. No trip: last
   trip mini card + "Ver viajes" + the mode switch. Web: manual only; asks geolocation.
   Wheelz first-hand notes decide the small things (what the live view shows first, where the
   stop button sits) — cite them in the report.
7. SETTINGS: Viajes → Ajustes: "Mapa" (en línea / apagado — keeps the old switch), attribution
   link, "Estilo" (oscuro fijo; no picker). Flags FEATURE_MAP_V2 + FEATURE_DRIVE_MODE → true.
8. TESTS: geojson builder, bucket colours, bbox/fit maths (pure), tab bar recording state
   reducer. Size: report APK delta (universal) and web bundle delta (maplibre lazy chunk).

VERIFY: emulator GPX (docs/imp-29092026/fixtures/drive-synthetic.gpx) → drive mode shows the map
following the car with the coloured trail; finished trip's detail shows the route on streets? —
the synthetic GPX is straight lines by design: assert only that the map renders the points as
recorded; the STREET check is Xaviel's real drive on the Redmi (manual checklist: drive 10 min
with Modo conducir open, then look at the detail — the line must follow the streets; export the
GeoJSON if not). Web: trip detail map renders, heatmap renders, drive mode manual trip in
Chrome with a sensor override. Screenshots docs/qa/imp-30092026-phase-4-*.png (bar, drive mode,
detail, heatmap, dark style attribution). Report block; Notes closed: 13, 16, 17.
```
