# Research 03: photo-picker bug, EAS env vars, changelog screen, feedback, APK download, animated splash

Scope: Car Guy (Expo SDK 57, RN New Architecture, expo-router, Android APK via `eas build --local`, static web export on Vercel with `api/` functions, Supabase `x-core` / schema `carguy`).
Everything below was checked against the pages listed in **Sources**, unless it is marked **unverified (from knowledge)**.

---

## 1. Bug: `Context.renderAsync` rejected with `JobCancellationException` (Android)

### 1.1 This is a known, open upstream bug

The error text matches **expo/expo#50217** word for word:

```
Call to function 'Context.renderAsync' has been rejected.
→ Caused by: kotlinx.coroutines.JobCancellationException: DeferredCoroutine was cancelled
```

What the issue reports (fetched 2026-09-29):
- **Affected:** `expo-image-manipulator` 57.0.18 and earlier. SDK 56+. **Android only**; iOS is fine.
- **Root cause:** in `ImageManipulatorContext.kt`, releasing the SharedObject cancels the render job even while a `renderAsync()` call is still waiting on it:
  ```kotlin
  override fun sharedObjectDidRelease() {
    task.cancel()
  }
  suspend fun render() = task.render()
  ```
  So any release of the JS context during a render rejects the promise. On iOS, Swift only cancels on `reset()`.
- **Things that trigger a release mid-render:**
  - (a) calling `context.release()` explicitly;
  - (b) `useImageManipulator` unmounting, because it uses `useReleasingSharedObject`, which calls `release()` on unmount;
  - (c) **garbage collection** of the JS context object.
- The repro results were 0/10 failures when the release happens after the render resolves, and 10/10 when it happens 20 ms into an 81 ms render. In production, failures showed up 169–378 ms after `manipulate()` on **4000×3000 camera JPEGs**. Large camera photos mean long renders, and a long render leaves a wider window for a release to land.

A related issue, **expo/expo#49799** (expo-modules-core, closed), covers the GC path. An async call on a SharedObject can lose its receiver if Hermes collects the JS object between the call and native argument conversion. That issue names expo-image-manipulator as affected. Its fix went in through PR #50513 (merged 2026-09-22, per the PR page). The documented workaround is to **keep a strong reference past the `await`**:

```ts
const context = ImageManipulator.manipulate(uri);
const result = await context.renderAsync();
context.release(); // keeps reference alive until after await completes
```

**Fix status.** PR **#50218** removes the `sharedObjectDidRelease()` override. The GitHub search API listed it as open. Its PR page summary said "merged". However, I fetched `ImageManipulatorContext.kt` on both the `sdk-57` and `main` branches on 2026-09-29, and **both still contain `task.cancel()` in `sharedObjectDidRelease`**. Treat it as **not fixed in any SDK 57 release** (npm `latest`/`sdk-57` = 57.0.19). The `sdk-57` CHANGELOG has no 57.0.18/57.0.19 entry that mentions it. Note also that the `maxWidth`/`maxHeight` downsampling option on `manipulate()` only arrives in **58.0.0**, so it is not available on SDK 57.

### 1.2 Root-cause hypotheses, ranked for Car Guy

1. **GC or release of the `ImageManipulatorContext` during a long render (most likely).**
   - The code does `ImageManipulator.manipulate(uri).resize(...)` and then `await context.renderAsync()`. If nothing references `context` after that `await`, Hermes may collect it.
   - The New Architecture plus a freshly pushed screen means a lot of allocation right after the picker returns (the new form mounting, image previews). That makes a GC during those ~100–400 ms likely.
   - A full-resolution camera or gallery photo makes the render long.
   - This matches "fails on a NEW vehicle form" (heavy mount happening at the same time) and "intermittent".
2. **The owner component unmounts or re-keys during the render.**
   - This applies if the code uses `useImageManipulator`, or calls `release()` from an effect cleanup.
   - A `key` change on the PhotoPicker's parent (for example, keyed by vehicle id, which changes from `undefined` to a draft id on a new vehicle), or a navigation replace, unmounts the component and releases the context. That is the issue's Phase C.
