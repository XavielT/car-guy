import { getSupabase, describeSchemaError } from '../cloud/supabase';
import { settings as settingsRepo } from '../db/repos';
import {
  applyRemoteRows,
  countDirty,
  dirtyRows,
  localByIds,
  markSynced,
  now,
  syncableSettings,
  toCloudShape,
} from '../db/syncOps';
import { es } from '../i18n/es';
import { uploadMediaBytes } from './mediaBytes';
import { batch, decide, hasMore, nextCursor, normaliseTimestamp } from './merge';
import {
  BOOLEAN_COLUMNS,
  cursorKey,
  PULL_PAGE,
  PUSH_BATCH,
  SYNCED_SETTING_KEYS,
  SYNC_TABLES,
} from './tables';

/**
 * Push, then pull, one table at a time in dependency order.
 *
 * Every decision this file makes is delegated: `lib/sync/merge.ts` decides
 * which rows are dirty and which side of a conflict wins, `lib/db/syncOps.ts`
 * owns the SQL, and `lib/sync/tables.ts` says what syncs and in what order.
 * What is left here is sequencing and failure handling — the parts that need a
 * network and a database to mean anything, and which are therefore the parts
 * the unit tests cannot cover.
 *
 * It never throws at its caller. A sync that fails is a sync that will run
 * again on the next trigger; the app has all its data locally either way
 * (ADR-05), so there is nothing a thrown error would let the UI do that a
 * status field does not.
 */

export type SyncReason = 'manual' | 'foreground' | 'after-write' | 'first-login';

export type SyncStatus =
  | { state: 'idle'; lastSyncAt: string | null; pending: number }
  | { state: 'running'; reason: SyncReason }
  | { state: 'error'; message: string; lastSyncAt: string | null };

export type SyncResult = {
  ok: boolean;
  pushed: number;
  pulled: number;
  /** Set when ok is false; already in Spanish and safe to show. */
  message?: string;
};

const LAST_SYNC_KEY = 'last_sync_at';
const AUTH_USER_KEY = 'auth_user_id';

/**
 * One sync at a time.
 *
 * Two overlapping runs would push the same dirty rows twice and race each
 * other's cursor writes. The triggers are deliberately eager — foreground,
 * after every write, manual — so overlap is the normal case, not the edge one.
 */
let running: Promise<SyncResult> | null = null;

let listeners: ((status: SyncStatus) => void)[] = [];

export function onSyncStatus(listener: (status: SyncStatus) => void): () => void {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

function emit(status: SyncStatus): void {
  for (const listener of listeners) listener(status);
}

/** How many local rows are waiting to be pushed, for the UI's pending count. */
export async function pendingCount(): Promise<number> {
  let total = 0;
  for (const table of SYNC_TABLES) {
    if (table.name === 'setting') continue;
    total += await countDirty(table.name);
  }
  return total;
}

/**
 * Resets the pull cursors when a *different* account signs in on this device.
 *
 * A cursor is a high-water mark in `server_updated_at`, and that clock is
 * shared by every row in the table regardless of who owns it. Signing in as
 * someone else with the previous account's cursor still in place would ask the
 * server for rows newer than a timestamp the new account has nothing past — so
 * the first pull would return nothing and the new garage would never arrive.
 *
 * Only on a *change* of user. Signing out and back in as the same person must
 * keep its cursors (ADR-05): re-pulling a whole history because someone
 * re-authenticated is bandwidth spent to reach the state already on disk.
 *
 * Returns true when it reset, so the caller can report a full first sync.
 */
export async function resetCursorsIfAccountChanged(userId: string): Promise<boolean> {
  const previous = await settingsRepo.get<string | null>(AUTH_USER_KEY, null);
  if (previous === userId) return false;

  if (previous) {
    for (const table of SYNC_TABLES) {
      await settingsRepo.set(cursorKey(table.name), null);
    }
    await settingsRepo.set(LAST_SYNC_KEY, null);
  }

  await settingsRepo.set(AUTH_USER_KEY, userId);
  return Boolean(previous);
}

export async function sync(reason: SyncReason = 'manual'): Promise<SyncResult> {
  if (running) return running;
  running = run(reason).finally(() => {
    running = null;
  });
  return running;
}

async function run(reason: SyncReason): Promise<SyncResult> {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, pushed: 0, pulled: 0, message: es.account.notConfigured };

  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) return { ok: false, pushed: 0, pulled: 0, message: es.sync.signedOut };

  emit({ state: 'running', reason });

  let pushed = 0;
  let pulled = 0;

  try {
    // Before the media rows, so the `remote_path` they carry already points at
    // bytes the other device can actually fetch.
    await uploadMediaBytes(supabase, userId);

    for (const table of SYNC_TABLES) {
      if (table.name === 'setting') {
        pushed += await pushSettings(supabase, userId);
        continue;
      }
      pushed += await pushTable(supabase, table.name, table.localOnly, userId);
    }

    for (const table of SYNC_TABLES) {
      if (table.name === 'setting') continue;
      pulled += await pullTable(supabase, table.name);
    }

    // No download step: bytes come down lazily, on the first attempt to display
    // the photo (see lib/sync/mediaBytes.ts).

    const finishedAt = now();
    await settingsRepo.set(LAST_SYNC_KEY, finishedAt);
    emit({ state: 'idle', lastSyncAt: finishedAt, pending: await pendingCount() });
    return { ok: true, pushed, pulled };
  } catch (error) {
    const message = describe(error);
    emit({
      state: 'error',
      message,
      lastSyncAt: await settingsRepo.get<string | null>(LAST_SYNC_KEY, null),
    });
    return { ok: false, pushed, pulled, message };
  }
}

