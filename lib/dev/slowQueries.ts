import type { SQLiteDatabase } from 'expo-sqlite';
import { Platform } from 'react-native';

/**
 * SLOW_QUERIES (IMP 30092026 Phase 3B, dev only): every read waits `ms` first,
 * so each screen's skeleton can be seen before its content. On web, set
 * `localStorage['car-guy/dev-slow-queries'] = '800'` and reload (a `?slow=800`
 * in the URL works only if it survives until the database opens — the router
 * can rewrite it during startup); elsewhere set `globalThis.__SLOW_QUERIES_MS`.
 * A production bundle drops this (`__DEV__` is inlined false).
 */
export function slowQueriesMs(): number {
  if (!__DEV__) return 0;
  const g = globalThis as { __SLOW_QUERIES_MS?: number };
  if (typeof g.__SLOW_QUERIES_MS === 'number') return g.__SLOW_QUERIES_MS;
  if (Platform.OS === 'web' && typeof location !== 'undefined') {
    let raw: string | null = new URLSearchParams(location.search).get('slow');
    try {
      raw ??= localStorage.getItem('car-guy/dev-slow-queries');
    } catch {
      // storage blocked: no slow mode
    }
    const ms = Number(raw);
    if (Number.isFinite(ms) && ms > 0) return (g.__SLOW_QUERIES_MS = ms);
  }
  return 0;
}

/**
 * Armed by the store once its first load is done: boot (catalogue seed check,
 * store load — a hundred small reads) stays fast, and every screen read after
 * that is slow. Without it an 800 ms delay turns boot into minutes.
 */
let armed = false;
export function armSlowQueries(): void {
  armed = true;
}

/** Wraps the reads of a handle in the delay (no-op when the flag is off). */
export function withSlowQueries(db: SQLiteDatabase): SQLiteDatabase {
  const ms = slowQueriesMs();
  if (!ms) return db;
  const wait = () => (armed ? new Promise((r) => setTimeout(r, ms)) : Promise.resolve());
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
