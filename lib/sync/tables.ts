/**
 * What syncs, in what order, and which columns never leave the device.
 *
 * Declarative on purpose. The alternative — each screen or each query knowing
 * how its table maps to the cloud — is how a sync engine ends up with
 * seventeen slightly different ideas of what a row is. Everything here is data;
 * `lib/sync/merge.ts` is the logic and `lib/sync/engine.ts` is the plumbing.
 *
 * The camelCase ↔ snake_case mapping is not declared: `lib/db/repos/base.ts`
 * already does it mechanically for every column, and the cloud schema in
 * sql/002 was written to be the snake_case of `lib/db/types.ts` precisely so
 * that one rule keeps working.
 */

export type SyncTable = {
  /** The table name, identical locally and in the cloud. */
  name: string;
  /**
   * Columns that exist locally and must never be sent.
   *
   * `synced_at` is this device's bookkeeping — sending it would let one phone
   * tell another when *it* last synced, which is meaningless and would churn
   * `server_updated_at` on every push.
   */
  localOnly: string[];
  /**
   * The cloud primary key, and so the push's conflict target.
   *
   * - `id` (the default): ids are UUIDs or derived from them, unique across
   *   every account.
   * - `user_id`: (user_id, id). The seeded catalogue tables, whose slug ids
   *   (`aceite_motor`, `carro_semanal`) every device creates identically —
   *   keyed by id alone, the first account to push one would own it and every
   *   other account's push would be refused by RLS (sql/008).
   * - `user_key`: (user_id, key) — only `setting`, which has no id.
   */
  keyedBy?: 'id' | 'user_id' | 'user_key';
  /**
   * Pulled, never pushed. `vehicle_member` is written by the server (invite
   * RPCs, PROMPT-07); its `user_id` is the *member*, so pushing it the way every
   * other table is pushed would stamp the pusher's id onto someone else's row.
   */
  pullOnly?: boolean;
};

/** The `onConflict` columns for an upsert into `table`. */
export function conflictTarget(table: SyncTable): string {
  if (table.keyedBy === 'user_key') return 'user_id,key';
  if (table.keyedBy === 'user_id') return 'user_id,id';
  return 'id';
}

/**
 * Dependency order: a parent is always pushed and pulled before its children.
 *
 * The local database runs with `PRAGMA foreign_keys = ON`, so a fill-up whose
 * vehicle has not arrived yet is a constraint violation rather than a row that
 * sorts itself out later. The cloud mirror has no foreign keys (sql/002), which
 * is what makes this order the client's responsibility.
 */
export const SYNC_TABLES: SyncTable[] = [
  // Catalogues first: reminders and service records point at service_type, and
  // inspection_item points at inspection_template.
  { name: 'service_type', localOnly: ['syncedAt'], keyedBy: 'user_id' },
  { name: 'inspection_template', localOnly: ['syncedAt'], keyedBy: 'user_id' },
  { name: 'inspection_item', localOnly: ['syncedAt'], keyedBy: 'user_id' },

  // The root of everything else.
  // `garageRole` is this device's mirror of *my* role on a shared vehicle.
  { name: 'vehicle', localOnly: ['syncedAt', 'garageRole'] },

  // Schema v2, in 01-data-model-v2.md §3 order. Local foreign keys: vehicle ←
  // every vehicle_id, mod ← mod_media, track_event ← track_session ←
  // setup_sheet — each parent is above its children here.
  { name: 'vehicle_ownership', localOnly: ['syncedAt'] },
  { name: 'milestone', localOnly: ['syncedAt'] },
  { name: 'album_item', localOnly: ['syncedAt'] },
  { name: 'mod_category', localOnly: ['syncedAt'], keyedBy: 'user_id' },
  { name: 'mod', localOnly: ['syncedAt'] },
  { name: 'mod_media', localOnly: ['syncedAt'] },
  { name: 'vehicle_specsheet', localOnly: ['syncedAt'] },
  { name: 'spec_snapshot', localOnly: ['syncedAt'] },
  { name: 'torque_spec', localOnly: ['syncedAt'] },
  { name: 'wishlist_item', localOnly: ['syncedAt'] },
  { name: 'inventory_item', localOnly: ['syncedAt'] },
  { name: 'wheel_set', localOnly: ['syncedAt'] },
  { name: 'tire', localOnly: ['syncedAt'] },
  { name: 'contact', localOnly: ['syncedAt'] },
  { name: 'vehicle_dtc_event', localOnly: ['syncedAt'] },
  { name: 'fluid_guide_item', localOnly: ['syncedAt'] },
  { name: 'venue', localOnly: ['syncedAt'], keyedBy: 'user_id' },
  { name: 'track_event', localOnly: ['syncedAt'] },
  { name: 'track_session', localOnly: ['syncedAt'] },
  // v6 (sql/019). Its points (trip_point) and the recorder's state never leave the phone.
  { name: 'trip', localOnly: ['syncedAt'] },
  { name: 'setup_sheet', localOnly: ['syncedAt'] },
  { name: 'consumable_usage', localOnly: ['syncedAt'] },
  { name: 'vehicle_share', localOnly: ['syncedAt'] },
  { name: 'vehicle_member', localOnly: ['syncedAt'], pullOnly: true },

  // Direct children of vehicle.
  { name: 'vehicle_spec', localOnly: ['syncedAt'] },
  { name: 'odometer_reading', localOnly: ['syncedAt'] },
  { name: 'fuel_log', localOnly: ['syncedAt'] },
  { name: 'service_record', localOnly: ['syncedAt'] },
  { name: 'expense', localOnly: ['syncedAt'] },
  { name: 'reminder', localOnly: ['syncedAt'] },
  { name: 'inspection', localOnly: ['syncedAt'] },
  { name: 'task', localOnly: ['syncedAt'] },
  { name: 'document', localOnly: ['syncedAt'] },

  // Children of service_record and inspection.
  { name: 'service_record_item', localOnly: ['syncedAt'] },
  { name: 'part', localOnly: ['syncedAt'] },
  { name: 'inspection_result', localOnly: ['syncedAt'] },

  // Metadata only — the bytes go to Storage, never through PostgREST.
  { name: 'media', localOnly: ['syncedAt', 'blob', 'thumbBlob'] },

  // Last, and filtered: see SYNCED_SETTING_KEYS.
  { name: 'setting', localOnly: [], keyedBy: 'user_key' },
];

