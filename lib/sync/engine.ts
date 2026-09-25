import { getSupabase, describeSchemaError } from '../cloud/supabase';
import { settings as settingsRepo } from '../db/repos';
import {
  applyRemoteRows,
  countDirty,
  dirtyRows,
  liveVehicleCount,
  localByIds,
  applyRemoteSetting,
  markSynced,
  now,
  syncableSettings,
  toCloudShape,
} from '../db/syncOps';
import { es } from '../i18n/es';
import { removeDeletedMediaBytes, uploadMediaBytes } from './mediaBytes';
import {
  afterCursorFilter,
  batch,
  cursorAfter,
  decide,
  formatCursor,
  hasMore,
  normaliseTimestamp,
  overlapStart,
  parseCursor,
} from './merge';
import {
  BOOLEAN_COLUMNS,
  conflictTarget,
  cursorKey,
  PULL_PAGE,
  PUSH_BATCH,
  SYNCED_SETTING_KEYS,
  SYNC_TABLES,
  type SyncTable,
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
  | {
      state: 'idle';
      lastSyncAt: string | null;
      pending: number;
      /** Set only after a first-login sync: what the first merge did. */
      firstLogin?: { vehiclesAdded: number; pushed: number; pulled: number };
    }
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

/** Resolves once no sync is running — so a cloud wipe cannot race a push. */
export async function whenSyncIdle(): Promise<void> {
  if (running) await running.catch(() => undefined);
}

export async function sync(reason: SyncReason = 'manual'): Promise<SyncResult> {
  if (running) return running;
  running = run(reason).finally(() => {
    running = null;
  });
  return running;
}

async function run(reason: SyncReason, retriedAuth = false): Promise<SyncResult> {
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
    await removeDeletedMediaBytes(supabase);

    for (const table of SYNC_TABLES) {
      if (table.name === 'setting') {
        const settings = await syncSettings(supabase, userId);
        pushed += settings.pushed;
        pulled += settings.pulled;
        continue;
      }
      pushed += await pushTable(supabase, table, userId);
    }

    // Counted around the pull, so the first sign-in can say what came down.
    const vehiclesBefore = reason === 'first-login' ? await liveVehicleCount() : 0;

    const parked: Parked = {};
    for (const table of SYNC_TABLES) {
      if (table.name === 'setting') continue;
      const outcome = await pullTable(supabase, table.name);
      pulled += outcome.applied;
      if (outcome.parked.length) parked[table.name] = outcome.parked as IncomingRow[];
    }
    pulled += await retryParked(parked);

    // No download step: bytes come down lazily, on the first attempt to display
    // the photo (see lib/sync/mediaBytes.ts).

    const finishedAt = now();
    await settingsRepo.set(LAST_SYNC_KEY, finishedAt);
    emit({
      state: 'idle',
      lastSyncAt: finishedAt,
      pending: await pendingCount(),
      ...(reason === 'first-login'
        ? { firstLogin: { vehiclesAdded: Math.max(0, (await liveVehicleCount()) - vehiclesBefore), pushed, pulled } }
        : {}),
    });
    return { ok: true, pushed, pulled };
  } catch (error) {
    // An expired token the client did not refresh in time: refresh once and
    // run again. Once only — a session that cannot refresh is signed out, and
    // saying so beats retrying forever.
    if (!retriedAuth && isAuthError(error)) {
      const { error: refreshError } = await supabase.auth.refreshSession();
      if (!refreshError) return run(reason, true);
    }
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

async function pushTable(supabase: Client, spec: SyncTable, userId: string): Promise<number> {
  const { name: table, localOnly } = spec;
  const rows = await dirtyRows(table);
  if (!rows.length) return 0;

  const booleans = BOOLEAN_COLUMNS[table] ?? [];
  let pushed = 0;

  for (const chunk of batch(rows, PUSH_BATCH)) {
    const payload = chunk.map((row) => toCloudShape(row, localOnly, userId, booleans));

    const { error } = await supabase
      .from(table as never)
      .upsert(payload as never, { onConflict: conflictTarget(spec) });
    if (error) throw error;

    // Only after the server has it. A crash between the upsert and this line
    // leaves the rows dirty, and the next sync pushes them again — an upsert,
    // so re-pushing costs nothing and loses nothing.
    await markSynced(
      table,
      chunk.map((row) => ({ id: row.id as string, updatedAt: row.updated_at as string })),
    );
    pushed += chunk.length;
  }

  return pushed;
}

/**
 * Settings are keyed by `(user_id, key)` rather than by id, and only a few of
 * them travel — `active_vehicle_id` describes a device, not a person.
 *
 * Both directions, per key, last write wins — the same rule as every other row.
 * A setting pulled down is written with the cloud's own timestamp, so it does
 * not look newer than the cloud and bounce straight back up.
 */
async function syncSettings(supabase: Client, userId: string): Promise<{ pushed: number; pulled: number }> {
  const keys = [...SYNCED_SETTING_KEYS];
  const local = new Map((await syncableSettings(keys)).map((row) => [row.key, row]));

  const { data, error } = await supabase
    .from('setting' as never)
    .select('key, value, updated_at')
    .in('key', keys);
  if (error) throw error;
  const remote = new Map(
    ((data ?? []) as { key: string; value: unknown; updated_at: string }[]).map((row) => [row.key, row]),
  );

  const time = (iso: string | undefined) => (iso ? Date.parse(iso) : -Infinity);
  const toPush: { user_id: string; key: string; value: unknown; updated_at: string }[] = [];
  let pulled = 0;

  for (const key of keys) {
    const mine = local.get(key);
    const theirs = remote.get(key);
    if (theirs && time(theirs.updated_at) > time(mine?.updatedAt)) {
      // The local column is TEXT holding JSON; the cloud column is jsonb.
      await applyRemoteSetting(key, JSON.stringify(theirs.value), new Date(theirs.updated_at).toISOString());
      pulled += 1;
    } else if (mine && time(mine.updatedAt) > time(theirs?.updated_at)) {
      toPush.push({ user_id: userId, key, value: safeParse(mine.value), updated_at: mine.updatedAt });
    }
  }

  if (toPush.length) {
    const { error: pushError } = await supabase
      .from('setting' as never)
      .upsert(toPush as never, { onConflict: 'user_id,key' });
    if (pushError) throw pushError;
  }
  return { pushed: toPush.length, pulled };
}

async function pullTable(supabase: Client, table: string): Promise<PullOutcome> {
  const stored = parseCursor(await settingsRepo.get<string | null>(cursorKey(table), null));
  // Start a little behind the stored cursor (see overlapStart): a slow push
  // that committed after a later one would otherwise never be read.
  let cursor = overlapStart(stored);
  let applied = 0;
  const parked: Record<string, unknown>[] = [];

  // Bounded so a cursor that somehow fails to advance cannot spin forever.
  for (let page = 0; page < 1000; page++) {
    let query = supabase
      .from(table as never)
      .select('*')
      .order('server_updated_at', { ascending: true })
      .order('id', { ascending: true })
      .limit(PULL_PAGE);
    if (cursor) query = query.or(afterCursorFilter(cursor));

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

    const result = await applyRemoteRows(table, await newerThanLocal(table, incoming));
    applied += result.applied;
    parked.push(...result.parked);

    // The page is sorted by (server_updated_at, id), so its last row is where
    // the next one starts — ties included (see parseCursor).
    const advanced = cursorAfter(incoming)!;
    cursor = advanced;
    await settingsRepo.set(cursorKey(table), formatCursor(advanced));

    if (!hasMore(rows, PULL_PAGE)) break;
  }

  return { applied, parked };
}

type PullOutcome = { applied: number; parked: Record<string, unknown>[] };

type IncomingRow = Record<string, unknown> & { id: string; updatedAt: string; serverUpdatedAt: string };

/** The incoming rows that last-write-wins says should replace what is on the phone. */
async function newerThanLocal(table: string, incoming: IncomingRow[]): Promise<IncomingRow[]> {
  const local = await localByIds(table, incoming.map((row) => row.id));
  return incoming.filter((row) => {
    const existing = local.get(row.id);
    return (
      decide(
        existing
          ? {
              id: existing.id as string,
              updatedAt:
                normaliseTimestamp(existing.updated_at as string) ?? (existing.updated_at as string),
              syncedAt: (existing.synced_at as string | null) ?? null,
            }
          : null,
        row,
      ) === 'apply'
    );
  });
}

/**
 * Rows a pull could not write — almost always a child that arrived before its
 * parent. Kept, never dropped: the cursor has moved past them, so this list is
 * the only copy the phone has until they land.
 */
const PARKED_KEY = 'sync_parked';
type Parked = Record<string, IncomingRow[]>;

/**
 * Retries parked rows, in dependency order, against whatever the phone holds
 * now. Called once at the end of every sync — by then every parent table has
 * been pulled — and whatever still fails waits for the next one.
 */
async function retryParked(fresh: Parked): Promise<number> {
  const stored = await settingsRepo.get<Parked>(PARKED_KEY, {});
  let applied = 0;
  const still: Parked = {};
  for (const table of SYNC_TABLES) {
    const rows = [...(stored[table.name] ?? []), ...(fresh[table.name] ?? [])];
    if (!rows.length) continue;
    // A local edit made since the row was parked still wins.
    const result = await applyRemoteRows(table.name, await newerThanLocal(table.name, rows));
    applied += result.applied;
    if (result.parked.length) still[table.name] = result.parked as IncomingRow[];
  }
  await settingsRepo.set(PARKED_KEY, still);
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
function isAuthError(error: unknown): boolean {
  const code = (error as { code?: string })?.code;
  if (code === 'PGRST301' || code === '401' || code === 'PGRST303') return true;
  const message = String((error as { message?: string })?.message ?? '').toLowerCase();
  return message.includes('jwt') && (message.includes('expired') || message.includes('invalid'));
}

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
