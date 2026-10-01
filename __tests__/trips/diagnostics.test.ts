/** "Exportar diagnóstico de viajes" (IMP 01102026 Phase 0): everything about the service, no position ever. */
import { buildTripDiagnostics, type TripDiagnosticsInput } from '../../lib/trips/diagnostics';

jest.mock('../../lib/diagnostics', () => ({ recentErrors: () => [] }));

const NOW = Date.parse('2026-10-01T15:00:00Z');
const LAT = 18.4861234;
const LNG = -69.9312345;
const fix = (dt: number) => ({ t: NOW - dt * 1000, lat: LAT, lng: LNG, speed: 12, acc: 8 });

const input = (over: Partial<TripDiagnosticsInput> = {}): TripDiagnosticsInput => ({
  now: NOW,
  platform: 'android 33',
  appVersion: '2.4.2',
  buildNumber: '15',
  mode: 'auto',
  singleConfig: false,
  readiness: 'background',
  foreground: { status: 'granted', granted: true, canAskAgain: true, accuracy: 'fine' },
  background: { status: 'denied', granted: false, canAskAgain: true, accuracy: null },
  taskManagerAvailable: true,
  taskRegistered: false,
  updatesStarted: false,
  miuiAutostart: 'disabled',
  battery: 'optimized',
  state: {
    v: 1,
    phase: 'recording',
    trip: { id: 'trip_1', source: 'auto', startedAt: NOW - 600_000, startLat: LAT, startLng: LNG, segments: 1, distanceM: 4321.4, last: fix(5) } as never,
    recent: [fix(30), fix(20)],
    fastCount: 2,
    lastClosed: { id: 'trip_0', startedAt: NOW - 7_200_000, endedAt: NOW - 3_600_000, lat: LAT, lng: LNG, startLat: LAT, startLng: LNG, distanceM: 12000.6, segments: 2 },
  },
  lastFixes: [
    { t: NOW - 20_000, acc: 8.4, speed: 12 },
    { t: NOW - 10_000, acc: null, speed: -1 },
  ],
  errors: [
    { at: '2026-10-01T14:00:00Z', where: 'trip-arm', message: 'boom' },
    { at: '2026-10-01T14:00:00Z', where: 'sync', message: 'other' },
  ],
  ...over,
});

it('never carries a coordinate, anywhere in the file', () => {
  const text = JSON.stringify(buildTripDiagnostics(input()));
  expect(text).not.toMatch(/18\.48|69\.93|"lat"|"lng"|startLat|startLng/);
});

it('says what decides Automático: mode, permissions, service, MIUI, machine timing', () => {
  const d = buildTripDiagnostics(input());
  expect(d.settings.mode).toBe('auto');
  expect(d.readiness).toBe('background');
  expect(d.permissions.background?.granted).toBe(false);
  expect(d.service.locationUpdatesStarted).toBe(false);
  expect(d.miuiAutostart).toBe('disabled');
  expect(d.batteryOptimisation).toBe('optimized');
  expect(d.machine?.phase).toBe('recording');
  expect(d.machine?.openTrip).toEqual({ source: 'auto', startedSecondsAgo: 600, segments: 1, distanceM: 4321, lastFixSecondsAgo: 5 });
  expect(d.machine?.lastClosed).toEqual({ endedSecondsAgo: 3600, durationS: 3600, distanceM: 12001, segments: 2 });
  expect(d.machine?.lastRecentFixSecondsAgo).toBe(20);
});

it('last fixes: timing, accuracy and km/h only; an invalid speed is null', () => {
  const d = buildTripDiagnostics(input());
  expect(d.lastFixes).toEqual([
    { at: '2026-10-01T14:59:40.000Z', secondsAgo: 20, accM: 8, speedKmh: 43 },
    { at: '2026-10-01T14:59:50.000Z', secondsAgo: 10, accM: null, speedKmh: null },
  ]);
});

it('keeps only trip/location/task errors; an idle machine without a state is null', () => {
  expect(buildTripDiagnostics(input()).errors.map((e) => e.where)).toEqual(['trip-arm']);
  expect(buildTripDiagnostics(input({ state: null })).machine).toBeNull();
});
