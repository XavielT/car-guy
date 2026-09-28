# Spec — Schema v2 (migration `version: 2`) and domain rules

Authoritative for PROMPT-01 (writes the migration) and every later phase. Conventions from v1:
`TEXT` ids, ISO `TEXT` timestamps, `REAL` money, `INTEGER` booleans, `deleted_at` tombstones,
`updated_at` on every write, `synced_at` local-only. Every new table is syncable unless marked
**local-only**. Cloud mirror = snake_case of these with `user_id`, `server_updated_at`, no
`synced_at`/`blob` (`sql/009_schema_v2.sql`).

## 1. Migration v2 — SQL

```sql
-- ===== vehicle: identity, status, story =====
ALTER TABLE vehicle ADD COLUMN nickname TEXT;                   -- "hachi-gō", "la jeepeta"
ALTER TABLE vehicle ADD COLUMN status TEXT NOT NULL DEFAULT 'activo';  -- activo|proyecto|guardado|vendido|perdido
ALTER TABLE vehicle ADD COLUMN chassis_code TEXT;               -- AE85, S13, A51 (C3), SA (DS3)
ALTER TABLE vehicle ADD COLUMN chassis_number TEXT;             -- JDM frame number when no VIN
ALTER TABLE vehicle ADD COLUMN engine_code TEXT;                -- 4A-GE 20V, TU5JP4, EP6
ALTER TABLE vehicle ADD COLUMN transmission TEXT;               -- manual|automatica|cvt|otro
ALTER TABLE vehicle ADD COLUMN drivetrain TEXT;                 -- fwd|rwd|awd
ALTER TABLE vehicle ADD COLUMN origin TEXT;                     -- jdm|usdm|eudm|local|otro
ALTER TABLE vehicle ADD COLUMN imported_year INTEGER;
ALTER TABLE vehicle ADD COLUMN story TEXT NOT NULL DEFAULT ''; -- markdown-ish free text
ALTER TABLE vehicle ADD COLUMN hero_media_id TEXT;              -- cover photo (photo_media_id stays as avatar)
ALTER TABLE vehicle ADD COLUMN garage_role TEXT;                -- local mirror of my role: owner|editor|viewer (null = mine)

-- ===== ownership periods (Ex vehicles) =====
CREATE TABLE vehicle_ownership (
  id TEXT PRIMARY KEY NOT NULL,
  vehicle_id TEXT NOT NULL REFERENCES vehicle(id),
  acquired_at TEXT, acquired_km REAL, acquired_price REAL, acquired_from TEXT,
  sold_at TEXT, sold_km REAL, sold_price REAL, sold_to TEXT, reason TEXT,
  is_current INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, synced_at TEXT
);

-- ===== media: dates, thumbs =====
ALTER TABLE media ADD COLUMN taken_at TEXT;                     -- real photo date (from EXIF/MediaStore/user)
ALTER TABLE media ADD COLUMN date_precision TEXT NOT NULL DEFAULT 'day';  -- day|month|year
ALTER TABLE media ADD COLUMN source TEXT NOT NULL DEFAULT 'camera';       -- camera|library|import|web
ALTER TABLE media ADD COLUMN remote_thumb_path TEXT;
ALTER TABLE media ADD COLUMN thumb_rel_path TEXT;               -- Android local thumb
ALTER TABLE media ADD COLUMN thumb_blob BLOB;                   -- web local thumb (local-only column)
ALTER TABLE media ADD COLUMN blurhash TEXT;
ALTER TABLE media ADD COLUMN caption TEXT NOT NULL DEFAULT '';
ALTER TABLE media ADD COLUMN is_favorite INTEGER NOT NULL DEFAULT 0;
CREATE INDEX idx_media_taken ON media(owner_table, owner_id, taken_at);

-- ===== album + milestones =====
CREATE TABLE album_item (
  id TEXT PRIMARY KEY NOT NULL,
  vehicle_id TEXT NOT NULL REFERENCES vehicle(id),
  media_id TEXT NOT NULL,
  milestone_id TEXT, mod_id TEXT, track_event_id TEXT,          -- optional anchors
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, synced_at TEXT
);
CREATE INDEX idx_album_vehicle ON album_item(vehicle_id);
CREATE TABLE milestone (
  id TEXT PRIMARY KEY NOT NULL,
  vehicle_id TEXT NOT NULL REFERENCES vehicle(id),
  kind TEXT NOT NULL,            -- compra|swap|restauracion|primer_track|accidente|venta|pintura|otro
  occurred_at TEXT NOT NULL, odometer_km REAL,
  title TEXT NOT NULL, story TEXT NOT NULL DEFAULT '',
  cover_media_id TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, synced_at TEXT
);

-- ===== build log =====
CREATE TABLE mod_category (
  id TEXT PRIMARY KEY NOT NULL,      -- slug for seeded (motor, admision, escape, forzada, ecu, combustible,
                                     -- enfriamiento, transmision, diferencial, suspension, frenos, ruedas,
                                     -- gomas, exterior, aero, interior, seguridad, iluminacion, audio_electrico,
                                     -- fabricacion, otro); uuid for user-created
  name TEXT NOT NULL, icon TEXT, sort_order INTEGER NOT NULL DEFAULT 0, is_seeded INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, synced_at TEXT
);
CREATE TABLE mod (
  id TEXT PRIMARY KEY NOT NULL,
  vehicle_id TEXT NOT NULL REFERENCES vehicle(id),
  category_id TEXT NOT NULL,
  name TEXT NOT NULL, brand TEXT, part_number TEXT, variant TEXT,
  status TEXT NOT NULL DEFAULT 'instalado',   -- planeado|pedido|instalado|quitado|vendido|danado
  installed_at TEXT, installed_km REAL, removed_at TEXT, removed_km REAL,
  installer_type TEXT NOT NULL DEFAULT 'yo',  -- yo|taller|amigo
  contact_id TEXT,                            -- taller that installed it
  cost_part_dop REAL NOT NULL DEFAULT 0, cost_labor_dop REAL NOT NULL DEFAULT 0,
  cost_shipping_dop REAL NOT NULL DEFAULT 0, cost_customs_dop REAL NOT NULL DEFAULT 0,
  price_foreign REAL, currency TEXT,           -- e.g. 210 USD (fx below); DOP total is the truth
  fx_rate_to_dop REAL,
  vendor TEXT, vendor_url TEXT,
  replaces_mod_id TEXT,
  affects_specs INTEGER NOT NULL DEFAULT 0,
  spec_effects TEXT NOT NULL DEFAULT '{}',    -- JSON: {hp, torque_nm, weight_kg, engine_code, ecu, induction,
                                              --        wheel_f, wheel_r, tire_f, tire_r, ride_height_mm, ...}
  service_record_id TEXT,                     -- the v2.0 'mejora' record this came from (migration)
  sold_price_dop REAL, sold_to TEXT,
  tags TEXT NOT NULL DEFAULT '[]',
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, synced_at TEXT
);
CREATE INDEX idx_mod_vehicle ON mod(vehicle_id, status);
CREATE TABLE mod_media (
  id TEXT PRIMARY KEY NOT NULL,
  mod_id TEXT NOT NULL REFERENCES mod(id),
  media_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'foto',         -- antes|despues|instalacion|recibo|dyno|foto
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, synced_at TEXT
);
CREATE TABLE vehicle_specsheet (
  id TEXT PRIMARY KEY NOT NULL,             -- = vehicle_id (1:1)
  vehicle_id TEXT NOT NULL REFERENCES vehicle(id),
  preset_id TEXT,
  stock TEXT NOT NULL DEFAULT '{}',         -- JSON spec fields (factory)
  overrides TEXT NOT NULL DEFAULT '{}',     -- JSON manual overrides on top of derived current
  field_sources TEXT NOT NULL DEFAULT '{}', -- JSON {field: preset|user|vpic}
  verified_fields TEXT NOT NULL DEFAULT '[]',
  -- flat DIY fields (queried often):
  oil_capacity_l REAL, oil_capacity_filter_l REAL, oil_grade TEXT, oil_spec TEXT, oil_filter_pn TEXT,
  coolant_capacity_l REAL, coolant_type TEXT, trans_oil_l REAL, trans_oil_spec TEXT, diff_oil_l REAL, diff_oil_spec TEXT,
  brake_fluid TEXT, ps_fluid TEXT, spark_plug_pn TEXT, plug_gap_mm REAL, battery_spec TEXT,
  tire_size_oem_f TEXT, tire_size_oem_r TEXT, psi_oem_f REAL, psi_oem_r REAL,
  bolt_pattern TEXT, center_bore_mm REAL, lug_torque_nm REAL, lug_thread TEXT,
  fuel_tank_l REAL, fuel_octane INTEGER,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, synced_at TEXT
);
CREATE TABLE spec_snapshot (                -- pinned "así estaba" spec sheets
  id TEXT PRIMARY KEY NOT NULL,
  vehicle_id TEXT NOT NULL REFERENCES vehicle(id),
  label TEXT NOT NULL, as_of TEXT NOT NULL, specs TEXT NOT NULL DEFAULT '{}', cover_media_id TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, synced_at TEXT
);
CREATE TABLE torque_spec (
  id TEXT PRIMARY KEY NOT NULL,
  vehicle_id TEXT NOT NULL REFERENCES vehicle(id),
  item TEXT NOT NULL, value_nm REAL NOT NULL, stage TEXT, source TEXT, media_id TEXT, notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, synced_at TEXT
);
CREATE TABLE wishlist_item (
  id TEXT PRIMARY KEY NOT NULL,
  vehicle_id TEXT NOT NULL REFERENCES vehicle(id),
  category_id TEXT, name TEXT NOT NULL, brand TEXT, part_number TEXT,
  priority INTEGER NOT NULL DEFAULT 2,       -- 1 próximo, 2 pronto, 3 algún día
  est_price_foreign REAL, currency TEXT, est_shipping_dop REAL, est_customs_dop REAL, est_total_dop REAL,
  url TEXT, vendor TEXT, target_date TEXT,
  status TEXT NOT NULL DEFAULT 'idea',       -- idea|ahorrando|pedido|convertido|descartado
  converted_mod_id TEXT, notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, synced_at TEXT
);
CREATE TABLE inventory_item (
  id TEXT PRIMARY KEY NOT NULL,
  owner_vehicle_id TEXT,                     -- null = garage stock
  kind TEXT NOT NULL,                        -- pieza|aro|goma|fluido|herramienta|consumible
  name TEXT NOT NULL, brand TEXT, part_number TEXT, qty REAL NOT NULL DEFAULT 1, unit TEXT,
  condition TEXT NOT NULL DEFAULT 'usado',   -- nuevo|usado|core
  location TEXT, cost_dop REAL, acquired_at TEXT,
  fits_vehicle_ids TEXT NOT NULL DEFAULT '[]', media_id TEXT, notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, synced_at TEXT
);
CREATE TABLE wheel_set (
  id TEXT PRIMARY KEY NOT NULL,
  vehicle_id TEXT NOT NULL REFERENCES vehicle(id),
  name TEXT NOT NULL, brand TEXT, model TEXT,
  width_in REAL, diam_in INTEGER, offset_mm INTEGER, bolt_pattern TEXT, center_bore_mm REAL,
  qty INTEGER NOT NULL DEFAULT 4, position_pref TEXT NOT NULL DEFAULT 'any',
  status TEXT NOT NULL DEFAULT 'montado',    -- montado|guardado|vendido
  media_id TEXT, notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, synced_at TEXT
);
CREATE TABLE tire (
  id TEXT PRIMARY KEY NOT NULL,
  vehicle_id TEXT NOT NULL REFERENCES vehicle(id),
  wheel_set_id TEXT,
  brand TEXT, model TEXT, size TEXT,          -- "195/50R15"
  width_mm INTEGER, aspect INTEGER, rim_in INTEGER, load_index TEXT, speed_rating TEXT,
  dot_code TEXT, dot_week INTEGER, dot_year INTEGER, compound TEXT, treadwear INTEGER,
  position TEXT NOT NULL DEFAULT 'unmounted',  -- fl|fr|rl|rr|spare|unmounted
  tread_mm_new REAL, tread_mm_current REAL, heat_cycles INTEGER NOT NULL DEFAULT 0,
  purchased_at TEXT, cost_dop REAL,
  status TEXT NOT NULL DEFAULT 'en_uso',      -- nueva|en_uso|guardada|quemada|vendida
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, synced_at TEXT
);

-- ===== DIY =====
CREATE TABLE dtc_code (                        -- LOCAL-ONLY, bundled (MIT), not in SYNC_TABLES
  code TEXT PRIMARY KEY NOT NULL, system TEXT NOT NULL, desc_en TEXT NOT NULL, desc_es TEXT NOT NULL,
  is_generic INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE vehicle_dtc_event (
  id TEXT PRIMARY KEY NOT NULL,
  vehicle_id TEXT NOT NULL REFERENCES vehicle(id),
  code TEXT NOT NULL, seen_at TEXT NOT NULL, odometer_km REAL, cleared_at TEXT,
  repair_record_id TEXT, notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, synced_at TEXT
);
CREATE TABLE contact (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL, kind TEXT NOT NULL,      -- mecanico|gomera|dealer|pintor|grua|electrico|otro
  phone TEXT, whatsapp TEXT, address TEXT, notes TEXT NOT NULL DEFAULT '', rating INTEGER,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, synced_at TEXT
);
ALTER TABLE service_record ADD COLUMN contact_id TEXT;
CREATE TABLE fluid_guide_item (
  id TEXT PRIMARY KEY NOT NULL,
  vehicle_id TEXT NOT NULL REFERENCES vehicle(id),
  kind TEXT NOT NULL,                          -- aceite|coolant|frenos|direccion|atf|washer|bateria|filtro_aire|otro
  media_id TEXT, how TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '', sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, synced_at TEXT
);

-- ===== track =====
CREATE TABLE venue (
  id TEXT PRIMARY KEY NOT NULL,             -- slug for seeded (autodromo_americas), uuid for user
  name TEXT NOT NULL, city TEXT, type TEXT NOT NULL DEFAULT 'circuito',  -- circuito|drift|drag|autocross|calle|otro
  layout TEXT, length_m INTEGER, lat REAL, lng REAL, is_seeded INTEGER NOT NULL DEFAULT 0, notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, synced_at TEXT
);
CREATE TABLE track_event (
  id TEXT PRIMARY KEY NOT NULL,
  vehicle_id TEXT NOT NULL REFERENCES vehicle(id),
  venue_id TEXT, occurred_at TEXT NOT NULL, title TEXT NOT NULL DEFAULT '', organizer TEXT,
  discipline TEXT NOT NULL DEFAULT 'drift', -- track_day|drift|drag|autocross|junte|prueba
  weather TEXT, ambient_c REAL, track_temp_c REAL, track_condition TEXT,
  odometer_start_km REAL, odometer_end_km REAL,
  entry_fee_dop REAL, fuel_cost_dop REAL, other_cost_dop REAL,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, synced_at TEXT
);
CREATE TABLE track_session (
  id TEXT PRIMARY KEY NOT NULL,
  event_id TEXT NOT NULL REFERENCES track_event(id),
  seq INTEGER NOT NULL, kind TEXT NOT NULL DEFAULT 'practica',
  started_at TEXT, duration_min INTEGER, laps INTEGER, runs INTEGER,
  best_lap_ms INTEGER, second_best_ms INTEGER, sectors_ms TEXT NOT NULL DEFAULT '[]',
  zero_100_ms INTEGER, quarter_mile_ms INTEGER, quarter_mile_trap_kmh REAL, sixty_foot_ms INTEGER,
  fuel_load_l REAL, ballast_kg REAL, driver TEXT, passenger INTEGER NOT NULL DEFAULT 0,
  car_feel TEXT, rating INTEGER, notes TEXT NOT NULL DEFAULT '', incident TEXT, video_url TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, synced_at TEXT
);
CREATE TABLE setup_sheet (
  id TEXT PRIMARY KEY NOT NULL,             -- = session_id (1:1)
  session_id TEXT NOT NULL REFERENCES track_session(id),
  tire_set_f_id TEXT, tire_set_r_id TEXT,
  psi_cold_fl REAL, psi_cold_fr REAL, psi_cold_rl REAL, psi_cold_rr REAL,
  psi_hot_fl REAL, psi_hot_fr REAL, psi_hot_rl REAL, psi_hot_rr REAL,
  camber_fl REAL, camber_fr REAL, camber_rl REAL, camber_rr REAL,
  toe_f_mm REAL, toe_r_mm REAL, caster_l REAL, caster_r REAL,
  rh_fl_mm REAL, rh_fr_mm REAL, rh_rl_mm REAL, rh_rr_mm REAL,
  spring_f REAL, spring_r REAL, spring_unit TEXT NOT NULL DEFAULT 'kgf_mm',
  bump_f INTEGER, rebound_f INTEGER, bump_r INTEGER, rebound_r INTEGER, clicks_total INTEGER,
  swaybar_f TEXT, swaybar_r TEXT, pad_f TEXT, pad_r TEXT, brake_bias TEXT,
  steering_angle_deg REAL, hydro INTEGER NOT NULL DEFAULT 0, lsd_type TEXT, lsd_preload TEXT,
  tire_size_f TEXT, tire_size_r TEXT, compound_f TEXT, compound_r TEXT, two_step_rpm INTEGER, rev_limit_rpm INTEGER,
  changed_from_previous TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, synced_at TEXT
);
CREATE TABLE consumable_usage (
  id TEXT PRIMARY KEY NOT NULL,
  event_id TEXT NOT NULL, session_id TEXT, tire_id TEXT, wheel_set_id TEXT,
  kind TEXT NOT NULL,                       -- ciclo_goma|goma_quemada|medida_pastilla|fluido|combustible
  qty REAL, unit TEXT, pad_thickness_mm REAL, tread_mm REAL, notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, synced_at TEXT
);

-- ===== sharing =====
CREATE TABLE vehicle_share (
  id TEXT PRIMARY KEY NOT NULL,             -- = vehicle_id
  vehicle_id TEXT NOT NULL REFERENCES vehicle(id),
  slug TEXT, visibility TEXT NOT NULL DEFAULT 'private',   -- private|link|public
  show_plate INTEGER NOT NULL DEFAULT 0, show_vin INTEGER NOT NULL DEFAULT 0, show_costs INTEGER NOT NULL DEFAULT 0,
  show_location INTEGER NOT NULL DEFAULT 0, show_odometer INTEGER NOT NULL DEFAULT 1,
  show_maintenance INTEGER NOT NULL DEFAULT 1, show_mods INTEGER NOT NULL DEFAULT 1,
  show_track INTEGER NOT NULL DEFAULT 1, show_docs INTEGER NOT NULL DEFAULT 0, show_story INTEGER NOT NULL DEFAULT 1,
  og_media_id TEXT, published_at TEXT, revoked_at TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, synced_at TEXT
);
CREATE TABLE vehicle_member (                -- local mirror of membership (read-mostly)
  id TEXT PRIMARY KEY NOT NULL,             -- vehicle_id + ':' + user_id
  vehicle_id TEXT NOT NULL, user_id TEXT NOT NULL, role TEXT NOT NULL, display_name TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, synced_at TEXT
);

-- ===== history feed v2 (drop + recreate; adds created_at, mod, milestone, track) =====
DROP VIEW IF EXISTS history_feed;
CREATE VIEW history_feed AS
  SELECT id, vehicle_id, 'combustible' AS kind, occurred_at, created_at, odometer_km, fuel_type AS title, station AS subtitle, total_dop AS amount_dop FROM fuel_log WHERE deleted_at IS NULL
  UNION ALL SELECT id, vehicle_id, kind, occurred_at, created_at, odometer_km, title, shop, total_dop FROM service_record WHERE deleted_at IS NULL AND kind <> 'mejora'
  UNION ALL SELECT id, vehicle_id, 'gasto', occurred_at, created_at, odometer_km, description, category, amount_dop FROM expense WHERE deleted_at IS NULL
  UNION ALL SELECT id, vehicle_id, 'chequeo', occurred_at, created_at, odometer_km, status, template_id, NULL FROM inspection WHERE deleted_at IS NULL
  UNION ALL SELECT id, vehicle_id, 'mod', COALESCE(installed_at, created_at), created_at, installed_km, name, brand,
                   cost_part_dop + cost_labor_dop + cost_shipping_dop + cost_customs_dop FROM mod WHERE deleted_at IS NULL AND status IN ('instalado','quitado','vendido','danado')
  UNION ALL SELECT id, vehicle_id, 'hito', occurred_at, created_at, odometer_km, title, kind, NULL FROM milestone WHERE deleted_at IS NULL
  UNION ALL SELECT id, vehicle_id, 'pista', occurred_at, created_at, odometer_start_km, title, discipline,
                   COALESCE(entry_fee_dop,0)+COALESCE(fuel_cost_dop,0)+COALESCE(other_cost_dop,0) FROM track_event WHERE deleted_at IS NULL;
```

