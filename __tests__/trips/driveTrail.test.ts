import { appendTrail, toRoutePoints } from '../../lib/trips/driveTrail';

jest.mock('../../lib/db/client', () => ({ getDb: jest.fn() }));

describe('drive trail', () => {
  it('m/s → km/h; a missing or negative speed is unknown', () => {
    expect(
      toRoutePoints([
        { t: 1, lat: 18.4, lng: -69.9, speed: 10 },
        { t: 2, lat: 18.5, lng: -69.8, speed: null },
        { t: 3, lat: 18.6, lng: -69.7, speed: -1 },
      ]).map((p) => p.speedKmh),
    ).toEqual([36, null, null]);
  });
  it('appends only points after the last one; nothing new keeps the same array', () => {
    const a = toRoutePoints([{ t: 1, lat: 0, lng: 0, speed: 1 }]);
    const b = appendTrail(a, toRoutePoints([{ t: 1, lat: 0, lng: 0, speed: 1 }, { t: 2, lat: 1, lng: 1, speed: 1 }]));
    expect(b.map((p) => p.t)).toEqual([1, 2]);
    expect(appendTrail(b, [])).toBe(b);
  });
});