type Client = NonNullable<ReturnType<typeof getSupabase>>;

async function pushTable(
  supabase: Client,
  table: string,
  localOnly: string[],
  userId: string,
): Promise<number> {
  const rows = await dirtyRows(table);
  if (!rows.length) return 0;

  const booleans = BOOLEAN_COLUMNS[table] ?? [];
  let pushed = 0;

  for (const chunk of batch(rows, PUSH_BATCH)) {
    const payload = chunk.map((row) => toCloudShape(row, localOnly, userId, booleans));

    const { error } = await supabase
      .from(table as never)
      .upsert(payload as never, { onConflict: 'id' });
    if (error) throw error;

    // Only after the server has it. A crash between the upsert and this line
    // leaves the rows dirty, and the next sync pushes them again — an upsert,
    // so re-pushing costs nothing and loses nothing.
    await markSynced(table, chunk.map((row) => row.id as string));
    pushed += chunk.length;
  }

  return pushed;
}

/**
 * Settings are keyed by `(user_id, key)` rather than by id, and only three of
 * them travel — `active_vehicle_id` describes a device, not a person.
 */
async function pushSettings(supabase: Client, userId: string): Promise<number> {
  const rows = await syncableSettings([...SYNCED_SETTING_KEYS]);
  if (!rows.length) return 0;

  const payload = rows.map((row) => ({
    user_id: userId,
    key: row.key,
    // The local column is TEXT holding JSON; the cloud column is jsonb.
    value: safeParse(row.value),
    updated_at: row.updatedAt,
  }));

  const { error } = await supabase
    .from('setting' as never)
    .upsert(payload as never, { onConflict: 'user_id,key' });
  if (error) throw error;
  return payload.length;
}

async function pullTable(supabase: Client, table: string): Promise<number> {
  let cursor = await settingsRepo.get<string | null>(cursorKey(table), null);
  let applied = 0;

  // Bounded so a cursor that somehow fails to advance cannot spin forever.
  for (let page = 0; page < 100; page++) {
    let query = supabase
      .from(table as never)
      .select('*')
      .order('server_updated_at', { ascending: true })
      .limit(PULL_PAGE);
    if (cursor) query = query.gt('server_updated_at', cursor);

    const { data, error } = await query;
    if (error) throw error;

    const rows = (data ?? []) as Record<string, unknown>[];
    if (!rows.length) break;

    const incoming = rows.map((row) => ({
      ...row,
      updatedAt: normaliseTimestamp(row.updated_at as string) ?? (row.updated_at as string),
      serverUpdatedAt: row.server_updated_at as string,
      id: row.id as string,
    }));

    const local = await localByIds(table, incoming.map((row) => row.id));

    const toApply = incoming.filter((row) => {
      const existing = local.get(row.id);
      return (
        decide(
          existing
            ? {
                id: existing.id as string,
                updatedAt:
                  normaliseTimestamp(existing.updated_at as string) ??
                  (existing.updated_at as string),
                syncedAt: (existing.synced_at as string | null) ?? null,
              }
            : null,
          row,
        ) === 'apply'
      );
    });

    applied += await applyRemoteRows(table, toApply);

    const advanced = nextCursor(cursor, incoming);
    // A page whose cursor did not move would be fetched forever.
    if (advanced === cursor) break;
    cursor = advanced;
    await settingsRepo.set(cursorKey(table), cursor);

    if (!hasMore(rows, PULL_PAGE)) break;
  }

  return applied;
}

function safeParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

/**
 * Turns whatever came back into a sentence.
 *
 * `PGRST106` is the one case aimed at whoever administers the project rather
 * than at the person holding the phone, and it says so.
 */
function describe(error: unknown): string {
  const schema = describeSchemaError(error as { code?: string });
  if (schema) return schema;

  const code = (error as { code?: string })?.code;
  if (code === '42501') return es.sync.errors.forbidden;
  if (code === 'PGRST301' || code === '401') return es.sync.errors.expired;

  const message = String((error as { message?: string })?.message ?? error).toLowerCase();
  if (message.includes('network') || message.includes('fetch')) return es.sync.errors.network;
  if (message.includes('jwt') || message.includes('expired')) return es.sync.errors.expired;

  return es.sync.errors.generic;
}
