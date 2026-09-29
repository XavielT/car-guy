# Screens — IMP 29092026

Design language: `docs/imp-28092026/00-context/05-design-jdm.md` and the Design artifact
"Car Guy — JDM Cluster" (six artboards) still rule; this cycle adds artboards **Viaje**,
**Viajes** and **Garaje v2** (`01-research/05-mockups/*.dc.html`, and the same artifact updated).
Every new screen: eyebrow + uppercase display title, one accent (amber) + one status colour, kanji
small and secondary, no idle animation except the REC dot while recording (ADR-31).

## Phase 1 (hotfix) — copy only

- Cuenta, signed-out, cloud not configured: pill "No disponible en esta versión", caption "Actualiza
  Car Guy a la última versión para crear tu cuenta." + version. The `.env.example` sentence appears
  only when `__DEV__` or the setting `show_diagnostics` is on (hidden 7-tap on the version row in
  Más, like Android's developer options).
- PhotoPicker error alert: "No se pudo guardar la foto. Inténtalo otra vez." + "Reintentar" button;
  the technical message goes to `__DEV__` console and to the feedback diagnostics.

## Phase 3 — Vehicle form v2 (`components/VehicleForm.tsx` split into sections)

Order (the fast path first; everything optional after the name):

1. **Nombre** (as now) · **Fotos**: horizontal strip of thumbs + "＋"; long-press to reorder; tap →
   "Portada" / "Quitar". Multi-pick uses `pickCandidates({multiple:true})`. Empty state: dashed
   card "Agrega fotos · la primera es la portada".
2. **Marca · Modelo · Año**: three `PickerField`s. Marca opens a sheet with a search box (accent-
   insensitive), the list of ~60 makes with logo-less initials, "Otro…" at the bottom (free text).
   Modelo lists the models of that make + "Otro…". Año: a wheel/list from current+1 down to 1950,
   with the model's known range highlighted. On web the sheet is a modal with the same search.
3. **Tipo**: chips from `bodyTypes.json` (sedán · hatchback · coupé · convertible · wagon · SUV/
   jeepeta · pickup/camioneta · minivan/guagua · van · camión · motor · buggy/UTV · otro). The old
   `type` column is derived (`jeepeta`→SUV etc.) so nothing downstream breaks.
4. **Color**: swatch grid (18) + "Otro…" text; **Interior** (optional): swatch + material chips.
5. **Combustible** (as now) · **Tanque**: number + unit toggle `gal | L` (default from the vehicle,
   new vehicles default `gal`) · **Odómetro**.
6. **Precio de compra** and **Fecha de compra** — visible, not collapsed (note 8). Caption: "Para
   saber lo que te ha costado el carro."
7. **Estado**: chips for the nine statuses (vendido/perdido still via the sale sheet); when the
   status is not `activo`: **Desde** (DateField) and **Nota** ("esperando piezas"). Changing status
   in the edit form creates a `milestone` of kind `estado`.
8. **+ Identidad** (as now: apodo, chasis, motor, transmisión, tracción, origen, historia).
9. Notas.

Vehicle hub header: cover photo with a small "1/5" pill → tap opens the gallery pager (reuses the
photo viewer). Garaje card: cover photo (see Phase 6).

## Phase 3 — Service form (oil), checks, mods

- `app/servicio/nuevo.tsx`: when an item's `service_type_id` is `aceite_motor` (or the category is
  `fluidos` and the name contains "aceite"), an **Aceite** row appears: Viscosidad picker (grid of
  SAE grades), Tipo chips (mineral · semisintético · sintético), Marca picker (list + Otro),
  Especificación picker (API SP/SN…, ILSAC GF-6A, ACEA A3/B4, C3…). Saves to the four columns;
  renders "5W-30 sintético · Castrol Edge · API SP" in the record and in Historial.
- Checks runner: on `falla` **and** `atencion`: note + **PhotoStrip** (up to 5, camera or gallery);
  inspection detail shows them; Historial `chequeo` row shows "📷 N"; the album timeline shows
  them under the check with the item label.
- Mods / service photos: no UI change; verify they show in Historial rows (count) and the album
  timeline (already in 2.1 for mods; add service photos if missing).

## Phase 4 — Fuel form

- Segmented "Tanque lleno · Parcial" stays. Under it, a **Medidor** row: two `GaugePicker`s
  ("Antes" and "Después"), each a tiny fuel-gauge arc with 9 stops E…F you drag or tap, plus the
  chip **"En reserva"** on Antes. Both optional; a hint: "Con el nivel antes y después podemos
  estimar el consumo sin tanque lleno." When Después = F and "Parcial" is selected, a soft prompt:
  "¿Se llenó hasta que la bomba disparó? → marca Tanque lleno".
- Review sheet: `estimated` → "≈ 11.2 km/gal (entre 9.8 y 12.9) · estimado por el medidor";
  `unknown` → reason in plain Spanish ("Sin nivel del medidor: se contará en el próximo tanque lleno").
- Cifras economy line: measured = solid dots, reconciled = dot with ring, estimated = hollow dot
  with a light band, unknown = gap. Legend row. Toggle "Incluir estimados en el promedio".
- Units: every number rendered via `formatVolume`/`formatEconomy` with the vehicle's units.

## Phase 5 — Viajes

