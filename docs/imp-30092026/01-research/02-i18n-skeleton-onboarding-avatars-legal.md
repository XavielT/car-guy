# Car Guy — Research 02: i18n, skeleton loaders, onboarding, avatars, legal, DR fuel prices

Date: 2026-09-30 · Target: Expo SDK 57, expo-router, TypeScript, New Architecture, Reanimated 4, Android APK + static web on Vercel.

**Verification status.** WebSearch was disabled. WebFetch succeeded for docs.expo.dev, github.com and registry.npmjs.org. Fetches to support.google.com, developer.android.com, micm.gob.do / www.micm.gob.do, dicebear.com and docs.swmansion.com were **blocked (permission prompt not answered)**, so everything about Google Play policy, Android permission flows, MICM, DiceBear style licenses, Reanimated reduced-motion API, Dominican law, and fuel brands is marked **unverified (from knowledge)**. Re-verify those before you ship and before you submit to Play.

---

## 1. i18n (es + en, switch at runtime, device language as default)

### 1.1 What Expo documents (verified)

- The Expo localization guide uses **i18n-js** as its main example. It lists **Lingui, react-i18next, fbtee and Intlayer** as alternatives.
- You read the device language with `getLocales()[0].languageCode` from `expo-localization`. The v57 `Locale` object includes `languageCode`, `languageTag`, `regionCode`, `languageRegionCode`, `languageScriptCode`, `textDirection`, `currencyCode`, `currencySymbol`, `languageCurrencyCode`, `languageCurrencySymbol`, `decimalSeparator`, `digitGroupingSeparator`, `measurementSystem` and `temperatureUnit`. `getCalendars()` returns the time zone and whether the device uses a 24-hour clock. The `useLocales()` hook re-renders when the OS locale changes. On **web**, currency and measurement system come back as `null`.
- **Android does not restart the app when the device language changes** (iOS does). Re-read locales on `AppState` "active", or use `useLocales()`. This only matters while the user has not picked a language by hand.
- **Translating app metadata** with the top-level `expo.locales` key in app.json:
  ```json
  { "expo": {
      "ios": { "infoPlist": { "CFBundleAllowMixedLocalizations": true } },
      "locales": { "es": "./languages/es.json", "en": "./languages/en.json" } } }
  ```
  Each file holds platform keys, for example `{ "ios": { "CFBundleDisplayName": "Car Guy", "NSLocationAlwaysAndWhenInUseUsageDescription": "…" }, "android": { "app_name": "Car Guy" } }`. The guide shows iOS permission usage strings (`NS*UsageDescription`) translated this way. **It does not document Android permission rationale strings.** That is expected: Android system permission dialogs are rendered and translated by the OS, so the app never supplies that text. Your own rationale and prominent-disclosure screens are in-app UI and come from `es.ts`/`en.ts`. The one Android-side string you do own is the **foreground-service notification title and body** for background location (`expo-location` `startLocationUpdatesAsync({ foregroundService: { notificationTitle, notificationBody } })`). Pass it from the current language when tracking starts.
- **Config plugin `expo-localization`.** The guide says the plugin is needed for RTL settings and for `supportedLocales`. RTL is **on by default**, and you turn it off with `["expo-localization", { "supportsRTL": false }]`. Other options are `forcesRTL` and `supportedLocales: { ios: [...], android: [...] }`. On Android 13+, `supportedLocales` is what makes the app appear in **system Settings → App languages** (per-app language; the guide says both platforms let the user choose a language per app).
  → Recommendation: add `["expo-localization", { "supportsRTL": false, "supportedLocales": { "ios": ["es","en"], "android": ["es","en"] } }]`. You don't need RTL. Turning it off costs nothing and protects the layout if a device is set to Arabic.

### 1.2 Library comparison

| | i18n-js 4.5.3 (MIT) | react-i18next 17.0.15 + i18next ≥26.2 (MIT) | Lingui 6.7.0 (MIT) |
|---|---|---|---|
| Catalogue shape | JSON-like nested object, `%{name}` interpolation | JSON namespaces, `{{name}}`, ICU via plugin | ICU messages extracted from source by a macro, compiled catalogues |
| Functions as values (`yearRange(min,max)`) | No (strings only) | No (strings; formatters) | No |
| Plurals | `make-plural` built in | `_one/_other` suffix keys via Intl.PluralRules | ICU `plural` |
| Type safety | Weak | Good with module augmentation (`CustomTypeOptions`) | Good, needs a Babel macro and extraction step (Node ≥22.19) |
| Lazy loading | Manual | Backends and namespaces | Per-locale dynamic import |
| Bundle and deps | lodash, bignumber.js, make-plural | i18next core (~40 KB) | Small runtime, heavier tooling |
| Migration cost from `es.ts` | Rewrite every function key | Rewrite every function key and every call site to `t('a.b', {…})` | Rewrite every string at its call site |

