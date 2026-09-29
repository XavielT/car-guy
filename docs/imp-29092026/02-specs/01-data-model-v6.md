# Data model v6 — IMP 29092026

Local SQLite migration **v6** (`lib/db/migrationV6.ts`, registered in `lib/db/migrations.ts`),
mirrored in the cloud by `sql/018_schema_v3.sql` (+ `019_rls_v3.sql`, `020_feedback.sql`). Same
conventions as v2: `id TEXT PRIMARY KEY`, ISO timestamps, `deleted_at` tombstones, `updated_at`
for LWW, `updated_by` on cloud, booleans as INTEGER 0/1 listed in `BOOLEAN_COLUMNS`.

## 1. Statements (in this order, one transaction)

### 1.1 Vehicle

```sql
ALTER TABLE vehicle ADD COLUMN volume_unit TEXT NOT NULL DEFAULT 'gal';          -- 'gal' | 'l' (display)
ALTER TABLE vehicle ADD COLUMN economy_unit TEXT NOT NULL DEFAULT 'km_gal';      -- km_gal | km_l | l_100km
ALTER TABLE vehicle ADD COLUMN reserve_volume_l REAL;                             -- null → 10 % of tank
ALTER TABLE vehicle ADD COLUMN tank_volume_entered REAL;                          -- what was typed
ALTER TABLE vehicle ADD COLUMN status_note TEXT NOT NULL DEFAULT '';              -- "esperando piezas"
ALTER TABLE vehicle ADD COLUMN status_since TEXT;                                 -- ISO date
ALTER TABLE vehicle ADD COLUMN body_type TEXT;                                    -- refdata id, nullable (type stays for jeepeta/camioneta/motor…)
ALTER TABLE vehicle ADD COLUMN color_id TEXT;                                     -- refdata colour id; `color` keeps the free text/label
ALTER TABLE vehicle ADD COLUMN interior_color_id TEXT;
ALTER TABLE vehicle ADD COLUMN interior_material TEXT;                            -- tela | cuero | vinil | alcantara | otro
ALTER TABLE vehicle ADD COLUMN make_id TEXT;                                      -- refdata make id (null when "Otro")
ALTER TABLE vehicle ADD COLUMN model_id TEXT;
ALTER TABLE vehicle ADD COLUMN limit_kmh INTEGER NOT NULL DEFAULT 120;            -- redline on the speed dial
ALTER TABLE vehicle ADD COLUMN trip_mode TEXT NOT NULL DEFAULT 'auto';            -- auto | manual | off (per vehicle; global switch in setting)
-- tank_volume: converted to liters in 1.6
```

`VehicleStatus` becomes
`'activo' | 'proyecto' | 'en_taller' | 'accidentado' | 'guardado' | 'restauracion' | 'prestado' | 'vendido' | 'perdido'`.
No CHECK constraint change is needed (status is TEXT); the domain enum and `es.vehicleStatus` grow.
`isArchivedFor()` → guardado, prestado, vendido, perdido. `isEx()` unchanged. Badge labels:
EN TALLER, ACCIDENTADO, GUARDADO, RESTAURACIÓN, PRESTADO (all `outline`), and the card line
`"<STATUS> · desde <status_since> · <status_note>"`. Existing rows: the C3 stays `guardado` until
Xaviel changes it; the migration does not guess.

### 1.2 Vehicle photos (many)

Vehicles keep `photo_media_id` as the **cover**. The gallery is the album filtered by
`album_item.role = 'vehicle'`:

```sql
ALTER TABLE album_item ADD COLUMN role TEXT NOT NULL DEFAULT 'album';   -- album | vehicle (gallery on the vehicle sheet)
-- sort_order already exists
```

`vehicleGallery(vehicleId)` = album items with role `vehicle` ordered by `sort_order`; the cover is
`photo_media_id` (must be one of them; deleting the cover promotes the next). Photos added in the
vehicle form get `role = 'vehicle'` **and** appear in the album timeline (they are photos of the car).

### 1.3 Fuel (partial fills)

