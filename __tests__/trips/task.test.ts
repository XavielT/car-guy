/**
 * Phase 5B glue: the background task on a real SQLite, with a fake
 * TaskManager and expo-location. The GPX drive arrives in batches as Android
 * would deliver it; the trip must open by itself, survive the short stops,
 * close after the long one, and ask for the right intensities.
 */
import type { TestDb } from '../helpers/sqlite';
import { loadDrive } from '../helpers/tripReplay';

jest.mock('@/lib/db/client', () => {
  const helpers = require('../helpers/sqlite');
  const testDb = helpers.createTestDb();
  return { ...helpers.clientModule(testDb), testDb };
});

jest.mock('expo-task-manager', () => {
  const executors = new Map();
  return {
    executors,
    isAvailableAsync: jest.fn(async () => true),
    isTaskDefined: jest.fn((name: string) => executors.has(name)),
    defineTask: jest.fn((name: string, fn: unknown) => executors.set(name, fn)),
  };
});

const mockLoc = {
  started: false,
  starts: [] as { accuracy?: number; timeInterval?: number }[],
  stops: 0,
};
jest.mock('expo-location', () => ({
  Accuracy: { Lowest: 1, Low: 2, Balanced: 3, High: 4, Highest: 5, BestForNavigation: 6 },
  getForegroundPermissionsAsync: jest.fn(async () => ({ granted: true, status: 'granted', canAskAgain: true, android: { accuracy: 'fine' } })),
  requestForegroundPermissionsAsync: jest.fn(async () => ({ granted: true, status: 'granted', canAskAgain: true })),
  hasServicesEnabledAsync: jest.fn(async () => true),
  getBackgroundPermissionsAsync: jest.fn(async () => ({ granted: true, status: 'granted', canAskAgain: true })),
  hasStartedLocationUpdatesAsync: jest.fn(async () => mockLoc.started),
  startLocationUpdatesAsync: jest.fn(async (_name: string, options: { accuracy?: number; timeInterval?: number }) => {
    mockLoc.started = true;
    mockLoc.starts.push(options);
  }),
  stopLocationUpdatesAsync: jest.fn(async () => {
    mockLoc.started = false;
    mockLoc.stops++;
  }),
}));

import { AppState } from 'react-native';

import { settings as settingsRepo } from '@/lib/db/repos';
import { armAuto, disarmAuto, TRIP_TASK } from '@/lib/trips/auto';
import { getLiveTrip } from '@/lib/trips/liveStore';
import { startManualTrip, stopTrip } from '@/lib/trips/live';
import '@/lib/trips/task';

const mockExecutors = (jest.requireMock('expo-task-manager') as { executors: Map<string, (body: unknown) => Promise<unknown>> }).executors;
const db = (jest.requireMock('@/lib/db/client') as { testDb: TestDb }).testDb.sqlite;
const BALANCED = 3;
const NAV = 6;

const toLocation = (f: ReturnType<typeof loadDrive>[number]) => ({
  timestamp: f.t,
  coords: { latitude: f.lat, longitude: f.lng, speed: f.speed, accuracy: f.acc, altitude: f.alt, heading: f.heading },
});

/** The phone stays parked after the drive; at grabando (distanceInterval 0) fixes keep coming. */
function withParkedTail(fixes: ReturnType<typeof loadDrive>, minutes = 5) {
  const last = fixes[fixes.length - 1];
  const tail = Array.from({ length: (minutes * 60) / 2 }, (_, i) => ({ ...last, t: last.t + (i + 1) * 2000, speed: 0 }));
  return [...fixes, ...tail];
}

async function deliver(fixes: ReturnType<typeof loadDrive>, batch = 10) {
  const run = mockExecutors.get(TRIP_TASK)!;
  for (let i = 0; i < fixes.length; i += batch) {
    await run({ data: { locations: fixes.slice(i, i + batch).map(toLocation) }, error: null, executionInfo: { eventId: String(i), taskName: TRIP_TASK } });
  }
}

const tripRows = () =>
  db.prepare(`SELECT id, source, status, distance_m, segments, vehicle_id FROM trip ORDER BY started_at`).all() as {
    id: string;
    source: string;
    status: string;
    distance_m: number;
    segments: number;
    vehicle_id: string;
  }[];

beforeAll(async () => {
  const t = new Date().toISOString();
  db.prepare(`INSERT INTO vehicle (id, name, default_fuel_type, created_at, updated_at) VALUES ('v', 'DS3', 'regular', ?, ?)`).run(t, t);
  await settingsRepo.set('active_vehicle_id', 'v');
});

