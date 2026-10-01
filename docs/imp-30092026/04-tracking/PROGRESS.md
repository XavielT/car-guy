# Progress — IMP 30092026 (Car Guy 2.4 "Tōge")

Claude Code appends a report per phase (`00-context/04-conventions.md` §8). "Notes for the next
phase" carry context between sessions.

**Started:** 2026-09-30 · **Status:** Phase 0 done

## Phase status

| # | Phase | Status | Branch | Notes |
|---|---|---|---|---|
| 0 | Kickoff + Wheelz first-hand | ✅ | `imp-30092026/phase-0-kickoff` | package in repo, baseline green, audit + screen audit, GeoJSON export action, Wheelz walked |
| 1 | Fix pack 2.3.1 | ✅ | `fix/2.3.1-fixpack` | v2.3.1 released; detail + dedupe, stations, reserve light, ≈ por echada (with a plausibility band), denser routes; trip export carried |
| 2 | Schema v8 | ✅ | `imp-30092026/phase-2-schema-v8` | v8 + sql/025–026 on x-core; verifiers 32/32 + 24/24; merged (no release — no screens) |
| 3A | Language es/en | ✅ | `imp-30092026/phase-3-i18n-skeletons` | en.ts complete (typed), live `t`, Más → Idioma, catalogue, dates; web sweep clean |
| 3B | Skeletons | ✅ | `imp-30092026/phase-3-i18n-skeletons` | 50/50 data screens with their twin; no flash on the fast path (Redmi 56 fps capture) |
| 4 | Map · Modo conducir · centre button | ✅ | `imp-30092026/phase-4-map-drive` | MapLibre native + web, drive mode, CONDUCIR disc; Redmi + web verified; street check = Xaviel's real drive |
| 5 | Eventos · memoria · gomas · precios | ✅ | `imp-30092026/phase-5-memory` | merged; sql/029 + 027 on x-core (verify-x-core 34/34); live MICM import waits for the importer key |
| 6 | Perfil · bienvenida · legal · release 2.4.0 | ✅ | `imp-30092026/phase-6-people-release` | **v2.4.0 released 2026-10-01** (versionCode 13); sql/028 + 030 on x-core; prod deletion 7/7; smokes 6/6 · 6/6 · 3/3; installed over his real 2.3.1 |

⬜ not started · 🟡 in progress · ✅ done · 🔴 blocked

## Notes from the brief (00-context/01-project-brief.md §1)