3. **The Activity is destroyed while the picker or camera is open (Android "Don't keep activities" / low memory).**
   - The ImagePicker docs: *"Android system sometimes kills the `MainActivity` after the `ImagePicker` finishes. When this happens, we lose the data selected using the `ImagePicker`… you can retrieve the lost data by calling `getPendingResultAsync`."*
   - When this happens, the JS runtime and module instances are recreated, and any in-flight work is lost. It shows up more often as "picked photo silently disappears" than as this exact exception, but the two can combine: the app restarts and the form mounts again with a recovered URI.
4. **The module is recreated by Fast Refresh or a JS reload (dev only).** This can cancel in-flight coroutines. It does not affect release APKs.

### 1.3 Defensive fix (drop-in)

Rules:
- Never use `useImageManipulator` for one-shot "pick then compress" work. Use the imperative `ImageManipulator.manipulate`.
- Hold strong references to both the context **and** the `ImageRef` until `saveAsync` has resolved, then `release()` both in `finally`.
- Do render and save inside one async function, with no unrelated `await` in between (no state updates or navigation awaited in the middle).
- Keep this function outside the component, in `lib/image.ts`, so unmounting cannot cancel it. Only `setState` if the component is still mounted.
- Retry once on `JobCancellationException` or "already released".
- Resize to a bounded width (for example 1600 px) so renders are short.

```ts
// lib/image.ts
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

const isCancel = (e: unknown) =>
  /JobCancellationException|was cancelled|already released/i.test(String((e as any)?.message ?? e));

async function renderOnce(uri: string, width: number, compress: number) {
  const ctx = ImageManipulator.manipulate(uri);        // strong ref
  let img: Awaited<ReturnType<typeof ctx.renderAsync>> | null = null;
  try {
    ctx.resize({ width, height: null });
    img = await ctx.renderAsync();
    const out = await img.saveAsync({ compress, format: SaveFormat.JPEG });
    return out;                                         // { uri, width, height }
  } finally {
    // released only AFTER both awaits: keeps ctx/img reachable for the whole pipeline
    try { img?.release(); } catch {}
    try { ctx.release(); } catch {}
  }
}

export async function compressPhoto(uri: string, width = 1600, compress = 0.7) {
  try {
    return await renderOnce(uri, width, compress);
  } catch (e) {
    if (!isCancel(e)) throw e;
    await new Promise(r => setTimeout(r, 150));         // let GC / navigation settle
    try { return await renderOnce(uri, width, compress); }
    catch (e2) {
      if (!isCancel(e2)) throw e2;
      return { uri, width: undefined, height: undefined, uncompressed: true as const }; // last resort: upload original
    }
  }
}
```

Note: whether `ImageRef.release()` exists on the `ImageRef` type is **unverified (from knowledge)**. SharedObject/SharedRef subclasses expose `release()` in expo-modules-core. If TypeScript complains, keep `img` referenced by using it after the save instead.

In the PhotoPicker:
- Call `compressPhoto` from the picker callback.
- Guard state updates with `mountedRef`.
- **Do not change the `key`** of the PhotoPicker or its form while a pick is in progress. On a new vehicle, give the form a stable `key` (for example a draft id created once in `useState(() => uuid())`) instead of one that flips when the record is created.
- Show a "processing…" state, and disable Save until the compression resolves.

Recover lost picker results on mount (Android):

```ts
useEffect(() => {
  if (Platform.OS !== 'android') return;
  ImagePicker.getPendingResultAsync().then(res => {
    if (res && !('code' in res) && !res.canceled && res.assets?.[0]) {
      handlePicked(res.assets[0].uri);                  // same compressPhoto path
    }
  });
}, []);
```

(The shape of `ImagePickerErrorResult` is `{ code, message }`. The type-guard spelling is **unverified (from knowledge)**. The docs only say that it returns the launch result or an `ImagePickerErrorResult` on Android, and `null` elsewhere.) Mount this in the screen that hosts the picker. When the Activity is recreated, expo-router restores the route stack only if the state was persisted. Otherwise the app reopens at the root, so a global hook in `app/_layout.tsx` that stashes the recovered URI in a store is the safest option. That stack-restore behaviour is **unverified (from knowledge)**.