beforeEach(() => {
  db.exec(`DELETE FROM trip_point; DELETE FROM trip; DELETE FROM trip_state`);
  mockLoc.started = false;
  mockLoc.starts = [];
  mockLoc.stops = 0;
});

it('defines the task at module scope', () => {
  expect(mockExecutors.has(TRIP_TASK)).toBe(true);
});

it('arming is idempotent, only in Automático, and disarming stops the service', async () => {
  await settingsRepo.set('trips_enabled', 'manual');
  expect(await armAuto()).toBe(false);
  expect(mockLoc.starts).toHaveLength(0);

  await settingsRepo.set('trips_enabled', 'auto');
  expect(await armAuto()).toBe(true);
  expect(await armAuto()).toBe(true);
  expect(mockLoc.starts).toHaveLength(1);
  expect(mockLoc.starts[0].accuracy).toBe(BALANCED);

  await disarmAuto();
  await disarmAuto();
  expect(mockLoc.stops).toBe(1);
  expect(mockLoc.started).toBe(false);
});

it('records the GPX drive from background batches: one trip through the 2-min stops, merged over the 5-min one, closed when parked', async () => {
  await settingsRepo.set('trips_enabled', 'auto');
  await armAuto();
  await deliver(withParkedTail(loadDrive(8)));

  const rows = tripRows();
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ source: 'auto', status: 'done', vehicle_id: 'v', segments: 2 });
  expect(rows[0].distance_m).toBeGreaterThan(11_500);
  expect(rows[0].distance_m).toBeLessThan(12_500);
  // vigilando → grabando → (5-min stop) vigilando → grabando (merge) → vigilando
  expect(mockLoc.starts.map((o) => o.accuracy)).toEqual([BALANCED, NAV, BALANCED, NAV, BALANCED]);
  expect(getLiveTrip()).toBeNull();
  const state = JSON.parse((db.prepare(`SELECT json FROM trip_state`).get() as { json: string }).json);
  expect(state.phase).toBe('idle');
  await disarmAuto();
});

it('"Iniciar viaje" while Automático watches adopts the stream: one manual trip, the task feeds it', async () => {
  await settingsRepo.set('trips_enabled', 'auto');
  await armAuto();
  const drive = loadDrive();
  await deliver(drive.slice(0, 5)); // parked: nothing opens yet
  const clock = jest.spyOn(Date, 'now').mockReturnValue(drive[5].t - 500);
  expect(await startManualTrip('v')).toEqual({ ok: true });
  expect(mockLoc.starts.at(-1)?.accuracy).toBe(NAV);
  await deliver(drive.slice(5, 400));
  expect(getLiveTrip()?.tripId).toBe(tripRows()[0].id);

  clock.mockReturnValue(drive[399].t + 500);
  const stop = await stopTrip();
  clock.mockRestore();
  expect(stop.kind).toBe('saved');
  const rows = tripRows();
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ source: 'manual', status: 'done' });
  expect(mockLoc.starts.at(-1)?.accuracy).toBe(BALANCED);
  await disarmAuto();
});

it('leaving Automático closes an open automatic trip instead of leaving it hanging', async () => {
  await settingsRepo.set('trips_enabled', 'auto');
  await armAuto();
  await deliver(loadDrive().slice(0, 300));
  expect(tripRows()[0]?.status).toBe('recording');
  await settingsRepo.set('trips_enabled', 'manual');
  expect(await armAuto()).toBe(false);
  expect(tripRows()[0].status).toBe('done');
  expect(mockLoc.started).toBe(false);
});

it('a background switch that fails falls back to the single configuration for good', async () => {
  const Location = jest.requireMock('expo-location') as { startLocationUpdatesAsync: jest.Mock };
  await settingsRepo.set('trips_enabled', 'auto');
  await settingsRepo.set('trips_single_config', 0);
  await armAuto();
  const was = AppState.currentState;
  (AppState as { currentState: string }).currentState = 'background';
  Location.startLocationUpdatesAsync.mockImplementationOnce(async () => {
    throw new Error('SecurityException');
  });
  await deliver(loadDrive(8).slice(0, 300));
  (AppState as { currentState: string }).currentState = was;
  expect(await settingsRepo.get('trips_single_config', 0)).toBe(1);
  expect(mockLoc.starts.at(-1)).toMatchObject({ accuracy: 4, timeInterval: 2000 });
  expect(tripRows()[0]?.status).toBe('recording');
  await settingsRepo.set('trips_single_config', 0);
  await disarmAuto();
});
