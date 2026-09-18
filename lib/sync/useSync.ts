import { useCallback, useEffect, useState } from 'react';

import { pendingCount, onSyncStatus, sync, type SyncReason, type SyncStatus } from './engine';
import { settings as settingsRepo } from '../db/repos';
import { FEATURE_SYNC } from '../flags';
import { useStore } from '../store';

/**
 * The sync engine, as a React hook.
 *
 * The engine is module-level on purpose — a sync started from the header must
 * be the same sync the Cuenta screen is watching, and two components holding
 * their own copy of the state would disagree about whether one was running.
 * This subscribes to it rather than owning it.
 */
export type SyncView = {
  status: SyncStatus;
  /** Rows waiting to be pushed. Recounted after every store write. */
  pending: number;
  lastSyncAt: string | null;
  running: boolean;
  syncNow: (reason?: SyncReason) => Promise<void>;
};

const LAST_SYNC_KEY = 'last_sync_at';

export function useSync(): SyncView {
  const { data } = useStore();
  const [status, setStatus] = useState<SyncStatus>({
    state: 'idle',
    lastSyncAt: null,
    pending: 0,
  });
  const [pending, setPending] = useState(0);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);

  useEffect(() => onSyncStatus(setStatus), []);

  // The pending count and the last-sync time both come from the database, and
  // both change on any local write — which is what `data` changing means.
  useEffect(() => {
    // Three components read this hook; skipping the queries when sync is off
    // keeps a disabled feature from costing a count over every table on every
    // local write.
    if (!FEATURE_SYNC) return;

    let cancelled = false;
    void (async () => {
      const [count, last] = await Promise.all([
        pendingCount(),
        settingsRepo.get<string | null>(LAST_SYNC_KEY, null),
      ]);
      if (cancelled) return;
      setPending(count);
      setLastSyncAt(last);
    })().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [data, status]);

  const syncNow = useCallback(async (reason: SyncReason = 'manual') => {
    await sync(reason);
  }, []);

  return {
    status,
    pending,
    lastSyncAt,
    running: status.state === 'running',
    syncNow,
  };
}
