/** Note 16 diagnostics: the trip as GeoJSON with its raw points, saved route and gap numbers. */
import { encodePolyline } from '@/lib/trips/geo';
import { tripDiagnostics, tripGeojson } from '@/lib/trips/exportGeojson';

const pts = [0, 1, 2, 30].map((s, i) => ({ t: 1_790_000_000_000 + s * 1000, lat: 18.45 + i * 0.0001, lng: -69.97, speed: 5, acc: 4, alt: null, heading: null }));
const trip = {
  id: 'trip_abcdef123', vehicleId: 'v', source: 'auto', status: 'done', role: 'conductor', startedAt: '2026-09-30T12:00:00Z', endedAt: '2026-09-30T12:01:00Z',
  distanceM: 30, durationS: 30, movingS: 30, speedBuckets: '[0,0,0,0,0]', segments: 1, notes: '', startLabel: '', endLabel: '', deletedAt: null,
  polyline: encodePolyline([pts[0], pts[3]]),
} as never;

it('diagnostics: counts, the largest gap between fixes, medians', () => {
  const d = tripDiagnostics(trip, pts);
  expect(d.pointCount).toBe(4);
  expect(d.polylinePoints).toBe(2);
  expect(d.maxGapS).toBe(28);
  expect(d.maxGapM).toBeGreaterThan(10);
  expect(d.medianIntervalS).toBe(1);
  expect(d.medianAccM).toBe(4);
});

it('GeoJSON: saved route, raw track and one Point per fix, lng/lat order', () => {
  const g = JSON.parse(tripGeojson(trip, pts));
  expect(g.type).toBe('FeatureCollection');
  const kinds = g.features.map((f: { properties: { kind: string } }) => f.properties.kind);
  expect(kinds.filter((k: string) => k === 'fix')).toHaveLength(4);
  expect(kinds).toContain('saved-route');
  expect(kinds).toContain('raw-track');
  expect(g.features[0].geometry.coordinates[0]).toEqual([-69.97, 18.45]);
  expect(g.properties.diagnostics.pointCount).toBe(4);
});

it('without raw points (older than 30 days) it still exports the saved route', () => {
  const g = JSON.parse(tripGeojson(trip, []));
  expect(g.features).toHaveLength(1);
  expect(g.properties.diagnostics.pointCount).toBe(0);
});

describe('fixesFromTripGeojson (replaying an exported trip)', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { fixesFromTripGeojson, tripGeojson } = require('@/lib/trips/exportGeojson');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { analyzeFixes } = require('@/lib/trips/speed');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { simulate } = require('../helpers/speed/simDrive');

  it('round-trips the fixes (time, position, speed, accuracy) and the engine gives the same answer on them', () => {
    const sim = simulate({ profile: 'city', seed: 3 });
    const trip = { id: 't1', source: 'manual', status: 'done', startedAt: new Date(sim.fixes[0].t).toISOString(), endedAt: null, segments: 1, polyline: null, distanceM: 0 };
    const back = fixesFromTripGeojson(tripGeojson(trip, sim.fixes));
    expect(back).toHaveLength(sim.fixes.length);
    expect(back[10]).toMatchObject({ t: sim.fixes[10].t, acc: sim.fixes[10].acc });
    expect(back[10].lat).toBeCloseTo(sim.fixes[10].lat, 9);
    expect(analyzeFixes(back).summary.topKmh).toBeCloseTo(analyzeFixes(sim.fixes).summary.topKmh, 6);
  });
  it('ignores everything that is not a fix, and a broken file is an empty list', () => {
    expect(fixesFromTripGeojson('not json')).toEqual([]);
    expect(fixesFromTripGeojson(JSON.stringify({ features: [{ properties: { kind: 'raw-track' }, geometry: { type: 'LineString', coordinates: [] } }, { properties: { kind: 'fix', t: 'nope' }, geometry: { type: 'Point', coordinates: [1, 2] } }] }))).toEqual([]);
  });
});
