# Progress — IMP 01102026 (Car Guy 2.5 "Nakama")

Claude Code appends a report per phase (`00-context/04-conventions.md` §8).

**Started:** 2026-10-01 · **Status:** Phase 1 released (2.4.3)

## Phase status

| # | Phase | Status | Branch | Notes |
|---|---|---|---|---|
| 0 | Kickoff + Redmi diagnostics | ✅ | `imp-01102026/phase-0-kickoff` | baseline green; audit (11 items, 4 corrections); **Redmi: Car Guy has no location permission at all** + MIUI kills it → Phase 1 list |
| 1 | Fix pack 2.4.3 | ✅ | `fix/2.4.3-fixpack` | v2.4.3; notes 2, 5, 8, 9, 10, 15, 16 (dot), 17, 18 closed; 7 waits for his drive (permissions first) |
| 2 | Schema v10 + cloud 033–036 | 🟨 | `imp-01102026/phase-2-schema-v10` | 033–035 applied to x-core, verifiers green; **036 (`--shared`) left for Xaviel** |
| 3 | Medidor por cuadros + calibración | ⬜ | | |
| 4 | Updates · Apoyar · Uso | ⬜ | | |
| 5 | Perfiles · seguir · privacidad · compartir viajes | ⬜ | | |
| 6 | Juntes · chat (off) · release 2.5.0 | ⬜ | | |

## Notes from the brief

| # | Note | Closed in | Status |
|---|---|---|---|
| 1 | Gauge by squares, per vehicle | 3 | ⬜ |
| 2 | iPhone PWA did not open once | 1 | ✅ |
| 3 | Learn squares → liters, estimate remaining | 3 | ⬜ |
| 4 | Ads / money / Supabase Pro | 4 | ⬜ |
| 5 | Last sync with time | 1 | ✅ |
| 6 | Self-updating app | 4 (+ 6 OTA proof) | ⬜ |
| 7 | Drive not recorded automatically | 0 + 1 | 🟡 iPhone: platform limit, said (banner). Android: diagnosed (0) + blocked card / battery / last-fix (1); **closes with his drive** after he grants the permissions |
| 8 | Stale/far location | 1 | ✅ |
| 9 | Home top-right logo unclear | 1 | ✅ |
| 10 | Welcome explains the odometer | 1 | ✅ |
| 11 | Influencer public profile | 5 | ⬜ |
| 12 | Friends | 5 | ⬜ |
| 13 | Routes with friends (juntes, live, chat later) | 6 | ⬜ |
| 14 | Choose what is public | 5 | ⬜ |
| 15 | Garage label UI issues | 1 | ✅ |
| 16 | Me on the map (avatar), public photo | 1 + 5 | 🟡 dot ✅ (1); public photo in 5 |
| 17 | Clear path to add mods; dailies; accessories; DOP | 1 | ✅ |
| 18 | Paint job on the DS3 | 1 | ✅ |

## Audit corrections (Phase 0)

Checked against code at 2.4.2 (`main` 6a28eae…ba61555). ✔ = the package is right; ✗ = corrected here.

