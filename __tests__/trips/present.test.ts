/** lib/trips/present.ts — what the trip screens draw and print (03-screens.md "Phase 5"). */
import { encodePolyline, type Fix } from '@/lib/trips/geo';
import {
  bucketPercents,
  coloredRuns,
  durationLabel,
  equivalences,
  filterTrips,
  fitRoute,
  kmLabel,
  mapsUrl,
  monthSummary,
  parseBuckets,
  pathD,
  summarize,
  timeRange,
  timesLabel,
  tripEnds,
} from '@/lib/trips/present';

const trip = (over: Partial<Record<string, unknown>> = {}) => ({
  id: 't',
  status: 'done' as const,
  deletedAt: null as string | null,
  startedAt: '2026-09-25T12:12:00.000Z',
  distanceM: 12_400,
  durationS: 1500,
  maxKmh: 84 as number | null,
  ...over,
});

describe('parseBuckets / bucketPercents', () => {
  it('parses five numbers and rejects anything else', () => {
    expect(parseBuckets('[1,2,3,4,5]')).toEqual([1, 2, 3, 4, 5]);
    expect(parseBuckets('[1,2]')).toEqual([0, 0, 0, 0, 0]);
    expect(parseBuckets('nope')).toEqual([0, 0, 0, 0, 0]);
    expect(parseBuckets(null)).toEqual([0, 0, 0, 0, 0]);
  });

  it('percentages always add up to 100', () => {
    const p = bucketPercents([1, 1, 1, 0, 0])!;
    expect(p.reduce((a, b) => a + b, 0)).toBe(100);
    expect(p).toEqual([34, 33, 33, 0, 0]);
    expect(bucketPercents([130, 170, 680, 20, 0])).toEqual([13, 17, 68, 2, 0]);
  });

  it('null when nothing moved', () => {
    expect(bucketPercents([0, 0, 0, 0, 0])).toBeNull();
  });
});

describe('fitRoute', () => {
  const box = { width: 300, height: 200, pad: 16 };

  it('stays inside the padded box and keeps north up', () => {
    const pts = [
      { lat: 18.47, lng: -69.95 },
      { lat: 18.5, lng: -69.9 },
      { lat: 18.49, lng: -69.85 },
    ];
    const xy = fitRoute(pts, box);
    for (const p of xy) {
      expect(p.x).toBeGreaterThanOrEqual(16 - 1e-9);
      expect(p.x).toBeLessThanOrEqual(284 + 1e-9);
      expect(p.y).toBeGreaterThanOrEqual(16 - 1e-9);
      expect(p.y).toBeLessThanOrEqual(184 + 1e-9);
    }
    // The northern point is higher on screen (smaller y).
    expect(xy[1].y).toBeLessThan(xy[0].y);
    // West → east goes left → right, and the wide side fills the width.
    expect(xy[0].x).toBeCloseTo(16, 5);
    expect(xy[2].x).toBeCloseTo(284, 5);
  });

  it('preserves the aspect ratio of a north–south line (centred horizontally)', () => {
    const xy = fitRoute(
      [
        { lat: 18.4, lng: -69.9 },
        { lat: 18.5, lng: -69.9 },
      ],
      box,
    );
    expect(xy[0].x).toBeCloseTo(150, 5);
    expect(xy[1].x).toBeCloseTo(150, 5);
    expect(xy[1].y).toBeCloseTo(16, 5);
    expect(xy[0].y).toBeCloseTo(184, 5);
  });

  it('a single point or a parked trip lands in the centre', () => {
    expect(fitRoute([{ lat: 18.4, lng: -69.9 }], box)).toEqual([{ x: 150, y: 100 }]);
    expect(fitRoute([], box)).toEqual([]);
  });

  it('pathD builds an SVG path', () => {
    expect(pathD([{ x: 1, y: 2 }, { x: 3.14159, y: 4 }])).toBe('M1 2 L3.1 4');
    expect(pathD([{ x: 1, y: 2 }])).toBe('');
  });
});

