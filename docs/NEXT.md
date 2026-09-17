# Next up — Tu Combustible RD

Written 2026-09-11. Everything below is the only outstanding work; the rest of
the session shipped and is verified live.

## 1. Build a new APK with the new icon  ← the actual pending task

**Update 2026-09-17:** a fixed **v1.1.1 / versionCode 3** APK was built locally and installed on
Xaviel's phone to rescue his data (see `docs/imp-17092026/04-tracking/PROGRESS.md` → "Phase 0
addendum"). It carries the new icon *and* the Android backup fix. It has **not** been published —
the GitHub release is still v1.1.0 with the old icon. Publishing it is a one-command step:

```bash
gh release create v1.1.1 --title "Tu Combustible RD v1.1.1" --notes "..." \
  android/app/build/outputs/apk/release/app-release.apk#tu-combustible-rd-v1.1.1.apk
```

Two corrections to what this file used to say:

- The APK attached to v1.1.0 was assumed to predate the backup feature. It does **not** — unpacking
  its Hermes bundle finds `Crear respaldo JSON` and `exportBackup`. It does still carry the old
  default icon, so the rebuild was needed regardless.
- The build recipe below works as written. `expo prebuild --platform android --clean` regenerates
  `android/app/debug.keystore` **identically**, so a rebuild installs over an existing install with
  `adb install -r` and keeps its data. Verified with `apksigner verify --print-certs`: both the
  shipped APK and the rebuild are cert `fac61745…`. Export `ANDROID_HOME=$HOME/Android/Sdk` first;
  the build takes about 10 minutes.

The native `android/` folder is gitignored and holds a stale prebuild, so regenerate it rather than
reusing it:

```bash
cd /home/xaviel/dev2/tu-gasolina-rd
export ANDROID_HOME=$HOME/Android/Sdk
npx expo prebuild --platform android --clean   # picks up the new adaptive icons
cd android && ./gradlew assembleRelease
# -> android/app/build/outputs/apk/release/app-release.apk
```

`app.json` is now at `version: 1.1.1`, `versionCode: 3`.

The portfolio card points at `releases/latest`, so **no site change is needed** — the new release is
picked up automatically.

Sanity check after installing: launcher icon, the themed (monochrome) icon on Android 13+, and the
splash.

### Watch out

- **Verify the adaptive icon on a real launcher.** Android shows only a 66dp circle of the 108dp
  foreground. `tools/make-icons.mjs` scales the mark to 0.78 for exactly this reason — at full size
  the ends of the gauge sweep get sliced off. If a rebuild ever looks cropped, that constant is why.
- `expo-sqlite` is still a dependency and an `app.json` plugin but is **never imported** anywhere.
  Dead weight today; Car Guy starts using it in PROMPT-02, so leave it.

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
