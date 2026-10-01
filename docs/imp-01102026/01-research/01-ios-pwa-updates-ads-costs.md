# Car Guy — iOS PWA limits, stale GPS, self-updates, ads and running costs

Research date: 2026-10-01. Target: Expo SDK 57, Android APK sideloaded from GitHub Releases, static web export on Vercel used as a Home-Screen PWA on iOS, Supabase free project shared with another app.

**Verification legend.** "Verified" = read from the official page today (see Sources). "Unverified (from knowledge)" = the fetch was not approved/failed or the page didn't cover it; treat as best knowledge, confirm before relying on it. Several fetches (MDN, PayPal, Stripe, Ko-fi, Buy Me a Coffee, the react-native-google-mobile-ads docs) returned "permission request not answered" and are marked accordingly.

---

## 1. iOS PWA limits that matter for Car Guy

### 1.1 Location: foreground only, full stop

- **No background location on web.** Expo's own Location docs say background tracking (`startLocationUpdatesAsync` / `stopLocationUpdatesAsync`) is native-only; there is no web equivalent (verified, expo-location docs). On iOS there is also no Background Sync / Periodic Background Sync / background fetch for web apps (unverified (from knowledge) — WebKit has never shipped them).
- **`watchPosition` and screen lock** (unverified (from knowledge)): when the PWA goes to the background or the screen locks, iOS suspends the WebKit content process within seconds. The `watchPosition` callback stops firing; nothing is queued. When the user comes back, the watch normally resumes, but the first callback is often a **cached/coarse fix** (see §2). Expect gaps in any "trip" recorded from the iPhone PWA. A Wake Lock (`navigator.wakeLock.request('screen')`, available in Safari 16.4+, and working in Home-Screen apps since iOS 18.4 — unverified) only keeps the screen on; it does not give background execution.
- **Consequence for the product:** the iPhone PWA can show the map and the current position, and log fuel/maintenance, but must **not offer automatic trip tracking**. Show it as "Disponible solo en Android" rather than letting a half-working tracker produce broken trips.

### 1.2 Web Push

Verified (WebKit blog): Web Push exists for **Home-Screen web apps since iOS/iPadOS 16.4**; the app must be added to the Home Screen, the manifest `display` must be `standalone` or `fullscreen`, and the permission prompt must come "in response to direct user interaction — such as tapping on a 'subscribe' button". The Badging API (`navigator.setAppBadge` / `clearAppBadge`) also arrived in 16.4 for Home-Screen apps. In a normal Safari tab, push is not available on iOS. Useful for maintenance reminders ("cambio de aceite en 300 km") if a server-side sender (Supabase Edge Function + VAPID) is added later; not needed now.

### 1.3 Storage: quota, eviction, persistence, OPFS

- **Quota (verified, WebKit "Updates to Storage Policy", Safari 17 / iOS 17):** a browser-app origin can use up to ~60 % of total disk; overall up to 80 %. A Home-Screen web app "has the same origin quota and overall quota as when it is opened in a browser app". Note: a Home-Screen app has **its own storage container separate from Safari's** (unverified (from knowledge), long-standing behaviour) — data entered in a Safari tab is not visible in the PWA and vice-versa, apart from the shared OPFS-lock issue described below which happens only when both share a container (e.g. on desktop, or Safari tab vs. Safari tab).
- **7-day eviction (verified, WebKit 2020 ITP post):** Safari deletes "all of a website's script-writable storage after seven days of Safari use without user interaction on the site". But "Web applications added to the home screen are not part of Safari and thus have their own counter of days of use" — so a Home-Screen app that the user actually opens is not expected to lose first-party data. It *can* still be lost if the owner does not open the PWA for 7 days of use of that app (the counter counts days of use, not calendar days), or under storage pressure.
- **`navigator.storage.persist()` (verified):** supported since Safari 17; "WebKit currently grants a request based on heuristics like whether the website is opened as a Home Screen Web App." → Call it once at startup in standalone mode and store the result; show it in Settings ("Almacenamiento: persistente / puede borrarse").
- **OPFS / IndexedDB** (unverified (from knowledge)): IndexedDB works in standalone mode. OPFS (`navigator.storage.getDirectory()`) exists since Safari 15.2, and `createSyncAccessHandle()` in workers since Safari 15.4/16.x — this is what expo-sqlite's web (wa-sqlite) backend uses. It also needs cross-origin isolation (`Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Embedder-Policy: require-corp` or `credentialless`) for SharedArrayBuffer; keep those headers in `vercel.json`. Sync access handles are **exclusive**: a second tab/window of the same origin trying to open the DB gets `NoModificationAllowedError` — the "two tabs" lock the app already handles.
- **Backup is still mandatory.** Whatever the persistence result, iOS can clear website data (Settings → Safari → Clear History and Website Data, or deleting the Home-Screen icon wipes that container). Supabase sync is the real source of truth; local SQLite is a cache.

