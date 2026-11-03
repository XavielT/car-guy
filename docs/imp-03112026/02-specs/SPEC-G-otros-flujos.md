# SPEC-G — Other places where AI improves a workflow (answer "anywhere else it applies")

Found by studying the app's modules and SGC's matrix (`IA-FLUJOS-ROLES.md`). Each item is small, reuses SPEC-A's gateway, follows ADR-67, and ships behind its own `FEATURE_*` flag (default **on** unless the item says otherwise) so any one can be switched off if it disappoints.

## G1. Smart search / quick add in Herramientas (not a chatbot)
The hub search (ADR-62) matches registry keywords today. Add: if the typed text is not a feature keyword (or the person taps the mic), send it to `cg-ai-intent` (SPEC-B §B3): "when is my marbete due", "how much did I spend on gas in October", "show my brake repairs" → **navigate** to the right screen with the right filter/period (closed list of targets), or open a pre-filled form. Answers to "how much / how many" are computed by existing stats queries and shown as a result card (number + link), never produced by the model.

## G2. Album and build log: photo understanding (`FEATURE_AI_ALBUM` shipped on; each person opts in on first use)
Importing photos (`album/importar`): suggest caption, angle (front, rear, side, interior, engine bay, wheels, detail) and **"looks like a change since the last photo"** (new wheels, paint, lip, exhaust) as a *Milestone/Mod suggestion*, grouped by date (EXIF already read by `lib/media/exif`). Cost-guarded: batch ≤ 12 photos per import, downscaled to 768 px, one call per batch. Mod entries from a photo of the part box/invoice use SPEC-B `part_label`/`invoice` (brand, part number → Mod, Wishlist→Installed link, Inventory). Reason it starts opt-in: photo history is the personal, emotional core of the app and the volume is the largest cost driver.

## G3. Trips and Conducir (deterministic first)
- End-of-trip summary line (distance, duration, avg/max speed, estimated fuel from the gauge model) and "eco" tips are **computed**; the AI is not needed. The only AI use: **name the trip** from start/end context (text only). The label source must be MapTiler Geocoding or the person's saved places - **not Google** (Geocoding/Places ToS forbid use alongside a non-Google map; the trip screen has a MapLibre map). PROMPT-00 note.
- Auto-detected trips with no purpose: suggest a label (commute / track / junte / errand) from time-of-day and repetition — deterministic clustering, no AI.
(Recorded as "considered": AI over GPS traces was rejected — low value, privacy cost, location is the most sensitive data Car Guy holds.)

## G4. Places (server-side, lists only — ADR-69, `FEATURE_GOOGLE_PLACES`)
`cg-places`: text search "gomera / taller / gasolinera / lavado cerca de mí" (location from the already-granted foreground permission, rounded to ~500 m before sending) → list with name, address, phone, rating, open now, **Google attribution**, "Open in Google Maps" (external), and **"Add as contact"** pre-filling `contactos/nuevo` (kind per query). Also: after a repair, "Who did this?" suggests nearby shops when the shop field is empty. Daily per-user limit (`ai_limit_places_user_day`). Never shown on MapLibre **and never on a screen that has a map**. PROMPT-00 verdict (Places ToS 14.1-14.3): `FEATURE_GOOGLE_PLACES` default OFF; "Add as contact" must not persist Google name/phone/address - with the flag off the same UI is fed by MapTiler Geocoding / OSM Overpass. Result caching only as the terms allow (place id may be stored; other fields are not cached beyond the session unless the terms say so — PROMPT-00 records it).

## G5. Fuel station and price assist
Receipt reading (SPEC-B) already yields station + price: feed it to `fuel_price` as a `recibo` source (existing `FuelPriceSource`) when the person agrees, so community prices improve; compare to MICM reference and show "paid RD$ 12 more per gallon than the weekly reference" (deterministic). No AI beyond the read.

## G6. Checklist (`chequeo`) with photos
During a weekly check, an item can take a photo (tire tread, fluid level on the dipstick, coolant colour, leak under the car); `cg-ai-read` kind `check_photo` (item type passed in) returns an observation + pass/watch/fail **suggestion** the person accepts or overrides; fail already creates a task/reminder via `OnFail`. Tread depth and "milky oil" style findings use hedged language and never replace measurement.

## G7. Insurance/accident events
Accident event (`evento` type accident): photos of damage → description draft (areas, severity guess leve/moderado/grave as `EventSeverity` suggestion), plus the document checklist (seguro, matrícula, denuncia) from deterministic rules. No claim advice, no liability statements.

## G8. Garage sharing and community
Not given AI in this cycle (privacy and noise). Recorded so it's a conscious "no": no AI in Juntes chat, profiles, follows or public pages.

## G9. Report writer for the Libro / sale sheet
"Sale-ready summary" (`vehiculo/[id]/libro`): a factual 1-page text generated from the records (maintenance cadence, repairs with dates/costs, mods, documents valid) — model writes prose from a facts JSON, numbers validated like SPEC-E, person edits before export. Optional bilingual (es/en) for foreign buyers.

## G10. Acceptance
Each shipped item has its flag, its eval or unit test, its cost line in `ai_usage`, and an off-switch in Admin → Uso y costos; items written "considered/rejected" appear in ADR notes so the decision is traceable.