| # | Note | Closed in | Status |
|---|---|---|---|
| 1 | Fuel prices: date picker, sources, history + analytics, MICM import | 5 | ✅ |
| 2 | Language switch es/en | 3A | ✅ |
| 3 | Tires changed: counter, badges, messages, share | 5 | ✅ |
| 4 | Skeleton on every screen | 3B | ✅ |
| 5 | Vehicle events with proofs | 5 | ✅ |
| 6 | Vehicle details to remember | 5 | ✅ |
| 7 | More fuel stations (Petronan…) | 1 | ✅ |
| 8 | Fill-up save flow: detail, no duplicates | 1 | ✅ |
| 9 | Partials count (≈ por echada) | 1 | ✅ |
| 10 | Profile picture + default avatars | 6 | ✅ |
| 11 | Welcome tutorial + tips | 6 | ✅ |
| 12 | Reserve light only | 1 | ✅ |
| 13 | Route on a real map | 4 | ✅ built — street check = Xaviel's real drive (carried) |
| 14 | Study Wheelz over adb | 0 | ✅ 9 screens read-only → `01-research/05-wheelz-firsthand.md` (redacted PNGs in `wheelz/`) |
| 15 | Legal: terms, privacy, consent, deletion | 6 | ✅ |
| 16 | Straight line instead of streets | 1 + 4 | ✅ built — street check = Xaviel's real drive (carried) |
| 17 | Drive mode module with centre icon | 4 | ✅ |

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
| (tabs)/garaje | nothing until `cards` load | GarajeSkeleton | ✅ 3B |
| (tabs)/historial | EmptyState flashes (`entries` starts `[]`) | HistorialSkeleton | ✅ 3B |
| (tabs)/cifras | title only until `stats` | CifrasSkeleton | ✅ 3B |
| (tabs)/index | sections (odometer, facts, weekly) arrive late | InicioSkeleton (partial) | ✅ 3B |
| vehiculo/[id] (hub) | `null` → MissingRecord; facts late | VehicleHubSkeleton | ✅ 3B |
| vehiculo/[id]/album | nothing until photos | AlbumSkeleton | ✅ 3B |
| vehiculo/[id]/build | blank View | BuildSkeleton | ✅ 3B |
| vehiculo/[id]/ficha | blank View | FichaSkeleton | ✅ 3B |
| viajes/index | nothing until list | ViajesSkeleton | ✅ 3B |
| chequeo/index | "nothing due" EmptyState flashes | ChequeoSkeleton | ✅ 3B |
| documentos/index · recordatorios/index · tareas/index | EmptyState flashes | ListSkeleton | ✅ 3B |
| admin/index · admin/usuarios · admin/comentarios · reporte | ActivityIndicator | tiles/list skeletons | ✅ 3B |
| catalogo/* · compartidos · contactos/* · obd/* · pista/* · exportar · foto/[id] · garaje/miembros | empty list / `null` then fill | ListSkeleton / DetailSkeleton | ✅ 3B |
| detail screens (gasto, servicio, tarea, documento, recordatorio, inspeccion, mod, hito, viaje, pista/evento, pista/sesion) | `null` → MissingRecord | DetailSkeleton | ✅ 3B |
| forms that load (ContactForm, WishlistForm, MilestoneForm, ModForm, SessionForm) | empty fields, then fill | FormSkeleton | ✅ 3B |
| vehiculo/[id]/{album/estado, compartir, fluidos, libro} | title only / `null` | DetailSkeleton | ✅ 3B |
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

- Phase 2: 2.3's week label is kept verbatim in the migrated `fuel_price.note`, and the board shows the newest
  user row's note when it has one — so an upgraded phone reads "26 sep – 2 oct 2026 (MICM)" exactly as before
  (web pair pixel-identical). New rows from the price screen keep the label the same way.
- Phase 2: a 2.3 price setting that arrives *after* the upgrade (a restore of a 2.3 backup, or a first sync
  pulling a 2.3 device's settings) is adopted into `fuel_price` only while the database has no price row
  (`adoptLegacyPrices`). The two settings still sync, for 2.3 devices.
- Phase 2: while `FEATURE_EVENTS` is off, `history.feed` folds history_feed v6's `evento` rows back into
  `hito` (same subtitle, no amount) — Historial is unchanged until Phase 5 ships the event screens.
- Phase 2: the six 2.4 flags live in `lib/flagsV8.ts` (re-exported by `lib/flags.ts`): the data layer needs
  `FEATURE_EVENTS`, and `lib/flags.ts` imports expo-constants, which the jest data tests cannot load.
- Phase 2: trip points get `keep_until` on the first purge after the trip ends (and v8 backfills existing
  ones); the purge deletes by it. Same 30 days as before; a later feature can keep one trip longer.
- Phase 2: setting keys `app_language`, `onboarded_version`, `tips_seen`, `profile_avatar_id`,
  `profile_avatar_rel_path`, `profile_display_name` need no schema (the `setting` table is key/value); they are
  reserved here and written by Phases 3A/6. `economy_per_fill` exists since 2.3.1.

- Phase 3A: no Zustand — the language store is a tiny external store (useSyncExternalStore) in
  lib/i18n/index.ts, persisted in AsyncStorage `car-guy/language` like the theme. `t` is a Proxy over the current
  dictionary, so every call site reads the language at the moment of use; the root navigator is keyed on the
  language, so a switch re-renders everything (it lands on Inicio, and Más navigates itself back).
- Phase 3A: numbers and money are identical in es-DO and en-US (1,234.50; "RD$ 1,234.50"), so only dates
  follow the language. Stored text keeps the language it was written in (a pad reminder's title, a reminder
  note, a check's task title "Revisar …", a DTC repair title).
- Phase 3A: DTC descriptions — the bundled table already has each code's English (`descEn`); English users read
  that, and "(description in Spanish)" appears only where a code has none.
- Phase 3A: release notes (CHANGELOG.md → Novedades / Versiones) stay Spanish; English readers get "Release
  notes are written in Spanish."

- Phase 4: web uses **maplibre-gl 6.11.2**, not the research's 5.24.0 — 5.x (≤ 6.4.0) carries a critical XSS
  advisory (GHSA-jrc7-96c5-q579). v6 is ESM with its worker served from public/maplibre (copied on postinstall);
  the CSS import is static (a dynamic CSS import breaks Metro). The JS is a lazy chunk (1.13 MB, ~297 KB gz).
- Phase 4: no mock-GPS drive on the Redmi — Wheelz on his phone is in Automatic mode and a mock location is
  phone-wide, so a synthetic 12 km drive would land in his Wheelz account (and his real Car Guy if Automático).
  The moving-trail check ran on web (Playwright geolocation stepped along the synthetic GPX); the phone checks
  ran standing still.
- Phase 4: the tab bar draws a 22 px band above itself so the raised disc sits inside the bar's bounds —
  Android does not deliver taps to children drawn outside their parent. Screen content ends 22 px higher.
- Phase 4: the GL map cannot be captured as an image, so Compartir mounts an off-screen copy of the old OSM
  card for the share image.

- Phase 5: a PDF proof on an event is a `media` row (kind pdf) owned by the milestone, not an album item —
  every album / book / public query reads photos only, so PDFs stay out of them by construction.
- Phase 5: event costs in Cifras skip hitos (a "compra" milestone's cost would double the purchase price) and
  events linked to a service (the service already counts).
- Phase 5: the public page gets "Lo que uso" only after a later SQL (`vehicle_share.show_memory` + a
  public_dossier block); the book has it now behind a local switch. Tires on the page: `show_tires` (sql/025).
- Phase 5: MICM weeks run Saturday → Friday (the notice is signed the day before: "25 sep" ⇒ week of 26 sep).
  GNV is not in the notice — its price stays the person's own.

## Deviations from the package

- Phase 1 (5b): auto mode's recording options match manual's interval (1 s, BestForNavigation) but keep
  `distanceInterval: 0`, not 3 m: with a distance filter Android stops delivering fixes while parked and the
  4-minute stop rule (which needs fixes at 0 km/h) would never fire. The density comes from the 1 s interval.
- Phase 1 (5b): the "≥ 4× the old point count at 3 m" test is replaced by per-turn shape tests
  (`__tests__/trips/route-detail.test.ts`): on the synthetic GPX the 8 m → 3 m change gives 17 → 22 points (the
  GPX is already sparse), so 4× is not reachable there; the tests check that corners survive instead.
- Phase 2: `carguy.trip.diagnostics` is `text`, not `jsonb` (spec): every other JSON-in-text column
  (`speed_buckets`, `bbox`, `costs_summary`) is text in the cloud, and PostgREST would hand a jsonb back as an
  object, breaking the local TEXT round trip. `fuel_price.valid_from` is `date` (a bare ISO day round-trips as
  `'2026-08-15'`).
- Phase 2: the dossier's `tires` block is `{count, badges: [{status, count}]}` (no brands), present only with
  `show_tires`; `show` itself is unchanged.
- Phase 2: no emulator run — disk at 91 % (11 GB free); the native check is the Redmi's test variant instead
  (upgrade over 2.2.1's test data + a fresh install).

## Observed, deferred

| Found in | Issue | Severity | Notes |
|---|---|---|---|
| 0 | Editing a fill-up overwrites its `createdAt` (`lib/store.tsx:339-345`) | low | ✅ fixed in Phase 1 |
| 0 | No screen edits `vehicle.reserve_volume_l` (reserve estimate always 10 % of the tank) | low | ✅ 2026-10-01: "Reserva" in the vehicle form (vehicle's unit → liters; hidden for GNV; must be < tank) |
| 0 | Stored `trip_point`s skip the excursion filter; `RouteSvg` draws raw points uncleaned | medium | ✅ Phase 1: `routePointsForDrawing` cleans + trims to `endedAt` |
| 0 | Disk 90 % (12 GB free) | medium | Phase 4's native rebuild needs room; clear `~/.gradle/caches` if short |
| 2 | `migrate()` ran twice at once (SQLiteProvider `onInit` + `getDb()`) on the first launch after an update → rollback, empty store for that launch | **high** | ✅ fixed in Phase 2 (`66f233e`, test reproduces it); it existed since 2.0 — 2.2.x upgrades were lucky on timing |
| 2 | Gradle output of `modules/miui-autostart` was committed in 2.2.2 (156 files dirtied by every build) | low | ✅ untracked + ignored (`2b19c98`) |
| 2 | Domain copy (price sources, event types/severities, memory sections, tire badges/messages) is in module constants, not `lib/i18n/es.ts` | low | ✅ moved in Phase 3A |
| 3A | The public page `/c/<slug>` (lib/share/html.ts, dossier.ts) renders Spanish always | low | needs `vehicle_share.locale` (the owner's language at publish) — a later cycle |
| 3A | `npm audit`: 3 moderate (decode-uri-component ≤ 0.4.2 via expo-router → query-string 7) | low | pre-existing; the only fix (0.5.0) is ESM-only and query-string 7 `require`s it — wait for expo-router |
| 3A | OBD search matches `descEs` only | low | ✅ 2026-10-01: matches the English description too, in either language ("misfire" → P0300…) |
| 4 | The live trail in Modo conducir is one colour (red); the trip detail colours by speed bucket | low | ✅ 2026-10-01: it was already speed-coloured; only fixes without a GPS speed fell back to the "unknown" red — they now derive distance ÷ time like the trip detail (`lib/trips/driveTrail.ts`) |
| 4 | No Expo Go guard card for the map (a dev build is assumed; Expo Go is not used in this project) | low | — |
| 5 | **Privacy:** the cloud public page (public_dossier, 022 → 025) lists every milestone under show_story — an accident with its cost and pendiente would be public | **high** | ✅ written: `sql/029_dossier_hito_only.sql` (only event_type = 'hito'); local-rls 29a–c green; **apply needs Xaviel's OK** |
| 5 | **Production:** every public page (`/c/<slug>`) answered 500 since the Phase 3 merge — lib/i18n's static expo-localization import reached the Vercel function through the catalogue labels | **high** | ✅ hotfix `d6ce1c6` (lazy guarded require); `tools/check-api-load.mjs` (npm run check:api, also in release-apk.sh); smoke-public-page 6/6 |
| 5 | `tools/apply-sql.mjs`'s shared-change guard does not catch `create role` / `grant … to authenticator` | low | pass `--shared` deliberately for 027's role file; teaching the guard is Xaviel's call |

## Blockers

| Phase | Blocker | Needs | Status |
|---|---|---|---|
| 0 | Folder rename `~/dev2/tu-gasolina-rd` → `~/dev2/car-guy` | Xaviel | open |
| 2 | Apply `sql/025` + `sql/026` to x-core | Xaviel's OK | ✅ applied 2026-09-30; verifiers green |
| 5 | Apply `sql/029` (privacy) and `sql/027` | Xaviel's OK | ✅ applied 2026-09-30; the role file (`027_…role.shared.sql`) only for the JWT path — not applied |
| 6 | Contact e-mail for the legal texts | Xaviel | ✅ xavieldev@gmail.com (his pick, 2026-09-30) |
| 6 | Read the legal drafts (content/legal/*.md; not legal advice — docs/imp-30092026/06-legal-texts.md) | Xaviel | released on his "do all the stuff" (2026-09-30); his read is still owed — a wording change is a LEGAL_VERSION bump |
| 6 | Apply `sql/028_delete_account.sql` | Xaviel's OK | ✅ applied 2026-09-30; verify-x-core 35/35 |
| 6 | `SUPABASE_SERVICE_ROLE_KEY` in Vercel (deletion + MICM importer) | Xaviel | ✅ set (production, sensitive) with the current key — he chose not to rotate first; rotate later and update Vercel |
| 5 | Importer key in Vercel | Xaviel | ✅ service-key path (SUPABASE_SERVICE_ROLE_KEY) |

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

**Status:** complete — v2.3.1 released 2026-09-30 (trip export carried to his next drive)
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
- [x] GitHub release v2.3.1 (`car-guy.apk` + `car-guy-v2.3.1.apk`, versionCode 11, sha256 `eabfc504…`),
  merged to main, tag v2.3.1, pushed; Vercel green; smoke-apk 3/3; `/carga/<id>` and `/carga/<id>/editar`
  200 on production. smoke-public-page not run (writes a test account to x-core — needs Xaviel's OK).

### Notes closed
- 7, 8, 9, 12; 16 partially (the real map is Phase 4).

### Notes for the next phase
- Phase 2 (schema v8): `economy_per_fill` lives in `Settings.perFill` (local settings) until v8 adds the
  column; the dedupe and stations need nothing from the schema. The trip export is still owed — ask after his
  next drive; if the raw points are sparse, 5(c)'s pre-roll goes into Phase 4.

## Phase 2 — Schema v8 + cloud sql/025–026 + flags   (branch `imp-30092026/phase-2-schema-v8`)

**Status:** complete — merged 2026-09-30 (no app release: this phase has no screens; 2.4.0 ships in Phase 6)
**Commits:** `eeb9210` schema v8 · `66f233e` one migration run at a time · `2b19c98` untrack module build output

### Changed
- **Migration v8** (`lib/db/migrationV8.ts`, registered in `lib/db/migrations.ts` with a `data` step in the
  same transaction): `fuel_price` + index, `fuel_price_ref` (cache), milestone event columns (+ accidente →
  accidente/moderado), specsheet "what I buy" ×13, `vehicle_fact`, `legal_acceptance`,
  `vehicle_share.show_tires`, `trip.diagnostics`, `trip_point.keep_until` (+ backfill), history_feed v6
  (`evento` rows). Data: 2.3's `reference_prices` + `price_week_label` → one `manual` row per fuel,
  `valid_from = parseWeekLabel(label)`, the label in `note`.
- **Types / repos:** `FuelPrice`, `FuelPriceRef`, `VehicleFact`, `LegalAcceptance`, event fields on
  `Milestone`, specsheet fields, `showTires`, `diagnostics`; repos `fuelPrices`, `vehicleFacts`,
  `legalAcceptances`; `lib/db/priceOps.ts` (board, save). **The store reads the board**
  (`referencePricesNow()`), and the price screen writes `fuel_price` rows (`savePriceBoard`).
- **Domain** (pure, 81 tests): `lib/domain/fuelPrices.ts` (parseWeekLabel, currentBoard, series,
  referencePricesFromBoard), `events.ts`, `carMemory.ts`, `tireStats.ts`, `lib/legal/index.ts`.
- **Sync:** SYNC_TABLES + `vehicle_fact`, `fuel_price`, `legal_acceptance`; BOOLEAN_COLUMNS `show_tires`;
  UPDATED_BY_TABLES + the three; ALL_TABLES (backup/reset) + the three; vehicle delete cascades facts;
  `lib/cloud/fuelPriceRef.ts` `refreshFuelPriceRef()` once per launch (silent while the table is missing).
- **Backup:** a v7 file restores into v8 with its prices adopted and accidents classified.
- **Cloud (written, not applied):** `sql/025_schema_v4.sql`, `sql/026_rls_v4.sql`; `tools/local-rls` section
  16 (16a–q); `verify-sync` 21–23; `verify-x-core` 29–32; parity test reads 025.
- **Seed:** 3 events (C3 choque pendiente "pintar el guardafango", DS3 sobrecalentamiento, DS3 retrovisor), 4
  facts on the AE85, DS3 "what I buy" (Castrol Edge 5W-30 + Fram PH6607 — **made-up part number**), 6 weeks of
  manual prices, AE85 14 tires over two years (6 quemadas, 2 vendidas, 1 guardada, 1 nueva, 4 en uso).
- **Flags:** FEATURE_MAP_V2, FEATURE_DRIVE_MODE, FEATURE_I18N, FEATURE_EVENTS, FEATURE_ONBOARDING_V2,
  FEATURE_LEGAL — false (`lib/flagsV8.ts`).
- Fixture `__tests__/fixtures/backup-v7-seed-2.3.1.json`: the seed exported **by the v2.3.1 tag's own code**
  (temporary worktree), with a saved price week.

### Acceptance criteria
- [x] tsc, lint; jest all green (new: migrate-v8 16, migrate-concurrent 1, seed v8 4, domain 81).
- [x] 0 → 8 fresh; v7 → 8 with prices migrated (same numbers + label), events, keep_until, feed v6.
- [x] 2.3.1 fixture → v8 restore: every row, prices adopted; v8 backup carries the three new tables.
- [x] `bash tools/local-rls/run.sh` all passed (104 PASS, 025/026 applied twice).
- [x] Web upgrade on one browser profile: 2.3.1 (seed + saved week "26 sep – 2 oct 2026 (MICM)", regular
  309.9) → v8: Precios and Historial **pixel-identical** (`docs/qa/imp-30092026-phase-2-{prices,historial}-{231,v8}.png`);
  re-seed on v8 answered "se agregó lo de la 2.4" (proof the v8 bundle ran).
- [x] Redmi, test variant over 2.2.1's data (saved week "26 sep - 2 oct 2026 MICM", regular 311.4): first
  launch hit the migration race (above) — fixed; second launch migrated with the data and the week intact.
- [x] Redmi re-run with the fix: 2.3.1-tag test build (clean install, saved "3-9 oct 2026 MICM", regular 312.6)
  → v8 installed over it: first launch clean (no JS error), board "3-9 OCT 2026 MICM" · RD$ 312.60.
- [x] Fresh install of the v8 test build (after Xaviel allowed MIUI's install prompt): onboarding, default
  board "15–21 ago 2026 (MICM)", no JS error; the MICM fetch stays silent (table not there until Phase 5).
- [x] sql/025 + sql/026 applied to x-core 2026-09-30 (Xaviel's OK; HTTP 201 each); `types:gen` regenerated
  `lib/cloud/database.types.ts` (+252 lines); tsc + jest green (1324).
- [x] verify-x-core **32/32** (new 29–32) · verify-sync **24/24** (new 21–23) · sql/999 cleanup (0 leftover
  profiles) · the verifier's feedback screenshots removed through the Storage API (3 objects, `0000feed-` only).
- [x] Merged to main (web deploy; all six 2.4 flags off).

### Notes closed
- None (groundwork for 1, 3, 5, 6, 10, 15).

### Notes for the next phase
- Phase 3A (language): move the domain modules' Spanish constants (price sources, event types/severities,
  memory sections, tire badges/messages) into `lib/i18n/es.ts` with their en twins; `app_language` is reserved.
- Phase 3B (skeletons): nothing from here blocks it.
- `.env.supabase` is not shell-sourceable — read `ACCESS_TOKEN` / `SERVICE_ROLE_KEY` by pattern, never `.` it.

## Phase 3A — Language es/en   (branch `imp-30092026/phase-3-i18n-skeletons`)

**Status:** complete (native check rides with 3B's build)
**Commits:** `c44ada1` dictionary + store · `72ce3c6` codemod · `9219d6b` Phase 3A

### Changed
- `lib/i18n/dict.ts` (`Dict` = es widened), `lib/i18n/en.ts` from six typed parts (`en/part1..6.ts`,
  `Pick<Dict,…>` each — a missing key or wrong signature is a build error), `lib/i18n/index.ts` (`t`, `useT`,
  `useLanguage`, `initLanguage`, `setLanguagePreference`, `refreshSystemLanguage`, `localeTag`).
- Codemod over 135 files (`es.` → `t.`); locals named `t` renamed; `tools/i18n-shadow.mjs` (type checker: no local
  shadows the dictionary) and `tools/i18n-frozen.mjs` (0 module-level reads) keep it honest; ESLint forbids
  importing `es.ts` outside lib/i18n.
- Root layout: stored language read before the splash; navigator keyed on it; foreground re-check; `<html lang>`.
  Headless trip task reads the stored language; the trip service notification is built when the service starts.
- Every remaining display string moved into es/en (`tools/i18n-literals.mjs` sweep: domain labels, legal
  notices, notifications, importer, PDF book, inline JSX); fuel / expense / period labels read the dictionary.
- Catalogue: `lib/i18n/catalogTranslations.en.json` (service types, templates + items with how/warning, mod
  categories, fluids, spec presets and fields, oil types, lamps, badges…) + `catalogLabel` / `catalogText` /
  `refLabel`; refdata gained `en` (colors, body types, oil, fluids). Edited seeds keep the user's text.
- Dates via `localeTag()` (es-DO / en-US). `expo-localization` (~57.0.2) with `supportedLocales` es/en and
  `supportsRTL: false`; `locales/es.json`, `locales/en.json` (app name).
- Más → Idioma (Sistema · Español · English); `FEATURE_I18N` true.

### Acceptance criteria
- [x] tsc, lint, jest green (parity, store, catalog suites; the existing suites still pass in Spanish).
- [x] Web, one profile, both languages over 23 routes (tabs, fill-up, check, catalogue, vehicle hub, build,
  ficha, Viajes, Pista, feedback, versions, reminders, documents, tasks, account, export, contacts): English has
  no Spanish left except user data ("el daily") and the release notes (with the note). 0 page errors.
  Screenshots `docs/qa/imp-30092026-phase-3a-{es,en}-{inicio,garaje,historial}.png`.
- [x] Android (Redmi, test variant): Más → Idioma switches instantly and stays on Más (tab bar included — after
  the fix below); Sistema follows the app's locale when it comes back to the foreground (per-app locale es-DO ↔
  en-US via `cmd locale set-app-locales`, his phone's own language untouched); the test notification's body
  arrived in English. The PDF book header was not opened on the device (its strings are the parity-tested
  `book.pdf` keys).
- Found on the Redmi and fixed: the switch did not re-render the tab bar or unsubscribed screens —
  expo-sqlite's `SQLiteProvider` is memoized with a comparator that ignores `children`, so the language key set
  above it never reached the tree (`58f8ef3`: the key now lives in `ShellInLanguage`, inside the provider). The
  web sweep had missed it because it set the language and reloaded.
- Decision: his phone is set to English, so "Sistema" would have flipped his Spanish app the day he updates. An
  install that already has vehicles the first time 2.4 runs is pinned to Spanish; new installs follow the device
  (`8e32263`, tested).

### Notes closed
- 2.

## Phase 3B — Skeletons   (branch `imp-30092026/phase-3-i18n-skeletons`)

**Status:** complete
**Commits:** `17ee7e4` foundation · `c005bbe` Phase 3B

### Changed
- `components/ui/Skeleton.tsx`: `<Skeleton>` root (one shimmer clock per screen through context, only on the
  focused screen, static under reduced motion; a11y progressbar + "Cargando…/Loading…"), blocks Rect / Circle /
  Lines / Card / Row / Title / Tiles / Fields, generic ListSkeleton / DetailSkeleton / FormSkeleton.
- `hooks/useDelayedLoading.ts` (150 ms delay, 300 ms minimum).
- 50 route twins in `components/skeletons/` (Tabs*, Vehicle*, List*/Admin*/Check*/Trips*, Record*/DetailTrip*,
  form outlines via `useFormSkeleton`), first load only; boot spinners → Inicio-shaped skeletons.
