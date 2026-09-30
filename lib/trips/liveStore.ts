/**
 * The trip being recorded right now, as the screens see it (IMP 29092026
 * Phase 5A, ADR-31): speed, distance, time, GPS quality. Written by the
 * recorder (lib/trips/live.ts) on every fix, read with `useLiveTrip()`.
 *
 * Module scope on purpose: the recording outlives the screen that started it
 * (tabs change, Inicio unmounts), and the cluster's needle must not re-render
 * React per fix — it subscribes and animates a shared value instead.
 *
 * `reduceLive` is pure and tested; the rest is a tiny external store.
 */
import { useSyncExternalStore } from 'react';

export type GpsQuality = 'good' | 'weak' | 'none';

export type LiveTrip = {
  tripId: string;
  vehicleId: string;
  role: 'conductor' | 'pasajero';
  startedAt: number;
  /** Smoothed, km/h. */
  speedKmh: number;
  maxKmh: number;
  distanceM: number;
  /** Seconds with speed above the moving threshold. */
  movingS: number;
  lastFixAt: number | null;
  gps: GpsQuality;
};

export type LiveFix = { t: number; speedKmh: number; accM: number | null; stepM: number; moving: boolean };

/** Accuracy (m) up to which a fix counts as a good one; above it the GPS lamp is amber. */
const GOOD_ACC = 20;
/** EMA factor for the needle: steady without lagging a braking car by seconds. */
const ALPHA = 0.35;

/** One fix into the snapshot. Pure. */
export function reduceLive(trip: LiveTrip, fix: LiveFix): LiveTrip {
  const dt = trip.lastFixAt != null ? Math.max(0, (fix.t - trip.lastFixAt) / 1000) : 0;
  const speed = trip.lastFixAt == null ? fix.speedKmh : trip.speedKmh + ALPHA * (fix.speedKmh - trip.speedKmh);
  return {
    ...trip,
    speedKmh: Math.max(0, speed),
    maxKmh: Math.max(trip.maxKmh, speed),
    distanceM: trip.distanceM + Math.max(0, fix.stepM),
    movingS: trip.movingS + (fix.moving ? dt : 0),
    lastFixAt: fix.t,
    gps: fix.accM != null && fix.accM <= GOOD_ACC ? 'good' : 'weak',
  };
}

/** No fix for this long → the GPS lamp goes dark ("sin señal"). */
export const GPS_STALE_MS = 10_000;

export function gpsNow(trip: LiveTrip, now: number): GpsQuality {
  if (trip.lastFixAt == null || now - trip.lastFixAt > GPS_STALE_MS) return 'none';
  return trip.gps;
}

let current: LiveTrip | null = null;
const listeners = new Set<() => void>();

export function getLiveTrip(): LiveTrip | null {
  return current;
}

export function setLiveTrip(next: LiveTrip | null): void {
  current = next;
  for (const l of listeners) l();
}

export function subscribeLiveTrip(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The live trip, re-rendering on every fix — for the numbers, not the needle. */
export function useLiveTrip(): LiveTrip | null {
  return useSyncExternalStore(subscribeLiveTrip, getLiveTrip, getLiveTrip);
}
