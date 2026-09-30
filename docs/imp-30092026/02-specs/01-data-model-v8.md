# Data model v8 — IMP 30092026

Local migration **v8** (`lib/db/migrationV8.ts`), one transaction; cloud `sql/025_schema_v4.sql`,
`026_rls_v4.sql`, `027_fuel_price_ref.sql`. Conventions as before (ids TEXT, ISO dates, tombstones,
`updated_at`, booleans in `BOOLEAN_COLUMNS`).

## 1. Statements

### 1.1 Fuel prices (note 1)

```sql
CREATE TABLE fuel_price (                    -- the user's own price history (synced)
  id TEXT PRIMARY KEY,
  fuel_type TEXT NOT NULL,                   -- FuelType id
  price REAL NOT NULL,                       -- RD$ per the fuel's posted unit (gal, m³)
  valid_from TEXT NOT NULL,                  -- ISO date (the week's first day, or the day the user saw it)
  source TEXT NOT NULL DEFAULT 'manual',     -- micm | estacion | recibo | app | otro | manual(migrated)
  station TEXT NOT NULL DEFAULT '',          -- when source = estacion/recibo
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, synced_at TEXT
);
CREATE INDEX fuel_price_type_from ON fuel_price(fuel_type, valid_from DESC);
-- data migration: one row per fuel from setting.reference_prices with source 'manual',
-- valid_from = first ISO date parsed from price_week_label ("15–21 ago 2026" → 2026-08-15) else today;
-- the two settings keys are then removed from the store's reads (kept in the table for old backups).

CREATE TABLE fuel_price_ref (                -- LOCAL CACHE of the cloud MICM rows (pull-only, not in SYNC_TABLES)
  id TEXT PRIMARY KEY,                       -- `${week_start}:${fuel_type}`
  fuel_type TEXT NOT NULL, price REAL NOT NULL,
  week_start TEXT NOT NULL, week_end TEXT NOT NULL,
  pdf_url TEXT, imported_at TEXT NOT NULL, stale INTEGER NOT NULL DEFAULT 0
);
```

Board rule: per fuel, the newest by `valid_from`/`week_start` among user rows and ref rows; ties →
user row. "Fuente" chip and date on the board; Cifras chart per fuel over time (both series).

### 1.2 Events (note 5, ADR-44)

```sql
ALTER TABLE milestone ADD COLUMN event_type TEXT NOT NULL DEFAULT 'hito';
  -- hito | accidente | dano_menor | averia | sobrecalentamiento | robo | multa | viaje_largo | junte | otro
ALTER TABLE milestone ADD COLUMN severity TEXT;            -- leve | moderado | grave (null for hito)
ALTER TABLE milestone ADD COLUMN cost_dop REAL;
ALTER TABLE milestone ADD COLUMN pending TEXT NOT NULL DEFAULT '';   -- "pintar el guardafango"
ALTER TABLE milestone ADD COLUMN resolved_at TEXT;
ALTER TABLE milestone ADD COLUMN linked_service_id TEXT;
ALTER TABLE milestone ADD COLUMN linked_mod_id TEXT;
ALTER TABLE milestone ADD COLUMN linked_inspection_id TEXT;
ALTER TABLE milestone ADD COLUMN location_label TEXT NOT NULL DEFAULT '';
-- proofs: album_item.role = 'evento' with milestone_id (column exists since v2)
-- existing rows: kind 'accidente' → event_type 'accidente', severity 'moderado'; others → 'hito'
```

