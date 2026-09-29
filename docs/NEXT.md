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
| Android | **2.0.0 released** — GitHub release `v2.0.0` with the APK; EAS project `@xavieldev/car-guy`, EAS-managed keystore; production AAB built for the Play Store |
| Cloud | Supabase `x-core`, schema `carguy`: v1 tables (19, incl. cloud-only `profiles`) + **schema v2** (`sql/009`–`010`, 23 more, applied 2026-09-28), private `carguy-media` bucket. **A 2.0.0 install signed in to sync cannot pull `vehicle`/`media`/`service_record` any more** (new columns) — ship 2.1 before anyone syncs on 2.0.0 |
| Local folder | `~/dev2/car-guy`. **Rename pending** (2026-09-28): on this laptop it is still `~/dev2/tu-gasolina-rd` — run `mv ~/dev2/tu-gasolina-rd ~/dev2/car-guy` with no Claude session open there |

## 1. Done for 2.0.0 (2026-09-25)

- **Android:** EAS works through a token in the gitignored `.env.expo.local` (browser login cannot
  complete from Claude Code). Load it with `set -a; . ./.env.expo.local; set +a`, then
  `npx eas-cli@24.8.0 build --platform android --profile preview --local --non-interactive`
  (no cloud queue; same EAS key). The keystore is EAS-managed.
- **Phone:** verified on a Redmi Note 10 Pro (Android 13) — install, name/icon (themed monochrome
  layer present)/splash, notifications incl. cold-start taps, camera, PDF share, date picker,
  keyboard, Back from deep links. Details in PROGRESS.md.
- **Sync:** acceptance run a–e passed between two independent browser profiles (throwaway
  account); eight data-loss bugs found and fixed on the way. Contract: `node tools/verify-sync.mjs`
  14/14.
- **QA pass:** three testers + the phone, ~27 issues fixed. See PROGRESS.md "QA pass".

### Still yours

1. **Back up the EAS keystore off this machine:** in a normal terminal,
   `npx eas-cli@24.8.0 credentials --platform android` → production → *Download existing
   keystore*. Keep the file and its passwords somewhere safe. Every future Play Store update must be
   signed with it.
2. **Sign in to Music Hub once** and confirm it behaves as before (the invite-only refusal is
   already covered by `verify-x-core.mjs`).
3. **Sync on your own phone:** create your account in the app (Más → Cuenta) — your garage uploads
   on the first sync. It has only ever been exercised on the web and with throwaway accounts.
4. **Play Store** (when you want it): a Play Console account and a listing; upload the production
   AAB (`eas submit` can do it). The package is `com.xaviel.carguy`.
5. Optional: revoke the Expo token on expo.dev when builds are done for a while.

## 2. Hand-off to xaviel-web

`imp-11092026` Phase 4 integrates the portfolio card. Updated for **2.1.0 "Hachi-Gō"** (2026-09-29):

| Field | New value |
|---|---|
| Name | Car Guy |
| Tagline | Tu carro, al día. Con historia. |
| Description | Mantenimiento, chequeos, combustible, álbum, build, pista y ficha pública de tus vehículos. Local-first, con cuenta opcional. |
| Web URL | `https://car-guy.vercel.app` |
| Release link | `https://github.com/XavielT/car-guy/releases/latest` |
| Screenshots | `docs/qa/imp-28092026-phase-6-*`, `-phase-7-public-page-local.png`, `-phase-8-android-inicio.png` (2.1, dark) |
| Public page example | ask Xaviel for a live `/c/<slug>` (his car); there is no permanent demo link |

The old release link keeps working through GitHub's redirect, so nothing is broken in the meantime —
but `releases/latest` will point at Car Guy v2.0.0 as soon as it ships, under a card that still says
Tu Combustible RD.

### Vercel environment (set 2026-09-29, IMP 28092026 Phase 8)

The `car-guy` project had no Supabase variables until then, so the production **web** build ran with the
cloud off and `api/c/[slug]` answered 502 (`X-Car-Guy-Error: missing-env`). Now set for Production and
Preview (values from `.env.local`; the anon key is public by design — no service-role key in Vercel):
`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` (web build, inlined), `SUPABASE_URL`,
`SUPABASE_ANON_KEY` (the function, runtime). Check: `node tools/smoke-public-page.mjs`.

## 3. Worth doing, not blocking

**Closed in 2.1 (IMP 28092026 Phase 8):** PDF documents in the documents screen; the Cifras y-axis
starting at 1 (explicit labels now); the 320 px tab label (fixed in Phase 2); desktop max width
(a 560 px column on web ≥ 900 px).

**Carried:**

- Search: free text still folds ASCII only ("optimo" will not find a note saying "Óptimo"; fuel
  names are matched accent-insensitively since 2026-09-25). Needs an ICU build of SQLite.
- Same-day Historial entries list oldest first (needs `created_at` in the `history_feed` view —
  a migration).
- Shared garage: another member's custom venues, mod categories and service types are not shared
  (they are per-user catalogues), so those names show as "Sin pista"/"Otro" on the member's phone.
- Heat cycles count once per tire per event; best laps are per venue (no layout on the event).

**Dependencies and noise:**

- **The SDK 57 patch bumps break the web dev server.** `npx expo install --fix` (expo 57.0.14 →
  57.0.25, @expo/metro-config 57.0.12) makes every web bundle fail with "Worker chunk not found for
  expo-sqlite/web/worker.ts" (serializeChunks.js). `npm audit fix` pulls the same expo inside the
  `~57.0.14` range, so it breaks it too. Both reverted on 2026-09-29; keep the lockfile as is and
  retry with the next expo patch (check `npx expo start --web` serves `/` before committing).
- 18 npm audit findings (16 moderate, 2 high), all transitive; the non-forced fix is blocked by
  the item above.
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
- `seedCatalog()` reads the catalogue at every launch but writes only rows that changed (since
  2026-09-25 — unconditional upserts used to overwrite other devices' edits through sync).

## Handy

```bash
npm start                # dev
npm test                 # 820 tests
npx tsc --noEmit
npx expo lint
npm run build            # static web export to dist/
node tools/verify-x-core.mjs        # cloud schema, RLS, public page, shared garage — 23 checks
node tools/verify-sync.mjs          # sync protocol against the live schema, 17 checks
node tools/cleanup-probe-media.mjs  # sweep test objects from the Storage bucket
```

Regenerating icons: `npm i --no-save sharp && node tools/make-icons.mjs` (sharp is deliberately not
a dependency).
