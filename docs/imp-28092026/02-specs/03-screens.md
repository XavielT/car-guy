# Spec — Screens and navigation v2.1

Compare with the Design artifact "Car Guy — JDM Cluster". Tabs change: **Garaje** enters, the
*Chequeo* tab leaves (chequeos are reachable from Inicio's QuickActions, the telltale, Más, and the
notification). Everything new sits behind its `FEATURE_*` flag until its phase finishes.

## Tabs

| Tab | Route | Content |
|---|---|---|
| **Inicio** | `(tabs)/index` | header (CAR GUY 車 · TABLERO · Hanko avatar) · vehicle chips (katakana nick, `· PROYECTO`) · `ClusterHero` · `TelltaleRow` · Pendientes top-2 with badges · QuickActions 2×2 GASOLINA · CHEQUEO · BUILD · PISTA (BUILD/PISTA hidden until their flags) · "ESTE MES 記録" strip · marbete banner in window · economy insight card |
| **Garaje** | `(tabs)/garaje` | filter chips ACTIVOS · PROYECTO · EX · hero card (active vehicle: cover, badges from engine/discipline/status, nick, km/mods/vencidos) · 2-up cards · "EX · LOS QUE YA NO ESTÁN" (dashed, 記憶) · `+ Agregar vehículo` · tap → `vehiculo/[id]` |
| **Historial** | unchanged route; feed v2 adds `mod`, `hito`, `pista` kinds with their colours; filter chips gain MODS · PISTA · HITOS; FAB kind picker gains Mod · Hito · Evento de pista · Foto al álbum |
| **Cifras** | + "Inversión en mods" tile and category (block B), "Días de pista" tile (block E) |
| **Más** | sections: Garaje · Chequeos (list + plantillas + guía) · Mantenimiento · Combustible · Build (catálogo de categorías) · Pista (pistas/venues) · DIY (contactos, códigos OBD) · Documentos · Cuenta (+ almacenamiento) · Compartir (links activos) · Datos · Apariencia · Notificaciones · Acerca de |

## Vehicle profile (`vehiculo/[id]`) — becomes the hub

Header: hero photo (from album favourite or `hero_media_id`), name + nick + badges, status pill,
`LcdDigits` odometer, ownership line ("Desde jun 2019 · 3 años contigo" or "2018 → vendido 2021").
In-page tabs (segmented, sticky): **Resumen · Álbum · Build · Ficha · Pista · Docs**. Actions:
Editar · Cambiar estado (activo/proyecto/guardado/vendido — vendido opens the sale sheet: fecha,
km, precio, a quién, razón → `vehicle_ownership` closed, status vendido, "Escribe la historia"
prompt) · Compartir (block F) · Libro PDF (block F).

## Block C — Álbum (`vehiculo/[id]/album`, `album/importar`, `foto/[id]`, `hito/nuevo|[id]`, `album/estado`)

- Grid/Timeline toggle; year scrubber; month headers with odometer; `Timeline` items; before/after
  pairs from `mod_media` roles; favourites (star) drive the hero and the public page.
- Import: Android month browser (`expo-media-library` Query API, `granularPermissions: ['photo']`,
  banner when `limited` with "Elegir más fotos"); multi-select with counts; confirmation sheet
  shows detected dates and a per-photo/"todas" date override with precision (día/mes/año);
  progress with cancel; duplicates skipped and reported. Web: file input multiple + EXIF (`exifr`
  lite) + same sheet.
- Photo viewer: pinch/zoom modal (gesture-handler + reanimated), swipe between photos, caption
  edit, "Fecha real", favourite, "Guardar original en Google Fotos/Drive" (share sheet, Android),
  delete (soft).
- Hitos: kind chips (COMPRA · SWAP · RESTAURACIÓN · PRIMER TRACK · ACCIDENTE · PINTURA · VENTA ·
  OTRO), date, km, title, story, cover, attach photos.
- "Así estaba" (`album/estado`): date slider across ownership → photos, mods installed then,
  odometer, specs; "Fijar como snapshot" saves a `spec_snapshot`.
- Storage meter: header chip "146 fotos · 42 MB de 300 MB"; at 90 % a warning; at 100 % uploads
  pause with a clear message (local still works).

## Block B — Build (`vehiculo/[id]/build` with tabs MODS · SPECS · WISHLIST · INVENTARIO; `mod/nuevo|[id]`, `wishlist/nuevo|[id]`, `inventario/nuevo|[id]`, `ruedas/[setId]`, `goma/[id]`)

