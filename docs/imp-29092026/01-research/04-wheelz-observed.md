# 04 — Wheelz, observed first-hand (Play Store listing, 2026-09-29)

Source: the Google Play listing of **"Wheelz - Social Drive Tracker"** by Vortac Labs Inc
(`com.gigamow.wheelz`, category Maps & Navigation, 4.9★ / 1.58K reviews, 10K+ downloads, updated
2026-09-16), read through Xaviel's Chrome. The app itself could not be opened (no bridge to the
phone); Xaviel may attach screenshots of his install — if he does, the notes go at the end of this
file and PROMPT-05 reads them.

## What the listing says the app does (verbatim facts, no invention)

- "With location permission enabled, Wheelz detects when you start moving, begins a trip in the
  background, and wraps it up when you're done — no manual start/stop needed."
- "While you're driving, you get a clean live drive view with real-time speed and key trip details."
- "After each trip … full breakdown: **top speed, average speed, distance, duration, and route
  history**." Drives are "organized into an easy-to-browse timeline with detailed trip views".
- "Speed leaderboards" against other drivers (social; **not** for Car Guy — leaderboards on public
  roads are a liability and Xaviel did not ask for it). "Leaderboards do not display speed."
- Vehicles: "Add your vehicles with make, model, and year … keep your driving history tied to the
  car you're using."
- Manual mode exists: developer reply (2026-09-18): "We actually already have manual drive
  start/end under **Drive Tracking in the settings**." Xaviel confirms auto + manual can both be on.
- Data safety: collects Location + personal info; "Shares Location"; Google sign-in only (a review
  complains about that and about "intrusive background permissions" — a lesson for our onboarding
  copy: explain why and let people say no).

## What the store screenshots show (four panels)

1. **"Automatically Track Your Drives"** — a dark map with the route drawn as a line coloured by
   speed (green → yellow → red). Below it a trip card: red car icon, "April 12th, 1:48 PM", "26.5 mi
   · 47m", **Vehicle** (911 GT3 RS) and **Role** (Driver) dropdowns, tiles **Distance 26.5 mi ·
   Duration 47m · Top 74 mph**, a **"Speed distribution"** bar with buckets `<30 · 30–50 · 50–70 ·
   70–100 · 100+` (13 % / 17 % / 68 % / 2 % / 0 %), a **replay control** (play button + scrubber)
   and a **Share** button.
2. **"Unlock Your Driving Statistics"** — All-time / month filters; **Total drive distance**
   (2,845 mi), average drive distance; playful equivalences ("1,138× Indy 500 laps", "1.02× coast to
   coast", "0.11× around Earth", "0.01× to the Moon"); **Longest drive** card (date, time span,
   distance, duration, top speed); **Top speed**; speed distribution.
3. **"Drive With Your Friends"** — social feed (skipped for Car Guy).
4. **"Grow Your Driving Heatmap"** — a map heatmap of all routes; **"My Drives"** list with filters
   *All cars · Recent · Oldest · Fastest · Longest*, each row a tiny route sparkline + date + time
   span + "192.1 mi · 4h 15m" + top speed in amber.

## Reviews worth designing around

- (9 helpful) "anytime you reach a stop (usually at the count of 30 secs) … it does stop and once
  you keep moving it refreshes the drive." → **Do not end a trip on a short stop.** Our state
  machine ends after **4 min** stationary (traffic lights, drive-through, a *colmado* stop), and a
  new trip that starts within 10 min from the same spot is **merged** into the previous one.
- "would be nice if we could click the start drive and end drive by our own" → manual mode visible,
  not buried.
- "can we have the 'keep the screen on when using this app' option?" → `expo-keep-awake` while the
  live view is open (toggle in Ajustes → Viajes).
- "intrusive background permissions … cannot be restricted" → our permission screen explains the
  three levels (nada / solo manual / automático) and the app works fully with none.

## What Car Guy takes from Wheelz, and what it does differently

| Wheelz | Car Guy 2.2 |
|---|---|
| Auto-detect + manual | Same, both at once (Xaviel's answer) |
| Live speed view | The **cluster on Inicio becomes the live view**: the tachometer needle shows km/h (0–200 scale while a trip is live), the LCD shows trip distance, and the telltales show GPS quality |
| Route on a dark map (Google/Mapbox tiles) | **Route as an SVG line on the dark card** — no API keys, works on web, JDM look; the line is coloured by speed with the same five buckets. "Ver en mapa" opens the route in Google Maps / OSM as a link (no embedded map in this cycle) |
| Trip card: vehicle, role, distance, duration, top, distribution, replay, share | Same fields minus role (→ "conductor" is implicit; a *pasajero* chip exists to exclude a trip from the odometer); **replay** = a scrubber that moves a dot along the SVG path; share = the existing share-as-image pattern (react-native-view-shot) |
| Statistics: totals, equivalences, longest, top speed | Cifras gains a **Viajes** block: km este mes, viajes, tiempo al volante, más largo, más rápido; equivalences localized (vueltas al Autódromo de las Américas ≈ 3.5 km, viajes Santo Domingo–Santiago ≈ 155 km, vueltas a la isla ≈ 1,000 km) |
| Heatmap | Deferred — needs a real map |
| Leaderboards, friends | **No.** Not a car-guy-app feature Xaviel asked for, and speed contests on public roads are not something Car Guy should encourage. Track times already live in Pista |
| Google sign-in only | Existing email/password account, optional |
| Trips tied to a vehicle | Same: the **active vehicle** at trip start owns the trip; changeable afterwards |

## Screenshots from Xaviel's phone

*(none received at packaging time — append here if they arrive; PROMPT-05 checks this section
before designing the trip detail screen)*
