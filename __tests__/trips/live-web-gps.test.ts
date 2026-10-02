/**
 * The iPhone drive of 2026-10-02: on the web, "Iniciar viaje" must ask the browser for the precise GPS.
 * Without enableHighAccuracy Safari answers from Wi-Fi/cell (≈ 65 m, no speed), the machine drops every fix over
 * 30 m and the trip ends "muy corto (0 m)".
 */
const mockWatchPositionAsync = jest.fn(async () => ({ remove: jest.fn() }));

jest.mock('expo-location', () => ({
  Accuracy: { High: 4, BestForNavigation: 6 },
  getForegroundPermissionsAsync: jest.fn(async () => ({ granted: true, canAskAgain: true })),
  requestForegroundPermissionsAsync: jest.fn(),
  hasServicesEnabledAsync: jest.fn(async () => true),
  watchPositionAsync: (...args: unknown[]) => mockWatchPositionAsync(...(args as [])),
}));
jest.mock('../../lib/diagnostics', () => ({ recordError: jest.fn() }));
jest.mock('../../lib/trips/auto', () => ({ isAutoArmed: jest.fn(async () => false), switchIntensity: jest.fn() }));
jest.mock('../../lib/trips/engine', () => ({
  feed: jest.fn(async () => ({ applied: [] })),
  machineState: jest.fn(async () => ({ phase: 'idle', trip: null })),
  pushLiveFix: jest.fn(),
}));
jest.mock('../../lib/trips/liveStore', () => ({ getLiveTrip: () => null }));

import { startManualTrip, stopTrip } from '../../lib/trips/live';
import { WEB_PRECISE_GPS } from '../../lib/trips/webGeo';

afterEach(async () => {
  await stopTrip();
});

it('the trip watch carries the W3C keys a browser reads', async () => {
  await expect(startManualTrip('veh_1')).resolves.toEqual({ ok: true });
  const [options, , onError] = mockWatchPositionAsync.mock.calls[0] as unknown as [Record<string, unknown>, unknown, unknown];
  expect(options).toMatchObject({ enableHighAccuracy: true, maximumAge: 0, timeout: 20_000 });
  // The native keys stay for Android.
  expect(options).toMatchObject({ accuracy: 6, timeInterval: 1000, distanceInterval: 3 });
  expect(typeof onError).toBe('function');
});

it('WEB_PRECISE_GPS never accepts a cached position', () => {
  expect(WEB_PRECISE_GPS).toEqual({ enableHighAccuracy: true, maximumAge: 0, timeout: 20_000 });
});
