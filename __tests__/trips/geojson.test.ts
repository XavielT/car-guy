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
  frequencyPaint,
  ROUTE_CASING_PAINT,
  ROUTE_LINE_WIDTH,
  routeFrequency,
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

describe('routeFrequency (the thin route lines)', () => {
  // ~111 m per 0.001° of latitude, a straight road going north.
  const road = (lng: number, n = 4, lat0 = 18) => Array.from({ length: n }, (_, i) => ({ lat: lat0 + i * 0.001, lng }));
  const counts = (r: ReturnType<typeof routeFrequency>) => r.features.map((f) => f.properties.count);

  it('one pass over a 333 m road makes ~22 edges of 15 m, each driven once', () => {
    const r = routeFrequency([road(-70)]);
    expect(r.features.length).toBeGreaterThan(18);
    expect(r.features.length).toBeLessThan(26);
    expect(new Set(counts(r))).toEqual(new Set([1]));
    for (const f of r.features) expect(f.geometry.coordinates).toHaveLength(2);
  });

  it('driving it again counts 2; there and back (the opposite direction) is the SAME edge', () => {
    const there = road(-70);
    const back = [...there].reverse();
    const r = routeFrequency([there, back]);
    expect(Math.max(...counts(r))).toBe(2);
    // The number of edges did not double: the two directions merged.
    expect(r.features.length).toBeLessThan(26);
    expect(counts(r).filter((c) => c === 2).length).toBeGreaterThan(15);
  });

  it('a road driven 5 times beside a road driven once: counts differ, the lines stay apart', () => {
    const r = routeFrequency([road(-70), road(-70), road(-70), road(-70), road(-70), road(-69.99)]);
    expect(Math.max(...counts(r))).toBe(5);
    expect(counts(r).filter((c) => c === 1).length).toBeGreaterThan(15);
  });

  it('dense GPS (3.5 m apart) does not multiply the edges: it is resampled to 15 m first', () => {
    const dense = Array.from({ length: 1001 }, (_, i) => ({ lat: 18 + i * 0.0000315, lng: -70 })); // ~3.5 km
    const r = routeFrequency([dense]);
    expect(r.features.length).toBeGreaterThan(200);
    expect(r.features.length).toBeLessThan(260);
  });

  it('the edge geometry follows the road (cell means), not a staircase on the grid: every vertex is within a few metres of the road', () => {
    const r = routeFrequency([road(-70)]);
    for (const f of r.features) for (const [lng] of f.geometry.coordinates) expect(Math.abs(lng - -70) * 111_320 * Math.cos((18 * Math.PI) / 180)).toBeLessThan(2);
  });

  it('caps the number of edges; a stationary or empty route has none', () => {
    const long = Array.from({ length: 200 }, (_, i) => ({ lat: 18 + i * 0.001, lng: -70 })); // ~22 km
    expect(routeFrequency([long], 15, 100).features).toHaveLength(100);
    expect(routeFrequency([[{ lat: 1, lng: 1 }]]).features).toEqual([]);
    expect(routeFrequency([[], []]).features).toEqual([]);
    expect(routeFrequency([]).features).toEqual([]);
  });
});

describe('frequency paint (thin, stylised, no heatmap)', () => {
  const p = frequencyPaint();
  const widths = (v: unknown) => JSON.stringify(v);
  it('line width starts at 0.8 px at z10 and reaches 2.4 px at z16 for one pass (+ up to 1 px by log count)', () => {
    const w = p.line['line-width'] as unknown[];
    expect(w.slice(0, 3)).toEqual(['interpolate', ['linear'], ['zoom']]);
    expect(w[3]).toBe(10);
    expect(widths(w[4])).toContain('0.8');
    expect(w[5]).toBe(16);
    expect(widths(w[6])).toContain('2.4');
    expect(widths(w[4])).toContain('"min",1');
  });
  it('a faint glow underneath: 2.5× the width, blurred, ~20 % opacity; round caps and joins; no casing', () => {
    expect(widths(p.glow['line-width'])).toContain('2');
    expect(p.glow['line-blur']).toBeDefined();
    expect(p.glow['line-opacity']).toBeLessThanOrEqual(0.25);
    expect(p.glow['line-opacity']).toBeGreaterThanOrEqual(0.18);
    expect(p.layout).toEqual({ 'line-cap': 'round', 'line-join': 'round' });
    expect(Object.keys(p)).toEqual(['glow', 'line', 'layout']);
  });
  it('amber → orange → red by count, and the opacity rises with zoom instead of fading out', () => {
    expect(widths(p.line['line-color'])).toMatch(/#FFB300.*#FF5F00.*#E10600/);
    const o = p.line['line-opacity'] as unknown[];
    expect(o[4]).toBeLessThan(o[6] as number);
  });
  it('the individual route lines are slimmer: ~3 px over a ~5 px casing at street zoom', () => {
    expect(widths(ROUTE_LINE_WIDTH)).toContain('3.4');
    expect(widths(ROUTE_CASING_PAINT['line-width'])).toContain('5.5');
  });
  it('NO heatmap layer survives anywhere in the map components', () => {
    const { readFileSync } = require('node:fs');
    const { join } = require('node:path');
    for (const f of ['components/map/HeatMap.tsx', 'components/map/HeatMap.web.tsx', 'lib/trips/geojson.ts']) {
      const src: string = readFileSync(join(__dirname, '../..', f), 'utf8');
      expect(src).not.toMatch(/type="heatmap"|type: 'heatmap'|heatmap-/);
    }
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
