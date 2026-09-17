# Repo audit — `/home/xaviel/dev2/tu-gasolina-rd` (read-only, 2026-09-17)

This is what the code actually is. Prompts reference these paths; if the repo has moved on when
you run a prompt, **the repo wins** — re-read and adapt, then note the difference in
`04-tracking/PROGRESS.md`.

## 1. Stack

| | |
|---|---|
| Framework | **Expo SDK 57** (`expo ~57.0.14`), React Native **0.86.2**, React **19.2.3**, New Architecture |
| Router | `expo-router ~57.0.14`, typed routes on (`experiments.typedRoutes`), file-based under `app/` |
| Language | TypeScript `~6.0.3`, `strict: true`, path alias `@/*` → repo root |
| Persistence | **One JSON blob** in `@react-native-async-storage/async-storage` under key `tu-combustible-rd/v1` (`lib/storage.ts`), hydrated into a React Context store (`lib/store.tsx`) and re-saved on every change |
| Web | `expo export -p web` (static, Metro) → `dist/` → **Vercel** (`vercel.json`: rewrites `/carga/:id`, security headers, cache headers, `sw.js` no-cache). Hand-written `public/sw.js` + `public/manifest.webmanifest` + `public/icons/*`. `tools/finalize-web.mjs` fills the empty helmet `<title>` after export. Live at `https://tu-combustible-rd.vercel.app` |
| Android | `app.json`: `android.package` **`com.xavieltucombustiblerd.app`**, `versionCode 2`, `version 1.1.0`, adaptive icon from `assets/images/*`. `eas.json`: `appVersionSource: remote`, profiles `development`/`preview` (APK)/`production` (AAB, autoIncrement). `android/` is gitignored (stale prebuild). Last APK on GitHub release v1.1.0 |
| Fonts | `@expo-google-fonts/{syne,figtree,ibm-plex-mono}` loaded in `app/_layout.tsx` |
| Other deps | `expo-file-system` (new `File`/`Paths` API), `expo-document-picker`, `expo-sharing` (backup export/import), `expo-sqlite ~57.0.1` (**installed + plugin, never imported — dead weight**), `expo-symbols`, `expo-web-browser`, `react-native-reanimated 4.5.1`, `react-native-worklets`, `react-native-web ~0.21` |
| Tooling | No tests, no ESLint config, no CI. `.claude/settings.json` enables the official `expo` plugin. `CLAUDE.md` → `@AGENTS.md` → **"Expo HAS CHANGED. Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code."** Keep that file; every prompt honours it |
| Scripts | `start`, `android`, `ios`, `web`, `build` (`expo export -p web && node tools/finalize-web.mjs`) |
| Docs | `README.md` (Spanish), `docs/PLAN.md` (original product plan + domain rules + design identity), `docs/NEXT.md` (pending: rebuild APK with new icon; remove `expo-sqlite`; notes on cloud sync and IDs), `docs/qa/*.png` |

## 2. File map