`history_feed` v6: `evento` rows (kind from event_type; title; subtitle "Grave · RD$ 45,000 ·
pendiente: pintar"); the `hito` kind remains for `event_type = 'hito'`.

### 1.3 The car's memory (note 6)

```sql
-- what I actually buy (specsheet already has grades/PNs/sizes)
ALTER TABLE vehicle_specsheet ADD COLUMN oil_brand TEXT;          -- "Castrol Edge"
ALTER TABLE vehicle_specsheet ADD COLUMN oil_product TEXT;        -- "5W-30 Full Synthetic 1 gal"
ALTER TABLE vehicle_specsheet ADD COLUMN oil_filter_brand TEXT;   -- "Fram"
ALTER TABLE vehicle_specsheet ADD COLUMN air_filter_pn TEXT;
ALTER TABLE vehicle_specsheet ADD COLUMN cabin_filter_pn TEXT;
ALTER TABLE vehicle_specsheet ADD COLUMN fuel_filter_pn TEXT;
ALTER TABLE vehicle_specsheet ADD COLUMN wiper_sizes TEXT;        -- "24/18"
ALTER TABLE vehicle_specsheet ADD COLUMN bulb_low TEXT;           -- "H7"
ALTER TABLE vehicle_specsheet ADD COLUMN bulb_high TEXT;
ALTER TABLE vehicle_specsheet ADD COLUMN tire_current_f TEXT;     -- "195/50R15 Bridgestone RE003"
ALTER TABLE vehicle_specsheet ADD COLUMN tire_current_r TEXT;
ALTER TABLE vehicle_specsheet ADD COLUMN battery_brand TEXT;
ALTER TABLE vehicle_specsheet ADD COLUMN where_bought TEXT NOT NULL DEFAULT '';   -- "Amazon / Repuestos X"

CREATE TABLE vehicle_fact (                 -- anything else, key/value, searchable (synced)
  id TEXT PRIMARY KEY, vehicle_id TEXT NOT NULL REFERENCES vehicle(id),
  label TEXT NOT NULL,                      -- "Código de radio", "Torque tapa de válvulas"
  value TEXT NOT NULL, group_name TEXT NOT NULL DEFAULT 'otros',   -- motor | gomas | electrico | carroceria | interior | papeles | otros
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, synced_at TEXT
);
```

### 1.4 Profiles (note 10) — cloud + local mirror

```sql
-- cloud carguy.profiles: avatar_id text, avatar_path text, display_name text (exists? verify), locale text
-- local: setting keys profile_avatar_id, profile_avatar_rel_path (anonymous users), profile_display_name
```

### 1.5 Legal (note 15)

```sql
CREATE TABLE legal_acceptance (            -- local, synced (so a signed-in user carries it)
  id TEXT PRIMARY KEY, version TEXT NOT NULL, accepted_at TEXT NOT NULL,
  locale TEXT NOT NULL, platform TEXT NOT NULL, device_id TEXT NOT NULL,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, synced_at TEXT
);
```

### 1.6 Settings keys

`app_language` (`system | es | en`, local), `onboarded_version`, `tips_seen` (JSON list),
`show_tires` on `vehicle_share` (cloud + local column), `economy_per_fill` (0/1, default 1).

### 1.7 Trips

`trip.diagnostics TEXT` (JSON: raw_points, simplified_points, dropped_excursions, mode) and
`trip_point.keep_until` (ISO; default finalize + 30 days; the purge reads it).

### 1.8 Sync

`SYNC_TABLES` + `fuel_price`, `vehicle_fact`, `legal_acceptance`; `milestone` gains columns (parity
test reads `sql/025`); `fuel_price_ref` is pull-only from the cloud table (`fuel_price_ref` in
`carguy`, anon SELECT) — it is **not** in `SYNC_TABLES`; a small `refreshFuelPriceRef()` on launch.

## 2. Domain (pure, tested)

- `lib/domain/fuelPrices.ts`: `currentBoard(userRows, refRows)`, `series(fuelType)`, `parseWeekLabel`.
- `lib/domain/perFillEconomy.ts` (note 9): for each log with a previous log on the same vehicle
  and increasing odometer: `approxKmPerL = (odo − prevOdo) / volumeL`, flagged `approx: true`,
  excluded when `missed_previous` or the previous log is > 60 days older; never enters
  `averageKmPerL`; shown as "≈ por echada".
- `lib/domain/events.ts`: types, severity labels, `pendingEvents(vehicle)`, `eventTimeline`.
- `lib/domain/tireStats.ts` (ADR-45): `tireStats(vehicleId)`, `garageTireStats()`, `badgesFor(stats)`,
  `messagesFor(stats, locale)`.
- `lib/domain/carMemory.ts`: merges specsheet "what I buy" + facts into searchable sections;
  `suggestionsFor(serviceType)` for the service form ("Igual que siempre").
- `lib/i18n/index.ts` (ADR-39), `lib/legal/index.ts` (version, acceptance state).
