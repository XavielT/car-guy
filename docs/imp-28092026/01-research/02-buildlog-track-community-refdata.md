# Research 2 — Build log, track/drift logging, car history & community, reference data

*2026-09-28. Caveat: web search was disabled and the proxy rejected consumer sites; only GitHub raw,
GitHub API and npm were reachable. Section D's DTC lists and the offline vPIC package were
**verified live**. Wheelwell/RaceChrono/Harry's/Track Addict/Garmin/MoTeC/BaT/GT7/CarFax/vPIC field
lists/CarQuery descriptions are from training knowledge (cutoff mid-2026) — spot-check before
copying UI verbatim.*

## A. Build log / modifications

### Feature matrix

| Product | Categories | Per-mod fields | Stock vs current | Wishlist | Inventory | Timeline | Notes |
|---|---|---|---|---|---|---|---|
| **Wheelwell** | Fixed by system: Engine, Intake, Exhaust, Forced Induction, ECU/Tuning, Drivetrain, Suspension, Brakes, Wheels, Tires, Exterior, Interior, Lighting, Audio/Electronics, Safety | brand, product, part #, price, install date, vendor/URL, notes, photos, installed by | "Stock" vs "Current" cards (HP, TQ, weight, 0-60, wheel/tire), user-entered | per car, priced, shop links | no | build timeline mixing mods/photos/posts | Best reference. Complaints: shopping pushes, slow, rigid taxonomy, no removed/sold state (people delete history) |
| Car Throttle garage | tags | photo, caption | no | no | no | photo feed | social, not a log |
| Carmmunity / Modifry / MyGarage-type | 8–12 systems | name, brand, cost, date, km, photo | rarely | sometimes | no | list | many abandoned; data loss, no export |
| Fuelly | none (maintenance types) | — | — | — | — | — | users abuse maintenance log |
| Forum build threads (Zilvia, Club4AG, Honda-Tech) | none; chronological | free text + photos | hand-written spec block in post #1, edited forever | to-do in post #1 | "for sale/spares" in post #1 | post order | **first-post spec block + chronological updates** is what everyone reads; hosting dies (Photobucket) |
| Bring a Trailer | prose "modifications include…" | photo-heavy, receipts, dyno | listing quotes factory + current | — | "included spares" | gallery + service history | gold standard of *presentation* |

### Complaints (recurring)
1. **Rigid categories** — no place for fabricated/custom/OEM+ swaps (AE86 4A-GE 20V swap is an *engine*). Give a catch-all + free tags.
2. **No lifecycle** — parts removed/sold/moved; deleting loses history. Need `status` + `removed_at`.
3. **Cost lies** — shipping, customs, shop labor forgotten. DR imports via courier + DGA customs → separate `shipping` and `customs`.
4. **Spec sheets go stale** — stock vs current must derive from installed mods.
5. **Photo hosting death** — local-first + media sync solves it.
6. **Wheels/tires aren't "a mod"** — they are *sets* you swap street/track. Model as inventory that can be *mounted*.
7. **No export** — PDF/CSV to sell the car or post on forums.

### Recommended model (adopted in `02-specs/01-data-model-v2.md`)
`mod_category` (seeded, extensible: engine, intake, exhaust, forced_induction, ecu_tuning, fuel,
cooling, drivetrain, differential, suspension, brakes, wheels, tires, exterior, aero, interior,
safety, lighting, audio_electronics, custom_fabrication, other) · `mod` (status planned|ordered|
installed|removed|sold|failed, installed/removed at+km, installer_type self|shop|friend, cost
part/labor/shipping/customs, currency + fx, vendor/url, receipt, `replaces_mod_id`,
`affects_specs`, tags) · `mod_media` roles before/after/install/receipt/dyno · `vehicle_specs`
stock/current/snapshot (hp, torque, weight, engine code, induction, ECU, gearbox, final drive, LSD
type open|viscous|helical|clutch_1way|1.5way|2way|welded, wheels f/r width/diam/offset, tires,
bolt pattern, center bore, ride height, spring rates, camber/toe/caster, brakes/pads) with
**current computed = stock ⊕ installed mods** · `wishlist_items` (priority 1–3, est cost,
currency, url, vendor, target date, status idea|saving|ordered|converted|dropped,
converted_mod_id) · `inventory_items` (part|wheel|tire|fluid|tool|consumable, qty, condition,
location, fits_vehicle_ids) · `wheel_sets` · `tires` (size parsed, DOT week/year, compound,
position fl|fr|rl|rr|spare|unmounted, tread new/current, heat_cycles, status).

