# Project Brief — IMP 28092026 · Car Guy 2.1 "Hachi-Gō": look JDM + car-guy features

Written 2026-09-28 from Xaviel's note, three rounds of questions he answered the same day, the state
of the repo after v2.0.0 (2026-09-25), and the research in `01-research/`.

## Where the app is today (read `00-context/02-state-of-the-repo.md` for detail)

Car Guy **v2.0.0** shipped on 2026-09-25: SQLite local-first, garage, fuel, maintenance/repairs/
upgrades, expenses, tasks, documents, inspections + reminders + notifications, statistics + PDF/CSV,
optional account with sync to Supabase `x-core` schema `carguy`, Android APK/AAB via EAS, PWA at
`car-guy.vercel.app`, repo `github.com/XavielT/car-guy`. 450 tests, tsc/lint green.
The local folder is still `~/dev2/tu-gasolina-rd` (rename pending — see PROMPT-00).

The visual identity is "Tablero nocturno" on the house palette (amber `#FFB300` on `#121212`,
Space Grotesk / Manrope / JetBrains Mono). It is clean but generic: it reads as a dark finance app,
not as a car-guy app. Xaviel's words: *"the app must look more car style, JDM or something like
that… a better look"*.

## Xaviel's note → where each point lands

| # | Note (his words, condensed) | Where it lands |
|---|---|---|
| 1 | "remember this app is an entire car guy app, not only fuel — add more features related to car care and things a car guy must like to have" | The whole cycle; feature blocks B–F below |
| 2 | "the folder on this laptop is still named `tu-gasolina-rd` but we renamed all that stuff" | PROMPT-00 renames the folder to `~/dev2/car-guy` (manual step recorded; every prompt says `cd` to wherever it lives) |
| 3 | "the app must look more car style, JDM… a better look, use the /design to make it look more car guy" | Mockups delivered as the Design artifact **"Car Guy — JDM Cluster"** (6 artboards); spec in `00-context/05-design-jdm.md`; PROMPT-01 + PROMPT-02 implement it (block A) |
| 4 | "find out what other features we can add to make the app more usable to a car guy… ask me a lot of questions" | Three question rounds answered (below); research in `01-research/`; blocks B–F |
| 5 | "we modify our cars too, and we like to have a history of how the car was at a certain time, with photos" | Block C (álbum + snapshots "así estaba el carro") and block B (build log) |
| 6 | "I miss my old VW Jetta sold in 2021… didn't find any photo… when I change my phone some photos got lost" | Block C: **cloud-backed vehicle album**, "Ex" vehicles that keep their whole story, import old photos with their original dates, storage meter. The Jetta becomes the first "Ex" entry |
| 7 | "prompts, context and everything for Claude Code CLI, in the improvements folder, today 28/09/2026" | This package: `imps car guy/september 2026/imps 28092026` |

## What Xaviel answered (2026-09-28)

**Profile.** All four: modificaciones/tuning, mecánica DIY, track/drift/performance, coleccionista/
historia del carro.

**Garage (real data, used in mockups and dev seeds; never uploaded anywhere):**

| Vehicle | Facts |
|---|---|
| **Toyota Trueno AE85** (the "hachi-gō") | 4A-GE 20V swap, manual, drift/ceritos/derrapes, nice wheels ("aros bien bonitos"), racing radiator + fans, tuned ECU with pops and bangs; HP unknown, "el motor es alegre, gira rápido y alto" |
| **Citroën DS3 2015** | 1.6 NA automatic, factory stock, the daily |
| **Citroën C3 2003 hatchback** | 1.6 NA manual, beige cloth interior, stock; crashed a few months ago, being restored; plans to modify after it runs again → status **proyecto** |
| **VW Jetta 2003 1.8T** automatic, stock | sold 2021 → the first **Ex** vehicle |

**Feature blocks he wants (all of them), in this priority order — D-PRIORITY:**
A look JDM → C álbum/línea de tiempo/Ex/importar fotos → B build log (mods por sistema, specs
stock vs actual, wishlist, inventario de piezas/gomas) → D DIY (ficha técnica, guía de fluidos con
sus fotos, códigos OBD manuales, contactos del carro) → E track (sesiones/eventos, setup por sesión,
tiempos, desgaste de consumibles) → F compartir (ficha pública con link, libro del carro PDF,
garaje compartido).

**Design direction.** "Cluster JDM 90s": black panels, condensed technical type, needle gauges,
subtle carbon on frames, telltales. **Keep the house amber `#FFB300` as primary** and add JDM red
`#E10600` as the redline/alert accent (D-PALETTE).

