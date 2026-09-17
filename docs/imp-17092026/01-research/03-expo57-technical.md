# Research 3 — Expo SDK 57 technical report for Car Guy

*Research date: 2026-09-17. Scope: Expo SDK 57 (react-native 0.86.2, React 19.2.3, expo-router ~57,
New Architecture), Android via EAS/prebuild + static web export on Vercel (PWA with hand-written
`sw.js`). Versions verified against `expo/expo@sdk-57` `packages/expo/bundledNativeModules.json`
(what `npx expo install` picks) and the npm registry. Sources: versioned Expo docs, the `sdk-57`
branch of `expo/expo`, `expo/eas-cli` source, Drizzle source/docs, library READMEs. Web search was
blocked; everything is from direct reads. **The versioned docs win over this report if they differ.***

## SDK 57 version matrix (from `bundledNativeModules.json`, sdk-57 branch)

| Package | `npx expo install` resolves to | Expo Go? |
|---|---|---|
| `expo-sqlite` | `~57.0.3` | Yes (not SQLCipher) |
| `expo-notifications` | `~57.0.19` | Local: yes. Remote push: no on Android |
| `expo-image-picker` | `~57.0.18` | Yes |
| `expo-image-manipulator` | `~57.0.18` | Yes |
| `expo-file-system` | `~57.0.7` | Yes (no web) |
| `expo-document-picker` | `~57.0.2` | Yes |
| `expo-sharing` | `~57.0.20` | Yes |
| `expo-print` | `~57.0.2` | Yes |
| `expo-haptics` | `~57.0.3` | Yes |
| `expo-localization` | `~57.0.2` | Yes |
| `expo-calendar` | `~57.0.4` | **No** (dev build) |
| `expo-updates` | `~57.0.22` | **No** (dev/release build) |
| `expo-dev-client` | `~57.0.19` | n/a |
| `expo-background-task` / `expo-task-manager` | `~57.0.18` / `~57.0.18` | Yes |
| `expo-router` | `~57.0.21` | — |
| `react-native-svg` | `15.15.4` | Yes |
| `@shopify/react-native-skia` | `2.6.2` | Yes |
| `react-native-reanimated` / `react-native-worklets` | `4.5.1` / `0.10.1` | Yes |
| `react-native-gesture-handler` | `~2.32.0` | Yes |
| `@react-native-community/datetimepicker` | `9.1.0` | Yes |
| `@react-native-async-storage/async-storage` | `2.2.0` | Yes |
| `react-native-web` / `react-dom` | `~0.21.0` / `19.2.3` | — |
| `jest-expo` / `eslint-config-expo` | `~57.0.5` / `~57.0.2` | — |

---

## 1. Storage: move to `expo-sqlite` — yes, with one important web caveat

### Why leave the single JSON blob
Every write re-serialises everything; statistics need everything in memory; on **web AsyncStorage is `localStorage` (~5 MB quota)** — one base64 photo would blow it. Per-collection AsyncStorage keys only postpone the problem.

### SDK 57 `expo-sqlite` API to build on
- `openDatabaseAsync(name)`, `db.execAsync`, `db.runAsync`, `db.getFirstAsync`, `db.getAllAsync`, `db.getEachAsync`, prepared statements (`prepareAsync`), `Uint8Array` for BLOBs.
- `withTransactionAsync(fn)` — because of async/await, *any* query that runs while the transaction is active is included. `withExclusiveTransactionAsync` fixes that **but throws `'withExclusiveTransactionAsync is not supported on web'`** (`src/SQLiteDatabase.ts`, sdk-57). Use `withTransactionAsync` and serialise writes (a write queue).
- `SQLiteProvider` + `useSQLiteContext()` with `onInit` for migrations, optional `useSuspense`.
- `PRAGMA user_version` migrations pattern; `PRAGMA journal_mode = WAL` recommended.
- `addDatabaseChangeListener` (requires `enableChangeListener: true`) — works on web too.
- `expo-sqlite/kv-store` is a documented **drop-in for AsyncStorage** (same API + `getItemSync`/`setItemSync`); `expo-sqlite/localStorage/install` polyfills `globalThis.localStorage` on native.
- Config plugin options: `enableFTS` (default true), `useSQLCipher`, `useLibSQL`, `withSQLiteVecExtension`.

