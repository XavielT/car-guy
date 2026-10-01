import { appendTrail, toRoutePoints } from '../../lib/trips/driveTrail';

jest.mock('../../lib/db/client', () => ({ getDb: jest.fn() }));

describe('drive trail', () => {
  it('m/s → km/h from the GPS speed', () => {
    expect(toRoutePoints([{ t: 1000, lat: 18.4, lng: -69.9, speed: 10 }]).map((p) => p.speedKmh)).toEqual([36]);
  });

  it('a fix without speed takes distance ÷ time from the one before (as the trip detail does)', () => {
    // ~111 m north in 10 s ≈ 40 km/h; null (web) and −1 (iOS) both derive.
    const pts = toRoutePoints([
      { t: 0, lat: 18.4, lng: -69.9, speed: 10, acc: 5 },
      { t: 10_000, lat: 18.401, lng: -69.9, speed: null, acc: 5 },
      { t: 20_000, lat: 18.402, lng: -69.9, speed: -1, acc: 5 },
    ]);
    expect(pts[1].speedKmh).toBeCloseTo(40, 0);
    expect(pts[2].speedKmh).toBeCloseTo(40, 0);
  });

  it("Android's no-speed 0 while clearly moving is replaced by the derived speed", () => {
    const pts = toRoutePoints([
      { t: 0, lat: 18.4, lng: -69.9, speed: 10, acc: 5 },
      { t: 10_000, lat: 18.401, lng: -69.9, speed: 0, acc: 5 },
    ]);
    expect(pts[1].speedKmh).toBeCloseTo(40, 0);
  });

  it('the first row of an incremental read derives from the last point already on the map', () => {
    const prev = { t: 0, lat: 18.4, lng: -69.9, speed: 10, acc: 5 };
    expect(toRoutePoints([{ t: 10_000, lat: 18.401, lng: -69.9, speed: null, acc: 5 }], prev)[0].speedKmh).toBeCloseTo(40, 0);
    expect(toRoutePoints([{ t: 10_000, lat: 18.401, lng: -69.9, speed: null, acc: 5 }])[0].speedKmh).toBeNull();
  });

  it('still unknown when nothing can be derived (a gap over 30 s, a poor fix)', () => {
    const pts = toRoutePoints([
      { t: 0, lat: 18.4, lng: -69.9, speed: 10, acc: 5 },
      { t: 60_000, lat: 18.401, lng: -69.9, speed: null, acc: 5 },
      { t: 61_000, lat: 18.4011, lng: -69.9, speed: null, acc: 200 },
    ]);
    expect(pts[1].speedKmh).toBeNull();
    expect(pts[2].speedKmh).toBeNull();
  });
  it('appends only points after the last one; nothing new keeps the same array', () => {
    const a = toRoutePoints([{ t: 1, lat: 0, lng: 0, speed: 1 }]);
    const b = appendTrail(a, toRoutePoints([{ t: 1, lat: 0, lng: 0, speed: 1 }, { t: 2, lat: 1, lng: 1, speed: 1 }]));
    expect(b.map((p) => p.t)).toEqual([1, 2]);
    expect(appendTrail(b, [])).toBe(b);
  });
});