- Flashes removed: EmptyState before the first read (Historial, chequeo, documentos, recordatorios, tareas,
  viajes, compartidos, contactos, pista, OBD, exportar counts), MissingRecord before the read resolved (10 detail
  screens), Inicio's "—" cluster, Garaje's "0 in the garage" + Add vehicle, admin/reporte spinners. hito/[id]
  now shows MissingRecord for a deleted milestone (was a blank screen forever).
- `lib/dev/slowQueries.ts` — SLOW_QUERIES (dev only): `localStorage['car-guy/dev-slow-queries'] = '800'`, armed
  after the store's first load (boot is ~100 small reads; slowing them made boot take minutes). A `?slow=` URL
  param is read too but expo-router rewrites the URL during startup, so it is unreliable.
- `__tests__/ui/skeletons.test.ts`: every route in app/ renders a `…Skeleton` or is in NO_SKELETON with a reason.

### Acceptance criteria
- [x] **Screens with skeleton: 50/50** (34 exempt with reasons: store-backed, static, create forms, dev).
- [x] Web, slow mode, warm navigation into 22 screens: each shows its skeleton, then its content; no stretched
  rows (a Historial chip row stretched under the skeleton — fixed). Pairs
  `docs/qa/imp-30092026-phase-3b-{skeleton,loaded}-{historial,cifras,garaje,vehiculo}.png` + 18 skeleton shots.
