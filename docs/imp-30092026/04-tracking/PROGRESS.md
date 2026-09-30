# Progress — IMP 30092026 (Car Guy 2.4 "Tōge")

Claude Code appends a report per phase (`00-context/04-conventions.md` §8). "Notes for the next
phase" carry context between sessions.

**Started:** 2026-09-30 · **Status:** Phase 0 done

## Phase status

| # | Phase | Status | Branch | Notes |
|---|---|---|---|---|
| 0 | Kickoff + Wheelz first-hand | ✅ | `imp-30092026/phase-0-kickoff` | package in repo, baseline green, audit + screen audit, GeoJSON export action, Wheelz walked |
| 1 | Fix pack 2.3.1 | 🟡 | `fix/2.3.1-fixpack` | detail + dedupe, stations, reserve light, ≈ por echada, denser routes; phone check + release pending |
| 2 | Schema v8 | ⬜ | | |
| 3A | Language es/en | ⬜ | | |
| 3B | Skeletons | ⬜ | | |
| 4 | Map · Modo conducir · centre button | ⬜ | | |
| 5 | Eventos · memoria · gomas · precios | ⬜ | | |
| 6 | Perfil · bienvenida · legal · release 2.4.0 | ⬜ | | |

⬜ not started · 🟡 in progress · ✅ done · 🔴 blocked

## Notes from the brief (00-context/01-project-brief.md §1)

| # | Note | Closed in | Status |
|---|---|---|---|
| 1 | Fuel prices: date picker, sources, history + analytics, MICM import | 5 | ⬜ |
| 2 | Language switch es/en | 3A | ⬜ |
| 3 | Tires changed: counter, badges, messages, share | 5 | ⬜ |
| 4 | Skeleton on every screen | 3B | ⬜ |
| 5 | Vehicle events with proofs | 5 | ⬜ |
| 6 | Vehicle details to remember | 5 | ⬜ |
| 7 | More fuel stations (Petronan…) | 1 | ⬜ |
| 8 | Fill-up save flow: detail, no duplicates | 1 | ⬜ |
| 9 | Partials count (≈ por echada) | 1 | ⬜ |
| 10 | Profile picture + default avatars | 6 | ⬜ |
| 11 | Welcome tutorial + tips | 6 | ⬜ |
| 12 | Reserve light only | 1 | ⬜ |
| 13 | Route on a real map | 4 | ⬜ |
| 14 | Study Wheelz over adb | 0 | ✅ 9 screens read-only → `01-research/05-wheelz-firsthand.md` (redacted PNGs in `wheelz/`) |
| 15 | Legal: terms, privacy, consent, deletion | 6 | ⬜ |
| 16 | Straight line instead of streets | 1 + 4 | ⬜ |
| 17 | Drive mode module with centre icon | 4 | ⬜ |

## Audit corrections (Phase 0)

Read-only audit of the code against 02-state-of-the-repo.md (2026-09-30, at 2.3.0 + the Phase 0 branch).

- **(a) Fill-up save → duplicates (note 8): confirmed.** `app/carga/nueva.tsx:25-29` re-keys the form only on
  focus; the review sheet is a Modal (`components/ui/Sheet.tsx`), so "Listo" (`onClose → setResult(null)`,
  `nueva.tsx:74`) leaves the filled form on screen. Guardar is never disabled (`components/FillUpForm.tsx:272`,
  no saving state); `upsertFillUp` (`lib/store.tsx:332-370`) makes a new id for every draft and nothing
  dedupes — Guardar → Listo → Guardar, or a fast double tap, writes two rows. Side bug: an edit overwrites
  `createdAt` (`store.tsx:339-345`). The form lives in `components/FillUpForm.tsx` (not `components/fuel/`).
- **(b)** `app/carga/[id].tsx` is the editor (FillUpForm + delete, `router.back()` on save). Historial opens it for
  fuel rows (`app/(tabs)/historial.tsx:274-277`); **Inicio has no tappable fuel rows** (only the quick action to
  `/carga/nueva`, `index.tsx:495`).
