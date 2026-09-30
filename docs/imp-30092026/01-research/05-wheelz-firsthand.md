# 05 — Wheelz, first-hand over adb (note 14)

Walked on Xaviel's Redmi (Android 13 / MIUI 14, Wi-Fi adb 10.0.0.39) on 2026-09-30, read-only per
research 03 §C: taps, scrolls, screenshots and UI dumps with his signed-in session. Wheelz
`com.gigamow.wheelz`, units MPH, one vehicle (Citroën DS3 2015), mode **Automatic**.

Screenshots in `wheelz/` are **redacted** (route maps blurred — they show where he drives; name and photo
blurred on the profile); raw captures and UI dumps stayed out of the repo (public). Friends and the
leaderboard are described but not included (other people's names).

**Honest log.** Two slips, both harmless: Back from the share sheet left Wheelz and a follow-up tap landed on
the MIUI home and opened the Camera (no photo taken; closed); on reopening, Wheelz restored the share sheet and
a tap hit **Copy** (the drive card went to the phone's clipboard — nothing was posted or sent). After that every
tap was guarded to fire only while Wheelz had focus. No drive was started or ended, no setting changed, nothing
in the account touched.

## Screens

| # | Screen | What it shows | What it lets you do | What Car Guy takes / does not |
|---|---|---|---|---|
| 1 | **Drives** (home, `01-drives-list.png`) | Full-screen dark map behind a bottom sheet "Drives"; the car avatar; chips All Cars · Recent · Oldest · Fastest · Longest; rows = route sparkline + "Today · 5:31–6:02 AM · 14.0 mi · 31m" + **top speed big in cyan** (56 MPH) | Filter/sort, tap a drive; map style button (Pro) top right | **Take:** the map-first home for Modo conducir, the big top-speed number per row, the sort chips (we have Todos · Este mes · Largos · Rápidos). **Not:** a US-centred default map — centre on the last drive / the user |
| 2 | **Drive detail** (`02-drive-detail.png`) | The route on the dark map **following the streets**, coloured by speed (cyan → green → yellow), green start dot, red end dot; card: car icon, "Today, 5:31 AM · 14.0 mi • 31m", Vehicle and **Role** (Driver) dropdowns, Distance · Duration · Top, **Speed distribution** bar with 5 buckets (<30 · 30–50 · 50–70 · 70–100 · 100+ mph) and %s | **Swipe the card = previous/next drive** (the dots are drives, not pages); ▶ **replay**; **Route Metric** toggle (top right, under Map Style); Share | **Take:** swipe between drives, the Role dropdown in place, the metric toggle (speed ↔ …), the bucket bar (ours is the same idea, km/h). Car Guy already has start/end, colours by bucket and the distribution; the real map is Phase 4 |
| 3 | **Share Drive** (`03-share-sheet.png`) | Purple sheet "Share Drive · View and Share"; a **card** (map with route + the detail card + avatar) with **6 templates** to swipe; actions **IG Story · Save · Copy · More** | Pick a template, share | **Take:** several share templates and a direct IG Story target; our share is one image. **Not:** the avatar on a public card by default |
| 4 | **Statistics** (`04-statistics.png`) | "Total Drive Distance 797 mi", average 7.4 mi, **equivalences** (319× Indy 500 laps, 0.29× coast to coast, 0.03× around Earth, 0.00× to the Moon), Share | Share the stat | **Take:** confirms our DR equivalences (Autódromo, SD–Santiago, vuelta a la isla); a Share on the stats card |
| 5 | **Statistics, further down** (`05-statistics-locked.png`) | Longest drive (row), **Top Speed 74 mph · Locked**, speed distribution overall (54 / 41 / 5 / 0 / 0 %) **Locked**, Fastest drive **Locked**, **Total time driven 52.0 h** with equivalences (34× ISS orbits, 2.16× Earth days, Mercury/Venus days) **Locked**, Longest drive by time **Locked**, Most driven vehicles | Nothing without Pro | **Take:** the list of stats worth showing (top speed ever, time driven + equivalence, longest by time, per vehicle). **Not:** paywalls — Car Guy shows all of it |
| 6 | **Friends** (not included) | "Invite friends for free pro"; each friend: name, **"Parked 17 minutes ago"**, "183 drives · 933 mi" | Add friend, invite | **Not now:** live location sharing / social. A future "Garaje compartido" could show a friend's last drive, opt-in |
| 7 | **Leaderboard** (not included) | Month ▾ · Global ▾; Miles · Hours · Drives · Longest · Duration; **podium** top 3 with 👑; **YOUR RANK** with username and miles | Change period/scope/metric | **Not now:** global rankings. Idea for later: a private leaderboard among members of a shared garage |
| 8 | **Profile** (`06-profile.png`) | Photo + name, **Garage** carousel (DS3 "2015 • Default vehicle", 3D render on a star background, "Garage Locked · Add More Vehicles" = Pro), Privacy: **Ghost Mode** ("Hide from friends while you drive"), Extensions: 3D Car (Pro), Map Style (Pro), App Icon; Preferences: **Drive Tracking** | Edit photo, pick vehicle, toggles | **Take:** the profile layout for Phase 6 (avatar + garage carousel + preferences list); the "Default vehicle" concept (we have the active vehicle). **Not:** paying for more cars or map styles |
| 9 | **Drive Tracking** (`07-drive-tracking.png`) | see below | Choose the mode, units | **Take:** the three-mode wording, the Motion permission as confirmation |

## Drive Tracking settings as they really are

- **Tracking permissions** (status rows, all "On"): **Location** — "Background drive tracking is allowed";
  **Motion** — "Helps confirm real driving motion" (activity recognition); **Auto Detection** — "Ready to detect
  drives automatically".
- **Detection mode** (radio): **Automatic** (DEFAULT) — "Drives start and end on their own. Nothing to
  remember." · **Automatic + Manual** — "Automatic detection stays on, plus a Start Drive button above the map
  for instant starts. End drives yourself or let stoppage detection do it — and if you forget to tap, automatic
  still catches the drive." · **Manual** — "You start and end every drive yourself. Nothing records on its own."
- **Units**: MPH | KM/H.
- **What is not there**: no sensitivity, no minimum trip, no stop minutes, no keep-screen-on, no battery mode.
  Wheelz hides every threshold; Car Guy exposes them under *Avanzado* (keep, collapsed). Research 03 expected
  more options — there are none.

**For Car Guy (Phase 4):** our modes (Automático + manual · Solo manual · Apagado) match; copy Wheelz's
one-line descriptions, especially "if you forget to tap, automatic still catches the drive" (true of ours:
Iniciar adopts the open auto trip). Add **Motion** as an optional confirmation (expo-location motion activity
is foreground-only on SDK 57 — show it as "ayuda a confirmar" without depending on it).

## What the drive detail shows

- **Map:** dark vector map (streets, neighbourhood labels, parks), the route drawn **on the streets**, a thick
  line coloured by speed, green dot start / red dot end, fitted to the route with the card covering the lower
  half. Buttons top right: **Map Style** (Pro) and **Route Metric**.
- **Stats:** distance, duration, top speed (big), vehicle and role dropdowns inline.
- **Distribution:** 5 speed buckets as one bar + % under each (units follow the setting).
- **Replay:** ▶ bottom left, next to Share.
- **Navigation:** swipe the card or tap ‹ › to move between drives; ✕ closes to the list.
- **Share:** 6 templates, IG Story / Save / Copy / More.

**Answer to note 16 by comparison:** Wheelz's route follows the streets on a vector map at street zoom with
dense points; the straight segments Xaviel sees in Car Guy come from our drawing (8 m polyline on the heat
map/sparklines, raw points uncleaned in the detail, a raster mosaic) — Phase 1's export confirms which, Phase 4's
MapLibre map removes the rest.
