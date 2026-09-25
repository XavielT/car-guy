import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';

import { useSession } from '../cloud/auth';
import { FEATURE_SYNC } from '../flags';
import { useStore } from '../store';
import { settings as settingsRepo } from '../db/repos';
import { pendingCount, resetCursorsIfAccountChanged, sync } from './engine';

/**
 * When a sync happens.
 *
 * Nothing on the writing side of the app knows about sync — the repositories
 * mark rows dirty and move on (ADR-02, ADR-03), and this hook is the one place
 * that turns "something changed" into "push it". Mounted once in the root
 * Shell, so every screen is covered without any screen mentioning it.
 *
 * Four triggers, each answering a different way data goes stale:
 *
 *  - **sign-in** — the new device has nothing; the old one has everything.
 *  - **foreground** — the other device edited something while this one slept.
 *  - **after a write** — debounced, so filling a form field by field is one
 *    sync and not one per keystroke.
 *  - **back online** — web only, where a tab can sit open through an outage.
 *
 * Overlap is expected and safe: `sync()` returns the run already in flight
 * rather than starting a second one.
 */

/** Long enough to cover a form being filled in, short enough to feel immediate. */
const AFTER_WRITE_DELAY = 5_000;

export function useSyncTriggers(): void {
  const { session } = useSession();
  const { data } = useStore();
  const userId = session?.user.id ?? null;

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The first `data` value is the initial load, not an edit. Syncing on it
  // would fire on every cold start, before the user has touched anything.
  const seenFirstData = useRef(false);

  useEffect(() => {
    if (!FEATURE_SYNC || !userId) return;
    // The reset must land before the pull, not beside it: a pull that started
    // on the old account's cursor would return nothing and then write a cursor
    // of its own, hiding the new garage for good.
    // "First login" means this account has never synced on this device — a
    // new account here, or a device that never finished a sync. A cold start
    // with a saved session is just a foreground sync, and must not show the
    // "esto pasa una sola vez" banner every time the app opens.
    void resetCursorsIfAccountChanged(userId)
      .then(async (changed) => {
        const neverSynced = (await settingsRepo.get<string | null>('last_sync_at', null)) == null;
        return sync(changed || neverSynced ? 'first-login' : 'foreground');
      })
      .catch(() => {});
  }, [userId]);

  useEffect(() => {
    if (!FEATURE_SYNC || !userId) return;

    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') void sync('foreground');
    });
    return () => listener.remove();
  }, [userId]);

  useEffect(() => {
    if (!FEATURE_SYNC || !userId) return;
    if (!seenFirstData.current) {
      seenFirstData.current = true;
      return;
    }

    if (timer.current) clearTimeout(timer.current);
    // `data` also changes when sync itself writes its cursors and last_sync_at
    // (every table's change listener reloads the store), so "data changed" is
    // not "the user wrote something". Only a sync with rows waiting is worth
    // starting — otherwise each sync would schedule the next, every 5 s.
    timer.current = setTimeout(() => {
      void pendingCount()
        .then((waiting) => (waiting > 0 ? sync('after-write') : undefined))
        .catch(() => {});
    }, AFTER_WRITE_DELAY);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [data, userId]);

  useEffect(() => {
    // `AppState` never reports a change on web when a tab regains the network,
    // and a sync that failed offline is exactly the one worth retrying.
    if (!FEATURE_SYNC || !userId || Platform.OS !== 'web') return;

    const onOnline = () => void sync('foreground');
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [userId]);
}
