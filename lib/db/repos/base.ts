import type { SQLiteDatabase } from 'expo-sqlite';

import { id as newId } from '../../format';
import { enqueue, getDb, now } from '../client';

/**
 * The shared repository behaviour. Every table gets the same contract:
 * list / getById / upsert / softDelete / restore, all reads excluding
 * tombstones, `updated_at` written on every mutation, `synced_at` cleared so the
 * Phase 9 sync knows the row is dirty.
 *
 * SQL lives here and in the sibling files — never in a screen (ADR-02).
 */

const snake = (key: string) => key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
const camel = (key: string) => key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());

/** Columns that are 0/1 in SQLite and boolean in TypeScript. */
export type RepoConfig = {
  table: string;
  booleans?: string[];
  /** Columns that exist in TS but are not plain scalars (e.g. BLOB). */
  skip?: string[];
};

export type Row = Record<string, unknown>;

function toDomain<T>(row: Row, config: RepoConfig): T {
  const out: Row = {};
  for (const [key, value] of Object.entries(row)) {
    const prop = camel(key);
    out[prop] = config.booleans?.includes(prop) ? value === 1 : value;
  }
  return out as T;
}

function toRow(input: Row, config: RepoConfig): Row {
  const out: Row = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue;
    out[snake(key)] = config.booleans?.includes(key) ? (value ? 1 : 0) : value;
  }
  return out;
}

export type ListOptions = {
  /** Column to order by, in snake_case. Defaults to the table's natural order. */
  orderBy?: string;
  direction?: 'ASC' | 'DESC';
  limit?: number;
  /** Include soft-deleted rows. Only the backup exporter wants this. */
  includeDeleted?: boolean;
};

export function makeRepo<T extends { id: string }>(config: RepoConfig) {
  const { table } = config;

  const where = (opts?: ListOptions) => (opts?.includeDeleted ? '1=1' : 'deleted_at IS NULL');

  async function query(sql: string, params: unknown[] = []): Promise<T[]> {
    const db = await getDb();
    const rows = await db.getAllAsync<Row>(sql, params as never);
    return rows.map((row) => toDomain<T>(row, config));
  }

  const repo = {
    table,

    /** Every non-deleted row, optionally scoped to one vehicle. */
    async list(vehicleId?: string, opts?: ListOptions): Promise<T[]> {
      const clauses = [where(opts)];
      const params: unknown[] = [];
      if (vehicleId) {
        clauses.push('vehicle_id = ?');
        params.push(vehicleId);
      }
      const order = opts?.orderBy ? ` ORDER BY ${opts.orderBy} ${opts.direction ?? 'DESC'}` : '';
      const limit = opts?.limit ? ` LIMIT ${Number(opts.limit)}` : '';
      return query(`SELECT * FROM ${table} WHERE ${clauses.join(' AND ')}${order}${limit}`, params);
    },

    /** Rows matching an arbitrary equality filter, e.g. { serviceRecordId: x }. */
    async listWhere(filter: Record<string, unknown>, opts?: ListOptions): Promise<T[]> {
      const keys = Object.keys(filter);
      const clauses = [where(opts), ...keys.map((k) => `${snake(k)} = ?`)];
      const order = opts?.orderBy ? ` ORDER BY ${opts.orderBy} ${opts.direction ?? 'DESC'}` : '';
      return query(
        `SELECT * FROM ${table} WHERE ${clauses.join(' AND ')}${order}`,
        keys.map((k) => filter[k]),
      );
    },

    async getById(rowId: string): Promise<T | null> {
      const db = await getDb();
      const row = await db.getFirstAsync<Row>(
        `SELECT * FROM ${table} WHERE id = ? AND deleted_at IS NULL`,
        [rowId],
      );
      return row ? toDomain<T>(row, config) : null;
    },

    async count(vehicleId?: string): Promise<number> {
      const db = await getDb();
      const sql = vehicleId
        ? `SELECT COUNT(*) AS n FROM ${table} WHERE deleted_at IS NULL AND vehicle_id = ?`
        : `SELECT COUNT(*) AS n FROM ${table} WHERE deleted_at IS NULL`;
      const row = await db.getFirstAsync<{ n: number }>(sql, vehicleId ? [vehicleId] : []);
      return row?.n ?? 0;
    },

    /**
     * Insert or update by id. Sets `id` when missing, `created_at` on insert,
     * and always `updated_at` + `synced_at = NULL`.
     *
     * Runs inside the write queue unless a database handle is passed, which is
     * how the importer performs thousands of upserts inside its own single
     * transaction without deadlocking on the queue.
     */
    async upsert(input: Partial<T> & Record<string, unknown>, db?: SQLiteDatabase): Promise<T> {
      const rowId = (input.id as string | undefined) ?? newId();
      const timestamp = now();
      const patch = toRow({ ...input, id: rowId }, config);

      const run = async (handle: SQLiteDatabase) => {
        const existing = await handle.getFirstAsync<Row>(
          `SELECT * FROM ${table} WHERE id = ?`,
          [rowId],
        );

        // A partial update is merged onto the row that is already there.
        //
        // This is not an optimisation. `INSERT … ON CONFLICT DO UPDATE` still has
        // to build a row that satisfies every NOT NULL column *before* SQLite
        // looks at the conflict clause, so `upsert({ id, oneField })` on a table
        // with required columns fails outright — and the web driver reports it
        // only as "Error finalizing statement", naming neither column nor table.
        const data: Row = existing ? { ...existing, ...patch } : patch;

        data.updated_at = timestamp;
        data.synced_at = null;
        data.created_at =
          (existing?.created_at as string | undefined) ??
          (input.createdAt as string | undefined) ??
          timestamp;

        const columns = Object.keys(data);
        const placeholders = columns.map(() => '?').join(', ');
        const updates = columns
          .filter((c) => c !== 'id' && c !== 'created_at')
          .map((c) => `${c} = excluded.${c}`)
          .join(', ');

        await handle.runAsync(
          `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})
           ON CONFLICT(id) DO UPDATE SET ${updates}`,
          columns.map((c) => data[c]) as never,
        );

        const row = await handle.getFirstAsync<Row>(`SELECT * FROM ${table} WHERE id = ?`, [rowId]);
        return toDomain<T>(row as Row, config);
      };

      return db ? run(db) : enqueue(run);
    },

    /** Tombstone, never a DELETE — Phase 9 needs to propagate the removal. */
    async softDelete(rowId: string, db?: SQLiteDatabase): Promise<void> {
      const timestamp = now();
      const run = async (handle: SQLiteDatabase) => {
        await handle.runAsync(
          `UPDATE ${table} SET deleted_at = ?, updated_at = ?, synced_at = NULL WHERE id = ?`,
          [timestamp, timestamp, rowId],
        );
      };
      if (db) await run(db);
      else await enqueue(run);
    },

    async restore(rowId: string): Promise<void> {
      const timestamp = now();
      await enqueue(async (handle) => {
        await handle.runAsync(
          `UPDATE ${table} SET deleted_at = NULL, updated_at = ?, synced_at = NULL WHERE id = ?`,
          [timestamp, rowId],
        );
      });
    },

    /** Backup export: every row including tombstones. */
    async listAllForBackup(): Promise<T[]> {
      return query(`SELECT * FROM ${table}`);
    },
  };

  return repo;
}

export type Repo<T extends { id: string }> = ReturnType<typeof makeRepo<T>>;
export { camel, snake };