describe('coloredRuns', () => {
  it('splits the track where the speed bucket changes, continuously', () => {
    // 10 s at ~20 km/h then 10 s at ~100 km/h, due east.
    const fixes: Fix[] = [];
    let lng = -69.9;
    for (let i = 0; i <= 20; i++) {
      const v = i <= 10 ? 5.5 : 28;
      if (i) lng += v / (111_320 * Math.cos((18.5 * Math.PI) / 180));
      fixes.push({ lat: 18.5, lng, t: i * 1000, speed: v, acc: 5 });
    }
    const runs = coloredRuns(fixes, { width: 300, height: 200 });
    expect(runs.map((r) => r.bucket)).toEqual([0, 3]);
    const endOfFirst = runs[0].d.split(' L').pop();
    expect(runs[1].d.startsWith(`M${endOfFirst}`)).toBe(true);
  });
});

describe('ends and maps link', () => {
  it('prefers the stored coordinates, else the route ends', () => {
    const polyline = encodePolyline([
      { lat: 18.47, lng: -69.95 },
      { lat: 18.5, lng: -69.9 },
    ]);
    expect(tripEnds({ startLat: null, startLng: null, endLat: null, endLng: null, polyline })).toEqual({
      start: { lat: 18.47, lng: -69.95 },
      end: { lat: 18.5, lng: -69.9 },
    });
    expect(mapsUrl({ startLat: 18.1, startLng: -69.1, endLat: 18.2, endLng: -69.2, polyline: null })).toBe(
      'https://www.google.com/maps/dir/?api=1&origin=18.100000,-69.100000&destination=18.200000,-69.200000',
    );
    expect(mapsUrl({ startLat: null, startLng: null, endLat: null, endLng: null, polyline: null })).toBeNull();
  });
});

describe('summaries', () => {
  it('counts done, non-deleted trips only', () => {
    const s = summarize([
      trip(),
      trip({ distanceM: 30_000, durationS: 2000, maxKmh: 110 }),
      trip({ status: 'discarded', distanceM: 100 }),
      trip({ deletedAt: '2026-09-26T00:00:00Z' }),
    ] as never);
    expect(s).toEqual({ count: 2, distanceM: 42_400, durationS: 3500, maxKmh: 110, longestM: 30_000 });
  });

  it('month summary uses the local calendar month', () => {
    const now = new Date(2026, 8, 29, 12);
    const s = monthSummary(
      [trip({ startedAt: new Date(2026, 8, 2, 8).toISOString() }), trip({ startedAt: new Date(2026, 7, 30, 8).toISOString() })] as never,
      now,
    );
    expect(s.count).toBe(1);
  });

  it('equivalences in DR distances', () => {
    const defs = [
      { key: 'autodromo', km: 3.5 },
      { key: 'santiago', km: 155 },
      { key: 'isla', km: 1000 },
    ];
    const e = equivalences(310, defs);
    expect(e.find((x) => x.key === 'santiago')!.times).toBeCloseTo(2);
    expect(timesLabel(310 / 3.5)).toBe('×89');
    expect(timesLabel(2)).toBe('×2');
    expect(timesLabel(1.44)).toBe('×1.4');
    expect(timesLabel(0.31)).toBe('×0.31');
  });
});

describe('filters and labels', () => {
  const list = [
    trip({ id: 'a', startedAt: new Date(2026, 8, 3).toISOString(), distanceM: 5000, maxKmh: 120 }),
    trip({ id: 'b', startedAt: new Date(2026, 8, 20).toISOString(), distanceM: 20_000, maxKmh: 60 }),
    trip({ id: 'c', startedAt: new Date(2026, 7, 20).toISOString(), distanceM: 9000, maxKmh: null }),
    trip({ id: 'd', status: 'recording' }),
  ];
  const now = new Date(2026, 8, 29);
  const ids = (f: Parameters<typeof filterTrips>[1]) => filterTrips(list as never[], f, now).map((t: { id: string }) => t.id);

  it('orders and filters', () => {
    expect(ids('todos')).toEqual(['b', 'a', 'c']);
    expect(ids('mes')).toEqual(['b', 'a']);
    expect(ids('largos')).toEqual(['b', 'c', 'a']);
    expect(ids('rapidos')).toEqual(['a', 'b', 'c']);
  });

  it('formats', () => {
    expect(kmLabel(12_449)).toBe('12.4');
    expect(durationLabel(1500)).toBe('25 min');
    expect(durationLabel(3900)).toBe('1 h 05 min');
    expect(timeRange(new Date(2026, 8, 25, 8, 12).toISOString(), new Date(2026, 8, 25, 8, 37).toISOString())).toBe('8:12–8:37');
  });
});
