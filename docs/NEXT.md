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
| Cloud | Supabase `x-core`, schema `carguy`, 19 tables, 76 RLS policies, private `carguy-media` bucket |
| Local folder | Still `~/dev2/tu-gasolina-rd` — rename it when no session is open |

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

- PDF documents are not wired into the documents screen.
- Search: free text still folds ASCII only ("optimo" will not find a note saying "Óptimo"; fuel
  names are matched accent-insensitively since 2026-09-25). Needs an ICU build of SQLite.
- Cosmetic, from the QA pass: same-day Historial entries list oldest first (needs `created_at` in
  the `history_feed` view — a migration), the Cifras y-axis starts at 1, a Cifras tab label
  truncates at 320 px, and screens have no maximum width on desktop.

**Dependencies and noise:**

- 22 npm audit findings (15 moderate, 7 high), all transitive. Untouched all cycle — worth one pass.
- `npx expo-doctor` reports 15 packages a few patch versions behind SDK 57 (e.g. expo 57.0.14 →
  57.0.25, react-native 0.86.2 → 0.86.3). Updating needs a retest on the phone.
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