### 1.4 Service-worker updates and the "black screen once after a deploy"

Typical cause chain (unverified (from knowledge), but this is the standard failure mode of SPA + SW):

1. SW `carguy-v7` precached `index.html` which references `/_expo/static/js/web/entry-abc123.js`.
2. You deploy; Vercel now serves `entry-def456.js` and **the old hashed file no longer exists** (static export deletes it).
3. The PWA opens; the old SW is still controlling the page and serves the cached old `index.html` (cache-first). The JS for `abc123` is either not in cache (only lazily cached, or an async chunk) → 404 → React never mounts → black/blank screen.
4. Meanwhile the browser fetched the new `sw.js`, installed `carguy-v8`, which activates on the next launch → second launch works. That is exactly "black once, fine after".

Secondary causes: the OPFS lock (a Safari tab of the same origin holding the DB) and an uncaught error during DB open. Both should render a visible error screen instead of nothing.

**Recommended SW strategy**

- **Navigation requests (`index.html`, any route): network-first** with a short timeout (≈3 s), fallback to cache. Never cache-first the HTML.
- **Hashed assets (`/_expo/static/**`, fonts, images with hash): cache-first**, precached at install from a manifest generated at build time (list every file in `dist/_expo/static`), so the HTML and *all* its chunks are cached atomically for that version.
- **Version the cache name from the build** (`carguy-${BUILD_ID}`), delete all other `carguy-*` caches in `activate`.
- `self.skipWaiting()` in `install` + `clients.claim()` in `activate` makes the new SW take over immediately; combine with a client-side `controllerchange` listener that reloads **once** (guard with a flag) so the page and SW versions match. Alternative (gentler): don't `skipWaiting` automatically; show "Nueva versión disponible · Recargar" and post `{type:'SKIP_WAITING'}` on tap.
- Serve `sw.js` with `Cache-Control: no-cache` (Vercel header) so update checks see the new file.
- Keep old hashed files for one deploy if possible (not trivial on Vercel static export; the network-first HTML makes it unnecessary).

```js
// public/sw.js  (BUILD_ID and PRECACHE injected at build time)
const CACHE = `carguy-${self.BUILD_ID}`;
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(self.PRECACHE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('carguy-') && k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 3000);
        const res = await fetch(req, { signal: ctrl.signal, cache: 'no-store' }); clearTimeout(t);
        (await caches.open(CACHE)).put('/index.html', res.clone());
        return res;
      } catch { return (await caches.match('/index.html')) || Response.error(); }
    })());
    return;
  }
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
    if (res.ok && req.url.includes('/_expo/static/')) caches.open(CACHE).then((c) => c.put(req, res.clone()));
    return res;
  })));
});
```

```ts
// client: reload once when a new SW takes control
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js');
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!reloaded) { reloaded = true; location.reload(); }
  });
}
```

Plus a **boot watchdog**: in `index.html`, a tiny inline script that, if the root hasn't rendered in 8 s, shows "No se pudo cargar · Reintentar" (button: unregister SW, clear `carguy-*` caches, reload). That converts the black screen into a recoverable state.

### 1.5 Detecting standalone iOS and a capability banner

```ts
export const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const isStandalone =
  window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;
```

- iOS Safari tab (not standalone): banner "Instala Car Guy: Compartir → Añadir a pantalla de inicio" (needed for push and better storage persistence).
- iOS standalone: one-time, dismissible "Car Guy en iPhone" card: ✔ registros, mapa, estadísticas, sincronización · ✖ viajes automáticos en segundo plano (solo Android) · GPS solo con la app abierta y la pantalla encendida · notificaciones requieren iOS 16.4+.