Data migration inside v2 (same transaction, idempotent): for every `vehicle` insert a
`vehicle_ownership` current row from `purchase_date/price` / `sold_date/price` (status `vendido`
when `sold_date` is set; archived vehicles keep `is_archived` and get status `guardado`); for
every `service_record kind='mejora'` create a `mod` (category `otro`, `installed_at=occurred_at`,
`installed_km=odometer_km`, costs from parts/labor, `service_record_id` set) and keep the record;
`vehicle_specsheet` row per vehicle (empty); seed `mod_category` and `venue` (Autódromo de las
Américas / Sunix, Santo Domingo Este); load `dtc_code` from the bundled JSON.

Settings keys added: `album_last_import_at`, `storage_used_bytes`, `storage_quota_bytes`,
`gauge_sweep_done_session` (memory only), `feature_flags_override` (dev).

## 2. Domain rules

### 2.1 Album and timeline (`lib/domain/album.ts`)
- `timeline(vehicleId)` = union of `album_item` photos (by `media.taken_at`, precision-aware
  grouping: `year` precision groups under the year header only), `milestone`, `mod` install/remove
  events, `track_event`, `service_record` with photos, sorted desc; month headers carry the
  odometer reading nearest to the month start.
- `stateAt(vehicleId, date)` = `{photos: taken_at ≤ date (last 6), modsInstalled: installed_at ≤
  date && (removed_at null || > date), odometer: nearest reading ≤ date, specs: stock ⊕ effects of
  those mods}` — the "así estaba el carro" view; pure and tested.