- Mods: grouped by category with subtotal; row = thumb, name, badge (SWAP/etc. from tags), meta
  (date · km · installer/vendor · customs), total, status dot; long-press → quitar/vender/reinstalar.
- Mod form: category chips (searchable), name, brand, part number, variant, status, install date +
  km (odometer rules), installer (yo/taller/amigo + contact), costs (partes, mano de obra, envío,
  aduana; foreign price + currency + FX helper "USD 210 × 59.8 = RD$ 12 558"), vendor + URL,
  "Afecta la ficha" toggle → `spec_effects` mini-form (hp, torque, peso, motor, ECU, aros f/r,
  gomas f/r, altura), photos with roles (ANTES/DESPUÉS/INSTALACIÓN/RECIBO/DYNO), replaces (pick a
  previous mod), tags (`tuneado`, `pops and bangs`…), notes.
- Specs: `STOCK → ACTUAL` mono card per field with source chip (stock/mod name/manual); edit stock;
  override a field; pin snapshot; share as image (block F's view-shot, or later).
- Wishlist: priority sections (PRÓXIMO · PRONTO · ALGÚN DÍA); row with est. total in RD$ (foreign +
  envío + aduana), vendor, status pill (AHORRANDO outline); "Convertir a mod".
- Inventario: kinds filter; wheel sets as cards (specs, status MONTADO/GUARDADO, "Montar en…");
  tires list with DOT age chip and heat cycles; parts/fluids/tools rows with location.

## Block D — DIY (`vehiculo/[id]/ficha`, `vehiculo/[id]/fluidos`, `obd/index`, `obd/[code]`, `contactos/*`)

- Ficha técnica: sections Motor · Fluidos · Encendido/eléctrico · Gomas y aros · Combustible ·
  Torques; each value with a source chip (PRESET · VPIC · TÚ) and a "Verificado" check; "Cargar
  preset" picker by chassis/engine; "Decodificar VIN" button (vPIC) with honest failure copy;
  torque list with photo of the manual page.
- Fluidos: per-kind card with the user's own photo of the engine bay + "cómo revisar" text; shown
  inline in the inspection runner for the matching item ("Aquí está el coolant en tu DS3").
- OBD: search by code, list of events per vehicle (code, fecha, km, resuelto), "Vincular a
  reparación"; code detail with desc ES/EN and generic/manufacturer note.
- Contactos: list by kind with call/WhatsApp buttons; contact detail lists linked records; picker
  in service/mod forms.

## Block E — Pista (`pista/index`, `pista/evento/nuevo|[id]`, `pista/sesion/nueva|[id]`, `pista/pistas`)

- Index: upcoming/past events cards (venue, date, discipline badge, sessions, best lap or runs,
  tires burned), PB strip per venue.
- Event form: vehicle, venue (seeded + add), date, discipline chips (TRACK DAY · DRIFT · DRAG ·
  AUTOCROSS · JUNTE · PRUEBA), weather chips, temps, condition, odometer start/end, costs, notes,
  photos/videos (URL).
- Session: header stats; setup card with `CornerGrid` pressures cold→hot, tire sets f/r, alignment,
  heights, dampers, sway bars, pads/bias; drift extras when discipline = drift; timing block
  (laps, best/second, sectors, 0–100, ¼ mile) when not drift; runs/incidents when drift; feel +
  rating; "Cambiaste desde la sesión N" note; buttons COPIAR A SESIÓN N+1 · COMPARTIR RESUMEN.
- Consumables: "Gomas usadas" picker marks heat cycles; "Goma quemada" retires a tire; pad
  measurement input feeds the reminder.
- Day summary card (shareable image or PDF page): sessions, runs, best lap, gomas quemadas, km en
  pista, RD$.

## Block F — Compartir (`vehiculo/[id]/compartir`, `vehiculo/[id]/libro`, `garaje/miembros`, `invitacion/[code]`)

- Compartir: visibility (privado/link/público), section toggles (placa, VIN, costos, ubicación,
  odómetro, mantenimiento, mods, pista, docs, historia), photo picker (≤ 24 + hero), preview
  button (opens `/c/<slug>` in the browser), copy link / share sheet, "Desactivar link".
- Libro PDF: same toggles + period + "incluir fotos (máx 60)"; generates with pdf-lib; share/
  download; progress.
- Miembros: list with roles; "Invitar" → code/link (7-day expiry, optional email lock); accept flow
  via `carguy://invitacion/<code>` and web `/invitacion/<code>`; role change/remove (owner only);
  viewer mode disables edits with a banner.
