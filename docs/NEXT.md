# Next up — Tu Combustible RD

Written 2026-09-11. Everything below is the only outstanding work; the rest of
the session shipped and is verified live.

## 1. ~~Build a new APK with the new icon~~ — DONE (2026-09-17)

Released as **v1.1.1 / versionCode 3**:
<https://github.com/XavielT/tu-combustible-rd/releases/tag/v1.1.1> (`releases/latest` points at it,
so the portfolio card picked it up with no site change). It carries the new icon **and** the Android
backup fix (`lib/backup.ts` was passing a `content://` URI to `expo-sharing`, which only accepts
`file://`). Installed on Xaviel's phone over v1.1.0 — same signing key, data intact.

Two things this file used to get wrong:

- The v1.1.0 APK was assumed to predate the backup feature. It did **not** — its Hermes bundle
  contains `Crear respaldo JSON` and `exportBackup`. It did still carry Expo's default icon.
- The build recipe works as written, with two additions: export `ANDROID_HOME=$HOME/Android/Sdk`
  first, and pass `-PreactNativeArchitectures=arm64-v8a` — without it the APK ships all four ABIs
  and weighs 105 MB instead of 44 MB. `expo prebuild --clean` regenerates
  `android/app/debug.keystore` **identically** (cert `fac61745…` both before and after), which is
  why `adb install -r` upgrades in place without wiping data.

```bash
cd /home/xaviel/dev2/tu-gasolina-rd
export ANDROID_HOME=$HOME/Android/Sdk
npx expo prebuild --platform android --clean
cd android && ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a
# -> android/app/build/outputs/apk/release/app-release.apk  (~44 MB)
```

`app.json` is at `version: 1.1.1`, `versionCode: 3`. Car Guy (PROMPT-01) moves to `2.0.0` /
`versionCode 1` under the new package `com.xaviel.carguy`, so this counter stops here.

## 2. Optional, not blocking

- **Portfolio itself is not a PWA.** Both apps it links to are; the site has no
  manifest, no service worker, only favicons. Music Hub's setup
  (`ngsw-config.json` + `public/manifest.webmanifest` + `public/icons/`) is the
  template to lift, and the site is Angular too, so it transfers directly.
- **`imp-11092026/phase-0-discovery` branch** on the site repo carries a
  duplicate of the app-card commit (it was cherry-picked to `main` as
  `3c3ccc4`), so merging it would be messy. It is only useful as the home of
  `docs/imp-11092026/01-discovery/INVENTORY.md`.
- **Open questions in that inventory**, both only relevant if the app ever gets
  cloud sync: whether the shared **x-core** Supabase project should back this app
  (note prod and dev are the same project), and that entities have **no
  `updatedAt`** and IDs are **not always UUIDs** — `lib/format.ts` falls back to
  `id_<ts>_<rand>` where `crypto.randomUUID` is missing, which a Postgres `uuid`
  column would reject.

## Where things stand

| | |
|---|---|
| Web app | https://tu-combustible-rd.vercel.app — installable PWA |
| Android | v1.1.0 APK on GitHub releases — **old icon** |
| Portfolio card | live, both buttons working, links to `releases/latest` |
| Repos | `tu-combustible-rd` and `xaviel-web-v2` both clean and pushed |
| Deploys | Vercel, Git-connected; a push to `main` deploys |

Regenerating icons: `npm i --no-save sharp && node tools/make-icons.mjs`
(sharp is deliberately not a dependency).