### UX to copy
Wheelwell car-page tabs `Mods · Specs · Wishlist · Timeline · Fotos` with per-group count + spend
and a header "RD$ total invertido · N mods"; forum first-post spec block as a monospace shareable
card; timeline = unified history with before/after pairs and a "Quitado — vendido RD$…" second
entry; category chips first then name, brand/part# autocomplete from own history; **"Convertir a
mod"** on wishlist rows (best retention hook); inline DOT decoder ("sem 23/2023, 3.3 años", flag > 6).

## B. Track day / drift logging

| Product | Source | Session model | Setup sheet | Timing | Consumables | Drift |
|---|---|---|---|---|---|---|
| RaceChrono | GPS + OBD/CAN | session = track + date, auto laps | comments only | best/sectors/theoretical, 0-100, ¼ mi | no | no |
| Track Addict | GPS/OBD, video | session + track | none | laps, sectors, drag | no | no |
| Harry's LapTimer | GPS/OBD/video | sessions, lap DB, weather auto | car notes | laps, sectors | no | no |
| Garmin Catalyst | GPS + camera | session, "True Optimal Lap" | none | laps, coaching | no | no |
| MoTeC i2 / AiM RaceStudio | pro loggers | log per run; RS3 setup metadata form | yes (free fields) | everything | external | no |
| Longacre / Trackside paper sheets | manual | one sheet = one run | **full**: per-corner cold/hot psi, compound & DOT, camber/caster/toe, ride height, corner weights, springs, bump/rebound clicks, sway bar, pads, bias, fuel load, ballast, gearing, ambient/track temp | hand-written | tire set + heat cycles | no |
| Drift sheets (FD/D1 teams, Driftworks/Wisefab guidance) | manual | per event, per run (practice/qualifying/battle) | + steering angle, hydro handbrake, LSD type/ramp/preload, rear vs front tire size, **rear pressures 35–50 psi** for smoke/control, knuckle/rack, clutch, 2-step/rev limit | judged, not timed | **rear tires per run** | yes |

Complaints: GPS/OBD apps keep zero setup context ("what pressures when the car felt best?"); paper
sheets never digitised; weather forgotten; drift people care about **tire count per event, what
broke, what setting changed the car**, not laps.

### Minimal manual model that feels pro (adopted)
`venues` (seed DR: Autódromo de las Américas/Sunix…) · `track_events` (vehicle, venue, date,
discipline track_day|drift|drag|autocross|test, weather, ambient/track temp, condition dry|damp|wet|
dusty|green|rubbered, odometer start/end, entry fee, fuel, notes) · `track_sessions` (seq, kind
practice|qualifying|battle|timed|test|drag_pass, duration, laps, best/second lap ms, sectors JSON,
0-100, ¼ mile + trap, 60 ft, fuel load, ballast, driver, car_feel understeer|neutral|oversteer|
snappy|lazy, rating 1–5, notes, incident, video) · `setup_sheets` 1:1 (per-corner psi cold/hot,
camber ×4, toe f/r, caster, ride heights ×4, springs, dampers bump/rebound f/r + clicks total, sway
bars, pads, bias, drift extras: steering angle, hydro, LSD, sizes f/r, 2-step, rev limit,
compounds; `changed_from_previous` JSON) · `consumable_usage` (tire_heat_cycle, tire_scrapped,
pad_measure, fluid, fuel). Derived: heat cycles, pad life graph → reminder at 3 mm street / 5 mm
track, rear tires per event, PB per venue+layout.