**Storage.** Photos compressed in Supabase (1600 px / ~300 KB), with an optional manual "save the
original to Google Photos/Drive" (D-STORAGE). Free tier is shared with Music Hub → per-user quota
and a meter.

**Sharing.** Public car page by link, car-book PDF, shared garage with another person. Data model
supports all three from the start; UI in block F.

**Local scene / vocabulary (D-VOCAB).** Autódromo de las Américas (Sunix) as default venue; car
meets = *juntes*; parts imported via Amazon/eBay/Japan → wishlist needs USD price + shipping +
customs in RD$; racing; *pops and bangs* = *tirar tiro*; *eso ta' clean* (looks good), *qué grasa*
(that's hard), *exótico* (too hard), *acotao'* (air-suspension car dumped on the ground), *de lao'*
(drift / ceritos), *tuneado, rines/aros, body kit, muffler*. Used in copy where it fits naturally
(empty states, session feel, badges), never in labels a stranger must understand.

## Goals

- **G1 Look.** The app reads as a car-guy app at first glance: cluster hero with needle + redline,
  telltale row, condensed technical type, badges, hazard dividers, hanko stamp, subtle carbon on
  frames; light mode still supported. Ships as v2.1 tokens without breaking any screen.
- **G2 Memory.** Every vehicle has an album (grid + timeline by year/month), photos are synced with
  thumbnails to the account, old photos can be imported with their real dates, and a sold car stays
  as an **Ex** with its whole story. Storage meter and quota.
- **G3 Build.** Mods by system with brand/part/cost (incl. shipping + customs + FX), installed/
  removed/sold lifecycle, before/after photos; spec sheet *stock → actual* derived from installed
  mods; wishlist that converts into a mod; inventory of parts, wheel sets and tires (DOT decoder).
- **G4 DIY.** Ficha técnica per vehicle (capacities, fluids, torques, tire pressures, part numbers)
  with presets marked as unverified until the user confirms; "dónde está cada fluido" guide with
  the user's own engine-bay photos; manual OBD-II code log with a bundled Spanish DTC table;
  vehicle contacts (mecánico, gomera, dealer) linked to records.
- **G5 Track.** Events (track day / drift / drag / junte) with sessions, copy-forward setup sheets
  (pressures cold→hot per corner, alignment, dampers, drift extras), timing, incidents, consumables
  (tire heat cycles, pad thickness), day summary.
- **G6 Share.** Public car page by unguessable link with privacy toggles and WhatsApp preview
  (OG tags via a Vercel function), car-book PDF (pdf-lib), shared garage (members + roles) with the
  sync engine adapted.
- **G7 Ship.** v2.1.0 Android + web, migrations applied on `x-core` without touching Music Hub.

## Non-goals (this cycle)

- OBD-II Bluetooth, GPS lap timing, telematics.
- Social feed, comments, followers. Public pages are read-only dossiers.
- Original-resolution cloud photos (D-STORAGE) — the app offers to save originals to the user's
  own Google Photos/Drive by hand via the share sheet.
- iOS native. English UI (strings stay centralised).
- Transfer of a vehicle to another account (selling inside the app).

## Definition of done

- The Design artifact's six artboards are recognisably what the app shows (Inicio cluster, Garaje
  with Ex, Álbum, Build, Pista); every existing screen adopts the tokens; light mode passes
  contrast; the launch "gauge sweep" runs once.
- Xaviel imports ≥ 20 old phone photos of a car with their original dates into an album, sees them
  by month, and the same album appears on the web after sync; the Jetta exists as an Ex with a
  story, sold date and photos.
- AE85 has ≥ 10 mods across systems with costs in DOP and USD+customs; *Specs* shows 3A-U → 4A-GE
  20V and 13x5 → 15x8; a wishlist item converts to a mod; a tire set shows its DOT age.
- Ficha técnica shows presets flagged "sin verificar" until tapped; a photo-guided "dónde está el
  coolant" exists for the DS3; a P0xxx code can be logged and linked to a repair; a contact appears
  on a service record.
- A drift event at the Autódromo has two sessions; session 2 was created by copy-forward and shows
  what changed; the day summary is shareable as an image.
- A public link opens on a phone without the app, shows only the enabled sections, and previews
  with an image on WhatsApp; a PDF car book generates on Android and web; a second account invited
  as editor sees and edits the AE85 and both devices converge.
- `npm test`, `tsc`, `lint`, `build`, `verify-x-core`, `verify-sync` green; v2.1.0 released.
