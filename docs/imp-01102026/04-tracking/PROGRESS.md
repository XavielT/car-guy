# Progress — IMP 01102026 (Car Guy 2.5 "Nakama")

Claude Code appends a report per phase (`00-context/04-conventions.md` §8).

**Started:** 2026-10-01 · **Status:** Phase 1 released (2.4.3)

## Phase status

| # | Phase | Status | Branch | Notes |
|---|---|---|---|---|
| 0 | Kickoff + Redmi diagnostics | ✅ | `imp-01102026/phase-0-kickoff` | baseline green; audit (11 items, 4 corrections); **Redmi: Car Guy has no location permission at all** + MIUI kills it → Phase 1 list |
| 1 | Fix pack 2.4.3 | ✅ | `fix/2.4.3-fixpack` | v2.4.3; notes 2, 5, 8, 9, 10, 15, 16 (dot), 17, 18 closed; 7 waits for his drive (permissions first) |
| 2 | Schema v10 + cloud 033–036 | 🟨 | `imp-01102026/phase-2-schema-v10` | 033–035 applied to x-core, verifiers green; **036 (`--shared`) left for Xaviel** |
| 3 | Medidor por cuadros + calibración | ✅ | `imp-01102026/phase-3-gauge` | notes 1, 3; FEATURE_GAUGE_SEGMENTS on |
| 4 | Updates · Apoyar · Uso | ✅ | `imp-01102026/phase-4-updates` | notes 4, 6; OTA + APK proven on the Redmi; FEATURE_OTA, FEATURE_SUPPORT on |
| 5 | Perfiles · seguir · privacidad · compartir viajes | ✅ | `imp-01102026/phase-5-social` | notes 11, 12, 14, 16; sql/037 applied; two-account web check 12/12 |
| 6 | Juntes · chat (off) · release 2.5.0 | ⬜ | | |

## Notes from the brief

| # | Note | Closed in | Status |
|---|---|---|---|
| 1 | Gauge by squares, per vehicle | 3 | ✅ |
| 2 | iPhone PWA did not open once | 1 | ✅ |
| 3 | Learn squares → liters, estimate remaining | 3 | ✅ |
| 4 | Ads / money / Supabase Pro | 4 | ✅ |
| 5 | Last sync with time | 1 | ✅ |
| 6 | Self-updating app | 4 (+ 6 OTA proof) | ✅ (production OTA proof in 6) |
| 7 | Drive not recorded automatically | 0 + 1 | 🟡 iPhone: platform limit, said (banner). Android: diagnosed (0) + blocked card / battery / last-fix (1); **closes with his drive** after he grants the permissions |
| 8 | Stale/far location | 1 | ✅ |
| 9 | Home top-right logo unclear | 1 | ✅ |
| 10 | Welcome explains the odometer | 1 | ✅ |
| 11 | Influencer public profile | 5 | ✅ |
| 12 | Friends | 5 | ✅ |
| 13 | Routes with friends (juntes, live, chat later) | 6 | ⬜ |
| 14 | Choose what is public | 5 | ✅ |
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
- Phase 3: a reading taken on another grid **keeps its raw text** ("3/8" stays "3/8") and counts at weight 0.5
  (research §7.4) instead of the prompt's "saving converts existing readings' raw labels" — the raw is what he saw.
- Phase 3: the fuel lamp is **red on the best estimate** (≤ reserve, or ≤ reserve_at squares), not on the band's top
  (research §4): after a long drive the band is wide and "hi ≤ reserve" would light only when the car is dry.
- Phase 3: the hub's tank line hides after **30 days** (02-screens) rather than research §4's 14.
- Phase 3: "Reiniciar calibración" stores its date **inside `gauge_calibration`** (`reset_at`), not a new column;
  a recompute carries it over.