| | Item | Finding (file:line) |
|---|---|---|
| a | Gauge | ✔ `components/fuel/GaugePicker.tsx:79,86` 9 stops 0..8 (E…F), `onChange(number\|null)` (:45), re-tap clears (:93); "Solo la luz de reserva" is a separate boolean chip (:61), dial disabled at 0.4 (:49,68). `lib/domain/partialEconomy.ts`: `GaugeFillUp` :34-41 (`gaugeBefore8/After8`, `inReserve` overrides before), σ = C/16 + nonlinK·C (:80,95,98), reserve = `reserveL ?? 0.1·C`, σ = reserve/2 (:75-77); `fuelCfgFor` :285-296 never sets nonlinK (default 0.03, :71). Columns: `sql/019_schema_v3.sql:39-41` (+ CHECK 0..8 :52-53), `vehicle.reserve_volume_l` :20 (form field since 2.4.2). |
| b | User dot / freshness | ✗ partly: **no age check anywhere** (draw or auto start). Native puck = MapLibre `<UserLocation heading animated />` (`components/map/LiveMap.tsx:66`), unfiltered; web has **no puck** — a "car" circle on the newest trail point (`LiveMap.web.tsx:38,59`). Accuracy gates do exist: auto start `acc ≤ 50 m` (`lib/trips/machine.ts:67,423`), track `≤ 30 m` (`geo.ts:35`, `machine.ts:460`), but unknown accuracy passes (`acc != null &&`). `liveStore.ts:54` `GPS_STALE_MS = 10 s` only labels GPS quality. No `getCurrentPositionAsync`/`getLastKnownPositionAsync` in the app; `live.ts:73` `watchPositionAsync(BestForNavigation, 1 s, 3 m)`; web passes **no** `enableHighAccuracy`/`maximumAge`/`timeout` (expo-location web shim → browser defaults). |
| c | Service worker | ✗ **already network-first for navigations** (`public/sw.js:90-104`, falls back to cached route → `/` → error; caches without an `ok` check :93-96). `carguy-v4` (:13), `skipWaiting` with no precache (:15-19), `clients.claim` (:21-28); `.wasm`/worker/sqlite network-first (:51-68); **cache-first `/_expo/` + `/assets/`** (:72-86) — so a stale chunk, not a stale `index.html`, is the risk; bypass non-GET, cross-origin, `/c/`, `/api/` (:32-39). Registered in `app/+html.tsx:64-69`. **No iOS standalone detection anywhere** (only Android UA in `lib/release/apk.ts:61`). |
| d | Inicio seal | ✔ `app/(tabs)/index.tsx:319-325` `<Hanko char="改" size={42} />` → `router.push('/cuenta')`. |
| e | Last sync | ✔ `app/cuenta.tsx:199` `dateLabel(lastSyncAt)` — date only (`lib/format.ts:66-76`). |
| f | Garage labels | ✔ `lib/domain/garage.ts:47-52` status badge `tone: 'outline'` = transparent + `lineStrong` border (`components/ui/Badge.tsx:28`). Hero: ≤ 2 badges over the cover (`app/(tabs)/garaje.tsx:453-458`, `slice(0,2)` drops the status when engine + discipline exist); grid: last badge over the cover (:513-517); list: beside the thumb (:567). Also over photos: PinMark (:420), GalleryPill (:430). **360 px (web, seed garage — no photos, so the busy-photo case of the note is not reproducible here):** outline PROYECTO badge faint even on the placeholder; list titles clipped ("TOYOTA SPRINTER TRU…", "VOLKSWAGEN JETTA 1.8T · …"); Ex card's "2018 → vendido 2021 · 0 fotos" wraps and the 記憶 seal floats. Screens: `04-tracking/screens/garaje-360-{portadas,cuadricula,lista}.png`, `inicio-360.png`. |
| g | Mods entry | ✗ more entries than the package lists: `components/build/BuildTab.tsx:46`, `app/vehiculo/[id]/build.tsx:149`, `InventoryForms.tsx:143`, `WishlistForm.tsx:181`, `app/servicio/nuevo.tsx:76` (Historial FAB "mejora", `historial.tsx:218`) and :323; route `app/_layout.tsx:324`. **No status blocks a mod** (even Ex shows Agregar: `readOnly` at `vehiculo/[id].tsx:195` is not passed to BuildTab). Categories `lib/domain/catalog.ts:382-399` (18: motor, admision, escape, forzada, ecu, combustible, enfriamiento, transmision, diferencial, suspension, frenos, ruedas, gomas, exterior, aero, interior, seguridad, iluminacion) — **no Accesorios/Estética**. Costs are DOP fields (`ModForm.tsx:91-94`); the foreign-price helper defaults to **USD** (:96,143), saved only when used (:206). The real gap is discoverability, not a block. |
| h | Paint | ✔ `carroceria` service types are only `limpiavidrios`, `lavado` (`catalog.ts:54,61`) — no paint type. `MilestoneKind` has `pintura` (`lib/db/types.ts:401`, offered at `EventForm.tsx:34`); `EventType` (`lib/domain/events.ts:14-24`) has no `pintura`. |
| i | Welcome | ✔ `app/bienvenida/index.tsx:34` — 6 slides: lang (:214), profile (:244), car (:266), features (:296), perms (:336), account (:379); nothing on how the odometer rises. |
| j | Updates | ✔ no `expo-updates` (package.json, node_modules), no `runtimeVersion`/`updates` in app.json/eas.json. **`npx @expo/fingerprint .` today: `ae8020cd07f2c4c2f72ed0c34fb9cec5c2d77236`** (171 sources) — Phase 4's OTA gate compares against this kind of hash. |
| k | profiles live | ✗ `apply-sql.mjs` has no inspect mode (args: file, `--dry-run`, `--shared`). Read from the types regenerated off x-core today after sql/032 (`lib/cloud/database.types.ts`): `user_id, role, display_name, avatar_id, avatar_path, locale, media_quota_bytes, deletion_requested_at, deletion_objects, created_at, updated_at` — no handle/bio/public switches, as expected. |
| — | Package path | ✗ the prompt says `~/improvements/imps car guy/september 2026/imps 01102026`; it is under **october 2026**. |

