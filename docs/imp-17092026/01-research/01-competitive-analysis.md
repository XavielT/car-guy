# Research 1 — Competitive analysis of vehicle maintenance / car management apps

*Research date: 2026-09-17. Method note: web search was blocked by the session's egress proxy, so
everything below comes from direct fetches of vendor sites, help centers, store listings and the
LubeLogger source on GitHub. Apps that could not be reached (Car Minder, Vehicle Manager/CarManager,
"My Car", Openbay, most "Car Maintenance Log" clones) are flagged as unverified.*

## 1. Feature matrix

Legend: ● = yes, verified · ◐ = partial / paid tier only · ○ = no / not found · ? = unverified

| Feature | LubeLogger (OSS) | Drivvo | Fuelio | Simply Auto | aCar / Fuelly | CARFAX Car Care | AUTOsist | Road Trip MPG | Motolog | CarVita (OSS) | Fleetio / Whip Around / Simply Fleet |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Fuel log w/ partial + missed fill flags | ● | ● | ● | ● | ● | ○ (fuel tracker removed 2025) | ● | ● | ● | ○ | ● |
| Service records (planned) | ● | ● | ◐ (Premium on iOS) | ● | ● | ● | ● | ● | ● | ● | ● |
| Repairs as separate type | ● | ○ (folded into services) | ○ | ○ | ○ | ○ | ◐ (work orders) | ○ | ○ | ○ | ● (work orders) |
| Upgrades / modifications | ● (Upgrade Records) | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ |
| Non-odometer expenses (tax, insurance, fines) | ● (Taxes) | ● (Expenses) | ● (Costs) | ● (Expenses) | ● | ○ | ● | ● | ● | ○ | ● |
| Income | ○ | ● | ○ | ○ | ○ | ○ | ○ | ○ | ◐ (reimbursement) | ○ | ○ |
| Reminders by date | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● |
| Reminders by odometer | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● |
| "Whichever first" (both) | ● | ● | ? | ● | ● | ? | ● | ● | ? | ● | ● |
| Recurring auto-reset on completion | ● | ● | ? | ● | ● | ● | ● | ? | ? | ● | ● |
| Predicted due date from usage | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ● | ○ (schedules only) |
| Multi-level urgency states | ● (4 states, configurable thresholds) | ◐ | ◐ | ◐ | ◐ | ◐ | ◐ | ◐ | ◐ | ◐ | ● (OK / Due Soon / Overdue) |
| Pre-drive / inspection checklist | ● (templates, pass/fail, action items) | ◐ (Checklists module, fleet-oriented) | ○ | ○ | ○ | ○ | ● | ○ | ○ | ○ | ● (DVIR) |
| Parts / supplies inventory | ● | ○ | ○ | ○ | ○ | ○ | ● | ○ | ○ | ○ | ● |
| Planner / to-do board | ● (kanban) | ○ | ○ | ○ | ○ | ○ | ◐ | ○ | ○ | ● (plan items) | ● |
| Documents / attachments | ● (files, links, cross-record links) | ● (multi-file) | ● (receipt scan) | ◐ (receipts, paid) | ◐ (paid) | ● (receipts) | ● | ○ | ? | ○ | ● |
| Trips / routes | ○ | ● | ● (GPS, GPX) | ● (auto GPS) | ● | ○ | ● | ● | ● (auto) | ○ | ◐ |
| Tags / custom fields | ● (tags + typed extra fields) | ○ | ○ | ● (name/value specs on vehicle) | ○ | ○ | ◐ | ○ | ○ | ○ | ● |
| Unified timeline / history | ● (report generator) | ● | ● (Timeline view) | ● | ● | ● | ● | ● | ● | ● | ● |
| PDF export | ● (print/PDF report) | ◐ (Pro) | ● (share report) | ◐ (paid) | ○ (CSV/HTML) | ○ | ● | ○ | ● | ○ | ● |
| CSV export | ● | ◐ (Pro) | ● | ◐ (paid) | ● | ○ | ● | ● | ● (Excel) | ○ | ● |
| Cost per km + cost by category + monthly | ● | ● | ● | ● | ● | ◐ | ● | ● | ◐ | ○ | ● |
| Fuel economy trend chart | ● | ● | ● | ● | ● | ○ | ● | ● | ● | ○ | ● |
| Local-first / offline | ● (self-hosted) | ○ (account, cloud) | ● (local + optional cloud) | ◐ | ○ | ○ | ○ | ● | ○ | ● | ◐ |
| Price model | Free, MIT | Free + Pro sub (~$12–50/yr), Fleet $42/veh/yr | Free (Android); iOS Premium $17.99/yr | Free / $9.99 once / $9.99 yr | Free w/ ads; aCar premium attachments | Free (lead-gen) | Trial + per-vehicle SaaS | Paid one-time (iOS) | Sub (solo/shared/teams) | Free, AGPL | Per-vehicle SaaS |

