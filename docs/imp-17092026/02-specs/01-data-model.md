# Spec — Local data model (SQLite) and domain rules

Authoritative for PROMPT-02 (schema + migration) and used by every later prompt. Cloud mirror in
`02-supabase-carguy.md`. Conventions from ADR-02/03: `TEXT` ids, ISO `TEXT` timestamps, `REAL`
money in DOP, `INTEGER` booleans (0/1), soft delete via `deleted_at`, `updated_at` on every write,
`synced_at` local-only.

Migrations live in `lib/db/migrations.ts` as an ordered array of `{ version, up: string[] }` applied
under `PRAGMA user_version`. Version 1 below is the whole initial schema (Car Guy starts at 1; the
legacy AsyncStorage blob is imported into it). Later prompts add versions; they never edit v1.

## 1. Schema v1

```sql
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- Key/value settings (active vehicle, reference prices, preferences)
CREATE TABLE setting (
  key        TEXT PRIMARY KEY NOT NULL,
  value      TEXT NOT NULL,            -- JSON
  updated_at TEXT NOT NULL
);

CREATE TABLE vehicle (
  id               TEXT PRIMARY KEY NOT NULL,
  name             TEXT NOT NULL,             -- "Corolla", "la jeepeta"
  type             TEXT NOT NULL DEFAULT 'carro',  -- carro|jeepeta|camioneta|motor|camion|guagua|otro
  make             TEXT, model TEXT, year INTEGER, trim TEXT, color TEXT,
  plate            TEXT,                      -- placa
  vin              TEXT,                      -- chasis
  default_fuel_type TEXT NOT NULL,            -- premium|regular|gasoil_regular|gasoil_optimo|glp|gnv (FUEL_TYPES)
  tank_volume      REAL,                      -- gal (m³ for gnv)
  initial_odometer_km REAL,
  purchase_date    TEXT, purchase_price REAL, sold_date TEXT, sold_price REAL,
  photo_media_id   TEXT,                      -- FK media.id (nullable, no constraint to avoid cycles)
  notes            TEXT NOT NULL DEFAULT '',
  is_archived      INTEGER NOT NULL DEFAULT 0,
  sort_order       INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, synced_at TEXT
);

-- Free-form specs: presión de gomas, tipo de aceite, batería, bujías, tamaño de gomas, wipers…
CREATE TABLE vehicle_spec (
  id TEXT PRIMARY KEY NOT NULL,
  vehicle_id TEXT NOT NULL REFERENCES vehicle(id),
  name TEXT NOT NULL, value TEXT NOT NULL, sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, synced_at TEXT
);

-- Every odometer observation, whatever produced it. "Current odometer" = MAX(value) not deleted.
CREATE TABLE odometer_reading (
  id TEXT PRIMARY KEY NOT NULL,
  vehicle_id TEXT NOT NULL REFERENCES vehicle(id),
  occurred_at TEXT NOT NULL,
  value_km REAL NOT NULL,
  source TEXT NOT NULL,          -- fuel|service|inspection|manual|import
  source_id TEXT,                -- id of the originating record (same value as that record's id)
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, synced_at TEXT
);
CREATE INDEX idx_odo_vehicle_time ON odometer_reading(vehicle_id, occurred_at);

-- Fuel (1:1 with legacy FillUp; column names snake_case)
CREATE TABLE fuel_log (
  id TEXT PRIMARY KEY NOT NULL,
  vehicle_id TEXT NOT NULL REFERENCES vehicle(id),
  occurred_at TEXT NOT NULL,
  odometer_km REAL NOT NULL,
  volume REAL NOT NULL,            -- gal or m³ per fuel_type
  price_per_unit REAL NOT NULL,
  total_dop REAL NOT NULL,
  fuel_type TEXT NOT NULL,
  is_full_tank INTEGER NOT NULL DEFAULT 1,
  missed_previous INTEGER NOT NULL DEFAULT 0,   -- new: "se me olvidó registrar la anterior" → economy chain resets
  station TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, synced_at TEXT
);
CREATE INDEX idx_fuel_vehicle_time ON fuel_log(vehicle_id, occurred_at);

-- Maintenance catalog (seeded from lib/domain/catalog.ts; user can add/edit)
CREATE TABLE service_type (
  id TEXT PRIMARY KEY NOT NULL,       -- slug for seeded ("aceite_motor"), uuid for user-created
  name TEXT NOT NULL,                 -- "Aceite de motor y filtro"
  category TEXT NOT NULL,             -- motor|frenos|gomas|fluidos|filtros|electrico|suspension|carroceria|otro
  default_interval_km INTEGER,        -- null = no km interval
  default_interval_months INTEGER,    -- null = no time interval
  applies_to TEXT NOT NULL DEFAULT 'all',  -- all|gasolina|diesel|motor  (vehicle type/fuel hint)
  is_seeded INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, synced_at TEXT
);

-- One table for mantenimiento | reparacion | mejora (ADR-09)
CREATE TABLE service_record (
  id TEXT PRIMARY KEY NOT NULL,
  vehicle_id TEXT NOT NULL REFERENCES vehicle(id),
  kind TEXT NOT NULL,                 -- mantenimiento|reparacion|mejora
  occurred_at TEXT NOT NULL,
  odometer_km REAL,
  title TEXT NOT NULL,                -- "Cambio de aceite 5W-30", "Cambio de bomba de agua", "Rines 17"
  description TEXT NOT NULL DEFAULT '',
  cost_parts_dop REAL NOT NULL DEFAULT 0,
  cost_labor_dop REAL NOT NULL DEFAULT 0,
  total_dop REAL NOT NULL DEFAULT 0,  -- kept explicit; = parts + labor unless user overrides
  shop TEXT NOT NULL DEFAULT '',      -- taller / mecánico
  warranty_until_date TEXT, warranty_until_km REAL,
  source_inspection_id TEXT,          -- when created from a failed inspection item
  source_task_id TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, synced_at TEXT
);
CREATE INDEX idx_service_vehicle_time ON service_record(vehicle_id, occurred_at);

-- Catalog items done in one visit (oil + air filter + rotation…). Completing these resets reminders.
CREATE TABLE service_record_item (
  id TEXT PRIMARY KEY NOT NULL,
  service_record_id TEXT NOT NULL REFERENCES service_record(id),
  service_type_id TEXT NOT NULL REFERENCES service_type(id),
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, synced_at TEXT
);

-- Parts used (optional detail)
CREATE TABLE part (
  id TEXT PRIMARY KEY NOT NULL,
  service_record_id TEXT NOT NULL REFERENCES service_record(id),
  name TEXT NOT NULL, part_number TEXT, brand TEXT, quantity REAL NOT NULL DEFAULT 1,
  unit_cost_dop REAL,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, synced_at TEXT
);

-- Non-odometer costs (legacy Expense minus maintenance/repair which migrate to service_record)
CREATE TABLE expense (
  id TEXT PRIMARY KEY NOT NULL,
  vehicle_id TEXT NOT NULL REFERENCES vehicle(id),
  occurred_at TEXT NOT NULL,
  odometer_km REAL,
  category TEXT NOT NULL,             -- seguro|marbete|impuesto|multa|peaje|parqueo|lavado|financiamiento|accesorio|grua|otro
  amount_dop REAL NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  vendor TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, synced_at TEXT
);
CREATE INDEX idx_expense_vehicle_time ON expense(vehicle_id, occurred_at);

-- Reminders (ADR-07)
CREATE TABLE reminder (
  id TEXT PRIMARY KEY NOT NULL,
  vehicle_id TEXT NOT NULL REFERENCES vehicle(id),
  title TEXT NOT NULL,
  service_type_id TEXT,               -- when it is a catalog maintenance reminder
  legal_kind TEXT,                    -- marbete|seguro|licencia|revision_tecnica (DR legal items) or NULL
  metric TEXT NOT NULL,               -- date|km|both
  due_date TEXT, due_km REAL,
  is_recurring INTEGER NOT NULL DEFAULT 0,
  interval_months INTEGER, interval_days INTEGER, interval_km INTEGER,
  fixed_interval INTEGER NOT NULL DEFAULT 0,   -- anchor next due to the original due date (legal items)
  threshold_days INTEGER, threshold_km INTEGER, -- override defaults (null = defaults)
  notes TEXT NOT NULL DEFAULT '',
  last_completed_at TEXT, last_completed_km REAL, last_completed_record_id TEXT,
  snoozed_until TEXT,
  is_enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, synced_at TEXT
);
CREATE INDEX idx_reminder_vehicle ON reminder(vehicle_id);

-- Inspection templates and runs (ADR-08)
CREATE TABLE inspection_template (
  id TEXT PRIMARY KEY NOT NULL,       -- slug for seeded ("carro_semanal"), uuid for custom
  vehicle_id TEXT,                    -- NULL = global template; set = customised copy for one vehicle
  name TEXT NOT NULL,                 -- "Chequeo semanal"
  cadence TEXT NOT NULL,              -- diaria|semanal|mensual|antes_de_viaje|manual
  vehicle_type TEXT NOT NULL DEFAULT 'carro',  -- carro|diesel|motor
  is_seeded INTEGER NOT NULL DEFAULT 0,
  is_enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, synced_at TEXT
);
CREATE TABLE inspection_item (
  id TEXT PRIMARY KEY NOT NULL,
  template_id TEXT NOT NULL REFERENCES inspection_template(id),
  group_name TEXT NOT NULL,           -- Fluidos|Gomas|Luces|Frenos y dirección|Exterior|Documentos|Cadena y controles (motor)
  label TEXT NOT NULL,                -- "Refrigerante"
  how TEXT NOT NULL DEFAULT '',       -- 1-line instruction
  warning TEXT NOT NULL DEFAULT '',   -- what a failure looks like
  requires_cold_engine INTEGER NOT NULL DEFAULT 0,
  on_fail TEXT NOT NULL DEFAULT 'task',   -- task|reminder|none
  related_service_type_id TEXT,       -- e.g. refrigerante → "refrigerante"
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, synced_at TEXT
);
CREATE TABLE inspection (
  id TEXT PRIMARY KEY NOT NULL,
  vehicle_id TEXT NOT NULL REFERENCES vehicle(id),
  template_id TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  odometer_km REAL,
  status TEXT NOT NULL,               -- ok|con_fallas
  duration_sec INTEGER,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, synced_at TEXT
);
CREATE INDEX idx_inspection_vehicle_time ON inspection(vehicle_id, occurred_at);
CREATE TABLE inspection_result (
  id TEXT PRIMARY KEY NOT NULL,
  inspection_id TEXT NOT NULL REFERENCES inspection(id),
  item_id TEXT NOT NULL,
  label_snapshot TEXT NOT NULL,       -- label at the time (templates can change later)
  result TEXT NOT NULL,               -- ok|falla|na
  note TEXT NOT NULL DEFAULT '',
  media_id TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, synced_at TEXT
);

-- Tasks (to-do for the car; created from failed items or by hand)
CREATE TABLE task (
  id TEXT PRIMARY KEY NOT NULL,
  vehicle_id TEXT NOT NULL REFERENCES vehicle(id),
  title TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'reparacion',  -- mantenimiento|reparacion|mejora
  priority TEXT NOT NULL DEFAULT 'normal',  -- critica|normal|baja
  status TEXT NOT NULL DEFAULT 'pendiente', -- pendiente|en_progreso|hecha
  estimated_cost_dop REAL,
  notes TEXT NOT NULL DEFAULT '',
  source_inspection_result_id TEXT,
  done_record_id TEXT,                -- service_record created when marked done
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, synced_at TEXT
);

-- Documents: seguro, marbete, matrícula, licencia, factura, garantía…
CREATE TABLE document (
  id TEXT PRIMARY KEY NOT NULL,
  vehicle_id TEXT NOT NULL REFERENCES vehicle(id),
  kind TEXT NOT NULL,                 -- seguro|marbete|matricula|licencia|factura|garantia|otro
  title TEXT NOT NULL,
  issued_at TEXT, expires_at TEXT,
  reminder_id TEXT,                   -- auto-created date reminder when expires_at set
  media_id TEXT,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, synced_at TEXT
);

-- Media (ADR-10)
CREATE TABLE media (
  id TEXT PRIMARY KEY NOT NULL,
  owner_table TEXT NOT NULL, owner_id TEXT NOT NULL,
  kind TEXT NOT NULL,                 -- photo|pdf
  mime TEXT NOT NULL,
  rel_path TEXT,                      -- Android: relative to Paths.document
  blob BLOB,                          -- web: bytes
  width INTEGER, height INTEGER, size_bytes INTEGER,
  remote_path TEXT,                   -- Storage object path once uploaded
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, synced_at TEXT
);
CREATE INDEX idx_media_owner ON media(owner_table, owner_id);

-- Unified history (ADR-09). Views are cheap to recreate in later migrations.
CREATE VIEW history_feed AS
  SELECT id, vehicle_id, 'combustible' AS kind, occurred_at, odometer_km,
         fuel_type AS title, station AS subtitle, total_dop AS amount_dop FROM fuel_log WHERE deleted_at IS NULL
  UNION ALL
  SELECT id, vehicle_id, kind, occurred_at, odometer_km, title, shop, total_dop FROM service_record WHERE deleted_at IS NULL
  UNION ALL
  SELECT id, vehicle_id, 'gasto', occurred_at, odometer_km, description, category, amount_dop FROM expense WHERE deleted_at IS NULL
  UNION ALL
  SELECT id, vehicle_id, 'chequeo', occurred_at, odometer_km, status, template_id, NULL FROM inspection WHERE deleted_at IS NULL;
```

