/** The user dot's source: only fresh, precise fixes become the dot (ADR-49). */
import { __resetMyPosition, acceptLocation, getMyPosition } from '../../lib/trips/myPosition';

jest.mock('expo-location', () => ({
  Accuracy: { High: 4 },
  getForegroundPermissionsAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
  watchPositionAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
}));
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

// ---- IMP 16102026 (M-1, M-3, M-6, M-11): "never asked" is not "refused" ------------------------------------
import { askMyLocation, permissionState, refreshMyPosition } from '../../lib/trips/myPosition';

const mockLoc = jest.requireMock('expo-location') as Record<string, jest.Mock>;

describe('permission states', () => {
  beforeEach(() => {
    __resetMyPosition();
    for (const fn of Object.values(mockLoc)) if (typeof fn?.mockReset === 'function') fn.mockReset();
    mockLoc.watchPositionAsync.mockResolvedValue({ remove: jest.fn() });
    mockLoc.getCurrentPositionAsync.mockRejectedValue(new Error('no fix'));
  });

  it('the browser\'s "prompt" (never asked) is undetermined, and nothing is watched yet', async () => {
    mockLoc.getForegroundPermissionsAsync.mockResolvedValue({ granted: false, status: 'undetermined', canAskAgain: true });
    await refreshMyPosition();
    expect(getMyPosition()).toMatchObject({ status: 'denied', permission: 'undetermined' });
    expect(mockLoc.watchPositionAsync).not.toHaveBeenCalled();
  });

  it('a refusal on a phone that can still ask is "denied"; one that cannot is "blocked"', () => {
    expect(permissionState({ granted: false, status: 'denied', canAskAgain: true })).toBe('denied');
    expect(permissionState({ granted: false, status: 'denied', canAskAgain: false })).toBe('blocked');
  });

  it('a position error that the web shim reports as {status: granted, granted: false} is still a granted permission', () => {
    expect(permissionState({ granted: false, status: 'granted', canAskAgain: true })).toBe('granted');
  });

  it('granted starts the watch with no distance filter, so a stopped car keeps sending fixes', async () => {
    mockLoc.getForegroundPermissionsAsync.mockResolvedValue({ granted: true, status: 'granted', canAskAgain: true });
    await refreshMyPosition();
    expect(getMyPosition().permission).toBe('granted');
    expect(mockLoc.watchPositionAsync).toHaveBeenCalledWith(expect.objectContaining({ timeInterval: 1000, distanceInterval: 0 }), expect.any(Function), expect.any(Function));
  });

  it('asking from a tap, when it is granted, starts the watch at once (the dot appears without leaving the screen)', async () => {
    mockLoc.requestForegroundPermissionsAsync.mockResolvedValue({ granted: true, status: 'granted', canAskAgain: true });
    mockLoc.getForegroundPermissionsAsync.mockResolvedValue({ granted: true, status: 'granted', canAskAgain: true });
    await expect(askMyLocation()).resolves.toBe('granted');
    expect(mockLoc.watchPositionAsync).toHaveBeenCalledTimes(1);
    expect(getMyPosition().permission).toBe('granted');
  });

  it('asking and being refused leaves the screen on "denied", not on an error', async () => {
    mockLoc.requestForegroundPermissionsAsync.mockResolvedValue({ granted: false, status: 'denied', canAskAgain: true });
    await expect(askMyLocation()).resolves.toBe('denied');
    expect(mockLoc.watchPositionAsync).not.toHaveBeenCalled();
  });
});
