/** The user dot's source: only fresh, precise fixes become the dot (ADR-49). */
import { __resetMyPosition, acceptLocation, getMyPosition } from '../../lib/trips/myPosition';

jest.mock('expo-location', () => ({ Accuracy: { High: 4 }, watchPositionAsync: jest.fn(), getCurrentPositionAsync: jest.fn() }));
jest.mock('../../lib/permissions/impl', () => ({
  impl: { location_foreground: { check: jest.fn(), request: jest.fn() } },
  openAppSettings: jest.fn(),
  rawLocationPermissions: jest.fn(),
}));
jest.mock('../../lib/map/lastFix', () => ({ saveLastFix: jest.fn() }));
jest.mock('../../lib/diagnostics', () => ({ recordError: jest.fn() }));

const NOW = 1_790_000_000_000;
const loc = (dtS: number, acc: number | null, heading: number | null = 90) =>
  ({ timestamp: NOW - dtS * 1000, coords: { latitude: 18.47, longitude: -69.93, accuracy: acc, heading } }) as never;

beforeEach(() => __resetMyPosition());

it('a fresh precise fix is the dot', () => {
  acceptLocation(loc(2, 8), NOW);
  expect(getMyPosition().status).toBe('ok');
  expect(getMyPosition().fix).toMatchObject({ acc: 8, heading: 90, t: NOW - 2000 });
});

it("a cached fix from hours ago is ignored — no dot where the phone was this morning", () => {
  acceptLocation(loc(3 * 3600, 10), NOW);
  expect(getMyPosition().fix).toBeNull();
  expect(getMyPosition().approx).toBeNull();
});

it('a stale fix after a good one keeps the last good dot (the UI greys it by age)', () => {
  acceptLocation(loc(1, 8), NOW);
  acceptLocation(loc(600, 5), NOW);
  expect(getMyPosition().fix?.t).toBe(NOW - 1000);
});

it('a coarse fix is a halo, never the dot', () => {
  acceptLocation(loc(1, 420), NOW);
  expect(getMyPosition().fix).toBeNull();
  expect(getMyPosition().approx?.acc).toBe(420);
});

it('an invalid heading (−1) hides the arrow', () => {
  acceptLocation(loc(1, 8, -1), NOW);
  expect(getMyPosition().fix?.heading).toBeNull();
});


// ---- IMP 16102026 (M-1, M-3, M-5, M-11): the registry's permission drives the watch ------------------------------
import React from 'react';
import { act, create } from 'react-test-renderer';

import { __resetPermissions, requestPermission } from '../../lib/permissions/store';
import { refreshMyPosition, useMyPosition } from '../../lib/trips/myPosition';

const mockImpl = (jest.requireMock('../../lib/permissions/impl') as { impl: { location_foreground: { check: jest.Mock; request: jest.Mock } } }).impl.location_foreground;
const mockLoc = jest.requireMock('expo-location') as { watchPositionAsync: jest.Mock; getCurrentPositionAsync: jest.Mock };

function Probe() {
  useMyPosition(true);
  return null;
}
const flush = () => act(async () => {});

describe('the watch follows the permission', () => {
  beforeEach(() => {
    __resetMyPosition();
    __resetPermissions();
    mockImpl.check.mockReset();
    mockImpl.request.mockReset();
    mockLoc.watchPositionAsync.mockReset().mockResolvedValue({ remove: jest.fn() });
    mockLoc.getCurrentPositionAsync.mockReset().mockRejectedValue(new Error('no fix'));
  });

  it("never asked: permission is undetermined, no watch, and the screen is told to offer 'Activar'", async () => {
    mockImpl.check.mockResolvedValue({ status: 'undetermined' });
    await refreshMyPosition();
    expect(getMyPosition()).toMatchObject({ status: 'denied', permission: 'undetermined' });
    expect(mockLoc.watchPositionAsync).not.toHaveBeenCalled();
  });

  it('granted: the watch has no distance filter, so a stopped car keeps sending fixes (M-11)', async () => {
    mockImpl.check.mockResolvedValue({ status: 'granted' });
    await refreshMyPosition();
    expect(getMyPosition().permission).toBe('granted');
    expect(mockLoc.watchPositionAsync).toHaveBeenCalledWith(expect.objectContaining({ timeInterval: 1000, distanceInterval: 0 }), expect.any(Function), expect.any(Function));
  });

  it('services off and unavailable are not a watch either', async () => {
    mockImpl.check.mockResolvedValue({ status: 'services_off' });
    await refreshMyPosition();
    expect(getMyPosition()).toMatchObject({ status: 'denied', permission: 'services_off' });
    expect(mockLoc.watchPositionAsync).not.toHaveBeenCalled();
  });

  it('granted from a chip while the screen is open starts the watch by itself (M-3)', async () => {
    mockImpl.check.mockResolvedValue({ status: 'undetermined' });
    let tree!: ReturnType<typeof create>;
    await act(async () => {
      tree = create(React.createElement(Probe));
    });
    await flush();
    expect(getMyPosition().permission).toBe('undetermined');
    expect(mockLoc.watchPositionAsync).not.toHaveBeenCalled();

    // The person taps the chip, reads the primer and allows: the registry asks and the state changes.
    mockImpl.request.mockResolvedValue({ status: 'granted' });
    mockImpl.check.mockResolvedValue({ status: 'granted' });
    await act(async () => {
      await requestPermission('location_foreground');
    });
    await flush();
    expect(getMyPosition().permission).toBe('granted');
    expect(mockLoc.watchPositionAsync).toHaveBeenCalledTimes(1);
    act(() => tree.unmount());
  });

  it('permission taken away while it runs: the dot and the watch go', async () => {
    mockImpl.check.mockResolvedValue({ status: 'granted' });
    let tree!: ReturnType<typeof create>;
    await act(async () => {
      tree = create(React.createElement(Probe));
    });
    await flush();
    acceptLocation(loc(1, 8), Date.now());
    mockImpl.check.mockResolvedValue({ status: 'denied_blocked' });
    await act(async () => {
      await requestPermission('location_foreground');
    });
    expect(getMyPosition()).toMatchObject({ status: 'denied', permission: 'denied_blocked', fix: null });
    act(() => tree.unmount());
  });

  it('a failed read says why: the browser\'s codes are told apart (M-5)', async () => {
    mockImpl.check.mockResolvedValue({ status: 'granted' });
    await refreshMyPosition();
    const onError = mockLoc.watchPositionAsync.mock.calls[0][2] as (r: string) => void;
    act(() => onError('Timeout expired'));
    expect(getMyPosition()).toMatchObject({ status: 'error', error: 'timeout' });
    act(() => onError('geolocation error 2'));
    expect(getMyPosition().error).toBe('unavailable');
  });

  it('a good fix clears the error', async () => {
    mockImpl.check.mockResolvedValue({ status: 'granted' });
    await refreshMyPosition();
    const onError = mockLoc.watchPositionAsync.mock.calls[0][2] as (r: string) => void;
    act(() => onError('Timeout expired'));
    acceptLocation({ timestamp: Date.now(), coords: { latitude: 18.47, longitude: -69.93, accuracy: 8, heading: 90 } } as never);
    expect(getMyPosition()).toMatchObject({ status: 'ok', error: null });
  });
});