Settings keys (JSON values): `active_vehicle_id`, `reference_prices` (Record<FuelType, number>),
`price_week_label`, `theme` (`system|dark|light`), `notifications_enabled`, `km_per_day_override`,
`onboarding_done`, `legacy_import_done`, `auth_user_id` (PROMPT-08), `last_sync_at` (PROMPT-09).

## 2. Legacy import (Tu Combustible RD backup JSON → v1)

Input: `{ app: 'tu-combustible-rd', version: 1, exportedAt, data: AppData }` or raw `AppData`
(`lib/backup.ts` accepts both today). Also, on web only, the AsyncStorage key
`tu-combustible-rd/v1` if it exists on the same origin (it will not, on the new domain, but it is
two lines).

| Legacy | → Car Guy |
|---|---|
| `Vehicle {id,name,plate,defaultFuelType,tankVolume,createdAt}` | `vehicle` same id; `type='carro'`; `updated_at=createdAt` |
| `FillUp` | `fuel_log` same id, 1:1 columns; **plus** an `odometer_reading(source='fuel', source_id=fuel.id)` |
| `Expense.category ∈ {maintenance, repair}` | `service_record` same id, `kind = mantenimiento|reparacion`, `title=description`, `total_dop=amountDop`, `odometer_km`; odometer reading if present |
| `Expense.category ∈ {insurance→seguro, tax→impuesto, toll→peaje, parking→parqueo, wash→lavado, other→otro}` | `expense` same id |
| `MaintenanceReminder {title,dueDate,dueOdometerKm,completedAt,notes}` | `reminder` same id: `metric` from which of date/km is set (`both` if both), `is_recurring=0`, `is_enabled = completedAt IS NULL`, `last_completed_at=completedAt` |
| `Settings` | `setting` keys `active_vehicle_id`, `reference_prices`, `price_week_label` |