- Phase 3: amounts show in **the car's unit** (gal for his cars), not always L as the spec's examples read.
- Phase 3: a new **fuel lamp** joins Inicio's telltale row (there was none); tapping it opens Nueva carga.
- Phase 5: **public photo = a ≤60 KB 128 px JPEG data URI on the profile row** (`photo_public_jpeg`, sql/037), not a
  storage object: others' files in carguy-media are private and the private path carries the user id (ADR-54);
  a public-bucket copy would need new policies on the shared storage.objects. get_public_profile / junte_detail
  now return `photo` and never `avatar_path`.
- Phase 5: **privacy zones are added from "mi ubicación ahora"** (a fresh fix ≤ 100 m), with a label and a radius
  100/300/500/1000 m; no map-pin picker this phase.
- Phase 5: `trip_share.polyline_trimmed` is a **JSON array of encoded pieces** (a zone splits a route; pieces are never
  joined).
- Phase 5: the web page `/u/<handle>` shows the card, bio, IG, cars (linked to their public page) and stats — **no
  routes** (shared trips are in the app). `show_fichas` is stored but has no block yet: a car's ficha is reached
  through its public page.
- Phase 5: handle availability is `is_handle_free()` (sql/037), not search_profiles.
- Phase 4: the "Gracias" list is **names the admin types** (`app_config.support_thanks`) after a supporter agrees,
  not a profile opt-in column — same consent, no schema change.
- Phase 4: **no new web toast**: Phase 1's service worker already reloads the PWA once on a new version (ADR-48).
- Phase 4: the APK check compares **semver** (`nativeApplicationVersion` vs the release tag), as the prompt says;
  research §3b suggested versionCode, which /api/apk does not expose.
- Phase 4: `fingerprint.config.js` skips the app version, `extra` (gitSha) and npm scripts — without it every commit
  was a new runtime and no OTA would ever have reached an APK.
- Phase 2: verify-x-core checks are **40–47** (39 was taken by sql/032); verify-sync gains 24–25.

## Observed, deferred

