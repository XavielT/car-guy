import type { SQLiteDatabase } from 'expo-sqlite';
import { Platform } from 'react-native';

/**
 * SLOW_QUERIES (IMP 30092026 Phase 3B, dev only): every read waits `ms` first,
 * so each screen's skeleton can be seen before its content. On web, add
 * `?slow=800` to the URL; elsewhere set `globalThis.__SLOW_QUERIES_MS`.
 * A production bundle drops this (`__DEV__` is inlined false).
 */
export function slowQueriesMs(): number {
  if (!__DEV__) return 0;
  const g = globalThis as { __SLOW_QUERIES_MS?: number };
  if (typeof g.__SLOW_QUERIES_MS === 'number') return g.__SLOW_QUERIES_MS;
  if (Platform.OS === 'web' && typeof location !== 'undefined') {
    const ms = Number(new URLSearchParams(location.search).get('slow'));
    if (Number.isFinite(ms) && ms > 0) return (g.__SLOW_QUERIES_MS = ms);
  }
  return 0;
}

/** Wraps the reads of a handle in the delay (no-op when the flag is off). */
export function withSlowQueries(db: SQLiteDatabase): SQLiteDatabase {
  const ms = slowQueriesMs();
  if (!ms) return db;
  const wait = () => new Promise((r) => setTimeout(r, ms));
  const getAll = db.getAllAsync.bind(db);
  const getFirst = db.getFirstAsync.bind(db);
  db.getAllAsync = (async (...args: Parameters<typeof getAll>) => {
    await wait();
    return getAll(...args);
  }) as typeof db.getAllAsync;
  db.getFirstAsync = (async (...args: Parameters<typeof getFirst>) => {
    await wait();
    return getFirst(...args);
  }) as typeof db.getFirstAsync;
  return db;
}
