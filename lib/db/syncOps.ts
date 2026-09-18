import type { SQLiteDatabase } from 'expo-sqlite';

import { enqueue, getDb, now } from './client';
import { camel, snake } from './repos/base';

/**
 * The four database operations sync needs that the ordinary repositories
 * deliberately cannot do.
 *
 * `makeRepo`'s `upsert` sets `synced_at = NULL` on every write, because every
 * write it performs is a *local edit* that must be pushed. Applying a row that
 * just came **down** from the cloud through that path would mark it dirty and
 * push it straight back, so each device would spend the rest of its life
 * bouncing the same rows off the other. Pulled rows are written here instead,
 * with `synced_at` set, which is what "clean" means.
 *
 * SQL lives in this file rather than in the engine (ADR-02).
 */

/** Columns that exist in the cloud and have no home locally. */
const CLOUD_ONLY = new Set(['user_id', 'server_updated_at']);

export type LocalRow = Record<string, unknown>;

/**
 * Rows this device has changed since it last pushed them.
 *
 * Tombstones are included: a deletion is a change that has to travel, and
 * leaving it behind is exactly how a deleted row comes back on the next pull.
 */
export async function dirtyRows(table: string, limit?: number): Promise<LocalRow[]> {
  const db = await getDb();
  return db.getAllAsync<LocalRow>(
    `SELECT * FROM ${table}
      WHERE synced_at IS NULL OR updated_at > synced_at
      ORDER BY updated_at ASC${limit ? ` LIMIT ${Number(limit)}` : ''}`,
  );
}

export async function countDirty(table: string): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ n: number }>(
    `SELECT COUNT(*) AS n FROM ${table} WHERE synced_at IS NULL OR updated_at > synced_at`,
  );
  return row?.n ?? 0;
}

/**
 * Marks rows as pushed.
 *
 * `synced_at` is set to each row's own `updated_at`, not to the wall clock. If
 * the row were stamped with `now()` and the user edited it during the round
 * trip, `updated_at` would land *before* `synced_at` and the edit would look
 * clean — pushed, when it never was. Copying `updated_at` makes the comparison
 * exact: an edit that arrives mid-flight leaves `updated_at` strictly greater,
 * and the row stays dirty.
 */
export async function markSynced(table: string, ids: string[], db?: SQLiteDatabase): Promise<void> {
  if (!ids.length) return;
  const run = async (handle: SQLiteDatabase) => {
    const placeholders = ids.map(() => '?').join(', ');
    await handle.runAsync(
      `UPDATE ${table} SET synced_at = updated_at WHERE id IN (${placeholders})`,
      ids as never,
    );
  };
  if (db) await run(db);
  else await enqueue(run);
}

/** The local rows behind a set of ids, tombstones included, keyed by id. */
export async function localByIds(table: string, ids: string[]): Promise<Map<string, LocalRow>> {
  if (!ids.length) return new Map();
  const db = await getDb();
  const placeholders = ids.map(() => '?').join(', ');
  const rows = await db.getAllAsync<LocalRow>(
    `SELECT * FROM ${table} WHERE id IN (${placeholders})`,
    ids as never,
  );
  return new Map(rows.map((row) => [row.id as string, row]));
}

/**
 * Writes rows that came from the cloud, marked clean.
 *
 * Columns the local schema does not have are dropped rather than passed
 * through: SQLite rejects an unknown column outright, and on the web build the
 * failure surfaces only as "Error finalizing statement" — naming neither the
 * column nor the table, which is a long evening.
 *
 * One transaction for the whole page, so a pull either lands or does not.
 */
export async function applyRemoteRows(table: string, rows: Record<string, unknown>[]): Promise<number> {
  if (!rows.length) return 0;

  return enqueue(async (handle) => {
    let applied = 0;

    await handle.withTransactionAsync(async () => {
      for (const incoming of rows) {
        const data: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(incoming)) {
          const column = key.includes('_') ? key : snake(key);
          if (CLOUD_ONLY.has(column)) continue;
          if (value === undefined) continue;
          data[column] = normalise(value);
        }
        if (!data.id) continue;

        // Clean by definition: this row *is* what the server holds.
        data.synced_at = data.updated_at;

        const columns = Object.keys(data);
        const updates = columns
          .filter((c) => c !== 'id')
          .map((c) => `${c} = excluded.${c}`)
          .join(', ');

        await handle.runAsync(
          `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})
           ON CONFLICT(id) DO UPDATE SET ${updates}`,
          columns.map((c) => data[c]) as never,
        );
        applied += 1;
      }
    });

    return applied;
  });
}

/**
 * SQLite has no boolean. PostgREST sends real `true`/`false` for the columns
 * that are `boolean` in the cloud and `INTEGER` locally, and storing those
 * verbatim would put the strings "true"/"false" in a numeric column, where
 * `is_full_tank = 1` then matches nothing.
 */
function normalise(value: unknown): unknown {
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (value === null) return null;
  if (typeof value === 'object') return JSON.stringify(value);
  return value;
}

/** Turns a local row into the shape PostgREST expects, minus local bookkeeping. */
export function toCloudShape(
  row: LocalRow,
  localOnly: string[],
  userId: string,
  booleanColumns: string[] = [],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const skip = new Set(localOnly.map((k) => (k.includes('_') ? k : snake(k))));

  for (const [key, value] of Object.entries(row)) {
    if (skip.has(key)) continue;
    if (value === undefined) continue;
    out[key] = booleanColumns.includes(key) ? Boolean(value) : value;
  }

  // Sent explicitly although the column defaults to auth.uid(): a default only
  // applies to an INSERT, and an upsert taking the UPDATE branch without it is
  // refused by the RLS `with check` with 42501.
  out.user_id = userId;
  return out;
}

/** Local settings that sync, as `(key, value)` pairs. */
export async function syncableSettings(keys: string[]): Promise<{ key: string; value: string; updatedAt: string }[]> {
  if (!keys.length) return [];
  const db = await getDb();
  const placeholders = keys.map(() => '?').join(', ');
  const rows = await db.getAllAsync<{ key: string; value: string; updated_at: string }>(
    `SELECT key, value, updated_at FROM setting WHERE key IN (${placeholders})`,
    keys as never,
  );
  return rows.map((row) => ({ key: row.key, value: row.value, updatedAt: row.updated_at }));
}

/** Timestamp helper re-exported so the engine has one source for "now". */
export { now, camel };