- [x] Fast path, warm app: tab switches, vehicle hub, a fill-up detail — 0 skeleton flashes (DOM observer).
- [x] Redmi: 12 s screen capture switching Inicio / Historial / Garaje / Cifras — 674 frames (~56 fps), no frame
  with a skeleton tone spike (per-frame raised-tone share, median 4.9 %, max 6.4 %).
- [x] tsc, lint, jest (1,767), i18n-frozen 0.

### Notes closed
- 4.

### Notes for the next phase
- Phase 4 (map · Modo conducir): the trip detail's twin (`DetailTripSkeleton`) has a map box at the card's ratio —
  keep it when MapLibre replaces the mosaic. New screens need a twin or a NO_SKELETON reason, and every string in
  es + en (parity test), read at render time (i18n-frozen).

## Phase 4 — Map · Modo conducir · centre button   (branch `imp-30092026/phase-4-map-drive`)

**Status:** complete — the street check is Xaviel's real drive (manual checklist)
**Commits:** `5145530` install · `c7f3212` plugin · `62cd370` Phase 4

### Changed
- `@maplibre/maplibre-react-native` 11.4.0 (pinned, config plugin), `maplibre-gl` 6.11.2 (web, lazy), expo-keep-awake,
  expo-screen-orientation; `tools/copy-maplibre-worker.mjs` on postinstall.