## 2. Per-topic findings

### 2.1 Core entities modelled

**LubeLogger** (the most complete schema; fields taken directly from `Models/*.cs`):

- `Vehicle`: Id, ImageLocation, Year, Make, Model, LicensePlate, PurchaseDate, PurchasePrice, SoldDate, SoldPrice, IsElectric, IsDiesel, UseHours (hour meter instead of odometer), OdometerOptional, Tags[], ExtraFields[], HasOdometerAdjustment, OdometerMultiplier (unit conversion, e.g. 0.621), OdometerDifference (cluster swap offset), DashboardMetrics[], VehicleIdentifier (which field is shown instead of plate — useful for generators/forklifts).
- `GenericRecord` (shared by **ServiceRecord**, **CollisionRecord** = "Repair", **UpgradeRecord**): Id, VehicleId, Date, Mileage, Description, Cost, Notes, Files[], Tags[], ExtraFields[], RequisitionHistory[] (supplies consumed). The three types are *functionally identical*; only semantics differ (planned vs unplanned vs enhancement) and records can be moved between tabs.
- `GasRecord`: Date, Mileage, Gallons (decimal), Cost, IsFillToFull (default true), MissedFuelUp, Notes, StartingSoc/EndingSoc (EV, default 20/80), Files, Tags, ExtraFields.
- `TaxRecord`: Date, Description, Cost, Notes, IsRecurring, RecurringInterval (1/3/6/12/24/36/60 months or custom months/days), Files, Tags, ExtraFields. Intended for registration, insurance, fines, roadside assistance, car wash — "expenses unrelated to odometer".
- `OdometerRecord`: Date, InitialMileage, Mileage, computed DistanceTraveled, Notes, Tags, Files. "Last reported odometer" = max mileage across all tabs.
- `ReminderRecord`: Date, Mileage, Description, Notes, IsRecurring, FixedIntervals, UseCustomThresholds + CustomThresholds, Metric (Date | Odometer | Both), ReminderMileageInterval enum (50…150,000 mi, or Other + CustomMileageInterval), ReminderMonthInterval enum (1/3/6/12/24/36/60 months, or Other + CustomMonthInterval in Months|Days), Tags.
- `PlanRecord`: Description, Notes, Priority (Critical/Normal/Low), Progress (Backlog/InProgress/Testing/Done), ImportMode (which record type it becomes: Service/Repair/Upgrade), Cost, ReminderRecordIds[], Files, supplies requisitioned; plan templates reusable.
- `SupplyRecord`: Date, PartNumber, PartSupplier, Quantity (decimal, allows fluids), Description, Cost, Notes, Files, Tags; `SupplyUsageHistory` (Date, PartNumber, Description, Quantity, Cost) per consuming record. Unit cost = total spent / quantity. "Shop supplies" = garage-level shared across vehicles.
- `InspectionRecord`: Date, Mileage, Cost, Description, Results[] (per template field: Description, FieldType Text|Check|Radio, Values[{Description, IsSelected, IsFail}], Failed, Notes), computed Failed = any result failed. Template fields can carry an *action item* (type Service/Repair/Upgrade, description, priority) that auto-creates a Plan record on failure.
- `EquipmentRecord` (installed accessories: Description, IsEquipped, Notes, Tags, Files), `Note` (Description, NoteText, Pinned, Tags, Files), `ExtraField` (Name, Value, IsRequired, FieldType Text|Number|Decimal|Date|Time|Location).

**Drivvo**: Refuelings (incl. EV charging), Expenses (taxes, insurance, fines, parking), Services (oil, brakes, tires), Income (rideshare), Routes, Reminders, Checklists (custom forms, photo attachments), hour meter for equipment, multi-file attachments, multiple vehicle types (car, moto, truck, bus, boat, tractor, generator).

**Fuelio**: Fill-ups with GPS location, station and price crowdsourcing; Costs with categories (service, parking, tolls — users complained the list was short and asked for custom categories, now supported); Reminders; Trip log (GPS, GPX export); bi-fuel/dual-tank vehicles; Timeline view merging fuel and costs.

