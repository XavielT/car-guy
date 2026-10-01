/** The user dot's source: only fresh, precise fixes become the dot (ADR-49). */
import { __resetMyPosition, acceptLocation, getMyPosition } from '../../lib/trips/myPosition';

jest.mock('expo-location', () => ({ Accuracy: { High: 4 } }));
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
