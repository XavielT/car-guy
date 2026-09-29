# Project brief — IMP 29092026 · Car Guy 2.2 "Kaidō" (街道)

Third cycle on `github.com/XavielT/car-guy`. Written 2026-09-29, the same day v2.1.0 → v2.1.2
shipped. Xaviel installed 2.1.x on his phone, used it, and wrote nineteen notes. Every one of them is
mapped below; **none is left out and none waits on a decision** — where a choice was needed he
answered it (§2) or an ADR fixes the default (03-architecture-decisions.md).

## 1. Xaviel's note → where it lands

| # | Note (his words, condensed) | Prompt | What it becomes |
|---|---|---|---|
| 1 | Add what **Wheelz** has: automatic route tracking (knows when a drive starts), time, speeds, "all that stuff"; deep research; study the app | **05** (+ research 01, 04) | Block **VIAJES**: background auto-detect + manual, trip list/detail with SVG route, speed distribution, replay, share, Cifras block. Wheelz studied from its listing (04-wheelz-observed.md); the phone could not be opened from here — he was asked for screenshots |
| 2 | The **odometer on the home** can show the **real speed** while driving | **05** | The cluster on Inicio becomes the live view: needle = km/h, LCD = trip km, telltale = GPS |
| 3 | **Chequeo semanal**: photo of an issue, recorded in history; same when installing a **new part or mod** | **03** | Audit + extend: the failed-item photo already exists (one) → up to 5 photos on `falla` **and** `atencion`, shown in the inspection detail and in Historial; service records and mods already take photos → verify they appear in Historial and the album timeline; the "photo bug" fix in 01 makes all of it work on Android |
| 4 | **Carga parcial**: users don't always fill up; ask gauge level / reserva / km and calculate from that | **04** | Gauge picker (E…F eighths + "en reserva") before/after, estimated economy points with error band, reconciliation when a full tank closes the span (research 02) |
| 5 | **Historial de versiones** in the app (what's new / fixed per version) | **06** | Más → "Novedades y versiones": CHANGELOG.md compiled at build time, "Novedades" sheet once after an update |
| 6 | Users can send **bug reports / improvement comments** | **06** | Más → "Enviar comentario": table `carguy.feedback` on x-core (anon insert, admin read), device/app info attached, optional screenshot; admin list for Xaviel inside the app |
| 7 | The **launch icon animated**: 0 → 100 with the needle rising | **06** | JS splash overlay (Reanimated + SVG) that continues the static native splash; needle sweep + arc fill, ~900 ms, reduced-motion aware |
| 8 | **Price of mods** and things done to the car registrable; **car price** too (what it cost to own; when registering a car) | **03** (form) + **06** (Cifras) | Mods already carry cost (RD$/USD) — verified; purchase price exists but hidden behind "+ Compra" → promoted to the main form; new **"Lo que me ha costado"** card: compra + mods + mantenimiento + combustible + pista + otros, per vehicle and total |
| 9 | App not in the **portfolio** yet; old "Tu Combustible RD" there; make it accessible through that official channel | **00** (verify) + **07** | The portfolio repo already has the Car Guy card on `main` (commit `7a228f1`, 2026-09-29) — PROMPT-00 checks the **live** site; if the deploy did not happen, PROMPT-07 deploys it and points the APK button at the stable `car-guy.apk` asset |
| 10 | **More than one photo** when adding/editing a vehicle | **03** | Vehicle gallery in the form (multi-pick, reorder, choose cover); photos go to the album too |
| 11 | Fuel capacity in **liters or gallons**; **color picker** with preset options; **marca/modelo/año pickers** with search; **tipo** adds hatchback, wagon… | **03** | Unit toggle (stored canonical, shown as chosen), 18-colour swatch picker + interior colour, curated make/model JSON (~60 makes) with accent-insensitive search + "Otro", year wheel, body types list (sedán, hatchback, coupé, convertible, wagon, SUV/jeepeta, pickup/camioneta, minivan/guagua, van, camión, motor, buggy/UTV, otro) |
| 12 | **Error adding a photo** to a new car: `Context.renderAsync … JobCancellationException` | **01** (hotfix 2.1.3) | Known Android bug in expo-image-manipulator (expo/expo#50217): keep a strong reference to the context until `saveAsync` resolves, release in `finally`, retry once, `getPendingResultAsync` on mount, stable keys on the new-vehicle form |
| 13 | **"Iniciar sesión"** shows the env-var message; a normal user must not see those details; **configure the accounts** — he wants his account, and to share the app with friends | **01** (hotfix 2.1.3) | `EXPO_PUBLIC_SUPABASE_*` into EAS env (preview + production) and `eas.json` `env`; build guard that refuses a release APK without them; the user-facing message becomes "La cuenta no está disponible en esta versión. Actualiza la app." with the version, and the technical hint only in `__DEV__`/an admin toggle |
| 14 | **Garage view** shows the photo of only one vehicle; let the user **organise** how it looks | **06** | Garaje v2: every card carries its cover photo; view modes (lista · cuadrícula · portada grande); drag-and-drop order (persisted in `setting.garage_layout`); pinned car first |
| 15 | The C3 is "Guardado" but not by choice — accident, waiting for parts; **more tags/statuses** | **02** (schema) + **03** (form) | Statuses: `activo`, `proyecto`, `en_taller` (En reparación), `accidentado` (Accidentado · esperando piezas), `guardado`, `restauracion`, `prestado`, `vendido`, `perdido`; each with a **note** and a **since** date shown on the card ("ACCIDENTADO · desde 12 ago · esperando piezas") |
| 16 | **Aceite** types as selectable options | **03** | Oil picker in the service form for `aceite_motor`: viscosity (0W-16 … 20W-50), type (mineral/semisintético/sintético), spec (API/ILSAC/ACEA), brand list; stored as structured columns + rendered text |
| 17 | The **web page must offer the APK** download without leaving to the portfolio | **07** | `api/apk.ts` (cached GitHub `releases/latest`), "Descargar APK" button on Android browsers (and a small "Instalar" page with the unknown-sources steps), stable asset name `car-guy.apk` from 2.1.3 on |
| 18 | The folder on the laptop is still `tu-gasolina-rd` (carried from last cycle) | **00** | Manual step, first line of the checklist; PROMPT-00 detects which path it is running in |
| 19 | (implicit in 1) "learn how and where to apply it in the car guy app" | 02-specs/03-screens.md | Trips live in a **Viajes** tab replacing nothing: Inicio (live), a `Viajes` entry in the vehicle hub, Historial rows, Cifras block; odometer readings suggested from trips |

## 2. Answers Xaviel gave (2026-09-29)

- **Trips:** automatic like Wheelz **and** manual, both available at the same time.
- **Wheelz screenshots:** he will send them; none had arrived when this package was written (04-wheelz-observed.md has the listing).
- **Feedback channel:** table in Supabase + panel in Más.
- **Partial fills:** gauge level before/after (eighths) + "en reserva".
- **Portfolio:** `/home/xaviel/dev2/xaviel-web-v2` (Angular 21, Vercel, `apps` array in `src/app/pages/home/home.ts`, `AppCard` with `url` + `apkUrl`, i18n keys in `shared/i18n/es.ts`/`en.ts`).
- **APK hosting:** GitHub Releases + a "Descargar APK" button on the web.
- **Accounts config:** EAS environment variables (+ `eas.json` `env`, public values).
- Chrome for research: Browser 1 (Linux). Web search is still disabled at the org level (403) — WebFetch works.

## 3. State when this cycle starts (details in 02-state-of-the-repo.md)

v2.1.2 on `main`, released 2026-09-29 with GitHub releases v2.1.0/1/2 (universal APKs), web on
`car-guy.vercel.app` with Supabase env set, cloud `carguy` schema at `sql/017`, local migrations
**v5**, 826 tests, patch-package patches for expo metro-config and react-native-svg. Xaviel's phone
runs 2.1.2 with his real garage and is signed in. The APK on GitHub was built without the Supabase
variables (note 13).

## 4. Goals

- **G1 — Nothing broken for real users.** 2.1.3 hotfix in the first session: photos work on
  Android, sign-in works from the GitHub APK, no developer text in user-facing errors.
- **G2 — Viajes.** A drive is recorded without touching the phone, survives the app being in the
  background, ends only when the car really stopped, and shows route + speeds the same day.
- **G3 — Registering a car is fast.** Pickers everywhere a list is better than typing; several
  photos; a status that says the truth about the C3.
- **G4 — Fuel numbers even without full tanks.**
- **G5 — The app talks back.** Versions history, feedback inbox, animated launch.
- **G6 — Distribution.** APK from the web itself; portfolio verified; release 2.2.0.

## 5. Phase order (fixed by risk and value)

**01 hotfix → 02 schema v6 → 03 vehicle/service forms → 04 fuel → 05 viajes → 06 garage/splash/
versions/feedback/costs → 07 web APK + release 2.2.0.** Phase 05 is the largest and is written so
that a session can stop after its part A (manual trips + live speed) and resume with part B
(automatic detection) — both parts have their own acceptance criteria.

## 6. Definition of done (the cycle)

- 2.1.3 on GitHub within the first session; Xaviel signed in from **that** APK.
- 2.2.0 on GitHub with `car-guy.apk` as the stable asset name; web deployed with the APK button;
  the portfolio card verified live.
- Every note above has a ✅ in `04-tracking/PROGRESS.md` with the phase that closed it.
- `npm test` green (target ≥ 900), `tsc`/lint clean, `verify-x-core` + `verify-sync` green with the
  new tables, local-rls green, `smoke-public-page` 6/6, `smoke-apk` (new) 3/3.
- Nothing in Music Hub changed (ADR-06); no `.env*` committed; seeds without real plate/VIN/phone.
