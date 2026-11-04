import { appendTrail, toRoutePoints } from '../../lib/trips/driveTrail';

jest.mock('../../lib/db/client', () => ({ getDb: jest.fn() }));

const M = 111_194.9;
/** A 1 Hz drive due north at `v` m/s from lat 18.4, `n` fixes, with the speed field set by `speed(i)`. */
function drive(v: number, n: number, speed: (i: number) => number | null, t0 = 0, y0 = 0) {
  return Array.from({ length: n }, (_, i) => ({ t: t0 + i * 1000, lat: 18.4 + (y0 + v * i) / M, lng: -69.9, speed: speed(i), acc: 5 as number | null }));
}

/**
 * The trail's colours are the SpeedEngine's speeds (lib/trips/speed.ts), the same fused numbers as the cluster and the trip card (ADR-72),
 * not a pair difference.
 */
describe('drive trail', () => {
  it('m/s → km/h from the GPS speed', () => {
    expect(toRoutePoints([{ t: 1000, lat: 18.4, lng: -69.9, speed: 10 }]).map((p) => p.speedKmh)).toEqual([36]);
  });

  it('a fix without speed (null on the web, −1 on iOS) takes its speed from the positions', () => {
    for (const none of [null, -1]) {
      const pts = toRoutePoints(drive(10, 30, () => none));
      expect(pts[29].speedKmh!).toBeGreaterThan(33);
      expect(pts[29].speedKmh!).toBeLessThan(39);
    }
  });

  it('Android’s "0 while clearly moving" is replaced by the speed the positions show', () => {
    const pts = toRoutePoints(drive(10, 40, () => 0));
    expect(pts[39].speedKmh!).toBeGreaterThan(32);
    expect(pts[39].speedKmh!).toBeLessThan(40);
  });

  it('a real stop (Doppler 0, no movement) stays 0', () => {
    const pts = toRoutePoints(drive(0, 30, () => 0));
    expect(pts[29].speedKmh).toBe(0);
  });

  it('the first row of an incremental read continues from the last point already on the map', () => {
    const all = drive(10, 40, () => null);
    const next = toRoutePoints(all.slice(30), all.slice(20, 30));
    expect(next).toHaveLength(10);
    // Coloured like a full read of the whole trail (same engine, a few seconds of context).
    const full = toRoutePoints(all);
    expect(next[0].speedKmh!).toBeCloseTo(full[30].speedKmh!, 0);
    expect(next[0].speedKmh!).toBeGreaterThan(32);
    expect(toRoutePoints([all[30]])[0].speedKmh).toBeNull(); // alone there is nothing to derive it from
  });

  it('unknown when nothing can be derived: a poor fix, or a single fix with no speed', () => {
    const pts = toRoutePoints([{ t: 0, lat: 18.4, lng: -69.9, speed: 10, acc: 5 }, { t: 1000, lat: 18.4001, lng: -69.9, speed: null, acc: 200 }]);
    expect(pts[1].speedKmh).toBeNull();
  });

  it('appends only points after the last one; nothing new keeps the same array', () => {
    const a = toRoutePoints([{ t: 1, lat: 0, lng: 0, speed: 1 }]);
    const b = appendTrail(a, toRoutePoints([{ t: 1, lat: 0, lng: 0, speed: 1 }, { t: 2, lat: 1, lng: 1, speed: 1 }]));
    expect(b.map((p) => p.t)).toEqual([1, 2]);
    expect(appendTrail(b, [])).toBe(b);
  });
});