**Simply Auto**: Vehicle (picture, make, model, year, license, VIN, insurance number, unlimited custom name/value specs such as tire pressure, oil type, spark plug); Fill-ups (date, odometer *or* trip distance, quantity, any two of price/unit + total + quantity, station via GPS, brand auto-suggest, octane, receipt, partial/missed flags); Services & Expenses (date, odometer, total cost, notes, receipt, service center / vendor); Trips (auto GPS/Bluetooth, business/personal); Reminders.

**CARFAX Car Care**: service history pulled from CARFAX's shop network (US only), dashboard of upcoming oil/tires/filters/inspection, recall alerts, repair-cost estimates, shop ratings. Fuel tracker was removed in 2025 (a top complaint).

**AUTOsist / Fleetio / Simply Fleet / Whip Around** add: work orders, parts inventory with low-stock alerts, driver assignment, document expiry tracking (registration, insurance, permits), GPS/telematics, custom inspection forms.

**Hammond** (OSS, Go/Vue): only vehicles, fill-ups, expenses, attachments, users, "quick entries" (snap a receipt now, fill in later). Reminders only on its roadmap — less useful as a schema reference than LubeLogger.

**CarVita** (OSS, Flutter, AGPL): vehicles, maintenance *plan items* with time + mileage intervals including "first service" thresholds, service logs (date, mileage, items, cost, notes), predicted due dates based on usage patterns, local notifications. The only consumer app found that does usage-based prediction.

### 2.2 Maintenance reminder logic

- **Metric choice**: every serious app offers date, odometer, or "whichever comes first" (LubeLogger `ReminderMetric.Both`, Simply Auto "Whichever comes first", Fleetio "Meter OR Time OR both, whichever comes due first").
- **Recurring intervals**: LubeLogger uses preset dropdowns (mileage: 50/100/500/1k/3k/4k/5k/7.5k/10k/15k/20k/30k/40k/50k/60k/100k/150k; time: 1/3/6/12/24/36/60 months) plus "Other" custom in months or days. Simply Auto marks a *service type* as recurring, then the reminder resets whenever a record of that type is logged (e.g. oil at 16,000 + 3,000 interval → next due 19,000).
- **Reset semantics** (LubeLogger `ReminderHelper.GetUpdatedRecurringReminderRecord`): default = new due date/odometer is computed from the *completion* date/odometer; `FixedIntervals = true` keeps the schedule anchored to the original due date (annual registration renews on the same calendar date even if paid early). Both behaviours are worth offering.
- **Urgency states** (LubeLogger, configurable): Not Urgent (>30 days / >100 mi), Urgent (<30 days / <100 mi), Very Urgent (<7 days / <50 mi), Past Due. For `Both`, the algorithm checks date past-due, then odometer past-due, then very-urgent by date, very-urgent by odometer, urgent by date, urgent by odometer — and records *which metric* triggered urgency so the UI can say "por fecha" vs "por km". It also exposes `DueDays` and `DueMileage` deltas.
- **Fleetio**: three states OK / Due Soon / Overdue; "Due Soon thresholds" (time, primary meter, secondary meter) are configured *independently* from the interval; notifications at 07:00 when a reminder becomes Due Soon or Overdue and every 7 days until resolved, plus a Monday digest. Reminder is only resolved when the service entry / work order is *completed*.
- **Prediction**: only CarVita forecasts due dates from observed km/day. LubeLogger explicitly refuses interpolation ("aggregates are only as good as the data you put in"). Fleetio relies on scheduled intervals, not prediction. **Clear differentiator for Car Guy.**
- **Notification approach**: consumer apps use local push (aCar: "function independently of the app running"); LubeLogger uses SMTP e-mails triggered by a cron hitting an API endpoint with urgency filter; Simply Auto Platinum adds e-mail reminders.

### 2.3 Pre-drive / periodic inspection checklists