## Baseline (Phase 0)

2026-10-01, branch `imp-01102026/phase-0-kickoff` from `main` (2.4.2). Folder still `~/dev2/tu-gasolina-rd` (rename pending — Xaviel).

| Check | Result |
|---|---|
| `npm ci` | ✅ 1,149 packages, 44 s (patch-package + maplibre worker copy ran) |
| `tsc --noEmit` | ✅ clean |
| `expo lint` | ✅ 0 errors |
| jest | ✅ **1,965 / 1,965** (+4 diagnostics tests on this branch → 1,969) |
| `npm run build` (web export) | ✅ 59 s, finalize-web titled 100/103 pages |
| `check:api` | ✅ 4 functions load |
| local-rls | ✅ all passed (incl. 31a–g, 32a–f, 28a–p) |
| verify-x-core | ✅ **38 / 38** |
| verify-sync | ✅ 24 / 24 |
| smoke-public-page · smoke-legal · smoke-apk | ✅ 6/6 · 6/6 · 3/3 |
| `npm audit --omit=dev` | ⚠ 3 moderate (decode-uri-component via expo-router → query-string 7; known since 3A, no fix without breaking) |
| `gh auth status` · `vercel whoami` · `eas whoami` | ✅ XavielT (ssh) · xavielt · xavieldev |
| adb | ✅ Redmi `6dbf1af4` (USB, dropped once mid-run → Wi-Fi `10.0.0.39:5555` used meanwhile) |
| Disk | ⚠ **95 % (6.5 GB free)** — a universal release build needs a few GB; old APKs in `releases/` (125–169 MB each, all on GitHub) are the first thing to clear, with Xaviel's OK |

Verifier accounts and feedback screenshots cleaned with sql/999 (`leftover_profiles: 0`) + Storage API.

## Auto-trip diagnostics (Phase 0)

Redmi Note 10 Pro, MIUI 14 / Android 13, **Car Guy 2.4.2 (versionCode 15)**, 2026-10-01 ~12:40. Read-only
(`dumpsys`, `appops`, filtered `logcat`); nothing on the phone was changed. The prompt's precondition
("Automático and *todo el tiempo* granted") was **not** met on the phone.

