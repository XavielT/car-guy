# AI workflow map — where AI goes INSIDE the real workflows (audit trail)

Audit of `C:\dev2\car-guy` on 2026-11-03 (branch `imp-03112026`, 2.6.0, local schema v12). Method: every file under `app/` (111 `.tsx`, 107 screens + layouts), every module in `lib/domain` (44 `.ts` + `refdata/`), `lib/trips` (25), `lib/media` (10), `lib/features` (5), the form components they render, the table definitions in `lib/db/migration*.ts`, and the SPECs B..K + BRIEF.

Rules applied to every block (ADR-67/68, BRIEF "Honest notes"):
- AI **pre-fills the existing form**; the person confirms; nothing saves by itself.
- **Numbers are computed by pure code**; the model only phrases, classifies or reads a photo.
- Actions come from the **closed list**: `create_reminder`, `open_obd`, `log_fuel`, `open_service`, `open_document`, `add_task`.
- Needs **account + connection**; signed-out/offline leaves the manual form untouched.
- Verified today: **no AI code exists in the repo** (no `cg-*`, `useAiStatus`, or Anthropic reference in `app/`, `components/`, `lib/`).
- Convention: "(verified)" = read in code; fields are the form's real state names. `Fx` = SPEC section.

Reality checks that change the SPECs (found while auditing):
1. SPEC-E E1 plans a new `predict.ts` with `kmPerDay` and projected due dates. **Both already exist**: `lib/domain/odometer.ts` `kmPerDay()` (median, 90-day window, `buena|estimada|baja`, `FALLBACK_KM_PER_DAY = 35`) and `lib/domain/reminders.ts` `evaluate()` returns `predictedDueDate`, `confidence`, `dueKm`. `predict.ts` should wrap/extend them, not re-implement them.
2. SPEC-C lists `doc_revision`, but `DocumentKind` (`lib/db/types.ts:340`) is `seguro | marbete | matricula | licencia | factura | garantia | otro` and `documentOps.ts` only links `seguro/marbete/licencia` to reminders. `revision_tecnica` exists as a `LegalKind` and seed reminder but has no document kind: either add the kind (additive) or map it to `otro`.
3. SPEC-B/Fuel Express mention an `odometer_photo` media role. `media` has **no role column**; roles exist only on `service_media` (`before|after|invoice|other`, CHECK in `migrationV12.ts`), `mod_media` and `album_item.role`. A fuel log has no photo link at all today, so the receipt/dashboard photo needs a new owner link (schema v13), not just an enum value.
4. SPEC-D "close the loop" is **partly built**: `lib/db/diyQueries.ts` already has `createRepairForDtc`, `linkDtcRepair`, `setDtcResolved`, `repairsFor`.
5. SPEC-D4 warranty watcher: `lib/domain/repairs.ts` already has `warrantyEnd`, `warrantyState`, `isWarrantySoon` (verified exports). The banner for a *new* repair in the same system is the missing part.

---

## Summary table

