# PROMPT 02 — Schema v10 + cloud sql/033–036 (gauge, app_config, profiles/social, juntes, realtime)

**Depends on:** Phase 1 tagged · **Branch:** `imp-01102026/phase-2-schema-v10` · **ADRs:** 51, 54–58 · **Size:** L

> **Before running:** read and approve `sql/033_app_config.sql`, `034_profiles_social.sql`,
> `035_juntes.sql` (additive, `carguy`) and the **`--shared`** file `036_realtime_policies.shared.sql`
> (extensions `pg_trgm`, `unaccent`; schema `carguy_private` + grants; `realtime.messages` policies
> scoped to `carguy:junte:` topics). Do **not** change the Realtime "Allow public access" setting.
>
> **How to run:** `cd` to the repo folder, `claude`, paste below the line.

---

```
Phase 2 of IMP 01102026: every table/column the cycle needs, once (ADR-58). No screens.

Read first:
- docs/imp-01102026/02-specs/01-data-model-v10.md (all), 02-screens.md (for column needs)
- docs/imp-01102026/01-research/02-social-follows-live-location-juntes.md (SQL: profiles functions,
  follow/block/report, trip_share/privacy_zone, junte*, realtime.messages policies, carguy_private;
  CHECK its guessed column names against the real schema before using them) and
  01-research/03-segment-gauge-calibration.md §2 (gauge columns, backfill)
- lib/db/migrations.ts (v9 pattern), lib/db/types.ts, lib/sync/tables.ts, parity test LATER list,
  sql/024 (roles), sql/021 (feedback RPC rate-limit pattern), sql/013–014 (invite pattern),
  tools/local-rls/*, tools/apply-sql.mjs (shared guard: pass --shared deliberately for 036)

Branch: imp-01102026/phase-2-schema-v10

1. MIGRATION v10: gauge columns on vehicle + fuel_log with backfill (frac = eighths/8, raw "n/8"),
   gauge_calibration JSON; trip_share + privacy_zone local tables; social_cache + junte_cache JSON
   tables; settings keys (ota_*, profile cache); history_feed v7. Tests: 0 → 10; v9 fixture → v10
   with eighths backfilled; backup round-trip.
2. TYPES/REPOS/DOMAIN stubs: Gauge types, Calibration shape, TripShare, PrivacyZone, Junte*,
   PublicProfile; lib/domain/gauge.ts + gaugeCalibration.ts ported from research 03 (PAV, estimator,
   remaining) WITH its tests (worked example 45 L / 9 squares: liters table and bands as the report
   lists; pooling case; statuses; reserve starts); lib/domain/tripShare.ts (densify, trim ends with
   seeded offset, zone cuts, split not reconnect) with tests; lib/social/* client stubs calling the
   RPCs; lib/junte/* stubs incl. the adaptive interval T = max(4, n²/60) (tested).
3. CLOUD: write sql/033 (app_config + admin_usage RPC), 034 (profiles columns, reserved_handles,
   follow/block/report, functions get_public_profile/search_profiles/follow_user/… , trip_share,
   privacy_zone + RLS), 035 (junte, junte_member, junte_photo, junte_message, RPCs create/join/leave/
   kick/end, RLS), 036.shared (extensions, carguy_private schema + grants, realtime.messages
   policies with the `carguy:junte:` prefix check BEFORE any uuid cast). local-rls first (cases: A
   follows B public → accepted; private → requested; block removes follows and hides; outsider
   cannot read private columns via any path; trip_share visibility ×3; junte member reads, non-member
   not; realtime policy accepts a member in the window and rejects after end+6h; anon
   get_public_profile works, anon cannot read profiles rows). Apply 033–035, then 036 with --shared.
   types:gen; verify-x-core additions (39–46); verify-sync + trip_share/privacy_zone.
4. SYNC: SYNC_TABLES + trip_share, privacy_zone; parity LATER + sql/034.
5. SEED: the DS3 gets gauge_type segments / 9 / reserve_at 1 and four fuel logs with raw readings
   (the research's example) so Phase 3 can show "aprendido"; seed profiles for local tests.
6. FLAGS: FEATURE_GAUGE_SEGMENTS, FEATURE_OTA, FEATURE_SUPPORT, FEATURE_SOCIAL, FEATURE_JUNTES,
   FEATURE_JUNTE_CHAT — false.

VERIFY web + Android preview build: app opens, fuel flow unchanged for needle vehicles (numbers =
2.4.3), seed DS3 shows nothing new yet (flag off). Report block; Notes closed: none (groundwork).
```