Optional permanent fix: patch `ImageManipulatorContext.kt` with `patch-package`, deleting the `sharedObjectDidRelease` override as PR #50218 does, and build from source. The issue notes the module ships a prebuilt AAR, so this is needed:

```json
"expo": { "autolinking": { "buildFromSource": ["expo-image-manipulator"] } }
```

This is only worth it if the JS-side mitigations are not enough.

### 1.4 How to reproduce

1. On the device, open Developer options and enable **"Don't keep activities"**. The ImagePicker docs recommend this for testing `getPendingResultAsync`.
2. On a release APK, open "New vehicle", pick a large camera photo (12 MP+), and watch logcat for the rejection.
3. To force the release race deterministically in a debug build, call `ctx.release()` 20 ms after `renderAsync()` starts (the issue's Phase B), or call `global.gc?.()` in a tight loop while rendering. This relies on Hermes exposing `gc()` in dev, which is **unverified (from knowledge)**.
4. Check that, after the fix, 10/10 picks succeed with "Don't keep activities" both on and off.

---

## 2. `EXPO_PUBLIC_*` missing from the locally built APK

### 2.1 How it works (verified)

- **Inlining happens at bundle time.** *"EAS Build uses Metro Bundler to build the JavaScript bundle … so it will use .env files uploaded with your build job to inline `EXPO_PUBLIC_` variables."*
  - Only static dot access is inlined: `process.env.EXPO_PUBLIC_KEY`.
  - `process.env['EXPO_PUBLIC_KEY']` and `const { EXPO_PUBLIC_X } = process.env` are **not** inlined.
  - Check `lib/supabase.ts` for either pattern. It is a common cause of "not configured" on its own.
- **Which files get uploaded or archived.** EAS CLI uses `.gitignore` to decide what to ignore, and `.easignore` takes priority if present. Because `.env*` is normally gitignored, **your `.env` never reaches the build**, including the local build's working copy. That the local build also archives the project using these rules is **unverified (from knowledge)**, but it matches the symptom.
- **EAS environment variables:**
  - Environments are `development`, `preview`, and `production`. Custom environment names require a paid plan.
  - Visibility is **plain text**, **sensitive** (obfuscated in logs), or **secret** (not readable outside EAS servers).
  - **Local builds do not support "Secret" visibility** (local-builds page: *"set them in your local environment instead"*).
  - The FAQ warns against giving `EXPO_PUBLIC_` variables secret visibility.
- **eas.json:**
  - `env` is for *"values that you would commit to your git repository and not for passwords or secrets"*.
  - `environment` is *"the environment used to apply environment variables for the build process"*.
  - If `environment` is omitted, the defaults are `production` for store distribution, `development` for a dev client, and `preview` otherwise. The docs do not state the precedence between `env` and EAS variables.
- **`eas env:pull --environment <env>`** writes `.env.local` for local development.
- **Public by design.** *"Never store sensitive secrets in environment variables that are prefixed with `EXPO_PUBLIC_`."* Supabase: publishable/anon keys are *"Safe to expose online … mobile or desktop app, … source code"*; *"Row Level Security decides what this client can reach."* So putting the URL and anon key in `eas.json` `env` in plain text is acceptable.

### 2.2 Commands

```bash
# one-time: create plain-text vars in each environment the APK profiles use
eas env:create --name EXPO_PUBLIC_SUPABASE_URL      --value https://<ref>.supabase.co --environment preview --environment production --visibility plaintext
eas env:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value <anon-key>              --environment preview --environment production --visibility plaintext
eas env:list --environment production        # verify
eas env:pull --environment production        # writes .env.local for dev
```

The docs page shows `eas env:set … --visibility plaintext`. `env:create` with repeatable `--environment` is **unverified (from knowledge)**, so run `eas env:create --help` to confirm the flags on your eas-cli version.

### 2.3 eas.json: belt and braces

Set `environment` **and** duplicate the two public values in `env`. This way a local build works even if the EAS lookup fails or the CLI is not logged in.

```json
{
  "build": {
    "base": {
      "env": {
        "EXPO_PUBLIC_SUPABASE_URL": "https://<ref>.supabase.co",
        "EXPO_PUBLIC_SUPABASE_ANON_KEY": "<anon-key>"
      }
    },
    "preview":     { "extends": "base", "environment": "preview",    "distribution": "internal", "android": { "buildType": "apk" } },
    "release-apk": { "extends": "base", "environment": "production", "distribution": "internal", "android": { "buildType": "apk" } },
    "production":  { "extends": "base", "environment": "production" }
  }
}
```

Alternative, if you prefer not to commit the values: just before `eas build --local`, run `eas env:pull --environment production` and export the variables into the shell (`set -a; . ./.env.local; set +a`). A local build inherits your shell environment. The docs' "set them in your local environment" wording implies this; the details are **unverified (from knowledge)**.

### 2.4 Build-time guard

In `app.config.ts` (it is evaluated during the build):

```ts
const isRelease = process.env.EAS_BUILD === 'true' && process.env.EAS_BUILD_PROFILE !== 'development';
for (const k of ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_ANON_KEY']) {
  if (isRelease && !process.env[k]) throw new Error(`[car-guy] ${k} is empty — refusing to build`);
}
```

The docs confirm `EAS_BUILD=true` is exposed in builds. `EAS_BUILD_PROFILE` is **unverified (from knowledge)**. Bracket access is fine here because this is Node config, not the Metro bundle.

Also add a CI step in the release workflow that runs `grep -q "supabase.co" <bundle>` on the exported bundle before uploading the APK. As a runtime safety net, keep the existing "not configured" screen but show the app version so reports are actionable.

---

## 3. In-app "Historial de versiones" and "Novedades"

- **Build-time generation.** Add `scripts/gen-changelog.ts`, run from `prebuild`/`prestart`/`predeploy` (and in the release workflow).
  - It parses `CHANGELOG.md` headings `## [x.y.z] - YYYY-MM-DD` and the `### Added/Fixed/Changed` bullets.
  - It writes `lib/changelog.generated.ts`: `export const CHANGELOG = [{ version, date, sections: { added: [], fixed: [] } }] as const;`.
  - Commit the generated file, or generate it in CI, so the screen works offline and on web. Keep the parser tolerant: split on `^## `, then take `- ` lines per `### `.
- **Version source.**
  - In SDK 57, `Constants.expoConfig` is *"the standard Expo config object defined in app.json and app.config.js"*, so `Constants.expoConfig?.version` works on native and web.
  - The docs mark the native version properties on Constants as deprecated in favour of **expo-application**: `Application.nativeApplicationVersion` (for example "2.11.0"; `null` on web) and `Application.nativeBuildVersion` (`null` on web).
  - Use `Application.nativeApplicationVersion ?? Constants.expoConfig?.version`.
- **"Novedades" once per update.**
  - On app start, read `lastSeenVersion` from AsyncStorage or SecureStore.
  - If it differs from the current version and `CHANGELOG[0].version === current`, show a bottom sheet with that entry, then store the current version.
  - On first install, store the current version without showing anything, so new users are not shown notes.
- **Links.** Each entry links to `https://github.com/<owner>/<repo>/releases/tag/v<version>`, and a footer links to "Ver todas" at `/releases`.

---

## 4. Feedback and bug reports to Supabase

### 4.1 Table + RLS

```sql
create table carguy.feedback (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  kind text not null check (kind in ('bug','idea')),
  message text not null check (char_length(message) between 5 and 4000),
  app_version text, platform text, os_version text, device_model text,
  device_id text,                          -- random install id (see below)
  user_id uuid null references auth.users(id) on delete set null default auth.uid(),
  email text null,
  screenshot_path text null,
  status text not null default 'new' check (status in ('new','seen','done'))
);
alter table carguy.feedback enable row level security;

-- anyone (anon or signed-in) may insert; cannot spoof another user_id
create policy fb_insert on carguy.feedback for insert to anon, authenticated
  with check (user_id is null or user_id = (select auth.uid()));

-- owners read their own
create policy fb_select_own on carguy.feedback for select to authenticated
  using (user_id = (select auth.uid()));

-- admin reads/updates all
create policy fb_admin_select on carguy.feedback for select to authenticated
  using ((select auth.jwt() ->> 'email') = 'tecnologia@constructorasd.com');
create policy fb_admin_update on carguy.feedback for update to authenticated
  using ((select auth.jwt() ->> 'email') = 'tecnologia@constructorasd.com')
  with check (true);
grant insert on carguy.feedback to anon, authenticated;
grant select, update on carguy.feedback to authenticated;
```

Notes from the Supabase docs:
- Always scope policies with `to anon/authenticated`.
- Wrap `auth.uid()` / `auth.jwt()` in `(select …)` so Postgres caches them per statement (initPlan).
- `app_metadata` (server-controlled) is acceptable for authorization; `user_metadata` is not.
- UPDATE needs a matching SELECT policy.

Choosing an admin check:
- Comparing the email claim is simple for a single-admin app. Compare it lower-cased, because the claim's casing is **unverified**.
- A more robust option is `(select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'`, set through the service role.

**Important:** anon has INSERT but no SELECT. So the client must call `.insert(row)` **without `.select()`**, or with `Prefer: return=minimal`. Otherwise PostgREST tries to return the row and the insert fails RLS. Also make sure `carguy` is in the API's exposed schemas and that `usage on schema carguy` is granted to anon. Both are **unverified (from knowledge)**, but they are standard for custom schemas.

### 4.2 Anti-spam (keep it simple)

Do not grant INSERT to anon. Expose an RPC instead:

```sql
create or replace function carguy.submit_feedback(p jsonb) returns void
language plpgsql security definer set search_path = carguy, public as $$
begin
  if (select count(*) from carguy.feedback
      where device_id = p->>'device_id' and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  insert into carguy.feedback(kind,message,app_version,platform,os_version,device_model,device_id,user_id,email,screenshot_path)
  values (p->>'kind', left(p->>'message',4000), p->>'app_version', p->>'platform', p->>'os_version',
          p->>'device_model', p->>'device_id', auth.uid(), p->>'email', p->>'screenshot_path');
end $$;
revoke all on function carguy.submit_feedback(jsonb) from public;
grant execute on function carguy.submit_feedback(jsonb) to anon, authenticated;
```

- Add an index on `(device_id, created_at)`.
- `device_id` is client-supplied and therefore spoofable. It is fine as a nuisance filter. `pg_net` is not needed.
- On Android, `Application.getAndroidId()` gives a stable, per-signing-key id. On web, use a random UUID stored in localStorage.

### 4.3 Device info

From `expo-device`:
- `modelName`, `manufacturer`, `osName`, `osVersion`, `platformApiLevel` (Android only).
- `brand`, `osBuildId`, and `platformApiLevel` are always `null` on web; `modelName` may be `null`.
- None of these need permissions.

From `expo-application`: `nativeApplicationVersion` and `nativeBuildVersion` (both `null` on web). Fall back to `Constants.expoConfig?.version`.

### 4.4 Screenshot (optional)

Prefer a separate private bucket, `carguy-feedback`, with an insert-only policy and no select or update. Upload needs INSERT only; upsert would need SELECT+UPDATE+INSERT.

```sql
create policy fb_upload on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'carguy-feedback' and (storage.foldername(name))[1] = 'reports');
```

- Upload with `upsert: false` to `reports/<uuid>.jpg`, compressed using `compressPhoto()` from section 1.
- The admin reads screenshots through signed URLs from an admin-only select policy.

---

## 5. "Descargar APK" on car-guy.vercel.app

- **Stable link (verified):** `https://github.com/<owner>/<repo>/releases/latest/download/<asset-name>` links to *"your latest release asset that was manually uploaded"*.
  - The asset name must be identical in every release. Publish a fixed `car-guy.apk`, and optionally a versioned copy as well.
  - The docs do not say how prereleases or drafts are handled. However, the REST API defines "latest" as *"the most recent non-prerelease, non-draft release"*, and `/releases/latest` presumably follows the same rule. Do not mark APK releases as prerelease.
- **REST API:** `GET https://api.github.com/repos/{owner}/{repo}/releases/latest`.
  - No auth is needed for public repos.
  - Assets include `name`, `browser_download_url`, `size`, `content_type`, and `download_count`. The release also has `tag_name`, `body`, and `published_at`.
  - CORS: *"supports … CORS for AJAX requests from any origin"* (`Access-Control-Allow-Origin: *`).
  - Unauthenticated rate limit: **60 req/h per IP**. A conditional request that returns 304 (`If-None-Match` with the ETag) does not count against the primary rate limit.
- **Vercel proxy `api/apk.ts`** (shared cache means one upstream call per window, whatever the traffic):

```ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const r = await fetch('https://api.github.com/repos/<owner>/<repo>/releases/latest', {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'car-guy-web',
               ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}) },
  });
  if (!r.ok) return res.status(502).json({ error: 'github', status: r.status });
  const j = await r.json();
  const apk = j.assets?.find((a: any) => a.name.endsWith('.apk'));
  res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=600, stale-while-revalidate=3600, stale-if-error=86400');
  res.json({ version: j.tag_name, publishedAt: j.published_at, notes: j.body,
             url: apk?.browser_download_url, size: apk?.size });
}
```

Per the Vercel docs, `s-maxage` sets the CDN freshness and is stripped before the response reaches the client. `stale-while-revalidate` revalidates in the background, and `stale-if-error` serves the stale copy when there are upstream errors. The default is `public, max-age=0, must-revalidate`.

- **Show the button only on Android.**
  - `navigator.userAgentData?.platform === 'Android'` or `navigator.userAgentData?.mobile`. This API is Chromium-only, experimental, and HTTPS-only.
  - Fall back to `/Android/i.test(navigator.userAgent)`.
  - Hide the button when running inside the native app, where `Platform.OS !== 'web'`.
- **PWA context.**
  - Detect it with `matchMedia('(display-mode: standalone)').matches`.
  - Downloads from an installed PWA still go through Chrome's download manager. I could not fetch a source for this, so it is **unverified (from knowledge)**.
  - Use a plain `<a href={url}>` (or `Linking.openURL` on RN-web) rather than `fetch`+blob. GitHub serves assets through a cross-origin redirect, so the `download` attribute is ignored anyway.
- **MIME / Content-Disposition.**
  - GitHub serves uploaded assets as `application/octet-stream` with `Content-Disposition: attachment` unless a `content_type` is set at upload time. This is **unverified (from knowledge)**. Upload with `application/vnd.android.package-archive` so Android offers "Open/Install".
  - You cannot change these headers on a redirect to GitHub. Proxying the binary through Vercel is possible but costs bandwidth, and it is not needed.
- **Install flow the user sees (unverified, from knowledge):**
  1. Chrome warns "This type of file can harm your device", and the user taps Download anyway.
  2. Opening the file asks the user to allow **"Install unknown apps"** for Chrome (Settings → Apps → Special access).
  3. Play Protect may show "Unsafe app blocked / scan app", and the user taps "Install anyway".
  4. Updates install over the previous version only if they are signed with the same keystore and have a higher `versionCode`.

  Put a short illustrated explainer next to the button.

---

## 6. Animated splash (needle sweeps 0→100, arc fills)

### 6.1 Constraints (verified)

- **Android 12+ SplashScreen API:**
  - The system splash icon can be an `AnimatedVectorDrawable` (`windowSplashScreenAnimatedIcon`). Recommended length ≤1000 ms; start delay ≤166 ms.
  - Icon size: 288 dp without an icon background (fits a 192 dp circle), or 240 dp with one (160 dp circle).
  - The window background must be a single opaque colour. The splash shows on cold and warm starts only.
- **expo-splash-screen (SDK 57):**
  - Config: `backgroundColor`, `image`, `imageWidth`, `resizeMode`, `dark`, and per-platform objects.
  - API: `preventAutoHideAsync()` (*"call this in global scope without awaiting"*), `hide()`/`hideAsync()`, and `setOptions({ duration (default 400), fade (iOS only) })`.
  - The docs **do not mention AVD support**. Their route to custom animation is the `with-splash-screen` example, meaning a JS overlay.
  - Expo Go and dev builds cannot replicate the real splash, so test on a release APK.
- A native AVD would require a config plugin that writes the drawable and theme attribute. That is possible but fragile across prebuilds. Skip it.

### 6.2 Pattern

1. The native splash keeps the static gauge PNG, with the needle at 0 and the arc empty, on the same background colour.
2. At module scope in `app/_layout.tsx`: `SplashScreen.preventAutoHideAsync();`.
3. Render `<AnimatedSplash>` as an absolute-fill overlay on top of the app. It uses the same background and the same gauge geometry, at the same size and position as the native image, so the handoff is seamless.
4. In the overlay's `onLayout`, call `SplashScreen.hide()`. The native splash disappears only after the identical JS frame is painted, so there is no flash.
5. Animate the needle 0→100 and the arc fill over about 900 ms (`Easing.out(Easing.cubic)`). When fonts, session, and data are ready **and** the animation has finished, fade the overlay out (250 ms) and unmount it.
6. With reduced motion: Reanimated's `useReducedMotion()` gives the value synchronously, but it is read once at startup. In that case, jump straight to the final frame and just fade.

**Lottie option.** `lottie-react-native` (Expo bundles 7.2.2; npm latest is 7.5.0; install with `npx expo install lottie-react-native`) works if a designer produces a JSON animation. Reanimated + SVG reuses the existing gauge geometry and adds no dependency.

### 6.3 Sketch

```tsx
// components/AnimatedSplash.tsx
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Path, Line, Circle } from 'react-native-svg';
import Animated, { useSharedValue, useAnimatedProps, useAnimatedStyle, withTiming,
  Easing, runOnJS, useReducedMotion } from 'react-native-reanimated';
import * as SplashScreen from 'expo-splash-screen';

const APath = Animated.createAnimatedComponent(Path);
const ALine = Animated.createAnimatedComponent(Line);
const S = 220, C = S / 2, R = 86, START = -225, SWEEP = 270; // 270° gauge
const ARC_LEN = (Math.PI * 2 * R) * (SWEEP / 360);
const pt = (deg: number, r = R) => {
  const a = (deg * Math.PI) / 180; return { x: C + r * Math.cos(a), y: C + r * Math.sin(a) };
};
const s = pt(START), e = pt(START + SWEEP);
const ARC = `M ${s.x} ${s.y} A ${R} ${R} 0 1 1 ${e.x} ${e.y}`;

export function AnimatedSplash({ ready, onDone, bg = '#0B0F14', accent = '#F5A524' }:
  { ready: boolean; onDone: () => void; bg?: string; accent?: string }) {
  const reduce = useReducedMotion();
  const p = useSharedValue(reduce ? 1 : 0);   // 0..1 progress
  const fade = useSharedValue(1);
  const animDone = useSharedValue(reduce ? 1 : 0);

  useEffect(() => {
    if (!reduce) p.value = withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) },
      f => { if (f) animDone.value = 1; });
  }, []);
  useEffect(() => {
    if (!ready) return;
    const go = () => { fade.value = withTiming(0, { duration: 250 }, f => f && runOnJS(onDone)()); };
    // wait for the sweep to finish (poll cheaply; or chain via withSequence)
    const t = setInterval(() => { if (animDone.value === 1) { clearInterval(t); go(); } }, 50);
    return () => clearInterval(t);
  }, [ready]);

  const arcProps = useAnimatedProps(() => ({ strokeDashoffset: ARC_LEN * (1 - p.value) }));
  const needleProps = useAnimatedProps(() => {
    const deg = START + SWEEP * p.value; const tip = pt(deg, R - 14);
    return { x2: tip.x, y2: tip.y };
  });
  const wrap = useAnimatedStyle(() => ({ opacity: fade.value }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: bg }, wrap]}
      onLayout={() => SplashScreen.hide()} pointerEvents="none">
      <Svg width={S} height={S}>
        <Path d={ARC} stroke="#ffffff22" strokeWidth={14} fill="none" strokeLinecap="round" />
        <APath d={ARC} stroke={accent} strokeWidth={14} fill="none" strokeLinecap="round"
          strokeDasharray={`${ARC_LEN} ${ARC_LEN}`} animatedProps={arcProps} />
        <ALine x1={C} y1={C} stroke="#fff" strokeWidth={5} strokeLinecap="round" animatedProps={needleProps} />
        <Circle cx={C} cy={C} r={9} fill="#fff" />
      </Svg>
    </Animated.View>
  );
}
const styles = StyleSheet.create({ center: { alignItems: 'center', justifyContent: 'center', zIndex: 999 } });
```

In `_layout.tsx`:
- Call `SplashScreen.preventAutoHideAsync()` at the top level.
- Keep `const [showSplash, setShowSplash] = useState(true)`.
- Render the app stack, then `{showSplash && <AnimatedSplash ready={fontsLoaded && sessionChecked} onDone={() => setShowSplash(false)} />}`.

Details:
- Match `S` to `splash.imageWidth` in dp, and export the native PNG from the same SVG at t=0 so the frames match.
- On web, `SplashScreen` is a no-op, so the overlay simply plays.
- The `setInterval` poll is a simplification. A cleaner approach is to hold a JS `useState` flag set by `runOnJS` in the timing callback.
- Animating `x2`/`y2` through animatedProps on react-native-svg works with Reanimated 3/4. Exact prop support is **unverified (from knowledge)**. An alternative is rotating a `G` around the centre using `transform`.

---

## Sources (fetched 2026-09-29)

- https://docs.expo.dev/versions/v57.0.0/sdk/imagemanipulator/
- https://api.github.com/search/issues?q=repo:expo/expo+JobCancellationException+renderAsync
- https://github.com/expo/expo/issues/50217
- https://github.com/expo/expo/pull/50218
- https://github.com/expo/expo/issues/49799
- https://github.com/expo/expo/pull/49807
- https://github.com/expo/expo/blob/sdk-57/packages/expo-image-manipulator/android/src/main/java/expo/modules/imagemanipulator/ImageManipulatorContext.kt
- https://github.com/expo/expo/blob/main/packages/expo-image-manipulator/android/src/main/java/expo/modules/imagemanipulator/ImageManipulatorContext.kt
- https://github.com/expo/expo/blob/sdk-57/packages/expo-image-manipulator/CHANGELOG.md
- https://github.com/expo/expo/blob/main/packages/expo-image-manipulator/CHANGELOG.md
- https://registry.npmjs.org/expo-image-manipulator
- https://docs.expo.dev/versions/v57.0.0/sdk/imagepicker/
- https://docs.expo.dev/eas/environment-variables/
- https://docs.expo.dev/eas/environment-variables/faq/
- https://docs.expo.dev/eas/environment-variables/usage/
- https://docs.expo.dev/build-reference/local-builds/
- https://docs.expo.dev/build-reference/easignore/
- https://docs.expo.dev/build-reference/variables/
- https://docs.expo.dev/guides/environment-variables/
- https://docs.expo.dev/eas/json/
- https://docs.expo.dev/versions/v57.0.0/sdk/constants/
- https://docs.expo.dev/versions/v57.0.0/sdk/device/
- https://docs.expo.dev/versions/v57.0.0/sdk/application/
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/docs/guides/auth/jwts
- https://supabase.com/docs/guides/storage/security/access-control
- https://supabase.com/docs/guides/api/api-keys
- https://docs.github.com/en/repositories/releasing-projects-on-github/linking-to-releases
- https://docs.github.com/en/rest/releases/releases
- https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api
- https://docs.github.com/en/rest/using-the-rest-api/using-cors-and-jsonp-to-make-cross-origin-requests
- https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api
- https://vercel.com/docs/headers/cache-control-headers
- https://developer.mozilla.org/en-US/docs/Web/API/Navigator/userAgentData
- https://developer.mozilla.org/en-US/docs/Web/CSS/@media/display-mode
- https://docs.expo.dev/versions/v57.0.0/sdk/splash-screen/
- https://developer.android.com/develop/ui/views/launch/splash-screen
- https://docs.expo.dev/versions/latest/sdk/lottie/ (the v57.0.0 URL returned 404)
- https://docs.expo.dev/develop/user-interface/splash-screen-and-app-icon/
- https://registry.npmjs.org/lottie-react-native/latest
- https://docs.swmansion.com/react-native-reanimated/docs/device/useReducedMotion/