| Found in | Issue | Severity | Notes |
|---|---|---|---|
| 0 | Disk 95 % (6.5 GB free) | medium | clear old local APKs in `releases/` with Xaviel's OK before the next universal build |
| 0 | SW caches navigation responses without an `ok` check (`public/sw.js:93-96`) — a 5xx page could be served offline later | low | Phase 1's SW pass (ADR-48) |
| 0 | Hero card `slice(0,2)` drops the status badge when engine + discipline badges exist | low | Phase 1 garage labels |
| 2 | Realtime "Allow public access" stays on (shared project): Car Guy's junte channels must be opened with `private: true` or the 036 policies are not consulted | high for Phase 6 | `lib/junte` live client |
| 4 | **v2.4.3 APK was never published on GitHub** (latest release is v2.4.2; web is on 2.4.3) — Phase 1's report said released | medium | ship with 2.5.0 (Phase 6) or `release-apk.sh --publish` from main |
| 4 | Release builds may need more Gradle Metaspace with expo-updates (the test build did: 512 MB → OOM) | medium | add a config plugin / gradle.properties before `release-apk.sh` |
| 4 | Web: a brand-new browser profile sometimes boots into "not a database" (OPFS first open), seen 3× headless under load | medium | look at the SQLite worker open race |
| 4 | The `preview` channel carries the test OTA ("Novedades y versiones · OTA"); a fresh test build gets it until the next preview update | low | next preview publish replaces it |
| 5 | /u/<handle> is not deployed (needs the merge/push); `node tools/smoke-profile.mjs <handle>` after it | medium | the handler passed locally against x-core |
| 5 | Verifier/QA accounts to clean up: `carguy-test-1790896956029-*` (+ Phase 2's verify runs) | low | sql/999 on Xaviel's "run the test user cleanup" |
| 5 | Header titles are upper-cased by the theme, so `@qa_x` shows as `@QA_X` | low | handles are case-sensitive in meaning; consider a no-transform title for /u |
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

## Phase 5 — Perfiles · seguir · privacidad · compartir viajes   (branch `imp-01102026/phase-5-social`)

**Status:** done; `FEATURE_SOCIAL = true`. **Notes closed: 11, 12, 14, 16.**

### Changed
- **sql/037** (applied to x-core, local-rls 215/215): `photo_public_jpeg` + `photo` in get_public_profile/junte_detail,
  `is_handle_free`, `list_follows(followers|following|friends|requests_sent)`, `admin_reports` /
  `admin_set_report_status`.
- **Perfil → Perfil público** (`components/social/PublicProfileEditor.tsx`): @handle normalised as typed + live check
  (Disponible / Es el tuyo / Ya lo usa alguien / Reservado / formato / cooldown 30 d), bio 160, Instagram, switches
  (cuenta pública, foto pública, carros, stats, fichas), "Qué ven los demás" → /u/<me>. Privacy zones
  (`PrivacyZonesEditor`, local-first, synced).
- **Perfil público** `app/u/[handle].tsx` (native + web, deep link carguy://u/<handle>): only get_public_profile +
  list_trip_shares; Seguir / Solicitar / Solicitado / Siguiendo / Amigos / Seguir también; counts; bio, IG, cars,
  stats, shared trips drawn from the trimmed pieces (`RouteThumb`, no map tiles); "…" → Reportar · Bloquear.
- **Más → Comunidad** (`app/comunidad.tsx`): search (accent-folded in the RPC), Solicitudes (aceptar/rechazar), Amigos,
  Seguidores (quitar), Siguiendo (+ enviadas), Bloqueados (desbloquear); `lib/social/store.ts` with the
  `social_cache` table, optimistic reducer (`lib/social/cache.ts`), "sin conexión" offline; cleared on sign-out.
- **Compartir viaje** (`app/viaje/compartir/[id].tsx`): trimmed on the phone (`trimForSharing`, seeded 300–500 m ends,
  zones cut), preview over the full route (owner's phone only), Seguidores / Solo amigos / Público, title,
  Dejar de compartir; `trip_share` row synced — the cloud gets only the trimmed pieces.
- **Web** `/u/<handle>` (`api/u/[handle].ts`, `lib/share/profileHtml.ts`, vercel.json): OG tags, og:image = public
  photo (`?photo=1` serves the bytes) or the drawn avatar PNG (`public/avatars/*.png`, `tools/render-avatars.mjs`) or
  the app icon; noindex unless public. `tools/smoke-profile.mjs`.
- **Admin → Reportes**; Términos §6: one paragraph on @usuario (version unchanged; FEATURE_LEGAL is off).

### Acceptance
- [x] tsc, lint (0 errors), jest **2,146** (handle rules, visibility resolver, cache reducer, web renderer, base64).
- [x] **Two accounts** (web UI for A, API for B and stranger C — throwaway, never Xaviel's): A signs in, handle
  "Disponible", saved; A → private B = "Solicitado"; B accepts + follows back → Amigos lists B; A shares the DS3 trip
  "solo amigos" → B sees it, C and anon do not; the shared route starts 451 m / ends 408 m from the real ends; A blocks
  B → neither sees the other and B loses the share; others never get A's id or a photo with photo_public off.
  Screens `docs/qa/imp-01102026-phase-5-web-*.png`.
- [x] `/u/<handle>` handler run locally against x-core: 200 + og + bio for the public profile, 404 noindex for unknown
  and malformed handles, no uuid in the HTML.
- [ ] Deployed `/u/<handle>` + smoke-profile (after merge).
- [x] Android test APK on the Redmi: deep links `carguytest://u/<handle>` and `carguytest://comunidad` open the profile and Comunidad (read-only — the test app is signed into Xaviel's account); no FATAL. `…-android-comunidad.png`.
- [ ] Xaviel: his @handle, switches and zones on his own phone; a second real person for a real follow.

## Phase 4 — Updates · Apoyar · Uso y costos   (branch `imp-01102026/phase-4-updates`)

**Status:** done; `FEATURE_OTA`, `FEATURE_SUPPORT` on. **Notes closed: 4, 6** (the production OTA 2.5.1 proof is
Phase 6's).

### Changed
- **EAS Update** (ADR-52): `expo-updates` + `expo-intent-launcher`; `runtimeVersion: fingerprint`, `updates.url`,
  ON_LOAD, fallback 0; channels in eas.json (preview / production / release-apk) and the request header written by
  app.config.js per variant (test → `preview`, real → `production`) so every build path is right.
  `fingerprint.config.js` (see deviations). `lib/updates/ota.ts` (check → fetch → otaReady; "Reiniciar" refuses
  during a trip), `useUpdateChecks` (launch + back after 30 min), `UpdateBanner` on Inicio, Novedades shows
  "Canal … · Actualización …" and "Buscar actualización" runs OTA + APK. After an OTA, "Tienes" shows the JS version.
- **APK updater**: `lib/updates/apk.ts` — /api/apk (or `EXPO_PUBLIC_APK_FEED` for tests) once per launch, semver
  compare, `File.createDownloadTask` with progress, size check, `contentUri` → ACTION_VIEW with the APK MIME
  (`REQUEST_INSTALL_PACKAGES` in app.json), "¿Por qué pide permiso?", old downloads cleaned.
- **Release gate**: `tools/ota-gate.cjs` (`check` / `record`), `release-apk.sh --ota` → `eas update --channel
  production --environment production` when the fingerprint equals `releases/fingerprint.json` (now tracked), a
  GitHub release with notes and no APK not marked latest; else refuses and builds the APK; every APK release records.
- **Apoyar Car Guy** (ADR-53): Más → last row → why, this month's cost and the Pro ETA (published by the admin),
  links / bank text / thanks from `app_config`, "Pronto" when nothing is set, "apoyar no cambia nada". No ads.
- **Uso y costos** (admin): `admin_usage()` → bars vs Free limits (amber 70 %, red 90 %), daily history in
  `app_config.usage_history`, least-squares slope → "Pro necesario ≈ <mes>", "Publicar en Apoyar", editor for links,
  bank text and the thanks list. `lib/domain/usage.ts` pure + tests.
- Test tooling: `TEST_APP_VERSION` (test variant claims an older version to exercise the real /api/apk), Gradle
  Metaspace raised in `build-test-apk.sh`.

### Acceptance
- [x] tsc, lint (0 errors), jest **2,128** (semver, gate, usage slope/ETA among them).
- [x] Redmi, test APK (preview channel): Novedades "Canal preview · Sin actualizaciones desde la instalación" →
  published a JS-only update to `preview` (title "Novedades y versiones · OTA", runtime `47d83c9d…` = the APK's) →
  reopen → expo-updates downloaded it → Inicio "ACTUALIZACIÓN LISTA · REINICIAR" → title changed, "Actualización
  01a0f971". Screens `docs/qa/imp-01102026-phase-4-android-{novedades-canal,ota-banner,ota-applied}.png`.
- [x] Redmi, test APK claiming 2.4.0: "NUEVA VERSIÓN 2.4.2 · 161 MB" from the real /api/apk → "Descargando… 7 %" →
  size check → Android's installer chooser (cancelled; nothing installed). `…-android-apk-{banner,progress,installer}.png`.
- [x] Native change gate: + one permission → runtime `8353…` → `c9e7…` (→ `--ota` refused); reverted → `8353…`.
- [x] Web: Apoyar signed out shows the text and "Pronto" (`…-web-apoyar.png`).
- [ ] Admin Uso y costos with real numbers — needs Xaviel's admin login (the RPC refuses anyone else; 40 in
  verify-x-core proves the refusal). Then "Publicar en Apoyar".
- [ ] PayPal.me test payment (checklist) → then add the link in Uso y costos → Formas de apoyar.

## Phase 3 — Medidor por cuadros + calibración   (branch `imp-01102026/phase-3-gauge`)

**Status:** done; `FEATURE_GAUGE_SEGMENTS = true`. **Notes closed: 1, 3.**

### Changed
- **Economy on fractions** (`lib/domain/partialEconomy.ts`): levels read `gauge_*_frac` (eighths as fallback) on the
  car's grid; linear ± C/(2G) + nonlinK·C — needle numbers identical (test); learned grid ± band when the status is
  not linear; the learned reserve; "F without full" generalised to C·(1 − 1/(2G)). `fuelCfgFor` carries the gauge
  and the parsed calibration, so Inicio, Cifras, the fill-up detail, Nueva carga and the CSV all follow.
- **Vehicle gauge** (`lib/domain/gaugeVehicle.ts`): observations (other-grid readings ×0.5), `calibrateVehicle`
  (reset kept), `tankNow` (last after-level − km since at the recent km/L, band √(b² + (used·rel)²), 30-day cutoff,
  telltale), `formatFrac`, `stepForLiters`. `lib/db/gaugeOps.ts` `recalibrateVehicle` writes only on change; the
  store runs it after every fill-up save/delete, vehicle save after a gauge/tank change, the seed after the DS3.
- **Pickers** (`components/fuel/GaugePicker.tsx`): one fraction API over the needle arc, `SegmentsPicker` (N squares,
  lowest red, tap / tap-again −1 / drag, haptic tick, adjustable a11y "4 de 9 cuadros") and `PercentPicker` (5 %
  track + LCD); "Solo la luz de reserva" on all. The form keeps an untouched reading's original fraction/raw.
- **Fill-up form:** after Antes, "≈ 3.3 gal en el tanque (2.4–4.2)" (learned) or the linear caption; "quedaría ≈ …
  de …" on a partial.
- **Vehicle form** (`components/vehicle/GaugeTypeSection.tsx`): "¿Cómo marca la gasolina tu carro?" — Aguja ·
  Cuadritos · Porcentaje cards, stepper 3–20 with live preview, "¿Cuándo se prende la luz de reserva?"; editing the
  tank by > 2 L with a learned gauge offers "¿Reiniciar el aprendizaje del medidor?".
- **Hub** `TankLine`: "Tanque: 9/9 ≈ 13.2 gal · ≈ 900 km (740–1050) · hace 4 d". **Inicio:** fuel lamp (amber ≤ 2
  squares / 2/8 / 20 %, red at the reserve). **Ficha → Medidor:** the table F…E with ± bands, status, n tanks,
  "Reiniciar calibración". The fill-up detail shows readings as seen ("2/9").
- Strings es/en; tests `__tests__/domain/gaugeVehicle.test.ts` (14) on top of Phase 2's gauge/calibration tests.

### Acceptance
- [x] tsc, lint (0 errors; 1 old warning in `app/cuenta.tsx`), jest **2,115**.
- [x] Web (headless, es-DO, 390 px): seed → "DS3: medidor de 9 cuadros, aprendido (3 tanques llenos)"; hub tank line;
  Ficha table monotone with bands; DS3 Nueva carga shows 9 squares, 2 → 6 gives "2 de 9 · ≈ 3.3 gal (2.4–4.2)" and
  "6 de 9"; Trueno → Porcentaje shows the % track, → Aguja shows the arc again; no page errors.
  Screens: `docs/qa/imp-01102026-phase-3-*.png`.
- [x] Android test APK on the Redmi: new vehicle → Bars, stepper to 9 (live preview, lowest red), "1 bar left",
  saved; Nueva carga → 9 squares, tap → "2 of 9 · ≈ 2.9 gal in the tank (linear…)" (13.2 gal × 2/9); no FATAL.
  Screens: `docs/qa/imp-01102026-phase-3-android-*.png`.
- [ ] His DS3 for real: Editar → Cuadritos, 9, reserva; then mark the squares on the next fills (checklist).

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

