import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import { recordError } from '../diagnostics';
import { appliesHere } from './defs';
import { impl, managePhotoAccess, openAppSettings } from './impl';
import type { PermissionId, PermissionSnapshot, PermissionStatus } from './types';

/**
 * The registry's state and its API (IMP 16102026 ADR-59). Every permission read or request in the app goes through
 * here: one cache, one place that re-reads when the person comes back from the settings.
 *
 * Nothing in this file shows a dialog by itself — `requestPermission` is for the code that already explained why
 * (components/permissions: the primer sheet, the gate, the chip). Nothing is asked in cold.
 */

type Entry = PermissionSnapshot & { checkedAt: number };

const cache = new Map<PermissionId, Entry>();
const listeners = new Set<() => void>();
let version = 0;

function put(id: PermissionId, snap: PermissionSnapshot): PermissionSnapshot {
  const prev = cache.get(id);
  cache.set(id, { ...snap, checkedAt: Date.now() });
  if (!prev || prev.status !== snap.status || prev.detail !== snap.detail) {
    version++;
    for (const l of listeners) l();
  }
  return snap;
}

/** What the cache has for it right now (null before the first read). */
export function getPermission(id: PermissionId): PermissionSnapshot | null {
  const e = cache.get(id);
  return e ? { status: e.status, detail: e.detail } : null;
}

/** Reads the state from the system, without asking. */
export async function checkPermission(id: PermissionId): Promise<PermissionSnapshot> {
  if (!appliesHere(id)) return put(id, { status: 'unavailable' });
  try {
    return put(id, await impl[id].check());
  } catch (error) {
    // expo-location on a browser without the Permissions API, a native module missing in Expo Go…
    recordError(`permission-check-${id}`, error);
    return put(id, { status: 'unknown' });
  }
}

/**
 * Asks (the system dialog, or the system screen when Android has no dialog). Call it after the primer; the UI wrapper
 * is `usePermissionRequest`. Returns the state afterwards.
 */
export async function requestPermission(id: PermissionId): Promise<PermissionSnapshot> {
  if (!appliesHere(id)) return put(id, { status: 'unavailable' });
  try {
    return put(id, await impl[id].request());
  } catch (error) {
    recordError(`permission-request-${id}`, error);
    return checkPermission(id);
  }
}

/** Opens the system screen where it can be changed. False where a page cannot (the web): show the steps. */
export async function openPermissionSettings(id: PermissionId): Promise<boolean> {
  const open = impl[id].openSettings;
  if (!open) return false;
  try {
    await open();
    return true;
  } catch (error) {
    recordError(`permission-settings-${id}`, error);
    return false;
  }
}

/** Opens the app's own page in the system settings (Android); `managePhotoAccess` is Android 14's "some photos" picker. */
export { managePhotoAccess, openAppSettings };

/** Re-reads these (or every cached one). */
export async function recheckPermissions(ids?: PermissionId[]): Promise<void> {
  const list = ids ?? [...cache.keys()];
  await Promise.all(list.map((id) => checkPermission(id)));
}

// ---- re-read when the person comes back --------------------------------------------------------------------------

let watchers = 0;
let appSub: { remove(): void } | null = null;
let visibilityOff: (() => void) | null = null;

function startWatching() {
  watchers++;
  if (watchers > 1) return;
  const reread = () => void recheckPermissions();
  // Native: the app returns to `active` from the settings. Web: the tab / the installed app becomes visible again.
  appSub = AppState.addEventListener('change', (s) => s === 'active' && reread());
  if (typeof document !== 'undefined' && document.addEventListener) {
    const onVisible = () => document.visibilityState === 'visible' && reread();
    document.addEventListener('visibilitychange', onVisible);
    visibilityOff = () => document.removeEventListener('visibilitychange', onVisible);
  }
}

function stopWatching() {
  watchers = Math.max(0, watchers - 1);
  if (watchers > 0) return;
  appSub?.remove();
  appSub = null;
  visibilityOff?.();
  visibilityOff = null;
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** Calls back whenever any permission's state changes (a chip, the settings, a re-read). Returns the unsubscribe. */
export function onPermissionChange(listener: () => void): () => void {
  return subscribe(listener);
}

/**
 * One permission, live: its state (null while the first read runs), the actions, and a re-read whenever the app
 * comes back to the foreground — so a screen corrects itself after the person visits the settings.
 */
export function usePermission(id: PermissionId) {
  useSyncExternalStore(subscribe, () => version, () => version);
  useEffect(() => {
    startWatching();
    void checkPermission(id);
    return stopWatching;
  }, [id]);
  const snap = getPermission(id);
  const status: PermissionStatus = snap?.status ?? 'unknown';
  return {
    status,
    detail: snap?.detail,
    /** False until the first read answered. */
    loaded: snap != null,
    request: useCallback(() => requestPermission(id), [id]),
    recheck: useCallback(() => checkPermission(id), [id]),
    openSettings: useCallback(() => openPermissionSettings(id), [id]),
  };
}

/** Several at once (the Permisos screen, the banner, the welcome slide). */
export function usePermissions(ids: PermissionId[]) {
  useSyncExternalStore(subscribe, () => version, () => version);
  const key = ids.join(',');
  useEffect(() => {
    startWatching();
    void recheckPermissions(key.split(',') as PermissionId[]);
    return stopWatching;
  }, [key]);
  return Object.fromEntries(ids.map((id) => [id, getPermission(id)])) as Record<PermissionId, PermissionSnapshot | null>;
}

/** Tests only. */
export function __resetPermissions(): void {
  cache.clear();
  version = 0;
  watchers = 0;
  appSub?.remove();
  appSub = null;
  visibilityOff?.();
  visibilityOff = null;
}