**Inicio (live mode)** — the existing cluster in *speed mode* (ADR-31): dial 0–200 km/h, red zone
from `limit_kmh`, needle from live speed, LCD = trip km (tap cycles), telltales GPS/REC/PASAJERO,
caption "GPS · no sustituye el velocímetro". Below the cluster a **Viaje en curso** card:
"Desde 8:12 · 12.4 km · 25 min", buttons **Terminar** (manual or auto) and **Soy pasajero**. When no
trip: a small row "Viajes: automático ✓ · Iniciar viaje" (manual start) — hidden entirely when
`trips_enabled = off`.

**Viajes list** — `app/viajes/index.tsx` (entry from the vehicle hub tab **Viajes** and from Más):
filters *Todos · Este mes · Más largos · Más rápidos*, rows = route sparkline (SVG, 64×40) + "mié 25
sep · 8:12–8:37" + "12.4 km · 25 min" + max km/h in amber; swipe → Eliminar / Marcar pasajero.
Header stat strip: km este mes · viajes · tiempo al volante.

**Trip detail** — `app/viaje/[id].tsx`: dark card with the **route as SVG**, coloured by speed
bucket, start dot (green) and end flag (checkered), bbox-fitted with 16 px padding; **replay**
scrubber below (a dot travels the path; play/pause; 20× speed); tiles *Distancia · Duración · En
movimiento · Vel. media · Vel. máx.*; **Distribución de velocidad** bar (five buckets, % and the
bucket colours); Vehículo chip (changeable) · Rol chip (conductor/pasajero) · "Ver en mapa"
(external URL with the start/end coordinates) · Compartir (view-shot image of the card, JDM styled,
"Car Guy" wordmark, no plate) · Notas · Etiquetas (casa, trabajo, junte, pista) · Eliminar.

**Ajustes → Viajes** — `app/viajes/ajustes.tsx`: mode (Automático + manual · Solo manual · Apagado),
permission state with a "Arreglar" button (opens the explanation → system settings), **Xiaomi/MIUI
checklist** card (three steps with "Abrir ajustes"), keep screen on toggle, redline km/h per
vehicle, advanced thresholds (collapsed), "Borrar puntos GPS antiguos" info (auto 30 days).

**Onboarding / permission screens** — `app/viajes/permisos.tsx`: three cards explaining Nada /
Solo manual (ubicación mientras usas la app) / Automático (siempre) with what the notification
looks like and battery note; buttons in that order; "Decidir después".

**Historial**: `viaje` rows ("Viaje · 12.4 km · 25 min · máx 84 km/h"). **Cifras**: block *Viajes*
(km este mes vs anterior, tiempo al volante, viaje más largo, más rápido, equivalencias DR),
line "km por viajes vs km del odómetro" when both exist.

## Phase 6

**Garaje v2** — header "N en el garaje · N ex"; view switcher (icons): *Portadas* (one card per
car with the cover photo full-bleed, badges, km, status line), *Cuadrícula* (2-up cards each with
its cover thumb), *Lista* (rows). **Ordenar**: a button that enters reorder mode (drag handles,
`react-native-draggable-flatlist` or a hand-rolled Reanimated list — pick the one that works on
web too, else long-press + arrows on web), "Fijar arriba" pin. Persisted in `setting.garage_layout`.
Ex section keeps its own place at the bottom in every mode.

**Splash overlay** — `components/LaunchOverlay.tsx` per ADR-36: same 1024-px artwork geometry
scaled to the shortest side × 0.42; needle sweep 0→100 with `Easing.out(cubic)` 700 ms + settle,
arc `strokeDashoffset` fill in sync, red end segment lights at 85 %, LCD counts, then 200 ms hold,
250 ms fade. Total ≤ 1.2 s. Web: same component (no native splash there; it doubles as the PWA
launch screen).

**Novedades y versiones** — `app/versiones.tsx` (Más → "Novedades y versiones"): current version
card (version, build, git sha, "Buscar actualización" → opens `/api/apk` result or GitHub
releases), then the list from `lib/changelog.generated.ts` (one card per version: date, sections
as in CHANGELOG). "Novedades" sheet: shown once when `last_seen_version` ≠ current, listing that
version's block; "Ver todas".

**Enviar comentario** — `app/comentario.tsx` (Más → "Enviar comentario o reportar un problema",
also a "Reportar" link in every error alert): kind chips (Problema · Idea · Otro), message,
optional email, optional screenshot (picker), a collapsible "Lo que se envía" with the device/app
info, Send. Works signed out. Success: "Gracias, lo leo yo mismo. — Xaviel". Errors:
`rate_limited` → "Ya enviaste varios hoy, gracias. Mañana más." Offline → queued in a local
`feedback_outbox` (AsyncStorage) and sent on next launch.

**Comentarios recibidos** — `app/admin/comentarios.tsx`: only when the session email is the admin
(ADR-35): list with status chips, tap → detail (diagnostics, screenshot via signed URL), mark
seen/done, admin note.

**Lo que me ha costado** — Cifras: card per vehicle "Compra RD$ · Mods · Mantenimiento ·
Combustible · Pista · Otros = Total · RD$/km"; total row for the garage; a "desde que lo tengo"
range; export in the CSV/PDF report.

## Phase 7 — Web

`/instalar` page (static route `app/instalar.tsx`, web only): title "Car Guy para Android",
"Descargar APK vX · NN MB" (from `/api/apk`), three-step unknown-sources explainer with the exact
Android wording in Spanish, "También en tu navegador: instalar como app" (PWA), link to the
portfolio. The button also appears in Más → "Instalar en Android" when `Platform.OS === 'web'`
and the UA is Android, and in the web header as a small pill on Android UAs. Never in the native app.
