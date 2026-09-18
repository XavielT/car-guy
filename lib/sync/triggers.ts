import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';

import { useSession } from '../cloud/auth';
import { FEATURE_SYNC } from '../flags';
import { useStore } from '../store';
import { resetCursorsIfAccountChanged, sync } from './engine';

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
    void resetCursorsIfAccountChanged(userId)
      .then(() => sync('first-login'))
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
    timer.current = setTimeout(() => void sync('after-write'), AFTER_WRITE_DELAY);
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
