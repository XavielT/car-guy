# SPEC-J — Monthly and yearly recaps (P7)

Xaviel (03-nov): "it must create monthly and yearly recaps." Answer: **swipeable stories + a shareable image** (the Spotify-Wrapped / Strava-year-in-sport shape).

## J0. Principles
- **Deterministic.** Every number comes from existing queries (`lib/domain/stats.ts`, `lib/db/statsQueries.ts`, trips, fill-ups, services, expenses). No AI is needed (ADR-68, ADR-74). Copy is templated Spanish/English with plural and tone rules, not generated text.
- **Computed on demand, not stored.** No new table: a recap is a pure function `buildRecap(period, scope, db)` → `Recap` (typed object). Memoise in memory only. If the person edits a fill-up later, the recap simply reflects it.
- **Same numbers as everywhere else.** Distance, top speed and averages come from the unified `SpeedEngine` outputs saved on trips (SPEC-I), so a recap never disagrees with a trip detail.
- **Never shaming.** A thin month produces fewer cards, not a card that says "0 km". Comparisons are shown only when the previous period has data and only as a neutral delta.
- **Local-first.** Works offline and signed-out. Time boundaries use the device's calendar (month/year in local time, week starts Monday).

## J1. Periods and scope
- Periods: **month** (any past month; the current month as "so far") and **year** (any past year; the current year "so far", with the final one available on 1 January).
- Scope: **active vehicle** (default), **all my vehicles**, or one chosen vehicle. A vehicle shared with me counts only for records I own (garage sharing rules unchanged).
- Entry points: Inicio "Hoy" card when a new recap closes ("Tu resumen de octubre está listo", visible 14 days); Cifras → **Resúmenes** (list of months/years that have data); Vehículo ficha → "Resumen"; deep link `/resumen/2026-10` and `/resumen/2026`.
- **Local notification** on the 1st of the month at 09:00 local ("Tu resumen de octubre está listo") and on 1 Jan for the year; both off by default only if notifications are not granted; one toggle in Ajustes → Notificaciones ("Resúmenes"). Uses the existing notification plumbing (verify what exists for reminders; no server needed).

## J2. Story cards (monthly, 6–9 cards; skip any card without data)
1. **Cover** — month, vehicle name/photo (the album cover if set), one headline number (km driven).
2. **Distance and time** — km, trips, hours at the wheel, longest trip (km, date), busiest day.
3. **Speed** — top speed (sustained, with date), average moving speed; labelled "GPS".
4. **Fuel** — gallons, RD$ spent, average price per gallon vs the MICM reference when known, **efficiency** (km/gal or L/100 km per the unit setting; only from full-to-full pairs; otherwise "need two full tanks" — never an invented number).
5. **Cost of the month** — fuel + services + repairs + expenses, a simple stacked bar, **cost per km**, biggest single expense.
6. **Care** — services and repairs done, reminders completed on time, anything overdue now (links to the reminder), documents expiring in 60 days.
7. **Build** (only if any) — mods installed, wishlist items bought, photos added, milestones.
8. **Streaks and firsts** — new record (top speed, longest trip, cheapest fuel), consecutive weeks with a check-in, "first time you…" (first track day, first mod).
9. **Compare** — vs the previous month (km, spend, efficiency) as three small neutral deltas; and "this month last year" when it exists.
10. **Closer** — one number the person might want to remember + "Compartir".

