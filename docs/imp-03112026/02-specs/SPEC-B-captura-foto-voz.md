# SPEC-B — Capture by photo and voice (P2, P2a; answer "photo/voice capture")

Goal: the dull part of Car Guy is typing. Every record the person already creates can be started from a photo or a sentence. Same forms, same Save; AI only pre-fills (ADR-67).

## B1. `cg-ai-read` — kinds (forced tool schema per kind, confidence per field, `unreadable` when the image is not that thing)
| kind | Photo of | Fields | Fills |
|---|---|---|---|
| `fuel_receipt` | pump-station ticket (RD) | total, gallons, unit price, product, station, date/time, NCF, pump | `carga/nueva` (`FillUpForm`) |
| `pump` | dispenser display | gallons, amount | cross-check vs receipt; fills if no receipt |
| `odometer` | instrument cluster | odometer km (or mi), unit shown, trip A/B if visible | `FillUpForm` odometer field and `/odometro` |
| `invoice` | shop/parts invoice | shop name, RNC, NCF, date, line items (desc, qty, unit price, kind part/labour), subtotal, ITBIS, total, warranty text | `servicio/nuevo` (items = `ServiceRecordItem`, shop = Contact match/create, `invoice` media role) and `gasto/nuevo` |
| `part_label` | part box / oil bottle / tire sidewall | brand, part number, spec (e.g. 5W-30, 205/55R16 94V, DOT date) | Part/Inventory, oil type/spec, tire record |