- Import: `taken_at` from EXIF `DateTimeOriginal` → MediaStore `creationTime` → user; precision
  per source; duplicates detected by `(width, height, taken_at, size_bytes)` within a vehicle and
  skipped with a count.

### 2.2 Build (`lib/domain/build.ts`, `lib/domain/tires.ts`)
- `currentSpecs(stock, mods, overrides)`: apply `spec_effects` of `instalado` mods in `installed_at`
  order, then overrides; return `{value, source: stock|mod:<id>|override}` per field for the diff
  view.
- `modTotalDop(mod)` = part + labor + shipping + customs (foreign price × fx is only a helper for
  entry).
- `investedByCategory(vehicleId)`, `investedTotal` (installed + removed, not sold-back), `netInvested`
  (minus `sold_price_dop`).
- Wishlist → mod conversion copies name/brand/part/category/vendor/url, sets `status='instalado'`
  and `converted_mod_id`, prompts for install date/km/costs.
- `parseTireSize('195/50R15 82V')` → `{width, aspect, construction, rim, load, speed}`; also
  `185/60-14`, `165SR13`; `tireDiameterMm`, `circumferenceMm`, `revsPerKm`, `compareSizes(a,b)` →
  `{diffPct, speedoErrorPct}`; `dotAge('2323', today)` → `{week, year, ageYears, flag ≥ 6}`;
  `offsetDelta(old, new)` → poke/inset mm. All tested.