- `components/map/` TripMap · HeatMap · LiveMap (native + `.web.tsx`), `types.ts` contract, `useMapStyle`,
  `Recenter`; `lib/map/config.ts` (OpenFreeMap dark, MapTiler fallback only with a key, style health check
  cached 1 h / 1 min on failure); `lib/trips/geojson.ts` (segments by the app's speed buckets, merged; bbox; fit;
  heatmap sampling every 35 m) + tests.
- Trip detail: the map replaces the mosaic (fallback + "Sin mapa en línea" when the style fails; mosaic kept for
  the share image), replay, long-press export, attribution footer, "Ver en mapa" removed. Viajes heatmap on
  MapLibre. Ajustes: Mapa en línea/apagado, Estilo oscuro, créditos.
- Tab bar (`components/tabbar/`): Inicio · Garaje · [CONDUCIR, 64 px redline disc, raised] · Historial · Más;
  amber pulsing ring + REC while recording (static under reduced motion). Cifras → `app/cifras.tsx` stack screen,
  first row of Más, Inicio quick-action tile (no `/(tabs)/cifras` push remained; static web still serves /cifras).
- `app/conducir.tsx`: LiveMap full-bleed (course-up follow, re-centre after a pan, sheet-aware insets), compact
  speed, sheet (vehicle, mode, INICIAR/TERMINAR via the same startManualTrip/stopTrip as Inicio, pasajero),
  keep-awake and orientation unlock on this screen only; web manual. Wheelz notes applied: the map is the
  screen with every control in one bottom sheet; big speed number, not a dial; TERMINAR full-width in the sheet.