---

## 2. Stale / wrong location on web (the "far away" dot)

What happened, most likely (unverified (from knowledge); MDN fetch not approved): iOS returns a **cached position** when `maximumAge` allows it, and the first fix after waking is commonly a coarse Wi-Fi/cell or last-known fix — possibly hours old, from where the phone was earlier. If the code draws the first callback blindly, the dot appears where he was in the morning.

Semantics (standard Geolocation API): `maximumAge` = max age in ms of a cached position the browser may return (0 = must be fresh); `timeout` = max wait for a fix; `enableHighAccuracy` = request GPS-grade fix (slower, more battery). `GeolocationPosition.timestamp` is the time the fix was acquired; `coords.accuracy` is the 95 % radius in metres.

**Handling rule (web and native):**

```ts
const MAX_AGE_MS = 15_000, GOOD_ACC_M = 50, OK_ACC_M = 150;
type Fix = { lat: number; lng: number; acc: number; ts: number };
function classify(p: GeolocationPosition): 'drop' | 'coarse' | 'good' {
  if (Date.now() - p.timestamp > MAX_AGE_MS) return 'drop';           // stale cache
  if (p.coords.accuracy > OK_ACC_M) return 'coarse';
  return p.coords.accuracy <= GOOD_ACC_M ? 'good' : 'coarse';
}
const id = navigator.geolocation.watchPosition(
  (p) => {
    const k = classify(p);
    if (k === 'drop') return;
    if (k === 'coarse') setGpsState({ status: 'buscando', approx: p });  // grey halo, no solid dot, no recenter
    else setGpsState({ status: 'ok', fix: p });                          // solid blue dot, recenter once
  },
  (err) => setGpsState({ status: err.code === 1 ? 'denegado' : 'error' }),
  { enableHighAccuracy: true, maximumAge: 0, timeout: 20_000 },
);
```

- UI states: "Buscando GPS…" (spinner chip) until a `good` fix; "Ubicación aproximada (±420 m)" for coarse; never recenter the map on a coarse or dropped fix.
- Re-arm on `visibilitychange` → `visible`: clear the watch, set state to "buscando", start again (the resume fix is the suspicious one).
- Also discard **jumps**: if the new fix implies > 70 m/s from the previous good fix, ignore it unless two consecutive fixes agree.
- Device clock skew can make `timestamp` look old or in the future; treat `Math.abs(now - ts) > 15 s` as stale, and if *every* fix is "stale" for 30 s, fall back to accepting by accuracy only.

**Android (expo-location)** (verified, expo-location docs): `getLastKnownPositionAsync({ maxAge, requiredAccuracy })` returns the last known position or `null`; docs warn it may be stale and shouldn't replace a current position when accuracy matters. `getCurrentPositionAsync({ accuracy })` requests a fresh one-time fix (slower). `LocationObject.timestamp` is ms since epoch; `coords.accuracy` metres. Pattern: show `getLastKnownPositionAsync({ maxAge: 60_000, requiredAccuracy: 100 })` as a grey "approx" marker instantly, then `watchPositionAsync({ accuracy: Location.Accuracy.High, distanceInterval: 5 })` and apply the same `classify()` filter. For background trips, apply the filter in the task handler too (drop points with `accuracy > 50` or older than 15 s) so the first point of a trip isn't a stale one.

---

## 3. Self-updating app

### 3a. EAS Update (JS/asset OTA)

**What it can update (verified, EAS Update intro):** "non-native pieces (such as JS, styling, and images)". It cannot change native code or native dependencies, permissions, the Expo SDK version, or "anything requiring a new binary". "EAS Update uses runtime version policies to ensure updates are only sent to builds with compatible native code."

**Setup**

```bash
npx expo install expo-updates
eas update:configure      # writes updates.url, runtimeVersion, extra.eas.projectId (verified)
```

`eas.json` (verified pattern):

```json
{ "build": {
    "preview":    { "channel": "preview",    "android": { "buildType": "apk" } },
    "production": { "channel": "production", "android": { "buildType": "apk" } } } }
```

`app.config`:

