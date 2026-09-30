/**
 * Automatic trips: arming the background location service (IMP 29092026
 * Phase 5B, ADR-27; research 01 §1.2, §1.6, §2.2).
 *
 * One task ('carguy-trip-location', lib/trips/task.ts) in two intensities —
 * vigilando (Balanced, 50 m / 15 s, batched per minute) and grabando
 * (BestForNavigation, every second, batched per 10 s in the background) —
 * hosted by Android's foreground service with its fixed notification.
 *
 * Android 12+ does not let an app start a foreground service from the
 * background, so the service is (re)armed only from the app: `armAuto()` on
 * open and on every return to the foreground; a terminated app is not
 * restarted by the OS. Switching intensity from the background only
 * reconfigures the running service; if that throws on a phone, the phone gets
 * ADR-27's fallback — one High / 2 s / 10 m configuration from then on,
 * started by the next armAuto() in the foreground.
 */
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { AppState, Platform } from 'react-native';

import { recordError } from '../diagnostics';
import { es } from '../i18n/es';
import { feed, machineState } from './engine';
import { setTripsSingleConfig, tripsMode, tripsSingleConfig } from './settings';

export const TRIP_TASK = 'carguy-trip-location';

export type Intensity = 'watching' | 'recording' | 'single';

const service = (body: string): Location.LocationTaskOptions['foregroundService'] => ({
  notificationTitle: 'Car Guy',
  notificationBody: body,
  notificationColor: '#E10600',
  killServiceOnDestroy: false,
});

export const TASK_OPTIONS: Record<Intensity, Location.LocationTaskOptions> = {
  watching: {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: 15_000,
    distanceInterval: 50,
    deferredUpdatesInterval: 60_000,
    mayShowUserSettingsDialog: false,
    foregroundService: service(es.trips.serviceWatching),
  },
  // distanceInterval 0: a parked car still sends fixes, so the 4-minute stop rule can run.
  recording: {
    accuracy: Location.Accuracy.BestForNavigation,
    timeInterval: 1000,
    distanceInterval: 0,
    deferredUpdatesInterval: 10_000,
    mayShowUserSettingsDialog: false,
    foregroundService: service(es.trips.serviceRecording),
  },
  single: {
    accuracy: Location.Accuracy.High,
    timeInterval: 2000,
    distanceInterval: 10,
    deferredUpdatesInterval: 10_000,
    mayShowUserSettingsDialog: false,
    foregroundService: service(es.trips.serviceWatching),
  },
};

/** What the running service was last configured with, in this JS context. */
let current: Intensity | null = null;

export type AutoReadiness = 'ready' | 'web' | 'unavailable' | 'foreground' | 'background' | 'approximate';

/** Whether this phone can run Automático right now, and if not, what is missing. */
export async function autoReadiness(): Promise<AutoReadiness> {
  if (Platform.OS === 'web') return 'web';
  if (!(await TaskManager.isAvailableAsync().catch(() => false))) return 'unavailable';
  const fg = await Location.getForegroundPermissionsAsync();
  if (!fg.granted) return 'foreground';
  if (fg.android?.accuracy === 'coarse') return 'approximate';
  const bg = await Location.getBackgroundPermissionsAsync();
  return bg.granted ? 'ready' : 'background';
}

export async function isAutoArmed(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  return Location.hasStartedLocationUpdatesAsync(TRIP_TASK).catch(() => false);
}

async function wanted(phase: 'idle' | 'recording'): Promise<Intensity> {
  if (await tripsSingleConfig()) return 'single';
  return phase === 'recording' ? 'recording' : 'watching';
}

/**
 * Starts (or reconfigures) the service for the machine's phase. Call from the
 * foreground only. Idempotent: nothing happens when it already runs as wanted.
 * Returns whether Automático is running.
 */
export async function armAuto(): Promise<boolean> {
  try {
    if ((await tripsMode()) !== 'auto' || (await autoReadiness()) !== 'ready') {
      await disarmAuto();
      return false;
    }
    const state = await machineState();
    const intensity = await wanted(state.phase);
    const started = await isAutoArmed();
    if (!started || current !== intensity) {
      await Location.startLocationUpdatesAsync(TRIP_TASK, TASK_OPTIONS[intensity]);
      current = intensity;
    }
    return true;
  } catch (error) {
    recordError('trip-arm', error);
    return false;
  }
}

/**
 * Stops the service. An automatic trip still open is closed first (as if
 * "Terminar" was tapped), so leaving Automático never leaves a trip hanging.
 */
export async function disarmAuto(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    if (!(await isAutoArmed())) return;
    const state = await machineState();
    if (state.phase === 'recording' && state.trip?.source === 'auto') await feed({ type: 'manual_stop', t: Date.now() });
    await Location.stopLocationUpdatesAsync(TRIP_TASK);
  } catch (error) {
    recordError('trip-disarm', error);
  } finally {
    current = null;
  }
}

/**
 * The machine asked for another intensity (a trip opened or closed). From the
 * foreground this is a normal start; from the background it reconfigures the
 * running service — and if the phone refuses, the phone switches to the single
 * configuration for good (ADR-27), started by the next foreground armAuto().
 */
export async function switchIntensity(to: 'watching' | 'recording'): Promise<void> {
  if (Platform.OS === 'web') return;
  // One configuration for both phases: there is nothing to switch (and a fresh
  // background context, where `current` is unknown, must not restart the service).
  if (await tripsSingleConfig()) return;
  const intensity = await wanted(to === 'recording' ? 'recording' : 'idle');
  if (current === intensity) return;
  try {
    if (!(await isAutoArmed())) return;
    await Location.startLocationUpdatesAsync(TRIP_TASK, TASK_OPTIONS[intensity]);
    current = intensity;
  } catch (error) {
    const background = AppState.currentState !== 'active';
    recordError(background ? 'trip-switch-bg' : 'trip-switch', error);
    if (!background) return;
    // Retrying from the background would hit the same refusal. The service keeps
    // whatever it runs now; the next armAuto() (app in front) starts the single one.
    await setTripsSingleConfig(true);
    current = null;
  }
}
