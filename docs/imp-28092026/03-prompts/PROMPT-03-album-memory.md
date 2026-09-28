# PROMPT 03 — Block C: Álbum, línea de tiempo, importar fotos viejas, hitos, "así estaba", Ex

**Depends on:** Phase 2 · **Branch:** `imp-28092026/phase-3-album` · **ADRs:** 18, 23 · **Size:** L
**Goal:** G2 — the Jetta problem never happens again.

> **Before running:** an Android device/emulator with photos in the gallery (Expo Go works for
> `expo-media-library` but test the final permission flow in a dev build or the preview APK).
> `sql/011_storage_v2.sql` needs `--shared` (storage policies) — the prompt lists the statements.
>
> **How to run:** `cd ~/dev2/car-guy && claude`, paste below the line.

---

```
Phase 3 of IMP 28092026: the vehicle album — photos with real dates, synced with thumbnails,
imported from the phone's gallery by month, milestones, the "así estaba el carro" view, and Ex
vehicles with their whole story.

Read first:
- CLAUDE.md → AGENTS.md; Expo 57 docs for expo-media-library (Query/AssetField API + plugin
  granularPermissions), expo-image-picker (allowsMultipleSelection, exif), expo-image
  (placeholder blurhash, recyclingKey, cachePolicy), expo-image-manipulator, react-native-gesture-handler.
- docs/imp-28092026/01-research/03-expo57-photos-storage-sharing.md §1, §2, §6 (verified APIs,
  code snippets, exifr on web, FlatList/expo-image guidance, zoom modal)
- docs/imp-28092026/02-specs/01-data-model-v2.md §2.1 (album domain), §1 media/album/milestone
- docs/imp-28092026/02-specs/02-cloud-v2.md §3 (storage v2: thumbs, quota policy)
- docs/imp-28092026/02-specs/03-screens.md (Block C)
- docs/imp-28092026/00-context/05-design-jdm.md (Timeline component, Álbum artboard) and
  docs/imp-28092026/01-research/04-mockups/Album.dc.html
- lib/media/index.ts, lib/sync/mediaBytes.ts

Branch: imp-28092026/phase-3-album

1. MEDIA PIPELINE v2 (lib/media): pickPhotos({multiple}) and importFromLibrary(assets) share one
   ingest(): read taken_at BEFORE compressing (Android: asset.getExif().DateTimeOriginal →
   getCreationTime(); web: exifr lite from the File → lastModified), compute blurhash
   (expo-image Image.generateBlurhashAsync), write full (1600/q0.75) and thumb (400/q0.6) (Android
   files: media/<vehicleId>/<id>.jpg + .thumb.jpg; web: blob + thumb_blob), insert media with
   taken_at/date_precision/source/width/height/size, and album_item. Duplicate detection per
   §2.1. useMediaUri gains {thumb: true}. Sync: mediaBytes uploads both objects
   (remote_path + remote_thumb_path), downloads thumb first, full on demand; signed URLs cached in
   memory with expiry. "Guardar original en Google Fotos/Drive": Android share sheet with the
   uncompressed asset URI right after picking (opt-in toggle in the confirmation sheet); web:
   download the original.
2. PLUGIN + PERMISSIONS: npx expo install expo-media-library exifr; app.json plugin
   ["expo-media-library", { "photosPermission": "Car Guy usa tus fotos para armar el álbum de tu
   carro.", "granularPermissions": ["photo"] }]; handle accessPrivileges 'limited' with a banner
   + presentPermissionsPickerAsync; web: no media-library import (guard).
3. IMPORT SCREEN app/album/importar (Android): year → month grid with counts (Query
   exeForMetadata), month photo grid (thumbs via asset uri, 3-up, checkboxes, "Seleccionar mes"),
   confirmation sheet (detected dates, precision chips día/mes/año, "todas estas son de <mes>"
   override, target vehicle, "guardar originales en Google Fotos"), progress with cancel,
   result "N importadas, M duplicadas". Web: file input multiple → same sheet.
4. ÁLBUM screen app/vehiculo/[id]/album (hub tab Álbum): Grid | Timeline toggle; year scrubber
   (from ownership.acquired_at or first photo to today/sold_at); Timeline per §2.1 with month
   headers + odometer, item kinds (HITO/MEJORA→MOD/JUNTE/MANTENIMIENTO/PISTA/FOTOS), 3-up thumbs,
   before/after pairs from mod_media roles, "+N"; storage chip in the header (from
   storage_usage_bytes RPC cached in setting.storage_used_bytes, quota from profiles). FlatList
   with getItemLayout (flattened rows) — FlashList only if it proves needed on Android.
5. PHOTO VIEWER app/foto/[id]: modal pager (horizontal FlatList) with pinch/pan zoom
   (gesture-handler + reanimated, ~120 lines, works on web), caption edit, "Fecha real" (DateField
   + precision), favourite star (drives hero + public page later), "Guardar original…", soft delete.
6. HITOS app/hito/nuevo|[id]: kind chips, date, km, title, story, cover, attach photos; shows in
   Timeline and Historial (kind 'hito').
7. "ASÍ ESTABA" app/vehiculo/[id]/album/estado: date slider across ownership; stateAt() → photos,
   mods (from Phase 1 seed mods; full build UI is Phase 4), odometer, specs summary; "Fijar como
   snapshot" → spec_snapshot.
8. EX VEHICLES: Garaje → EX cards open the hub in read-only mode with a "Editar historia" unlock;
   the hub header shows "<acquired> → vendido <sold> · N fotos"; the album import works for Ex
   vehicles (that's the Jetta use case). Vehicle switcher never shows vendido/perdido.
9. STORAGE: apply sql/011_storage_v2.sql with --shared (only these statements: create/replace the
   carguy-media insert policy with the quota check; add the thumb path shape is implicit). Meter
   in Más → Cuenta and album header; at 90 % warn; at 100 % pause uploads with a Spanish message
   (local keeps working). Backup v2 export excludes thumb bytes (regenerable) — document.
10. Flags: FEATURE_ALBUM = true when done. Historial feed shows 'hito' rows.
11. Tests: album domain (timeline grouping by precision, stateAt, duplicate detection), ingest
    date resolution (EXIF string parse, fallbacks), thumb pipeline (pure parts), storage meter
    thresholds.

VERIFY: Android — import ≥ 20 old photos of one vehicle by month with real dates; album grid
scrolls smoothly; timeline groups correctly; viewer zooms; sync to the web shows thumbs then full;
storage meter moves; Jetta as Ex with story + photos. Web — file import with EXIF dates; same
album. Screenshots docs/qa/phase-3-*. tsc/lint/test/build, verify-x-core, verify-sync green.
Report, merge, push.
```

---

## Acceptance criteria

- [ ] Media rows carry `taken_at` (+precision), `source`, thumbs, blurhash; sync uploads/downloads both objects.
- [ ] Android month browser import with dates; limited-access banner; web multi-file import with EXIF.
- [ ] Album grid/timeline per spec; year scrubber; before/after pairs; storage chip.
- [ ] Photo viewer with zoom, caption, real date, favourite, original save, soft delete.
- [ ] Milestones create/edit; appear in timeline and Historial.
- [ ] "Así estaba" view + snapshot pin.
- [ ] Ex vehicles read-only hub + album import works for them.
- [ ] Quota policy applied (`--shared`), meter thresholds, upload pause at 100 %.
- [ ] `FEATURE_ALBUM` on; tests added; verify scripts green; screenshots.

## Watch for

- EXIF `DateTimeOriginal` has no timezone — parse as local time.
- `expo-image-manipulator` strips EXIF — never read the date after compressing.
- Android 14 partial access returns only selected assets; the month counts will look "empty" — say so in the UI.
- Do not upload full-size images for the grid; egress is the tighter limit (5 GB/month shared).
- `expo-media-library` is Android/iOS only — every import path is guarded on web.