```json
{ "expo": {
  "runtimeVersion": { "policy": "fingerprint" },
  "updates": { "url": "https://u.expo.dev/<projectId>", "checkAutomatically": "ON_LOAD", "fallbackToCacheTimeout": 0 } } }
```

- **Local builds and the channel:** the Local Builds doc doesn't address it (verified absence). From knowledge (unverified): `eas build --local --profile production` runs the same build steps on your machine, including writing the profile's `channel` into the native config as the `expo-channel-name` request header, so the APK asks for `production` updates. **Verify once** by rendering `Updates.channel` and `Updates.runtimeVersion` in the About screen of a local build. If it shows `null`, set `updates.requestHeaders: { "expo-channel-name": "production" }` explicitly in `app.config` (that's what `eas update:configure` does for CNG projects — verified).
- **Runtime version policy** (verified): `appVersion` (uses `version`, e.g. "2.5.0"), `nativeVersion` (version + build number), `fingerprint` ("automatically calculates the runtime version for you, including through changes like SDK upgrades"). Expo's guidance: fingerprint "will increment the runtime version whenever anything that may impact the native runtime changes" at the cost of more builds; appVersion requires you to remember bumping `version` on every native change.
  - **Pick `fingerprint`.** Native modules change often in this project, and `nativeVersion` is a bad fit because `versionCode` auto-increments (every APK would get a unique runtime → no OTA ever reaches it). `appVersion` is fine only if you're disciplined. The fingerprint risk: local builds computing a different hash than `eas update` (different `node_modules`, OS, patch-package state). Mitigate with a clean `npm ci` before both, and compare `Updates.runtimeVersion` of the installed APK with the fingerprint shown by `eas update` output.
- **Check-on-launch** (verified): `checkAutomatically`: `ON_LOAD` (default), `WIFI_ONLY`, `ON_ERROR_RECOVERY`, `NEVER`. Default flow "does not block loading the app … the end user will only load the update when they cold boot the app after an update has been published". `fallbackToCacheTimeout` (ms to wait for a new update before launching the cached one; default 0 — default value unverified) — keep 0 so a slow network never delays startup, and use the in-app prompt below.
- **Publish:** `eas update --channel production --message "Arregla GPS viejo en mapa"` (verified syntax; `--environment production` optional).
- **Free tier (verified, expo.dev/pricing):** Free = **1,000 updates MAU, 100 GiB global edge bandwidth, 20 GiB storage**, and up to 15 Android + 15 iOS cloud builds (local builds don't consume these). Starter $19/mo = 3,000 MAU; overage $0.10/GiB bandwidth, $0.05/GiB storage. With 30 users × ~10 updates/month × ~5 MB (bundle + changed assets; only changed assets are downloaded) ≈ 1.5 GB/month — about 1.5 % of the free bandwidth.

**"Hay una actualización, reiniciar" UX**

```tsx
import * as Updates from 'expo-updates';
import { useEffect } from 'react';
import { AppState } from 'react-native';

export function useOtaCheck() {
  const { isUpdateAvailable, isUpdatePending, isDownloading } = Updates.useUpdates();
  useEffect(() => {
    if (__DEV__ || !Updates.isEnabled) return;
    const check = async () => {
      try {
        const r = await Updates.checkForUpdateAsync();
        if (r.isAvailable) await Updates.fetchUpdateAsync();   // download in background
      } catch (e) { /* offline: ignore */ }
    };
    check();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && check());
    return () => sub.remove();
  }, []);
  return { isUpdateAvailable, isUpdatePending, isDownloading, restart: () => Updates.reloadAsync() };
}
// UI: if isUpdatePending → banner "Hay una actualización lista · Reiniciar" → restart()
// Never auto-reload during an active trip (check the trip store first).
```

**Requires a new APK, not an OTA:** adding/removing/upgrading any package with native code (expo-*, react-native-*), changing `android.permissions`, any config-plugin option (`expo-location` plugin strings, `expo-build-properties`), app icon/splash/adaptive icon (native resources), `scheme`, package name, Expo SDK upgrade, new `.so`/Gradle changes. With the fingerprint policy those changes alter the runtime version automatically, so an OTA built after them simply won't be delivered to old APKs — which is why the APK prompt (3b) is still needed.

### 3b. In-app APK update prompt (outside Play)

Flow: on launch (Android, not DEV), `GET /api/apk` → `{ version: "2.5.0", versionCode: 142, sizeBytes, url, sha256?, notes }`. Compare with `Application.nativeBuildVersion` (versionCode as string on Android) — compare **versionCode**, not the semver string. If newer: card "Nueva versión 2.5.0 (142 MB) · Descargar e instalar".

**Download (verified, expo-file-system SDK 57 docs):** new API `File.downloadFileAsync(url, destination)` (no progress), or `File.createDownloadTask(url, destination, { onProgress })` with `bytesWritten`/`totalBytes` and `pauseAsync()`/`resumeAsync()`. `File.contentUri` gives "a content URI to the file that can be shared to external applications" (Android). The legacy `getContentUriAsync()` and `createDownloadResumable()` still exist under `expo-file-system/legacy` (deprecated). So yes: in SDK 57 use `file.contentUri`; `getContentUriAsync` only via `/legacy`.

**Install (expo-intent-launcher, verified API):** `startActivityAsync(action, { data, flags, type, extra, ... })`. The docs page doesn't list `ActivityAction.VIEW`/`INSTALL_PACKAGE` in the content I could read, so pass the raw action string. `ACTION_INSTALL_PACKAGE` is deprecated since API 29 (unverified (from knowledge)); `ACTION_VIEW` with the APK MIME type is the standard path.

```ts
import { File, Paths } from 'expo-file-system';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Application from 'expo-application';

const FLAG_GRANT_READ_URI_PERMISSION = 0x00000001;
const FLAG_ACTIVITY_NEW_TASK = 0x10000000;

export async function checkApk() {
  const r = await fetch('https://carguy.vercel.app/api/apk', { cache: 'no-store' });
  const latest = await r.json();
  const installed = Number(Application.nativeBuildVersion ?? 0);
  return latest.versionCode > installed ? latest : null;
}

export async function downloadAndInstall(latest: { url: string; versionCode: number },
                                         onProgress: (p: number) => void) {
  const dest = new File(Paths.cache, `carguy-${latest.versionCode}.apk`);
  if (dest.exists) dest.delete();
  const task = File.createDownloadTask(latest.url, dest, {
    onProgress: ({ bytesWritten, totalBytes }) => totalBytes && onProgress(bytesWritten / totalBytes),
  });
  const file = await task.downloadAsync();          // method name per DownloadTask docs; verify in typings
  await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
    data: file.contentUri,
    type: 'application/vnd.android.package-archive',
    flags: FLAG_GRANT_READ_URI_PERMISSION | FLAG_ACTIVITY_NEW_TASK,
  });
}
```

Notes (unverified (from knowledge) unless stated):

- GitHub Release asset URLs redirect to `objects.githubusercontent.com`; the native downloader follows redirects. Have `/api/apk` return the direct `browser_download_url`. Verify the downloaded size (and a SHA-256 if you publish one) before launching the installer.
- **Permission:** add `"android": { "permissions": ["android.permission.REQUEST_INSTALL_PACKAGES"] }`. Since Android 8 (API 26) the user must also enable **"Instalar apps desconocidas" for Car Guy** (per-app). The first time, the system installer shows a dialog with a "Configuración" shortcut; after enabling and pressing back the install proceeds (on some OEMs the user must re-tap "Instalar"). Optional: pre-open `android.settings.MANAGE_UNKNOWN_APP_SOURCES` with `data: 'package:' + Application.applicationId` and explain it with a pre-dialog.
- **Same signature:** the update must be signed with the **same keystore** as the installed APK, or Android shows "App not installed / package conflicts". Since builds are local, back up the keystore (credentials.json / the `.jks`) outside the machine; losing it means every user must uninstall (and lose local data) to update.
- `versionCode` must be strictly higher (downgrades are rejected). Already true with auto-increment.
- **Foreground only:** the install intent must be launched while the app is in the foreground (background activity launches are blocked since Android 10). Android 14 adds: apps with `targetSdkVersion < 23` can't be installed (verified; irrelevant for SDK 57) and update-ownership features for installers (unverified); silent/background installs need `PackageInstaller` + user action for non-privileged apps anyway. So: never try to install from a background task; only on user tap.
- Delete old `carguy-*.apk` files from cache on next launch.
- 142 MB is large: offer "Solo por Wi-Fi" (check `expo-network`), and consider ABI splits (`arm64-v8a` only) which typically cut a React Native APK roughly in half.

**Combined policy:** OTA for JS fixes (silent download, "Reiniciar" banner); APK prompt when `/api/apk` versionCode > installed (native changes). If an OTA can't reach an APK because the runtime differs, the APK prompt covers it.

---

## 4. Ads, honestly

### 4.1 AdMob for a sideloaded APK

Verified (AdMob help 9989980, 10564477): "Your app must be listed in a supported store … has a store listing and is available for download"; "apps listed exclusively in unsupported stores can't be reviewed and will receive limited ad serving"; unlinked apps get "limited ad serving until it's approved during AdMob's readiness process". Supported stores: **Google Play, Apple App Store, Amazon Appstore, Samsung Galaxy Store, Xiaomi GetApps, OPPO App Market, VIVO App Store**. GitHub Releases is not one. So a GitHub-distributed APK stays in limited serving indefinitely — very low fill.

`app-ads.txt` (unverified (from knowledge)): AdMob checks a file at the root of the **developer website listed on the store listing**. Without a store listing there is nowhere to declare it; this is another reason sideloaded apps can't be fully verified.

Expo path (unverified (from knowledge); docs fetch not approved): `react-native-google-mobile-ads` ships a config plugin (`["react-native-google-mobile-ads", { "androidAppId": "ca-app-pub-…~…", "iosAppId": "…" }]`), needs a development build (not Expo Go), and recent major versions support the New Architecture. Use the published test unit IDs during development. Nothing for the web/PWA side (AdSense is a different product and would make the Vercel site "commercial", see §5).

### 4.2 Realistic revenue (estimate, order of magnitude only)

LatAm eCPM for a utility app (estimate, unverified): banner ≈ $0.05–0.30, interstitial ≈ $0.50–2, rewarded ≈ $1–4 — and lower under limited serving. 30 users × ~2 sessions/day × 1 banner refresh-limited impression ≈ 1,800 impressions/month → **≈ $0.10–0.50/month**. AdMob's payment threshold is $100 (unverified (from knowledge)) — that's years to first payout, assuming fill at all.

UX/safety: AdMob policy forbids ads placed near interactive controls where they cause accidental clicks, and interstitials at unexpected moments (unverified wording). For a car app the rule should be stronger than policy: **no ads on any screen usable while driving** (map, active trip, fuel-pump quick entry), never during an active trip.

**Conclusion: don't add ads.** For a sideloaded app with ~30 users they produce cents, can't pass app verification, add a native SDK + consent (UMP) complexity, a privacy-policy obligation, and make the app worse. Revisit only if the app goes to Play and reaches thousands of DAU.

### 4.3 Alternatives

- **Voluntary support link** ("Apoya Car Guy ☕") in Settings/About, never nagging.
  - PayPal in the Dominican Republic (unverified — paypal.com fetch not approved): DR accounts exist; receive/withdraw capabilities have varied over time. Check paypal.com/do → "Recibir pagos" and try a PayPal.me link with a test payment before publishing it.
  - Ko-fi pays out via PayPal or Stripe (unverified); if PayPal-DR can receive, Ko-fi works via PayPal with 0 % platform fee on donations.
  - Buy Me a Coffee pays out mainly via Stripe (unverified); Stripe does not support Dominican Republic merchant accounts (unverified (from knowledge) — in LatAm Stripe supports Mexico and Brazil), so BMC is probably not usable directly.
  - Stripe: likely unavailable for a DR individual (unverified).
- **"Premium" cosmetic tier via the existing role** (e.g. `role = 'supporter'`): unlock themes, custom app icon color (icons are native resources → would need alternative-icon support; themes are cheaper), extra stats cards, a supporter badge. Grant it manually from the admin panel after a donation. Don't gate data features (backup, export) — that's what users rely on.

### 4.4 Supabase costs and when Pro is necessary

Verified (supabase.com/pricing): **Free**: 500 MB database per project, 1 GB file storage, 5 GB egress + 5 GB cached egress, 50,000 MAU, 500k Edge Function invocations, **paused after 1 week of inactivity**, max 2 active projects. **Pro $25/month**: 8 GB disk per project, 100 GB storage, 250 GB egress + 250 GB cached egress, 100,000 MAU, $10 compute credit (covers one Micro). Overage: storage $0.0213/GB, egress $0.09/GB, cached egress $0.03/GB, disk $0.125/GB, MAU $0.00325.

Important: the project is **shared with another app**, so the 500 MB DB / 1 GB storage / 5 GB egress are shared too.

Estimate for 30 users (estimate):

| Item | Assumption | Per month | Cumulative after 12 months |
|---|---|---|---|
| Photos | 1600 px JPEG ≈ 300 KB + thumb ≈ 30 KB; 5 photos/user/month | 150 × 330 KB ≈ 50 MB storage | ≈ 600 MB storage |
| Trips | 60 trips/user/month; encoded polyline after simplification ≈ 3–10 KB; raw points JSON ≈ 30–100 KB | 1,800 trips → 5–20 MB (encoded) or 50–180 MB (raw) DB | 60–240 MB vs 0.6–2 GB |
| Other rows | fuel, maintenance, odometer | < 1 MB | ~10 MB |
| Egress | thumbs in lists, full photos on open, sync | 0.3–2 GB if media are cached on device; much more if not | — |

So with ~30 users, **storage (1 GB) is the first wall, at roughly 1–1.5 years** with current photo sizes, and the **DB (500 MB) is the first wall if trips are stored as raw point arrays**. Egress stays under 5 GB only if the app caches thumbnails/photos locally (expo-image disk cache; `Cache-Control` on storage objects) instead of redownloading on every list render. Pausing isn't a problem as long as someone uses it weekly (two apps share the project, which helps).

Pro becomes necessary when any of: storage > ~800 MB, DB > ~400 MB, monthly egress approaching 4 GB, or you need no-pause/daily backups. Before paying: store trips as encoded polylines (Douglas-Peucker ~5 m), cap photo long edge at 1600 px / quality 0.7, purge orphaned files.

**Usage meter for the admin panel**

```sql
create or replace function admin_usage() returns json
language sql security definer set search_path = public as $$
  select json_build_object(
    'db_bytes', pg_database_size(current_database()),
    'carguy_tables_bytes', (select coalesce(sum(pg_total_relation_size(c.oid)),0)
                            from pg_class c join pg_namespace n on n.oid = c.relnamespace
                            where n.nspname = 'public' and c.relkind = 'r' and c.relname like 'cg\_%'),
    'storage_bytes', (select coalesce(sum((metadata->>'size')::bigint),0) from storage.objects)
  );
$$;
revoke all on function admin_usage() from public, anon, authenticated;
-- call via an admin-checked RPC wrapper / Edge Function with service role
```

(Keep the existing `storage_usage_bytes` RPC; the above adds DB size. Use a table-prefix or schema to split Car Guy vs the other app.) Display bars against 500 MB / 1 GB with amber at 70 %, red at 90 %. **Egress isn't queryable from SQL** — estimate it: log media downloads client-side (bytes of each storage object fetched when not served from local cache) into a daily counter table, plus a fixed allowance for API/sync traffic, and show "≈ X GB este mes (estimado)". Cross-check monthly against the Supabase dashboard Usage page.

---

## 5. Vercel Hobby

Verified (Vercel Fair Use Guidelines, updated 2026-09-14): Hobby includes **Fast Data Transfer: first 100 GB/month**, **Function invocations: first 1,000,000**, Fast Origin Transfer 10 GB, Active CPU 4 h, Provisioned Memory 360 GB-hrs, Image Optimization 5K transformations/month. A static PWA + `/api/apk` with 30 users uses a tiny fraction — but **don't proxy the 142 MB APK through Vercel**; redirect to the GitHub Release asset (each proxied download would cost ~142 MB of transfer; 30 users × 4 releases ≈ 17 GB/month).

Cron (verified): Hobby allows up to 100 cron jobs per project, **minimum interval once per day**, scheduling precision per hour ("`0 1 * * *` … will trigger anywhere between 1:00 am and 1:59 am"); more frequent expressions fail at deploy. For anything more frequent use Supabase `pg_cron` (available on Free, unverified) or a GitHub Actions schedule.

Commercial use (verified, exact wording): "**Hobby teams** are restricted to non-commercial personal use only." Commercial usage is "any Deployment that is used for the purpose of financial gain of anyone involved in any part of the production of the project", including "Any method of requesting or processing payment from visitors of the site", "The inclusion of advertisements, including but not limited to online advertising platforms like Google AdSense". And: "**Asking for Donations does not fall under commercial usage.**"

→ A free app with a donation link on Hobby is explicitly fine. A paid "Premium" sold through the site, or ads on the web build, would be commercial → Pro. A supporter role granted manually after a voluntary donation is arguably still a donation; keep it framed as "gracias por apoyar", not a price list, or ask Vercel support if it becomes a real sale.

---

## Summary of recommendations

1. iPhone PWA: foreground-only GPS, no automatic trips; show a capability card; request `navigator.storage.persist()`; keep Supabase as the source of truth.
2. SW: network-first HTML, versioned atomic precache of hashed assets, `skipWaiting` + `clients.claim` + reload-once, `sw.js` no-cache, boot watchdog with "Reintentar".
3. GPS: `maximumAge: 0`, `enableHighAccuracy: true`, drop fixes older than 15 s, solid dot only at ≤ 50 m, "Buscando GPS…" state, re-arm on resume; same filter on Android and in the background task.
4. Updates: expo-updates with `fingerprint`, channels in `eas.json`, verify `Updates.channel` in a local build, background fetch + "Reiniciar" banner; APK prompt via `/api/apk` + `File.createDownloadTask` + `file.contentUri` + `ACTION_VIEW`; protect the keystore.
5. Ads: no. Donation link (verify PayPal-DR receiving first) + cosmetic supporter role.
6. Costs: everything fits free tiers at 30 users; watch Supabase storage (photos) and DB (raw trip points) — the shared project hits 1 GB storage / 500 MB DB first; add the usage meter.

---

## Sources

Verified (fetched 2026-10-01):
- Expo pricing — https://expo.dev/pricing
- EAS Update introduction — https://docs.expo.dev/eas-update/introduction/
- EAS Update runtime versions — https://docs.expo.dev/eas-update/runtime-versions/
- EAS Update getting started — https://docs.expo.dev/eas-update/getting-started/
- EAS Update download strategies — https://docs.expo.dev/eas-update/download-updates/
- expo-updates SDK (latest = 57) — https://docs.expo.dev/versions/latest/sdk/updates/
- expo-file-system SDK (latest = 57, ~57.0.7) — https://docs.expo.dev/versions/latest/sdk/filesystem/
- expo-intent-launcher SDK (latest = 57) — https://docs.expo.dev/versions/latest/sdk/intent-launcher/
- expo-location SDK — https://docs.expo.dev/versions/latest/sdk/location/
- EAS local builds — https://docs.expo.dev/build-reference/local-builds/
- WebKit: Updates to Storage Policy (Safari 17) — https://webkit.org/blog/14403/updates-to-storage-policy/
- WebKit: Full Third-Party Cookie Blocking and More (7-day cap, Home Screen counter) — https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/
- WebKit: Web Push for Web Apps on iOS and iPadOS — https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/
- AdMob: set up an app / supported stores / limited ad serving — https://support.google.com/admob/answer/9989980
- AdMob: app readiness — https://support.google.com/admob/answer/10564477
- Android 14 behavior changes (all apps) — https://developer.android.com/about/versions/14/behavior-changes-all
- Supabase pricing — https://supabase.com/pricing
- Vercel cron usage & pricing — https://vercel.com/docs/cron-jobs/usage-and-pricing
- Vercel fair use guidelines (Hobby limits, commercial use) — https://vercel.com/docs/limits/fair-use-guidelines

Attempted, not usable (marked unverified in text):
- MDN watchPosition, PayPal country pages (/do and /us), stripe.com/global, Ko-fi help, Buy Me a Coffee help, react-native-google-mobile-ads docs — fetch permission not answered.
- AdMob 9905175 and 10038409 — fetched, but didn't cover store requirements.
- developer.android.com Manifest.permission / Intent reference — fetched, but content truncated; details given from knowledge.