```sql
ALTER TABLE fuel_log ADD COLUMN gauge_before_eighths INTEGER;   -- 0..8, null unknown
ALTER TABLE fuel_log ADD COLUMN gauge_after_eighths INTEGER;    -- 0..8, null unknown
ALTER TABLE fuel_log ADD COLUMN in_reserve INTEGER NOT NULL DEFAULT 0;   -- the BEFORE reading was on reserve
ALTER TABLE fuel_log ADD COLUMN volume_entered REAL;            -- as typed
ALTER TABLE fuel_log ADD COLUMN volume_entered_unit TEXT;       -- 'gal' | 'l'
-- volume, price_per_unit: converted to liters in 1.6
```

### 1.4 Trips

```sql
CREATE TABLE trip (
  id TEXT PRIMARY KEY,
  vehicle_id TEXT NOT NULL REFERENCES vehicle(id),
  source TEXT NOT NULL,                 -- auto | manual
  status TEXT NOT NULL,                 -- recording | done | discarded
  role TEXT NOT NULL DEFAULT 'conductor', -- conductor | pasajero
  started_at TEXT NOT NULL,
  ended_at TEXT,
  start_lat REAL, start_lng REAL, end_lat REAL, end_lng REAL,
  start_label TEXT NOT NULL DEFAULT '', end_label TEXT NOT NULL DEFAULT '',   -- optional names ("Casa", "Trabajo") the user types
  distance_m REAL NOT NULL DEFAULT 0,
  duration_s INTEGER NOT NULL DEFAULT 0,
  moving_s INTEGER NOT NULL DEFAULT 0,
  avg_kmh REAL, avg_moving_kmh REAL, max_kmh REAL,
  speed_buckets TEXT NOT NULL DEFAULT '[0,0,0,0,0]',   -- seconds in <30, 30-60, 60-90, 90-120, 120+ km/h (JSON)
  polyline TEXT,                        -- Google polyline precision 5, simplified
  bbox TEXT,                            -- JSON [minLat,minLng,maxLat,maxLng]
  segments INTEGER NOT NULL DEFAULT 1,  -- merged trips count their parts
  odometer_reading_id TEXT,             -- the trip_estimate reading it produced (null for pasajero)
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, synced_at TEXT
);
CREATE INDEX trip_vehicle_started ON trip(vehicle_id, started_at DESC);

CREATE TABLE trip_point (               -- LOCAL ONLY, never synced, purged 30 days after `done`
  trip_id TEXT NOT NULL REFERENCES trip(id) ON DELETE CASCADE,
  t INTEGER NOT NULL,                   -- epoch ms
  lat REAL NOT NULL, lng REAL NOT NULL,
  speed REAL,                           -- m/s as reported (null unknown)
  acc REAL, alt REAL, heading REAL,
  PRIMARY KEY (trip_id, t)
);

CREATE TABLE trip_state (               -- LOCAL ONLY: the background state machine's memory (one row, id = 'state')
  id TEXT PRIMARY KEY, json TEXT NOT NULL, updated_at TEXT NOT NULL
);
```

Speed buckets for the DR: `<30 · 30–60 · 60–90 · 90–120 · 120+` km/h (Wheelz uses mph buckets;
ours match the 80/100/120 limits people actually see on Autopista Duarte and Las Américas).

### 1.5 Service items — oil

```sql
ALTER TABLE service_record_item ADD COLUMN oil_viscosity TEXT;   -- '5W-30'
ALTER TABLE service_record_item ADD COLUMN oil_type TEXT;        -- mineral | semisintetico | sintetico
ALTER TABLE service_record_item ADD COLUMN oil_spec TEXT;        -- 'API SP · ILSAC GF-6A' free text from picker
ALTER TABLE service_record_item ADD COLUMN oil_brand TEXT;
```

Existing `notes` keep the previous free text; the rendered row shows
"Aceite · Castrol Edge 5W-30 sintético · API SP" from the columns when present.

### 1.6 Unit conversion (data migration inside v6)

```sql
-- keep what was typed
UPDATE fuel_log SET volume_entered = volume, volume_entered_unit = 'gal' WHERE volume_entered IS NULL;
UPDATE vehicle  SET tank_volume_entered = tank_volume WHERE tank_volume_entered IS NULL;
-- convert to liters (all DR data so far is gallons: lib/fuel.ts labels every type 'gal')
UPDATE fuel_log SET volume = ROUND(volume * 3.785411784, 3),
                    price_per_unit = ROUND(price_per_unit / 3.785411784, 4);
UPDATE vehicle  SET tank_volume = ROUND(tank_volume * 3.785411784, 3) WHERE tank_volume IS NOT NULL;
UPDATE vehicle_spec SET value_num = ROUND(value_num * 3.785411784, 3) WHERE key IN ('tank_capacity') AND unit = 'gal';  -- only if such rows exist; check the key names in lib/domain/specPresets.ts first
```

