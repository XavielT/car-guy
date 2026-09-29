# PROMPT 02 — Schema v6 + cloud sql/018–019 + units in liters + refdata files

**Depends on:** Phase 1 merged and tagged · **Branch:** `imp-29092026/phase-2-schema-v6` · **ADRs:** 26, 32, 33 · **Size:** L

> **Before running:** approve `node tools/apply-sql.mjs sql/018_schema_v3.sql` and
> `sql/019_rls_v3.sql` when asked (additive, `carguy` only, no `--shared`). `npm run types:gen`
> needs the Supabase CLI login from last cycle.
>
> **How to run:** `cd` to the repo folder, `claude`, paste below the line.

---

```
Phase 2 of IMP 29092026: every table and column this cycle needs, written once (ADR-26); volumes
become liters with a per-vehicle display unit (ADR-33); reference data files for the pickers.
No screens change in this phase except what the unit change forces (numbers must read the same as
before for a gallons vehicle).

Read first:
- docs/imp-29092026/02-specs/01-data-model-v6.md (all of it — statements are given, use them)
- docs/imp-29092026/02-specs/02-cloud-v3.md §018, §019, "Sync protocol changes" 2–4
- docs/imp-29092026/01-research/02-fuel-partial-and-datasets.md §2 (units), §3.3 (curated
  make/model JSON shape), §4 (body types, colours, oil, fluids)
- lib/db/migrations.ts, lib/db/migrationV2.ts (pattern), lib/db/types.ts, lib/sync/tables.ts,
  __tests__/sync/schema-parity.test.ts, lib/fuel.ts, lib/domain/economy.ts, lib/domain/stats.ts,
  lib/domain/specPresets.ts (tank capacity keys), lib/backup.ts (export/import must carry the new
  columns and convert old backups), lib/import/tucombustible.ts (imports gallons → liters now)

Branch: imp-29092026/phase-2-schema-v6

1. MIGRATION v6 (lib/db/migrationV6.ts): the statements of 01-data-model-v6.md §1.1–1.8 in one
   transaction, `PRAGMA user_version = 6`. history_feed v5 rebuilt with `viaje` rows and the check
   photo count. Test: fresh DB 0 → 6; the v2.0 and v2.1 backup fixtures
   (docs/imp-28092026/fixtures/*.json, plus a v2.1.2 export you take now from the seed) import
   into v6 with volumes converted; a DB at v5 with 6 fuel logs in gallons migrates and
   computeEconomy returns the same km/gal as before to 3 decimals (write this test BEFORE changing
   economy.ts; it is the canary of the whole phase).
2. UNITS (lib/domain/units.ts): GAL_L = 3.785411784; toLiters/fromLiters/formatVolume/
   formatEconomy/formatPricePerUnit; economy units km_gal | km_l | l_100km (l_100km inverts
   "better"). lib/fuel.ts unit labels come from the vehicle now. Every place that prints a
   volume, a price per gallon or an economy number goes through units.ts: FillUpForm, review
   sheet, Inicio consumption line, Cifras (charts + KPIs + TCO), Historial rows, reports
   (lib/report/html.ts), CSV export, public dossier (lib/share/dossier.ts, html.ts), book PDF
   (lib/book/render.ts), the fuel prices board (precios.tsx — RD$/gal stays gallons because that
   is how prices are posted; convert on the way in). Grep for 'gal' and '/gal' and 'km/gal'
   to find them all; list the files in the report.
3. TYPES + REPOS: lib/db/types.ts (VehicleStatus enum with nine values, Trip, TripPoint,
   FuelLog gauge fields, oil fields, vehicle fields), repos for trip (+ tripPoints local ops:
   insertBatch, forTrip, purgeOlderThan), garageLayout setting helpers, `vehicleGallery`,
   `vehicleStatus` domain (lib/domain/vehicleStatus.ts: labels, badges, isArchivedFor, isEx,
   statusLine). Update lib/domain/garage.ts statusBadge for the new statuses (all `outline`;
   ACCIDENTADO uses tone red? No — one accent + one status colour per screen: keep outline; the
   status line under the name carries the meaning).
4. SYNC: SYNC_TABLES + trip; BOOLEAN_COLUMNS + in_reserve; local-only allow-list (trip_point,
   trip_state) in the parity test; parity test parses sql/018 as well; SCHEMA_HINT = 'v6' and
   every push stamps schema_hint; unit bridge on pull/push per 02-cloud-v3.md "Sync protocol
   changes" 2 (write both volume_l and legacy gallons on push; read volume_l when present).
   npm run types:gen after applying the SQL. verify-sync 18–20 added and green; local-rls checks
   for trip added and green BEFORE applying to x-core.
5. CLOUD: sql/018_schema_v3.sql and sql/019_rls_v3.sql exactly as 02-cloud-v3.md describes (copy
   the policy shape from track_event in sql/010/013; do not write new predicates). Apply. Run
   verify-x-core (23 + the new trip checks), verify-sync (20).
6. REFDATA (lib/domain/refdata/): makes.json (~60 makes common in the DR with 15–40 models each,
   seeded from the abhionlyone data where the license allows — CC BY 4.0: add the credit in
   docs/CREDITS.md and in Más → Acerca de — plus the DR models the research lists as missing:
   Hilux, Prado, Hiace, Fortuner, Corolla Levin/Sprinter Trueno AE85/AE86, Starlet, Tercel,
   Hyundai H-1/Grand i10/Accent/Elantra/Santa Fe/Tucson, Kia Picanto/Rio/Sportage/Sorento/K5,
   Honda Fit/Civic/CR-V/Accord/HR-V, Nissan Sentra/Versa/Kicks/X-Trail/Frontier/Patrol/March/Tiida,
   Mitsubishi Lancer/Montero/L200/Outlander/Mirage, Suzuki Swift/Vitara/Jimny/Alto, Daihatsu
   Terios/Sirion/Hijet, Citroën C3/C4/DS3/Berlingo/Xsara/Saxo, Peugeot 206/207/208/301/307/308/
   3008/Partner, VW Jetta/Golf/Polo/Tiguan/Amarok, Mazda 3/6/CX-5/CX-30/BT-50, Subaru Impreza/
   WRX/Forester/Legacy, Chevrolet Aveo/Spark/Cruze/Silverado, Ford Explorer/Escape/F-150/Ranger/
   Fiesta/Focus, BMW 3/5/X3/X5, Mercedes C/E/GLC/GLE, Isuzu D-Max/MU-X, Jeep Wrangler/Grand
   Cherokee, Lexus, Infiniti, Acura, Land Rover, Porsche 911/Cayenne/Macan, Tesla Model 3/Y,
   BYD, Chery, Geely, JAC, Changan — with a year range per model where known and null otherwise),
   colors.json (18 + interior list), bodyTypes.json, oil.json (grades, types, specs, brands),
   fluids.json. Each file: `{"source": "...", "license": "...", "items": [...]}`. Loader
   lib/domain/refdata/index.ts with searchMakes/modelsFor/yearsFor using the 2.1.1 accent fold.
   Total raw ≤ 50 KB; assert in a test. Nothing renders them yet (Phase 3).
7. FLAGS: FEATURE_TRIPS, FEATURE_FEEDBACK, FEATURE_GARAGE_V2, FEATURE_LAUNCH_ANIM in lib/flags.ts,
   all false.
8. Tests: units (both directions, exact factor), migration canary, parity, vehicleStatus,
   refdata search (accents: "citroen" finds Citroën, "trueno" finds Sprinter Trueno), backup
   round-trip v5 → v6 → export → import.

VERIFY: web + Android (preview build over the seed AND over Xaviel's real garage via adb backup
→ no: never touch his real DB in a phase build; use the seed on the emulator, and the Redmi only
with a fresh install of the preview build using a test account): Inicio, fuel flow, Cifras show
the same numbers for a gallons vehicle as 2.1.3 did (screenshot side by side, docs/qa/
imp-29092026-phase-2-units-before-after.png). Report block; notes closed: 15 (schema part),
groundwork for 4, 10, 11, 16, 1.
```