| Probe | Result |
|---|---|
| `ACCESS_FINE_LOCATION` / `ACCESS_COARSE_LOCATION` | **granted=false** (both); app-ops `FINE_LOCATION: ignore`, `COARSE_LOCATION: ignore` |
| `ACCESS_BACKGROUND_LOCATION` | **granted=false** |
| `POST_NOTIFICATIONS` | granted |
| `FOREGROUND_SERVICE(_LOCATION)`, `RECEIVE_BOOT_COMPLETED`, `WAKE_LOCK` | declared / granted (install-time) |
| MIUI autostart (app-op 10008) | **ignore** — a start was rejected ~1 h 28 m before the dump |
| `dumpsys deviceidle whitelist` | **not whitelisted** (battery optimisation applies) |
| App standby bucket | **40 (RARE)** |
| `dumpsys activity services` | **no service** — `LocationTaskService` not running |
| logcat (strict filter: the package, expo-location/task-manager classes, ReactNativeJS) | 11:43–11:44 SmartPower moved the process `inactive → idle → hibernation`; **11:44:35 `CameraBooster: kill app … com.xaviel.carguy` / `ActivityManager: Killing … (adj 702): camera boost`**. No expo-location / TaskManager lines at all (the task never ran). |

A first, broader logcat filter matched `ActivityTaskManager` and caught other apps' activity; that
capture was deleted unread beyond the first screen and nothing of it is recorded here.

