/**
 * The decisions a sync makes, as pure functions.
 *
 * Every rule in 02-supabase-carguy.md §5 that is a *judgement* lives here —
 * which rows are dirty, which side of a conflict wins, where the cursor lands —
 * so that each can be tested against a literal instead of against a database
 * and a network. `lib/sync/engine.ts` does the talking; this file does the
 * thinking.
 *
 * Nothing here imports Supabase, SQLite or React.
 */

/** The four columns every syncable row carries (ADR-03). */
export type SyncableRow = {
  id: string;
  updatedAt: string;
  deletedAt?: string | null;
  /** Null when the row has never been pushed. Local-only. */
  syncedAt?: string | null;
};

/** What the cloud sends back. `serverUpdatedAt` is the pull cursor. */
export type RemoteRow = {
  id: string;
  updatedAt: string;
  deletedAt?: string | null;
  serverUpdatedAt: string;
};

/**
 * A row needs pushing when it has never been pushed, or when it changed after
 * the last push.
 *
 * `>` and not `>=`: `synced_at` is written *after* a successful push, so a row
 * whose timestamps are equal is one that was pushed and not touched since.
 * Using `>=` would make every row permanently dirty and every sync a full
 * upload.
 *
 * Tombstones are dirty like anything else — a deletion is a change that has to
 * travel, and dropping it is how a deleted row comes back on the next pull.
 */
export function isDirty(row: SyncableRow): boolean {
  if (!row.syncedAt) return true;
  return row.updatedAt > row.syncedAt;
}

export function selectDirty<T extends SyncableRow>(rows: T[]): T[] {
  return rows.filter(isDirty);
}

/**
 * Splits rows into batches. The last batch is whatever is left; an empty input
 * produces no batches at all rather than one empty one, so callers never make
 * a pointless round trip.
 */
export function batch<T>(rows: T[], size: number): T[][] {
  if (size <= 0) throw new Error('batch size must be positive');
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += size) {
    out.push(rows.slice(i, i + size));
  }
  return out;
}

export type MergeDecision =
  /** The incoming row replaces the local one. */
  | 'apply'
  /** The local row stays; it is newer, or equal and therefore not worth churning. */
  | 'keep-local'
  /** The local row stays and is still dirty — it will win on the next push. */
  | 'keep-local-dirty';

/**
 * Which side of a pulled row wins (spec §5).
 *
 * The six cases the prompt asks for, in one table:
 *
 *   local missing                          → apply
 *   incoming newer, local clean            → apply
 *   incoming newer, local dirty            → keep-local-dirty
 *   incoming older                         → keep-local
 *   equal timestamps                       → keep-local
 *   incoming is a tombstone, local newer   → keep-local (the edit came after)
 *
 * The third is the one worth arguing about. A locally-edited row that has not
 * been pushed yet is *newer information than the server has* — the server's
 * copy predates the edit by definition, because the edit has never been sent.
 * Applying the incoming row would discard an edit the user made and saw
 * succeed. Keeping it means the next push resolves the conflict in the one
 * direction that loses nothing.
 *
 * Equal timestamps keep local because the rows are, as far as anything can
 * tell, the same row; replacing it would rewrite SQLite and move the local
 * `updated_at` for no gain.
 */
export function decide(local: SyncableRow | null | undefined, incoming: RemoteRow): MergeDecision {
  if (!local) return 'apply';

  if (incoming.updatedAt > local.updatedAt) {
    // A dirty local row holds an edit the server has not seen. It wins for now
    // and settles the conflict on the next push.
    return isDirty(local) ? 'keep-local-dirty' : 'apply';
  }

  return 'keep-local';
}

/**
 * The cursor for the next pull: the greatest `server_updated_at` in this page.
 *
 * Taking the maximum rather than the last element means an out-of-order page —
 * which PostgREST should not send, but which a changed `order by` or a future
 * pagination bug could produce — cannot silently rewind the cursor and make the
 * next pull re-fetch rows it already has.
 *
 * An empty page leaves the cursor exactly where it was.
 */
export function nextCursor(current: string | null, page: RemoteRow[]): string | null {
  let cursor = current;
  for (const row of page) {
    if (cursor == null || row.serverUpdatedAt > cursor) cursor = row.serverUpdatedAt;
  }
  return cursor;
}

/** A full page means there is probably another one behind it. */
export function hasMore(page: unknown[], pageSize: number): boolean {
  return page.length >= pageSize;
}

/**
 * Strips the columns that must never leave the device, and drops `undefined`
 * so a partial row does not overwrite a cloud column with null.
 */
export function toCloudRow(
  row: Record<string, unknown>,
  localOnly: string[],
  userId: string,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (localOnly.includes(key)) continue;
    if (value === undefined) continue;
    out[key] = value;
  }
  // Sent explicitly even though the column defaults to auth.uid(): the RLS
  // `with check` on the UPDATE path compares the row's user_id, and a default
  // only applies to an INSERT. An upsert that takes the update branch without
  // it is rejected with 42501.
  out.userId = userId;
  return out;
}

/**
 * Timestamps are compared as strings throughout this file, which is only valid
 * if they are all UTC ISO-8601 of the same length.
 *
 * Local rows are written with `new Date().toISOString()` and Postgres
 * `timestamptz` comes back as ISO too, but Postgres may use `+00:00` instead of
 * `Z` and may vary the fractional digits — `2026-09-18T12:00:00+00:00` sorts
 * *before* `2026-09-18T12:00:00.000Z` as a string, which would silently invert
 * a conflict. Everything entering a comparison goes through here first.
 */
export function normaliseTimestamp(value: string | null | undefined): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

/** `normaliseTimestamp` applied to the fields the merge rules read. */
export function normaliseRow<T extends { updatedAt: string; deletedAt?: string | null }>(
  row: T,
): T {
  return {
    ...row,
    updatedAt: normaliseTimestamp(row.updatedAt) ?? row.updatedAt,
    deletedAt: normaliseTimestamp(row.deletedAt),
  };
}