| # | Workflow | AI touchpoint | Spec | Privacy |
|---|---|---|---|---|
| 1 | Fuel fill-up (`carga/nueva`, `[id]/editar`) | Fuel Express (2 photos, 1 Confirm), receipt, odometer photo, voice | SPEC-B §B1/B2/B3/B7 | med |
| 2 | Fuel detail / economy (`carga/[id]`, historial) | 4-state fuel anomaly badge + phrased reason | SPEC-E §E1/E3 | low |
| 3 | Service maintenance (`servicio/nuevo`) | Invoice photo, part label, voice, "same as always" stays | SPEC-B §B1/B3, SPEC-C §C2 | med |
| 4 | Repair (`servicio/nuevo?kind=reparacion`, `servicio/[id]`) | Invoice to repair, fair-price sentence, warranty watcher | SPEC-D §D4 + SPEC-B §B1 | med |
| 5 | Repairs list (`vehiculo/[id]/reparaciones`) | Warranty banner/fair-price from own history | SPEC-D §D4 | low |
| 6 | OBD (`obd/*`, `DtcPieces`) | Explain code for this car, scanner screenshot, warning-light photo | SPEC-D §D1/D2/D3 | low |
| 7 | Expense (`gasto/*`) | Receipt scan, voice | SPEC-B §B1/B3 | med |
| 8 | Reminders (`recordatorio/*`, `ReminderForm`) | Projection line; voice create; insight to `create_reminder` | SPEC-E §E1/E2, SPEC-B §B3 | low |
| 9 | Documents (`documento/*`) | Scan doc to fields + reminder, wrong-car guard | SPEC-C §C1 | HIGH |
| 10 | New vehicle (`vehiculo/nuevo`, `onboarding`, `bienvenida`) | Scan matricula / VIN, VPIC enrichment | SPEC-C §C2 | HIGH |
| 11 | Edit vehicle (`vehiculo/[id]/editar`) | Same scans (fill empty fields only) | SPEC-C §C2 | HIGH |
| 12 | Ficha / "Lo que uso" (`ficha`, `FichaTab`) | Sticker/part-label read to `vehicle_fact` / specsheet | SPEC-C §C2 + SPEC-B `part_label` | med |
| 13 | Fluids (`fluidos`) | none (photos are the person's own guide) | none | low |
| 14 | Weekly check (`chequeo/*`, `inspeccion/*`) | Photo observation (G6) + NEW voice dictation of answers | SPEC-G §G6 + **NEW N1** | low |
| 15 | Tasks (`tarea/*`, `tareas`) | Voice task, OBD/insight `add_task` | SPEC-B §B3, SPEC-D §D1 | low |
| 16 | Odometer (`odometro`) | Dashboard photo | SPEC-B §B1 `odometer` | low |
| 17 | Hoy / Inicio (`(tabs)/index`) | Car Health insights, Fuel Express big action | SPEC-E §E2/E3, SPEC-B §B7, SPEC-K | low |
| 18 | Herramientas hub + search (`herramientas`, `mas`) | Intent box (text/voice), numbers from stats | SPEC-B §B3, SPEC-G §G1, SPEC-K §K4 | low |
| 19 | Historial (`(tabs)/historial`) | Intent-driven filter via G1 (no own AI) | SPEC-G §G1 | low |
| 20 | Fuel prices (`precios/*`) | Price from receipt (G5) + **NEW** price-board photo | SPEC-G §G5 + **NEW N2** | low |
| 21 | Mods / build (`mod/*`, `build`) | Part label / invoice to Mod; **NEW** order-screenshot (foreign currency) | SPEC-G §G2 + **NEW N3** | low |
| 22 | Wishlist (`wishlist/*`) | order/link screenshot to wishlist item | **NEW N3** | low |
| 23 | Inventory (`inventario/*`) | Part label scan | SPEC-B §B1 `part_label` | low |
| 24 | Wheels / tires (`ruedas/*`, `goma/*`, `TireStatsCard`) | Tire sidewall/DOT scan; wear facts phrased | SPEC-B `part_label`, SPEC-E §E1 | low |
| 25 | Album / photos (`album/importar`, `vehiculo/[id]/album*`, `foto/[id]`) | Caption/angle/"changed since last photo" suggestions, opt-in | SPEC-G §G2 | med |
| 26 | Events / milestones (`evento/*`, `hito/*`) | Accident photos to description draft | SPEC-G §G7 | HIGH (accident) |
| 27 | Track (`pista/*`) | **NEW** dictate session numbers (laps, psi) | **NEW N4** | low |
| 28 | Trips list/detail (`viajes/*`, `viaje/[id]`) | Name trip from place list (text only) | SPEC-G §G3 | HIGH (location) |
| 29 | Drive mode (`conducir`) | none (deterministic; GPS never to AI) | SPEC-H/I (no AI) | HIGH |
| 30 | Trip share (`viaje/compartir/[id]`) | none | none | HIGH |
| 31 | Stats (`cifras`) | **NEW** one-line cost insight from E1 facts | SPEC-E §E2 surface + **NEW N5** | low |
| 32 | Report / export (`reporte`, `exportar`) | none (numbers/CSV) | none | low |
| 33 | Libro / sale sheet (`vehiculo/[id]/libro`) | Sale-ready summary prose from facts JSON | SPEC-G §G9 | med |
| 34 | Contacts (`contactos/*`) | Add from Google Places result; **NEW** business-card photo | SPEC-G §G4 + **NEW N6** | med (third-party PII) |
| 35 | Juntes / community / profiles | none | SPEC-G §G8 (rejected) | HIGH |
| 36 | Vehicle share / compartidos | none | none | med |
| 37 | Feedback (`comentario`, `admin/comentarios`) | Admin triage + draft reply | SPEC-E §E4 | med (redacted) |
| 38 | Admin usage/users/reports | none (they are the AI cost console) | SPEC-A/E | low |
| 39 | Catalog (`catalogo/*`) | none | none | low |
| 40 | Backup / Tu Combustible import (`mas`, `bienvenida`) | none; optional **NEW** other-app CSV mapper (deferred) | **NEW N7 (deferred)** | med |
| 41 | Account / profile / permissions / notifications | none (digest consumes preferences) | SPEC-E digest only | med |
| 42 | Legal / install / versions / apoyar / dev | none | none | low |

---

## Workflow blocks

### 1. Fuel fill-up
- **Workflow / screen(s)**: `app/carga/nueva.tsx`, `app/carga/[id]/editar.tsx`, `components/FillUpForm.tsx`, `components/FillUpReviewSheet.tsx`, `components/fuel/GaugePicker.tsx`; domain `economy.ts` (`reviewFillUp`, `completeAmounts`, `odometerBounds`), `fillupDedupe.ts`, `partialEconomy.ts`, `perFillEconomy.ts`, `gauge*.ts`, `stations.ts`, `units.ts`, `fuelPrices.ts`.
- **Fields typed by hand today**: `date`, `odo`, `fuel`, `vol`, `typedPrice`/price, `total`, `full` (tanque lleno), `missedPrevious`, `gaugeBefore`, `gaugeAfter`, `inReserve`, `station`, `notes` (verified, `FillUpForm.tsx:60-89`).
- **Data that already exists**: last odometer + `useOdometerHint` (`lib/store`), `defaultFuelForNewLoad`, `fuel_log` history (gauge before/after frac, volume in liters), `recentStations()` in `stations.ts` + `refdata/stations.json`, MICM reference `fuel_price_ref` + `currentBoard()` in `fuelPrices.ts` (plausibility band for unit price), `findRecentDuplicate()` (`fillupDedupe.ts`), `odometerWarning()` (`odometer.ts`), `reviewFillUp()`, tank volume on `vehicle`.
- **Privacy sensitivity**: med. Receipt shows station, time, sometimes card digits/NCF/RNC; dashboard photo shows odometer only. No person data in normal cases; EXIF GPS must be stripped (SPEC-B §B7.8).
- **Proposed AI touchpoint**: SPEC-B §B1 `fuel_receipt`/`odometer`/`pump`, §B7 Fuel Express, §B3 voice. Prefill only; `findRecentDuplicate`, `odometerWarning`, gallons x price vs total (> 3 %), unit-price band vs MICM all stay deterministic. Closed action: `log_fuel` (from insights).

### 2. Fuel detail and economy
- **Workflow / screen(s)**: `app/carga/[id]/index.tsx`, `app/(tabs)/historial.tsx`; domain `economy.ts` (`latestEconomyInsight`), `partialEconomy.ts`, `perFillEconomy.ts`, `gaugeCalibration.ts`, `gaugeVehicle.ts` (`tankNow`).
- **Fields typed by hand today**: none (read-only detail; edit goes to #1).
- **Data that already exists**: `computeEconomy`, `perFillFor`/`PER_FILL_BAND`, `partialEconomy` status/reason/warning types, learned gauge map (`calibrateVehicle`), `tankNow`.
- **Privacy sensitivity**: low.
- **Proposed AI touchpoint**: SPEC-E §E1/E3 (4-state anomaly classification as pure code, badge with "why"); the model only phrases the reason via `cg-ai-insights`. Must reuse `partialEconomy` so partial fills never become anomalies.

### 3. Maintenance service
- **Workflow / screen(s)**: `app/servicio/nuevo.tsx` (kind `mantenimiento`), `components/service/OilBlock.tsx`; domain `oil.ts`, `oilInterval.ts`, `carMemory.ts` (`suggestionsFor` = "Igual que siempre"), `catalog.ts` (`SERVICE_TYPES`), `reminders.ts` (`remindersForServiceItems`, `completeReminder`).
- **Fields typed by hand today**: `kind`, `date`, `odometer`, `title`, `selected` (service types), `description`, `costParts`, `costLabor`, `totalOverride`, `shop`/`contactId`, `warrantyDate`, `warrantyKm`, `parts` (`name`, `quantity`, `cost`), `doneBy`, `system`, `photos`, `oil` (viscosity/type/spec/brand columns on `service_record_item`) (verified, `servicio/nuevo.tsx:99-140, 714-716`).
- **Data that already exists**: `lastOil` (`oilQueries.ts`), car memory/specsheet ("Lo que uso": oil brand, filter part numbers), reminders linked to service types, `kmPerDay`, contacts (`contact` table: name, kind, phone) for shop matching, `service_media` roles.
- **Privacy sensitivity**: med. An invoice carries the shop's RNC/NCF and sometimes the customer's name/cedula/plate; the function must not return anything but items, shop, totals, dates.
- **Proposed AI touchpoint**: SPEC-B §B1 `invoice` and `part_label` (oil bottle: viscosity, type, spec, brand map straight onto the OilBlock columns), §B3 voice ("cambié aceite y filtro con Taller Pérez, 3,800"). Shop = match existing `contact` else offer create (person confirms). "Igual que siempre" stays deterministic.

### 4. Repair (ServiceRecord kind `reparacion`)
- **Workflow / screen(s)**: `app/servicio/nuevo.tsx?kind=reparacion`, `app/servicio/[id].tsx`, `components/service/RepairDetail.tsx`, `RepairPieces.tsx`; domain `repairs.ts`; `lib/db/serviceOps.ts`, `diyQueries.ts`.
- **Fields typed by hand today**: same state as #3 plus `doneBy` (`self|shop|friend|other`), `system`, `photos` with role `before|after|invoice|other`, `resolveKey` (the pending task/event it resolves), `sourceTaskId`, `sourceInspectionId`; detail has `links`, `contact`, `closed`.
- **Data that already exists**: `warrantyEnd/warrantyState/isWarrantySoon` (`repairs.ts`), `WARRANTY_CHOICES`, `repairsOf`, `shopKey`, pending link (ADR-61: `isPending`/`pendingEvents` in `events.ts`), the person's own price history in `service_record.total_dop`, `vehicle_dtc_event.repair_record_id`.
- **Privacy sensitivity**: med (as #3).
- **Proposed AI touchpoint**: SPEC-D §D4 (invoice to repair incl. deterministic warranty parse "6 meses / 10,000 km", fair-price sentence from own history, warranty watcher banner) on SPEC-B `invoice`. Invoice photo saved with role `invoice` in `service_media`.

### 5. Repairs list
- **Workflow / screen(s)**: `app/vehiculo/[id]/reparaciones.tsx`; domain `repairs.ts` (`applyRepairFilters`, `repairYears`, `NO_REPAIR_FILTERS`).
- **Fields typed by hand today**: filters only (`filters` state).
- **Data that already exists**: `repairsOf`, `shopKey`, warranty state per repair, totals.
- **Privacy sensitivity**: low.
- **Proposed AI touchpoint**: SPEC-D §D4 as a surface for the warranty banner; filters are the target of the G1 intent box ("show my brake repairs"). No own AI.

### 6. OBD
- **Workflow / screen(s)**: `app/obd/index.tsx`, `app/obd/[code].tsx`, `components/diy/DtcPieces.tsx`; domain `dtc.ts` (+ bundled `dtc.es.json`: `lookup`, `describe`, `normalizeCode`), `lib/db/diyQueries.ts` (`logDtc`, `setDtcResolved`, `createRepairForDtc`, `linkDtcRepair`).
- **Fields typed by hand today**: `query` (code search), log dialog `target`, `date`, `km`, `notes`; `linking`/`repairs` for linking an existing repair.
- **Data that already exists**: `vehicle_dtc_event` (`code`, `seen_at`, `odometer_km`, `cleared_at`, `repair_record_id`, `notes`), repairs by system in last 24 months (`repairsFor`), vehicle make/model/year/fuel, odometer, `oil/fluids`, `tankNow`.
- **Privacy sensitivity**: low (codes + car facts; no plate/VIN needed in the prompt).
- **Proposed AI touchpoint**: SPEC-D §D1 explain-this-code (cached in `ai_insights`; bundled lookup stays the offline answer), §D2 warning-light photo, §D3 scanner screenshot to `VehicleDtcEvent`s to confirm. Actions: `open_obd`, `add_task`, `create_reminder` (re-scan), "Create repair" via existing `createRepairForDtc`.

### 7. Expense
- **Workflow / screen(s)**: `app/gasto/nuevo.tsx`, `app/gasto/[id].tsx`; types `EXPENSE_CATEGORIES` (`maintenance, repair, insurance, tax, toll, parking, wash, other`); `domain/costs.ts`.
- **Fields typed by hand today**: `category`, `amount`, `date`, `odometer`, `description`, `vendor`, `photoMediaId` (verified).
- **Data that already exists**: current odometer (`currentKm`), recent vendors/categories, monthly spend (`stats.ts`).
- **Privacy sensitivity**: med (receipts: vendor, partial card digits, NCF).
- **Proposed AI touchpoint**: SPEC-B §B1 `invoice` (receipt) + §B3 voice ("peaje 200 pesos"). Category guessed by model, person confirms.

### 8. Reminders
- **Workflow / screen(s)**: `app/recordatorio/nuevo.tsx`, `app/recordatorio/[id].tsx`, `app/recordatorios/index.tsx`, `components/ReminderForm.tsx`, `components/CompleteReminderSheet.tsx`; domain `reminders.ts`, `legal-dr.ts`, `oilInterval.ts`, `odometer.ts`.
- **Fields typed by hand today**: `title`, `serviceTypeId`, `metric` (`date|km|both`), `dueDate`, `dueKm`, `recurring`, `intervalMonths`, `intervalDays`, `intervalKm`, `fixed`, `thresholdDays`, `thresholdKm`, `notes`, `enabled`; completion sheet: `date`, `km`.
- **Data that already exists**: `evaluate()` already returns `predictedDueDate` + `confidence`; `kmPerDay()`; `LEGAL_LEAD_DAYS`; `oilReminderPatch` (synthetic flag); `marbeteNudges`/`nextMarbeteDeadline`; seed `LEGAL_REMINDERS` (marbete, seguro, licencia, revision_tecnica).
- **Privacy sensitivity**: low.
- **Proposed AI touchpoint**: SPEC-E §E1/E2 (projection shown on the reminder is mostly present; AI only phrases insights, action `create_reminder`) and SPEC-B §B3 ("recuérdame el marbete el 15 de diciembre" to a pre-filled `ReminderForm`).

### 9. Documents
- **Workflow / screen(s)**: `app/documento/nuevo.tsx`, `app/documento/[id].tsx`, `app/documentos/index.tsx`; `lib/db/documentOps.ts` (`saveDocument` -> `linked`), `lib/media/pdf.ts`.
- **Fields typed by hand today**: `kind`, `title`, `issued`, `expires`, `notes`, `mediaId`, `pdf` (verified).
- **Data that already exists**: `document` table (`kind, title, issued_at, expires_at, reminder_id, media_id, notes`); `LEGAL_BY_KIND` links seguro/marbete/licencia to the matching legal reminder; vehicle `plate`/`vin`/make/model for the wrong-car guard; `daysBetween` expiry state in the list.
- **Privacy sensitivity**: HIGH. Matricula/seguro/licencia show cedula, full name, address, plate, VIN, policy number. Request only plate/VIN/vehicle description/dates/insurer; never store the image server-side; never log; fixture test that a cedula never returns (SPEC-C C4).
- **Proposed AI touchpoint**: SPEC-C §C1 (`doc_*` kinds, wrong-car guard, link through `documentOps`). Action: `open_document`, `create_reminder` for expiry without reminder. Fix needed: no `revision` DocumentKind (see Reality check 2).

### 10. New vehicle
- **Workflow / screen(s)**: `app/vehiculo/nuevo.tsx`, `app/onboarding.tsx`, `app/bienvenida/index.tsx`, `components/VehicleForm.tsx`, `components/vehicle/MakeModelYear.tsx`, `IdentitySection.tsx`, `PhotosSection.tsx`, `GaugeTypeSection.tsx`; domain `vehicleForm.ts`, `vpic.ts` (`checkVin`, `decodeVin`, `mapVpic`), `refdata/*` (makes, colors, bodyTypes, oil, fluids), `specPresets.ts`, `vehicleStatus.ts`; `lib/db/vehicleOps.ts` (`saveVehicleDraft`).
- **Fields typed by hand today**: `name`, `bodyType`, `mmy` (makeId/make, modelId/model, year), `color`, `interior`, `material`, `plate`, `vin`, `fuel`, `unit`, `perHundred`, `tank`, `reserve`, `odometer`, `gauge`, `synthetic`, `purchaseDate`, `purchasePrice`, `gallery`, `notes`, `status`, `statusSince`, `statusNote`, `identity` (verified `VehicleForm.tsx:109-168`).
- **Data that already exists**: VPIC decode, refdata pickers (`SelectField`), `presetsFor/applyPreset` (spec presets by make/model), `vehicleStatus.ts`.
- **Privacy sensitivity**: HIGH (matricula photo: cedula/name/address; plate and VIN are identifying).
- **Proposed AI touchpoint**: SPEC-C §C2 (scan matricula, scan VIN; VPIC wins for specs, document wins for plate/color; add AI-filled fields to the ADR-63 round-trip test).

### 11. Edit vehicle
- **Workflow / screen(s)**: `app/vehiculo/[id]/editar.tsx` (same `VehicleForm`), `app/vehiculo/[id].tsx` (hub), `app/(tabs)/garaje.tsx` (`garage.ts`, `garageLayout.ts`).
- **Fields typed by hand today**: same as #10.
- **Data that already exists**: existing vehicle row; the scan should only fill empty fields.
- **Privacy sensitivity**: HIGH (as #10).
- **Proposed AI touchpoint**: SPEC-C §C2; the garage list/hub itself gets no AI (badges and lamps are derived: `vehicleBadges`, `lampStates`).

### 12. Ficha and "Lo que uso"
- **Workflow / screen(s)**: `app/vehiculo/[id]/ficha.tsx`, `components/diy/FichaTab.tsx`, `components/memory/MemoryTab.tsx`; domain `specPresets.ts` (`FICHA_FIELDS` groups motor/fluidos/electrico/ruedas/combustible), `carMemory.ts`, `build.ts` (`SPEC_FIELDS`), `vpic.ts`; `diyQueries.ts` (`setFichaValue`, `setVerified`, `loadPreset`, `applyVin`, `saveTorque`).
- **Fields typed by hand today**: ficha values by key (`value`, `editing`), VIN decode trigger (`vinBusy`), `torque` (`item`, `valueNm`), `vehicle_fact` (`label`, `value`, `group_name`).
- **Data that already exists**: presets, VPIC results, `vehicle_specsheet` (stock/overrides/verified), `vehicle_fact`, `torque_spec`.
- **Privacy sensitivity**: med (VIN).
- **Proposed AI touchpoint**: SPEC-C §C2 + SPEC-B `part_label`: door-jamb sticker -> tire size/pressure fact, oil cap -> spec, paint code -> `vehicle_fact`. **Rejected for torque_spec** (see Rejected).

### 13. Fluids guide
- **Workflow / screen(s)**: `app/vehiculo/[id]/fluidos.tsx`; domain `fluids.ts`; `diyQueries.ts` (`listFluids`, `saveFluid`).
- **Fields typed by hand today**: card `notes` and the person's own photo per fluid.
- **Data that already exists**: `FLUID_KINDS`, `fluidInfo`, `fluid_guide_item`.
- **Privacy sensitivity**: low.
- **Proposed AI touchpoint**: none, the guide is the person's own photo + static how-to text; AI adds nothing.

### 14. Weekly check / inspection
- **Workflow / screen(s)**: `app/chequeo/index.tsx`, `app/chequeo/[templateId]/run.tsx`, `app/chequeo/plantillas/[id].tsx`, `app/chequeo/guia.tsx`, `app/inspeccion/[id].tsx`, `components/checks/CheckPhotoStrip.tsx`; domain `inspections.ts` (`isDue`, `weeklyStreak`, `VERDICTS = ok|atencion|falla|na`, `MAX_CHECK_PHOTOS`, `defaultActionFor`, `taskPriorityFor`), `fluids.ts`, `carMemory.ts` (`suggestionForFluid`); `inspectionOps.ts`.
- **Fields typed by hand today**: `answers` per item (verdict), `notes`, `photos`, `odometer`, `psi` (tire pressure), `actions` (OnFail), `fluidCards`; template editor: `name`, `cadence`, `isEnabled`, `rows`.
- **Data that already exists**: last run, streak, `inspection_result` (`result`, `note`, `media_id`), OnFail creates `task`/reminder.
- **Privacy sensitivity**: low.
- **Proposed AI touchpoint**: SPEC-G §G6 `check_photo` (suggestion pass/watch/fail, hedged; never replaces measurement) and **NEW N1**: dictate the whole check ("frenos ok, llantas atención, aceite bajo") through the `cg-ai-intent` path to fill `answers` + `notes`; person reviews each row.

### 15. Tasks (pending work)
- **Workflow / screen(s)**: `app/tarea/nueva.tsx`, `app/tarea/[id].tsx`, `app/tareas/index.tsx`; `task` table.
- **Fields typed by hand today**: `title`, `kind`, `priority`, `cost` (estimated), `notes` (verified).
- **Data that already exists**: `task.source_inspection_result_id`, `done_record_id`, link to repair via `sourceTaskId`.
- **Privacy sensitivity**: low.
- **Proposed AI touchpoint**: SPEC-B §B3 target `task`; closed action `add_task` from OBD/insights (SPEC-D §D1, SPEC-E §E2).

### 16. Odometer
- **Workflow / screen(s)**: `app/odometro.tsx`; domain `odometer.ts` (`currentOdometer`, `kmPerDay`, `odometerWarning`); `lib/trips/odometer.ts` (trips feed the odometer, ADR-30).
- **Fields typed by hand today**: `value`, `date`.
- **Data that already exists**: `odometer_reading` (`value_km`, `source`, `source_id`), highest-ever rule.
- **Privacy sensitivity**: low.
- **Proposed AI touchpoint**: SPEC-B §B1 `odometer` (cluster photo; km or mi, trip A/B). `odometerWarning` stays deterministic.

### 17. Hoy / Inicio
- **Workflow / screen(s)**: `app/(tabs)/index.tsx`; domain `cluster.ts`, `garage.ts` (`lampStates`), `gaugeVehicle.ts`, `partialEconomy.ts`, `reminders.ts` (`mergeAttention`, `needsAttention`), `vehicleStatus.ts`; `lib/trips/live*`.
- **Fields typed by hand today**: none.
- **Data that already exists**: reminder states, telltale lamps, tank now, cluster reading.
- **Privacy sensitivity**: low.
- **Proposed AI touchpoint**: SPEC-E §E2/E3 (Car Health card from `Fact`s), SPEC-B §B7 and SPEC-K (big "Cargar gasolina" action). Telltale/mergeAttention remain the deterministic source.

### 18. Herramientas hub, Más and search
- **Workflow / screen(s)**: `app/herramientas.tsx`, `app/(tabs)/mas.tsx`; `lib/features/registry.ts` (`FEATURES`, `featureHref`, `featureForTelltale`, `INTERNAL_ROUTES`), `search.ts`, `discover.ts`, `usage.ts`, `domain/text.ts` (`foldText`, `matchesQuery`).
- **Fields typed by hand today**: the search text.
- **Data that already exists**: registry keywords es/en, per-feature `href` + `needsVehicle`, `stats` queries for "how much" answers.
- **Privacy sensitivity**: low (utterance can mention anything; send only text + minimal context).
- **Proposed AI touchpoint**: SPEC-B §B3 `cg-ai-intent` + SPEC-G §G1 + SPEC-K §K4. Target list must equal `FeatureId`s in `lib/features/ids.ts` plus `fuel|service|repair|expense|odometer|reminder|task|event|obd`; "how much" is answered by `stats.ts`, not the model.

### 19. Historial
- **Workflow / screen(s)**: `app/(tabs)/historial.tsx`; domain `history.ts` (`historyTitle/Subtitle/Kind/Icon`), `perFillEconomy.ts`; `history_feed` view, `oilQueries.oilSummaries`.
- **Fields typed by hand today**: filters.
- **Data that already exists**: `history_feed` union of fuel/service/repair/mod/gasto/chequeo/hito/evento/pista/obd/viaje.
- **Privacy sensitivity**: low.
- **Proposed AI touchpoint**: none own; filters are a target of SPEC-G §G1.

### 20. Fuel prices
- **Workflow / screen(s)**: `app/precios/index.tsx`, `app/precios/nuevo.tsx`, `components/PriceBoard.tsx`; domain `fuelPrices.ts`, `stations.ts`; `lib/db/priceOps.ts`; `lib/micm/{importer,parse,pdfText}.ts` (weekly MICM import).
- **Fields typed by hand today**: `fuel`, `price`, `date`, `source`, `station`, `note` (verified).
- **Data that already exists**: `fuel_price` + `fuel_price_ref`, `FUEL_PRICE_SOURCES` (incl. `recibo`), `currentBoard`, `series`.
- **Privacy sensitivity**: low (station name only; no location needed).
- **Proposed AI touchpoint**: SPEC-G §G5 (receipt feeds a `recibo` price when the person agrees) plus **NEW N2**: photo of the station's price board -> one row per fuel. Delta vs MICM is pure code.

### 21. Mods / build log
- **Workflow / screen(s)**: `app/mod/nuevo.tsx`, `app/mod/[id].tsx`, `app/vehiculo/[id]/build.tsx`, `components/build/ModForm.tsx`, `ModRow.tsx`, `BuildTab.tsx`, `SpecsTab.tsx`, `StockActualCard.tsx`; domain `build.ts` (`SPEC_FIELDS`, `cleanSpecs`), `costs.ts` (`inventoryCounts`, `USED_IN_MOD_PREFIX`); `buildQueries.ts`.
- **Fields typed by hand today**: `categoryId`, `name`, `brand`, `partNumber`, `variant`, `status`, `installedAt`, `installedKm`, `installer`/`contactId`, `part`, `labor`, `shipping`, `customs`, `foreign`, `currency`, `rate`, `vendor`, `vendorUrl`, `affects`/`effects`, `replaces`, `tags`, `notes`, `soldPrice`; build screen sell flow: `sellPrice`, `sellTo`, `reclass`.
- **Data that already exists**: `mod_category` seeds, `spec_effects`, inventory, wishlist, tire stats, contacts.
- **Privacy sensitivity**: low.
- **Proposed AI touchpoint**: SPEC-G §G2 (part box/invoice -> Mod, wishlist->installed link) + **NEW N3** (screenshot of an online order: `currency`, `foreign` price, `shipping`, `customs`, `vendor`, `vendorUrl`; `rate` fetched/typed by person).

### 22. Wishlist
- **Workflow / screen(s)**: `app/wishlist/nuevo.tsx`, `app/wishlist/[id].tsx`, `components/build/WishlistForm.tsx`.
- **Fields typed by hand today**: `categoryId`, `name`, `brand`, `partNumber`, `priority`, `price`, `currency`, `shipping`, `customs`, `url`, `vendor`, `target`, `status`, `notes`.
- **Data that already exists**: `wishlist_item`, `rate`, link to Mod on install.
- **Privacy sensitivity**: low.
- **Proposed AI touchpoint**: **NEW N3** (same order/listing screenshot reader); no price advice from the model.

### 23. Inventory
- **Workflow / screen(s)**: `app/inventario/nuevo.tsx`, `app/inventario/[id].tsx`, `components/build/InventoryForms.tsx` (`InventoryForm`).
- **Fields typed by hand today**: `kind`, `name`, `brand`, `partNumber`, `qty`, `unit`, `condition`, `location`, `cost`, `garage`, `notes`.
- **Data that already exists**: `inventory_item` (incl. `fits_vehicle_ids`), `inventoryCounts`.
- **Privacy sensitivity**: low.
- **Proposed AI touchpoint**: SPEC-B §B1 `part_label` (brand, part number, spec).

### 24. Wheels and tires
- **Workflow / screen(s)**: `app/ruedas/[setId].tsx`, `app/goma/[id].tsx`, `components/build/InventoryForms.tsx` (WheelSetForm, TireForm), `TireStatsCard.tsx`; domain `tires.ts` (`parseTireSize`, `dotAge`), `tireStats.ts` (`tireStats`, `badgesFor`).
- **Fields typed by hand today**: wheel set: `name`, `spec`, `bolt`, `bore`, `brand`, `model`, `qty`, `status`, `notes`; tire: `size`, `brand`, `model`, `dot`, `compound`, `treadwear`, `treadNew`, `treadNow`, `heat`, `setId`, `position`, `status`, `cost`.
- **Data that already exists**: `parseTireSize` (never throws on partial text), `dotAge`, heat cycles, `DEFAULT_HEAT_CYCLE_LIMIT`, `tire_stats` by set.
- **Privacy sensitivity**: low.
- **Proposed AI touchpoint**: SPEC-B §B1 `part_label` (sidewall: size, load/speed, DOT), then `parseTireSize` validates deterministically; SPEC-E §E1 wear facts (tire age/DOT) phrased by AI.

### 25. Album, import and photo viewer
- **Workflow / screen(s)**: `app/album/importar.tsx`, `app/vehiculo/[id]/album/index.tsx`, `album/estado.tsx`, `app/foto/[id].tsx`, `components/album/*`; domain `album.ts` (`resolveTakenAt`, `isDuplicate`, `buildTimeline`, `stateAt`), `gallery.ts`; `lib/media/{exif,library,compress}.ts`.
- **Fields typed by hand today**: `override`/`overrideDate`, `precision`, `keepOriginals`, selection; photo `caption`, `date`, `precision`.
- **Data that already exists**: EXIF date (`exif.ts`/`exif.web.ts`), dupe key, mods/odometer for "state at date" (`odometerNear`, `stateAt`).
- **Privacy sensitivity**: med (personal photos; may show faces/plates; largest cost driver).
- **Proposed AI touchpoint**: SPEC-G §G2 opt-in per person; batches <= 12 downscaled to 768 px; output = suggestion for caption/angle/milestone, never auto-applied.

### 26. Events and milestones
- **Workflow / screen(s)**: `app/evento/nuevo.tsx`, `app/evento/[id].tsx`, `app/hito/nuevo.tsx`, `app/hito/[id].tsx`, `components/album/EventForm.tsx`, `EventsTab.tsx`; domain `events.ts` (`EVENT_TYPES`, `Severity`, `isPending`, `pendingEvents`).
- **Fields typed by hand today**: `eventType`, `kind`, `severity`, `date`, `km`, `title`, `story`, `cost`, `pending`, `resolved`, `resolvedAt`, `location`, `links`, `photoIds`, `pdfs`, `cover`, `album`.
- **Data that already exists**: `milestone` table, pending link to repair/task, album photos.
- **Privacy sensitivity**: HIGH for accident type (damage photos can show plates, people, location, insurance papers).
- **Proposed AI touchpoint**: SPEC-G §G7 (draft description + severity suggestion + deterministic checklist), no claim/liability text.

### 27. Track days
- **Workflow / screen(s)**: `app/pista/index.tsx`, `pista/evento/{nuevo,[id]}.tsx`, `pista/sesion/{nueva,[id]}.tsx`, `components/track/{EventForm,SessionForm,TrackPieces}.tsx`; domain `track.ts` (`parseLap`, `formatLap`, `SHEET_FIELDS`, `diffSheets`, `pressureDeltas`, `eventSummary`); `trackQueries.ts`.
- **Fields typed by hand today**: event: `venue*`, `layout`, `date`, `title`, `organizer`, `discipline`, `weather`, `ambient`, `trackTemp`, `condition`, `odoStart`, `odoEnd`, `entry`, `fuel`, `other`, `notes`, `tires`, `padF/padR`; session: `track_session` columns (`laps`, `best_lap_ms`, `sectors_ms`, `zero_100_ms`, `quarter_mile_ms`, `fuel_load_l`, `car_feel`, `rating`, `notes`) and the setup sheet (cold/hot psi per corner, alignment, etc.).
- **Data that already exists**: previous sheet (`copyForward`), `diffSheets`, tire sets.
- **Privacy sensitivity**: low.
- **Proposed AI touchpoint**: **NEW N4** voice dictation at the paddock ("mejor vuelta 1:42.3, presión fría 32 delante") mapped to session/sheet fields; `parseLap` validates. Low priority.

### 28. Trips list and detail
- **Workflow / screen(s)**: `app/viajes/index.tsx`, `app/viaje/[id].tsx`, `app/viajes/ajustes.tsx`, `app/viajes/permisos.tsx`; `lib/trips/*` (`machine`, `finalize`, `geo`, `present`, `geojson`, `exportGeojson`, `diagnostics`, `settings`, `autoStatus`, `freshness`).
- **Fields typed by hand today**: `notes`; `start_label`/`end_label` (`trip` table).
- **Data that already exists**: `trip` (distance, duration, moving, avg/max, speed buckets, polyline, bbox), privacy zones.
- **Privacy sensitivity**: HIGH (location is the most sensitive data the app holds; SPEC-G3 itself records "AI over GPS traces rejected").
- **Proposed AI touchpoint**: SPEC-G §G3 only: text-only name from a place list (needs `cg-places`; coordinates rounded ~500 m). Summaries/eco tips and purpose labels are deterministic (SPEC-H/I/J have no AI).

### 29. Drive mode
- **Workflow / screen(s)**: `app/conducir.tsx`; `lib/trips/{live,liveStore,driveTrail,myPosition,gpsNotice,auto,task}.ts`, `components/drive/CompactSpeed.tsx`.
- **Fields typed by hand today**: `mode`, `passenger` toggles only.
- **Data that already exists**: live GPS state, vehicle `limit_kmh`.
- **Privacy sensitivity**: HIGH (live position).
- **Proposed AI touchpoint**: none (see Rejected).

### 30. Trip share
- **Workflow / screen(s)**: `app/viaje/compartir/[id].tsx`; domain `tripShare.ts` (`trimForSharing`, `inAnyZone`, `TRIM_DEFAULTS`); `lib/trips/shareGeojson.ts`, `lib/social/*`.
- **Fields typed by hand today**: trim options / privacy zones.
- **Data that already exists**: `privacy_zone`, `trip_share`.
- **Privacy sensitivity**: HIGH.
- **Proposed AI touchpoint**: none.

### 31. Stats (Cifras)
- **Workflow / screen(s)**: `app/cifras.tsx`; domain `stats.ts` (`periodRanges`, `spendByCategory`, `monthlySpendByCategory`), `costs.ts` (`ownershipCost`, `garageCost`), `economy.ts`, `units.ts`; `statsQueries.ts`.
- **Fields typed by hand today**: `period` only.
- **Data that already exists**: all of E1's cost facts' ingredients.
- **Privacy sensitivity**: low.
- **Proposed AI touchpoint**: **NEW N5**: a single phrased line under the numbers ("gasolina subió 18 % vs el mes pasado") from E1 cost facts via `cg-ai-insights`; number validation as in SPEC-E. Note SPEC-J says recaps use templated copy, no AI: N5 is limited to Cifras, not the recap cards.

### 32. Report and export
- **Workflow / screen(s)**: `app/reporte.tsx`, `app/exportar.tsx`; `lib/report/{html,print,photo}.ts`, `lib/export/{csv,deliver}.ts`.
- **Fields typed by hand today**: `period` selection.
- **Data that already exists**: same as #31.
- **Privacy sensitivity**: low (PDF/CSV leave the device by the person's choice).
- **Proposed AI touchpoint**: none (numbers and file formats).

### 33. Libro / sale sheet
- **Workflow / screen(s)**: `app/vehiculo/[id]/libro.tsx`, `lib/book/{index,render}.ts`, `lib/share/dossier`, `components/memory/MemoryTab.tsx`.
- **Fields typed by hand today**: share `flags`, `photos`, `docs`, `memory`, `period`.
- **Data that already exists**: dossier from local tables, events, documents, "Lo que uso".
- **Privacy sensitivity**: med (plate/VIN and documents may be included in the PDF; the AI input must be the facts JSON without plate/VIN unless the person included them).
- **Proposed AI touchpoint**: SPEC-G §G9 (prose from facts JSON, numbers validated, person edits before export, es/en).

### 34. Contacts
- **Workflow / screen(s)**: `app/contactos/{index,nuevo,[id]}.tsx`, `components/diy/ContactPieces.tsx`; domain `contacts.ts` (`CONTACT_KINDS`, `whatsappLink`, `formatPhone`); `diyQueries.ts` (`saveContact`, `contactLinks`).
- **Fields typed by hand today**: `name`, `kind`, `phone`, `whatsapp`, `address`, `rating`, `notes`, `links`.
- **Data that already exists**: `contact` table; contact links to services/mods.
- **Privacy sensitivity**: med (third-party phone/address).
- **Proposed AI touchpoint**: SPEC-G §G4 "Add as contact" from a `cg-places` result; **NEW N6** (low priority): business-card photo or invoice header -> `name`, `kind`, `phone`, `address`.

### 35. Juntes, community, profiles
- **Workflow / screen(s)**: `app/juntes/*`, `app/junte/[code].tsx`, `app/comunidad.tsx`, `app/perfil.tsx`, `app/u/[handle].tsx`; `lib/junte/*`, `lib/social/*`.
- **Fields typed by hand today**: junte: `title`, `day`, `time`, `hours`, `meetLabel`, `meet`, `visibility`; profile fields.
- **Data that already exists**: social/follows, junte cache, live location.
- **Privacy sensitivity**: HIGH (people, live location).
- **Proposed AI touchpoint**: none (SPEC-G §G8, conscious "no").

### 36. Vehicle sharing and dossier
- **Workflow / screen(s)**: `app/vehiculo/[id]/compartir.tsx`, `app/compartidos.tsx`, `app/garaje/miembros.tsx`, `app/invitacion/[code].tsx`; `lib/db/shareQueries.ts`, `lib/share/dossier`.
- **Fields typed by hand today**: share `flags`, `visibility`, `mode`.
- **Data that already exists**: `vehicle_share`, `vehicle_member`.
- **Privacy sensitivity**: med.
- **Proposed AI touchpoint**: none.

### 37. Feedback
- **Workflow / screen(s)**: `app/comentario.tsx`, `app/admin/comentarios.tsx`, `app/admin/comentarios/[id].tsx`; `lib/feedback/{redact,payload,send,inbox,context}.ts`.
- **Fields typed by hand today**: user: `kind`, `message`, `email`, `shot`; admin: status, reply.
- **Data that already exists**: `redactText`, `FEEDBACK_STATUSES`, `lastVisitedRoute`.
- **Privacy sensitivity**: med (free text; redact before any model call).
- **Proposed AI touchpoint**: SPEC-E §E4 admin triage + draft reply (never auto-send). No AI on the user's side (see Rejected).

### 38. Admin (usage, users, reports, deletions)
- **Workflow / screen(s)**: `app/admin/{index,uso,usuarios,reportes,eliminar}.tsx`; `lib/cloud/admin`, `lib/cloud/appConfig`, `domain/usage.ts`.
- **Fields typed by hand today**: `app_config` values (support text, limits).
- **Data that already exists**: `UsageSnapshot`, `FREE_LIMITS`, `proNeeded`.
- **Privacy sensitivity**: low.
- **Proposed AI touchpoint**: none as a target; it is the console for AI limits/kill switch (SPEC-A/G10 "off-switch in Admin -> Uso y costos").

### 39. Catalog
- **Workflow / screen(s)**: `app/catalogo/index.tsx`, `app/catalogo/[id].tsx`; `domain/catalog.ts`.
- **Fields typed by hand today**: none (browse seeded service types).
- **Data that already exists**: `SERVICE_TYPES`, `INSPECTION_TEMPLATES`, `MOD_CATEGORIES`, `VENUES`.
- **Privacy sensitivity**: low.
- **Proposed AI touchpoint**: none, deterministic reference data (feeds E1 interval facts).

### 40. Backup and import
- **Workflow / screen(s)**: `lib/backup.ts` via `app/(tabs)/mas.tsx`, `app/bienvenida/index.tsx`, `app/onboarding.tsx`; `lib/import/tucombustible.ts` (`mapLegacy`).
- **Fields typed by hand today**: file pick only.
- **Data that already exists**: full-table backup v2 incl. tombstones; legacy envelope mapping.
- **Privacy sensitivity**: med (everything leaves/enters the device by file).
- **Proposed AI touchpoint**: none today; **NEW N7 (deferred)**: map a CSV from another fuel app (column guess) onto fill-ups for new users. Only if first-run data shows demand; deterministic mapper with a column picker comes first.

### 41. Account, profile, permissions, notifications
- **Workflow / screen(s)**: `app/cuenta.tsx`, `app/borrar-cuenta.tsx`, `app/nueva-contrasena.tsx`, `app/perfil.tsx`, `app/permisos.tsx`, `app/notificaciones.tsx`; `lib/cloud/auth`, `lib/permissions`, `lib/notifications/{plan,push,index}.ts`, `lib/account/*`.
- **Fields typed by hand today**: credentials, handle/profile, notification preferences.
- **Data that already exists**: session (needed as the AI JWT), permission registry (ADR-59), notification plan.
- **Privacy sensitivity**: med (identity).
- **Proposed AI touchpoint**: none as target. Prerequisites for every other touchpoint (account for JWT, consent, mic permission through the registry); weekly digest consumes the notification preferences (SPEC-E §E2).

### 42. Static and internal screens
- **Workflow / screen(s)**: `app/legal/*`, `app/instalar.tsx`, `app/versiones.tsx`, `app/apoyar.tsx`, `app/dev/{seed,tokens}.tsx`, `app/+html.tsx`, `app/+not-found.tsx`, `app/_layout.tsx`, `app/(tabs)/_layout.tsx`.
- **Fields typed by hand today**: none.
- **Privacy sensitivity**: low.
- **Proposed AI touchpoint**: none; AI data-and-third-parties disclosure belongs in `legal/*` (SPEC-A).

---

## New touchpoints proposed (beyond SPEC-B..K)

| ID | Where | What | Why verified feasible |
|---|---|---|---|
| N1 | `chequeo/[templateId]/run` | Dictate the whole check; fills `answers` (`ok|atencion|falla|na`) + `notes`; person reviews rows | `inspections.ts` `VERDICTS`, `run.tsx` state |
| N2 | `precios/nuevo` | Photo of the pump price board -> `fuel`, `price`, `station`, `date` (source `estacion`) | form fields + `FUEL_PRICE_SOURCES`; deviation vs MICM by `fuelPrices.ts` |
| N3 | `mod/nuevo`, `wishlist/nuevo` | Screenshot of an online order/listing -> `currency`, `foreign` price, `shipping`, `customs`, `vendor`, `vendorUrl`, `partNumber` | ModForm/WishlistForm already carry these fields |
| N4 | `pista/sesion/*` | Voice dictation of laps/psi at the track (low priority) | `parseLap`, `SHEET_FIELDS` |
| N5 | `cifras` | One phrased insight line from cost facts | `stats.ts`/`costs.ts` ingredients; reuses SPEC-E validation |
| N6 | `contactos/nuevo` | Business-card/invoice-header photo -> contact fields (low priority) | `ContactPieces` fields |
| N7 | `mas`/import (deferred) | Column-guess import of another app's CSV | `lib/backup.ts`, `tucombustible.ts` |

## Workflows the BRIEF missed

BRIEF's "workflows that exist" list omits these (each verified in code). SPECs B..K mention the ones marked "(spec)".

1. **Tasks / pending work** (`app/tarea/*`, `app/tareas`, `task` table) - only appears as an OBD action in SPEC-D/B3.
2. **Contacts as a workflow** (`app/contactos/*`, `contact` table, `contacts.ts`) - BRIEF only says "shop contact"; SPEC-G4 covers Places.
3. **Oil / synthetic flow** (`oil.ts`, `oilInterval.ts`, `OilBlock`, `oilQueries`, vehicle `oil_synthetic`, ADR-63) - not listed; SPEC-C/E touch it.
4. **Ficha técnica, torque specs, "Lo que uso" car memory** (`ficha.tsx`, `specPresets.ts`, `carMemory.ts`, `vehicle_specsheet`, `torque_spec`, `vehicle_fact`, VIN decode `vpic.ts`) (spec C2 partially).
5. **Fluids guide** (`fluidos.tsx`, `fluids.ts`, `fluid_guide_item`) (spec C mentions).
6. **Gauge calibration and tank-now** (`gaugeCalibration.ts`, `gaugeVehicle.ts`, `GaugeCalibrationCard`) - BRIEF says "gauge" only.
7. **Vehicle lifecycle / sell flow and ownership** (`vehicleStatus.ts`, build screen `sellPrice`/`sellTo`/`reclass`, `vehicle_ownership`, `costs.ownershipCost`).
8. **Vida útil + DR legal calendar** (`legal-dr.ts`: `vidaUtil`, `marbeteNudges`, `LEGAL_LEAD_DAYS`) - BRIEF only names the legal reminders.
9. **Tires/wheels stats, DOT age, heat cycles** (`tires.ts`, `tireStats.ts`, `consumable_usage`) (spec E wear facts only).
10. **Vehicle public dossier / sharing** (`compartir.tsx`, `compartidos.tsx`, `share/dossier`, `shareQueries`) - BRIEF mentions "garage sharing/members", not the dossier or share flags.
11. **Trip sharing with privacy zones and trimming** (`viaje/compartir`, `tripShare.ts`, `privacy_zone`).
12. **Weekly check template editor and guide** (`chequeo/plantillas/[id]`, `chequeo/guia`).
13. **Album estado ("state of the car on a date")** (`album/estado.tsx`, `album.ts` `stateAt`).
14. **Backup / restore and Tu Combustible RD import** (`lib/backup.ts`, `lib/import/tucombustible.ts`).
15. **MICM weekly price importer** (`lib/micm/*`) - BRIEF says "MICM weekly import" (listed) but the pdfText parse path is not described.
16. **Feature registry "Descubre", usage memory, search** (`lib/features/*`) (spec K).
17. **Fuel station list / brands** (`stations.ts`, `refdata/stations.json`) and refdata pickers (makes, colors, bodyTypes, oil, fluids).
18. **Notifications plan and push** (`lib/notifications/*`, `notificaciones.tsx`) (spec E digest).
19. **Account deletion, password reset, profile/handle** (`borrar-cuenta`, `nueva-contrasena`, `perfil`, `lib/account/*`).
20. **Support / Pro-needed projections and app_config** (`apoyar.tsx`, `domain/usage.ts`, `admin/uso`) - BRIEF mentions `app_config` and "uso" screen only.
21. **Garage layout and derived badges** (`garage.ts`, `garageLayout.ts`, `cluster.ts`, `(tabs)/garaje.tsx`).
22. **Installation guidance and release notes** (`instalar.tsx`, `versiones.tsx`, `lib/changelog`).
23. **Admin deletion and role management** (`admin/eliminar`, `admin/usuarios`).
24. **Public profile and junte deep links** (`u/[handle]`, `junte/[code]`, `invitacion/[code]`).

## Rejected touchpoints (where AI would NOT help)

| Where | Why not |
|---|---|
| Drive mode, live GPS, speed (`conducir`, SPEC-I) | GPS is truth and deterministic; location is the most sensitive data; AI adds latency and privacy cost (SPEC-G3). |
| Trip auto-start detection, purpose labels (SPEC-H) | Clustering by time/repetition is deterministic; no model. |
| Trip summaries/eco tips, recaps (`viajes`, SPEC-J) | Numbers are computed; templated copy covers it (ADR-74). |
| Torque specs (`torque_spec`, `saveTorque`) | Hallucinated torque values are a safety risk; only the person's verified source. Same for oil capacity/tire pressure unless read from a photo of the car's own sticker. |
| Price/valuation of the car or sale price (`build` `sellPrice`) | No market baseline in the data; the model would invent figures (BRIEF rule). |
| Fair-price statements without history | SPEC-D4: say "no baseline" instead. |
| Juntes, profiles, follows, community, public pages (SPEC-G8) | Privacy and noise; people and live location. |
| User-side feedback form (`comentario`) | Free text may contain PII; AI only on the admin side after `redactText`. |
| Fluids guide, catalog, legal screens, install, versions | Static or the person's own photo; no data to improve. |
| Report/export/PDF numbers | Must be exact; model only on the optional Libro prose (G9). |
| Auto-saving high-confidence reads | Rejected in ADR-75: a wrong fuel record corrupts efficiency; Confirm stays a tap. |
| Fuel economy "anomaly" generated by the model | Must be the 4-state pure rule over `partialEconomy`; model only phrases the reason. |
| Garage list, badges, telltale lamps | Derived deterministically (`garage.ts`); no benefit. |
| Account/auth/permissions/deletion flows | Security-sensitive, no AI. |

## Counts

- Routes walked: **111** files under `app/` (107 screens + 4 layouts/html/not-found).
- Domain modules walked: **44** `lib/domain/*.ts` (+ `refdata/`), plus `lib/trips` 25, `lib/media` 10, `lib/features` 5 (84 modules total).
- Workflows mapped: **42** blocks (see Summary table; #29 and #30 are mapped as "no AI").
- New touchpoints found beyond SPEC-B..K: **7** (N1-N7; N4, N6, N7 low priority/deferred).
- Spec/code mismatches found: **5** (see Reality checks at the top).
