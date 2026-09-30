/**
 * Two overlapping migrate() calls on one connection (SQLiteProvider's onInit and
 * getDb(), first launch after an update) must run the migrations once.
 */
import { DatabaseSync } from 'node:sqlite';

import { LATEST_VERSION, migrate, MIGRATIONS } from '@/lib/db/migrations';

jest.mock('react-native', () => ({ Platform: { OS: 'android' } }));

function nativeLike(db: DatabaseSync) {
  let inTx = false;
  const tick = () => new Promise((r) => setTimeout(r, 0));
  return {
    getFirstAsync: async (sql: string) => {
      await tick();
      return (db.prepare(sql).get() as unknown) ?? null;
    },
    getAllAsync: async (sql: string, p: unknown[] = []) => {
      await tick();
      return db.prepare(sql).all(...(p as never[]));
    },
    runAsync: async (sql: string, p: unknown[] = []) => {
      await tick();
      return db.prepare(sql).run(...(p as never[]));
    },
    execAsync: async (sql: string) => {
      await tick();
      db.exec(sql);
    },
    // Like expo-sqlite: not exclusive — a second BEGIN on the same connection fails.
    withTransactionAsync: async (fn: () => Promise<void>) => {
      if (inTx) throw new Error('cannot start a transaction within a transaction');
      inTx = true;
      db.exec('BEGIN');
      try {
        await fn();
        db.exec('COMMIT');
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      } finally {
        inTx = false;
      }
    },
  };
}

it('overlapping calls share one run and end at the latest version', async () => {
  const raw = new DatabaseSync(':memory:');
  for (const m of MIGRATIONS.filter((m) => m.version <= 7)) for (const sql of m.up) raw.exec(sql);
  raw.exec('PRAGMA user_version = 7');
  const db = nativeLike(raw) as never;
  await Promise.all([migrate(db), migrate(db)]);
  expect((raw.prepare('PRAGMA user_version').get() as { user_version: number }).user_version).toBe(LATEST_VERSION);
  // And a later call is a no-op, not a second run.
  await migrate(db);
  expect(raw.prepare(`SELECT COUNT(*) AS n FROM sqlite_master WHERE name = 'fuel_price'`).get()).toEqual({ n: 1 });
});
