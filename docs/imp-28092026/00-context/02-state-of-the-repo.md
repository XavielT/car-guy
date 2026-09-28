# State of the repo after v2.0.0 (read-only audit, 2026-09-28)

Path today: `/home/xaviel/dev2/tu-gasolina-rd` (PROMPT-00 renames it to `~/dev2/car-guy`). GitHub:
`XavielT/car-guy`. Everything below was read from the code and `docs/`; if it has moved on when a
prompt runs, **the repo wins** — adapt and log it in `04-tracking/PROGRESS.md`.

## 1. Facts that shape this cycle

| Area | State |
|---|---|
| Version | `app.json` 2.0.0; Android package `com.xaviel.carguy`; EAS project `@xavieldev/car-guy` (id in `extra.eas.projectId`); keystore EAS-managed; `app.config.js` appends `extra.gitSha` |
| Stack | Expo SDK 57 (`expo ~57.0.14`, RN 0.86.2, React 19.2.3, expo-router ~57.0.14, TS 6.0.3), New Architecture, typed routes on. `npx expo-doctor` says 15 packages are a few patches behind SDK 57 targets (docs/NEXT.md) |
| Data | `expo-sqlite` async API, `carguy.db`, **schema version 1 only** (`lib/db/migrations.ts` has the `{version, up}` array pattern ready for v2), repos in `lib/db/repos/*` (`base.ts` maps snake↔camel mechanically), ops files (`vehicleOps`, `serviceOps`, `inspectionOps`, `syncOps`, `statsQueries`), `seed.ts` (catalog + per-vehicle defaults, change-only upserts) |
| Tables (19) | `setting, vehicle, vehicle_spec, odometer_reading, fuel_log, service_type, service_record, service_record_item, part, expense, reminder, inspection_template, inspection_item, inspection, inspection_result, task, document, media` + view `history_feed` |
| Types | `lib/db/types.ts` — `Syncable {id, createdAt, updatedAt, deletedAt, syncedAt}`; `Vehicle` has `type, make, model, year, trim, color, plate, vin, defaultFuelType, tankVolume, initialOdometerKm, purchaseDate/Price, soldDate/Price, photoMediaId, notes, isArchived, sortOrder` (no nickname, no status, no chassis code, no story) |
| Media | `lib/media/index.ts`: `pickPhoto({camera, ownerTable, ownerId, vehicleId})` → 1600 px JPEG q0.75 → Android file under `Paths.document/media/<vehicleId>/` (relative path) / web BLOB; `useMediaUri`; **single photo per pick, no EXIF date, no thumbnails**; sync uploads bytes to private bucket `carguy-media/<user_id>/<id>.jpg` (`lib/sync/mediaBytes.ts`, `remote_path`) |
| Sync | `lib/sync/{engine,tables,merge,triggers,useSync,wipeCloud,mediaBytes}.ts`. `SYNC_TABLES` is declarative in dependency order with `keyedBy` (`id` / `user_id` for seeded catalogues / `user_key` for settings) and `BOOLEAN_COLUMNS` pinned by `__tests__/sync/schema-parity.test.ts` which parses `sql/002`. Pull predicate = `user_id = auth.uid()` via RLS + cursor on `server_updated_at`. LWW by `updated_at`. Contract `node tools/verify-sync.mjs` 14/14 |
| Cloud | Supabase `x-core`, schema `carguy`: `sql/001_invite_trigger_app_aware.sql` (the one `IF`), `002_schema_carguy.sql` (19 tables, text ids, `user_id default auth.uid()`, `server_updated_at`), `003_rls.sql` (76 policies, own rows), `004_storage.sql` (private bucket), `005_lww.sql`, `006_drop_tucombustible_probe.sql`, `007_user_cascade.sql`, `008_catalog_per_user_keys.sql`, `999_cleanup_test_users.sql`, `rollback.sql`. Apply with `node tools/apply-sql.mjs <file>` (`--shared` only for public/auth/storage). `tools/verify-x-core.mjs` 7 checks. Every Car Guy signup also gets a Music Hub `public.profiles` row (accepted) |
| Theme | `constants/theme.ts`: `Palette {bg{base,surface,raised}, line, text{primary,secondary,muted}, accent, accentPressed, accentInk, status{ok,proximo,urgente,vencido}, statusBg, danger, dangerInk, cardShadow}`; dark `#121212/#1B1B1B/#212121`, accent `#FFB300`, pressed `#FF8F00`, status green/`#FFD166`/`#FF5F00`/`#F0483E`; light variant; `fonts {display: SpaceGrotesk_700Bold, title: SpaceGrotesk_500Medium, body/medium/semibold: Manrope, mono/monoBold: JetBrainsMono}`; `radius {card 20, input 14, button 14, chip 999, sheet 24}`; `space` scale. `lib/theme/useTheme.ts` (system/dark/light in AsyncStorage). Category colours + `categoryInkLight`; `dangerInk` |
| UI kit | `components/ui/{index (PrimaryButton, GhostButton, Chip, Card, Field…), StatusPill, GaugeRing (svg), OdometerHero, QuickActions, RecordRow, Sheet, EmptyState, Surface}`, `components/charts/*` (gifted-charts), `DateField(.web)`, `PhotoPicker`, `FillUpForm`, `VehicleForm`, `ReminderForm`, `AlertHost`, `BootError`, `SyncPill`, `FirstSyncBanner` |
| Screens | tabs: `index, chequeo, historial, cifras, mas`; stacks: `carga/*, catalogo/*, chequeo/[templateId]/run, chequeo/plantillas/[id], chequeo/guia, cuenta, documento(s)/*, exportar, gasto/*, inspeccion/[id], notificaciones, odometro, onboarding, precios, recordatorio(s)/*, reporte, servicio/*, tarea(s)/*, vehiculo/nuevo, vehiculo/[id], vehiculo/[id]/editar, dev/{tokens,seed}` |
| Strings | all in `lib/i18n/es.ts` (46 KB) |
| Domain | `lib/domain/{catalog, dates, economy, history, inspections, legal-dr, odometer, reminders, stats}.ts` — pure TS, tested |
| Tests/tooling | jest-expo, 450 tests; `npx expo lint`; `npm run build` (static export + `finalize-web.mjs`); `tools/{apply-sql, verify-x-core, verify-sync, verify-shared-ids, cleanup-probe-media, make-icons}.mjs` |
| Web | `car-guy.vercel.app` (project `car-guy`, `main` auto-deploys); old project `tu-combustible-rd` still git-connected (delete when Xaviel says); `vercel.json` static, no COOP/COEP, `Permissions-Policy: camera=(self)`; `public/sw.js` hand-written; `BootError` handles the OPFS one-tab limit |
| Backlog (docs/NEXT.md) | PDF documents not wired into the documents screen; search folds ASCII only; same-day Historial order (needs `created_at` in the view — a migration); Cifras y-axis origin; a tab label truncating at 320 px; no max width on desktop; 22 npm audit findings; expo-doctor patches; gifted-charts DOM warnings on web (dev only) |

