/**
 * "Exportar diagnóstico de viajes" (IMP 01102026 Phase 0, note 7, ADR-50): one JSON with everything that
 * decides whether Automático can record on this phone — mode, permissions, the service, MIUI autostart, the
 * machine state and the last fixes' timing — to read next to `adb logcat` before changing any constant.
 *
 * It never carries a position: coordinates (and anything derived from them, like a start point) are dropped
 * here, so the file can be shared freely. The builder is pure (`buildTripDiagnostics`); the gathering and the
 * share sheet are the native glue around it.
 */
import { Platform } from 'react-native';

import { recentErrors, type DiagnosticEntry } from '../diagnostics';
import type { TripMachineState } from './machine';

export type PermissionSnapshot = {
  status: string;
  granted: boolean;
  canAskAgain: boolean;
  /** Android only: 'fine' | 'coarse' | 'none'. */
  accuracy?: string | null;
} | null;

export type FixTiming = { t: number; acc: number | null; speed: number | null };

export type TripDiagnosticsInput = {
  now: number;
  platform: string;
  appVersion: string | null;
  buildNumber: string | null;
  mode: string;
  singleConfig: boolean;
  readiness: string;
  foreground: PermissionSnapshot;
  background: PermissionSnapshot;
  taskManagerAvailable: boolean | null;
  taskRegistered: boolean | null;
  updatesStarted: boolean | null;
  miuiAutostart: string;
  state: TripMachineState | null;
  lastFixes: FixTiming[];
  errors: DiagnosticEntry[];
};

/** The share-safe shape: timings, accuracies and states only — no lat/lng anywhere. */
export function buildTripDiagnostics(input: TripDiagnosticsInput) {
  const s = input.state;
  const ago = (t: number | null | undefined) => (t == null ? null : Math.round((input.now - t) / 1000));
  return {
    kind: 'car-guy-trip-diagnostics',
    v: 1,
    generatedAt: new Date(input.now).toISOString(),
    app: { platform: input.platform, version: input.appVersion, build: input.buildNumber },
    settings: { mode: input.mode, singleConfig: input.singleConfig },
    readiness: input.readiness,
    permissions: { foreground: input.foreground, background: input.background },
    service: {
      taskManagerAvailable: input.taskManagerAvailable,
      taskRegistered: input.taskRegistered,
      locationUpdatesStarted: input.updatesStarted,
    },
    miuiAutostart: input.miuiAutostart,
    // Battery optimisation has no JS API in this build (PowerManager.isIgnoringBatteryOptimizations is native);
    // `adb shell dumpsys deviceidle whitelist` answers it.
    batteryOptimisation: 'unknown',
    machine: s
      ? {
          phase: s.phase,
          fastCount: s.fastCount,
          recentFixes: s.recent.length,
          lastRecentFixSecondsAgo: ago(s.recent.at(-1)?.t),
          openTrip: s.trip
            ? {
                source: s.trip.source,
                startedSecondsAgo: ago(s.trip.startedAt),
                segments: s.trip.segments,
                distanceM: Math.round(s.trip.distanceM),
                lastFixSecondsAgo: ago(s.trip.last?.t),
              }
            : null,
          // Named fields only: ClosedRef also holds lat/lng and startLat/startLng.
          lastClosed: s.lastClosed
            ? {
                endedSecondsAgo: ago(s.lastClosed.endedAt),
                durationS: Math.round((s.lastClosed.endedAt - s.lastClosed.startedAt) / 1000),
                distanceM: Math.round(s.lastClosed.distanceM),
                segments: s.lastClosed.segments,
              }
            : null,
        }
      : null,
    lastFixes: input.lastFixes.slice(-20).map((f) => ({
      at: new Date(f.t).toISOString(),
      secondsAgo: ago(f.t),
      accM: f.acc == null ? null : Math.round(f.acc),
      speedKmh: f.speed == null || f.speed < 0 ? null : Math.round(f.speed * 3.6),
    })),
    errors: input.errors.filter((e) => /^trip|location|task/i.test(e.where)),
  };
}

function snapshot(p: { status: string; granted: boolean; canAskAgain: boolean; android?: { accuracy?: string } } | null | undefined): PermissionSnapshot {
  return p ? { status: p.status, granted: p.granted, canAskAgain: p.canAskAgain, accuracy: p.android?.accuracy ?? null } : null;
}

/** Gathers the live facts (each one best-effort: a failing probe says null, never throws). */
export async function gatherTripDiagnostics(): Promise<ReturnType<typeof buildTripDiagnostics>> {
  const [Location, TaskManager, { autoReadiness, TRIP_TASK }, settings, { machineState }, { getDb }, { getAutostartState }, version] =
    await Promise.all([
      import('expo-location'),
      import('expo-task-manager'),
      import('./auto'),
      import('./settings'),
      import('./engine'),
      import('../db/client'),
      import('@/modules/miui-autostart'),
      import('../changelog/version'),
    ]);
  const safe = async <T,>(f: () => Promise<T>): Promise<T | null> => {
    try {
      return await f();
    } catch {
      return null;
    }
  };
  const native = Platform.OS !== 'web';
  const [mode, singleConfig, readiness, fg, bg, tmAvailable, registered, started, state, rows] = await Promise.all([
    settings.tripsMode(),
    settings.tripsSingleConfig(),
    safe(autoReadiness),
    safe(() => Location.getForegroundPermissionsAsync()),
    native ? safe(() => Location.getBackgroundPermissionsAsync()) : Promise.resolve(null),
    native ? safe(() => TaskManager.isAvailableAsync()) : Promise.resolve(false),
    native ? safe(() => TaskManager.isTaskRegisteredAsync(TRIP_TASK)) : Promise.resolve(false),
    native ? safe(() => Location.hasStartedLocationUpdatesAsync(TRIP_TASK)) : Promise.resolve(false),
    safe(machineState),
    safe(async () => (await getDb()).getAllAsync<FixTiming>('SELECT t, acc, speed FROM trip_point ORDER BY t DESC LIMIT 20')),
  ]);
  return buildTripDiagnostics({
    now: Date.now(),
    platform: `${Platform.OS} ${String(Platform.Version ?? '')}`.trim(),
    appVersion: version.installedVersion,
    buildNumber: version.buildNumber,
    mode,
    singleConfig,
    readiness: readiness ?? 'unknown',
    foreground: snapshot(fg),
    background: snapshot(bg),
    taskManagerAvailable: tmAvailable,
    taskRegistered: registered,
    updatesStarted: started,
    miuiAutostart: getAutostartState(),
    state,
    lastFixes: (rows ?? []).slice().reverse(),
    errors: recentErrors(),
  });
}

/** Writes the JSON and opens the share sheet (web: a download). False when nothing could share it. */
export async function shareTripDiagnostics(dialogTitle: string): Promise<boolean> {
  const json = JSON.stringify(await gatherTripDiagnostics(), null, 2);
  const name = `car-guy-diagnostico-viajes-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`;
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return true;
  }
  const [{ File, Paths }, Sharing] = await Promise.all([import('expo-file-system'), import('expo-sharing')]);
  const file = new File(Paths.cache, name);
  file.create({ overwrite: true });
  file.write(json);
  if (!(await Sharing.isAvailableAsync())) return false;
  await Sharing.shareAsync(file.uri, { dialogTitle, mimeType: 'application/json' });
  return true;
}