- **Consumer apps mostly lack it.** Fuelio, Simply Auto, aCar, Fuelly, Road Trip, Motolog: none.
- **Drivvo** has a "Checklists" module described as "custom inspection checklists" for "inspections before and after trips", with photo attachments per item; the pricing page lists "Checklist management" under the Fleet tier only, so treat it as fleet-oriented.
- **LubeLogger Inspections**: admin builds a template with fields of type Text, Radio (single choice; fails if the option flagged `IsFail` is selected) or Check (multi; fails if any option flagged `IsFail` is *not* selected — i.e. "confirm all OK" pattern). Any failed field fails the inspection. Fields can have notes and an *action item* that auto-creates a Plan record (with type and priority). Submitting creates an Inspection record *and* a Service record (so it appears in history with odometer). Records are immutable afterwards except tags/attachments.
- **Fleet DVIR pattern (Fleetio, Whip Around, Simply Fleet, AUTOsist)**: form of grouped items (tires, brakes, lights, fluids, wipers, mirrors, horn, leaks…) each Pass/Fail; on Fail require a comment and/or photo; capture odometer (Whip Around: OCR of the odometer photo), timestamp, location, driver signature; failed items automatically create an *issue* / *work order*; the app "won't let them submit an incomplete report"; pre-trip and post-trip variants; inspection schedules with Due Soon / Overdue notifications; timer from first answer to submit (anti pencil-whipping); Fleetio's "Smart Uploads" builds a form from an uploaded paper checklist.

### 2.4 Vehicle history / timeline and export

- **Fuelio** shows a single chronological *Timeline* mixing fill-ups and costs; report module generates a shareable vehicle report.
- **LubeLogger** shows per-type tabs plus a *Vehicle Maintenance Report* generator (consolidated, printable to PDF), an *Export Attachments* zip ordered chronologically, per-tab CSV export/import, global search, and cross-record links `::RecordType:RecordId` so a repair can point at the inspection that found it.
- **Simply Auto**: PDF and CSV e-mailed reports with period filters (all time, specific month, last 90 days, year, custom); Platinum schedules weekly/monthly.
- **Drivvo**: CSV/Excel (Pro), PDF report sharing.
- **aCar**: CSV and HTML export, import from 15+ apps.
- **Motolog**: PDF and Excel exports aimed at reimbursement.

### 2.5 Statistics / dashboards

Common denominator: total cost, cost per km (Fuelio users explicitly praise this for comparing vs. ride-share), cost by category (pie), monthly spend (bars), fuel economy trend, distance per month. LubeLogger dashboard: "Expenses by type by year/all-time" pie, "Total expenses by month + distance travelled" bars, "Fuel mileage by month" bars, upcoming reminders, year filter, and per-vehicle garage cards that can show TotalCost or CostPerMile. Purchase/sold price yield depreciation and true cost of ownership. Fuelio adds "↓12% vs last month" deltas (Drivvo mirrors this). Simply Auto lets users pick which stat tiles appear and tap a tile to open its chart. Fuelio iOS users complain a fuel-efficiency graph is paywalled — keep that free.

### 2.6 Modifications / upgrades tracking

Only **LubeLogger** models upgrades as a first-class type (Upgrade Records: roof racks, wheels, stereo — same fields as service but separated for cost reporting) plus **Equipment Records** (IsEquipped flag for accessories that come on/off, linkable from odometer records). No consumer app found (Drivvo, Fuelio, Simply Auto, aCar, CARFAX) distinguishes mods from repairs; they land in generic "Expenses".

### 2.7 UX details worth copying

- **Three-way fuel maths**: enter any two of quantity / price-per-unit / total, the third auto-computes (Simply Auto). *Tu Combustible RD already does this.*
- **Odometer or trip distance** entry toggle (Simply Auto, Road Trip MPG).
- **Chronology guard**: backdated odometer must fall between neighbouring readings; error message explains the inconsistency (Simply Auto). LubeLogger offers "Recalculate Distance" when entries are out of order.
- **Auto-fill odometer** with last known value and auto-insert odometer record from any record.
- **Partial / missed fill switches** on the fuel form with clear consequences (economy deferred vs. calculation reset).
- **Station/brand memory**: GPS-suggest station, then auto-populate brand after the first entry (Simply Auto); Fuelio crowdsources prices.
- **Widgets / shortcuts** for one-tap fuel entry; a Fuelio reviewer asked for a "+" directly on the landing screen.
- **Quick entries**: snap a receipt now, complete the record later (Hammond).
- **Tags everywhere** (LubeLogger) — filter fuel by grade/station, filter costs by tag with recalculated averages.
- **Typed extra fields** per record type with required flag; vehicle "custom specs" (tire pressure, oil grade, wiper size — Fuelio users requested exactly this).
- **Moving a record between types** (service ↔ repair ↔ upgrade) and bulk duplicate to other vehicles.
- **Recurring templates** for plan items and inspections.
- **Default service taxonomy**: Simply Auto ships six (Battery, Engine Oil, Spark Plugs, Timing Belt, Tire Rotation, Wheel Alignment) and six expense categories (Fine, Insurance, MOT, Parking, Tax, Toll), with free tier capped at 10 custom services — users hit that cap; ship a richer default list and no cap.
- **Vehicle types**: Drivvo supports motorcycles, trucks, generators (hour meter) — relevant in DR where motorcycles and *plantas* are common.

