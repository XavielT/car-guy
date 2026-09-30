# Next up — Car Guy

Written 2026-09-18, at the end of the IMP 17092026 cycle. What Tu Combustible RD's version of this
file used to say is done and gone; its release recipe is kept below because the local Android build
still works that way.

Full history and per-phase detail: [`imp-17092026/04-tracking/PROGRESS.md`](imp-17092026/04-tracking/PROGRESS.md).

## Cycle 4 — IMP 30092026 (Car Guy 2.4 "Tōge") — started 2026-09-30

Seventeen notes from Xaviel's use of 2.2/2.3 → fix pack 2.3.1 (fill-up detail + no duplicates, stations,
reserve light, "≈ por echada", routes that keep their points), then es/en + skeletons, MapLibre + Modo
conducir behind a centre button, the car's memory (events, "lo que uso", tires, fuel prices + MICM), profile /
welcome / legal → 2.4.0. Package: [`imp-30092026/`](imp-30092026/README.md), log:
[`imp-30092026/04-tracking/PROGRESS.md`](imp-30092026/04-tracking/PROGRESS.md).

## Cycle 3 — IMP 29092026 (Car Guy 2.2 "Kaidō") — released 2026-09-30

From v2.1.2: nineteen notes from Xaviel's use of 2.1.x → hotfix 2.1.3, schema v6 (liters canonical),
forms v2, partial fills with gauge estimates, Viajes (manual + automatic, live speed cluster), Garaje v2,
animated launch, Novedades y versiones, Enviar comentario + admin inbox (sql/021), "Lo que me ha
costado", /instalar + /api/apk. Package: [`imp-29092026/`](imp-29092026/README.md), log:
[`imp-29092026/04-tracking/PROGRESS.md`](imp-29092026/04-tracking/PROGRESS.md).

### Carried to the next cycle
- **Xaviel's real drive** with Automático (traffic lights, km vs odometer, battery). 2.2.1 already drops
  out-and-back excursions from saved tracks (the mock-run artifact); the drive tells whether more is needed.
- Roles since 2.3.0 (sql/024): admin (Xaviel's Car Guy account), member, premium (placeholder — no payments
  yet). The admin panel and the comments inbox follow the role; a future membership only needs to set
  'premium' and gate features on `useRole()`.
- The map uses OpenStreetMap's standard tiles (Xaviel's choice, 2026-09-30) under their usage policy. If
  Car Guy ever has many users, move to a tile host with an SLA (MapTiler, Stadia, or self-hosted).
- Play Store: not now (Xaviel's call).

Done in 2.2.3 (2026-09-30): L/100 km per vehicle; brace-expansion 5.0.12 (high advisory). Done in 2.2.2 (2026-09-30): OpenStreetMap under each trip + the "por dónde manejas" heatmap; drag to
reorder in Ordenar (phone); MIUI autostart state via a local Expo module (app-op 10008 — AppOpsUtils is
absent on MIUI 14). Done in 2.2.1 (2026-09-30): excursion filter for saved tracks; public page status + "lo que me ha costado"
(sql/022, the phone publishes its figure); inventory `used_in_mod_id` (sql/023). The economy whisker and
the tank-capacity hint were already in 2.2.0.

## Where things stand

| | |
|---|---|
| Web app | <https://car-guy.vercel.app> — live, installable PWA, Vercel project `car-guy` |
| Old web app | <https://tu-combustible-rd.vercel.app> — still up, still git-connected to this repo, so it also serves Car Guy. Delete the project when you are ready |
| Repo | <https://github.com/XavielT/car-guy> (renamed from `tu-combustible-rd`; GitHub keeps redirects) |
| Android | **2.3.0 released** (2026-09-30) — GitHub release `v2.3.0` with `car-guy.apk` (stable name, always the latest: `…/releases/latest/download/car-guy.apk`) and `car-guy-v2.3.0.apk`; the web page car-guy.vercel.app/instalar offers it on Android (`/api/apk`); EAS project `@xavieldev/car-guy`, EAS-managed keystore. Release with `bash tools/release-apk.sh --publish` |
| Cloud in the APK | Until 2.1.2 the APKs had **no** Supabase values (EAS packs by .gitignore, so `.env.local` never reached a build) — Cuenta said "no configurada". Since 2.1.3: `eas.json` `build.base.env` carries the two public values (URL + anon key — public by design, RLS protects the data; no service-role key anywhere), the EAS environments `preview`/`production` carry them too (`eas env:list production`), `app.config.js` refuses an EAS release build without them, and `tools/check-bundle-env.mjs` refuses an APK whose bundle lacks the project URL (the release script runs it) |
| Distribution | **Xaviel's own channels only:** the portfolio card (links `releases/latest`, so every release reaches it with no change there), the web app and the direct APK link. **No Play Store for now** — Xaviel's call (2026-09-29): the app is not ready for it yet; it is a future step |
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
4. **Play Store — future, not now** (Xaviel, 2026-09-29): when the app is ready, a Play Console account
   and a listing; upload the production AAB (`eas submit` can do it). The package is `com.xaviel.carguy`.
5. Optional: revoke the Expo token on expo.dev when builds are done for a while.

## 2. Hand-off to xaviel-web

**Done 2026-09-29:** the card on https://xaviel-web-v2.vercel.app now shows Car Guy 2.1 (xaviel-web-v2 `main`
`7a228f1`, literal English as that branch has it), and the same change sits on `imp-11092026/phase-3-admin-shell`
(`2e3057a`, es + en keys `app.carGuy.description`) so that cycle's merge keeps it. Icon:
`public/assets/apps-imgs/car-guy.png` (256 px, from `assets/images/icon.png`). What the card carries:

