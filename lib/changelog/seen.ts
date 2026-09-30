import { useEffect, useSyncExternalStore } from 'react';

import { CHANGELOG } from '@/lib/changelog.generated';
import { settings } from '@/lib/db/repos';

import { LAST_SEEN_VERSION_KEY, shouldShowNovedades } from './novedades';
import { installedVersion } from './version';

/**
 * `last_seen_version`, shared by the launch sheet, Más's dot and /versiones.
 * A tiny module store so marking it seen in one place clears the others at once.
 */
type State = { loaded: boolean; lastSeen: string | null; sheet: boolean };
let state: State = { loaded: false, lastSeen: null, sheet: false };
const listeners = new Set<() => void>();
let loading: Promise<void> | null = null;

function set(next: Partial<State>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Reads the setting once per launch and decides whether the sheet opens. */
function load(hasData: boolean): Promise<void> {
  loading ??= (async () => {
    const lastSeen = await settings.get<string | null>(LAST_SEEN_VERSION_KEY, null).catch(() => null);
    const decision = shouldShowNovedades({ lastSeen, current: installedVersion, hasData, entries: CHANGELOG });
    if (decision.store && !decision.show) {
      // First install, or a version with no notes: nothing to show, nothing unseen.
      await settings.set(LAST_SEEN_VERSION_KEY, installedVersion).catch(() => {});
      set({ loaded: true, lastSeen: installedVersion, sheet: false });
      return;
    }
    set({ loaded: true, lastSeen, sheet: decision.show });
  })();
  return loading;
}

/** The current version's notes have been read (sheet closed, or /versiones opened). */
export async function markVersionSeen(): Promise<void> {
  if (!installedVersion) return;
  set({ lastSeen: installedVersion, sheet: false });
  await settings.set(LAST_SEEN_VERSION_KEY, installedVersion).catch(() => {});
}

/**
 * Starts the launch check. Only the shell calls it, once the store is `ready`:
 * `hasData` is what tells a 2.1.x update (vehicles, no setting) from a first
 * install, and it is only known once the garage loaded.
 */
export function useNovedadesCheck(ready: boolean, hasData: boolean) {
  useEffect(() => {
    if (ready) void load(hasData);
  }, [ready, hasData]);
}

/** Read side, for the sheet, Más's dot and /versiones. */
export function useVersionSeen() {
  const snapshot = useSyncExternalStore(subscribe, () => state, () => state);
  return {
    loaded: snapshot.loaded,
    sheetOpen: snapshot.sheet,
    unseen: snapshot.loaded && !!installedVersion && snapshot.lastSeen !== installedVersion,
  };
}