### 2.3 DIY (`lib/domain/specPresets.ts`, `lib/domain/dtc.ts`)
- Presets keyed by `chassis_code` (+ engine): `AE85 (3A-U)`, `AE86 (4A-GE 16V)`, `4A-GE 20V
  blacktop` (engine preset), `S13 (SR20DET/KA24DE)`, `S14`, `EG/EK Civic (D16/B16)`, `C3 A51
  (TU5JP4 1.6)`, `DS3 SA (EP6 1.6 VTi / THP)`, `Corolla E120/E150`, `Hilux N70`, `Yaris`. Values
  are common service data (oil capacity/grade, coolant, plugs, OEM tire sizes/psi, bolt pattern,
  center bore, lug torque) marked `source: preset`; **honest caveat** in each: "Verifica con tu
  manual". The prompt must not invent precision it does not have — where a value is uncertain the
  preset leaves it null.
- vPIC decode: `GET https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/<vin>?format=json`;
  map Make/Model/ModelYear/EngineCylinders/DisplacementL/FuelTypePrimary/TransmissionStyle/
  DriveType; if `ErrorCode` ≠ 0 or Model empty → "No se pudo decodificar, completa a mano".
- `dtc.lookup('P0301')` → `{code, system, descEs, descEn, isGeneric}`; manufacturer ranges
  (`P1xxx`) show "código específico del fabricante" when `is_generic = 0`.