## 2. Constraints every prompt inherits

- **Schema changes = migration v2+ in `lib/db/migrations.ts` + matching `sql/0NN_*.sql` for the
  cloud + `SYNC_TABLES` entry + `BOOLEAN_COLUMNS` update (the parity test fails otherwise) +
  `database.types.ts` regen.** Never edit v1.
- **`x-core` is shared production with Music Hub.** Only additive statements in `carguy`; nothing
  in `public`/`auth` beyond what already exists. Every SQL file idempotent with a rollback block.
- The fuel flow and the weekly check are the regression canaries. Web and Android in every phase.
- `lib/i18n/es.ts` for every string. DR vocabulary per the brief.
- The `history_feed` view can only be replaced in a migration (`DROP VIEW; CREATE VIEW`).
- Media on web is BLOB; on Android files. Anything new with photos goes through `lib/media`.

## 3. Reference docs inside the repo

- `docs/NEXT.md` — backlog + release recipe (EAS local build with the token in `.env.expo.local`).
- `docs/imp-17092026/` — previous package (ADRs 01–15, specs, research). ADR numbering continues
  here from **ADR-16**.
- `docs/imp-17092026/04-tracking/PROGRESS.md` — 140 KB of phase reports; the "Notes for the next
  phase" sections and the QA pass table are the useful parts.
