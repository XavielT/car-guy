/**
 * IMP 30092026 note 16 / ADR-42: routes follow the streets — the 3 m stored
 * polyline, the cleaning report (what each rule dropped), the trip map
 * drawing cleaned raw points, and the GeoJSON diagnostics carrying the counts.
 */
import { tripDiagnostics, tripGeojson } from '@/lib/trips/exportGeojson';
import { ROUTE_SIMPLIFY_M } from '@/lib/trips/finalize';
import { cleanTrack, cleanTrackReport, encodePolyline, project, simplify, stats, type Fix } from '@/lib/trips/geo';
import { routePointsForDrawing } from '@/lib/trips/present';
import { fitTiles, STREET_ZOOM } from '@/lib/trips/tiles';
import { loadDrive } from '../helpers/tripReplay';

jest.mock('@/lib/db/tripOps', () => ({}));

const drive = () => loadDrive(8);

describe('stored polyline at 3 m', () => {
  it('finalize simplifies at 3 m', () => {
    expect(ROUTE_SIMPLIFY_M).toBe(3);
  });

  /** Largest distance (m) from any track fix to the simplified line — how far a chord cuts a curve. */
  function maxDeviation(track: Fix[], line: Fix[]): number {
    const o = track[0];
    const xy = (p: Fix) => project([p], o)[0];
    const segs = line.slice(1).map((b, i) => [xy(line[i]), xy(b)] as const);
    let worst = 0;
    for (const f of track) {
      const p = xy(f);
      let best = Infinity;
      for (const [a, b] of segs) {
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const t = dx || dy ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy))) : 0;
        best = Math.min(best, Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy)));
      }
      worst = Math.max(worst, best);
    }
    return worst;
  }

  it('on the synthetic GPX drive: more points than 8 m, and no fix further than 3 m from the line', () => {
    const track = stats(drive()).track;
    const at3 = simplify(track, 3);
    const at8 = simplify(track, 8);
    // The fixture is three straight avenues with ~0.5 m noise: few corners, so the gain is modest
    // (22 vs 17). What matters is how close the line stays to the fixes.
    expect(at3.length).toBeGreaterThan(at8.length);
    expect(at3.length).toBeLessThan(track.length / 10);
    expect(maxDeviation(track, at3)).toBeLessThanOrEqual(3 + 1e-6);
    expect(maxDeviation(track, at8)).toBeGreaterThan(3);
  });

  it('on a winding road the 3 m line keeps ~1.6× the points (Douglas–Peucker ∝ 1/√tolerance on smooth curves)', () => {
    // 2 km of S-curves (radius ~60 m) at 1 Hz, 12 m/s.
    const road: Fix[] = Array.from({ length: 170 }, (_, i) => {
      const x = i * 12;
      const y = 60 * Math.sin(x / 60);
      return { t: i * 1000, lat: 18.45 + y / 111_195, lng: -69.97 + x / (111_195 * Math.cos((18.45 * Math.PI) / 180)), speed: 12, acc: 5 };
    });
    const at3 = simplify(road, 3).length;
    const at8 = simplify(road, 8).length;
    expect(at3 / at8).toBeGreaterThanOrEqual(1.4);
    expect(maxDeviation(road, simplify(road, 8))).toBeGreaterThan(3);
  });
});

describe('cleanTrackReport', () => {
  const straight: Fix[] = Array.from({ length: 30 }, (_, i) => ({ t: i * 60_000, lat: 18.45, lng: -69.97 + i * 0.00142, speed: 15, acc: 5, alt: null, heading: null }));

  it('counts what each rule dropped, and keeps the same fixes as cleanTrack', () => {
    const noisy = straight.slice();
    for (const k of [10, 11, 12]) noisy[k] = { ...noisy[k], lat: 18.475 }; // out-and-back excursion
    noisy[20] = { ...noisy[20], acc: 60 }; // inaccurate
    noisy[25] = { ...noisy[25], lat: noisy[25].lat + 0.5 }; // ~55 km in a minute: a jump
    const dup = { ...noisy[5] }; // same timestamp twice
    const input = [...noisy, dup];

    const r = cleanTrackReport(input);
    expect(r).toMatchObject({ raw: 31, droppedAccuracy: 1, droppedDuplicates: 1, droppedJumps: 1, droppedExcursions: 3 });
    expect(r.kept).toBe(r.track.length);
    expect(r.kept).toBe(31 - 1 - 1 - 1 - 3);
    expect(r.track).toEqual(cleanTrack(input));
    expect(stats(input).cleaning).toMatchObject({ raw: 31, kept: r.kept, droppedExcursions: 3 });
  });

  it('a clean drive drops nothing', () => {
    const r = cleanTrackReport(straight);
    expect(r).toMatchObject({ raw: 30, kept: 30, droppedAccuracy: 0, droppedDuplicates: 0, droppedJumps: 0, droppedExcursions: 0 });
  });
});

