/**
 * A real SQLite for tests: node's built-in `node:sqlite`, with the app's own
 * migrations, behind the slice of expo-sqlite's async API the data layer uses.
 *
 * Use it from inside a `jest.mock('@/lib/db/client', …)` factory — jest hoists
 * the mock above every import, so the database has to be created there and
 * read back with `jest.requireMock` (see __tests__/db/sync-ops.test.ts).
 */
import { DatabaseSync } from 'node:sqlite';

import { MIGRATIONS } from '@/lib/db/migrations';

export type TestDb = ReturnType<typeof createTestDb>;

export function createTestDb() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys = ON');
  for (const migration of MIGRATIONS) for (const sql of migration.up) sqlite.exec(sql);

  const params = (p: unknown[] = []) => p as never[];
  const handle = {
    sqlite,
    runAsync: async (sql: string, p: unknown[] = []) => sqlite.prepare(sql).run(...params(p)),
    getAllAsync: async <T>(sql: string, p: unknown[] = []) => sqlite.prepare(sql).all(...params(p)) as T[],
    getFirstAsync: async <T>(sql: string, p: unknown[] = []) =>
      (sqlite.prepare(sql).get(...params(p)) as T | undefined) ?? null,
    execAsync: async (sql: string) => sqlite.exec(sql),
    withTransactionAsync: async (fn: () => Promise<void>) => {
      sqlite.exec('BEGIN');
      try {
        await fn();
        sqlite.exec('COMMIT');
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    },
  };
  return handle;
}

/**
 * The `@/lib/db/client` module, backed by a test database. `now` is a real
 * clock, strictly increasing, so two writes in one test never share a stamp.
 */
export function clientModule(db: TestDb) {
  let last = 0;
  return {
    getDb: async () => db,
    enqueue: <T>(fn: (h: TestDb) => Promise<T>) => fn(db),
    now: () => {
      last = Math.max(Date.now(), last + 1);
      return new Date(last).toISOString();
    },
  };
}