## J3. Yearly (8–11 cards)
Cover ("Tu año con el <vehículo>") · total km + trips + hours · **month-by-month bars** (km and spend, tap a bar → that month's recap) · top speed of the year · fuel (gallons, RD$, best/worst efficiency month) · total cost of ownership (fuel/services/repairs/expenses/documents, **cost per km**, and per month) · maintenance story (services count, longest gap without service, warranties still valid) · build story (mods added, money in mods) · **places** (see J6) · records and firsts · odometer start → end (km that year) · "Tu año en una imagen" collage card (cover + 3 numbers) · closer. Multi-vehicle scope adds a "Tu garaje" card (km and spend per car, the car you drove most).

## J4. Viewer (stories)
- Full-screen story viewer: tap right/left to advance/back, swipe, hold to pause, progress segments on top, close X, **auto-advance 6 s per card** (off when reduced motion or the setting "Animaciones: reducidas" is on, then manual only).
- Movement uses the app's motion tokens (ADR/`docs/MOVIMIENTO.md` level *mediano* for entering a recap, *simple* between cards); `transform`/`opacity` only; no new animation library. Numbers count up once (≤ 700 ms), skipped on reduced motion.
- Accessible: each card is a screen-reader group with the full sentence ("Recorriste 842 kilómetros en 31 viajes"); controls are real buttons with labels; no information lives only in colour; ≥ 4.5:1 contrast on the card backgrounds in light and dark.
- Visual language: the app's JDM palette (amber/orange/red accents on dark), large numerals, one idea per card, the car's photo as a soft background only when it keeps contrast (overlay gradient). Icons are SVG, never emoji.
- Desktop layout (SPEC-F): the story is centred at a 9:16 card with the keyboard (← → Space Esc) and a side list of cards.

## J5. Share image
- Each card and the **whole recap** can be shared as an image: 1080×1920 (story) and 1080×1350 (feed) variants. Native: `react-native-view-shot` (verify it is installed / Expo 57 compatible; if not, render the same card components with `@shopify/react-native-skia` only if already present, else add view-shot) → system share sheet (`expo-sharing`). Web: render the same card component to a canvas (`html-to-image` or the equivalent already used by the Libro/OG-image code — **read `lib/share*` and `api/` first and reuse**) → Web Share API with files when available, else download. The card components are **the same components** as the viewer (one source of truth), rendered at a fixed export size off-screen.
- **Privacy defaults for what is shared**: shows distance, hours, top speed, fuel efficiency, spend **only if the person turns "Mostrar gastos" on** (default off), car name and photo; **never** shows plate, VIN, odometer absolute value, exact addresses, home/work places, other people's names. A share sheet toggles: "Mostrar gastos", "Mostrar nombre del carro", "Mostrar mi nombre/usuario" (default off). The places card is excluded from sharing unless the person opts in and only shows area-level labels (J6).
- Footer: small "Car Guy" wordmark and the PWA address (no tracking links). Image generated locally; **nothing is uploaded** by the recap feature.
- Also: "Guardar como PDF" for the yearly (reuses the Libro PDF path) — optional if cheap; otherwise recorded as not done.

## J6. Places card (yearly, privacy-careful)
Uses route data already on the device. Shows "zonas donde más manejaste" as **neighbourhood/area level**, never an address: cluster trip start/end points to a ~1 km grid, label from the existing reverse-geocode only if it is already cached/available offline-free; otherwise show a small route-frequency map (the thin-line layer from SPEC-I) with no labels. Home/work cluster is detected (most frequent night/weekday-morning start) and **excluded from any shared image**. If the person has not enabled trips, the card is omitted.

## J7. Data and edge cases
- Month with < 3 records: show the cover + whatever exists + an encouraging "Poco movimiento este mes" with the one action (cargar gasolina / iniciar viaje); not shareable below 2 cards.
- Imperial/metric, currency and fuel unit per settings; RD$ default.
- Vehicle sold/archived: still has its recaps.
- Trips merged/discarded: recap reads the final trips only.
- Time zone change/DST: boundaries by local date strings, tested.
- Performance: a year of data (thousands of rows) builds in < 300 ms on the Redmi; if not, aggregate in SQL, not in JS.
- i18n es/en for every string; es plural rules and number formats (`1,234.5` RD style per the app's formatter).

## J8. Acceptance
`buildRecap` unit-tested with fixtures (empty, thin, normal, multi-vehicle, DST, year boundary); every card's numbers equal the Cifras/trip-detail numbers for the same period (a test cross-checks totals); viewer works with touch, mouse and keyboard; share image produced on web (Playwright screenshot of the exported card) and on the APK path (reviewed in PROMPT-11's report, real device check in the manual checklist); privacy toggles verified (plate/odometer/exact places never appear in an exported image — test by rendering the share variant and asserting those fields are absent from the model); reduced motion honoured; notification scheduled and cancelled correctly; es/en.
