# Data model v10 — IMP 01102026

Local migration **v10** (`lib/db/migrationV10.ts`), cloud `sql/033–036`. Conventions as before.

## 1. Gauge (notes 1, 3) — ADR-51

```sql
ALTER TABLE vehicle ADD COLUMN gauge_type TEXT NOT NULL DEFAULT 'needle8';   -- needle8 | segments | percent
ALTER TABLE vehicle ADD COLUMN gauge_segments INTEGER;                        -- 3..20 when segments
ALTER TABLE vehicle ADD COLUMN gauge_reserve_at INTEGER;                      -- segments showing when the light comes on (0/1), nullable
ALTER TABLE vehicle ADD COLUMN gauge_calibration TEXT;                        -- JSON {grid:[liters…], band:[…], n_full, n_partial, status:'linear'|'parcial'|'aprendido', updated_at}
ALTER TABLE fuel_log ADD COLUMN gauge_before_frac REAL;   -- 0..1 (null unknown)
ALTER TABLE fuel_log ADD COLUMN gauge_after_frac REAL;
ALTER TABLE fuel_log ADD COLUMN gauge_before_raw TEXT;    -- "4/9", "3/8", "45%"
ALTER TABLE fuel_log ADD COLUMN gauge_after_raw TEXT;
-- backfill: frac = eighths/8, raw = "<n>/8" where the eighths columns are set; keep eighths columns (older clients)
```

Domain: `lib/domain/gauge.ts` (types, `toFraction(raw, vehicle)`, `fromFraction`, picker maths,
resolution term `C/(2N)` for segments, `C/16` for eighths, `C/40` for percent-5 %),
`lib/domain/gaugeCalibration.ts` (observations from logs → PAV → grid, bands, status; `remaining(vehicle,
frac)` → `{ liters, band, km, kmBand }`; `recentKmPerL` distance-weighted over the last 3 measured
points). `partialEconomy.ts` reads fractions + the learned mapping when `status !== 'linear'`.
Research 03 has the algorithm, the worked example (45 L, 9 squares) and the tests to port.

## 2. Profiles & social (notes 11, 12, 14, 16) — ADR-54…56

Cloud (`sql/034_profiles_social.sql`), local cache tables where noted:

```sql
-- profiles (cloud)
alter table carguy.profiles add column handle citext unique check (handle ~ '^[a-z0-9_]{3,20}$');
alter table carguy.profiles add column bio text check (char_length(bio) <= 160);
alter table carguy.profiles add column is_public boolean not null default true;
alter table carguy.profiles add column photo_public boolean not null default false;
alter table carguy.profiles add column show_cars boolean not null default true;
alter table carguy.profiles add column show_stats boolean not null default false;
alter table carguy.profiles add column show_fichas boolean not null default false;
alter table carguy.profiles add column instagram text;   -- handle only, optional, public
create table carguy.reserved_handles(handle citext primary key);   -- admin, carguy, soporte, xaviel…
create table carguy.follow(follower_id uuid, followee_id uuid, status text not null default 'accepted' check (status in ('accepted','requested')), created_at timestamptz default now(), primary key (follower_id, followee_id), check (follower_id <> followee_id));
create table carguy.block(blocker_id uuid, blocked_id uuid, created_at timestamptz default now(), primary key (blocker_id, blocked_id));
create table carguy.report(id uuid primary key default gen_random_uuid(), reporter_id uuid, target_type text, target_id text, reason text, created_at timestamptz default now(), status text default 'new');
-- functions (security definer, carguy_private helpers): get_public_profile(handle), search_profiles(q), follow_user(id), unfollow_user(id), accept_follow(id), block_user(id), unblock_user(id), my_counts(), public_profile_cars(handle), public_profile_stats(handle)
-- trip sharing (synced, owner-only writes)
create table carguy.trip_share(id uuid primary key, trip_id text not null, user_id uuid not null, visibility text not null check (visibility in ('followers','friends','public')), polyline_trimmed text not null, distance_m int, duration_s int, started_day date, title text, created_at timestamptz, updated_at timestamptz, deleted_at timestamptz);
create table carguy.privacy_zone(id uuid primary key, user_id uuid not null, label text, lat double precision, lng double precision, radius_m int not null default 300, created_at, updated_at, deleted_at);
```

Local: `trip_share`, `privacy_zone` in SQLite + `SYNC_TABLES`; `follow`/`block`/counts as a
read-only cache table `social_cache` (JSON by key) refreshed on launch/online.

Trimming (pure, `lib/domain/tripShare.ts`): densify to 20 m, cut 300 m + seeded 0–200 m at both
ends (seed = trip id), remove points inside any zone, split segments across zones (never
reconnect), encode; stats recomputed on the trimmed route.

## 3. Juntes (note 13) — ADR-57

`sql/035_juntes.sql`: `junte`, `junte_member`, `junte_photo` (album_item link), RPCs `create_junte`,
`join_junte(code)`, `leave_junte`, `kick_member`, `end_junte`; `sql/036_realtime_policies.shared.sql`:
`realtime.messages` select/insert policies for topic `carguy:junte:<uuid>` limited to members with
status in (going, live) and within the live window; `junte_message` (chat) created now, policies
too, UI behind `FEATURE_JUNTE_CHAT`. Local: `junte_cache` JSON by id; nothing else.

## 4. Updates / support / usage (notes 4, 6) — ADR-52, 53

Local settings: `ota_last_check`, `ota_channel`; cloud `carguy.app_config(key, value jsonb)` (admin
write, authenticated read for the public keys: `support_links`, `support_text`, `min_version`) in
`sql/033_app_config.sql`; RPC `admin_usage()` (db size, storage bytes, MAU, junte message counters)
admin-only.

## 5. Services / mods (notes 17, 18) — data files only

`catalog.ts`: service type `pintura_completa` (category `carroceria`, "Pintura completa") and
`desabollado_pintura` ("Desabollado y pintura parcial"); mod categories `accesorios`, `estetica`
with presets (tapones de válvula, polarizado, radio/pantalla, alfombras, emblemas, luces LED,
spoiler, calcomanías…). Seeds are `INSERT OR IGNORE` through `seedCatalog()`; no migration.

## 6. history_feed v7

Adds `junte` rows ("Junte · <title> · N carros") and nothing else.
