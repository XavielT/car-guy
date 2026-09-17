# Research 2 — Owner inspection checklists, preventive maintenance, DR obligations, reminder logic

*Research date: 2026-09-17. Method note: web search and direct egress were blocked by the session's
proxy; WebFetch reached Listín Diario, elDinero, NHTSA, Michelin, Bridgestone, RAC, The AA, MSF and
Fleetio. `dgii.gov.do`, `intrant.gob.do`, Diario Libre, Consumer Reports, AAA, RACE, DGT and OCU
were unreachable. **[verified]** = read from a fetched page; **[standard]** = widely published
manufacturer-manual conventions to spot-check against the specific owner's manual. All DR facts in
§C are **[verified]** from Listín Diario / elDinero articles dated Oct 2025 – Sep 2026 unless noted.*

---

## A. Owner inspection checklists (daily / weekly / monthly)

### A.1 Design principles the app should encode

- **Check fluids only with the engine cold and the car on level ground.** RAC's oil procedure: park level, pull dipstick, wipe, reinsert fully, read between Min/Max **[verified]**. Coolant: the expansion tank has Min/Max (or "Cold/Full") marks; RAC states cooling-system work must be done only when "cold and depressurised" **[verified]** — the app should never let a coolant task be completed unless the user confirms the engine is cold.
- **Tires cold too.** NHTSA: check "at least once a month, including your spare", when the car has been parked 3+ hours or driven less than ~1.6 km **[verified]**. Bridgestone: the recommended cold PSI is on the driver's door-jamb placard; if you must fill hot, add ~4 psi and re-check cold **[verified]**.
- **Frequency tiers.** RAC: oil monthly for typical driving, **weekly for high mileage or predominantly city driving**, and always before long trips **[verified]**. That "weekly if city driving" rule is a good default for Santo Domingo/Santiago traffic. Michelin: build the habit of "check pressure and do a visual inspection on the first of every month" **[verified]** — a natural monthly reminder anchor.

### A.2 Passenger car checklist (Spanish terms the app can show)