Cloud: the same UPDATEs run in `sql/018` for rows of users **not yet on 2.2** would corrupt data
mid-flight, so **the cloud does not convert**. Instead: `fuel_log.volume_l` and `vehicle.tank_l`
are new cloud columns; 2.2 clients push liters into them and stop writing the old columns;
`schema_hint = 'v6'` is set on every row a 2.2 client writes; a 2.1.x client that pulls a row
with `schema_hint = 'v6'` drops it (gate in `merge.ts` shipped in **2.1.3** so that the gate exists
before any 2.2 client writes). A 2.2 client pulling an old row (no hint) converts gallons → liters
on the way in. `verify-sync` gets checks 18–20 for the three cases.

### 1.7 Settings (new keys, `setting` table, `keyedBy user_key`)

`garage_layout` (JSON `{ mode: 'grid' | 'list' | 'covers', order: [vehicleId…], pinned: id | null }`),
`trips_enabled` (`'auto' | 'manual' | 'off'`, global), `trips_keep_awake` (0/1),
`trips_thresholds` (JSON overrides, advanced), `economy_include_estimates` (0/1),
`last_seen_version` (for Novedades), `feedback_device_id` (uuid, local only — **not** synced:
add to `localOnly` keys? no: `setting` rows sync by `user_key`; store it in AsyncStorage instead).

### 1.8 history_feed v5

Rebuild the view (drop/create as v3/v4 did) to include: `trip` rows (kind `viaje`, title
"Viaje · 12.4 km · 25 min", subtitle start→end labels or times), `inspection_result` photos count
on `chequeo` rows, vehicle status changes (from `vehicle_ownership`? no — add
`vehicle_status_change` **as milestone rows**: a status change inserts a `milestone` of kind
`estado` so it shows in the album timeline and history without a new table).

## 2. Domain rules (pure, tested)

- `lib/domain/units.ts`: `toLiters(v, unit)`, `fromLiters(l, unit)`, `formatVolume`, `formatEconomy(kmPerL, unit)`, `GAL_L = 3.785411784`.
- `lib/domain/economy.ts`: `computeEconomy(logs, cfg)` per research 02 §1.8 — returns `segments`, `spans`, `averageKmPerL` + status/band; the old brim-to-brim tests pass unchanged when no gauge data is present (the measured spans are the same numbers, now in liters and re-expressed per unit by the caller).
- `lib/domain/vehicleStatus.ts`: enum, labels, archived/ex predicates, `statusLine(vehicle)`.
- `lib/domain/refdata/`: `makes.json`, `colors.json`, `bodyTypes.json`, `oil.json` (+ `index.ts` with `searchMakes(q)`, `modelsFor(makeId)`, `yearsFor(modelId?)`).
- `lib/trips/machine.ts`: `step(state, fixes, cfg) → { state, points, open?, close?, merge?, switchTo? }` (research 01 §2.1 + ADR-28), and `lib/trips/geo.ts`: `haversine`, `project`, `simplify`, `encodePolyline`, `stats(points)` (distance, duration, moving, avg, avgMoving, max as 3-sample median with acc ≤ 20, buckets), `effectiveSpeed(prev, cur)`.
- `lib/domain/costs.ts`: `ownershipCost(vehicleId)` = purchase + mods (installed + removed + sold? — sold mods subtract their sale price) + service records + parts + fuel + expenses + track consumables/entries + inventory bought for this car; exposes per-category totals and "por km" using the odometer span.

## 3. Sync additions (`lib/sync/tables.ts`)

Add `trip` (`localOnly: ['syncedAt']`) and nothing else new; extend `BOOLEAN_COLUMNS` with
`fuel_log.in_reserve`. `trip_point`, `trip_state` are not in `SYNC_TABLES` (the parity test must
have an **allow-list of local-only tables** — add it). `feedback` is cloud-only (not in
`SYNC_TABLES`; written through the RPC). Schema-parity test reads `sql/018` too.