| Field | New value |
|---|---|
| Name | Car Guy |
| Tagline | Tu carro, al día. Con historia. |
| Description | Mantenimiento, chequeos, combustible, álbum, build, pista y ficha pública de tus vehículos. Local-first, con cuenta opcional. |
| Web URL | `https://car-guy.vercel.app` |
| Release link | `https://github.com/XavielT/car-guy/releases/latest` |
| Screenshots | `docs/qa/imp-28092026-phase-6-*`, `-phase-7-public-page-local.png`, `-phase-8-android-inicio.png` (2.1, dark) |
| Public page example | ask Xaviel for a live `/c/<slug>` (his car); there is no permanent demo link |

The card's release link is `releases/latest`, so each new GitHub release reaches the portfolio with no
change in xaviel-web (checked with v2.1.2: it redirects to `tag/v2.1.2`).

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

**Closed in 2.1.1 (branch `fix/2.1.1-backlog`):** accent-insensitive search in Historial and OBD codes
(folded in JS — no ICU needed); same-day Historial order (was already newest first since the v2 view; now
tested); a shared car's custom venues and mod categories readable by its members (sql/015), and
its custom service types and check templates (sql/016) — seeded rows excluded, so a member keeps its own copy.

**Closed in 2.1.2:** expo 57.0.26 with `patches/@expo+metro-config+57.0.12.patch` (lazy dev bundles have no
worker module in the graph yet — the new "workers always get a chunk" assert fired on it); `npm audit` 18 → 3
moderate (`overrides` for `xcode → uuid@^11.1.1`; the 3 left are `decode-uri-component` under expo-router's
`query-string`, whose fixed 0.5 is ESM-only and cannot be required by it); chart warnings on web
(`patches/react-native-svg+15.15.4.patch`: onPress → onClick, touch-only props kept off the DOM); per-session
heat cycles; best laps per venue + layout (migration v5, sql/017); members read a shared car's custom service
types and check templates (sql/016). Patches apply on `postinstall` (patch-package) — re-check them on any
bump of those two packages.

**Carried:**

- `decode-uri-component` ≤ 0.4.2 (3 moderate audit findings) until expo-router moves off query-string 7.



**Dependencies and noise:**


**Known and accepted:**

- **Two Car Guy tabs cannot share the database.** OPFS allows one sync access handle per file. The
  app now detects it, reloads up to three times, and then says so in Spanish
  (`components/BootError.tsx`). Not fixable here.
- A sync conflict resolves silently by last-write-wins, with nothing shown. Intended; revisit only
  if someone reports losing an edit.
- Every Car Guy signup also gets a `public.profiles` row, created by Music Hub's `handle_new_user`
  trigger on `auth.users`. Harmless and left alone per ADR-06.
- The password-reset email uses x-core's project-level template, shared with Music Hub (Supabase's
  generic English "Reset your password"). Changing it would change Music Hub's email. Since 2.1.3 the
  link itself comes back to Car Guy (`carguy://nueva-contrasena` / `<origin>/nueva-contrasena`, both in
  x-core's redirect allow list; the Site URL is still Music Hub's).
- **Car Guy accounts are Car Guy's own** (2.1.3, sql/018): only an account that signed up from Car Guy
  (it has a `carguy.profiles` row) signs in or reads anything; a Music Hub account is refused even with
  the right password. One email = one x-core account, so an address already used in Music Hub cannot
  become a Car Guy account. **Still open:** a Car Guy account can sign in to Music Hub — that check
  belongs in the Music Hub repo.
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