Reuse from SGC (read-only reference, port don't import): prompts and JSON shape of `supabase/functions/leer-recibo/index.ts` (fuel receipt + generic invoice, RNC/NCF rules). Adapt: per-field confidence, forced tool use, Dominican formats (RD$, `1,234.50`, DD/MM/YYYY, NCF `B01…`/`E31…`).

## B2. Where the capture buttons live (client)
- `carga/nueva`: "Scan receipt", "Photo of the dashboard" (odometer) — both at the top of `FillUpForm`; after reading, the review sheet (`FillUpReviewSheet`) still runs and the **duplicate check** (`fillupDedupe.ts`) still runs; an odometer lower than the last reading, or a gallons×price ≠ total mismatch > 3 %, is flagged inline (deterministic, not AI).
- `servicio/nuevo` (maintenance/repair): "Scan invoice" → items table, shop, total, warranty, photo attached with `role='invoice'`.
- `gasto/nuevo`: "Scan receipt".
- Vehicle form (`vehiculo/nuevo`, `[id]/editar`): handled in SPEC-C.
- Every button uses `useAiStatus()`; camera/gallery go through the ADR-59 permission registry and the existing `PhotoPicker`/`lib/media/compress.ts` (max 1600 px long side, JPEG ~0.8, HEIC converted). Web: file picker, **paste (Ctrl/Cmd+V)** and drag-drop (desktop layout, SPEC-F).
- A field the AI filled shows a small "AI" mark; confidence < 0.6 shows an amber outline and "check this"; editing the field clears the mark. The mark never persists in the saved record.

## B3. Voice and free text → draft: `cg-stt` + `cg-ai-intent`
- A mic button in the Herramientas hub search bar, in Inicio's quick actions ("Dictate"), and inside each form header. Hold-to-talk or tap-to-start/stop, ≤ 30 s, waveform + timer, cancel. es-DO by default, language from app setting.
- `cg-stt`: audio → text (provider per SPEC-A). The transcript is shown and editable before anything else happens.
- `cg-ai-intent` (also accepts typed text from the hub search): input = text + minimal context (active vehicle id/name, last odometer, fuel type, date, the registry's feature ids); output = `{ target: 'fuel'|'service'|'repair'|'expense'|'odometer'|'reminder'|'task'|'event'|'obd'|'navigate', fields, confidence }`. Examples: "eché 12 galones de premium a 2,150 en el Shell, 84,300 km" → fuel; "cambié aceite y filtro con Taller Pérez, 3,800 pesos" → service (kind mantenimiento); "me pusieron los frenos nuevos en la gomera de Juan, 9 mil" → repair; "recuérdame el marbete el 15 de diciembre" → reminder.
- Result opens the **same screen** with the form pre-filled (route params / draft store). Ambiguity ("which car?" when several) → the person picks; never guessed silently.
- This is not a chat: one utterance in, one prefilled form out; no history, no free conversation.

## B4. Offline / failure behaviour
Offline: buttons show "needs connection", photo can still be attached manually. `unreadable` → "I couldn't read that photo" + tips (light, flatten, closer), form untouched. 429/cap → the human message from `useAiStatus`. A failed read is never charged against the person's visible quota but is logged in `ai_usage` with `ok=false`.

## B5. Evals (`evals/ai/`)
Golden sets per kind: generate synthetic images (PIL or canvas) for receipts/odometers/invoices in the RD format plus a README to drop Xaviel's real photos in `evals/ai/real/` (gitignored). `node evals/ai/run.mjs --kind fuel_receipt` calls the deployed function with a test account and scores field accuracy; target ≥ 90 % on synthetic, report real-photo results separately. Record the numbers in PROGRESS.

## B6. Acceptance
Fuel, service/repair and expense can each be started from a photo; odometer from the cluster photo; one sentence (voice or typed) opens the right pre-filled form; nothing saves without the person; the duplicate and odometer sanity checks still fire; all strings es/en; mic permission goes through the registry; works on the APK (native recorder) and web (MediaRecorder; Safari verified).

## B7. Fuel Express — two photos, one Confirm (P9)
Xaviel (03-nov): "I give it a photo of my dashboard and a photo of the receipt, it reads them with AI, fills the form fields, and I only have to tap confirm."

**The flow (this is the primary way to log fuel once AI is on; the manual form stays one tap away: "Llenarlo a mano")**
1. Hoy → big action **Cargar gasolina** (SPEC-K) → the camera opens immediately (no intermediate screen). Prompt: "Foto del tablero" then "Foto del recibo" — either order, either can be skipped ("No tengo recibo" / "No tengo el tablero"), a gallery pick and web paste/drop work too (desktop).
2. Both photos are sent **in one call**: `cg-ai-read` kind `fuel_express` (≤ 4 images). The model classifies each image (`dashboard | receipt | pump | other`) so order does not matter, and returns **one merged object**: `odometer` (km/mi + unit shown), `trip_a/b` if visible, `fuel_level_fraction` (gauge reading, low confidence, a hint only), `receipt` fields (total, gallons, unit price, product, station, date/time, NCF), `pump` cross-check, plus `per_image` classification and per-field confidence. Forced tool use, same schema machinery as §B1; the SPEC-B kinds `fuel_receipt`/`odometer` stay for single-photo use.
3. **One confirmation screen** ("Confirmar carga"): a single summary card — vehicle · date · km · gallons · price/gal · total · product · station · "tanque lleno" — each value editable in place; the two photos as thumbnails. One big button: **Confirmar**. Saving attaches the receipt as `role='invoice'` and the dashboard photo as odometer evidence (existing media roles; add `role='odometer_photo'` only if no equivalent exists — additive enum, schema v13).
4. **Smart, not silent**: if every field has confidence ≥ 0.6 and all deterministic checks pass, the card is compact and **Confirmar is the only thing to do**. If a check fails the failing field expands with a plain question and a suggested fix, still one screen: odometer below the last reading ("Antes tenías 84,300 — ¿es 84,830?"), gallons×price vs total off > 3 %, date older than 7 days, gallons larger than the tank, unit price outside a plausible band vs the last price / MICM reference, **dashboard shows a different unit (mi) than the vehicle's** (offer conversion). The **duplicate check** (`fillupDedupe.ts`) still runs before saving and the existing review sheet logic is reused, not rewritten.
5. **Defaults the person never has to type**: vehicle = active (or the vehicle whose last odometer is closest to the photo's reading when several, shown as a switch chip), date/time = receipt or now, fuel type = last used unless the receipt says otherwise, **tanque lleno = yes** unless the gauge hint is clearly low *and* gallons are small (then asks: "¿Fue una carga parcial?"). Station = from receipt, matched to an existing contact/station if any.
6. **Offline**: photos are saved to the **local queue** (`ai_queue`, schema v13: id, kind, local image paths, vehicle id, created_at, status, attempts) and the person sees "Guardado — te aviso cuando esté listo"; when the connection returns the queue is processed (foreground, or the existing background sync if present) and a local notification says "Tu carga está lista para confirmar"; opening it shows the confirmation screen. They can also tap "Llenarlo a mano" at any time (the queued item is then dropped). Queue items expire after 7 days and cost nothing until processed. Queue respects the gateway's limits and consent (403 → stop and explain).
7. **Failure behaviour**: one photo unreadable → keep what was read from the other and ask only for the missing fields; both unreadable → "No pude leer las fotos" + tips and the manual form with the photos still attached; 429/cap → the gateway's human message.
8. Image handling: compress per §B2 (≤ 1600 px long side, JPEG ~0.8; downscale to 1280 px for this kind to cut tokens), strip EXIF GPS before upload, discard on the server after the read (never stored, never logged).
9. Cost and speed: ~2 images on the vision model ≈ US$0.01 per express read; target p50 ≤ 6 s end to end on mobile data; show a determinate-feeling progress ("Leyendo tablero… Leyendo recibo…") not a spinner alone; everything between the photos and the card is cancellable.

**Acceptance (B7)**: from the camera to a saved fill-up in **two photos and one tap** on the happy path (Playwright with fixtures + manual real-photo test on the Redmi and iPhone PWA); sanity checks and dedupe fire; offline queue round-trips (airplane-mode test); `fuel_express` eval set (synthetic dashboard+receipt pairs, ≥ 90 % field accuracy on synthetic; real pairs scored separately in `evals/ai/real/`); nothing is saved without the Confirm tap; the manual path is untouched.
