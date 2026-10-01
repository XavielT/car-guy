/**
 * IMP 30092026 Phase 4 (ADR-41/42): the route GeoJSON the MapLibre maps draw —
 * speed-bucket segments with shared joints, the colour expression matching the
 * app's bucket colours, bounds/fit maths, heat sampling, the live trail split —
 * and the map style health check (lib/map/config.ts).
 */
import {
  cameraFit,
  committedLength,
  endpointFeatures,
  padBounds,
  routeBounds,
  routePointsFromDrawn,
  routeSegments,
  sampleAlong,
  speedBucket,
  speedColorExpression,
  tailStart,
  UNKNOWN_SPEED_COLOR,
  type RoutePoint,
} from '@/lib/trips/geojson';
import { haversine, type Fix } from '@/lib/trips/geo';
import { BUCKET_COLORS } from '@/lib/trips/present';
import { cachedMapStyle, maptilerDark, OPENFREEMAP_DARK, resetMapStyleCache, resolveMapStyle, styleCandidates } from '@/lib/map/config';

const P = (lng: number, lat: number, speedKmh: number | null): RoutePoint => ({ lat, lng, speedKmh });

describe('speedBucket', () => {
  it('uses the app bucket edges (<30 · 30–60 · 60–90 · 90–120 · 120+), -1 unknown', () => {
    expect([0, 29.9, 30, 59, 60, 90, 119, 120, 200].map(speedBucket)).toEqual([0, 0, 1, 1, 2, 3, 3, 4, 4]);
    expect(speedBucket(null)).toBe(-1);
    expect(speedBucket(Number.NaN)).toBe(-1);
  });
});

describe('routeSegments', () => {
  it('merges consecutive same-bucket segments and shares the joint vertex', () => {
    const pts = [P(0, 0, 10), P(1, 0, 10), P(2, 0, 20), P(3, 0, 70), P(4, 0, 75), P(5, 0, 10)];
    const fc = routeSegments(pts);
    expect(fc.features.map((f) => f.properties.bucket)).toEqual([0, 2, 0]);
    expect(fc.features[0].geometry.coordinates).toEqual([
      [0, 0],
      [1, 0],
      [2, 0],
    ]);
    // Each next run starts on the previous run's last vertex: no gaps.
    for (let i = 1; i < fc.features.length; i++) {
      const prev = fc.features[i - 1].geometry.coordinates;
      expect(fc.features[i].geometry.coordinates[0]).toEqual(prev[prev.length - 1]);
    }
    expect(fc.features[1].geometry.coordinates).toEqual([
      [2, 0],
      [3, 0],
      [4, 0],
    ]);
  });

  it('the polyline (no speeds) is one unknown-bucket line; < 2 points is empty', () => {
    const fc = routeSegments([P(0, 0, null), P(1, 1, null), P(2, 2, null)]);
    expect(fc.features).toHaveLength(1);
    expect(fc.features[0].properties.bucket).toBe(-1);
    expect(routeSegments([P(0, 0, 10)]).features).toHaveLength(0);
    expect(routeSegments([]).features).toHaveLength(0);
  });
});

describe('speedColorExpression', () => {
  it('maps each bucket to BUCKET_COLORS and unknown to the route red', () => {
    const e = speedColorExpression();
    expect(e.slice(0, 2)).toEqual(['match', ['get', 'bucket']]);
    const stops = e.slice(2, -1);
    expect(stops).toEqual(BUCKET_COLORS.flatMap((c, i) => [i, c]));
    expect(e[e.length - 1]).toBe(UNKNOWN_SPEED_COLOR);
  });
});

describe('routePointsFromDrawn', () => {
  it('raw points carry km/h from the segment ending at them; the first takes the second', () => {
    const t0 = 1_700_000_000_000;
    const fixes: Fix[] = [0, 1, 2].map((i) => ({ lat: 18.47, lng: -69.93 + i * 0.0001, t: t0 + i * 1000, speed: 10, acc: 5 }));
    const out = routePointsFromDrawn({ source: 'points', points: fixes });
    expect(out.map((p) => Math.round(p.speedKmh!))).toEqual([36, 36, 36]);
    expect(out[2].t).toBe(t0 + 2000);
  });
  it('the polyline has no speeds', () => {
    const out = routePointsFromDrawn({ source: 'polyline', points: [{ lat: 1, lng: 2 }] });
    expect(out).toEqual([{ lat: 1, lng: 2, speedKmh: null }]);
  });
});

