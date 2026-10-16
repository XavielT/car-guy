/**
 * "Where am I", for the user dot on the drive-mode map (IMP 01102026 ADR-49, notes 8 and 16).
 *
 * One foreground watch shared by every screen that shows the dot (ref-counted: the first `useMyPosition()`
 * starts it, the last one stops it). Every fix goes through lib/trips/freshness.ts: only a fresh, precise fix
 * becomes `fix` (the solid dot, the camera follows it); a coarse one is `approx`; a stale one is ignored, so
 * a cached position from this morning never lands on the map as if it were now.
 *
 * - Web (iPhone PWA included): `WEB_PRECISE_GPS` (./webGeo) — the expo-location web shim hands the options object
 *   to `navigator.geolocation.watchPosition` as is.
 * - Android: a fresh `getCurrentPositionAsync` on start, never the last-known one as the truth.
 * - Coming back to the foreground restarts the watch: the first fix after waking is the suspicious one.
 *
 * Read-only for the trip machine: recording keeps its own sources (lib/trips/live.ts, the background task).
 */
import * as Location from 'expo-location';
import { useEffect, useSyncExternalStore } from 'react';
import { AppState, Platform } from 'react-native';

import { recordError } from '../diagnostics';
import { classifyFix } from './freshness';
import { WEB_PRECISE_GPS } from './webGeo';

export type MyFix = { lat: number; lng: number; acc: number | null; heading: number | null; t: number };

/**
 * What the system says about the foreground location permission (IMP 16102026 M-1, M-6):
 * `undetermined` = never asked (the browser's "prompt") — not the same as a refusal; `denied` = refused but the
 * system will ask again; `blocked` = only the settings can change it (on the web a refusal always is: a page cannot
 * ask twice). Phase 2's permission registry replaces this with its own states.
 */
export type LocationPermissionState = 'granted' | 'undetermined' | 'denied' | 'blocked';

export type MyPosition = {
  status: 'idle' | 'searching' | 'ok' | 'denied' | 'error';
  /** null until the first read. */
  permission: LocationPermissionState | null;
  /** The last fresh, precise fix (solid dot). */
  fix: MyFix | null;
  /** The newest recent-but-imprecise fix (grey halo, no re-centre). */
  approx: MyFix | null;
};

let state: MyPosition = { status: 'idle', permission: null, fix: null, approx: null };
const listeners = new Set<() => void>();
let users = 0;
let sub: Location.LocationSubscription | null = null;
let appSub: { remove(): void } | null = null;
let generation = 0;

function set(next: Partial<MyPosition>): void {
  state = { ...state, ...next };
  for (const l of listeners) l();
}

function toFix(loc: Location.LocationObject): MyFix {
  const h = loc.coords.heading;
  return {
    lat: loc.coords.latitude,
    lng: loc.coords.longitude,
    acc: loc.coords.accuracy ?? null,
    // −1 / NaN / 0-at-rest are not a course; the arrow hides then.
    heading: h != null && Number.isFinite(h) && h >= 0 ? h : null,
    t: loc.timestamp,
  };
}

/** The permission response, as the app's four states. */
export function permissionState(perm: { granted: boolean; status?: string; canAskAgain?: boolean }): LocationPermissionState {
  // The web shim answers {status: granted, granted: false} to a position error (code 2/3): the permission is there.
  if (perm.granted || perm.status === 'granted') return 'granted';
  if (perm.status === 'undetermined') return 'undetermined';
  // The expo-location web shim answers canAskAgain: true to a refusal; a page cannot ask twice.
  if (Platform.OS === 'web') return 'blocked';
  return perm.canAskAgain === false ? 'blocked' : 'denied';
}

/** One location in, through the freshness rule. Exported for tests. */
export function acceptLocation(loc: Location.LocationObject, now: number = Date.now()): void {
  const f = toFix(loc);
  const k = classifyFix(f, now);
  if (k === 'good') set({ status: 'ok', fix: f, approx: null });
  else if (k === 'coarse') set({ approx: f, status: state.fix ? state.status : 'searching' });
  // 'stale': ignored on purpose — the dot keeps its last good position, greyed by the UI.
}

async function start(): Promise<void> {
  const mine = ++generation;
  set({ status: 'searching', approx: null });
  try {
    const perm = await Location.getForegroundPermissionsAsync();
    if (!perm.granted) {
      // "Never asked" is not "refused" (M-1): the screen offers to ask instead of saying there is no permission.
      if (mine === generation) set({ status: 'denied', permission: permissionState(perm) });
      return;
    }
    if (mine === generation) set({ permission: 'granted' });
    if (Platform.OS === 'android') {
      // A fresh one-shot fix first; it may take seconds, the watch below runs meanwhile.
      void Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })
        .then((loc) => mine === generation && acceptLocation(loc))
        .catch(() => {});
    }
    const options = {
      accuracy: Location.Accuracy.High,
      timeInterval: 1000,
      // Not 2 m: a car stopped at a light sends no fix, the dot aged past 15 s and went grey with "Última posición".
      distanceInterval: 0,
      ...WEB_PRECISE_GPS,
    } as Location.LocationOptions;
    const s = await Location.watchPositionAsync(options, (loc) => mine === generation && acceptLocation(loc), (reason) => {
      recordError('my-position', reason);
      if (mine === generation && !state.fix) set({ status: 'error' });
    });
    if (mine !== generation) s.remove();
    else sub = s;
  } catch (error) {
    recordError('my-position', error);
    if (mine === generation) set({ status: 'error' });
  }
}

/**
 * Asks for the location from a tap (a user gesture, which the web needs) and, if it is granted, starts the watch
 * right away — the dot appears without leaving the screen (M-3). Returns the permission afterwards.
 */
export async function askMyLocation(): Promise<LocationPermissionState> {
  try {
    const perm = await Location.requestForegroundPermissionsAsync();
    const next = permissionState(perm);
    set({ permission: next });
    if (next === 'granted') {
      stop();
      await start();
    }
    return next;
  } catch (error) {
    recordError('my-position-ask', error);
    set({ status: 'error' });
    return state.permission ?? 'denied';
  }
}

/** Reads the permission again and restarts the watch (coming back from the settings, "Reintentar"). */
export async function refreshMyPosition(): Promise<void> {
  stop();
  await start();
}

function stop(): void {
  generation++;
  sub?.remove();
  sub = null;
}

function retain(): void {
  users++;
  if (users > 1) return;
  void start();
  appSub = AppState.addEventListener('change', (s) => {
    if (s === 'active') {
      stop();
      void start();
    } else if (s === 'background') stop();
  });
}

function release(): void {
  users = Math.max(0, users - 1);
  if (users > 0) return;
  appSub?.remove();
  appSub = null;
  stop();
  set({ status: 'idle', approx: null });
}

export function getMyPosition(): MyPosition {
  return state;
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** The user's own position while the calling screen is mounted (and the app in the foreground). */
export function useMyPosition(enabled = true): MyPosition {
  useEffect(() => {
    if (!enabled) return;
    retain();
    return release;
  }, [enabled]);
  return useSyncExternalStore(subscribe, getMyPosition, getMyPosition);
}

/** Tests only. */
export function __resetMyPosition(): void {
  stop();
  users = 0;
  appSub?.remove();
  appSub = null;
  state = { status: 'idle', permission: null, fix: null, approx: null };
}