### UX to copy
**Copy-forward setup** ("Sesión 2" pre-filled from 1; changed fields highlighted; saves the diff —
the one feature that makes manual entry viable); **corner grid** 2×2 top-view input, auto-advance
FL→FR→RL→RR; cold/hot pair with delta, flag asymmetric growth (drift rears +8); event header with
venue/weather/temp/condition in 3 taps; PB banner + "vs mejor" delta; **drift mode toggle** swaps
timing for runs/tires/incidents; **post-event summary image** (km, sessions, best lap, tires burned,
RD$) — what gets posted on Instagram.

## C. Car history / "memory" & community

| Source | Car page | Ex-cars | Sharing/privacy | Export |
|---|---|---|---|---|
| Wheelwell garage | hero, Y/M/M/trim, HP/TQ/weight, mods by category, timeline, followers | "Previous cars"; sold stays visible | public by default, `/username/car-slug`, OG = hero | none |
| CarFax/AutoCheck | chronological dossier: title events, odometer readings, service by shop, accidents, owners | ownership segments | private, paid | PDF |
| Bring a Trailer | title, hook paragraph, 100+ photos, bullets "Chassis…", "Modifications include…", "Service history includes…", odometer, VIN, docs, Q&A, sold-price badge | the listing *is* the ex-car page forever | public `bringatrailer.com/listing/<slug>` | seller dossier PDF |
| Gran Turismo 7 garage | card grid; spec panel (PP, HP, weight, drivetrain, tires); settings sheets A/B/C; photo mode | sold disappear; collection progress | n/a | scapes |
| Hagerty / MotorTrend garage | valuation timeline, insured value, docs vault, ownership dates | "past vehicles" toggle | private by default, per-car link | value PDF |
| Fuelly / Drivvo | stats-first; retire vehicle | retired flag | optional public profile | CSV |

**Consensus:** keep sold cars, never delete. Presentation gold standard = BaT: hero gallery, short
story, fixed spec bullets, mods, service history, documents, then timeline.

Model (adopted): `vehicle_ownerships` (role owner|co_owner|family|caretaker, acquired at/km/price/
from, sold at/km/price/to, reason, is_current) · `vehicles` + status active|stored|project|sold|
totaled, nickname, story, hero_media_id, chassis_code, origin, imported_year · `vehicle_shares`
(slug, visibility private|link|public, show_plate/vin/costs/location/odometer/maintenance/mods/
track/docs, og_media_id, published/revoked) · `garage_members` (owner|editor|viewer) · timeline
`milestone` (bought, first_track_day, engine_swap, sold, accident, restoration_done).

Privacy defaults: private → link (unguessable slug) → public; plate/VIN/costs/location/docs OFF by
default, odometer ON (BaT shows it); sold cars stay as "Ex"; no transfer flow in v1 (Hagerty's is a
support headache); OG image = hero + nickname + chassis code, generated server-side; co-owner via
link with role; viewers cannot see costs unless enabled; `updated_by` audit.

Car-book PDF (BaT order): cover (hero, nickname, Y/M/M, chassis, km), story, spec stock vs current,
mods by category with dates/costs (toggle), maintenance table, documents list (dates only), track
summary, photo pages. Filename `car-guy_<slug>_<yyyymmdd>.pdf`.

UX: GT7 garage grid with status pill + "Proyecto" badge + "Ex" filter; BaT fixed bullet dossier
first; Hagerty ownership timeline bar; CarFax "N owners / N records / N photos" stat strip.

## D. Reference data for the ficha técnica

