import type { Fix } from '@/lib/trips/geo';
import { cleanTrack } from '@/lib/trips/geo';
import { stats } from '@/lib/trips/stats';
import { loadDrive } from '../helpers/tripReplay';

/** Deterministic PRNG so the noisy fixtures never flake. */
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
}

const M_PER_DEG_LAT = 110574; // at 18.5° N, close enough to move points by meters
const mLng = (lat: number) => 111320 * Math.cos((lat * Math.PI) / 180);


const fix = (t: number, lat: number, lng: number, speed: number | null, acc: number | null = 5): Fix => ({
  t,
  lat,
  lng,
  speed,
  acc,
});

/**
 * A synthetic 1 Hz drive heading east at 18.46° N:
 * 60 s parked (jitter) · 300 s at 20 m/s · 120 s stopped · 300 s at 30 m/s.
 */
function syntheticDrive(): { fixes: Fix[]; expectedM: number } {
  const r = rng(3);
  const lat = 18.46;
  const fixes: Fix[] = [];
  let x = 0; // meters east
  let t = 0;
  const push = (speed: number) => {
    const jx = (r() - 0.5) * 3;
    const jy = (r() - 0.5) * 3;
    fixes.push(fix(t * 1000, lat + jy / M_PER_DEG_LAT, -69.97 + (x + jx) / mLng(lat), speed));
  };
  for (let i = 0; i < 60; i++, t++) push(0);
  for (let i = 0; i < 300; i++, t++) {
    x += 20;
    push(20);
  }
  for (let i = 0; i < 120; i++, t++) push(0);
  for (let i = 0; i < 300; i++, t++) {
    x += 30;
    push(30);
  }
  return { fixes, expectedM: x };
}

describe('stats', () => {
  it('measures a synthetic drive: distance, moving time, averages, buckets', () => {
    const { fixes, expectedM } = syntheticDrive();
    const s = stats(fixes);
    expect(Math.abs(s.distanceM - expectedM) / expectedM).toBeLessThan(0.01); // parked jitter suppressed
    expect(s.durationS).toBe(779);
    expect(s.movingS).toBeGreaterThanOrEqual(598);
    expect(s.movingS).toBeLessThanOrEqual(606); // the engine also counts the second either side of a stop (a car rolling at 1 m/s is moving)
    expect(s.maxKmh).toBeCloseTo(108, 0);
    expect(s.avgMovingKmh!).toBeGreaterThan(85);
    expect(s.avgKmh!).toBeCloseTo((s.distanceM / 779) * 3.6, 6);
    // 72 km/h → bucket 60–90; 108 km/h → 90–120.
    expect(s.speedBuckets[2]).toBeGreaterThanOrEqual(299);
    expect(s.speedBuckets[3]).toBeGreaterThanOrEqual(299);
    const sum = s.speedBuckets.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(s.movingS, 6); // buckets are over moving time
    expect(s.bbox).not.toBeNull();
  });

  it('rejects a single top-speed spike (3-sample median)', () => {
    const { fixes } = syntheticDrive();
    const spiked = fixes.map((f, i) => (i === 200 ? { ...f, speed: 70 } : f)); // 252 km/h for one sample
    expect(stats(spiked).maxKmh).toBeCloseTo(108, 0);
  });

  it('ignores inaccurate fixes for the top speed', () => {
    const { fixes } = syntheticDrive();
    // Two neighbouring spikes would pass the median — but they are at acc 25 m.
    const spiked = fixes.map((f, i) => (i === 200 || i === 201 ? { ...f, speed: 60, acc: 25 } : f));
    expect(stats(spiked).maxKmh).toBeCloseTo(108, 0);
  });

  it('drops position jumps and bad fixes from the track and distance', () => {
    const { fixes, expectedM } = syntheticDrive();
    const jumped = fixes.map((f, i) => (i === 250 ? { ...f, lat: f.lat + 0.01 } : i === 251 ? { ...f, acc: 60 } : f));
    const s = stats(jumped);
    expect(s.track).toHaveLength(fixes.length - 2);
    expect(Math.abs(s.distanceM - expectedM) / expectedM).toBeLessThan(0.01);
  });

  it('handles unsorted and duplicate input, and tiny tracks', () => {
    const { fixes } = syntheticDrive();
    const shuffled = [...fixes].reverse().concat(fixes.slice(0, 5));
    expect(stats(shuffled).distanceM).toBeCloseTo(stats(fixes).distanceM, 6);
    const one = stats([fixes[0]]);
    expect(one).toMatchObject({ distanceM: 0, durationS: 0, movingS: 0, avgKmh: null, maxKmh: null });
    expect(cleanTrack([])).toEqual([]);
  });

  it('stats on the GPX fixture (no reported speed) match the generated route', () => {
    const s = stats(loadDrive(8));
    expect(s.distanceM).toBeGreaterThan(11_900);
    expect(s.distanceM).toBeLessThan(12_300);
    expect(s.durationS / 60).toBeGreaterThan(24);
    expect(s.durationS / 60).toBeLessThan(27);
    // 9 min of stops + parked ends are not moving time.
    expect(s.movingS / 60).toBeGreaterThan(14);
    expect(s.movingS / 60).toBeLessThan(17);
    expect(s.maxKmh!).toBeGreaterThan(85);
    expect(s.maxKmh!).toBeLessThan(100);
    expect(s.speedBuckets.reduce((a, b) => a + b, 0)).toBeCloseTo(s.movingS, 6);
    expect(s.speedBuckets[4]).toBe(0); // never over 120
  });
});