```
app/
  _layout.tsx           fonts, StoreProvider, Stack (titles per screen — they become the browser tab title on web)
  +html.tsx             web shell: lang es-DO, meta description, theme-color #0B1F1C, manifest, apple-touch-icon, SW registration
  +not-found.tsx
  onboarding.tsx        VehicleForm → first vehicle → replace('/(tabs)')
  vehiculo.tsx          modal: new vehicle (VehicleForm)
  gastos.tsx            expenses + maintenance reminders (inline forms, chips, list, "Marcar listo")  ← the seed of Car Guy
  precios.tsx           edit MICM reference prices + week label
  carga/[id].tsx        edit/delete fill-up
  (tabs)/_layout.tsx    redirect to onboarding if no vehicles; 5 tabs: index(Inicio) cargar historial cifras mas
  (tabs)/index.tsx      home: vehicle chips, PriceBoard hero (month spend LED + MICM rows), economy insight, last tank / average, CTA
  (tabs)/cargar.tsx     FillUpForm → reviewFillUp → Alert summary
  (tabs)/historial.tsx  fill-ups list, fuel-type filter chips, tap → /carga/[id]
  (tabs)/cifras.tsx     stats: month spend, total cost (fuel+expenses), RD$/km, km logged, avg economy, odometer timeline, by fuel type bars, month bars
  (tabs)/mas.tsx        vehicles list (activate/quitar), reference prices link, "Gastos y mantenimiento" button, backup export/import, reset
components/
  FillUpForm.tsx  VehicleForm.tsx  FuelPicker.tsx  PriceBoard.tsx  Field.tsx  T.tsx  ui.tsx (PrimaryButton, GhostButton, Chip, Card)
  Themed.tsx StyledText.tsx ExternalLink.tsx useColorScheme*.ts useClientOnlyValue*.ts   ← Expo template leftovers, mostly unused
constants/
  theme.ts   colors {canopy, canopyLift, ink, muted, receipt, receiptDeep, led, ledDim, nozzle, teal, line, white, danger} + fonts
  Colors.ts  Expo template default (unused by the app screens)
lib/
  types.ts    FUEL_TYPES, Vehicle, FillUp, EXPENSE_CATEGORIES, Expense, MaintenanceReminder, ReferencePrices, Settings, AppData, EconomyPoint
  store.tsx   StoreProvider/useStore: upsert/delete for vehicles, fillups, expenses, reminders; settings; restoreData; resetAll; activeVehicle + per-vehicle selectors
  storage.ts  KEY 'tu-combustible-rd/v1', EMPTY_DATA, normalizeData, loadData, saveData
  math.ts     roundMoney/roundVolume, parseDecimal, completeAmounts (two-of-three), sortFillUps, computeEconomy (brim-to-brim), economyById, reviewFillUp, latestEconomyInsight, inMonth, sumSpend, distanceInLogs, lastOdometer
  fuel.ts     FUEL_CATALOG (premium, regular, gasoil_regular, gasoil_optimo, glp, gnv; gal vs m³), FUEL_ORDER, DEFAULT_REFERENCE_PRICES (MICM 15–21 Aug 2026), DEFAULT_PRICE_WEEK, STATIONS, GROUP_LABEL, economyLabel
  format.ts   money (es-DO DOP), volume, km, kmPerUnit, dateLabel, monthTitle, id() (crypto.randomUUID with `id_<ts>_<rand>` fallback), todayIsoDate, isoFromDateInput, dateInputFromIso
  backup.ts   exportBackup → {app:'tu-combustible-rd', version:1, exportedAt, data} JSON shared via expo-sharing; importBackup via expo-document-picker (accepts wrapped or raw AppData)
  alert.ts    Alert shim: RN Alert on native, window.confirm/alert on web (RN-web ships Alert.alert as a no-op)
tools/
  finalize-web.mjs  patches empty <title data-rh> in dist/*.html
  make-icons.mjs    generates PNG icons from assets/pwa/*.svg with sharp (not a dependency: `npm i --no-save sharp`); scales adaptive foreground to 0.78
public/  favicon.png, manifest.webmanifest, sw.js, icons/{icon-192,icon-512,icon-maskable-192,icon-maskable-512,apple-touch-icon-180}.png
assets/  fonts/SpaceMono-Regular.ttf (template leftover), images/* (icon, splash, adaptive), pwa/*.svg (icon sources)
```

## 3. Current data model (`lib/types.ts`) — the migration source

```ts
Vehicle   { id, name, plate, defaultFuelType: FuelType, tankVolume: number|null, createdAt }
FillUp    { id, vehicleId, occurredAt, odometerKm, volume, pricePerUnit, totalDop, fuelType, isFullTank, station, notes, createdAt }
Expense   { id, vehicleId, occurredAt, odometerKm: number|null, amountDop, category: ExpenseCategory, description, createdAt }
          ExpenseCategory = maintenance|repair|insurance|tax|toll|parking|wash|other
MaintenanceReminder { id, vehicleId, title, dueDate: string|null, dueOdometerKm: number|null, completedAt: string|null, notes, createdAt }
Settings  { activeVehicleId, referencePrices: Record<FuelType, number>, priceWeekLabel }
AppData   { vehicles[], fillups[], expenses[], reminders[], settings }
```

Facts that matter for migration and sync:

- **IDs are not guaranteed UUIDs.** `id()` falls back to `id_<timestamp>_<hex>` where `crypto.randomUUID` is missing (older Android WebViews, some RN runtimes). Any cloud column typed `uuid` would reject them → the cloud schema uses `text` primary keys (ADR-03).
- **No `updatedAt`, no soft delete.** Everything is hard-deleted from the array. Sync needs both (ADR-03).
- **Dates** are ISO strings; day-only inputs are stored as local noon (`isoFromDateInput`) to dodge timezone day shifts. Keep that convention.
- **Odometer rule**: a new fill-up cannot have a lower odometer than the last one (checked in `FillUpForm.save`, not enforced on edit).
- **Economy math** (`computeEconomy`) is brim-to-brim: between two full tanks, distance / sum of volumes after the first full; partials count toward spend and the next full tank. It is correct and tested by use — **do not rewrite it; move it into the domain layer as-is.**
- The backup file format `{ app: 'tu-combustible-rd', version: 1, exportedAt, data: AppData }` is the **import contract** Car Guy must accept forever (D1).