| Source | Gives | Cost/limits | Licence/offline | Fit for DR-imported, EU, JDM |
|---|---|---|---|---|
| **NHTSA vPIC** (`vpic.nhtsa.dot.gov/api`) | VIN → make/model/year/series/body/doors/drive/engine cyl/disp/HP (sometimes)/fuel/transmission (sometimes)/plant/GVWR/brakes/airbags; `DecodeVin`, `DecodeVinValues`, batch, `GetAllMakes`, `GetModelsForMakeYear` | free, no key, no hard limit *(unverified this session)* | US gov → public domain; full DB `.bak` downloadable; **bundling allowed** | **weak outside US VINs**: EU Citroën (`VF7/VR7`) resolves WMI but model/engine often blank; **JDM AE85/AE86 have no 17-digit VIN** (frame number `AE85-5xxxxxx`) → errors. Chassis number must be first-class |
| **@cardog/corgi** (npm, ISC) *verified* | offline VIN decoding from "VPIC Lite" SQLite (~20 MB gz), monthly rebuilds | free | ISC / public-domain data | same coverage; for Expo an online vPIC call + manual edit is enough |
| CarQuery API | make/model/trim, engine, dims, weight | free non-commercial; flaky; data thin after mid-2010s *(unverified)* | no offline redistribution | poor for AE85, mediocre for C3/DS3 |
| Auto-Data.net | good EU/JDM spec sheets, oil capacity sometimes | browse free; API paid; scraping prohibited | no bundling | link out only |
| Wikipedia/Wikidata | generations, engine codes, years | free | CC BY-SA / CC0 | seed a hand-written **chassis code → model/engine** table |
| **OBD-II DTC lists on GitHub** *verified* | `mytrile/obd-trouble-codes` (**MIT**): JSON/CSV/SQLite, **3 071 codes** (P 1 138 incl. 655 P1 generic descriptions, B 1 147, C 487, U 299), English desc; `brendan-w/python-OBD` `codes.py` (**GPL-2**, 2 066 P/U) | free | **use mytrile (MIT)**; avoid GPL list | generic SAE only; translate to Spanish once |
| Tire size parsers | nothing maintained on npm (verified) | — | own code | regex `^(\d{3})\/(\d{2})\s?(Z?R)(\d{2})(?:\s?(\d{2,3})([A-Z]))?$`; diameter = rim·25.4 + 2·width·aspect/100; also `185/60-14`, `165SR13` |
| Wheel offset / bolt pattern | no trustworthy open dataset (wheel-size.com etc. proprietary) | — | own code | seed 4×100, 4×114.3, 5×114.3, 4×108 (PSA); bores 54.1 Toyota, 66.1 Nissan, 65.1 PSA; offset delta calculator |
| Oil/coolant capacities, torque specs | **no free, licensed, bundleable source** (manuals copyrighted; Castrol/AMSOIL tools proprietary) | — | — | **user-maintained sheet** with honest presets |

### Approach (adopted): `vin` optional, `chassis_number` optional, `chassis_code` first-class;
vPIC prefill on demand, never blocking; `spec_presets` for the garage + common DR cars with
`source='preset'`, `verified=0` until the user confirms; bundle `dtc_codes` (MIT, ~250 KB) with a
Spanish column; hand-written `chassis_codes` seed; tire + offset calculators in `lib/domain/tires.ts`.

## Cross-cutting checklist
Retire, never delete (cars, mods, tires) · free tags + custom bucket · costs with shipping/customs/
FX · setup context on every session, copy-forward · public pages never leak plate/VIN/costs by
default · reference data marked by source · photos owned + exportable.

## Sources
Verified: https://github.com/mytrile/obd-trouble-codes (raw CSV at
`/master/obd-trouble-codes.csv`) · https://github.com/brendan-w/python-OBD/blob/master/obd/codes.py ·
https://www.npmjs.com/package/@cardog/corgi · https://www.npmjs.com/package/@shaggytools/nhtsa-api-wrapper.
Not re-fetched: https://vpic.nhtsa.dot.gov/api/ · https://www.carqueryapi.com/ · https://www.auto-data.net/ ·
https://wheelwell.com/ · https://racechrono.com/ · https://racerender.com/TrackAddict/ ·
https://www.gps-laptimer.de/ · https://www.garmin.com/ (Catalyst) · https://www.motec.com.au/i2 ·
https://www.aim-sportline.com/ · https://www.longacreracing.com/ · https://bringatrailer.com/ ·
https://www.hagerty.com/garage · https://www.carfax.com/ · https://zilvia.net/ · https://www.club4ag.com/ ·
https://honda-tech.com/
