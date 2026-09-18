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
  /** Keyed by (user_id, key) rather than by id — only `setting`. */
  keyedBy?: 'id' | 'user_key';
};

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
  { name: 'service_type', localOnly: ['syncedAt'] },
  { name: 'inspection_template', localOnly: ['syncedAt'] },
  { name: 'inspection_item', localOnly: ['syncedAt'] },

  // The root of everything else.
  { name: 'vehicle', localOnly: ['syncedAt'] },

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
  { name: 'media', localOnly: ['syncedAt', 'blob'] },

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
export const SYNCED_SETTING_KEYS = ['reference_prices', 'price_week_label', 'theme'];

/** Push batch size, per 02-supabase-carguy.md §5. */
export const PUSH_BATCH = 200;

/** Pull page size, per the same section. */
export const PULL_PAGE = 500;

/** Where each table's pull cursor lives in the local `setting` table. */
export function cursorKey(table: string): string {
  return `sync_cursor.${table}`;
}