### 2.4 Track (`lib/domain/track.ts`)
- `copyForward(prevSheet)` → new sheet with the same values and `changed_from_previous=[]`;
  `diffSheets(a,b)` → field list for the "cambiaste" note; `pressureDeltas(sheet)` per corner;
  `flagRearGrowth(sheet, threshold=8)`.
- `eventSummary(event, sessions, usage)` → `{sessions, runs, bestLapMs, tiresBurned, kmOnTrack,
  spendDop}`; `personalBests(vehicleId)` per venue+layout.
- `heatCycles(tireId)` = count of `ciclo_goma` rows; `padLife(vehicleId)` from `medida_pastilla`
  series → mm/session and projected sessions left; feeds a reminder (`service_type
  pastillas_frenos`) when < 5 mm track / < 3 mm street.

### 2.5 Share (`lib/domain/share.ts`)
- `publicDossier(vehicle, share, data)` → the exact JSON the Vercel function and the PDF render:
  respects every `show_*`; costs stripped unless `show_costs`; plate/VIN masked (`A70••••`) unless
  enabled; photos = album favourites (≤ 24) + hero.
- `slug()` = 8 chars from `abcdefghjkmnpqrstuvwxyz23456789`.

## 3. Sync additions

`SYNC_TABLES` order (after `vehicle`): `vehicle_ownership, milestone, album_item, mod_category
(keyedBy user_id), mod, mod_media, vehicle_specsheet, spec_snapshot, torque_spec, wishlist_item,
inventory_item, wheel_set, tire, contact, vehicle_dtc_event, fluid_guide_item, venue (keyedBy
user_id), track_event, track_session, setup_sheet, consumable_usage, vehicle_share,
vehicle_member`. `dtc_code` is local-only. `BOOLEAN_COLUMNS` gains: `vehicle_ownership.is_current`,
`media.is_favorite`, `mod.affects_specs`, `mod_category.is_seeded`, `venue.is_seeded`,
`setup_sheet.hydro`, `track_session.passenger`, `vehicle_share.show_*`. Media gains
`thumb_blob` in `localOnly`.