### Web support in SDK 57 — what it really is
Docs: *"Web support is in alpha and may be unstable."* Implementation (verified in `packages/expo-sqlite/web/*`):
- A **Metro-bundled Web Worker** running a **forked wa-sqlite** WASM build.
- Persistence via **OPFS `AccessHandlePoolVFS`**; `MemoryVFS` for `:memory:`. OPFS requires a **secure context** (HTTPS or localhost) — explicit error otherwise (PR #40605).
- **Async API** talks to the worker via `postMessage` — **no `SharedArrayBuffer` needed**.
- **Sync API** busy-waits on a `SharedArrayBuffer` — needs **cross-origin isolation (COOP/COEP)** and logs a perf warning.
- Web workers depend on Expo bundle splitting: **do not set `EXPO_NO_METRO_LAZY=1`**.

Required `metro.config.js` (from the SDK 57 docs diff):

```js
const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push('wasm');
// COEP/COOP for SharedArrayBuffer (dev server only)
config.server.enhanceMiddleware = (middleware) => (req, res, next) => {
  res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  middleware(req, res, next);
};
module.exports = config;
```

### Static export on Vercel
- `expo export -p web` emits the worker bundle and the `.wasm` asset into `dist/`; Vercel serves `.wasm` as `application/wasm`. The hand-written `sw.js` must **not** cache-first the worker/wasm URLs, and an offline fallback to `index.html` must not swallow worker requests.
- **Async API only ⇒ no COOP/COEP needed on Vercel.** OPFS needs HTTPS only.
- If the sync API (or Drizzle) is used: `vercel.json` headers `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Embedder-Policy: credentialless` — but `credentialless` is Chromium/Firefox; Safari needs `require-corp`, which breaks Google Fonts and remote images lacking CORP headers. Safari's OPFS sync access handles arrived in Safari 17, and Safari can evict storage after ~7 days without interaction unless the PWA is installed — so **an export/backup feature is mandatory for web users**.

### Alternatives compared
| Option | Android | Web static | Expo Go | Verdict |
|---|---|---|---|---|
| AsyncStorage per-collection | ok | 5 MB localStorage | yes | Dead end for photos/stats |
| `react-native-mmkv` 4.3.2 | fast KV | localStorage shim | **no** | KV only |
| `@op-engineering/op-sqlite` 18.2.3 | fastest | via `@sqlite.org/sqlite-wasm` peer | **no** | Extra native setup |
| `@nozbe/watermelondb` 0.28.0 | yes | LokiJS/IndexedDB | no | Heavy, sync-oriented |
| Drizzle + expo-sqlite | yes | **sync driver only** | yes | Forces SAB on web |
| **expo-sqlite raw + thin repo layer** | yes | async, no headers | yes | **Recommended** |

**Drizzle detail:** the expo driver is `SQLiteSyncDialect` calling `prepareSync`/`executeSync` exclusively; migrations need `drizzle-kit generate` + `babel-plugin-inline-import`. On web every query goes through the SharedArrayBuffer busy loop → COOP/COEP mandatory. `drizzle-orm/sqlite-core` can still be used purely as a type-safe SQL builder (`.toSQL()`) if wanted.

### Recommendation
`expo-sqlite ~57.0.3`, **async API only**, `SQLiteProvider` + `PRAGMA user_version` migrations as plain SQL strings, a typed repository per aggregate, `expo-sqlite/kv-store` for KV settings. Replace the Context store persistence with hooks that re-query on `addDatabaseChangeListener`.

```ts
// db/index.ts (shape)
import { SQLiteProvider, type SQLiteDatabase } from 'expo-sqlite';
const DATABASE_VERSION = 1;
export async function migrateDbIfNeeded(db: SQLiteDatabase) {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let v = row?.user_version ?? 0;
  if (v >= DATABASE_VERSION) return;
  if (v === 0) {
    await db.execAsync(`PRAGMA journal_mode = 'wal'; PRAGMA foreign_keys = ON; /* CREATE TABLE … */`);
    v = 1;
  }
  await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
}
// app/_layout.tsx
// <Suspense fallback={<Splash/>}><SQLiteProvider databaseName="carguy.db" onInit={migrateDbIfNeeded}
//   options={{ enableChangeListener: true }} useSuspense>…</SQLiteProvider></Suspense>
```

Prepared statements for bulk import:
```ts
await db.withTransactionAsync(async () => {
  const stmt = await db.prepareAsync('INSERT INTO fuel_log (…) VALUES ($id, …)');
  try { for (const e of rows) await stmt.executeAsync({ $id: e.id /* … */ }); }
  finally { await stmt.finalizeAsync(); }
});
```

---

## 2. Local notifications for maintenance reminders

**Platform support:** SDK 57 docs list `platforms: ['android', 'ios']` — **no web**; scheduling APIs on web throw `UnavailabilityError`.

**Expo Go:** remote push unavailable in Expo Go on Android since SDK 53, but *"Local notifications remain available in Expo Go."* A dev build is only needed for custom icon/color/sounds (config plugin) and push.

**Triggers (`SchedulableTriggerInputTypes`):** `TIME_INTERVAL`, `DATE`, `DAILY`, `WEEKLY`, `MONTHLY`, `YEARLY`, `CALENDAR` (iOS-only date-match).

```ts
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldPlaySound: false, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true }),
});

export async function ensureNotificationSetup() {
  if (Platform.OS === 'web') return false;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('mantenimiento', { name: 'Mantenimiento', importance: Notifications.AndroidImportance.DEFAULT });
  }
  const { status } = await Notifications.getPermissionsAsync();
  const final = status === 'granted' ? status : (await Notifications.requestPermissionsAsync()).status;
  return final === 'granted';
}

export async function scheduleReminder(r: { id: string; title: string; dueAt: Date }) {
  return Notifications.scheduleNotificationAsync({
    identifier: `reminder:${r.id}`,
    content: { title: r.title, body: 'Vence hoy', data: { reminderId: r.id } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: r.dueAt, channelId: 'mantenimiento' },
  });
}
// Weekly: trigger: { type: SchedulableTriggerInputTypes.WEEKLY, weekday: 1 /* Sunday */, hour: 9, minute: 0 }
```

Also `cancelScheduledNotificationAsync(id)`, `cancelAllScheduledNotificationsAsync()`, `getAllScheduledNotificationsAsync()`. On Android 13+ the permission prompt appears only after a channel exists.

**Exact alarms:** to fire at an *exact* time you must add `SCHEDULE_EXACT_ALARM`; verified in `ExpoSchedulingDelegate.kt` (sdk-57): if `canScheduleExactAlarms()` is false the library falls back to `setAndAllowWhileIdle` (inexact, minutes of drift). Android 14+ denies `SCHEDULE_EXACT_ALARM` by default; `USE_EXACT_ALARM` is Play-restricted to alarm/calendar apps. **Do not request exact alarms.**

**Limits:** iOS ≤ 64 pending local notifications; Android AlarmManager refuses beyond ~500. Keep truth in SQLite and schedule only the next N (e.g. 30), re-syncing on start/foreground and on changes. The library re-registers alarms after reboot and package replace.

**Web fallback:** compute due/overdue from SQLite on launch and show in-app banners (also on Android — the notification is a convenience). Browser-scheduled notifications (`showTrigger`) never shipped.

**`expo-background-task`** (`~57.0.18`, needs `expo-task-manager`): WorkManager/BGTaskScheduler, ≥ 15-minute interval as a lower bound, runs "at some point"; `Restricted` on web. **Not worth it**: `DATE`/`DAILY` triggers fire without the app; recompute on foreground.

---

## 3. Photos and documents

**`expo-image-picker ~57.0.18`** — platforms `android, ios, web`. `launchCameraAsync` / `launchImageLibraryAsync` with `mediaTypes: ['images']`, `quality`, `allowsEditing`, `allowsMultipleSelection`, `base64`, `exif`; result `{ canceled, assets: [{ uri, width, height, fileName, mimeType, fileSize }] }`. On web it injects a hidden `<input type="file" accept=… capture=…>` — **must be called from a user gesture**; `uri` is a **`blob:` URL**.

**`expo-image-manipulator ~57.0.18`** — web supported. Chainable API:
```ts
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
const img = await ImageManipulator.manipulate(asset.uri).resize({ width: 1600 }).renderAsync();
const out = await img.saveAsync({ compress: 0.75, format: SaveFormat.JPEG }); // { uri, width, height }
```

**`expo-file-system ~57.0.7`** — `android, ios, tvos`; the web build is a stub that warns `'expo-file-system is not supported on web'` for `File`, `Directory`, `Paths`. Guard with `Platform.OS !== 'web'`.

**Where to store:**
- **Android:** compressed JPEGs in `new Directory(Paths.document, 'media', vehicleId)`; store only the relative path (container path can change between installs).
- **Web:** bytes as `BLOB` (`Uint8Array`) in SQLite (OPFS), ≤ ~300 KB after compression; render with `URL.createObjectURL(new Blob([bytes]))` and revoke on unmount. Avoid base64 in JSON/localStorage.

```ts
export async function pickAndStorePhoto(vehicleId: string, useCamera: boolean) {
  const launch = useCamera ? ImagePicker.launchCameraAsync : ImagePicker.launchImageLibraryAsync;
  if (useCamera && Platform.OS !== 'web') {
    const { granted } = await ImagePicker.requestCameraPermissionsAsync(); if (!granted) return null;
  }
  const res = await launch({ mediaTypes: ['images'], quality: 0.9 }); if (res.canceled) return null;
  const rendered = await ImageManipulator.manipulate(res.assets[0].uri).resize({ width: 1600 }).renderAsync();
  const out = await rendered.saveAsync({ compress: 0.75, format: SaveFormat.JPEG });
  const id = crypto.randomUUID();
  if (Platform.OS === 'web') {
    const bytes = new Uint8Array(await (await fetch(out.uri)).arrayBuffer()); URL.revokeObjectURL(out.uri);
    return { id, storage: 'blob' as const, bytes, mime: 'image/jpeg' };
  }
  const dir = new Directory(Paths.document, 'media', vehicleId); if (!dir.exists) dir.create({ intermediates: true });
  const dest = new File(dir, `${id}.jpg`); new File(out.uri).move(dest);
  return { id, storage: 'file' as const, relPath: `media/${vehicleId}/${id}.jpg`, mime: 'image/jpeg' };
}
```

**`expo-document-picker ~57.0.2`** (PDFs): `getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true })` → `assets[{ uri, name, size, mimeType, file?, base64? }]`; on web `file` is a browser `File` and `base64` defaults to true (set `base64: false` for large PDFs). Same user-gesture requirement on web.

---

## 4. Charts on Android + react-native-web static export

| Library | Renderer | Web (static export) | SDK 57 fit |
|---|---|---|---|
| `react-native-gifted-charts` 1.4.78 | `react-native-svg` + `expo-linear-gradient` | Works through react-native-svg web build | Peer `react-native-svg: *` → bundled 15.15.4 |
| `victory-native` 42.0.1 | Skia + Reanimated + Gesture Handler | Needs CanvasKit (2.9 MB gz wasm), `LoadSkiaWeb`; expo-router dev constraint | Peers `skia >=2.6 <3`, `reanimated >=3.19.1` |
| `react-native-chart-kit` 7.0.4 | `react-native-svg` | Works in practice; no official web statement | Peer svg `>=15.12.1 <16` |
| `@shopify/react-native-skia` custom | CanvasKit | Same wasm caveats | Overkill |
| Custom `react-native-svg` + `d3-shape` | SVG | Deterministic on both | Most control, more code |

**Recommendation:** `react-native-gifted-charts` on the bundled `react-native-svg 15.15.4` (`npx expo install react-native-gifted-charts expo-linear-gradient react-native-svg`). Keep data shaping in pure TS. Skip Skia/victory-native for a PWA.

---

## 5. Date/time input

- `@react-native-community/datetimepicker` **9.1.0** is the SDK 57 bundled version; scope iOS/Android/Windows — **no web**.
- `react-native-paper-dates` 0.23.16 works on web but requires `react-native-paper`.

**Recommendation:** a `DateField` component: Android → `DateTimePicker` (`mode="date"`); web → `<input type="date">` via `DateField.web.tsx`. Store `YYYY-MM-DD` at the edge.

---

## 6. Other SDK 57 modules

| Module | Web | Expo Go | Use |
|---|---|---|---|
| `expo-haptics ~57.0.3` | listed | yes | Light impact on save/complete |
| `expo-sharing ~57.0.20` | yes | yes | Share PDF/CSV/backups |
| `expo-print ~57.0.2` | limited: `printAsync` prints the page; **`printToFileAsync` opens the print dialog instead of returning a file on web**; native HTML can't load local asset URLs (use base64) | yes | Vehicle report PDF on Android; `window.print()` on web |
| `expo-localization ~57.0.2` | yes | yes | Locale/currency formatting |
| `expo-calendar ~57.0.4` | **no** | **no** — dev build | Optional "add to calendar" |
| `expo-updates ~57.0.22` / EAS Update | n/a | **no** | OTA JS updates; `runtimeVersion` fingerprint policy |
| `expo-dev-client ~57.0.19` | n/a | — | Needed once native-only libs are added |

---

## 7. Rebranding "Tu Combustible RD" → "Car Guy"

| Field | Change? | Consequence |
|---|---|---|
| `name` | Yes → `"Car Guy"` | Home-screen label; synced to native on `prebuild` |
| `slug` | Careful | EAS CLI (`getProjectIdAsync.ts`) **throws** if `slug` ≠ the slug of the project in `extra.eas.projectId`. Rename the project in the Expo dashboard first, or run `eas init` to relink |
| `scheme` | Yes → `"carguy"` | Old `tucombustiblerd://` links die |
| `android.package` | **Decision** | Changing it = **a brand-new app**: existing installs are not updated, users keep the old app and its data. *(Xaviel chose the new package `com.xaviel.carguy` — data via backup import.)* |
| Icons / splash | Yes | `expo-splash-screen` plugin object (`image`, `imageWidth`, `backgroundColor`, `dark`); icons 1024×1024 + adaptive `foregroundImage/backgroundColor/monochromeImage`; native assets regenerate only on `npx expo prebuild --clean` + a new build |
| Web | Yes | `web.name`/`shortName`/`themeColor` in app.json feed the HTML; Expo does **not** generate a PWA manifest — edit `public/manifest.webmanifest`, `+html.tsx`, and bump the `sw.js` cache name |
| Typed routes | No action | Regenerate on `npx expo start` |
| Storage key | Keep reading `tu-combustible-rd/v1` for the importer | New DB `carguy.db` |

---

## 8. Testing and linting

- **Official:** `npx expo install jest-expo jest @types/jest --dev` → `jest-expo ~57.0.5`, `"jest": { "preset": "jest-expo" }`, `"types": ["jest"]` in tsconfig; `@testing-library/react-native` 14.0.1 for component tests. jest-expo runs pure-TS domain tests too — **one runner is enough**.
- **Vitest 5.0.1** is a valid *additional* runner for pure domain modules (zero RN imports) if Jest start-up bothers you.
- **Lint:** `npx expo lint` installs `eslint-config-expo ~57.0.2` and writes a flat `eslint.config.js`.

---

## Consolidated recommendation (adopted in the ADRs)

1. **Storage:** `expo-sqlite ~57.0.3`, async API only, `SQLiteProvider` + `PRAGMA user_version` migrations, one-shot import from the legacy blob/backup, `kv-store` for KV. Add `wasm` to Metro `assetExts`; no COOP/COEP on Vercel. Ship backup export/import before relying on OPFS on Safari.
2. **Reminders:** `expo-notifications ~57.0.19` `DATE`/`WEEKLY`/`DAILY` triggers, channel, no exact alarms, ≤ 30 scheduled, truth in SQLite, in-app banners everywhere. No background tasks.
3. **Media:** picker → manipulator (1600 px, q 0.75) → `Paths.document/media/...` on Android, BLOB on web; PDFs via document picker.
4. **Charts:** `react-native-gifted-charts` + bundled `react-native-svg`.
5. **Dates:** `@react-native-community/datetimepicker 9.1.0` on Android, `<input type="date">` on web.
6. **Rebrand:** rename `name`/`slug`/`scheme`/icons/splash/manifest; new `android.package`; `prebuild --clean`.
7. **Tests:** `jest-expo ~57.0.5`, `expo lint`.

## Sources

- expo-sqlite SDK 57 docs: https://docs.expo.dev/versions/v57.0.0/sdk/sqlite/ ; Metro diff: https://raw.githubusercontent.com/expo/expo/sdk-57/docs/public/static/diffs/sqlite-web-metro-config.diff ; web sources under https://github.com/expo/expo/tree/sdk-57/packages/expo-sqlite (`web/worker.ts`, `web/WorkerChannel.ts`, `web/wa-sqlite/AccessHandlePoolVFS.js`, `src/SQLiteDatabase.ts`); PRs #35207, #40605
- Expo Metro web workers: https://docs.expo.dev/versions/v57.0.0/config/metro/#web-workers
- bundledNativeModules (sdk-57): https://raw.githubusercontent.com/expo/expo/sdk-57/packages/expo/bundledNativeModules.json
- Drizzle expo-sqlite: https://orm.drizzle.team/docs/connect-expo-sqlite ; https://github.com/drizzle-team/drizzle-orm/tree/main/drizzle-orm/src/expo-sqlite
- expo-notifications: https://docs.expo.dev/versions/v57.0.0/sdk/notifications/ ; `ExpoSchedulingDelegate.kt` and `AndroidManifest.xml` under packages/expo-notifications (sdk-57)
- expo-background-task: https://docs.expo.dev/versions/v57.0.0/sdk/background-task/
- expo-image-picker: https://docs.expo.dev/versions/v57.0.0/sdk/imagepicker/ ; `ExponentImagePicker.web.ts`
- expo-image-manipulator: https://docs.expo.dev/versions/v57.0.0/sdk/imagemanipulator/
- expo-file-system: https://docs.expo.dev/versions/v57.0.0/sdk/filesystem/ ; `ExpoFileSystem.web.ts`
- expo-document-picker: https://docs.expo.dev/versions/v57.0.0/sdk/document-picker/
- expo-print / calendar / updates / splash-screen: https://docs.expo.dev/versions/v57.0.0/sdk/{print,calendar,updates,splash-screen}/
- App config: https://docs.expo.dev/versions/v57.0.0/config/app/ ; EAS slug validation: eas-cli `getProjectIdAsync.ts`; app versions: https://docs.expo.dev/build-reference/app-versions/
- Prebuild: https://docs.expo.dev/workflow/prebuild/ ; static rendering: https://docs.expo.dev/router/reference/static-rendering/ ; PWA: https://docs.expo.dev/guides/progressive-web-apps/ ; typed routes: https://docs.expo.dev/router/reference/typed-routes/
- Unit testing: https://docs.expo.dev/develop/unit-testing/ ; ESLint: https://docs.expo.dev/guides/using-eslint/
- Charts: https://github.com/Abhinandan-Kushwaha/react-native-gifted-charts ; https://github.com/FormidableLabs/victory-native-xl ; https://github.com/chart-kit/react-native-chart-kit ; https://shopify.github.io/react-native-skia/docs/getting-started/web/
- Date pickers: https://github.com/react-native-datetimepicker/datetimepicker ; https://github.com/web-ridge/react-native-paper-dates
- Alternatives: https://github.com/mrousavy/react-native-mmkv ; https://github.com/OP-Engineering/op-sqlite