- FEATURE_MAP_V2, FEATURE_DRIVE_MODE → true.

### Acceptance criteria
- [x] tsc, lint, jest (1,796), i18n parity + frozen 0, skeleton audit.
- [x] Web: trip detail map (`docs/qa/imp-30092026-phase-4-detail.png`), heatmap (`…-heatmap.png`), tab bar
  (`…-bar.png`), drive mode (`…-drive.png`); drive mode with the synthetic GPX stepped through Playwright
  geolocation — trail follows, 1.4 km / 81 km/h max, TERMINAR saves the trip (`…-drive-moving.png`); offline
  fallback by blocking openfreemap.
- [x] Redmi (test variant): MapLibre renders; the seed trip's detail on the dark map with start/end; drive mode
  opens from the disc with the location puck and keep-awake (window wake lock held); rotating to landscape works
  in drive mode only and the app returns to portrait on close (his rotation settings restored: auto-rotate on);
  a stationary manual trip shows REC on the sheet and the amber ring + REC on the disc, TERMINAR ends it.
- [ ] **Xaviel's real drive** with Modo conducir open ~10 min → the detail's line must follow the streets; if not,
  long-press → export the GeoJSON (docs/imp-30092026/05-manual-checklist.md).
- Size: test APK (arm64) 52 → 64 MB (+12 MB); the universal release APK delta is measured at the 2.4.0 build.
  Web: maplibre in a lazy chunk (1.13 MB, ~297 KB gz) + worker files; CSS 83 KB (~12 KB gz) on every page.

### Notes closed
- 13, 17; 16 map half (the street-following proof is his drive).

### Notes for the next phase
- Phase 5 (events · memoria · gomas · precios): the domain modules from Phase 2 are ready (events, carMemory,
  tireStats, fuelPrices); sql/027 (fuel_price_ref + importer) needs Xaviel's OK and a JWT or service-role decision.


## MICM PDFs (Phase 5)

Fetched 2026-09-30 from the notices page (`…/avisos-semanales-de-precios-de-combustibles/`, HTTP 200, four
"Descargar .PDF" links). All four are **text PDFs** (`pdftotext -layout` → ~8 KB of text each; pdf.js/unpdf in
Node reads the same rows). Texts saved in `docs/imp-30092026/fixtures/micm/`.

| PDF | week (from the sentence) | Premium | Regular | Gasoil reg. | Gasoil ópt. | GLP |
|---|---|---|---|---|---|---|
| AVISO-PRE.-SEM.CORTE-26-SEP-02-OCT-DE-2026-ESC.-2-ESC.-3.pdf | 2026-09-26 → 10-02 | 353.10 | 317.50 | 270.80 | 306.10 | 135.20 |
| AVISO-PRE.-SEM.CORTE-19-25-SEP-DE-2026.pdf | 2026-09-19 → 09-25 | 350.10 | 315.50 | 267.80 | 302.10 | 135.20 |
| AVISO-PRE.-SEM.CORTE-12-18-SEP-DE-2026.pdf | 2026-09-12 → 09-18 | 341.10 | 310.50 | 262.80 | 293.10 | 135.20 |
| AVISO-PRE.-SEM.CORTE-05-11-SEP-DE-2026.pdf | 2026-09-05 → 09-11 | 341.10 | 310.50 | 262.80 | 293.10 | 135.20 |

Relevant lines (newest notice):