Rules: idempotent (re-importing the same file changes nothing — upsert by id); counts reported
back to the user ("3 vehículos, 148 cargas, 12 gastos, 4 recordatorios"); import runs in one
transaction; the file's `exportedAt` is stored in `setting.legacy_import_done`. After import, run
the **default seeding** for each imported vehicle (catalog reminders) exactly as for a new vehicle,
skipping any whose title already matches an imported reminder.

## 3. Domain rules

### 3.1 Odometer and km/day (`lib/domain/odometer.ts`)

- `currentOdometer(vehicleId) = MAX(value_km)` over non-deleted readings; the UI proposes it as the
  default in every form and warns (not blocks) when a new value is lower than the max **and** the
  date is not earlier than the max's date. Editing a record re-validates against its neighbours.
- `kmPerDay(readings, today)`: take readings from the last 90 days (at least the last 5 if fewer
  fall in the window), sort by date, build daily rates between consecutive readings ≥ 1 day apart
  and with positive delta, return the **median**; cap 400; if < 2 usable readings return the
  fallback **35** with `confidence: 'baja'`; if the newest reading is > 30 days old return
  `confidence: 'estimada'`, else `'buena'`. Tests: monotone series, a typo (negative delta) ignored,
  same-day duplicates ignored, fallback path.

