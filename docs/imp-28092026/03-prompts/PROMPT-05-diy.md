# PROMPT 05 — Block D: Ficha técnica, guía de fluidos con tus fotos, códigos OBD, contactos

**Depends on:** Phase 4 · **Branch:** `imp-28092026/phase-5-diy` · **ADR:** 20 · **Size:** M
**Goal:** G4.

> **How to run:** `cd ~/dev2/car-guy && claude`, paste below the line.

---

```
Phase 5 of IMP 28092026: the DIY block.

Read first:
- docs/imp-28092026/02-specs/01-data-model-v2.md §1 (vehicle_specsheet, torque_spec, dtc_code,
  vehicle_dtc_event, contact, fluid_guide_item), §2.3
- docs/imp-28092026/02-specs/03-screens.md (Block D)
- docs/imp-28092026/01-research/02-buildlog-track-community-refdata.md §D (vPIC limits, DTC list,
  honesty pattern)
- docs/imp-17092026/01-research/02-maintenance-checklists-dr.md §A (how-to-check texts reused in
  the fluids guide)

Branch: imp-28092026/phase-5-diy

1. PRESETS lib/domain/specPresets.ts: entries keyed by chassis_code/engine for AE85 (3A-U), AE86 +
   4A-GE 16V, 4A-GE 20V (engine preset), S13 SR20DET / KA24DE, S14, Civic EG/EK D16/B16, Citroën
   C3 A51 TU5JP4 1.6, DS3 SA EP6 1.6 VTi and THP, Corolla E120/E150, Hilux N70, Yaris. Fields per
   the specsheet columns. RULE: only fill values you are confident are standard service data; leave
   the rest null; every preset carries `caveat: "Verifica con el manual de tu carro"`. Include
   `sources` strings (manual/common knowledge) so the UI can show "PRESET". Unit test: every preset
   parses, no field outside the schema.
2. FICHA TÉCNICA app/vehiculo/[id]/ficha (hub tab): sections per 03-screens.md; each value with a
   source chip (PRESET/VPIC/TÚ) and a "Verificado por mí" toggle (writes verified_fields); "Cargar
   preset" picker; "Decodificar VIN" (NHTSA vPIC DecodeVinValues, fetch with a 8 s timeout; fill
   only empty fields; honest failure copy; never blocks); torque list with photo (media owner
   torque_spec); "Ficha lista para el taller" share as text (WhatsApp-friendly plain text block).
   The inspection runner reads psi_oem_f/r and shows them next to the tire item.
3. FLUIDOS app/vehiculo/[id]/fluidos: per-kind cards (aceite, coolant, frenos, dirección, ATF,
   washer, batería, filtro de aire) with the user's photo (PhotoPicker, owner fluid_guide_item),
   "cómo revisar" text prefilled from the DR checklist research, notes; the inspection runner shows
   the matching card inline ("Aquí está el coolant en tu DS3") when it exists.
4. OBD app/obd/index + app/obd/[code] + per-vehicle list in the hub Ficha tab: search by code
   (dtc_code local table), event log (code, fecha, km, resuelto, "Vincular a reparación" → picks or
   creates a reparación record with source), code detail ES/EN + generic/manufacturer note.
   Quick add from the FAB kind picker ("Código OBD").
5. CONTACTOS app/contactos/index|nuevo|[id]: kinds, phone/WhatsApp buttons (Linking:
   `https://wa.me/<number>`), rating, notes, linked records list (service_record.contact_id,
   mod.contact_id); picker component reused in the service and mod forms ("Taller" field becomes
   contact + free text fallback).
6. Historial: OBD events appear as a subtle row kind 'obd' (add to the view in migration v3 —
   this is the first v3 migration: `{version: 3}` recreating history_feed with obd events; mirror
   nothing in the cloud since the view is local). Cifras: none.
7. Flags: FEATURE_DIY = true. Más → DIY section (Contactos, Códigos OBD).
8. Tests: presets, vPIC mapper with a recorded JSON fixture, dtc lookup, WhatsApp link builder,
   migration 2→3.

VERIFY web + Android: DS3 loads its preset (values flagged PRESET), verify two fields, add a
torque with a photo, add a fluids card with a photo and see it in the weekly check, log P0301 and
link it to a repair, create "Taller de Tony" and pick it on a service. Screenshots docs/qa/
phase-5-*. tsc/lint/test/build, verify-sync green. Report, merge, push.
```

---

## Acceptance criteria

- [ ] Presets with honest nulls and caveats; source chips and verification toggle.
- [ ] vPIC decode on demand with graceful failure; chassis code first-class.
- [ ] Fluids guide with the user's photos, surfaced in the inspection runner.
- [ ] OBD lookup + per-vehicle events + link to repair; bundled Spanish table.
- [ ] Contacts with WhatsApp/call, linked to services and mods.
- [ ] Migration v3 (feed with obd); `FEATURE_DIY` on; tests; verify green.

## Watch for

- vPIC returns `ErrorCode` strings like "0 - VIN decoded clean"; parse the leading integer.
- JDM chassis numbers (`AE85-5xxxxxx`) are not VINs — the VIN field validation must allow empty and offer chassis number instead.
- WhatsApp numbers need country code 1 for DR (`1809…`) — normalise.