Not run: the 2-minute background walk — with no location permission the task cannot receive fixes, so
it would prove nothing; it belongs after the fix (Xaviel's drive, manual checklist). The in-app export
("Exportar diagnóstico de viajes", below) reaches his phone with the next APK.

**Conclusion — specific failure, not green.** Automático cannot record on this phone today because
**Car Guy has no location permission at all** (foreground nor background); on top of that MIUI
autostart is off, the app is battery-optimised and in the RARE bucket, and MIUI kills it outright for
the camera. Code-side, the gap that let this go unnoticed: with the mode on Automático and the
permission missing, `armAuto()` (`lib/trips/auto.ts:112-134`) quietly disarms and returns false — the
state is visible only on Conducir, Viajes → Ajustes and Permisos (`useAutoReadiness`), never on Inicio
or Viajes, and nothing is recorded.

**Fix list for Phase 1** (no behaviour changed in Phase 0):
1. When the mode is Automático and `autoReadiness() !== 'ready'`: a persistent card on Inicio and Viajes —
   "Automático no está grabando: falta <permiso>" with the one-tap fix; `recordNote('trip-arm', reason)`
   each time `armAuto` declines (it shows in the export and the feedback diagnostics).
2. Ask for the battery exemption (`ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` via IntentLauncher; MIUI:
   "Ahorro de batería → Sin restricciones") in the Automático checklist, and add the state to the
   checklist (+ the diagnostics export — needs a small native read, or the adb check stays the source).
3. MIUI checklist order: location "todo el tiempo" → autostart → batería sin restricciones → bloquear en
   recientes; re-check on every foreground.
4. A running foreground location service (adj ≈ 200) is what survives SmartPower/CameraBooster — so the
   fix is getting it armed (1–3), not new timers; keep `RECEIVE_BOOT_COMPLETED` re-arm as is.
5. Acceptance: Xaviel grants the permissions in the app (not via adb), drives with the Redmi in
   Automático, and the trip appears by itself (`05-manual-checklist.md`).

## Decisions made along the way

- **Diagnostics export never carries a position** (`lib/trips/diagnostics.ts`): timings, accuracies,
  states only; `lastClosed`'s lat/lng and start point are dropped by naming the safe fields. Tested.
- The live `profiles` columns were read from the types generated off x-core today rather than a new
  production query (the classifier treats data reads as production reads; the schema is the same).

## Deviations from the package

- Package path is under `october 2026`, not `september 2026`.
- The 2-minute background walk was not run (no permission → no fixes possible); see diagnostics.
- `apply-sql.mjs` has no inspect mode; (k) used the generated types.
- Phase 2: **history_feed v7** (junte rows) moves to Phase 6 — there is no local junte table to list until then.
- Phase 2: **036 has only the realtime policies.** No `pg_trgm`/`unaccent` and no `carguy_private` schema: search
  folds accents with `translate()` (enough for Spanish at this size) and the helpers live in `carguy` with
  explicit revokes — fewer project-wide objects on a project shared with Music Hub.
- Phase 2: the DS3 keeps its **real 50 L tank**; research 03 §3.4 assumed 45 L. The four readings and liters are
  the example's, so Phase 3's learned table will differ slightly from the research's numbers (same shape).
- Phase 2: verify-x-core checks are **40–47** (39 was taken by sql/032); verify-sync gains 24–25.

## Observed, deferred

| Found in | Issue | Severity | Notes |
|---|---|---|---|
| 0 | Disk 95 % (6.5 GB free) | medium | clear old local APKs in `releases/` with Xaviel's OK before the next universal build |
| 0 | SW caches navigation responses without an `ok` check (`public/sw.js:93-96`) — a 5xx page could be served offline later | low | Phase 1's SW pass (ADR-48) |
| 0 | Hero card `slice(0,2)` drops the status badge when engine + discipline badges exist | low | Phase 1 garage labels |
| 2 | Realtime "Allow public access" stays on (shared project): Car Guy's junte channels must be opened with `private: true` or the 036 policies are not consulted | high for Phase 6 | `lib/junte` live client |
| 2 | `lib/db/shareQueries.ts` imports `../i18n/es` directly (lint rule ADR-39) when linted on its own; `npm run lint` passes | low | |

## Blockers

| Phase | Blocker | Needs | Status |
|---|---|---|---|
| 0 | Folder rename | Xaviel | open |
| 1 | Grant location (todo el tiempo), autostart, battery "sin restricciones" in the app, then the drive | Xaviel | open — after the Phase 1 build |
| 2 | Apply sql/036 with `--shared` (realtime.messages policies) + delete the verifier test users | Xaviel | open — needed before Phase 6 |
| 4 | PayPal.me test payment (DR account) | Xaviel | open |

---

## Phase reports

## Phase 2 — Schema v10 + cloud 033–036   (branch `imp-01102026/phase-2-schema-v10`)

**Status:** complete except 036 (`--shared`, realtime policies), which the session's safety check would not let Claude apply — Xaviel runs it (Blockers). Resumed after the laptop crash: the two domain
commits (gauge, tripShare/interval) were already on the branch; the migration, types and SQL were uncommitted
and finished here. Stale agent worktrees removed (their commits are identical to the branch's).

### Changed
- **Migration v10** (`lib/db/migrationV10.ts`): vehicle `gauge_type` (default `needle8`) / `gauge_segments` /
  `gauge_reserve_at` / `gauge_calibration`; fuel_log `gauge_{before,after}_{frac,raw}` backfilled from the eighths
  (`n/8`, eighths kept for 2.4.x phones); `trip_share`, `privacy_zone` (synced, in backups and `ALL_TABLES`);
  `social_cache`, `junte_cache` (cloud caches, cleared by reset). Tests `__tests__/db/migrate-v10.test.ts`: 0 → 10,
  v9 fixture → v10 backfill, seed, backup round-trip, reset clears caches.
- **Domain** (already committed): `lib/domain/gauge.ts`, `gaugeCalibration.ts` (PAV, worked example),
  `tripShare.ts`, `lib/junte/interval.ts` (T = max(4, n²/60)), with tests.
- **Client stubs:** `lib/social/rpc.ts` (one door, SQL error codes → reasons), `lib/social/api.ts`,
  `lib/junte/api.ts` (`junteTopic`). Loosely typed until `types:gen` runs against a cloud with 033–036.
- **Cloud SQL:** 033 app_config + admin_usage; 034 handle/bio/switches, reserved handles, follow/block/report,
  profile/search/follow RPCs, trip_share + privacy_zone; 035 juntes + RPCs; 036 (`--shared`) realtime.messages
  policies for `carguy:junte:` topics. Fixed here: `end_junte` on a junte that had not started violated
  `ends_at > starts_at` (now `ends_at = starts_at` for a cancel; `create_junte` refuses an empty window), and the
  036 restrictive guard returned NULL — a denial for **every** app — on access with no topic (now coalesced).
- **Tools:** local-rls runs 033–036 twice each + scenarios 034/035 (35l2 new, junte order made deterministic);
  `verify-x-core.mjs` 40–47; `verify-sync.mjs` 24–25 (trip_share, privacy_zone); `apply-sql.mjs` now treats
  policies on `realtime.`/`public.`/`auth.` tables and `create extension` as shared (it waved 036 through).
- **Sync:** `SYNC_TABLES` + trip_share, privacy_zone; parity test reads 033–034; the boolean map is compared on
  synced tables only (profiles' switches and app_config are RPC-only).
- **Seed:** the DS3 reads 9 squares, reserve at 1, with research 03 §3.4's four readings on four of its 12 fill-ups.
- **Flags** (`lib/flagsV10.ts`): GAUGE_SEGMENTS, OTA, SUPPORT, SOCIAL, JUNTES, JUNTE_CHAT — all false.

### Acceptance
- [x] tsc, `npm run lint` (0 errors), jest **2,101** (117 suites), `npm run build` green.
- [x] local-rls **203/203**, three runs in a row.
- [x] Web (headless, dev server): seed, Inicio and Nueva carga render as 2.4.3; no page errors; no screen reads v10.
- [x] Android test APK (`releases/car-guy-test.apk`, after clearing the crash-corrupted Gradle transforms cache): installed over the previous test build on the Redmi → migrated 9 → 10 on device, opens (2.4.3 notes sheet, gauge), no FATAL in logcat.
- [x] Applied **033, 034, 035** to x-core (HTTP 201 each); `types:gen` (+487 lines; `rpc()` names now checked).
- [x] verify-x-core **46/46** (40–47 new; 36 skipped as before); verify-sync **26/26** (24–25 new). Check 46 calls
  `junte_topic_allowed` directly, so it does not depend on 036. Test users: cleanup SQL printed by both tools.
- [ ] 036 `--shared` — `node tools/apply-sql.mjs sql/036_realtime_policies.shared.sql --shared` (Xaviel). Needed
  before Phase 6's live map, not before Phases 3–5.

**Notes closed:** none (groundwork).

## Phase 1 — Fix pack 2.4.3   (branch `fix/2.4.3-fixpack`, merged `2afff29`)

**Status:** released — v2.4.3 (see the release lines below). No schema change.

### Changed
- **iPhone PWA (note 2, ADR-48):** `public/sw.js` → `carguy-v5`: pages `no-store`, cached only when `ok`, cached
  copy after 4 s on a slow network or on a 5xx; `app/+html.tsx` reloads once on `controllerchange` (not on the
  first install). `lib/platform/capabilities.ts` (android-native · web-ios-pwa · web-ios-safari · web-android ·
  web-desktop; iPadOS-as-Mac by touch points; 4 tests). `components/IosWebBanner.tsx` on Conducir, Viajes →
  Ajustes, welcome permisos (+ "¿Por qué?" sheet). `storage.persist()` once after the first vehicle
  (`storage_persist` setting). Boot-lock copy names "Car Guy open in Safari" on iPhone.
- **Fresh location (notes 8, 16; ADR-49):** `lib/trips/freshness.ts` (dot ≤ 15 s & ≤ 50 m; 7 tests);
  `lib/trips/myPosition.ts` (one ref-counted watch: web `enableHighAccuracy`/`maximumAge: 0`/`timeout 20 s`,
  Android `getCurrentPositionAsync` first, restart on foreground; 5 tests); `components/map/UserDot.tsx` (avatar
  in an amber ring + course arrow, greyed when old) on native (`Marker`, the SDK puck removed — it cannot be
  filtered; camera follows only a fresh fix, a pan stops it via `userInteraction`) and web (overlay placed with
  `map.project`). Conducir: "Buscando GPS…" / "Última posición: hace N" / no-permission line.
  **Auto start:** the engine drops fixes older than **90 s** (or from the future) while idle — not 15 s: the
  watching service defers up to 60 s (`auto.ts`), so 15 s would discard real batches; a cached last-known fix
  is minutes–hours old (deviation from ADR-49's wording, recorded). GPX replay test now delivers each batch at
  its own "now"; new test: a drive delivered 2 h late opens nothing.
- **Automático on Android (note 7, Phase 0 list):** `lib/trips/autoStatus.ts` (first blocker: permission →
  MIUI autostart → battery; 5 tests); `AutoBlockedCard` on Inicio + Viajes; `armAuto` records why it declined;
  `modules/miui-autostart` + `getBatteryState()` (PowerManager) and `openBatterySettings()` (the system dialog,
  `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` in the module manifest; fallback to the list); the MIUI checklist's
  battery step shows ✓/✗ + "Permitir en segundo plano"; `LastFixLine` in Ajustes; the export carries the battery state.
- **Header (note 9):** Inicio → `<Avatar size={36}>` → Cuenta; 改 (28 px, "Modificado") on the Build tab.
- **Sync time (note 5):** `dateTimeLabel` ("30 sept de 2026 · 3:58 p. m." / "Sep 30, 2026 · 3:58 PM"; 3 tests)
  in Cuenta and the sync pill's long-press + screen-reader label.
- **Garage labels (note 15):** `Badge onPhoto` = solid #121212 @ 85 % with light text over covers; the hero
  keeps the status badge (engine + status) instead of `slice(0,2)`; Ex card: two-line name, one-line stats,
  記憶 in the corner. Screens: `docs/qa/imp-01102026-phase-1-garaje-*-{360,390}.png`, `…-sheet-360.png`,
  `…-inicio-360.png`, `…-conducir-360.png`.
- **Mods path (note 17):** "+ Mod" next to the hub odometer (any status; only a viewer cannot); garage card
  long-press → Agregar mod · Nueva echada · Chequeo; categories `accesorios`, `estetica` + presets (es/en);
  `seedCatalog()` now `INSERT OR IGNORE`s mod categories on every launch (migration v2 seeded them once, so new
  ones never reached existing phones). Costs were already DOP-first (audit g).
- **Paint (note 18):** service types `pintura_completa`, `desabollado_pintura` (carroceria, no interval); the
  form groups "Carrocería y pintura"; saving one offers "Guardar como evento" → milestone `pintura` (hito)
  linked to the service.
- **Welcome (note 10):** slide "Tu odómetro" after "Tu carro" + tip `odometer` on Inicio.

### Acceptance
- [x] tsc, lint, jest **1,998**, i18n frozen 0, check:api 4, local schema unchanged (v9).
- [x] Web 360/390 px: labels, long-press sheet, avatar header, Conducir lines; no page errors.
- [x] Web deploy `2afff29`; smoke-public-page 6/6, smoke-legal 6/6, smoke-apk 3/3; live `sw.js` = carguy-v5.
- [ ] Redmi: permissions granted by Xaviel in the app → walk test (Último punto GPS) → **his drive** (note 7).
- [ ] iPhone PWA: reinstall from the Home Screen, banner, dot at home at night (checklist).

**Platforms verified:** web desktop (headless 360/390) · Redmi (install over 2.4.2, below) · iPhone PWA — his checklist.
**Notes closed:** 2, 5, 8, 9, 10, 15, 16 (dot), 17, 18; 7 pending the drive.


## Phase 0 — Kickoff + Redmi diagnostics   (branch `imp-01102026/phase-0-kickoff`)

**Status:** complete
**Changed:** package copied to `docs/imp-01102026/`; pointers in `docs/RESUME.md` and `docs/NEXT.md` (Cycle 5);
"Exportar diagnóstico de viajes" in Viajes → Ajustes → avanzado (`lib/trips/diagnostics.ts`, es/en, 4 tests);
social seed `docs/imp-01102026/fixtures/social-seed.json` (fictional, local only); 360 px screens.
**Platforms verified:** Redmi (adb, read-only) · web desktop 360 px (headless) · iPhone PWA — not this phase.
**Notes closed:** 7 (Android half: finding recorded; the fix lands in Phase 1).

