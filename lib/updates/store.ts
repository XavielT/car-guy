import { useSyncExternalStore } from 'react';

import type { ApkInfo } from '../release/apk';

/**
 * What the update banner and Novedades y versiones both read (IMP 01102026 Phase 4): an OTA downloaded and
 * waiting for a restart, and/or a newer APK on GitHub, and the download's progress.
 */
export type UpdateState = {
  /** An EAS Update finished downloading; it runs on the next start (or "Reiniciar"). */
  otaReady: boolean;
  /** A newer APK than the installed one (native changes). */
  apk: ApkInfo | null;
  /** 0..1 while the APK downloads; null otherwise. */
  progress: number | null;
  /** The last check, for Novedades ("Buscado hace …"). */
  checkedAt: number | null;
  error: string | null;
};

let state: UpdateState = { otaReady: false, apk: null, progress: null, checkedAt: null, error: null };
const listeners = new Set<() => void>();

export function getUpdateState(): UpdateState {
  return state;
}

export function setUpdateState(patch: Partial<UpdateState>): void {
  state = { ...state, ...patch };
  for (const l of listeners) l();
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useUpdateState(): UpdateState {
  return useSyncExternalStore(subscribe, getUpdateState, getUpdateState);
}
