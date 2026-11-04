/** lib/trips/speed.ts — the SpeedEngine's rules one by one (SPEC-I §I1), on small hand-made streams. */
import type { Fix } from '@/lib/trips/geo';
import { SpeedEngine, analyzeFixes, segmentSpeedsKmh } from '@/lib/trips/speed';
import { stats } from '@/lib/trips/stats';
import { simulate } from '../helpers/speed/simDrive';

const M = 111_194.9;
/** Fixes of a car driving east at `v` m/s for `n` seconds from t0, 1 Hz, Doppler optional. */
function cruise(v: number, n: number, t0 = 0, x0 = 0, o: { speed?: number | null; acc?: number } = {}): Fix[] {
  const lat = 18.46;
  const mLng = M * Math.cos((lat * Math.PI) / 180);
  return Array.from({ length: n }, (_, i) => ({ t: 1_700_000_000_000 + (t0 + i) * 1000, lat, lng: -69.97 + (x0 + v * i) / mLng, speed: o.speed === undefined ? v : o.speed, acc: o.acc ?? 5 }));
}

describe('top speed is sustained, never a spike', () => {
  it('a single 250 km/h Doppler sample is not the top; the real cruise is', () => {
    const f = cruise(25, 40);
    f[20] = { ...f[20], speed: 70 };
    const { summary } = analyzeFixes(f);
    expect(summary.topKmh!).toBeCloseTo(90, 0);
  });
  it('two bad-accuracy neighbours (acc 25 m) cannot set it either', () => {
    const f = cruise(25, 40);
    f[20] = { ...f[20], speed: 60, acc: 25 };
    f[21] = { ...f[21], speed: 60, acc: 25 };
    expect(analyzeFixes(f).summary.topKmh!).toBeCloseTo(90, 0);
  });
  it('needs ≥ 2 s: a 1 s blip of a faster speed does not count, 3 s of it does', () => {
    const slow = cruise(20, 40);
    const blip = slow.map((p, i) => (i === 20 ? { ...p, speed: 30 } : p));
    expect(analyzeFixes(blip).summary.topKmh!).toBeLessThan(80);
    const held = slow.map((p, i) => (i >= 20 && i <= 23 ? { ...p, speed: 30 } : p));
    expect(analyzeFixes(held).summary.topKmh!).toBeGreaterThan(95);
  });
  it('with only poor fixes the top speed is still given, but marked approximate', () => {
    const { summary } = analyzeFixes(cruise(20, 40, 0, 0, { acc: 35 }));
    expect(summary.topKmh!).toBeCloseTo(72, 0);
    expect(summary.topApprox).toBe(true);
    expect(analyzeFixes(cruise(20, 40)).summary.topApprox).toBe(false);
  });
});

describe('stop logic', () => {
  it('a parked phone wandering inside its error circle shows 0 and adds no distance', () => {
    const lat = 18.46;
    const f: Fix[] = Array.from({ length: 60 }, (_, i) => ({ t: 1_700_000_000_000 + i * 1000, lat: lat + (Math.sin(i) * 3) / M, lng: -69.97 + (Math.cos(i * 1.3) * 3) / M, speed: 0, acc: 8 }));
    const { samples, summary } = analyzeFixes(f);
    expect(samples.slice(5).every((s) => s.displayKmh === 0)).toBe(true);
    expect(summary.distanceM).toBeLessThan(2);
    expect(summary.movingS).toBe(0);
  });
  it('a real stop from motion reaches 0 within a few fixes and a start leaves 0 at once with a Doppler', () => {
    const f = [...cruise(15, 10), ...cruise(0, 12, 10, 135, { speed: 0 }), ...cruise(10, 8, 22, 135)];
    const { samples } = analyzeFixes(f);
    expect(samples[14].displayKmh).toBe(0);
    expect(samples[samples.length - 1].displayKmh).toBeGreaterThan(30);
  });
  it('a Doppler of exactly 0 right after a stop is not mistaken for Android’s always-0 bug', () => {
    const { samples } = analyzeFixes([...cruise(20, 15), ...cruise(0, 8, 15, 280, { speed: 0 }), ...cruise(12, 10, 23, 280)]);
    // After the stop the Doppler is still trusted (not "estimated"), and the car is read as moving at ~43 km/h.
    const last = samples[samples.length - 1];
    expect(last.estimated).toBe(false);
    expect(last.ms * 3.6).toBeGreaterThan(40);
  });
});