### 3.2 Reminders (`lib/domain/reminders.ts`)

Inputs: reminder row, `today`, `currentKm`, `kmPerDay`. Output:

```ts
type ReminderStatus = {
  status: 'ok' | 'proximo' | 'urgente' | 'vencido' | 'sin_datos';
  triggeredBy: 'fecha' | 'km' | null;
  dueDays: number | null;        // negative = overdue
  dueKm: number | null;          // negative = overdue
  predictedDueDate: string | null;  // ISO date; for km-only or both
  confidence: 'buena' | 'estimada' | 'baja';
};
```

- Thresholds (defaults, overridable per reminder): `proximoDays = 30`, `urgenteDays = 7`;
  `proximoKm = clamp(10 % of interval_km, 300, 1000)` (300 when no interval), `urgenteKm = 100`.
  For `legal_kind` reminders: `proximoDays = 45`, `urgenteDays = 14` (marbete/seguro need a bank
  visit).
- Evaluate date and km independently, then take the **worse** state; `triggeredBy` records which
  one. `snoozed_until` in the future downgrades anything to `ok` until that date (but the report
  still shows "pospuesto").
- `predictedDueDate = today + ceil(dueKm / kmPerDay)` when `dueKm ≥ 0`; if both metrics exist the
  displayed date is `min(due_date, predictedDueDate)`.
