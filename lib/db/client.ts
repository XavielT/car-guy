import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import { migrate } from './migrations';

export const DATABASE_NAME = 'carguy.db';

let dbPromise: Promise<SQLiteDatabase> | null = null;

/**
 * The one database handle. `SQLiteProvider` opens its own connection for the
 * React tree; this is the handle the repositories use, so that repo calls work
 * from anywhere — the importer, tests, a background task — not just from inside
 * a component.
 *
 * Opening the same database name twice is fine: without `useNewConnection` the
 * native module hands back the same underlying connection.
 */
export function getDb(): Promise<SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = openDatabaseAsync(DATABASE_NAME, { enableChangeListener: true }).then(async (db) => {
      await migrate(db);
      return db;
    });
  }
  return dbPromise;
}

/**
 * Only for tests and `resetAll`, which needs the next open to start clean.
 */
export function resetDbHandle(): void {
  dbPromise = null;
}

let tail: Promise<unknown> = Promise.resolve();

/**
 * Serialises every write.
 *
 * `withTransactionAsync` is not exclusive: because the callback is async, *any*
 * query issued by other code while it is open lands inside the same transaction
 * and can be rolled back with it. `withExclusiveTransactionAsync` would fix that
 * but throws "not supported on web" (ADR-02), so the queue is how Car Guy gets
 * the guarantee instead — one writer at a time, in call order.
 *
 * Reads do **not** go through here. Queueing a read behind a slow write would
 * stall the UI, and a read cannot corrupt anything.
 */
export function enqueue<T>(fn: (db: SQLiteDatabase) => Promise<T>): Promise<T> {
  const run = tail.then(async () => {
    const db = await getDb();
    let result!: T;
    await db.withTransactionAsync(async () => {
      result = await fn(db);
    });
    return result;
  });
  // Keep the chain alive after a failure, otherwise one rejected write blocks
  // every later one. The caller still sees its own rejection through `run`.
  tail = run.catch(() => undefined);
  return run;
}

/** ISO timestamp used for created_at / updated_at on every write. */
export function now(): string {
  return new Date().toISOString();
}
