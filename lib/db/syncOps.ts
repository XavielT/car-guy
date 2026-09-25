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
 * Marks rows as pushed — each with the `updated_at` it had *when it was read
 * for the push*.
 *
 * Not `synced_at = updated_at` in SQL: that reads `updated_at` at the moment
 * this UPDATE runs, so an edit made while the upload was in flight would be
 * stamped as synced without ever having left the phone. Writing the pushed
 * value leaves such a row with `updated_at > synced_at` — still dirty, and it
 * goes up on the next sync.
 */
export async function markSynced(
  table: string,
  rows: { id: string; updatedAt: string }[],
  db?: SQLiteDatabase,
): Promise<void> {
  if (!rows.length) return;
  const run = async (handle: SQLiteDatabase) => {
    for (const row of rows) {
      await handle.runAsync(`UPDATE ${table} SET synced_at = ? WHERE id = ?`, [row.updatedAt, row.id]);
    }
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
export async function applyRemoteRows(
  table: string,
  rows: Record<string, unknown>[],
): Promise<{ applied: number; parked: Record<string, unknown>[] }> {
  if (!rows.length) return { applied: 0, parked: [] };

  return enqueue(async (handle) => {
    let applied = 0;
    const parked: Record<string, unknown>[] = [];

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

        // One bad row must not stop the rest. The likely one is a child whose
        // parent has not arrived (foreign keys are ON locally, and the cloud has
        // none between tables); a failed statement in SQLite rolls back only
        // itself, so the transaction carries on and the row is parked for the
        // engine to retry once the parents are in.
        try {
          await handle.runAsync(
            `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})
             ON CONFLICT(id) DO UPDATE SET ${updates}`,
            columns.map((c) => data[c]) as never,
          );
          applied += 1;
        } catch (error) {
          console.warn(`[sync] parked ${table}/${String(data.id)}:`, error);
          parked.push(incoming);
        }
      }
    });

    return { applied, parked };
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
  // Postgres returns timestamptz as "2026-09-25T20:15:35.077+00:00"; the app
  // writes and compares "…Z". Two spellings of one instant do not sort as one,
  // so every timestamp that comes down is rewritten the way the app writes it.
  if (typeof value === 'string' && TIMESTAMPTZ.test(value)) return new Date(value).toISOString();
  return value;
}

/** An ISO date-time with an explicit offset — never a bare "YYYY-MM-DD". */
const TIMESTAMPTZ = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

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

/**
 * Makes every local row "not yet in the cloud" again.
 *
 * After "Borrar datos en la nube" the phone still believed each row was
 * uploaded (`synced_at` set, photos with a `remote_path`), so signing back in
 * pushed nothing and the cloud stayed empty for good. Clearing the marks means
 * the next sync re-uploads the whole garage, photo bytes included.
 */
export async function markAllUnsynced(tables: string[]): Promise<void> {
  await enqueue(async (handle) => {
    for (const table of tables) {
      await handle.runAsync(`UPDATE ${table} SET synced_at = NULL`);
    }
    await handle.runAsync('UPDATE media SET remote_path = NULL');
  });
}

/**
 * Writes a setting that came from the cloud, keeping the cloud's timestamp so
 * it does not immediately look newer than itself and bounce back up.
 */
export async function applyRemoteSetting(key: string, value: string, updatedAt: string): Promise<void> {
  await enqueue(async (handle) => {
    await handle.runAsync(
      `INSERT INTO setting (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      [key, value, updatedAt],
    );
  });
}

/** Timestamp helper re-exported so the engine has one source for "now". */
export { now, camel };

/**
 * Media rows whose bytes have never been uploaded.
 *
 * `remote_path` is the record of that: null means Storage has nothing for this
 * photo, whatever the row's sync state says. Tombstones are skipped — uploading
 * the bytes of a deleted photo is work nobody asked for.
 */
export async function mediaNeedingUpload(): Promise<LocalRow[]> {
  const db = await getDb();
  return db.getAllAsync<LocalRow>(
    `SELECT * FROM media WHERE remote_path IS NULL AND deleted_at IS NULL`,
  );
}

/** Vehicles on this phone, for the first sign-in's "Se agregaron N vehículos". */
export async function liveVehicleCount(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM vehicle WHERE deleted_at IS NULL');
  return row?.n ?? 0;
}

/** Deleted photos whose bytes are still in Storage. */
export async function deletedMediaInStorage(): Promise<{ id: string; remote_path: string }[]> {
  const db = await getDb();
  return db.getAllAsync<{ id: string; remote_path: string }>(
    `SELECT id, remote_path FROM media WHERE deleted_at IS NOT NULL AND remote_path IS NOT NULL`,
  );
}

/**
 * Forgets a Storage path once its object is gone. Local bookkeeping only: the
 * row is a tombstone already, and every device ignores a tombstone's bytes.
 */
export async function clearMediaRemotePath(id: string): Promise<void> {
  await enqueue(async (handle) => {
    await handle.runAsync(`UPDATE media SET remote_path = NULL WHERE id = ?`, [id] as never);
  });
}

/**
 * Records where the bytes landed in Storage.
 *
 * Deliberately leaves `synced_at` alone rather than clearing it: the row is
 * *about* to be pushed in the same run, and `updated_at` has not moved, so the
 * dirty test in `dirtyRows` already picks it up when it should.
 */
export async function setMediaRemotePath(id: string, remotePath: string): Promise<void> {
  await enqueue(async (handle) => {
    await handle.runAsync(`UPDATE media SET remote_path = ?, synced_at = NULL WHERE id = ?`, [
      remotePath,
      id,
    ] as never);
  });
}

/**
 * Stores downloaded bytes without dirtying the row.
 *
 * `blob` and `rel_path` are local-only columns (see SYNC_TABLES): filling them
 * in changes nothing the cloud can see, so touching `updated_at` here would
 * push a row whose cloud shape is byte-for-byte identical, and every other
 * device would pull it back for nothing.
 */
export async function saveMediaBytes(
  id: string,
  bytes: Uint8Array | null,
  relPath: string | null,
): Promise<void> {
  await enqueue(async (handle) => {
    await handle.runAsync(`UPDATE media SET blob = ?, rel_path = ? WHERE id = ?`, [
      bytes,
      relPath,
      id,
    ] as never);
  });
}