/** Names only, for callers that just want to iterate. */
export const SYNC_TABLE_NAMES = SYNC_TABLES.map((table) => table.name);

/**
 * The only settings worth carrying between devices.
 *
 * `active_vehicle_id` is deliberately absent: which vehicle is on screen is a
 * fact about a phone, not about a person, and syncing it would make picking a
 * car on one device silently switch it on another. The sync bookkeeping keys
 * (`sync_cursor.*`, `last_sync_at`, `auth_user_id`) are local for the same
 * reason — they describe this device's progress.
 */
// `theme` is not here: the appearance choice lives in AsyncStorage
// (lib/theme/useTheme.ts), not in this table, and dark on the phone with light
// on the laptop is a reasonable thing to want.
// `garage_layout` (Garaje v2: mode, order, pin) travels so the phone and the
// web show the same garage.
export const SYNCED_SETTING_KEYS = ['reference_prices', 'price_week_label', 'garage_layout'];

/**
 * Columns that are `boolean` in the cloud and `INTEGER` locally.
 *
 * SQLite has no boolean type. PostgREST sends real `true`/`false`, and storing
 * those verbatim would put the string "true" into a numeric column, where
 * `is_full_tank = 1` then matches nothing — a silent, total failure of the one
 * query the fuel screen depends on.
 *
 * Hand-written, because a type cannot be read at runtime. That makes it the
 * most likely thing to rot, so `__tests__/sync/schema-parity.test.ts` parses
 * every `boolean` column out of sql/002 and fails if this map disagrees by even
 * one entry.
 */
export const BOOLEAN_COLUMNS: Record<string, string[]> = {
  vehicle: ['is_archived'],
  fuel_log: ['is_full_tank', 'missed_previous', 'in_reserve'],
  service_type: ['is_seeded'],
  reminder: ['is_recurring', 'fixed_interval', 'is_enabled'],
  inspection_template: ['is_seeded', 'is_enabled'],
  inspection_item: ['requires_cold_engine'],
  // schema v2 (sql/009)
  media: ['is_favorite'],
  vehicle_ownership: ['is_current'],
  mod_category: ['is_seeded'],
  mod: ['affects_specs'],
  venue: ['is_seeded'],
  track_session: ['passenger'],
  setup_sheet: ['hydro'],
  vehicle_share: [
    'show_plate',
    'show_vin',
    'show_costs',
    'show_location',
    'show_odometer',
    'show_maintenance',
    'show_mods',
    'show_track',
    'show_docs',
    'show_story',
    'show_status',
  ],
};

/** Push batch size, per 02-supabase-carguy.md §5. */
export const PUSH_BATCH = 200;

/** Pull page size, per the same section. */
export const PULL_PAGE = 500;

/** Where each table's pull cursor lives in the local `setting` table. */
export function cursorKey(table: string): string {
  return `sync_cursor.${table}`;
}