```
… regirán a partir de la 00:00 hora del sábado
veintiséis (26) de septiembre al día viernes dos (02) de octubre de dos mil veintiséis (2026).
Gasolina Premium            203.63  71.85  32.58  16.59  27.07  6.68  358.40  (5.30)  353.10   3.00
Gasolina Regular            179.95  63.83  28.78  16.59  27.07  6.68  322.90  (5.40)  317.50   2.00
Gasoil Regular              174.00  28.06  27.83  14.28  23.75  6.68  274.60  (3.80)  270.80   3.00
Gasoil Optimo               198.22  34.53  31.72  14.52  24.03  6.68  309.70  (3.60)  306.10   4.00
Gas Licuado de Petróleo (GLP) **  84.58  0.00  13.53  11.71  17.90  6.68  134.40  0.00  0.80  135.20  0.00
```

Findings: weeks run **Saturday → Friday** (the research's "25 sep" was the notice's date, 25 sep; the week
starts 26 sep). The price to the public is the second number from the end (the last is the week's change,
negatives in parentheses). The EGP-C/EGP-T gasoil rows (power plants), Avtur, Kerosene and Fuel Oil are
skipped; **GNV is not in the notice** (its price stays the person's own). Two sentence wordings: "del sábado
(19) al día viernes (25) de septiembre" and "del sábado (26) de septiembre al día viernes (02) de octubre";
the file name carries the same dates (used as fallback).

## Phase 5 — Eventos · memoria · gomas · precios   (branch `imp-30092026/phase-5-memory`)

**Status:** built and verified on web; Redmi check below; x-core SQL + importer key wait for Xaviel
**Commits:** `354015c` Phase 5

### Changed
- **Eventos (note 5):** `app/evento/nuevo|[id]` (EventForm: type chips, severity, date/km, story, cost,
  pendiente + resuelto, proofs photos + PDF, links to service/mod/check, location); `app/hito/*` redirect; hub
  "Eventos" tab (timeline, severity markers) + pending banner; Historial 'evento' rows + chip; album; book
  chapter "Eventos"; Cifras `EventCostsBlock`; FEATURE_EVENTS on.
- **Lo que uso (note 6):** Ficha tab (what I buy + facts CRUD by group, search, Copiar); "Igual que siempre" in
  the service oil block and the check runner's fluid card; book chapter behind a local switch; the dossier code
  renders a `memory` block when the cloud sends one (it does not yet — see deviations).
- **Gomas quemadas (note 3):** Build → Gomas card (badges, "faltan n", messages, share card via view-shot, no
  plate), heat-cycle limit setting (default 8) + "N CICLOS · REVISAR" on mounted tires; Cifras `TiresBlock`;
  `tires` share flag (compartir + libro), dossier tires line + top badge.
- **Precios (note 1):** `app/precios/index|nuevo` (board with source + date chips, stale banner, history by
  week, new entry with date / source / station), Cifras `PricesBlock` (user vs MICM, 12 months), fill-up
  prefill from the board; MICM importer `lib/micm/{parse,pdfText,importer}.ts` (PDFs are text — fixtures
  under docs/imp-30092026/fixtures/micm/), `api/precios.ts` (±20 % validation, s-maxage 3600), cron Saturday
  12:00 UTC, "Importar MICM ahora", launch ping when the newest week is > 8 days old.
- **SQL (written, not applied):** `sql/027_fuel_price_ref.sql` + `027_fuel_price_ref_role.shared.sql`
  (local-rls 27a–l), `sql/029_dossier_hito_only.sql` (local-rls 29a–c); verify-x-core 33–34 (anon reads
  fuel_price_ref, cannot insert / call the RPC).

### Acceptance criteria
- [x] tsc, lint, jest (1,879), i18n parity + frozen 0, **Screens with skeleton: 53/53**, local-rls all passed.
- [x] Web: the seeded events render (C3 choque with its pendiente banner, DS3 sobrecalentamiento, retrovisor);
  "espejo" created with a photo + pendiente → hub banner, Historial, album; resolve clears it; a fact added and
  found by search; the Trueno's card "14 gomas · 6 este año" + Primer juego / Quemagomas; a manual price with
  the date picker → board "Estación · 30 sep"; a fill-up pre-fills it. Screens `docs/qa/imp-30092026-phase-5-*`.
- [x] MICM: the four current notices parse (26 sep – 2 oct: premium 353.10 · regular 317.50 · gasoil 270.80 ·
  óptimo 306.10 · GLP 135.20); the real chain ran once against micm.gob.do with a fake store.
- [x] Redmi (test build over the seed fixture): the C3 hub has the Events tab; the new-event form (type chips,
  severity, pendiente, proofs); Ficha → "What I use" (search, a fact with Copiar); Precios (board with source
  chips, + Add price, Import MICM now, history by week). No JS errors.
- Merged to main after sql/029 was live.
- [x] sql/029 + sql/027 applied to x-core (Xaviel: "do it"); verify-x-core **34/34**; smoke-public-page **6/6**
  (story still shows, events do not); sql/999 cleanup.
- [ ] Importer key in Vercel + a real import — **Xaviel** (dedicated JWT + the role file, or the service key).

### Notes closed
- 1 (manual history + import built; live import after the key), 3, 5, 6.


## Avatars trademark checklist (Phase 6)

The 16 avatars in `components/avatars/` (ids + labels: `lib/avatars.ts`, `t.profileUi.avatars`) were drawn
in-house as react-native-svg components. They are Car Guy's own work, so no licence or attribution is needed
("Avatares © Car Guy"). Before shipping any change to them:

- [x] **No brand shapes.** No maker's emblem, no badge, no grille pattern, no wordmark, no lettering except
  the three generic kanji.
- [x] **No logos or liveries.** No sponsor decals or real racing liveries (no Castrol, Advan, Rothmans and so
  on). Helmets carry plain stripes and blocks of colour only, never a real driver's or maker's design.
- [x] **No real model silhouettes.** The coupe, hatch, kei, pickup and wagon are built from straight lines and
  soft corners on one shared ground line and wheel. None follows a specific car's body lines (no Supra, RX-7,
  GT-R, AE86, Civic, Hilux and so on). No signature light shapes, no badge placement.