Your 90 KB `es.ts` is a typed object that contains **functions**. All three libraries would force you to rewrite every parameterised entry into a string template and to change every call site from `t.fuel.yearRange(a,b)` to `t('fuel.yearRange', {min:a,max:b})`. That touches every screen and loses type-checking on the arguments, for no real benefit with only two languages bundled in the app.

### 1.3 Recommended path: keep the typed object and add a store-bound accessor

```ts
// lib/i18n/es.ts  (unchanged, but export the type)
export const es = { common: { save: 'Guardar' }, fuel: { yearRange: (min: number, max: number) => `${min}–${max}` } /* … */ };
export type Dict = typeof es;

// lib/i18n/en.ts
import type { Dict } from './es';
export const en: Dict = { common: { save: 'Save' }, fuel: { yearRange: (min, max) => `${min}–${max}` } };
```
`en: Dict` makes TypeScript fail the build if a key is missing, has the wrong type, or a function has the wrong signature. Use `satisfies Dict` if you prefer keeping literal types. Watch out for one thing: if `es` uses `as const`, `typeof es` pins the literal Spanish strings, so derive a widened type (`DeepStringify<typeof es>`) or skip `as const`.

```ts
// lib/i18n/store.ts (Zustand + persist)
type Lang = 'es' | 'en';
const dicts = { es, en } as const;
const deviceLang = (): Lang => (getLocales()[0]?.languageCode === 'en' ? 'en' : 'es'); // default es
export const useLang = create<{ lang: Lang; source: 'device' | 'user'; setLang(l: Lang): void }>()(
  persist((set) => ({ lang: deviceLang(), source: 'device', setLang: (lang) => set({ lang, source: 'user' }) }),
          { name: 'carguy.lang', storage: createJSONStorage(() => AsyncStorage) }));
export const useT = () => dicts[useLang((s) => s.lang)];        // components: const t = useT();
export const getT = () => dicts[useLang.getState().lang];       // non-React code: notifications, task manager, services
export const localeTag = () => (useLang.getState().lang === 'en' ? 'en-US' : 'es-DO');
```
- Every component that calls `useT()` subscribes to `lang`, so switching language re-renders all mounted screens. To be sure, you can also put `key={lang}` on the root `<Stack>` in `app/_layout.tsx`. That forces a remount and also refreshes header titles set via `options`.
- While `source === 'device'`, re-run `deviceLang()` on `AppState` "active" (Android doesn't restart on a language change).
- Wait for Zustand to finish rehydrating before hiding the splash, so the first frame isn't in the wrong language.
- Background tasks (trip detection, `TaskManager`) run outside React. Use `getT()` there. After a cold start in a headless task, rehydrate the store first, or read AsyncStorage directly.
- Grep for every module-level `const x = es.foo` or `import { es }` used outside components and route them through `useT`/`getT`, otherwise those strings stay frozen in the old language.

**Missing-key guard (two layers).**
1. At compile time, `en: Dict` covers missing keys, extra keys and argument shapes.
2. In Jest, a test walks both trees. It catches keys that were typed but accidentally `''`, `'TODO'`, or a copy-pasted Spanish value:
```ts
function walk(a: any, b: any, path = ''): string[] {
  return Object.keys(a).flatMap((k) => {
    const p = path ? `${path}.${k}` : k;
    if (!(k in b)) return [`missing en: ${p}`];
    if (typeof a[k] === 'object') return walk(a[k], b[k], p);
    if (typeof a[k] !== typeof b[k]) return [`type mismatch: ${p}`];
    if (typeof b[k] === 'string' && (!b[k].trim() || b[k] === a[k] && /[áéíóúñ¿¡]/i.test(a[k]))) return [`untranslated: ${p}`];
    if (typeof a[k] === 'function' && a[k].length !== b[k].length) return [`arity: ${p}`];
    return [];
  });
}
test('en mirrors es', () => expect([...walk(es, en), ...walk(en, es).filter((m) => m.startsWith('missing'))]).toEqual([]));
```
Also call each function with sample arguments to catch runtime throws.

**Plurals.** Keep them as functions that use `Intl.PluralRules(localeTag())`, for example `trips: (n) => n === 1 ? '1 viaje' : \`${fmtInt(n)} viajes\``. English and Spanish only need one/other.

### 1.4 The seeded catalogue in SQLite

Keep the Spanish seed rows as they are. They are the canonical data, and existing foreign keys and sync keep working. Every seeded row already has, or gets, a stable `seed_id` (e.g. `svc.oil_change`, `insp.tires.tread`). Add a translation map in the dictionaries:
```ts
catalog: { service: { oil_change: 'Cambio de aceite', … }, inspection: { … } }  // es
catalog: { service: { oil_change: 'Oil change', … } }                            // en (Dict-typed)
```
and one resolver: `label(row) = row.seed_id && !row.user_edited ? t.catalog[kind][row.seed_id] ?? row.name : row.name`. Rows the user created or renamed display exactly what the user typed. When a seeded row is renamed, set `user_edited = 1` (or clear `seed_id`) so the user's name wins. Search and sort should use the resolved label in memory, not SQL `ORDER BY name`.

### 1.5 Dates, numbers, currency

Use `Intl` everywhere with `localeTag()`: `es-DO` or `en-US`. Hermes on SDK 57 ships `Intl.DateTimeFormat`, `NumberFormat`, `PluralRules` and `RelativeTimeFormat` (unverified (from knowledge): coverage of `Intl.DisplayNames`/`ListFormat` in Hermes. Test before using them). Cache the formatters per locale. Money stays DOP whatever the language (`currency: 'DOP'` → "RD$" in es-DO). Units (km, L, gal) come from user settings, not from the language. `es-DO` uses a dot as the decimal separator (RD$1,234.56), like en-US. Don't hand-code separators; let `Intl` decide. RTL is not needed.

---

## 2. Skeleton loaders

| Option | Deps | Web | Verdict |
|---|---|---|---|
| **In-house `<Skeleton>`**: Reanimated 4 + `expo-linear-gradient` | Already installed. LinearGradient supports Android, iOS and web (verified) | Yes | **Recommended** |
| `moti/skeleton` (moti 0.30.0) | moti → framer-motion ^6.5.1, peer reanimated `*` | README: "Web support, out-of-the-box" | README still says "powered by Reanimated 3". Reanimated 4 compatibility is unverified. Adds framer-motion to the web bundle. Not worth it for one component |
| `react-native-skeleton-placeholder` 5.2.4 | peers `react-native-linear-gradient` + `@react-native-masked-view/masked-view` | Masked view on web is unreliable (unverified (from knowledge)) | Adds a second gradient library alongside expo-linear-gradient. Avoid |
| `react-content-loader` | react-native-svg on native | Web-first | Would need platform splits. Avoid |

**In-house design**
```tsx
<Skeleton.Rect w="100%" h={120} r={16} />  <Skeleton.Circle size={48} />  <Skeleton.Text lines={3} lastWidth="60%" />
```
- One shared shimmer driver: a single `useSharedValue` loop (`withRepeat(withTiming(1,{duration:1200, easing: Easing.linear}), -1)`) provided through context. Each block translates a `LinearGradient` band (transparent → `rgba(255,255,255,0.08)` → transparent over the dark surface) inside an `overflow:'hidden'` view. With one clock, all blocks shimmer in sync and you avoid N separate animation loops.
- **Reduced motion**: Reanimated exposes `useReducedMotion()` and a `ReduceMotion` option on animations (unverified (from knowledge): exact API on Reanimated 4; the swmansion docs could not be fetched). When reduced motion is on, render static blocks (plain `backgroundColor` at surface+1) and don't start the loop. On web, the same hook reads `prefers-reduced-motion`.
- This respects the app's "no idle animation" rule: the loop exists only while a skeleton is mounted. Cancel it on unmount (`cancelAnimation`).
- Accessibility: wrap the root in `accessibilityRole="progressbar"`, `accessibilityLabel={t.common.loading}`, `accessibilityState={{ busy: true }}`, and hide the child blocks with `importantForAccessibility="no-hide-descendants"`.

**Pattern**
- One `screen.skeleton.tsx` next to each screen, mirroring its real layout (same paddings and card heights) so there's no layout shift when data arrives.
- `useDelayedFlag(loading, 150)`: show the skeleton only if loading lasts more than 150 ms, and once shown keep it at least ~300 ms so it doesn't flicker. Local SQLite reads usually finish under 150 ms, so most screens never show a skeleton. Remote Supabase data (shared garage, public dossier) will.
  ```ts
  function useDelayedFlag(on: boolean, delay = 150, minShow = 300) { /* setTimeout → show; when on=false keep until shownAt+minShow */ }
  ```
- **expo-router**: there is **no `loading.tsx` file convention** (that's Next.js). What exists (verified in the v57 router reference): a route can export a **`SuspenseFallback`** component (it receives `params` and `route`), used while the route suspends. There's also the `asyncRoutes` option for lazy route bundles; the docs say production async routes are **web-only**, disabled on native. Practical advice: since you don't use a Suspense-based data library, render the skeleton from the screen's own `loading` state. Optionally export `SuspenseFallback = ScreenSkeleton` from routes so web lazy-loaded bundles show the same skeleton.

---

## 3. Onboarding / tutorial

### 3.1 Route and gating
- Route `app/bienvenida.tsx` (or group `app/(onboarding)/`). In the root layout, gate with `Stack.Protected` (available in SDK 57; the `redirectTo` prop is **SDK 58+**, verified, so on 57 rely on the default redirect to the anchor or first allowed screen, or use `<Redirect href="/bienvenida" />`):
  ```tsx
  const needsIntro = setting.onboarded_version == null || setting.onboarded_version < ONBOARDING_VERSION;
  <Stack.Protected guard={needsIntro}><Stack.Screen name="bienvenida" /></Stack.Protected>
  <Stack.Protected guard={!needsIntro}><Stack.Screen name="(tabs)" /></Stack.Protected>
  ```
  Keep `onboarded_version` as an integer. Bumping it only re-shows **new** slides (store which slide ids were seen, or show a short "Novedades" subset).
- Wait for SQLite and settings to be ready before the first render (splash), otherwise the intro flashes for returning users.

### 3.2 Pager
- `react-native-pager-view` supports **Android and iOS only, no web** (verified). The app also ships a web export, so use a **horizontal `FlatList` with `pagingEnabled`** (or a `ScrollView` with `snapToInterval`). It works on all three platforms. Drive the dot indicator from `onScroll` with a Reanimated `useAnimatedScrollHandler`. The dots are a response to the user's gesture, not an idle animation.
- 5–6 slides: (1) Welcome and language picker (es/en, device default preselected). (2) Register your vehicle: fuel, maintenance, costs. (3) Automatic trips: explains background location, and this slide is **also the prominent disclosure** (see §5.3). It offers "Activar ahora / Más tarde", and the runtime prompt appears only after the user taps. (4) Photos and documents (private, yours). (5) Profile: avatar picker or photo (optional). (6) Optional account and terms acceptance, "Empezar".
- **Skip button** ("Omitir") on every slide, top-right, 44×44 dp minimum. Skipping sets `onboarded_version` and goes to the app. Nothing in onboarding is mandatory except accepting the terms, which is a single checkbox and a button (Play: onboarding and permissions must not block core use; unverified (from knowledge), consistent with Play's permission guidance to request in context).

### 3.3 Coach marks / first-visit tips
- `react-native-copilot` 3.3.3 (released 2024-12-17, 2.4k stars, peers react ≥16.8, RN ≥0.60, react-native-svg). It works by measuring wrapped refs (`CopilotStep` + `walkthroughable`) and drawing an SVG or View overlay. The README says nothing about web or New Architecture support. It hasn't been released in about 21 months. Risk: measurement inside FlashList/ScrollView and Fabric. **Not recommended.**
- **Recommended: an in-house `<TipCard id="garage.first">`.** It's an inline, dismissible card at the top of a screen (icon, 1–2 lines, "Entendido"), shown when `seen_tips` (a JSON set in settings) lacks the id. No overlay, no measuring, works on web, accessible by default. For the one or two places that really need a spotlight (e.g. "tap here to start drive mode"), add a static arrow badge on the target itself instead of a full-screen mask. Reset all tips from Settings → "Ver consejos de nuevo".

### 3.4 Profile photo
- `expo-image-picker`: `launchImageLibraryAsync({ mediaTypes: 'images', allowsEditing: true, aspect: [1,1], quality: 0.8 })` and `launchCameraAsync(...)`. `allowsEditing` crops on Android (crop and rotate) and iOS (crop only). `aspect` applies on Android. On web the picker must be called from a user gesture, and camera support depends on the browser (all verified). Set the `photosPermission` and `cameraPermission` strings in the config plugin, and localise the iOS ones via `locales` (§1.1).
- Always normalise afterwards with **`expo-image-manipulator`**, because web and some Android pickers ignore `aspect`: `ImageManipulator.manipulate(uri).crop({originX, originY, width: s, height: s}).resize({width: 512})` → `renderAsync()` → `saveAsync({ format: SaveFormat.WEBP or JPEG, compress: 0.8 })` (API verified; works on web). Centre-crop with `s = min(w,h)`. Then run the existing `compressPhoto`.
- Storage: copy to `FileSystem.documentDirectory + 'avatar/<uuid>.jpg'` and store `profile.avatar_local_uri` in SQLite. Signed-in users also upload to the private bucket at `avatars/{auth.uid()}/avatar.jpg` (RLS: `(storage.foldername(name))[1] = auth.uid()::text`) and set `profiles.avatar_path`. For shared views, serve via short-lived signed URLs, or a public-read `avatars` bucket if members must see each other's avatars. Decide which and document it in the privacy policy. Anonymous users keep the photo local only, and the upload happens when they create an account.

---

## 4. Avatars (16 in-house JDM-style SVGs)

- **Rendering**: each avatar is a React component built on `react-native-svg` primitives (`Svg`, `Path`, `Circle`, `G`, `LinearGradient`), generated with SVGR in native + TypeScript mode (Expo docs recommend SVGR, and the Android `viewBox` must be kept; verified). Run SVGO first, keep `viewBox="0 0 128 128"`, and remove fixed `width/height`. `react-native-svg` supports Android, iOS and web (verified). Store them in `components/avatars/` plus a registry:
  ```ts
  export const AVATARS = { helmet_red: HelmetRed, silhouette_coupe: …, kanji_hashiriya: …, checkered: … } as const;
  export type AvatarId = keyof typeof AVATARS;
  ```
  Colours come in through props (`primary`, `accent`) from theme tokens (amber and red), so a later theme change doesn't mean redrawing.
- **`<Avatar>` component**: props `{ avatarId?, photoUri?, name?, size = 40 }`. Priority is photo, then `avatarId`, then default (the checkered-flag or helmet avatar, or initials on an amber circle). Keep a fixed set of sizes: 24/32/40/56/96 dp. Clip to a circle with an `overflow:'hidden'` round view. Wrap the Svg in `accessible accessibilityRole="image" accessibilityLabel={t.avatar.labels[id]}`, e.g. "Casco rojo con franja" / "Red helmet with stripe". When the avatar sits next to the person's name, use `accessibilityElementsHidden` / `importantForAccessibility="no"` so screen readers don't read it twice.
- **Data**: `profiles.avatar_id text null` (validate with a CHECK or an enum list in the app) and `profiles.avatar_path text null`. Mirror both in local settings for anonymous users.
- **Fallback everywhere**: public dossier, shared-garage member lists and feedback admin views all go through `<Avatar>`. If a signed URL fails or has expired, `onError` falls back to `avatarId`, then to the default. Never show a broken image.
- **Trademark hygiene**: generic silhouettes only (no recognisable body lines such as a specific Supra, RX-7 or GT-R shape), no badges, grilles or wordmarks, no real livery (e.g. no Castrol or Advan patterns). Keep kanji generic, for example 走 (run), 峠 (touge), 速 (speed). Have someone who reads Japanese confirm the meaning (unverified that any given glyph reads as intended).
- **Licensing**: artwork drawn in-house (by the owner or a generator the owner controls) is your own work, so no attribution is needed. Keep the source files and note "Avatares © Car Guy" in credits. If you commission or buy the art, keep a written licence. If **DiceBear** were used instead: the library code is MIT, but **each style has its own licence**. From knowledge (unverified, dicebear.com/licenses could not be fetched): CC0 styles include *Lorelei, Notionists, Open Peeps, Pixel Art, Identicon, Initials, Shapes, Rings, Thumbs, Icons, Glass*. CC BY 4.0 styles, which need attribution in the app, include *Adventurer, Big Smile, Micah, Miniavs, Personas, Croodles, Fun Emoji*. *Avataaars* and *Bottts* use custom "free for personal and commercial use" terms from their authors. Check the page before using any of them. None of them has a JDM look anyway, which supports the in-house choice.

---

## 5. Legal

> **Not legal advice.** This is an engineering outline. Before publishing on Play, have a Dominican lawyer (for Ley 172-13) review the final texts.

### 5.1 Documents needed
1. **Términos de uso** at `/terminos` (web plus in-app, versioned).
2. **Política de privacidad** at `/privacidad`. Play requires a public, active, non-geofenced URL linked in the store listing **and** inside the app (unverified (from knowledge)). An HTML page on Vercel is the safest format. Avoid PDFs.
3. **Eliminación de cuenta** at `/eliminar-cuenta`: a web page where someone can request deletion without the app installed, plus an in-app path (Settings → Cuenta → Eliminar cuenta). Play requires **both** for any app that lets users create an account (unverified (from knowledge), answer 13327111 could not be fetched). The web page must name the app and developer as they appear on Play, list the steps, say what gets deleted and what is kept and for how long.
4. **Prominent disclosure and consent screen** for background location (in-app, before the runtime prompt).
5. The Play Console **Data safety form** and the **location permissions declaration**, filled in the Console. They are not pages, but they must match the privacy policy.

### 5.2 Terms of Use outline (key clauses, es / en)
1. **Aceptación y versión / Acceptance & version.** "Al usar Car Guy aceptas estos términos (versión X, vigente desde …)." / "By using Car Guy you accept these terms (version X, effective …)."
2. **Descripción del servicio / Service.** A free personal tool, no ads. Features may change. No guaranteed availability.
3. **Cuenta opcional / Optional account.** Local use works without an account. The user is responsible for their credentials. Minimum age: **13+ with parental consent, or 18+ without** (recommendation: say "Debes tener al menos 18 años, o 13+ con autorización de tu padre, madre o tutor"). Car Guy is not directed at children.
4. **Seguridad al conducir / Driving safety.** "No manipules la app mientras conduces. El modo conducción está pensado para mirarse de reojo o por un acompañante. Cumple la Ley 63-17 de Movilidad y Tránsito." / "Do not interact with the app while driving…" (Ley 63-17 is the DR transit law; unverified (from knowledge) that it bans handheld phone use, so check the article).
5. **Exactitud de datos / Accuracy.** "**El velocímetro y odómetro por GPS son aproximados y no sustituyen los instrumentos del vehículo.** Los recordatorios de mantenimiento son orientativos; sigue el manual del fabricante." / "GPS speed and distance are estimates and do not replace the vehicle's instruments…". The same applies to fuel prices ("referenciales, fuente MICM") and cost statistics.
6. **Contenido del usuario / User content.** The user keeps ownership of photos, notes and feedback, and grants a limited licence to store, process and display them to whoever the user shares with (shared garage, public dossier). The user must not upload illegal content or other people's personal data without consent. A plate or VIN in a *public* dossier is the user's own choice and should come with a warning.
7. **Uso aceptable / Acceptable use.** No abuse, scraping or reverse engineering to attack the service.
8. **Terminación / Termination.** The user can delete their account at any time. The developer may suspend accounts for abuse. What happens to data on termination links to the privacy policy.
9. **Limitación de responsabilidad / Limitation of liability.** Provided "tal cual / as is". No liability for accidents, fines, mechanical damage, data loss (recommend backups/export), or decisions based on the app's estimates, to the maximum extent the law allows.
10. **APK fuera de Play / Sideloaded APK.** Download only from the official GitHub releases link. Unofficial copies are not our responsibility.
11. **Cambios / Changes.** Material changes are notified in the app and require re-acceptance.
12. **Ley aplicable / Governing law.** República Dominicana, courts of Santo Domingo. Include a contact email.

### 5.3 Privacy Policy outline
1. **Responsable / Controller.** Name (Xaviel Terrero, personal project) and a contact email.
2. **Datos que recopilamos / Data we collect**, as a table: *location* (precise, **including in the background** when automatic trips are on, used for trip detection, distance, routes); *vehicle data* (make, model, year, mileage, fuel logs, maintenance, costs; **plate and VIN optional**); *photos* (vehicle, receipts, documents, avatar); *account* (email, auth identifiers via Supabase Auth); *feedback* (message, optional screenshot, **device info**: model, OS version, app version, locale, and no advertising ID); *settings*. State what is **local only** (SQLite on the device) and what syncs when signed in.
3. **Finalidades y base / Purposes & legal basis.** Providing the service, and consent (location, photos, feedback). No sale of data, no ads, no profiling.
4. **Dónde se almacena / Where stored.** Supabase (Postgres plus a **private** Storage bucket; give the project **region**, e.g. us-east-1, and check it in the dashboard). The project is shared with other apps by the same developer; say that data is logically separated by RLS. Vercel hosts the web app and serverless functions (request logs include IP).
5. **Terceros / Third parties.** Supabase, Vercel, **OpenStreetMap / OpenFreeMap tile servers** (map tile requests expose IP and the approximate viewed area), **GitHub** (APK downloads expose IP to GitHub), Google Play (later). Link each provider's privacy policy.
6. **Retención / Retention.** Kept while the account is active. Deleted within N days (e.g. 30) of a deletion request. Backups roll off within Supabase's backup window (check your plan: typically 7 days daily backups, unverified). Feedback kept up to e.g. 24 months, anonymised on account deletion. Local data stays until the user uninstalls or uses "Borrar datos locales".
7. **Derechos / Rights (ARCO).** Acceso, rectificación, cancelación/supresión, oposición, plus portability via export. Explain how to exercise them (in the app plus email) and the response time.
8. **Ubicación en segundo plano / Background location** section: when it's collected, that it can be turned off in the app and in system settings, that a persistent notification shows while it runs, and that it's never shared.
9. **Seguridad / Security.** TLS, RLS, private bucket, signed URLs.
10. **Menores / Children.** Not directed at under-13s. Delete on notice.
11. **Transferencias internacionales / International transfers.** Servers outside the DR (USA/EU).
12. **Cambios y versión / Changes & version.**

**Prominent disclosure (Play; unverified (from knowledge), answer 9799150 not fetchable).** It must appear **inside the app, in normal use, before the runtime permission prompt**. It can't live only in the privacy policy or the ToS. It must describe the data (location), say that it's collected **in the background / when the app is closed or not in use**, explain the purpose, and require an affirmative action (the "Permitir" button; tapping elsewhere or backing out does not count as consent). The template Google gives is roughly: "*[App] collects location data to enable [feature], [feature] even when the app is closed or not in use.*" Spanish draft: "**Car Guy recopila datos de ubicación para detectar y registrar tus viajes automáticamente, incluso cuando la app está cerrada o no se está usando.** No compartimos tu ubicación con terceros. Puedes desactivarlo en cualquier momento en Ajustes." Buttons: "Permitir" / "Ahora no". Then request foreground permission, and after that background permission. On Android 11+ the background request sends the user to Settings, where they must choose "Permitir todo el tiempo" (expo-location docs confirm foreground must be granted first; verified). Play also requires a **permissions declaration** in the Console and a **short video** showing the disclosure and the feature. Background location must support a core feature; automatic trip logging should qualify, but review is strict. Keep a manual-trip mode so the app works without it.

**Data safety form (unverified (from knowledge)).** Declare: Location (approximate and precise), Photos, Personal info (email; plate/VIN may count as "Other info"), App info and performance (device info in feedback), user IDs. For each, declare whether it's collected or shared, whether it's optional, the purposes (app functionality), encryption in transit (yes), and that deletion can be requested (yes, with the URL). Library SDKs count too: `supabase-js` sending data to Supabase is "collection by you", not "sharing" (Google treats service providers as not sharing).

### 5.4 Account deletion (`/eliminar-cuenta`)
- In the app: Ajustes → Cuenta → "Eliminar cuenta" → confirmation (type ELIMINAR, or re-authenticate) → call a Supabase Edge Function / RPC running as `service_role` that deletes Storage objects under `{uid}/`, deletes rows (cascade from `profiles`), anonymises feedback, and calls `auth.admin.deleteUser(uid)`. Then offer "¿Borrar también los datos locales?".
- On the web: a page with the same steps, plus a form (email and a "confirm by magic link" step) for people who no longer have the app. It must state the data deleted, the data kept (e.g. anonymised feedback, legally required logs), and the timeframe.
- Play also lets you offer deleting *some* data without deleting the account. Photos-only and trips-only deletion are nice to have.

### 5.5 Acceptance record
```sql
create table legal_acceptance (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users on delete cascade,  -- null for anonymous (then local only)
  doc text check (doc in ('terms','privacy','bg_location')),
  version int not null, locale text not null, accepted_at timestamptz default now(),
  app_version text, platform text);
```
Keep a local copy in the settings table (`legal.terms_version`, `legal.privacy_version`, `legal.bg_location_consent_at`). Upload local rows on first sign-in. If `CURRENT_TERMS_VERSION > accepted`, show a blocking but minimal "Hemos actualizado los términos" sheet. Record the **withdrawal** of background-location consent too, as a row with `doc='bg_location'` and `version=0`.

### 5.6 Dominican law: Ley 172-13 (unverified (from knowledge))
Ley Orgánica 172-13 on the protection of personal data (2013) requires: **prior, informed, express consent** for processing (with exceptions such as contract performance); information about purpose, recipients and the controller's identity; the **ARCO rights** (acceso, rectificación, cancelación, oposición), with the law setting response deadlines; data quality and security; care with cross-border transfers; and extra protection for sensitive data. It also regulates credit bureaus (SIC), which doesn't apply here. Precise location and vehicle identifiers are personal data. Practical coverage: explicit consent checkboxes, the ARCO section with an email, export and deletion. GDPR and CCPA apply only if you target EU or California users. A free personal project likely falls under CCPA's thresholds (unverified). Writing the policy to GDPR-style standards covers Ley 172-13 as well.

**Age.** COPPA (US) applies to services directed at children under 13. State that the app is not directed at children and set a 13+ minimum (18+ recommended, given the driving context). In the Play Console target-audience section, pick 18+ (or 13+) so you avoid the Families policy.

---

## 6. Fuel prices in the DR (all unverified; micm.gob.do fetch blocked)

- **Source.** MICM sets and announces fuel prices every week, usually on **Friday afternoon**, valid **Saturday 00:00 to the following Friday**. Announcements appear as press releases/news posts on micm.gob.do and on MICM social media, often with an image or PDF table, e.g. "Precios de los combustibles para la semana del 27 de septiembre al 3 de octubre". From knowledge, there is **no official JSON API or RSS feed dedicated to prices**. The site has run on WordPress-style CMSs, so a `/feed/` or `/wp-json/wp/v2/posts?search=combustibles` endpoint might exist. Verify by hand, since it may be missing or blocked.
- **Official fuel names** (as MICM tables use them): Gasolina Premium, Gasolina Regular, Gasoil Óptimo, Gasoil Regular, Avtur, Kerosene, Fuel Oil #6, Fuel Oil 1%S, **Gas Licuado de Petróleo (GLP)**, **Gas Natural Vehicular (GNV)**. Units: RD$/galón for liquids and GLP, RD$/m³ for GNV. The app only needs the first four, plus GLP and GNV.
- **Vercel function design.** A scheduled function (Vercel Cron, e.g. `0 22 * * 5` and a retry `0 4 * * 6` in UTC, since DR is UTC-4) that: (1) fetches the MICM news listing, finds the newest post matching `/precios?.*combustibles/i`; (2) parses an HTML table if there is one, otherwise stores the post URL and flags "manual" (price tables are often images, so OCR would be fragile); (3) validates (six fuels present, values within ±15% of last week); (4) upserts into Supabase `fuel_price_week(week_start date, fuel_code text, price_dop numeric, source_url text, fetched_at, verified bool)`; (5) the app reads through a cached `GET /api/fuel-prices` with `Cache-Control: s-maxage=21600, stale-while-revalidate=604800`. **Always keep a manual admin override.** Scraping can break silently, so show "Precios de la semana del … (fuente MICM)" and allow the user to type a price when filling up. The price the user entered per fill-up always wins over the reference price.
- Check the MICM site terms and robots.txt before scraping. It's public government pricing information, but keep traffic to one request per week.

**Station brands for the picker** (from knowledge, unverified; could not fetch company sites): Texaco, Shell, Sunix, TotalEnergies (formerly Total), Isla (Isla Dominicana de Petróleo), Sigma, Nativa, Petronan, United Petroleum, Next, Gulf, Coastal, Ecopetróleo, Petromóvil, **Propagas** (GLP), **Tropigas** (GLP), Esso (historical: stations were rebranded, so offer it only for old records), and "Independiente / Otra". **Mostly GLP-only**: Propagas, Tropigas, plus many independent "envasadoras de GLP". Some fuel brands also sell GLP at certain stations. GNV is sold at a few dedicated stations (e.g. brands tied to natural-gas distributors). Store brands as a seed list with `seed_id`, a `fuels_offered` hint, and free text for anything else. Don't use brand logos in the picker; plain names are the trademark-safe choice.

---

## Sources

Fetched successfully:
- https://docs.expo.dev/guides/localization/ (libraries, getLocales, `locales` metadata, plugin `supportsRTL`/`forcesRTL`/`supportedLocales`, Android no-restart)
- https://docs.expo.dev/versions/v57.0.0/sdk/localization/ and /versions/latest/sdk/localization/ (Locale fields, useLocales, web nulls)
- https://docs.expo.dev/versions/v57.0.0/sdk/router/ (SuspenseFallback, asyncRoutes; expo-router ~57.0.24)
- https://docs.expo.dev/router/advanced/suspense/ (asyncRoutes production web-only)
- https://docs.expo.dev/router/advanced/protected/ (Stack.Protected; `redirectTo` SDK 58+)
- https://docs.expo.dev/versions/latest/sdk/location/ (background config plugin, foreground-first)
- https://docs.expo.dev/versions/latest/sdk/imagepicker/, /imagemanipulator/, /svg/, /linear-gradient/, /view-pager/
- https://registry.npmjs.org/ for i18n-js (4.5.3), react-i18next (17.0.15), @lingui/core (6.7.0), moti (0.30.0), react-native-skeleton-placeholder (5.2.4), react-native-copilot (3.3.3)
- https://github.com/nandorojo/moti, https://github.com/mohebifar/react-native-copilot

Attempted but blocked (content marked unverified): support.google.com/googleplay/android-developer/answer/9799150, /10144311, /13327111; developer.android.com/training/location/permissions; micm.gob.do and www.micm.gob.do; dicebear.com/licenses; docs.swmansion.com (useReducedMotion). The DiceBear GitHub LICENSE paths returned 404.