describe('platforms without a usable speed', () => {
  it('Android "0 while moving": speed and distance come from the positions', () => {
    const { samples, summary } = analyzeFixes(cruise(20, 60, 0, 0, { speed: 0 }));
    expect(samples[samples.length - 1].ms * 3.6).toBeGreaterThan(65);
    // The first ~4 s are lost to the fake zeros before the engine notices them: ~7 % of a 60 s drive, and only at the start.
    expect(summary.distanceM).toBeGreaterThan(1050);
    expect(samples[samples.length - 1].estimated).toBe(true);
  });
  it('iOS −1 and the web’s null are "estimated" and still within a few km/h at cruise', () => {
    for (const speed of [-1, null]) {
      const { samples } = analyzeFixes(cruise(25, 60, 0, 0, { speed }));
      const last = samples[samples.length - 1];
      expect(last.estimated).toBe(true);
      expect(Math.abs(last.ms * 3.6 - 90)).toBeLessThan(4);
    }
  });
});

describe('gates', () => {
  it('a fix worse than 50 m, a repeated timestamp and a teleport are rejected', () => {
    const eng = new SpeedEngine();
    const f = cruise(20, 5);
    for (const p of f) expect(eng.push(p)).not.toBeNull();
    expect(eng.push({ ...f[4], t: f[4].t + 1000, acc: 80 })).toBeNull();
    expect(eng.push({ ...f[4] })).toBeNull();
    expect(eng.push({ ...f[4], t: f[4].t + 2000, lat: f[4].lat + 0.05 })).toBeNull();
  });
  it('a gap (a tunnel) restarts the filter and adds the straight chord to the distance', () => {
    const before = cruise(20, 20);
    const after = cruise(20, 20, 40, 20 * 40);
    const { summary } = analyzeFixes([...before, ...after]);
    // 19 s + 19 s of driving + the 20 s chord: ≈ 20 m/s × 58 s.
    expect(summary.distanceM).toBeGreaterThan(1100);
    expect(summary.distanceM).toBeLessThan(1230);
  });
});

describe('moving vs total average', () => {
  it('the moving average is higher than the total one when the car sat still, and both are labelled by what they divide', () => {
    const f = [...cruise(0, 30, 0, 0, { speed: 0 }), ...cruise(20, 60, 30, 0), ...cruise(0, 30, 90, 1180, { speed: 0 })];
    const { summary } = analyzeFixes(f);
    expect(summary.avgMovingKmh!).toBeGreaterThan(summary.avgKmh! * 1.5);
    expect(summary.movingS).toBeGreaterThan(55);
    expect(summary.movingS).toBeLessThan(70);
  });
});

describe('ONE implementation: live = saved = map', () => {
  it('feeding fixes one by one (the live path) gives exactly the saved trip’s top speed and distance', () => {
    for (const profile of ['highway', 'city', 'hardBrake'] as const) {
      const sim = simulate({ profile, seed: 5 });
      const live = new SpeedEngine();
      for (const f of sim.fixes) live.push(f);
      const saved = stats(sim.fixes);
      expect(live.summary().topKmh).toBe(saved.maxKmh);
      expect(live.summary().distanceM).toBeCloseTo(saved.distanceM, 6);
    }
  });
  it('the map’s segment speeds are the engine’s fused speeds, smoothed over ±2 fixes, aligned with the input', () => {
    const f = cruise(20, 30);
    const v = segmentSpeedsKmh(f);
    expect(v).toHaveLength(30);
    expect(v[20]!).toBeCloseTo(72, 0);
    expect(segmentSpeedsKmh([f[0], f[0]])[1]).toBeNull(); // a repeated timestamp has no speed
  });
});