- [x] **Generic parts.** The six-spoke wheel follows no real wheel maker's design. The turbo is a generic
  compressor housing. The wrenches have no brand marking.
- [x] **Kanji are words, not marks.** 改 (kai, "modified"), 走 (hashiru, "to run"), 峠 (tōge, "mountain pass")
  are set in the bundled Noto Sans JP (SIL OFL), on plain discs. **Open item:** someone who reads Japanese
  should confirm they read as intended (research 02 §4).
- [x] **Fixed house palette.** Amber #FFB300 / #FF8F00, orange #FF5F00, red #E10600, ink #EDEDED, on #121212.
  No colour combination copies a brand's trade dress.
- [ ] A new avatar goes through this list before its id ships. Ids never change once shipped, because they
  are stored in `carguy.profiles.avatar_id`.

## Phase 6 — Perfil · bienvenida · legal · release 2.4.0   (branch `imp-30092026/phase-6-people-release`)

**Status:** complete — merged `bcbfe46`, release `e0fb873`, **v2.4.0 published 2026-10-01**
**Commits:** `467df66` Phase 6 build · `872eef7` background-location disclosure · `121bcb2` contact + sql/028 · `e0fb873` release + sql/030

### Changed
- **Avatars + profile (note 10):** 16 in-house drawings (`components/avatars/`, react-native-svg; trademark
  checklist above), `<Avatar>` photo → drawing → initials, `app/perfil.tsx` (name, square crop 512 px, grid);
  signed in → `carguy-media/<uid>/avatar.jpg` + profiles row (owner path allowed by sql/013); others' avatars are
  not readable under the current policies → initials in member/admin lists (a later SQL could expose avatar_id).
- **Bienvenida (note 11):** `app/bienvenida` 6 slides (idioma, nombre y avatar, primer carro, qué puedes hacer,
  permisos = prominent disclosure, cuenta), skip everywhere; gate in the tabs layout (Redirect, as /onboarding);
  existing garages are marked onboarded silently; TipCard on Viajes, Build, Pista, Álbum, Eventos, Conducir;
  Más → Ayuda. FEATURE_ONBOARDING_V2 on.
- **Legal (note 15):** terms / privacy / delete-account in es + en (2026-10, effective 2026-10-01; Supabase AWS
  us-west-2 stated), static pages /terminos /privacidad /eliminar-cuenta, Más → Legal, acceptance sheet once +
  18+ consent at signup (legal_acceptance rows), `tools/smoke-legal.mjs`. Viajes → Automático shows the
  disclosure text with Continuar / Cancelar right before the system background prompt (Play policy).
- **Eliminar cuenta:** `sql/028` (delete_my_account, admin_pending_deletions; local-rls 28a–p), 
  `api/eliminar-cuenta.ts` (RPC as the caller → storage objects + auth user with the service key; 503
  no-service-key without it), Cuenta → Eliminar cuenta (type ELIMINAR; order: sync → RPC → function → sign out →
  wipe, so a failed server call leaves the phone intact), admin "Cuentas por eliminar".

### Acceptance criteria
- [x] tsc, lint, jest (1,946), parity + frozen 0, Screens with skeleton 54/54, local-rls all passed, 4 api
  functions load in Node.
- [x] Web: welcome on a fresh profile (skip remembered), none on a seeded one; tips; avatars grid + Más header;
  legal pages in both languages; acceptance sheet; delete screen; signup refused without consent.
- [x] Redmi (test build over its data = the upgrade path): no welcome; the legal sheet once (Accept → gone after a
  relaunch); in-app privacy policy renders; Perfil with the 16 avatars; delete screen signed out → Go to account.
- [x] Signed-in deletion against production (2026-10-01): throwaway `carguy-test-…-del@example.com` + vehicle + photo →
  POST car-guy.vercel.app/api/eliminar-cuenta 200 {removed 1, deleted vehicle 1, vehicle_member 1}; sign-in refused,
  photo gone, old token reads nothing — 7/7. The account removed itself; nothing to clean.
- [x] Upgrade 2.3.1 → 2.4.0 on the Redmi with his real data (backup `~/car-guy-backups/car-guy-pre-2.4.0.json`, app
  unused since): `install -r` ok; Novedades 2.4.0 sheet, then the legal sheet once; no welcome; Spanish kept (phone
  is English — the existing-garage rule); 3 live vehicles (the other 10 rows in the backup are deleted QA cars),
  photos, statuses, "Todo subido", CONDUCIR disc.
- [x] Release: `release-apk.sh` (bundle env, 4 functions load, EAS cert a16450a0…, versionName 2.4.0, versionCode 13 —
  12 went to a build killed by a laptop crash), `--publish` → v2.4.0, latest/download → car-guy.apk; smoke-public-page
  6/6, smoke-legal 6/6, smoke-apk 3/3; portfolio card (xaviel-web-v2 `9c052f5`) live.
- [ ] Fresh-install welcome on the device — MIUI blocks a new adb install without his tap; covered on web.

### Observed at release
- After "Ahora no" on his phone the sheet did not return on the next cold start: Más → Legal says "Aceptados el 01 oct
  de 2026". Resolved: Xaviel accepted it himself (2026-10-01); the sheet behaved as designed.
  `service_role` has no SELECT on carguy.legal_acceptance, so the cloud row was not read.

## Final state (IMP 30092026)

All six phases merged; 2.3.1 and 2.4.0 "Tōge" released; notes 1–17 built. Carried (docs/NEXT.md): his real drive
(street check for notes 13/16 + the trip GeoJSON export), his read of the legal texts, rotating the service-role key,
the Music Hub sign-in check, public "Lo que uso" and readable avatars (one SQL file each).

### Notes closed
- 10, 11, 15 (built; final with the release).