- **Completion** (`completeReminder(reminder, {date, km, recordId})`): sets
  `last_completed_*`; if `is_recurring`: `due_km = km + interval_km` (when interval_km),
  `due_date = fixed_interval ? addMonths(due_date, interval_months) : addMonths(date, interval_months)`
  (or `interval_days`); if not recurring → `is_enabled = 0`. Legal items are always
  `fixed_interval = 1`.
- **Auto-completion from a service record**: saving a `service_record` with items resets every
  enabled reminder of the same vehicle whose `service_type_id` is among the items (same rule).
  Report to the user which reminders were reset ("Se actualizó: Aceite de motor → próximo a los
  57,000 km / 15 mar 2027").
- `sin_datos` when metric needs km and the vehicle has no odometer reading.

### 3.3 Default reminders on vehicle creation (`lib/domain/catalog.ts`)

For a new (or imported) vehicle, create enabled recurring reminders from the catalog rows flagged
`seed_reminder` (below), with `due_km = currentKm + interval_km` (if km known, else metric `date`
only) and `due_date = today + interval_months`, `metric = both` where both exist. Plus the DR legal
set: **marbete** (`legal_kind='marbete'`, `metric='date'`, `due_date = next 31 Jan`, recurring 12
months, fixed), **seguro** (`due_date` null until the user enters the policy → status `sin_datos`
with a prompt "Pon la fecha de vencimiento de tu seguro"), **licencia** (same, optional), and
**revisión técnica** disabled by default with note "Pendiente de implementación por INTRANT".
The user can delete any of these.

### 3.4 Service catalog (seed) — DR "severe service" defaults

Sources: `01-research/02-maintenance-checklists-dr.md` §B. Intervals are editable per vehicle via
the reminder. `applies_to`: all unless noted.

| id | name | category | km | months | seed_reminder | notes |
|---|---|---|---|---|---|---|
| aceite_motor | Aceite de motor y filtro | motor | 5000 | 6 | ✔ | Sintético: 10 000 / 12 — offered as a toggle when creating the vehicle ("¿Aceite sintético?") |
| filtro_aire | Filtro de aire | filtros | 20000 | 12 | ✔ | Diesel/rural: 10 000 |
| filtro_cabina | Filtro de cabina (A/C) | filtros | 15000 | 12 | ✔ | AC always on in DR |
| filtro_combustible | Filtro de combustible | filtros | 40000 | 24 | ✔ (diesel: 15000/12) | |
| bujias | Bujías | motor | 40000 | — | ✔ (gasolina) | Iridium 100 000 |
| refrigerante | Refrigerante (cambio) | fluidos | 40000 | 24 | ✔ | Level is checked in inspections, not here |
| liquido_frenos | Líquido de frenos | fluidos | — | 24 | ✔ | |
| pastillas_frenos | Pastillas de freno (revisión/cambio) | frenos | 10000 | 12 | ✔ (inspect) | |
| discos_frenos | Discos de freno | frenos | — | — | | |
| aceite_transmision | Aceite de transmisión (ATF/CVT) | fluidos | 60000 | 48 | ✔ | CVT: 40 000 |
| aceite_diferencial | Aceite de diferencial / transfer | fluidos | 40000 | 24 | (diesel/4x4) | |
| liquido_direccion | Líquido de dirección | fluidos | 80000 | 48 | | |
| correa_accesorios | Correa de accesorios | motor | 90000 | 60 | ✔ | inspect every oil change |
| correa_tiempo | Correa de tiempo | motor | 100000 | 72 | | Only if the engine has a belt (vehicle spec) |
| bateria | Batería | electrico | — | 36 | ✔ | Heat: 2–3 years typical |
| rotacion_gomas | Rotación de gomas | gomas | 10000 | 6 | ✔ | With oil change |
| alineacion | Alineación | gomas | 20000 | 12 | ✔ | or after a pothole |
| balanceo | Balanceo | gomas | — | — | | |
| cambio_gomas | Cambio de gomas | gomas | 50000 | 72 | | age ≤ 6–10 years by DOT |
| limpiavidrios | Limpiavidrios (wipers) | carroceria | — | 12 | ✔ | |
| servicio_ac | Servicio de A/C | otro | 50000 | 24 | ✔ | |
| amortiguadores | Amortiguadores | suspension | 80000 | — | | |
| suspension_revision | Revisión de suspensión y dirección | suspension | 20000 | 12 | | |
| mangueras | Mangueras y correas (revisión) | motor | 10000 | 12 | | |
| separador_agua | Drenar separador de agua (diesel) | filtros | 5000 | 6 | ✔ (diesel) | |
| cadena_moto | Cadena / kit de arrastre (motor) | otro | 500 | 1 | ✔ (motor) | lubricate; replace ~20 000 |
| lavado | Lavado y detallado | carroceria | — | — | | not a reminder |
| otro | Otro | otro | — | — | | |

### 3.5 Inspection templates (seed)

`carro_semanal` (default for carro/jeepeta/camioneta gasolina), `diesel_semanal` (adds
separador de agua, filtro de aire visual, intercooler/radiador), `motor_prerodaje` (T-CLOCS:
Gomas y ruedas · Controles · Luces y eléctrico · Aceite y fluidos · Chasis y cadena · Parales),
plus `carro_diario` (2-minute: fugas bajo el carro, testigos del tablero, gomas visual, frenos
al primer frenazo) and `carro_mensual` (presión incl. repuesto, labrado, batería/bornes,
correas/mangueras, limpiavidrios, kit de emergencia). Items, `how`, `warning`,
`requires_cold_engine` come from `01-research/02-maintenance-checklists-dr.md` §A.2/A.4/A.5 —
copy them faithfully. `refrigerante`, `aceite_motor`, `liquido_frenos` are `requires_cold_engine = 1`.

### 3.6 Expense categories

`seguro, marbete, impuesto, multa, peaje, parqueo, lavado, financiamiento, accesorio, grua, otro`
with Spanish labels. Legacy mapping in §2.

### 3.7 DR legal calendar (`lib/domain/legal-dr.ts`)

- Marbete: window opens around the **third/fourth week of October**, online sales close around
  **18 January**, hard deadline **31 January** (no extension in 2026). Tier: RD$ 1 500 for model
  year ≤ (currentYear − 6), RD$ 3 000 newer — shown as "estimado" and editable. Nudges: 15 Oct
  ("abre pronto"), opening day, weekly from 5 Jan, 18 Jan, 25 Jan, 31 Jan. Penalty note RD$ 2 000.
- Seguro: user-entered expiry; lead 45/14/7 days.
- Licencia: user-entered expiry; validity 4 years standard; lead 60/30 days; note "revisa multas
  pendientes antes de renovar" with the PGR consult URL.
- Revisión técnica: disabled, informational badge with the vehicle's *vida útil* (Ley 63-17 art.
  41: motor 10 años, carro 15, etc.).

### 3.8 Statistics (`lib/domain/stats.ts`) — pure functions over repo rows

`monthlySpend(vehicleId, months=12)` by category · `costPerKm(range)` = (fuel + service + expense) /
distance · `economySeries` (reuse `computeEconomy`) · `spendByCategory(range)` ·
`totalCostOfOwnership` = purchase − sold + all spend · `distancePerMonth` from readings ·
`upcomingCosts` (sum of estimated tasks + due reminders with last cost). All exclude tombstones.
