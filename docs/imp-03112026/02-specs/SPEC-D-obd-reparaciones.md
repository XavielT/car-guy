# SPEC-D — OBD diagnosis and repairs (answer "OBD diagnosis and repairs")

Today (verified): `app/obd/index.tsx` + `[code].tsx` look a code up in the **bundled** `dtc.es.json` (offline, deterministic Spanish glossary), keep `VehicleDtcEvent` history and offer "Create repair" (`diyQueries`, `servicio/nuevo?kind=reparacion`). Repairs are `ServiceRecord kind='reparacion'` with items, `done_by`, shop contact, photos with role, warranty, `sourceTaskId`, pending link (ADR-61). Keep all of that; AI sits **on top**, and the bundled lookup remains the offline answer.

## D1. `cg-ai-obd` — "Explain this code for my car"
- Button on `obd/[code]` (and after adding a code): sends code(s) + vehicle facts (make, model, year, engine, fuel, odometer, transmission, origin JDM/USDM) + **this car's history**: same code seen before (dates), repairs/parts in the last 24 months in the same system, current pending events.
- Returns (forced tool schema, es-DO plain words, no jargon wall): `can_drive: 'yes'|'careful'|'no'` with a one-line reason · ranked causes (3–5) with likelihood label (probable/possible/rare) and why it fits **this** car's history · what to check first (free/cheap steps) · DIY vs shop · rough cost range in RD$ per cause **labelled as an estimate** · "when to stop and call a tow" · related codes to look for. If the same repair was done recently (e.g. new O2 sensor 4 months ago) it says so and moves that cause down.
- Output is cached per (vehicle, code, history hash) in `ai_insights` (SPEC-E) so re-opening costs nothing; a "Refresh" button re-asks.
- Actions (closed list): "Create repair" pre-filled with the top suspect as title and the parts as items (status pending), "Add task", "Remind me to re-scan in N days".
- Honesty rule baked into the system prompt and shown in the UI: it is guidance, not a diagnosis; never says a car is safe to drive when `can_drive` is uncertain; safety-critical systems (brakes C/chassis codes, airbag B-codes, overheating, oil pressure) default to `careful`/`no`.
- Multi-code input: scanning a list typed or pasted (e.g. from an ELM327 app screenshot) — see D3.

## D2. Dashboard warning-light photo (`cg-ai-read` kind `dash_lights`)
Photo of the cluster with lights on → list of recognised telltales (name, colour, meaning, urgency) mapped to the registry's telltale ids (`check`, `oil`, `coolant`, `battery`, `tire`, `brake`) → opens the right feature (OBD for check engine, reminders for oil…) with an "add reading" suggestion. Lives behind the same Herramientas entry as OBD ("Photo of warning light").

## D3. Scanner screenshot / typed list → codes
Paste or photo of a scanner app screen (Torque, OBD Fusion, Car Scanner…) → extract codes (+ freeze-frame values if visible: rpm, coolant temp, load, speed) → creates `VehicleDtcEvent`s for the person to confirm, then D1 on the set (codes read together are explained together).

## D4. Repairs workflow upgrades (invoice → repair)
- **Invoice photo → repair**: SPEC-B `invoice` kind on `servicio/nuevo?kind=reparacion`: shop, items split parts/labour, total, warranty text → fills items, `done_by='shop'`, shop contact, warranty months/km (deterministic parse of "garantía 6 meses / 10,000 km"), invoice photo with role `invoice`.
- **"Is this price fair?"** (deterministic first): compare the repair/part total against the person's own history for the same category/part and, when available, community medians already in the catalogue; show "+38 % vs your last brake job". AI only adds one plain sentence. No invented market prices: if there is no baseline it says so.
- **Warranty watcher**: a repair with warranty and an expiry → reminder suggestion; a new repair in the same system within warranty → "This part may still be under warranty (Taller Pérez, until 12 Jan)" banner. Pure logic in `lib/domain/repairs.ts`.
- **Closing the loop**: when a repair is saved from an OBD code, offer "Clear/re-scan the code" reminder and mark the matching `VehicleDtcEvent` resolved (the pending → resolved link ADR-61 already supports).

## D5. Acceptance
For a car with history, the explanation cites that history; `can_drive` is conservative for safety systems (eval cases); offline shows the bundled lookup with "AI explanation needs connection"; a warning-light photo opens the right feature; an invoice photo creates a complete repair record; price comparison uses only the person's data; es/en; cost per explanation recorded in `ai_usage`.

## D6. Evals
`evals/ai/obd.json` — 25 cases (P0300, P0420, P0171, P0128, C0035, B0010, U0100, mixed lists, JDM-specific codes, a code repeated after a recent repair); assertions: contains `can_drive` per expectation, no invented part numbers, cites history when present, never returns a dollar figure (RD$ only), valid schema.
