import {
  bbox,
  bucketIndex,
  cleanTrack,
  decodePolyline,
  effectiveSpeed,
  encodePolyline,
  haversine,
  project,
  projector,
  simplify,
  type Fix,
} from '@/lib/trips/geo';
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

describe('haversine', () => {
  // References: WGS84 geodesic (Vincenty); the sphere stays within 0.5 %.
  it('Parque Colón (Santo Domingo) → Monumento de Santiago ≈ 137.8 km', () => {
    const d = haversine({ lat: 18.4733, lng: -69.884 }, { lat: 19.4508, lng: -70.6947 });
    expect(Math.abs(d - 137829) / 137829).toBeLessThan(0.005);
  });

  it('Plaza de la Bandera → 27 de Febrero / Churchill ≈ 3.59 km', () => {
    const d = haversine({ lat: 18.4497, lng: -69.97 }, { lat: 18.464, lng: -69.9395 });
    expect(Math.abs(d - 3589.5) / 3589.5).toBeLessThan(0.005);
  });

  it('is 0 for the same point and symmetric', () => {
    const a = { lat: 18.47, lng: -69.93 };
    const b = { lat: 18.48, lng: -69.91 };
    expect(haversine(a, a)).toBe(0);
    expect(haversine(a, b)).toBeCloseTo(haversine(b, a), 9);
  });
});

describe('projection', () => {
  it('round-trips and measures meters like haversine at city scale', () => {
    const o = { lat: 18.46, lng: -69.94 };
    const p = { lat: 18.47, lng: -69.925 };
    const { toXY, toLatLng } = projector(o);
    const xy = toXY(p);
    expect(Math.hypot(xy.x, xy.y)).toBeCloseTo(haversine(o, p), -1); // within ~5 m over ~2 km
    const back = toLatLng(xy);
    expect(back.lat).toBeCloseTo(p.lat, 10);
    expect(back.lng).toBeCloseTo(p.lng, 10);
  });

  it('project() centres on the centroid', () => {
    const xy = project([
      { lat: 18.4, lng: -69.9 },
      { lat: 18.5, lng: -69.8 },
    ]);
    expect(xy[0].x + xy[1].x).toBeCloseTo(0, 6);
    expect(xy[0].y + xy[1].y).toBeCloseTo(0, 6);
  });
});

describe('simplify (Douglas–Peucker, meters)', () => {
  it('cuts a noisy straight 5 km line by ≥ 80 % and keeps both ends', () => {
    const r = rng(7);
    const lat0 = 18.46;
    const pts = Array.from({ length: 1000 }, (_, i) => ({
      lat: lat0 + ((r() - 0.5) * 4) / M_PER_DEG_LAT, // ±2 m across
      lng: -69.97 + (i * 5) / mLng(lat0),
    }));
    const out = simplify(pts, 8);
    expect(out.length).toBeLessThanOrEqual(200);
    expect(out[0]).toBe(pts[0]);
    expect(out[out.length - 1]).toBe(pts[pts.length - 1]);
  });

  it('keeps a real corner', () => {
    const pts = [
      { lat: 18.46, lng: -69.97 },
      { lat: 18.46, lng: -69.96 },
      { lat: 18.47, lng: -69.96 },
    ];
    expect(simplify(pts, 8)).toHaveLength(3);
  });

  it('never deviates more than the tolerance from the original', () => {
    const r = rng(11);
    const pts = Array.from({ length: 400 }, (_, i) => ({
      lat: 18.46 + (Math.sin(i / 20) * 300 + (r() - 0.5) * 6) / M_PER_DEG_LAT,
      lng: -69.97 + (i * 5) / mLng(18.46),
    }));
    const out = simplify(pts, 8);
    expect(out.length).toBeLessThan(pts.length / 2);
    // Every dropped point lies within ~8 m of the simplified path.
    const xyAll = project(pts, pts[0]);
    const kept = new Set(out);
    const xyKept = project(out, pts[0]);
    const dist = (p: { x: number; y: number }) => {
      let best = Infinity;
      for (let k = 1; k < xyKept.length; k++) {
        const a = xyKept[k - 1];
        const b = xyKept[k];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)));
        best = Math.min(best, Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy));
      }
      return best;
    };
    pts.forEach((p, i) => {
      if (!kept.has(p)) expect(dist(xyAll[i])).toBeLessThanOrEqual(8.01);
    });
  });
});

