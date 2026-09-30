# Screens — IMP 30092026

Design language unchanged (`docs/imp-28092026/00-context/05-design-jdm.md`; Design artifact
"Car Guy — JDM Cluster"). New artboards this cycle (`01-research/04-mockups/`): **NavConducir**
(tab bar with the centre button), **ModoConducir** (full-screen drive mode with live map), **Precios**
(price history). Every new screen also has its skeleton twin.

## Phase 1 — fix pack

- **Fill-up detail** `app/carga/[id].tsx` (new): header "Echada · mié 25 sep · Petronan", tiles
  volumen · RD$ · precio/gal · odómetro; the review card (measured / estimated / ≈ por echada with
  its label and the comparison to the average); gauge before/after if present; station, notes,
  photo of the receipt if any; buttons **Editar** (→ `app/carga/[id]/editar.tsx`, the old editor)
  and **Eliminar**. "Listo" in the review sheet after a save → **this** screen (`router.replace`),
  toast "Echada guardada". Historial rows and Inicio's last fill-up open the detail.
- **Save guard**: the PrimaryButton disables while `saving`; a draft identical (vehicle, odometer,
  volume, total, date ± 1 min) to a log saved in the last 60 s is refused with "Esta echada ya se
  guardó" and a link to it.
- **Stations**: chips → a `SearchSheet` (recent first, then brands for the fuel, then Otra).
- **Reserve light**: in the gauge picker, the chip reads "Solo la luz de reserva" with the caption
  "Para carros con medidor de puntos: cuando se apagan todos y queda la luz". It sets before = E.
- **≈ por echada**: a muted line in the review sheet and in each Historial fuel row:
  "≈ 27 km/gal por echada · aproximado"; Cifras economy chart: dotted grey series toggle
  "Por echada (aprox.)".
- **Trips**: nothing visible changes except routes with more detail; the trip detail's diagnostics
  row (long-press the map) shows raw/simplified/dropped counts.

## Phase 3 — language + skeletons

- Más → **Idioma** row (Sistema · Español · English) — immediate switch, no restart; the welcome
  flow's first slide (Phase 6) also asks.
- Every list/detail screen: skeleton twin. Tab layout boot → Inicio skeleton (cluster outline,
  three tiles, quick actions).

## Phase 4 — nav bar, drive mode, map

- **Tab bar**: Inicio · Garaje · **●** · Historial · Más. The centre button is a 64 px disc
  (`#E10600`, tachometer glyph in white, 2 px `#121212` ring, raised 18 px above the bar, shadow);
  while a trip records: amber ring pulsing 1 Hz (allowed loop) and a tiny "REC" under it. Label
  "CONDUCIR" in the bar row under the disc. Tap → `/conducir` (modal, slide up). Cifras →
  Más (first row, with its icon) and Inicio quick action tile.
- **Modo conducir** `app/conducir.tsx`: full screen, dark map (OpenFreeMap dark) filling the
  screen; top: compact speed cluster (speed big, km · tiempo · máx small) over the map with a
  gradient scrim; bottom sheet: vehicle chip, mode (auto/manual), **INICIAR** (amber) / **TERMINAR**
  (red), **PASAJERO** toggle, keep-awake indicator; the trail grows in speed colours; camera
  follows with course-up; a re-centre button appears after the user pans; landscape supported;
  Back closes (the trip keeps recording in the background). No trip: last trip's mini card
  ("Último: 12.4 km · máx 84") + "Ver viajes". Web: same, manual only, geolocation permission ask.
- **Trip detail**: the OSM mosaic → **TripMap** (interactive, pinch/pan, fit bounds with padding,
  start/end markers, speed-coloured line, replay dot on the map); "Compartir" still renders the
  static image (mosaic) for the PNG.
- **Viajes → heatmap**: HeatMap layer over the MapLibre map, time filter chips (mes · año · todo).
- Attribution footer on every map (tap → OpenFreeMap/OSM copyright).

## Phase 5 — events · memory · tires · prices

- **Eventos** (vehicle hub tab renamed from Hitos → Eventos): timeline with markers by severity;
  `app/evento/nuevo|[id]`: type chips, date, km, severity (for non-hito), what happened (story),
  cost, **Pendiente** (text + "Resuelto" toggle with date), proofs strip (photos + PDF), links
  (service/mod/check pickers), location label. Pending events show a small amber row on the
  vehicle hub ("Pendiente: pintar el guardafango · desde 12 ago").
- **Mi carro, de memoria** (hub → Ficha → new tab "Lo que uso"): grouped cards (Aceite y filtros ·
  Gomas · Eléctrico · Carrocería · Interior · Papeles · Otros) with the specsheet "what I buy"
  fields and free facts (+ Agregar dato: label, value, group); search box; "Copiar" per row; the
  service form and the check runner show a "Igual que siempre" chip that fills from here.
- **Gomas quemadas** (hub → Build → Gomas header card and Cifras block): "48 gomas · 12 este año ·
  ≈ RD$ 96,000 · al ritmo actual, próximo juego en ~3 semanas"; badges row (earned in colour, next
  in outline with "faltan 2"); heat-cycle warning when a mounted tire passes the threshold;
  "Compartir" card (view-shot, JDM, no plate); public page block behind `show_tires`.
- **Precios** `app/precios/index.tsx` (board + history list grouped by week, source chip, "Importar
  MICM ahora"), `app/precios/nuevo.tsx` (fuel type chips, price, **DateField**, source chips
  MICM · Estación · Recibo · App · Otro, station picker when relevant, note); Cifras → "Precios"
  line chart per fuel (user + MICM series, last 12 months).

## Phase 6 — profile · welcome · legal

- **Perfil** (Más → Cuenta → Perfil, and the avatar in the Más header): avatar picker (16 SVG in a
  grid + "Tomar foto" + "Elegir foto" → square crop), display name; the avatar shows in Más, in
  shared garage member lists and on the feedback admin list (initials fallback).
- **Bienvenida** `app/bienvenida/*` (5–6 slides, skip on every one, dots, JDM art): 1 Idioma ·
  2 Tu nombre y avatar · 3 Tu primer carro (or "después") · 4 Qué puedes hacer (4 cards: mantenimiento
  y chequeos, viajes, build y pista, álbum y ficha) · 5 Permisos (fotos, ubicación — explanation
  only, asks later in context; the Automático slide is the prominent disclosure) · 6 Cuenta
  (crear / iniciar / después). First-visit tips: one card at the top of Viajes, Build, Pista,
  Álbum, Eventos the first time ("tips_seen"). Más → Ayuda → "Ver la bienvenida otra vez".
- **Legal**: first launch after 2.4.0 → a sheet "Términos y privacidad" with the two links and
  **Acepto**; Más → Legal (Términos · Privacidad · Eliminar mi cuenta · Licencias); web routes
  `/terminos`, `/privacidad`, `/eliminar-cuenta` (static, both languages, version + date).
  Cuenta → **Eliminar cuenta**: explanation, type ELIMINAR, confirm → local wipe + cloud RPC +
  auth removal; success screen.
