/**
 * "Where am I", for the user dot on the drive-mode map (IMP 01102026 ADR-49, notes 8 and 16).
 *
 * One foreground watch shared by every screen that shows the dot (ref-counted: the first `useMyPosition()`
 * starts it, the last one stops it). Every fix goes through lib/trips/freshness.ts: only a fresh, precise fix
 * becomes `fix` (the solid dot, the camera follows it); a coarse one is `approx`; a stale one is ignored, so
 * a cached position from this morning never lands on the map as if it were now.
 *
 * - Web (iPhone PWA included): `enableHighAccuracy`, `maximumAge: 0`, `timeout: 20 s` — the expo-location web
 *   shim hands the options object to `navigator.geolocation.watchPosition` as is.
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

export type MyFix = { lat: number; lng: number; acc: number | null; heading: number | null; t: number };

export type MyPosition = {
  status: 'idle' | 'searching' | 'ok' | 'denied' | 'error';
  /** The last fresh, precise fix (solid dot). */
  fix: MyFix | null;
  /** The newest recent-but-imprecise fix (grey halo, no re-centre). */
  approx: MyFix | null;
};

let state: MyPosition = { status: 'idle', fix: null, approx: null };
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
      if (mine === generation) set({ status: 'denied' });
      return;
    }
    if (Platform.OS === 'android') {
      // A fresh one-shot fix first; it may take seconds, the watch below runs meanwhile.
      void Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })
        .then((loc) => mine === generation && acceptLocation(loc))
        .catch(() => {});
    }
    const options = {
      accuracy: Location.Accuracy.High,
      timeInterval: 1000,
      distanceInterval: 2,
      // Web only (ignored natively): never a cached position, wait up to 20 s for a real one.
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 20_000,
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
  state = { status: 'idle', fix: null, approx: null };
}
