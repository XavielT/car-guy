/**
 * The tables `load()` in lib/store.tsx reads (the repos are plain single-table
 * SELECTs; prices come from `fuel_price` + `fuel_price_ref`). A write to any
 * other table — a trip's GPS points arriving every few seconds, the AI queue,
 * photos, sync bookkeeping on other tables — cannot change what the store
 * holds, so it must not trigger a five-table reload.
 *
 * If `load()` ever reads another table, add it here: the test in
 * __tests__/domain/storeTables.test.ts pins the list.
 */
export const STORE_TABLES: ReadonlySet<string> = new Set([
  'vehicle',
  'fuel_log',
  'expense',
  'reminder',
  'service_record',
  'setting',
  'fuel_price',
  'fuel_price_ref',
]);

/** True when a change to `tableName` may change the store. Unknown (empty) names reload, to be safe. */
export function affectsStore(tableName: string | null | undefined): boolean {
  if (!tableName) return true;
  return STORE_TABLES.has(tableName);
}