## 4. Design tokens in use today (to be replaced — D5)

`constants/theme.ts`: canopy `#0B1F1C`, receipt `#F3EFE4`, ink `#1C241F`, muted `#5E6B64`, led `#F0B429`, nozzle `#E85D4C`, teal `#3C9A8A`, danger `#B42318`. Fonts Syne / Figtree / IBM Plex Mono. Light-only (`userInterfaceStyle: "light"`). `+html.tsx` hard-codes body background `#F3EFE4` and theme-color `#0B1F1C`; `app.json` splash/adaptive background `#0B1F1C`. All of these must move together when the identity changes.

## 5. Things already there that Car Guy builds on

- Multi-vehicle with an active vehicle and per-vehicle selectors — keep the concept, move it to the DB.
- `gastos.tsx` already has expenses with categories and basic reminders (date and/or odometer, complete, delete). Car Guy generalises this into the full maintenance/reminder model; the migration maps `Expense.category` → new `expense.category` / `service_record.kind` and `MaintenanceReminder` → `reminder`.
- Backup/restore via share sheet and document picker works on Android; on web `expo-file-system` is a stub (`File`/`Paths` warn and do nothing) — today's export **silently does nothing on web**. Car Guy must implement a web path (Blob download) — PROMPT-02.
- `lib/alert.ts` pattern for web/native divergence: reuse it; add the same pattern for date input, notifications and file storage (`*.web.tsx` files).

## 6. Gotchas and debt to keep in mind

- `expo-sqlite` present but unused (`docs/NEXT.md`). Car Guy *starts* using it — good; the plugin entry stays.
- `docs/NEXT.md` §1: the v1.1.0 APK still has the old default icon. Irrelevant once Car Guy ships with a new package (D1), but the *process* documented there (prebuild `--clean`, gradle `assembleRelease`, `gh release create`) is the one PROMPT-10 follows.
- `Alert.alert` from `react-native` must **not** be imported directly (web no-op). Use `@/lib/alert`.
- `+html.tsx` deliberately has no `<title>`; screen titles in `app/_layout.tsx` and `tools/finalize-web.mjs` `TITLE` constant carry the brand → PROMPT-01 changes all three.
- `vercel.json` `Permissions-Policy: camera=()` blocks camera on the web build → PROMPT-03 (vehicle photos) must relax it to `camera=(self)`.
- `public/sw.js` is a hand-written cache; its cache name must be bumped whenever the shell changes (PROMPT-01) and it must **not** cache-first the SQLite worker/wasm (PROMPT-02).
- Template leftovers (`components/Themed.tsx`, `StyledText.tsx`, `ExternalLink.tsx`, `useColorScheme*`, `useClientOnlyValue*`, `constants/Colors.ts`, `assets/fonts/SpaceMono-Regular.ttf`) — delete in PROMPT-01 if truly unreferenced (grep first).
- TypeScript 6.0 is newer than what most RN libraries type-test against; if a new dependency fails typecheck under TS 6, pin to the version `npx expo install` picks and report — do not downgrade TS silently.

## 7. Related work elsewhere

- `/home/xaviel/improvements/imps xaviel-web/september 2026/imp 11092026/` — the portfolio cycle. Phase 2 created **`x-core` schema `tucombustible`** (only a `schema_check` probe table), `public.site_admins`, `public.is_site_admin()`. Its Phase 5 (cloud sync for Tu Combustible) is **blocked** by Music Hub's `enforce_invite_only` trigger — Car Guy's PROMPT-08 resolves that blocker for both. Its `PROGRESS.md` lists the client module paths and verified facts about `x-core` (email confirmation OFF, `detectSessionInUrl: false`, `profiles` SELECT is `using (true)`).
- `/home/xaviel/improvements/imps music hub/imp mh 03092026/00-context.md` — Music Hub architecture on `x-core` (Angular + Supabase). Read before touching anything in `public` or `auth`.