- **(c) Reserve (note 12):** the chip reads "En reserva" (`es.gauge.reserve`, reading "RESERVA"); on the Antes
  picker only; it greys the arc and saves `inReserve` with `gaugeBeforeEighths = null` (`FillUpForm.tsx:111-113`,
  `store.tsx:362-364`); `partialEconomy.levelBefore()` uses `reserveL ?? 0.1·C` (±reserve/2). **No screen edits
  `vehicle.reserve_volume_l`**, so the 10 % default always applies.
- **(d) Trips (note 16):** manual watch 1 s / 3 m BestForNavigation (`live.ts:73-74`); auto recording 1 s / 0 m
  BestForNavigation, batched 10 s; watching Balanced 15 s / 50 m, batched 60 s; single High 2 s / 10 m
  (`auto.ts:38-64`). `finalize.ts:98` `simplify(track, 8)` → polyline. `cleanTrack`: acc ≤ 30 m, jumps ≤ 70 m/s,
  then `dropExcursions` (300 m / 40 m/s / back within 12 fixes) — **only inside `stats()`**; the machine stores
  points with the accuracy + jump filters but **not** the excursion filter. Points kept 30 days
  (`tripOps.ts:16`, purge at store boot). **Draws:** `RouteSvg` uses raw points (thinned to 900) when present,
  **not cleaned**; `TripsHeatMap` (≤ 60 trips, 120 points each) and `RouteSparkline` use the 8 m polyline only.
  `tiles.ts` MAX_ZOOM 17. → The straight line is downstream of recording; Phase 1 checks his export.
- **(e) STATIONS** (`lib/fuel.ts:99-108`): Texaco, Shell, TotalEnergies, Next, Isla, Esso, Pueblo, Otra — used
  only in FillUpForm (chips; "Otra" = free text).
- **(f) milestone:** id, vehicle_id, kind, occurred_at, odometer_km, title, story, cover_media_id (+ timestamps);
  `MilestoneKind` = compra · swap · restauracion · primer_track · accidente · venta · pintura · estado · otro.
  `album_item.role` ∈ `album` (default) · `vehicle` (only `vehicle` is written explicitly).
- **(g) specsheet** covers oil grade/spec/capacity, **oil_filter_pn**, OEM tire sizes + psi, bolt pattern, lug
  torque, fluids, plugs, battery — but **not** oil brand, filter brand or the tires actually bought (oil brand
  lives per service item, `service_record_item.oil_brand`; real tires in `tire`).
- **(h) carguy.profiles:** user_id, display_name, created_at, updated_at, media_quota_bytes (sql/010), role
  (sql/024). **No avatar column.**
- **(i)** Screen audit below.
- **(j) Cifras** is tab 4 of 5 (`app/(tabs)/_layout.tsx:80-88`); **nothing** routes to it (no push/replace/Link) —
  moving it to Más breaks no link.

## Baseline (Phase 0)

2026-09-30, branch `imp-30092026/phase-0-kickoff` from `main` at 2.3.0. Folder still `~/dev2/tu-gasolina-rd`
(rename pending — Xaviel, no session open).