describe('encoded polyline', () => {
  it('matches Google’s documented example', () => {
    const pts = [
      { lat: 38.5, lng: -120.2 },
      { lat: 40.7, lng: -120.95 },
      { lat: 43.252, lng: -126.453 },
    ];
    expect(encodePolyline(pts)).toBe('_p~iF~ps|U_ulLnnqC_mqNvxq`@');
    expect(decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@')).toEqual(pts);
  });

  it('round-trips a drive to 1e-5°', () => {
    const drive = loadDrive();
    const back = decodePolyline(encodePolyline(drive));
    expect(back).toHaveLength(drive.length);
    back.forEach((p, i) => {
      expect(Math.abs(p.lat - drive[i].lat)).toBeLessThanOrEqual(0.000005 + 1e-12);
      expect(Math.abs(p.lng - drive[i].lng)).toBeLessThanOrEqual(0.000005 + 1e-12);
    });
  });

  it('handles empty and precision 6', () => {
    expect(encodePolyline([])).toBe('');
    expect(decodePolyline('')).toEqual([]);
    const p = [{ lat: 18.123456, lng: -69.654321 }];
    expect(decodePolyline(encodePolyline(p, 6), 6)).toEqual(p);
  });
});

describe('bbox', () => {
  it('is [minLat, minLng, maxLat, maxLng]', () => {
    expect(
      bbox([
        { lat: 18.5, lng: -69.9 },
        { lat: 18.4, lng: -69.8 },
        { lat: 18.45, lng: -70 },
      ]),
    ).toEqual([18.4, -70, 18.5, -69.8]);
    expect(bbox([])).toBeNull();
  });
});

const fix = (t: number, lat: number, lng: number, speed: number | null, acc: number | null = 5): Fix => ({
  t,
  lat,
  lng,
  speed,
  acc,
});

describe('effectiveSpeed', () => {
  const lat = 18.46;
  const a = fix(0, lat, -69.97, null);
  const b20 = fix(1000, lat, -69.97 + 20 / mLng(lat), null); // 20 m in 1 s

  it('uses the reported speed when there is one', () => {
    expect(effectiveSpeed(a, { ...b20, speed: 19 })).toBe(19);
  });

  it('falls back to displacement ÷ Δt when speed is null (web) or negative (iOS)', () => {
    expect(effectiveSpeed(a, b20)).toBeCloseTo(20, 0);
    expect(effectiveSpeed(a, { ...b20, speed: -1 })).toBeCloseTo(20, 0);
  });

  it('treats Android’s 0 while clearly moving as unknown', () => {
    expect(effectiveSpeed(a, { ...b20, speed: 0 })).toBeCloseTo(20, 0);
  });

  it('keeps a real 0 when the displacement is jitter', () => {
    const jitter = fix(1000, lat + 3 / M_PER_DEG_LAT, -69.97, 0);
    expect(effectiveSpeed(a, jitter)).toBe(0);
  });

  it('returns null without a usable reference', () => {
    expect(effectiveSpeed(null, b20)).toBeNull();
    expect(effectiveSpeed({ ...a, t: -60_000 }, b20)).toBeNull(); // Δt > 30 s
    expect(effectiveSpeed(a, { ...b20, acc: 80 })).toBeNull(); // too inaccurate
  });
});

describe('bucketIndex', () => {
  it('splits at 30/60/90/120 km/h', () => {
    expect([0, 29.9, 30, 59, 60, 89, 90, 119, 120, 180].map(bucketIndex)).toEqual([0, 0, 1, 1, 2, 2, 3, 3, 4, 4]);
  });
});

describe('dropExcursions (a track flipping between two position sources)', () => {
  const { cleanTrack: clean } = jest.requireActual('@/lib/trips/geo') as typeof import('@/lib/trips/geo');
  const { stats: st } = jest.requireActual('@/lib/trips/stats') as typeof import('@/lib/trips/stats');
  // A straight drive east at ~15 m/s, one fix every 10 s (≈150 m apart).
  const drive = Array.from({ length: 30 }, (_, i) => ({ t: i * 10_000, lat: 18.45, lng: -69.97 + i * 0.00142, speed: 15, acc: 5, alt: null, heading: null }));

  it('drops a detour to a place ~3 km away and back, however slow each leg', () => {
    // Batched fixes a minute apart (vigilando): 2.8 km out in 60 s is 46 m/s — under the
    // 70 m/s jump filter, over what any car turns around at.
    const slow = drive.map((p, i) => ({ ...p, t: i * 60_000 }));
    const noisy = slow.slice();
    for (const k of [10, 11, 12]) noisy[k] = { ...noisy[k], lat: 18.475 };
    const { isJump: jump } = jest.requireActual('@/lib/trips/geo') as typeof import('@/lib/trips/geo');
    expect(jump(noisy[9], noisy[10])).toBe(false); // the old rule alone keeps it
    const kept = clean(noisy);
    expect(kept.some((p) => p.lat === 18.475)).toBe(false);
    expect(st(noisy).distanceM).toBeLessThan(st(slow).distanceM * 1.05);
  });

  it('keeps a real U-turn (a retorno) at city speed', () => {
    const uturn = [
      ...Array.from({ length: 10 }, (_, i) => ({ t: i * 10_000, lat: 18.45, lng: -69.97 + i * 0.00095, speed: 10, acc: 5, alt: null, heading: null })),
      ...Array.from({ length: 10 }, (_, i) => ({ t: (10 + i) * 10_000, lat: 18.4501, lng: -69.97 + (9 - i) * 0.00095, speed: 10, acc: 5, alt: null, heading: null })),
    ];
    expect(clean(uturn)).toHaveLength(uturn.length);
  });

  it('leaves a normal drive alone', () => {
    expect(clean(drive)).toHaveLength(drive.length);
  });
});