### 2.8 Monetization (brief)

Drivvo: free with ads; Pro sub $0.99–4.90/mo or $5.99–49.90/yr for cloud, sync, export, no ads; Fleet $42/vehicle/yr min 5. Fuelio: Android fully free after Sygic acquisition; iOS Premium $4.99/mo or $17.99/yr gating maintenance and reports. Simply Auto: free (4–7 vehicles), Gold $9.99 one-time, Platinum $9.99/yr. aCar: free w/ ads, premium for attachments. CARFAX & Jerry: free, funded by shop leads / insurance commissions. AUTOsist, Fleetio, Simply Fleet, Whip Around: per-vehicle SaaS. LubeLogger, Hammond, CarVita: free OSS.

### 2.9 Common complaints (avoid)

- **Data loss on reinstall/sync** (Simply Auto "cleared a few months of logs", no merge; AUTOsist data loss on login; Fuelio Drive backup creating hundreds of duplicate folders).
- **Features moved behind paywall after users relied on them** (Drivvo backup/export; Fuelio iOS; CARFAX removing fuel tracker).
- **Forced account creation locking existing records**; ads still shown to subscribers; misleading renewal notices (Drivvo).
- **Privacy**: location data shared with ad partners (Drivvo 1-star Spanish reviews).
- **Over-complexity** and hidden entry points (Fuelio "way over complex", no plus button on home).
- **Vehicle-count limits** hitting loyal users (aCar, AUTOsist free = 1 vehicle).
- **Calculation errors** in cost-of-ownership after updates (aCar, now rated 2.0★).
- **No sharing with a partner / no web view** (Fuelio).
- **Short, non-editable category lists** (Fuelio FAQ; Simply Auto 10-custom cap).

## 3. Recommended feature set and taxonomy for Car Guy

*(Adopted in `02-specs/01-data-model.md`; differences there win.)*

### 3.1 Entities and fields

- **Vehicle**: id, nickname, type (carro | jeepeta/SUV | camioneta | motor | camión | guagua | otro), year, make, model, trim, plate (`placa`), VIN/chasis, color, fuelType, tankCapacity, initialOdometer, purchaseDate, purchasePrice, soldDate, soldPrice, photo, specs[] (name/value: presión gomas, tipo aceite, batería, bujías, limpiavidrios, tamaño gomas), isArchived.
- **FuelLog**: vehicleId, date, odometer, quantity, unit, pricePerUnit, totalCost (any two ⇒ third), fuelType, isFullTank (default true), missedPrevious, station, receiptPhoto, notes. Derived: distance since last full, km/gal, cost/km.
- **ServiceRecord** (one table, `kind` = mantenimiento | reparación | mejora): vehicleId, date, odometer, kind, serviceTypeIds[] (many items per visit), title, description, costParts, costLabor, totalCost, shop/mechanic, warrantyUntilDate/km, partsUsed[], documents[]. A record can be re-classified.
- **Expense** (non-odometer): vehicleId, date, categoryId, amount, description, vendor, documents[].
- **Reminder**: vehicleId, title, serviceTypeId?, metric (date | odometer | both), dueDate, dueOdometer, isRecurring, intervalMonths|intervalDays, intervalKm, fixedInterval (bool), thresholds, notes, lastCompletedRecordId. Computed: dueDays, dueKm, *predictedDueDate* = today + dueKm / avgKmPerDay, urgency ∈ {ok, próximo, urgente, vencido} and `triggeredBy` (fecha | km).
- **OdometerReading**: vehicleId, date, value, source (fuel | service | manual | inspection). "Current odometer" = max reading.
- **InspectionTemplate / Inspection**: template {name, cadence, items[{label, group, type, requirePhotoOnFail, actionOnFail}]}; inspection {vehicleId, templateId, date, odometer, results[{itemId, status ok|falla|n/a, note, photo}], overallStatus, durationSec}. Failed items create a **Task**.
- **Task**: vehicleId, title, kind, priority (crítica | normal | baja), status (pendiente | en progreso | hecho), estimatedCost, sourceInspectionId, convertsToRecordOnDone.
- **Part**: name, partNumber, supplier, quantity, unitCost.
- **Document**: vehicleId, type (seguro | marbete | matrícula | licencia | factura | garantía | otro), file, issueDate, expiryDate (creates a date reminder automatically), notes.