describe('bounds and camera fit', () => {
  it('routeBounds is [w, s, e, n]', () => {
    expect(routeBounds([{ lat: 18.5, lng: -69.9 }, { lat: 18.4, lng: -70 }, { lat: 18.45, lng: -69.95 }])).toEqual([-70, 18.4, -69.9, 18.5]);
    expect(routeBounds([])).toBeNull();
  });
  it('padBounds widens a degenerate box around its centre', () => {
    const [w, s, e, n] = padBounds([-69.93, 18.47, -69.93, 18.47]);
    expect(e - w).toBeCloseTo(0.002);
    expect(n - s).toBeCloseTo(0.002);
    expect((w + e) / 2).toBeCloseTo(-69.93);
    expect(padBounds([-70, 18, -69, 19])).toEqual([-70, 18, -69, 19]);
  });
  it('cameraFit pads ~12 % of each side, at least minPad, at most a third', () => {
    const fit = cameraFit([{ lat: 18.4, lng: -70 }, { lat: 18.5, lng: -69.9 }], 400, 250)!;
    expect(fit.bounds).toEqual([-70, 18.4, -69.9, 18.5]);
    expect(fit.padding).toEqual({ top: 30, right: 48, bottom: 30, left: 48 });
    expect(cameraFit([{ lat: 0, lng: 0 }], 60, 60)!.padding.left).toBe(20);
    expect(cameraFit([], 100, 100)).toBeNull();
  });
  it('endpoints: start and end, or just start for one point', () => {
    const e = endpointFeatures([{ lat: 1, lng: 2 }, { lat: 3, lng: 4 }]);
    expect(e.features.map((f) => [f.properties.kind, f.geometry.coordinates])).toEqual([
      ['start', [2, 1]],
      ['end', [4, 3]],
    ]);
    expect(endpointFeatures([{ lat: 1, lng: 2 }]).features).toHaveLength(1);
  });
});

describe('sampleAlong (heatmap)', () => {
  it('samples every ~35 m along the route, carrying the remainder across vertices', () => {
    // ~111 m per 0.001° of latitude: three 111 m segments = 333 m.
    const route = [0, 1, 2, 3].map((i) => ({ lat: 18 + i * 0.001, lng: -70 }));
    const total = haversine(route[0], route[3]);
    const s = sampleAlong([route], 35);
    expect(s.length).toBe(1 + Math.floor(total / 35));
    for (let i = 1; i < s.length; i++) expect(haversine(s[i - 1], s[i])).toBeCloseTo(35, 0);
  });
  it('dense GPS does not multiply the samples; caps at maxPoints', () => {
    const dense = Array.from({ length: 1001 }, (_, i) => ({ lat: 18 + i * 0.0000315, lng: -70 })); // ~3.5 m apart, ~3.5 km
    const s = sampleAlong([dense], 35);
    expect(s.length).toBeGreaterThan(95);
    expect(s.length).toBeLessThan(105);
    expect(sampleAlong([dense, dense], 35, 50)).toHaveLength(50);
    expect(sampleAlong([[], [{ lat: 1, lng: 1 }]], 35)).toEqual([{ lat: 1, lng: 1 }]);
  });
});

describe('live trail split', () => {
  it('commits every 10 points; the tail starts on the last committed point', () => {
    expect([0, 9, 10, 19, 25].map((n) => committedLength(n))).toEqual([0, 0, 10, 10, 20]);
    expect(tailStart(0)).toBe(0);
    expect(tailStart(20)).toBe(19);
    const trail = Array.from({ length: 25 }, (_, i) => P(i, 0, 40));
    const k = committedLength(trail.length);
    const committed = routeSegments(trail.slice(0, k)).features[0].geometry.coordinates;
    const tail = routeSegments(trail.slice(tailStart(k))).features[0].geometry.coordinates;
    expect(tail[0]).toEqual(committed[committed.length - 1]);
    expect(committed.length + tail.length - 1).toBe(trail.length);
  });
});

describe('map style health check', () => {
  const style = { version: 8, sources: {}, layers: [] };
  const ok = () => Promise.resolve({ ok: true, json: () => Promise.resolve(style) });
  const down = () => Promise.reject(new Error('offline'));
  beforeEach(() => resetMapStyleCache());

  it('OpenFreeMap dark first; MapTiler only with a key', () => {
    expect(styleCandidates('')).toEqual([OPENFREEMAP_DARK]);
    expect(styleCandidates('abc')).toEqual([OPENFREEMAP_DARK, maptilerDark('abc')]);
  });

  it('fetches once and caches a success for 1 h', async () => {
    const f = jest.fn(ok);
    let now = 0;
    expect(await resolveMapStyle(f, [OPENFREEMAP_DARK], () => now)).toBe(OPENFREEMAP_DARK);
    now = 59 * 60 * 1000;
    expect(await resolveMapStyle(f, [OPENFREEMAP_DARK], () => now)).toBe(OPENFREEMAP_DARK);
    expect(f).toHaveBeenCalledTimes(1);
    now = 61 * 60 * 1000;
    await resolveMapStyle(f, [OPENFREEMAP_DARK], () => now);
    expect(f).toHaveBeenCalledTimes(2);
  });

  it('falls back to the next style; all down → null, remembered for 1 min only', async () => {
    const f = jest.fn((url: string) => (url === OPENFREEMAP_DARK ? down() : ok()));
    expect(await resolveMapStyle(f, [OPENFREEMAP_DARK, 'https://b/style.json'], () => 0)).toBe('https://b/style.json');
    resetMapStyleCache();
    const g = jest.fn(down);
    expect(await resolveMapStyle(g, [OPENFREEMAP_DARK], () => 0)).toBeNull();
    expect(cachedMapStyle(30_000)).toBeNull();
    expect(cachedMapStyle(61_000)).toBeUndefined();
  });

  it('a response that is not a style JSON counts as down', async () => {
    const f = () => Promise.resolve({ ok: true, json: () => Promise.resolve({ error: 'nope' }) });
    expect(await resolveMapStyle(f, [OPENFREEMAP_DARK], () => 0)).toBeNull();
  });
});