describe('routePointsForDrawing', () => {
  const polyline = encodePolyline([
    { lat: 18.45, lng: -69.97 },
    { lat: 18.46, lng: -69.96 },
  ]);

  it('draws the raw points, cleaned like the stats (the excursion is gone), when the phone has them', () => {
    const pts = drive();
    const noisy = pts.map((p, i) => (i >= 400 && i < 403 ? { ...p, lat: p.lat + 0.03 } : p)); // ~3.3 km out and back
    const d = routePointsForDrawing(noisy, { polyline, endedAt: null });
    expect(d.source).toBe('points');
    expect(d.points.some((p) => p.lat > 18.49 && noisy.slice(400, 403).includes(p as Fix))).toBe(false);
    expect(d.points.length).toBeGreaterThan(50);
    expect(d.points.length).toBeLessThanOrEqual(901);
  });

  it('thins long tracks to about maxPoints, first and last kept', () => {
    const pts = drive();
    const d = routePointsForDrawing(pts, { polyline, endedAt: null }, 200);
    expect(d.points.length).toBeLessThanOrEqual(201);
    const clean = cleanTrack(pts);
    expect(d.points[0]).toBe(clean[0]);
    expect(d.points[d.points.length - 1]).toBe(clean[clean.length - 1]);
  });

  it('leaves out the parked tail after the trip ended', () => {
    const pts = drive();
    const endedAt = new Date(pts[99].t).toISOString();
    const d = routePointsForDrawing(pts, { polyline, endedAt });
    expect(d.points.every((p) => (p as Fix).t <= pts[99].t)).toBe(true);
  });

  it('falls back to the stored polyline without points (or with fewer than two usable)', () => {
    expect(routePointsForDrawing(null, { polyline })).toEqual({ source: 'polyline', points: [{ lat: 18.45, lng: -69.97 }, { lat: 18.46, lng: -69.96 }] });
    expect(routePointsForDrawing([], { polyline }).source).toBe('polyline');
    const bad = drive().slice(0, 5).map((p) => ({ ...p, acc: 80 }));
    expect(routePointsForDrawing(bad, { polyline }).source).toBe('polyline');
    expect(routePointsForDrawing(null, { polyline: null })).toEqual({ source: 'polyline', points: [] });
  });
});

describe('GeoJSON diagnostics carry the cleaning counts', () => {
  it('raw vs cleaned, dropped by reason, the parked tail apart; cleaned track and per-fix kept flag', () => {
    const pts = drive().slice(0, 200);
    const noisy = pts.map((p, i) => (i === 50 ? { ...p, acc: 45 } : p));
    const endedAt = new Date(pts[179].t).toISOString();
    const trip = {
      id: 't1', vehicleId: 'v', source: 'auto', status: 'done', role: 'conductor', startedAt: new Date(pts[0].t).toISOString(), endedAt,
      distanceM: 1000, durationS: 180, movingS: 150, speedBuckets: '[0,0,0,0,0]', segments: 1, notes: '', startLabel: '', endLabel: '', deletedAt: null,
      polyline: encodePolyline([pts[0], pts[179]]),
    } as never;
    const d = tripDiagnostics(trip, noisy);
    expect(d.pointCount).toBe(200);
    expect(d.pointsAfterEnd).toBe(20);
    expect(d.cleaning).toMatchObject({ raw: 180, kept: 179, droppedAccuracy: 1, droppedJumps: 0, droppedExcursions: 0 });

    const g = JSON.parse(tripGeojson(trip, noisy));
    const kinds = g.features.map((f: { properties: { kind: string } }) => f.properties.kind);
    expect(kinds).toContain('clean-track');
    const fixes = g.features.filter((f: { properties: { kind: string } }) => f.properties.kind === 'fix');
    expect(fixes.filter((f: { properties: { kept: boolean } }) => !f.properties.kept)).toHaveLength(1 + 20);
    expect(g.properties.diagnostics.cleaning.kept).toBe(179);
  });
});

describe('trip map zoom', () => {
  it('a neighbourhood drive gets street zoom (≥ 15); a cross-city one the deepest that fits', () => {
    const box = { width: 340, height: 220, pad: 16 };
    const small = [{ lat: 18.4497, lng: -69.97 }, { lat: 18.4515, lng: -69.967 }];
    expect(fitTiles(small, box)!.zoom).toBeGreaterThanOrEqual(STREET_ZOOM);
    const city = [{ lat: 18.4497, lng: -69.97 }, { lat: 18.472, lng: -69.925 }];
    expect(fitTiles(city, box)!.zoom).toBeLessThan(STREET_ZOOM);
  });
});
