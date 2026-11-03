# SPEC-C — Vehicle documents and vehicle onboarding (answer "vehicle documents")

## C1. Documents → data + reminders (`cg-ai-read`, kinds `doc_matricula`, `doc_seguro`, `doc_marbete`, `doc_licencia`, `doc_revision`, `doc_garantia`)
- Entry: `documento/nuevo` gets "Scan document" (photo, gallery, or PDF → first page rendered to image with the existing PDF tooling). The model first **classifies** the document (kind) then extracts: title/issuer, policy/plate/number, **issued date, expiry date**, covered vehicle (plate/VIN/make/model/year), insurer, coverage type, premium if shown.
- Pre-fills `DocumentKind`, title, `issuedAt`, `expiresAt`, notes (policy no., insurer); the photo becomes the document media. Saving already links a reminder through `documentOps` (`result.linked`) — keep that exact path, so the expiry becomes a legal reminder (marbete/seguro/licencia/revisión) with the existing lead times.
- **Wrong car guard**: if the extracted plate/VIN differs from the active vehicle's, show "This looks like it belongs to <plate>" and offer to switch vehicle or save anyway.
- Privacy: cédula, owner name and address may appear on the document. The function asks the model **not to return** cédula/address (only plate, VIN, vehicle description, dates, insurer); the image is never stored by the function; the person's own copy stays in their media.

## C2. New-vehicle onboarding from the matrícula or the VIN plate (`vehiculo/nuevo`)
- "Scan matrícula" → make, model, year, color, plate, VIN/chasis, engine/cc, fuel type, seats; "Scan VIN" (windshield/door-jamb sticker) → VIN. Existing `lib/domain/vpic.ts` (NHTSA decode) then completes spec data from the VIN — **deterministic enrichment after AI reading**; conflicts (AI vs VPIC) are shown, VPIC wins for specs, the document wins for plate/color.
- `part_label`/sticker reads also feed Ficha facts (`VehicleFact`: tire size and pressure from the door-jamb sticker, oil spec from the cap, paint code), Fluidos and `oilInterval`.
- Fields go through the pickers (`SelectField`, ADR-60) and the oil-synthetic round trip (ADR-63): add the new AI-filled fields to the **round-trip test** so "it does not save" can't come back.

## C3. Expiry intelligence (deterministic, in `lib/domain/predict.ts`, SPEC-E)
Documents with an expiry and no reminder get a "Create reminder" suggestion; an expired document turns the **Marbete y seguro** telltale red (already exists) — nothing new in UI beyond the suggestion.

## C4. Acceptance
A matrícula photo creates a correct document + a reminder at the right date; scanning the same document for another car triggers the wrong-car guard; a new vehicle can be created from a matrícula + VIN with no typing besides corrections; all AI-filled fields are in the round-trip test; es/en strings; privacy rules above tested (a fixture with a cédula must not come back in the response).