### 3.2 Default service types (mantenimiento)

Aceite de motor y filtro · Filtro de aire · Filtro de cabina · Filtro de combustible · Bujías · Correa de tiempo/cadena · Correa de accesorios · Líquido de frenos · Pastillas de freno · Discos de freno · Refrigerante/coolant · Aceite de transmisión · Aceite de diferencial/transfer · Rotación de gomas · Alineación · Balanceo · Cambio de gomas · Batería · Limpiavidrios · Amortiguadores · Bombas/gomas de dirección · Aire acondicionado · Revisión técnica / inspección · Lavado y detallado · Otro. Each with a suggested default interval so onboarding can pre-create recurring reminders.

### 3.3 Default expense categories

Seguro · Marbete / renovación de placa · Impuestos · Multas · Peaje · Parqueo · Lavado · Financiamiento (cuota) · Accesorios · Grúa/asistencia · Otro.

### 3.4 Default pre-drive checklist (semanal, ≈2 minutes)

- **Fluidos**: aceite de motor, refrigerante, líquido de frenos, líquido de dirección, agua de limpiavidrios.
- **Gomas**: presión (4 + repuesto), desgaste/labrado, daños visibles.
- **Luces**: delanteras, traseras/freno, direccionales, reversa, tablero sin alertas.
- **Frenos y dirección**: pedal firme, ruidos, vibración.
- **Exterior**: fugas bajo el vehículo, limpiavidrios, espejos, bocina.
- **Documentos**: seguro vigente, marbete vigente, licencia.
Each item: OK / Falla / N/A; "Falla" requires a note, optional photo, and offers "Crear tarea" or "Crear recordatorio".

### 3.5 Timeline, stats and export

One vehicle **Historial** mixing all record kinds with type icons, filters by kind/year and search; per-record links to related items (inspection → task → repair). **Estadísticas**: total gastado, costo/km, gasto por categoría, gasto mensual + km recorridos, rendimiento trend with monthly delta, costo total de propiedad incl. depreciación. **Export**: PDF "Reporte del vehículo", CSV per table, full JSON backup + restore with *merge* (not overwrite).

### 3.6 Product principles derived from complaints

Never gate export/backup or basic charts; no account required (local-first, optional account); no ad SDK; unlimited vehicles and categories; big "+" on home with quick actions; onboarding that pre-creates recurring reminders from the default service list; predicted due dates as the headline differentiator over Drivvo/Fuelio.

## Sources

- LubeLogger docs: https://docs.lubelogger.com/ (Reminders, Service Records, Fuel Records, Planner, Supplies, Inspections, Taxes, Vehicle Management, Dashboard, Odometer, Additional Fields, Bulk Operations, Frequently Requested Feature Requests)
- LubeLogger source: https://github.com/hargata/lubelog (`Models/*`, `Enum/Reminder*.cs`, `Helper/ReminderHelper.cs`)
- Drivvo: https://www.drivvo.com/en · /personal · /fleet-management · /pricing · /faq · Google Play `br.com.ctncardoso.ctncar` · App Store id1206041425
- Fuelio: https://fuel.io/ · https://fuel.io/faq.html · Google Play `com.kajda.fuelio` · App Store id1487753318
- Simply Auto: https://www.simplyauto.app/ · https://simplyauto.app/userguide/index.php · https://simplyauto.app/faq.php · Google Play `mrigapps.andriod.fuelcons`
- aCar (Fuelly LLC): Google Play `com.zonewalker.acar` · https://www.zonewalker.com/acar/ · https://www.fuelly.com/
- CARFAX Car Care: Google Play `com.carfax.mycarfax`
- AUTOsist: https://www.autosist.com/ · Google Play `com.AutoSist.Screens`
- Road Trip MPG: https://darrensoft.ca/roadtrip/ · Motolog: https://motolog.app/ · Jerry: https://www.jerry.ai/
- Fleetio: https://www.fleetio.com/features/inspections · https://help.fleetio.com/en_US/inspections/inspections-overview · https://help.fleetio.com/en_US/service-reminders-schedules/service-reminders-overview
- Whip Around: https://whiparound.com/fleet-inspection-software/ · Simply Fleet: https://www.simplyfleet.app/
- Hammond (OSS): https://github.com/akhilrex/hammond · CarVita (OSS): https://f-droid.org/en/packages/com.wangjinli.carvita/ · https://github.com/JeziL/carvita
