# Project Brief — IMP 17092026 · Tu Combustible RD → **Car Guy**

Written 2026-09-17 from Xaviel's notes, a read-only audit of `/home/xaviel/dev2/tu-gasolina-rd`, the
research in `01-research/`, and the decisions Xaviel confirmed the same day.

## What happened and why this exists

Xaviel skipped his fluid check for a few days, did not notice the coolant was low, and the engine
overheated. His words: *"eso fue un descuido mío y por no tener esa costumbre diaria"*. The fix is
not a fuel app with one more tab — it is an app whose job is to make vehicle care a habit and to
keep the whole life of the vehicle in one place.

**Tu Combustible RD** (fuel log for the Dominican Republic) becomes **Car Guy**: an app to manage one
or several vehicles — maintenance, daily/weekly inspections, fuel, upgrades, repairs, everything
about the vehicle — producing a full history per vehicle with statistics.

## Xaviel's notes → where each one lands

Every note is covered by at least one prompt. Nothing is dropped, nothing waits on a pending
decision (defaults are recorded in `03-architecture-decisions.md`).

| # | Note (his words, condensed) | Where it lands |
|---|---|---|
| 1 | "la app se llamará **Car Guy**" | PROMPT-01 (rebrand: name, package, slug, scheme, icons, manifest, README) · PROMPT-10 (repo rename, new Vercel project) |
| 2 | "gestionar su o sus vehículos" | PROMPT-03 (garage: rich vehicle profile, photo, specs, vehicle types incl. *motor*/*jeepeta*/*camioneta*, multi-vehicle switcher, archive) |
| 3 | "llevar los mantenimientos" | PROMPT-04 (service catalog with default km/month intervals, service records, parts, shop) · PROMPT-05 (reminders engine) |
| 4 | "las revisiones semanales o diarias" — the coolant incident, "no tener esa costumbre diaria" | PROMPT-05 (inspection checklists daily/weekly/monthly, cold-engine coolant guidance, fail → task, streaks, notifications) |
| 5 | "registrar combustible" | Preserved end-to-end: PROMPT-02 migrates fill-ups, prices and brim-to-brim math unchanged; PROMPT-06 restyles the screens |
| 6 | "mejoras del vehículo hechas" | PROMPT-04 (*Mejoras* — upgrade records as a first-class record kind) |
| 7 | "arreglos del vehículo" | PROMPT-04 (*Reparaciones* — repair records; inspection failures can become repairs) |
| 8 | "todo lo relacionado a su vehículo … un historial de su o de sus vehículos" | PROMPT-04 (unified *Historial* timeline across every record kind, filters, search) · PROMPT-07 (PDF vehicle report) |
| 9 | "con estadísticas y todo" | PROMPT-07 (statistics: cost/km, by category, monthly, economy trend, TCO, charts) |
| 10 | "ese repositorio … es el que quiero transformar" | Whole package works **in place** on `/home/xaviel/dev2/tu-gasolina-rd`; PROMPT-10 renames the repo at the end |
| 11 | "estudia la estructura actual … para que veas cómo trabajarlo" | `00-context/02-repo-audit.md` |
| 12 | "crea los prompts, plan, contexto y todo en … imps 17092026" | This folder |
| 13 | "deep research … aprender sobre este tipo de apps" | `01-research/` (3 reports) feeding `02-specs/` |
| 14 | "se los pasaré a Claude Code CLI" | `03-prompts/PROMPT-00 … PROMPT-10`, each self-contained, with "paste to Claude Code" blocks |

## Decisions Xaviel confirmed (2026-09-17)

