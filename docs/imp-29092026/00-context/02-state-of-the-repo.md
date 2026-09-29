# State of the repo — 2026-09-29, after v2.1.2

Read from the laptop the same day (files listed at the end). PROMPT-00 re-audits this against the
code and writes the corrections in PROGRESS.md, as the last cycle did.

## Identity and delivery

| | |
|---|---|
| Repo | `github.com/XavielT/car-guy`, `main` at v2.1.2 (tag `v2.1.2`). Local folder **still** `~/dev2/tu-gasolina-rd` (rename pending, manual) |
| App | `app.json`: name Car Guy, slug `car-guy`, version **2.1.2**, `com.xaviel.carguy`, scheme `carguy`, EAS projectId `8b640709-63cc-4959-b027-05f71e81db23`, `appVersionSource: remote` |
| Expo | SDK 57 (`expo` 57.0.26), RN 0.86, React 19.2, expo-router 57, TS 6, New Architecture; `patches/@expo+metro-config+57.0.12.patch` and `patches/react-native-svg+15.15.4.patch` applied by patch-package on `postinstall` |
| Android | Universal APK per release on GitHub (`releases/car-guy-v2.1.2.apk`, ~124 MB, EAS cert `a16450a0…`); AAB built, not uploaded (no Play listing — Xaviel's call, future). Local builds: `set -a; . ./.env.expo.local; set +a; npx eas-cli@24.8.0 build --platform android --profile <preview|release-apk|production> --local --non-interactive` |
| eas.json | profiles `development` (dev client), `preview` (apk, arm64 only), `production` (aab, autoIncrement), `release-apk` (apk universal). **No `env` block and no `environment` field** → the release APK shipped without `EXPO_PUBLIC_SUPABASE_*` |
| Web | `car-guy.vercel.app` (Vercel project `car-guy`), static export + `api/c/[slug].ts`; env vars set 2026-09-29 (`EXPO_PUBLIC_SUPABASE_URL/ANON_KEY` for the bundle, `SUPABASE_URL/ANON_KEY` for the function); `vercel.json` has per-route rewrites and `X-Frame-Options: DENY`; service worker `carguy-v4`, `/c/` and `/api/` never cached |
| Old web | `tu-combustible-rd.vercel.app` still git-connected (delete when ready) |
| Cloud | Supabase `x-core` (ref `nakgrkcqyuycadeuenuw`), schema `carguy`: v1 (19 tables) + v2 (`sql/009–010`) + storage v2 (`011`) + public share (`012`) + members (`013`, fixed by `014`) + member catalogues (`015`, `016`) + track layout (`017`). Private bucket `carguy-media`. Tools: `apply-sql.mjs`, `verify-x-core.mjs` (23), `verify-sync.mjs` (17), `tools/local-rls/run.sh` (39, local PostgreSQL 16 with a Supabase shim), `smoke-public-page.mjs` (6), `cleanup-probe-media.mjs`, `make-icons.mjs` |
| Portfolio | `~/dev2/xaviel-web-v2` (Angular 21 + Tailwind, Vercel `xaviel-web-v2.vercel.app`, Vitest). `home.ts` `apps[]` already has the Car Guy card (icon `public/assets/apps-imgs/car-guy.png`, `url` car-guy.vercel.app, `apkUrl` `…/car-guy/releases/latest`, description key `app.carGuy.description`) committed to `main` `7a228f1` **and** to branch `imp-11092026/phase-3-admin-shell`. Whether Vercel deployed `main` is what note 9 is about — check live |

## Local schema (SQLite `carguy.db`, `PRAGMA user_version` = 5)

- v1: 18 tables + view `history_feed` (vehicle, vehicle_spec, odometer_reading, fuel_log,
  service_type, service_record, service_record_item, part, expense, reminder, inspection_template,
  inspection_item, inspection, inspection_result, task, document, media, setting).
- v2 (`lib/db/migrationV2.ts`): vehicle identity columns (`nickname`, `status`, `chassis_code`,
  `chassis_number`, `engine_code`, `transmission`, `drivetrain`, `origin`, `imported_year`, `story`),
  `media` v2 (`taken_at`, `date_precision`, `source`, `blurhash`, thumbs, remote paths), and 23
  tables: vehicle_ownership, milestone, album_item, mod_category, mod, mod_media, vehicle_specsheet,
  spec_snapshot, torque_spec, wishlist_item, inventory_item, wheel_set, tire, contact,
  vehicle_dtc_event, fluid_guide_item, venue, track_event, track_session, setup_sheet,
  consumable_usage, vehicle_share, vehicle_member (+ `profiles` cloud-only).
- v3, v4: `history_feed` view rebuilt. v5: `track_event.layout`.
- `VehicleStatus = 'activo' | 'proyecto' | 'guardado' | 'vendido' | 'perdido'` (`lib/db/types.ts:59`);
  the form offers activo/proyecto/guardado; vendido goes through the sale sheet.
- `fuel_log`: `is_full_tank`, `missed_previous`, `volume` (in the vehicle's unit — **gallons** in
  practice: `lib/fuel.ts` labels every fuel type `gal`), `price_per_unit`, `total_dop`.
- `vehicle`: `tank_volume` (same unit), `purchase_date`, `purchase_price` (in the form under
  "+ Compra", collapsed), `color` free text, `make`/`model` free text, `year` number field,
  `type` chips `carro | jeepeta | camioneta | motor | camion | guagua | otro`, one `photo_media_id`.

## Sync

`lib/sync/tables.ts` `SYNC_TABLES` (declarative, `keyedBy` id/user_id/user_key, `localOnly`,
`pullOnly` for `vehicle_member`), `BOOLEAN_COLUMNS`; `__tests__/sync/schema-parity.test.ts` parses
`sql/002` + `sql/009` (check which files it reads before adding a table). LWW by `updated_at`;
`updated_by` on v2 tables; members pull by cursor with re-pull on grant. Media bytes via
`lib/sync/mediaBytes.ts` (thumb first). Quota RPC `storage_usage_bytes()`, 300 MB/user.

## Code map for this cycle

| Area | Files |
|---|---|
| Vehicle form | `components/VehicleForm.tsx` (16.5 KB; chips for type/status/transmission/drivetrain/origin; `Field` inputs for make/model/year/color/plate/vin/tank/odometer; `PhotoPicker` single; `+ Compra` and `+ Identidad` toggles), `app/vehiculo/nuevo.tsx`, `app/vehiculo/[id]/editar.tsx`, `lib/db/vehicleOps.ts` |
| Photos | `lib/media/index.ts` (`compress()` uses `ImageManipulator.manipulate(uri)` → `resize` → `renderAsync` → `saveAsync`; `ingest()`, `pickCandidates()`, `importCandidates()`, `pickPhoto()`), `components/PhotoPicker.tsx` (single slot, `Alert` on error — this is where the note-12 error surfaced), `components/album/*` |
| Cluster / home | `app/(tabs)/index.tsx` (24 KB: vehicle switcher, `ClusterHero`, próximo servicio, quick actions), `components/ui/ClusterHero.tsx` (SVG tachometer 0–10 scale, needle via Reanimated, `LcdDigits` odometer, `TelltaleRow`), `lib/motion/gaugeSweep.ts` (once-per-cold-start sweep, lamp test, reduced motion), `lib/domain/cluster.ts` |
| Splash | `app.json` plugin `expo-splash-screen` (static `assets/images/splash-icon.png`: amber arc, red end, orange needle, LCD "085"); `app/_layout.tsx` `preventAutoHideAsync()` at import, `hideAsync()` once fonts load |
| Garage | `app/(tabs)/garaje.tsx` (hero card for the active vehicle with cover photo; other cars as text cards two-up; filters ACTIVOS / PROYECTO / EX; `garageFacts`), `lib/domain/garage.ts` (badges, `isArchivedFor`, `isEx`), `lib/db/garageQueries.ts` |
| Fuel | `components/FillUpForm.tsx` (full/partial `Segmented`, `missedPrevious`), `components/FillUpReviewSheet.tsx`, `lib/domain/economy.ts` (`computeEconomy` brim-to-brim, `reviewFillUp`, `parseDecimal`, `odometerBounds`), `lib/fuel.ts` (fuel types + unit labels), `app/carga/*` |
| Service / oil | `app/servicio/nuevo.tsx` (22 KB; items, parts, one `PhotoPicker`), `lib/domain/catalog.ts` (service types incl. `aceite_motor` "Sintético: 10,000 km / 12 meses"), `lib/db/serviceOps.ts` |
| Checks | `app/chequeo/[templateId]/run.tsx` (per item: verdict; on `falla` a note + **one** `PhotoPicker` with `ownerTable 'inspection_result'`), `app/inspeccion/[id].tsx` (detail), `lib/db/inspectionOps.ts` |
| Mods | `components/build/ModForm.tsx` (costs RD$/USD + rate, photos with roles antes/después/instalación/recibo/dyno), `lib/domain/build.ts` |
| Stats | `app/(tabs)/cifras.tsx`, `lib/domain/stats.ts`, `lib/db/statsQueries.ts` (TCO exists since 2.0 — check what it sums) |
| Account | `lib/cloud/supabase.ts` (`isCloudConfigured`, `getSupabase()` null when unset), `lib/cloud/auth.ts` (`notConfigured()` → `es.account.notConfigured`), `app/cuenta.tsx` (`StatusPill` + `notConfiguredCaption` — the text with `.env.example` that a user saw) |
| Más | `app/(tabs)/mas.tsx` (rows: Cuenta, Datos, Recordatorios, Notificaciones, Catálogo, Contactos, OBD, Compartidos, Exportar…) |
| Strings | `lib/i18n/es.ts` (88 KB) |
| Flags | `lib/flags.ts` (`FEATURE_SYNC`, `FEATURE_ALBUM`, `FEATURE_BUILD`, `FEATURE_DIY`, `FEATURE_TRACK`, `FEATURE_SHARE` — all true in 2.1) |
| Tests | 826 (`__tests__/domain/*`, `__tests__/sync/*`, `__tests__/helpers/sqlite.ts`) |
| Docs | `docs/NEXT.md` (hand-off, backlog), `docs/RESUME.md`, `docs/imp-17092026/`, `docs/imp-28092026/` (PROGRESS.md 99 KB with every phase report), `docs/qa/*.png` |

## Backlog carried from NEXT.md §3 (not in the notes, do not lose)

- `decode-uri-component` ≤ 0.4.2 (3 moderate audit findings) until expo-router leaves query-string 7.
- Heat cycles per event vs per session — done in 2.1.2. PB per venue+layout — done.
- `inventory_item.used_in_mod_id` — still text in notes.
- Two tabs cannot share the OPFS database (accepted); LWW conflicts silent (accepted).
- Keystore backup off the machine; Music Hub sign-in check; Play Store — future.

## Files read for this audit

`docs/NEXT.md`, `docs/RESUME.md`, `CHANGELOG.md`, `app.json`, `eas.json`, `app.config.js`,
`.env.example`, `package.json`, `vercel.json`, `docs/imp-28092026/04-tracking/PROGRESS.md`,
`components/VehicleForm.tsx`, `components/PhotoPicker.tsx`, `components/FillUpForm.tsx`,
`components/FillUpReviewSheet.tsx`, `lib/domain/economy.ts`, `lib/domain/garage.ts`,
`lib/domain/catalog.ts`, `lib/media/index.ts`, `lib/cloud/supabase.ts`, `lib/cloud/auth.ts`,
`app/cuenta.tsx`, `app/(tabs)/garaje.tsx`, `app/(tabs)/index.tsx`, `app/(tabs)/mas.tsx`,
`app/_layout.tsx`, `lib/motion/gaugeSweep.ts`, `components/ui/ClusterHero.tsx`,
`lib/db/migrations.ts`, `lib/db/types.ts`, `lib/sync/tables.ts`, `lib/flags.ts`,
`app/chequeo/[templateId]/run.tsx`, `components/build/ModForm.tsx`, `app/servicio/nuevo.tsx`,
`lib/fuel.ts`, `assets/images/splash-icon.png`, `docs/qa/imp-28092026-phase-8-android-inicio.png`,
`docs/qa/imp-28092026-phase-2-android-garaje.png`; portfolio `home.ts`, `home.html`,
`app-card.*`, `app-card.model.ts`, `i18n/es.ts`, `vercel.json`, `.env.example`, `package.json`.
