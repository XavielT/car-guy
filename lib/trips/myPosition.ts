/**
 * "Where am I", for the user dot on the drive-mode map (IMP 01102026 ADR-49, notes 8 and 16).
 *
 * One foreground watch shared by every screen that shows the dot (ref-counted: the first `useMyPosition()`
 * starts it, the last one stops it). Every fix goes through lib/trips/freshness.ts: only a fresh, precise fix
 * becomes `fix` (the solid dot, the camera follows it); a coarse one is `approx`; a stale one is ignored, so
 * a cached position from this morning never lands on the map as if it were now.
 *
 * The permission is the registry's (lib/permissions, IMP 16102026 ADR-59): this file reads it and reacts when it
 * changes — granted from a chip, from the settings, from the browser's site settings — by starting or stopping the
 * watch. It never asks.
 *
 * - Web (iPhone PWA included): `WEB_PRECISE_GPS` (./webGeo) — the expo-location web shim hands the options object
 *   to `navigator.geolocation.watchPosition` as is.
 * - Android: a fresh `getCurrentPositionAsync` on start, never the last-known one as the truth.
 * - Coming back to the foreground restarts the watch: the first fix after waking is the suspicious one.
 * - A failed read says why (M-5): the browser's codes 1/2/3 are told apart, so "denied", "no signal" and "too slow"
 *   are three different messages.
 *
 * Read-only for the trip machine: recording keeps its own sources (lib/trips/live.ts, the background task).
 */
import * as Location from 'expo-location';
import { useEffect, useSyncExternalStore } from 'react';
import { AppState, Platform } from 'react-native';

import { recordError } from '../diagnostics';
import { saveLastFix } from '../map/lastFix';
import { geoErrorKind, type GeoErrorKind } from '../permissions/map';
import { checkPermission, getPermission, onPermissionChange } from '../permissions/store';
import type { PermissionStatus } from '../permissions/types';
import { classifyFix } from './freshness';
import { WEB_PRECISE_GPS } from './webGeo';

export type MyFix = { lat: number; lng: number; acc: number | null; heading: number | null; t: number };

export type MyPosition = {
  /** `denied` = there is no watch because the permission (or the phone's location) is not in order — see `permission`. */
  status: 'idle' | 'searching' | 'ok' | 'denied' | 'error';
  /** The registry's state of the foreground location permission; null until the first read. */
  permission: PermissionStatus | null;
  /** Why the last read failed, when it did and there is no fix. */
  error: GeoErrorKind | null;
  /** The last fresh, precise fix (solid dot). */
  fix: MyFix | null;
  /** The newest recent-but-imprecise fix (grey halo, no re-centre). */
  approx: MyFix | null;
};

const EMPTY: MyPosition = { status: 'idle', permission: null, error: null, fix: null, approx: null };
let state: MyPosition = EMPTY;
const listeners = new Set<() => void>();
let users = 0;
let sub: Location.LocationSubscription | null = null;
let appSub: { remove(): void } | null = null;
let permSub: (() => void) | null = null;
let lastPermission: PermissionStatus | null = null;
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
  if (k === 'good') {
    set({ status: 'ok', error: null, fix: f, approx: null });
    saveLastFix({ lat: f.lat, lng: f.lng }, f.t);
  } else if (k === 'coarse') set({ approx: f, status: state.fix ? state.status : 'searching' });
  // 'stale': ignored on purpose — the dot keeps its last good position, greyed by the UI.
}

async function start(): Promise<void> {
  const mine = ++generation;
  set({ status: 'searching', approx: null, error: null });
  try {
    const snap = await checkPermission('location_foreground');
    if (mine !== generation) return;
    lastPermission = snap.status;
    set({ permission: snap.status });
    if (snap.status !== 'granted') {
      // Never asked, refused, blocked, services off, no GPS: no watch. The screen offers the way out (PermissionChip).
      set({ status: 'denied' });
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
      // Not 2 m: a car stopped at a light sends no fix, the dot aged past 15 s and went grey with "Última posición".
      distanceInterval: 0,
      ...WEB_PRECISE_GPS,
    } as Location.LocationOptions;
    const s = await Location.watchPositionAsync(options, (loc) => mine === generation && acceptLocation(loc), (reason) => {
      recordError('my-position', reason);
      if (mine !== generation) return;
      const kind = geoErrorKind(reason);
      // Code 1 may mean the permission was just taken away: read it again (the registry notifies, we restart).
      if (kind === 'denied') void checkPermission('location_foreground');
      if (!state.fix) set({ status: 'error', error: kind });
    });
    if (mine !== generation) s.remove();
    else sub = s;
  } catch (error) {
    recordError('my-position', error);
    if (mine === generation) set({ status: 'error', error: geoErrorKind(error) });
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
  // The permission changed under us (a chip, the settings, the browser): start or stop to match (M-3).
  permSub = onPermissionChange(() => {
    const now = getPermission('location_foreground')?.status;
    if (!now || now === lastPermission) return;
    const was = lastPermission;
    lastPermission = now;
    set({ permission: now });
    if (now === 'granted' && was !== 'granted') {
      stop();
      void start();
    } else if (now !== 'granted') {
      stop();
      set({ status: 'denied', fix: null, approx: null });
    }
  });
}

function release(): void {
  users = Math.max(0, users - 1);
  if (users > 0) return;
  appSub?.remove();
  appSub = null;
  permSub?.();
  permSub = null;
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
  permSub?.();
  permSub = null;
  lastPermission = null;
  state = EMPTY;
}