| # | Question | Decision | Consequence |
|---|---|---|---|
| D1 | Android identity | **New package** `com.xaviel.carguy` — Car Guy is a new app on the phone | Data does not carry over automatically; the app must **import a Tu Combustible RD backup JSON** (existing export format) during onboarding. Old app keeps working until uninstalled |
| D2 | Storage | **Migrate to SQLite** (`expo-sqlite`, async API, works on Android + web/OPFS) | PROMPT-02 is the foundation; every later phase builds on the repository layer |
| D3 | Cloud | **Local-first, with an optional account** so that after a reinstall or on a new device, signing in restores the data | PROMPT-08 (auth) + PROMPT-09 (sync). Never required to use the app |
| D4 | Supabase project | **`x-core`** (free tier allows 2 projects; `x autohub` and `x-core` already exist), **own schema `carguy`** | The Music Hub `enforce_invite_only` trigger on `auth.users` must become app-aware — see ADR-06 and PROMPT-08. Music Hub behaviour must not change |
| D5 | Visual identity | **Redesign**; Xaviel asked me to propose it | `05-design-identity.md` — "Tablero nocturno" (instrument-cluster-at-night). Tokens land in PROMPT-01, screens adopt them progressively, PROMPT-06 finishes the pass |
| D6 | Repo / domain | **Rename repo to `car-guy`, new Vercel project `car-guy.vercel.app`**; old site stays up until Xaviel turns it off | PROMPT-10 + manual checklist |

## Goals

- **G1 Garage.** Several vehicles, each with a real profile (year/make/model, plate, VIN, photo, specs like tire pressure and oil grade), a current odometer, and an archive state.
- **G2 Maintenance.** Service records (planned), repairs (unplanned), upgrades (*mejoras*), each with date, odometer, cost, shop, parts and attachments; a service catalog with sensible DR-tuned default intervals.
- **G3 Inspections that build a habit.** Daily/weekly/monthly checklists (fluids, tires, lights, brakes, leaks, documents), cold-engine coolant guidance, a failed item becomes a task or a repair, streaks and a gentle daily nudge. This is the feature the incident asked for.
- **G4 Reminders that predict.** Date and/or odometer, "whichever first", recurring with reset-on-completion, predicted due date from average km/day, 4 urgency states, local notifications on Android, in-app banners everywhere. DR legal reminders built in: **marbete** (window Oct → 31 Jan), **seguro**, **licencia**.
- **G5 Fuel.** Everything Tu Combustible RD already does, unchanged in behaviour (two-of-three math, brim-to-brim km/gal, MICM reference prices, stations).
- **G6 History and statistics.** One timeline per vehicle with every record kind; statistics (cost/km, spend by category, monthly, economy trend, total cost of ownership); PDF report and CSV/JSON export.
- **G7 Account and sync (optional).** Sign up / sign in; local data is pushed to `x-core` schema `carguy`; a fresh install pulls it back. Offline-first with last-write-wins and soft deletes.
- **G8 Ship it as Car Guy.** New identity, new package, Android APK/AAB via EAS, PWA on `car-guy.vercel.app`, repo renamed.

## Non-goals (this cycle)

- iOS build (no Mac; the PWA covers iPhone as before).
- Live MICM price scraping, OBD2, GPS trip logging, receipt OCR, station maps.
- Multi-user / shared garages, roles, fleet features.
- Real-time sync. Eventual consistency is enough.
- Monetisation, ads, analytics SDKs.
- Integrating Car Guy into `xaviel-web-v2` (that is the pending Phase 4 of `imp 11092026`; this cycle only leaves the portfolio card pointing to the right place — PROMPT-10 notes it).
- English UI. Spanish (es-DO) only, strings kept in one place so i18n is possible later.

## Definition of done for the cycle

- A brand-new Android install of **Car Guy** (`com.xaviel.carguy`) shows the new identity, and importing Xaviel's Tu Combustible RD backup JSON brings every vehicle, fill-up, expense and reminder with no loss (counts match).
- Adding a vehicle pre-creates its default maintenance reminders; logging an oil change resets the oil reminder; the home screen shows the next due items with predicted dates.
- The weekly inspection can be completed in under 2 minutes; marking *refrigerante* as **Falla** creates a task; the coolant item explains "motor frío".
- A local notification fires for a due reminder on Android; the same reminder shows as an in-app banner on the web.
- Historial shows fuel, services, repairs, upgrades, inspections and expenses in one list, filterable; Estadísticas shows cost/km and monthly charts; a PDF report can be shared.
- Signing up from the app on `x-core` **works**, while a Music Hub signup with a non-invited email **still fails** with the same error as today.
- After sign-in on a second device (or the web), the garage appears; edits on either side converge; deletes do not resurrect.
- `car-guy.vercel.app` serves the PWA; GitHub repo is `car-guy`; `npm run build`, `npx tsc --noEmit`, `npm test` and `npx expo lint` are green.
