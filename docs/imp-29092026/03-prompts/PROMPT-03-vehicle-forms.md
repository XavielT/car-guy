# PROMPT 03 — Vehicle form v2 (pickers, photos, units, price, statuses), oil picker, check photos

**Depends on:** Phase 2 · **Branch:** `imp-29092026/phase-3-forms` · **ADRs:** 26, 33 · **Size:** L
**Goal:** G3 — registering a car is fast and true.

> **Before running:** nothing to approve. Redmi or emulator for the photo strip.
>
> **How to run:** `cd` to the repo folder, `claude`, paste below the line.

---

```
Phase 3 of IMP 29092026: the vehicle form becomes pickers + photos + price + real statuses; oil
becomes a picker in the service form; checks take several photos on falla and atención and show
them in history. Notes 3, 8 (form part), 10, 11, 15 (UI part), 16.

Read first:
- docs/imp-29092026/02-specs/03-screens.md "Phase 3" (both sections) — the order of the form is
  fixed there
- docs/imp-29092026/02-specs/01-data-model-v6.md §1.1, §1.2, §1.5
- docs/imp-29092026/01-research/02-fuel-partial-and-datasets.md §3.3, §4
- components/VehicleForm.tsx, components/PhotoPicker.tsx, components/album/*, lib/media/index.ts
  (pickCandidates multiple, importCandidates), app/vehiculo/[id].tsx (hub header),
  app/servicio/nuevo.tsx, app/chequeo/[templateId]/run.tsx, app/inspeccion/[id].tsx,
  lib/db/inspectionOps.ts, lib/domain/history.ts, components/ui/index.tsx (Chip, Segmented, Sheet)
- docs/imp-28092026/00-context/05-design-jdm.md (Sheet, Chip, list rows)

Branch: imp-29092026/phase-3-forms

1. PICKER KIT (components/pickers/): PickerField (label, value, placeholder, onPress → Sheet),
   SearchSheet (search box with accent-insensitive filter, sectioned list, "Otro…" row that turns
   into a text field, keyboard-safe on Android, modal on web), SwatchGrid (colour circles with a
   check, name under each, "Otro…"), YearWheel (list from currentYear+1 down to 1950, highlighted
   range, jump-to-decade chips). All keyboard/screen-reader accessible; 44 px targets.
2. VEHICLE FORM v2 (split VehicleForm.tsx into components/vehicle/{BasicsSection,PhotosSection,
   IdentitySection}.tsx + the form): order per 03-screens.md. Make → Modelo dependent; choosing
   a make with "Otro" leaves make_id null and stores the text in `make`; same for model. Año: the
   wheel; typed entry still allowed. Tipo: bodyTypes.json chips (body_type) and the legacy `type`
   derived (mapping in lib/domain/vehicleStatus.ts? no — lib/domain/refdata/index.ts
   legacyTypeFor(bodyType)). Color: SwatchGrid → color_id + `color` label; Interior optional.
   Tanque: number + `gal | L` Segmented (volume_unit) — stores liters, keeps
   tank_volume_entered; a caption shows the converted value ("45 L ≈ 11.9 gal"). Precio de
   compra + fecha: visible (note 8), with the currency prefix RD$ and the same parseDecimal.
   Estado: nine statuses (vendido/perdido excluded here as before) + Desde + Nota; saving a status
   change from the edit form inserts a milestone kind 'estado' ("Cambió a ACCIDENTADO · esperando
   piezas") — and the sale sheet keeps doing its own thing. Identidad unchanged.
3. PHOTOS (note 10): PhotosSection = horizontal strip (expo-image thumbs, 96 px), "＋" opens
   camera/gallery choice (multi-select), long-press to reorder (Reanimated drag on native;
   arrows on web), tap → sheet "Portada · Quitar". Backed by album_item role 'vehicle' with
   sort_order and photo_media_id as cover; new photos ingest with source 'import'/'camera' and
   album: true. Hub header shows the cover with "1/N"; tap → viewer pager over the gallery.
   Garaje cards use the cover (Phase 6 restyles the cards; here just make sure every card has a
   cover uri available via garageFacts).
4. STATUS everywhere (note 15): Garaje/hub/switcher use statusLine(vehicle) ("ACCIDENTADO · desde
   12 ago · esperando piezas"); the Tablero pill shows the status; reminders for
   accidentado/en_taller/restauracion keep running (the car will come back) while guardado/
   prestado pause km-based ones (existing isArchivedFor behaviour — document which is which in
   the report). Public dossier shows the status label if the owner enabled "estado".
5. OIL PICKER (note 16): in the service form, for items whose service type is aceite_motor (or
   category fluidos with "aceite" in the name), an "Aceite" block: Viscosidad (grid from oil.json
   grades), Tipo chips, Marca (SearchSheet with brands + Otro), Especificación (multi-select chips
   API/ILSAC/ACEA → joined string). Saved in the four columns; rendered in the record detail,
   Historial row subtitle and the catalog's last-service line. Prefill from the previous oil
   record of the same vehicle ("Igual que la última vez: 5W-30 sintético Castrol").
6. CHECK PHOTOS (note 3): run.tsx — on falla AND atencion: note + PhotoStrip (≤ 5, camera/gallery,
   ownerTable inspection_result). inspeccion/[id].tsx shows thumbs per item → viewer. Historial
   `chequeo` rows show "📷 N" (count from media by owner). Album timeline: check photos appear
   under "CHEQUEO · <item>" (albumQueries: include media with owner_table inspection_result for
   that vehicle). Verify service-record and mod photos are in Historial rows and the timeline;
   add if missing (Phase 0 audit (f) says which).
7. STRINGS in es.ts; TESTS: refdata mapping, legacyTypeFor, statusLine, oil rendering,
   milestone-on-status-change, gallery cover promotion on delete, form validation (year wheel
   bounds, tank unit conversion).
8. Flags: none new (these replace existing screens).

VERIFY web + Android: register the C3 from scratch through the pickers in < 90 s with 3 photos,
status ACCIDENTADO desde <date> "esperando piezas" (screenshot the Garaje card); edit the DS3 tank
in L then in gal (same liters stored); service "Aceite de motor" with 5W-30 sintético Castrol →
Historial shows it; weekly check with a falla + 2 photos → Historial "📷 2", album timeline shows
them. Report block; notes closed: 3, 10, 11, 15, 16, and the form half of 8.
```
