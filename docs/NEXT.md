# Next up — Car Guy

Written 2026-09-18, at the end of the IMP 17092026 cycle. What Tu Combustible RD's version of this
file used to say is done and gone; its release recipe is kept below because the local Android build
still works that way.

Full history and per-phase detail: [`imp-17092026/04-tracking/PROGRESS.md`](imp-17092026/04-tracking/PROGRESS.md).

## Where things stand

| | |
|---|---|
| Web app | <https://car-guy.vercel.app> — live, installable PWA, Vercel project `car-guy` |
| Old web app | <https://tu-combustible-rd.vercel.app> — still up, still git-connected to this repo, so it also serves Car Guy. Delete the project when you are ready |
| Repo | <https://github.com/XavielT/car-guy> (renamed from `tu-combustible-rd`; GitHub keeps redirects) |
| Android | **Nothing built for 2.0.0 yet.** v1.1.1 of Tu Combustible RD is still the latest release |
| Cloud | Supabase `x-core`, schema `carguy`, 19 tables, 76 RLS policies, private `carguy-media` bucket |
| Local folder | Still `~/dev2/tu-gasolina-rd` — rename it when no session is open |

## 1. Blocking the 2.0.0 release

### Android build — needs you at the keyboard

Not started: `eas` is not logged in on this machine and `app.json` has no `extra.eas.projectId`.

```bash
npx eas-cli@latest login
npx eas-cli@latest init          # writes extra.eas.projectId
npx eas-cli@latest build --platform android --profile preview      # APK
npx eas-cli@latest build --platform android --profile production   # AAB
```

`eas.json` is already correct (`appVersionSource: remote`, `preview` → apk, `production` →
app-bundle, auto-increment). EAS holds the keystore remotely, which is the safer option — the
package `com.xaviel.carguy` is new, so this is a **new keystore** and losing it means no update is
ever accepted as the same app again.

Local build instead, if preferred (this recipe is proven, from the v1.1.1 release):

```bash
export ANDROID_HOME=$HOME/Android/Sdk
npx expo prebuild --platform android --clean
cd android && ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a
# -> android/app/build/outputs/apk/release/app-release.apk  (~44 MB; all four ABIs is 105 MB)
```

Save that keystore to `~/keystores/car-guy/` and back it up off the machine.

### On a real phone

No device and no emulator has ever run this app — carried every phase since 5. Everything below is
unexercised on Android:

- Notifications outside Expo Go (channel, scheduling, tapping through to a screen)
- Camera capture and the photo compression path
- The PDF report: `printToFileAsync` → `shareAsync` — the one path web cannot check at all
- Native date picker, haptics on save, one-thumb reach in the chequeo runner
- `lib/sync/mediaBytes.ts`'s `expo-file-system` branch — the least-tested code in the repo
- The AsyncStorage session adapter in `lib/cloud/supabase.ts`

### Sync acceptance run (PROMPT-09 a–e)

The engine is built, verified 13/13 against the live schema, and turned on — but **no row has ever
crossed between two devices.** The run needs an account created and a password typed, which the
assistant may not do. Two devices stage in a minute:

```bash
npm run build
node <scratch>/serve.mjs "$PWD/dist" 4300 &   # device A
node <scratch>/serve.mjs "$PWD/dist" 4301 &   # device B
```

Two ports are two origins are two independent OPFS databases. Sign in on A, then B, and walk a–e
from the prompt.

### GitHub release and tag

Once the APK exists:

```bash
gh release create v2.0.0 --title "Car Guy v2.0.0" --notes-file CHANGELOG.md \
  <apk>#car-guy-v2.0.0.apk
```

Leave v1.1.0 and v1.1.1 alone. Tag `v2.0.0` on `main`.

## 2. Hand-off to xaviel-web

`imp-11092026` Phase 4 integrates the portfolio card. It currently describes **Tu Combustible RD**
and needs:

| Field | New value |
|---|---|
| Name | Car Guy |
| Tagline | Tu carro, al día. |
| Description | Mantenimiento, chequeos, combustible e historial de vehículos. Local-first, con cuenta opcional. |
| Web URL | `https://car-guy.vercel.app` |
| Release link | `https://github.com/XavielT/car-guy/releases/latest` |
| Screenshots | Re-shoot: the app is dark-first now and the old ones are the fuel-only UI |

The old release link keeps working through GitHub's redirect, so nothing is broken in the meantime —
but `releases/latest` will point at Car Guy v2.0.0 as soon as it ships, under a card that still says
Tu Combustible RD.

## 3. Worth doing, not blocking

**Carried several phases, each small:**

- Inicio's "Pendientes" shows reminders but not open tasks (since Phase 4).
- `servicio/[id]` has no edit form; editing a saved record cannot re-run reminder resets safely.
- PDF documents are not wired into the documents screen.
- Search: `LIKE … COLLATE NOCASE` folds ASCII only, so "optimo" will not find "Óptimo". Needs an ICU
  build of SQLite.

**Dependencies and noise:**

- 22 npm audit findings (15 moderate, 7 high), all transitive. Untouched all cycle — worth one pass.
- `npx expo install --check` reports nine packages behind their SDK 57 targets.
- `react-native-gifted-charts` spreads React Native responder props onto DOM nodes, so the web dev
  console logs seven "Unknown event handler property" warnings per chart render. Cosmetic, dev-only.

**Known and accepted:**

- **Two Car Guy tabs cannot share the database.** OPFS allows one sync access handle per file. The
  app now detects it, reloads up to three times, and then says so in Spanish
  (`components/BootError.tsx`). Not fixable here.
- A sync conflict resolves silently by last-write-wins, with nothing shown. Intended; revisit only
  if someone reports losing an edit.
- Every Car Guy signup also gets a `public.profiles` row, created by Music Hub's `handle_new_user`
  trigger on `auth.users`. Harmless and left alone per ADR-06.
- The password-reset email uses x-core's project-level template, shared with Music Hub. Changing it
  would change Music Hub's email.
- `seedCatalog()` runs ~73 upserts on every launch. Idempotent and fast; could check a version
  marker.

## Handy

```bash
npm start                # dev
npm test                 # 332 tests
npx tsc --noEmit
npx expo lint
npm run build            # static web export to dist/
node tools/verify-x-core.mjs        # cloud schema, 7 checks
node tools/verify-sync.mjs          # sync protocol against the live schema, 13 checks
node tools/cleanup-probe-media.mjs  # sweep test objects from the Storage bucket
```

Regenerating icons: `npm i --no-save sharp && node tools/make-icons.mjs` (sharp is deliberately not
a dependency).