| Item (ES) | How (1-line instruction) | Freq. | Warning signs |
|---|---|---|---|
| Walk-around: gomas visual | Look for bulges, cuts, nails, obvious low tire; glance at wear pattern | Daily | Sidewall bulge, edge wear (alignment), center wear (over-inflation) |
| Fugas bajo el carro (goteo) | Look at the ground where you parked overnight | Daily | Green/orange/pink puddle = coolant; black/brown = oil; red = ATF/PS; clear = usually AC condensate (normal) **[verified: RAC]** |
| Testigos del tablero | Turn key to ON, confirm all lamps go out after start | Daily | Temp gauge rising, coolant thermometer icon, oil can, battery, check-engine, brake |
| Luces | Cycle headlamps, brake, reverse, turn signals; check against a wall or with a helper | Weekly | Any bulb out; foggy/yellowed lens |
| Frenos (sensación) | First stop of the day at low speed: pedal firm, no pull, no noise | Daily | Spongy pedal, pulls to one side, screech/grind, vibration **[verified: AA]** |
| Aceite de motor | Cold, level ground; dipstick between Min/Max; note color | Weekly (city) / Monthly | Below Min; milky (coolant in oil); black and gritty **[verified: RAC]** |
| Refrigerante ("coolant") | **Cold engine only**; level between Min/Max on the plastic tank; never open the radiator cap hot | Weekly | Below Min, needs frequent top-ups (leak), rusty/oily coolant, sweet smell, steam **[verified: RAC]** |
| Líquido de frenos | Reservoir between Min/Max; color should be clear/amber | Monthly | Dark brown, level dropping (worn pads or leak) |
| Líquido de dirección | Dipstick/reservoir Hot-Cold marks (if hydraulic) | Monthly | Whining when turning, low level |
| Aceite de transmisión (ATF) | Only if car has a dipstick: warm engine idling in P, check level and color | Monthly | Dark/burnt smell, slipping, harsh shifts |
| Agua del parabrisas | Top up reservoir | Weekly | Empty; use water + cleaner (no antifreeze needed in DR) |
| Batería / bornes | Terminals tight and free of white/green crust; if serviceable, electrolyte covering plates | Monthly | Slow crank, dim lights, battery lamp **[verified: RAC]** |
| Presión de gomas incl. repuesto | Cold, gauge on all 4 + spare, set to door-jamb placard | Monthly (+ before trips) | >2–3 psi low on one tire = slow leak; tires lose ~1 psi/month naturally **[verified: NHTSA, Michelin]** |
| Labrado (dibujo) | Coin test or wear bars; 1.6 mm (2/32") is the replacement minimum | Monthly | Wear bars flush, uneven wear **[verified: NHTSA]** |
| Limpiaparabrisas (wipers) | Run with washer; blades should clear without streaks or chatter | Monthly | Streaks, torn rubber |
| Correas y mangueras | Cold engine: squeeze hoses (firm, not mushy or rock-hard); belt has no cracks/glazing; no squeal at start | Monthly | Squeal, cracks, swelling near clamps, coolant crust |
| Aire acondicionado | Run AC weekly; outlet air should be noticeably colder than cabin | Weekly | Warm air, musty smell **[verified: AA]** |
| Bocina, espejos, cinturones | Quick functional test | Weekly | — |
| Repuesto, gato, llave, triángulo | Confirm present; spare inflated | Monthly | Spare ages and is often forgotten **[verified: NHTSA, Michelin]** |
| Documentos | Seguro vigente, marbete vigente, licencia in the car | Weekly | Expired → fines at a "ficha" |

### A.3 Overheating prevention module (the incident that triggered the app)

1. **Check coolant weekly, engine cold, before the first start of the day.** Look at the translucent expansion tank; the level must sit between Min and Max. Never open the radiator cap or tank when the engine is warm — the system is pressurized **[verified: RAC]**.
2. **Warning signs**: coolant/thermometer warning lamp, temperature gauge climbing above the middle, sweet smell, steam from the hood, puddle under the car, heater blowing cold while the engine is hot, needing to top up more than once a month **[verified: RAC]**.
3. **If it overheats:** AC off, heater on full, pull over safely, engine off, wait for it to cool fully before opening anything; do not pour cold water on a hot engine or into a hot radiator. **[standard]**
4. **Why 50/50 coolant, not plain water, even though it never freezes in DR:** (a) it **raises the boiling point** (50/50 ethylene-glycol boils ~106–108 °C at atmospheric pressure vs 100 °C for water, higher under system pressure), (b) it **carries corrosion inhibitors** protecting aluminum heads, radiators and the water pump — tap water corrodes and scales, (c) it **lubricates the water-pump seal**. RAC stresses using the type in the owner's manual rather than water alone **[verified]**.
5. **Pre-mixed vs concentrate:** concentrate must be mixed with distilled water, never tap water. Emergency top-up with water is acceptable to get home; then correct to 50/50. **[standard]**
6. **Tropical aggravators:** ambient 30–35 °C, stop-and-go traffic, AC on constantly and slow hill climbs (Autopista Duarte grades) raise coolant temperatures, so a marginal fan, thermostat or low level fails sooner than in temperate climates. **[standard]**

### A.4 Motorcycle differences ("motor")

Use the MSF **T-CLOCS** pre-ride checklist **[verified]** (Tires & wheels, Controls, Lights & electrics, Oil & fluids, Chassis, Stands):

- **Gomas/ruedas:** tread and cold pressure; spokes/rims for cracks; brake pad condition.
- **Controles:** handlebars straight and free; cables routed and lubricated; throttle "moves freely, snaps closed, no revving when handlebars are turned".
- **Luces/eléctrico:** battery terminals clean and tight; headlamp aim; tail/turn signals; switches, mirrors, wiring.
- **Aceite y fluidos:** engine oil, gear oil, hydraulic (brake/clutch) fluid, coolant (liquid-cooled), fuel; leaks at gaskets, seals, hoses.
- **Chasis:** frame cracks, steering-head bearings, suspension, **chain/belt tension and lubrication** (chain lube every ~500 km or after rain), fasteners.
- **Parales:** center/side stand springs and damage.

Frequency: T-CLOCS is intended **before every ride**; for the app, make tires/controls/lights daily and fluids/chain weekly. DR note: motorcycles are the largest single category of the fleet (~3.5 million registered motos) **[verified]**.

### A.5 Diesel SUV / pickup ("jeepeta" / camioneta diésel) differences **[standard]**

- **Fuel-water separator / drain**: drain when the water-in-fuel lamp comes on and at every oil change; DR fuel quality varies, so make this a monthly prompt.
- **Air filter visual** monthly on dusty/rural routes — turbo-diesels are very sensitive to dust.
- **Intercooler/radiator face**: mud, leaves and bugs blocking airflow (overheating risk when towing or on hills).
- **Coolant**: same weekly cold check; diesels run hotter under load.
- **DEF/AdBlue** (newer units, still uncommon in DR): level lamp.
- **Glow-plug lamp** should go out before cranking; long cranking = glow plugs or fuel delivery.
- **4×4 hubs/transfer case**: engage 4WD monthly for a few hundred meters.
- **Tire pressure**: pickups often have different front/rear placard pressures and a load table; the app should store both.

---

## B. Generic preventive maintenance schedule (km and months, whichever first)

### B.1 Why DR = "severe service"

Every manufacturer manual publishes "normal" and "severe/special operating conditions" schedules. Severe = repeated short trips (<8 km), extensive idling or stop-and-go traffic, hot climates, dusty or unpaved roads, towing/roof loads, mountainous driving. RAC echoes this **[verified]**. Urban DR driving satisfies at least three of these most days, so the app's default is the **severe** column.

### B.2 DR/LatAm mechanic conventions

**"Cambio de aceite cada 5,000 km"** with conventional/semi-synthetic oil, **10,000 km with full synthetic** (some dealers 7,500). **[standard/industry practice]** Coincides with the severe-service column of most Japanese and Korean manuals (5,000 mi/8,000 km or 6 months). Ship **5,000 km / 6 months (conventional)** and **10,000 km / 12 months (synthetic)** presets, user-editable.

### B.3 Gasoline passenger car — default schedule

| Item (ES) | km | Months | Notes |
|---|---|---|---|
| Aceite y filtro, conventional/semi-synthetic | 5,000 | 6 | DR convention; RAC quotes 5,000–7,500 mi typical **[verified]** |
| Aceite y filtro, full synthetic | 10,000 (7,500 severe) | 12 | OEMs allow 15,000 km "normal"; not for DR traffic **[standard]** |
| Filtro de aire | Inspect 10,000 / replace 20,000–30,000 | 12–24 | Halve on dusty roads |
| Filtro de cabina | 15,000–20,000 | 12 | AC constant, dust and humidity breed mold |
| Filtro de gasolina | 40,000–80,000 or in-tank "lifetime" | — | |
| Bujías | Copper 30,000–50,000; iridium/platinum 100,000–160,000 | — | |
| Refrigerante | First 100,000–160,000 then 50,000–80,000 (long-life OAT); 40,000 / 2 yrs conventional green | 24–60 | Check level weekly regardless |
| Líquido de frenos | — | 24 (36 max) | Hygroscopic; humid climates degrade it faster |
| Pastillas / discos (revisión) | Every 10,000 (with oil change) | 12 | Replace pads ≈3 mm **[verified: AA]** |
| ATF | 60,000–100,000 severe (many OEMs "lifetime") | 48–60 | Drain-and-fill, not flush |
| CVT | 40,000–60,000 severe | 48 | Nissan/Honda CVTs in DR heat: err short |
| Caja manual | 60,000–100,000 | — | |
| Líquido de dirección (hydraulic) | 80,000–100,000 | 48 | Electric PS: none |
| Correa de accesorios | Inspect 20,000; replace 90,000–120,000 | 60–72 | Rubber ages faster in heat |
| Correa de tiempo | 90,000–120,000 | 72–96 | Replace water pump/tensioner together; chain: none |
| Batería | — | Replace 36–48; test at 24 | RAC 3–5 yr life; heat accelerates degradation **[verified]** — 2–3 yrs typical in the Caribbean |
| Rotación de gomas | 8,000–10,000 | 6 | NHTSA 5,000–8,000 mi; Michelin 6,000–8,000 mi **[verified]** |
| Alineación | 20,000 or after any pothole impact | 12 | Michelin: annually or after impact **[verified]** |
| Balanceo | With rotation / new tires | — | Vibration at 80–110 km/h |
| Cambio de gomas | Tread 1.6 mm; age 6–10 yrs regardless | 72–120 | NHTSA **[verified]**; include the spare |
| Limpiavidrios | — | 6–12 | UV hardens rubber |
| Servicio A/C | 50,000 | 24 | AA: regas every 2 years **[verified]** |
| Rodamientos, terminales, bujes (suspensión) | Inspect 20,000 | 12 | |
| Amortiguadores | Inspect 40,000; replace 80,000–100,000 | — | |
| Mangueras | Inspect every oil change; replace 8–10 yrs | 96–120 | |
| Válvula PCV, cuerpo de aceleración | 50,000 | — | |
| Diferencial (RWD/AWD) | 50,000–100,000 | — | |

### B.4 Diesel pickup / SUV — differences

| Item | km | Months | Notes |
|---|---|---|---|
| Aceite y filtro (diesel-spec) | 5,000 severe / 10,000 normal | 6 | Soot loads oil faster |
| Filtro de combustible + separador de agua | 10,000–20,000; drain water at every oil change | 12 | Highest-value diesel item in DR |
| Filtro de aire | Inspect 5,000, replace 20,000 | 12 | Turbo protection |
| Bujías de precalentamiento | On fault (~100,000+) | — | |
| Transfer + diferenciales | 40,000 severe (water crossings: immediately after) | 24 | |
| Correa de tiempo (older Hilux/Prado/Montero) | 100,000–150,000 | 60–72 | Many modern diesels use chains |
| Refrigerante + intercooler face | Same as gasoline | — | |
| EGR/DPF (Euro-4+) | On symptoms, ~100,000 | — | Short urban trips clog DPF |
| Baterías (often 2) | Test 24, replace 36–48 | — | |
| Rodamientos/hubs | Inspect 20,000; after deep water | 12 | |

---

## C. Dominican Republic recurring obligations (2025–2026 verified)

### C.1 Marbete (annual circulation tax sticker, DGII) — **[verified: Listín Diario, elDinero]**

- Collected by DGII; enforced by DIGESETT under Ley 63-17. Period named "Marbete 2025-2026".
- **Window:** sales opened **21 October 2025**; **online/app sales closed 18 January 2026**; **deadline without surcharge 31 January 2026** (DGII refused any extension, 23 Jan 2026). 2024-2025 ran 22 Oct 2024 – 31 Jan 2025; 2023-2024 online window opened 17 Oct 2023 → expect **third or fourth week of October** as opening and **31 January** as the hard deadline every year.
- **Cost tiers (unchanged for years):** **RD$1,500** for model year **2020 and older**; **RD$3,000** for **2021 and newer** (the boundary shifts yearly; 2024-2025 it was 2019/2020). Rule for the app: model year within the last ~5 years → RD$3,000, otherwise RD$1,500, editable.
- **Late penalties:** RD$2,000 surcharge for not renewing 2025-2026; RD$2,100 for an unpaid 2024-2025 marbete; RD$3,100 for 2023-2024 or older. DIGESETT may retain and tow unrenewed vehicles.
- **Where to pay:** DGII web portal and app (Oficina Virtual), **47 authorized banks / 856 branches**, two DGII collection offices.
- **Behaviour:** 2,086,756 eligible vehicles; 86 % renewed on time; only 30.7 % had renewed by 26 Dec 2025 — Dominicans renew late, so nudges should escalate through January.
- **App reminder design:** first notice ~15 Oct, second at opening, weekly from 5 Jan, hard alarm 18 Jan (online closes) and 25–31 Jan.

### C.2 Seguro de ley / seguro full — **[partially verified]**

- Third-party liability insurance is mandatory under Ley 63-17; DIGESETT checks it with marbete and licencia. Unpaid traffic fines block insurance renewal **[verified]**.
- **"Seguro de ley"** = minimum mandatory responsabilidad civil; **"seguro full"** = comprehensive. Policies annual; some insurers offer semiannual/quarterly.
- Premiums/statutory minimums not fetched — the app stores the policy's own expiry entered by the user. Reminder: 30 and 7 days before expiry; prompt to keep the "carnet del seguro" in the car.

### C.3 Placa / matrícula and traspaso — **[standard, DGII unreachable]**

- Vehicles registered with DGII (matrícula = title; placa = plate). First registration of an import pays "impuesto de primera placa" (17 % of CIF, Ley 557-05) — re-verify.
- **Traspaso**: 2 % of DGII table value plus fees; requires original matrícula, IDs, notarized act of sale, no pending marbetes/fines/oposiciones.
- Pending traffic fines block: license renewal, registration, technical inspection, insurance and traspaso **[verified]** — "check your multas" reminder before any of these: `https://multas.pgr.gob.do/consultas` and `https://portal.servicios.pgr.gob.do/`.

### C.4 Revisión / inspección técnica vehicular (ITV) — **[verified]**

- Ley 63-17 creates a mandatory ITV under INTRANT; Art. 41 sets **vida útil** caps: motorcycles 10 years; light vehicles up to 4 passengers 15; microbuses 17; minibuses 20; buses 25; heavy cargo 30 (Listín, 14 Dec 2025).
- **Not yet operating as a periodic inspection.** In 2019 INTRANT admitted only "inspecciones visuales"; on **29 Oct 2025** DGAPP/INTRANT announced a **20-year PPP with US$88 million private investment, ISO 17020 stations** in an "advanced stage". No start date, frequency or fee published as of Sep 2026.
- **App recommendation:** ship ITV as a disabled reminder ("pendiente de implementación por INTRANT") and surface the vida útil age as an informational badge. "Revisión"/"chequeo" in everyday DR Spanish means a mechanic's check-up, not a state inspection.

### C.5 Licencia de conducir (INTRANT) — **[verified]**

- **Validity:** 4 years standard (categories 01, 02, 05); 3 years for 03/04 (heavy). Decreto 330-26 (May 2026) cut renewals to 2 years after age 75 but the **Tribunal Constitucional struck it down on 15 Sep 2026**.
- New polycarbonate license with QR launched 26 Feb 2026; from 4 Mar 2026 real-vehicle practical exams reinstated.
- **Cost:** renewal reported at **RD$1,900** (confusion over RD$900 / RD$1,900 / RD$2,500 tiers in the first week).
- **Process:** online appointment via `www.intrant.gob.do`; pending fines must be cleared first.
- Reminder: 60 and 30 days before expiry; link to the cita portal; remind to check multas first.

### C.6 Glossary for the app's DR Spanish

| Term | Meaning |
|---|---|
| gomas | tires |
| goma de repuesto | spare tire |
| jeepeta / yipeta | SUV |
| camioneta | pickup |
| guagua | bus / minibus |
| motor | motorcycle; "motoconcho" = moto-taxi |
| bomba | gas station; also "bomba de agua" = water pump |
| ficha | police stop-and-check (traffic slang); "ficha técnica" = spec sheet |
| chequeo / revisión | mechanic check-up; "revisión técnica" = state inspection (not yet active) |
| marbete | annual circulation-tax sticker |
| matrícula / placa | title / plate |
| traspaso | ownership transfer |
| seguro de ley / seguro full | mandatory liability / comprehensive |
| taller · gomera · cambio de aceite | garage · tire shop · oil change |
| coolant / "agua del radiador" | coolant; many drivers literally use water — the app gently corrects this |
| DIGESETT (ex-AMET) | traffic police |

---

## D. Predicted due dates and status thresholds

### D.1 How fleet software does it (Fleetio, verified)

1. `projected_meter_today = last_valid_meter + days_since_last_meter_entry × average_usage_per_day`
2. `meter_until_due = due_meter − projected_meter_today`
3. `forecast_date_meter = today + meter_until_due / average_usage_per_day`
4. For a task with both a km and a time interval, compute each candidate due date and **display the earliest**.
5. After a service entry: `next_due_meter = service_meter + interval_km`; `next_due_date = service_date + interval_months`. If the service entry has no valid meter, use the most recent valid meter entry. If a reminder has no history, the first due date is creation date + interval.
6. **Due-soon thresholds are configurable per task in both time and meter units** and separate from the interval; statuses OK → Due Soon → Overdue. Common convention ≈ **10 % of the interval** **[standard]**.

### D.2 Recommended implementation for Car Guy (adopted in `02-specs/01-data-model.md` §3)

- **km/day:** robust estimator over the odometer log — median of daily rates over the last 30–90 days (or last 5 readings), cold-start default **35–40 km/day** until ≥ 2 readings. Ignore intervals shorter than 1 day or negative deltas; cap ~400 km/day. Refresh at every odometer entry and fill-up.
- **Predicted due date:** `min(time_due_date, today + (due_km − projected_km_today) / km_per_day)`.
- **Status thresholds (defaults, editable):** OK (> 10 % remaining) · Próximo (within 10 % of the km interval, min 300, max 1 000 km, or within 30 days) · Overdue (past either). Legal items use fixed lead times 30/14/7/1 days; marbete uses the fixed calendar.
- **Confidence flag:** if the last odometer entry is older than 30 days, mark the prediction "estimado" and ask for a fresh reading.
- **Snooze/complete rules:** completing captures date + odometer and resets both next-due values; allow "hecho parcialmente" (e.g. topped up coolant) without resetting the interval; repeated top-ups of the same fluid within 30 days = leak warning.

---

## Sources (fetched)

- Listín Diario: marbete articles (4 Feb 2026, 2 Feb 2026, 27 Dec 2025); vida útil / ITV (14 Dec 2025, 29 Oct 2025, 28 Nov 2019); licencia (5 Mar 2026, 6 Mar 2026, 15 May 2026, 15 Sep 2026); multas (16 Sep 2026) — https://listindiario.com/
- elDinero: marbete 2025-2026 (20 Oct 2025), circulation tax comparison (17 Oct 2024), tag /marbete — https://eldinero.com.do/
- NHTSA Tires — https://www.nhtsa.gov/vehicle-safety/tires
- Michelin tire maintenance — https://www.michelinman.com/auto/auto-tips-and-advice/tire-maintenance
- Bridgestone tire pressure — https://www.bridgestonetire.com/learn/maintenance/how-to-check-tire-pressure/
- RAC: engine oil change frequency; battery life; coolant leaks — https://www.rac.co.uk/drive/advice/car-maintenance/
- The AA: brake pads/discs; air-con regassing — https://www.theaa.com/car-care/advice/servicing/
- MSF T-CLOCS — https://msf-usa.org/downloads/T-CLOCS_Inspection_Checklist.pdf
- Prestone cooling system maintenance — https://www.prestone.com/how-to/importance-of-routine-cooling-system-maintenance/
- Fleetio Help: service reminders overview; forecasting; next due date and meter — https://help.fleetio.com/en_US/service-reminders-schedules/

Not reachable (verify later from a browser): dgii.gov.do (marbete, traspaso), intrant.gob.do (licencia), Superintendencia de Seguros, Diario Libre, Consumer Reports, AAA, RACE/DGT/OCU, Toyota/Honda LatAm schedules.