| Check | Result |
|---|---|
| npm ci (+ patches) | ✅ |
| tsc · lint | ✅ clean |
| npm test | ✅ 1,181 in 75 suites (1,184 with this phase's export test) |
| build (web) | ✅ 19 pages in `dist/` |
| local-rls | ✅ all passed (1–15e) |
| verify-x-core | ✅ 28/28 |
| verify-sync | ✅ (its test users removed by sql/999) |
| smoke-public-page | ✅ 6/6 |
| smoke-apk | ✅ 3/3 (2.3.0) |
| sql/999 cleanup | ✅ 0 leftover profiles |
| npm audit | 3 moderate (decode-uri-component under expo-router, carried) |
| eas / vercel / gh | xavieldevs-team (Owner) · xavielt · XavielT |
| adb | ✅ Redmi over Wi-Fi 10.0.0.39:5555 |
| disk | ⚠ 90 % used, 12 GB free |

## Screen audit (Phase 0 → Phase 3B)

| Route | While loading today | Skeleton twin | Done |
|---|---|---|---|
| (tabs)/garaje | nothing until `cards` load | GarajeSkeleton | ⬜ |
| (tabs)/historial | EmptyState flashes (`entries` starts `[]`) | HistorialSkeleton | ⬜ |
| (tabs)/cifras | title only until `stats` | CifrasSkeleton | ⬜ |
| (tabs)/index | sections (odometer, facts, weekly) arrive late | InicioSkeleton (partial) | ⬜ |
| vehiculo/[id] (hub) | `null` → MissingRecord; facts late | VehicleHubSkeleton | ⬜ |
| vehiculo/[id]/album | nothing until photos | AlbumSkeleton | ⬜ |
| vehiculo/[id]/build | blank View | BuildSkeleton | ⬜ |
| vehiculo/[id]/ficha | blank View | FichaSkeleton | ⬜ |
| viajes/index | nothing until list | ViajesSkeleton | ⬜ |
| chequeo/index | "nothing due" EmptyState flashes | ChequeoSkeleton | ⬜ |
| documentos/index · recordatorios/index · tareas/index | EmptyState flashes | ListSkeleton | ⬜ |
| admin/index · admin/usuarios · admin/comentarios · reporte | ActivityIndicator | tiles/list skeletons | ⬜ |
| catalogo/* · compartidos · contactos/* · obd/* · pista/* · exportar · foto/[id] · garaje/miembros | empty list / `null` then fill | ListSkeleton / DetailSkeleton | ⬜ |
| detail screens (gasto, servicio, tarea, documento, recordatorio, inspeccion, mod, hito, viaje, pista/evento, pista/sesion) | `null` → MissingRecord | DetailSkeleton | ⬜ |
| forms that load (ContactForm, WishlistForm, MilestoneForm, ModForm, SessionForm) | empty fields, then fill | FormSkeleton | ⬜ |
| vehiculo/[id]/{album/estado, compartir, fluidos, libro} | title only / `null` | DetailSkeleton | ⬜ |
| No skeleton needed (store-backed or static): (tabs)/mas, carga/*, precios, odometro, onboarding, versiones, instalar, notificaciones, invitacion, comentario, cuenta (auth spinner), nueva-contrasena, vehiculo/nuevo, vehiculo/[id]/editar, viajes/ajustes, viajes/permisos, the "nuevo" forms, dev/* | — | — | n/a |

## Wheelz first-hand (Phase 0)

Done 2026-09-30 over Wi-Fi adb, read-only (`01-research/05-wheelz-firsthand.md`, 7 redacted PNGs in
`01-research/wheelz/`; raw captures and UI dumps kept out of the public repo). First check missed the app
(`pm list packages` grep came back empty once; `--user all` found `com.gigamow.wheelz`). Two harmless slips are
logged in the file (the Camera opened from the launcher, no photo; a tap on the share sheet's **Copy** put a drive
card on the clipboard, nothing sent); taps were then guarded to Wheelz's focus.

Key findings for Phase 4: the map-first home with a Drives sheet; the detail swipes between drives; route on a
dark vector map on the streets, speed colours, start/end dots, **Route Metric** toggle, replay; share with 6
templates (IG Story/Save/Copy/More); statistics with equivalences (most behind Pro — Car Guy shows all);
**Drive Tracking** is only permissions (Location, **Motion**, Auto Detection) + three modes (Automatic ·
Automatic + Manual · Manual) + units — no thresholds, no keep-awake.

## Trip export finding (Phase 1)

Phase 0 wrote the tool: on the trip screen, **long-press the route card** → shares
`car-guy-viaje-<date>-<id>.geojson` (raw points if still on the phone, the saved polyline, and diagnostics:
point count, largest gap between fixes, median interval and accuracy, raw vs saved distance). It ships in the
2.3.1 build (Phase 1); Xaviel exports his straight-line trip and the answer lands here.

**2026-09-30, after installing 2.3.1:** the Redmi has **no trips** (Viajes empty; the pre-install backup has
`trip: 0`), so the straight-line trip is gone and cannot be exported. Carried: after his next short drive,
long-press its route card and send the `.geojson`; until then 5(b) ships on the audit's reading (drawing, not
recording — PROGRESS audit (e)) and 5(c) (pre-roll) stays unbuilt.

## Decisions made along the way

- Phase 0: the seed's three events (C3 accident, DS3 overheat, mirror) are written in Phase 2 with the v8
  migration they need, instead of behind a `SEED_V8` flag (the prompt allows either).
- Phase 1: "Solo la luz de reserva" keeps partialEconomy's maths as it was (`inReserve` → the tank holds
  `reserve_volume_l`, default 10 %); the chip only renames it, puts the needle at E and adds the caption.
- Phase 1: "≈ por echada" shows only when the fill-up has no measured km/gal (a partial, or a full tank whose
  previous fill was partial); a measured full-to-full value is never shown twice.
- Phase 1: "≈ por echada" hides a figure outside 0.6–1.6× the car's own economy (full-to-full median, else
  the per-fill median of ≥ 3). On the DS3's real logs the plain formula read ≈ 131 km/gal (RD$ 1,000 after
  422 km) and ≈ 60.8; both are now hidden, ≈ 33.8 stays. The spec's formula is kept; only the display filters.
- Phase 1: the dedupe compares against rows *created* in the last 60 s (not by the fill-up's date), so
  entering an old receipt twice in a row is caught too; "Ver" opens the saved one.
- Phase 1: editing keeps the original `createdAt` (was overwritten — the Phase 0 finding).

## Deviations from the package

- Phase 1 (5b): auto mode's recording options match manual's interval (1 s, BestForNavigation) but keep
  `distanceInterval: 0`, not 3 m: with a distance filter Android stops delivering fixes while parked and the
  4-minute stop rule (which needs fixes at 0 km/h) would never fire. The density comes from the 1 s interval.
- Phase 1 (5b): the "≥ 4× the old point count at 3 m" test is replaced by per-turn shape tests
  (`__tests__/trips/route-detail.test.ts`): on the synthetic GPX the 8 m → 3 m change gives 17 → 22 points (the
  GPX is already sparse), so 4× is not reachable there; the tests check that corners survive instead.

## Observed, deferred

| Found in | Issue | Severity | Notes |
|---|---|---|---|
| 0 | Editing a fill-up overwrites its `createdAt` (`lib/store.tsx:339-345`) | low | ✅ fixed in Phase 1 |
| 0 | No screen edits `vehicle.reserve_volume_l` (reserve estimate always 10 % of the tank) | low | Phase 1 (note 12) can add it to the vehicle form |
| 0 | Stored `trip_point`s skip the excursion filter; `RouteSvg` draws raw points uncleaned | medium | ✅ Phase 1: `routePointsForDrawing` cleans + trims to `endedAt` |
| 0 | Disk 90 % (12 GB free) | medium | Phase 4's native rebuild needs room; clear `~/.gradle/caches` if short |

## Blockers

| Phase | Blocker | Needs | Status |
|---|---|---|---|
| 0 | Folder rename `~/dev2/tu-gasolina-rd` → `~/dev2/car-guy` | Xaviel | open |

---

## Phase reports

## Phase 0 — Kickoff + Wheelz first-hand   (branch `imp-30092026/phase-0-kickoff`)

**Status:** complete
**Commits:** `docs(imp-30092026): Phase 0 — package, baseline, audit, GeoJSON export action`

### Changed
- `docs/imp-30092026/` (the package); pointer lines in `docs/RESUME.md` and `docs/NEXT.md` ("Cycle 4").
- `lib/trips/exportGeojson.ts` (pure: FeatureCollection with the saved route, the raw track, one Point per fix,
  and `tripDiagnostics`), `lib/trips/shareGeojson.ts` (file + share sheet; web download); trip screen: long-press
  the route card to export; test `__tests__/trips/export-geojson.test.ts`.
- `docs/imp-30092026/01-research/05-wheelz-firsthand.md` (pending).

### Acceptance criteria
- [x] Package in the repo, pointers.  - [x] Baseline table (all green).  - [x] Audit (a)–(j) with file:line.
- [x] Screen audit table for Phase 3B.  - [x] Hidden GeoJSON export (ships in 2.3.1).
- [x] Wheelz walk — 9 screens, read-only, redacted.  - [x] Seed events → Phase 2 (decision).

### Notes closed
- 14.

### Notes for the next phase
- Phase 1 (fix pack): the duplicate path is Guardar → "Listo" → Guardar on the same filled form, plus the
  un-disabled button; Inicio has no fuel rows to route; the export action is in — ask Xaviel to long-press a
  straight-line trip and send the .geojson before changing the trip constants.

## Phase 1 — Fix pack 2.3.1   (branch `fix/2.3.1-fixpack`)

**Status:** in progress (code done; phone check + release pending)
**Commits:** `fix(2.3.1): fill-up detail + dedupe, stations picker, reserve light, ≈ por echada, denser routes`

### Changed
- **Detail / editor (note 8):** `app/carga/[id]/index.tsx` (new detail: tiles, review body, ≈ line, gauge rows,
  notes, Editar, Borrar; "Echada guardada" notice on `?saved=1`); editor moved to `app/carga/[id]/editar.tsx`
  (`vercel.json` rewrite). `app/carga/nueva.tsx`: no focus re-key; Listo → `router.replace` to the detail.
  Historial rows and Inicio's "Último tanque" open the detail. `FillUpForm`: `saving` state + ref, the button
  is disabled while saving. `lib/domain/fillupDedupe.ts` (same vehicle, created < 60 s, odometer ±0.5,
  volume, total ±0.5, date ±1 min) → "Esta echada ya se guardó · Ver". `lib/store.tsx` keeps `createdAt`.
- **Stations (note 7):** `lib/domain/refdata/stations.json` (18 brands; Propagas/Tropigas GLP-only) +
  `lib/domain/stations.ts` (`brandsForFuel`, accent/alias-insensitive `normaliseStation`, `recentStations`);
  the form's chips → a `SearchSheet` (Tus estaciones, Marcas, Otra). `lib/fuel.ts` `STATIONS` removed.
- **Reserve light (note 12):** `GaugePicker` chip "Solo la luz de reserva", needle at E, caption.
- **≈ por echada (note 9):** `lib/domain/perFillEconomy.ts` (increasing odometer, missed-previous and > 60-day
  gaps excluded); review sheet, Historial tag ("Parcial · ≈ 41.7 km/gal"), detail; Cifras dotted series
  behind "Por echada (aprox.)" (`Settings.perFill`, default on). Not in averages, not on the public page.
- **Routes (note 16):** finalize simplify 8 → 3 m; auto recording at 1 s (see deviations);
  `present.routePointsForDrawing` (trip_point when present, cleaned, up to `endedAt`, ≤ 900 points) feeds
  `RouteSvg`; `geo.cleanTrackReport` counts drops (accuracy / duplicate / jump / excursion) → a
  `trip-finalize` note in the diagnostics ring buffer and in the GeoJSON export; `tiles.ts` STREET_ZOOM 15.
- Tests: `fillupDedupe`, `stations`, `perFillEconomy`, `route-detail`. QA shots `docs/qa/imp-30092026-phase-1-*`.

### Acceptance criteria
- [x] tsc, lint, jest (80 suites, 1208 tests).
- [x] Web: save → detail with the notice; one row per save; a second tap while saving is ignored; the same
  fill-up again < 60 s → "Esta echada ya se guardó"; Petronan saved; partial review + Historial show ≈.
- [x] Redmi over 2.3.0 with the real data — backup `~/car-guy-backups/car-guy-2026-09-30-pre-2.3.1.json` (13
  vehicles, 13 fill-ups) first; Novedades 2.3.1; Historial ≈ tags; detail of the 23 Sep partial (≈ 33.8,
  aproximado); editor shows "Solo la luz de reserva" and the station sheet (Tus estaciones: TotalEnergies,
  then the brands incl. Petronan); nothing saved in his garage — the save/dedupe path was checked on web.
  The ≈ 131 km/gal found here → the plausibility band (rebuilt).
- [ ] Trip export finding — no trip on the phone; carried to his next drive.
- [ ] GitHub release v2.3.1, merge, tag, push; smoke-apk 3/3.

### Notes closed
- 7, 8, 9, 12; 16 partially (the real map is Phase 4).

