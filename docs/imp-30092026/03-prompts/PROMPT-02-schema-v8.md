# PROMPT 02 — Schema v8 + cloud sql/025–026 + flags

**Depends on:** Phase 1 tagged · **Branch:** `imp-30092026/phase-2-schema-v8` · **ADRs:** 38 · **Size:** M

> **Before running:** approve `sql/025_schema_v4.sql` and `sql/026_rls_v4.sql` when asked
> (additive, `carguy` only, no `--shared`). `npm run types:gen` needs the Supabase login.
>
> **How to run:** `cd` to the repo folder, `claude`, paste below the line.

---

```
Phase 2 of IMP 30092026: every table and column the cycle needs, once (ADR-38). No screens.

Read first:
- docs/imp-30092026/02-specs/01-data-model-v8.md (statements given), 02-cloud-v4.md §025, §026, Sync
- lib/db/migrations.ts (v7 pattern), lib/db/migrationV6.ts, lib/db/types.ts, lib/sync/tables.ts,
  __tests__/sync/schema-parity.test.ts (its LATER list), lib/store.tsx (reference_prices /
  price_week_label reads), lib/backup.ts, sql/019–024 (policy shapes: copy torque_spec's for
  vehicle_fact, owner-only for the rest), tools/local-rls/

Branch: imp-30092026/phase-2-schema-v8

1. MIGRATION v8: fuel_price (+ data migration from the two settings: one row per fuel, source
   'manual', valid_from parsed from the label — write parseWeekLabel with tests for "15–21 ago
   2026 (MICM)", "25 sep – 2 oct 2026", garbage → today), fuel_price_ref cache, milestone event
   columns (+ backfill kind accidente → event_type accidente / severity moderado; others hito),
   specsheet "what I buy" columns, vehicle_fact, legal_acceptance, vehicle_share.show_tires,
   trip.diagnostics, trip_point.keep_until (backfill finalize + 30 d), settings keys. history_feed
   v6 with evento rows. Tests: 0 → 8; v7 fixture (take a 2.3.0 export from the seed now) → v8 with
   prices migrated; backup export/import carries the new tables.
2. TYPES/REPOS/DOMAIN stubs: FuelPrice, FuelPriceRef, Event fields on Milestone, VehicleFact,
   LegalAcceptance; repos; lib/domain/fuelPrices.ts (currentBoard, series), lib/domain/events.ts,
   lib/domain/carMemory.ts, lib/domain/tireStats.ts, lib/legal/index.ts — with tests on the seed.
   The store stops reading reference_prices/price_week_label and reads currentBoard().
3. SYNC: SYNC_TABLES + fuel_price, vehicle_fact, legal_acceptance; parity LATER + sql/025;
   refreshFuelPriceRef() (anon select of carguy.fuel_price_ref → local cache; the cloud table is
   created in Phase 5's sql/027 — until then the fetch tolerates 404/42P01 silently); verify-sync
   21–23; local-rls checks for the three tables + member facts + dossier tires switch; apply
   sql/025 and 026; types:gen; verify-x-core.
4. SEED: the Phase 0 events data, 4 facts on the Trueno ("Código de radio", "Torque tapa de
   válvulas"…), "what I buy" on the DS3 (Castrol Edge 5W-30, filtro Fram PH6607 — fictional PN is
   fine, say so), 6 weeks of fuel prices (manual), tires: the Trueno has 14 tire rows over 2 years
   with statuses (so tireStats has something to count).
5. FLAGS: FEATURE_MAP_V2, FEATURE_DRIVE_MODE, FEATURE_I18N, FEATURE_EVENTS, FEATURE_ONBOARDING_V2,
   FEATURE_LEGAL — false.

VERIFY: web + Android preview build (test account, fresh install; and the seed on the emulator if
disk allows — check `df` first, last cycle was at 91 %): app opens, prices board shows the
migrated rows with the same numbers as 2.3.1 (screenshot pair), Historial unchanged. Report block;
Notes closed: none (groundwork for 1, 3, 5, 6, 10, 15).
```
