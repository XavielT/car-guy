import seed from '../../docs/imp-01102026/fixtures/social-seed.json';
import { densify, endCuts, pathLength, trimForSharing, type PrivacyZone } from '@/lib/domain/tripShare';
import { decodePolyline, encodePolyline, haversine, projector, type LatLng } from '@/lib/trips/geo';

const ORIGIN: LatLng = { lat: 18.47, lng: -69.93 };
const { toLatLng } = projector(ORIGIN);

/** A straight west→east line of `lengthM`, one point every `stepM`. */
function straight(lengthM: number, stepM = 100): LatLng[] {
  const out: LatLng[] = [];
  for (let x = 0; x <= lengthM; x += stepM) out.push(toLatLng({ x, y: 0 }));
  return out;
}

/** Position of `p` along `route`, m: the closest step, projected onto it. */
function alongRoute(route: readonly LatLng[], p: LatLng): number {
  const { toXY } = projector(route[0]);
  const q = toXY(p);
  let best = Infinity;
  let at = 0;
  let cum = 0;
  for (let i = 1; i < route.length; i++) {
    const a = toXY(route[i - 1]);
    const b = toXY(route[i]);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const L2 = dx * dx + dy * dy;
    const t = L2 > 0 ? Math.max(0, Math.min(1, ((q.x - a.x) * dx + (q.y - a.y) * dy) / L2)) : 0;
    const d = Math.hypot(a.x + dx * t - q.x, a.y + dy * t - q.y);
    const step = haversine(route[i - 1], route[i]);
    if (d < best) {
      best = d;
      at = cum + step * t;
    }
    cum += step;
  }
  return at;
}

const fixtureTrip = seed.trips[0];
const fixturePoints: LatLng[] = fixtureTrip.points.map(([lat, lng]) => ({ lat, lng }));
const fixtureZones: PrivacyZone[] = seed.privacy_zones.map(({ lat, lng, radius_m }) => ({ lat, lng, radius_m }));

describe('endCuts', () => {
  it('is 300 m + 0–200 m at each end, and the same for the same trip', () => {
    for (const id of ['a', 'soc_trip_1', 'trip-42', '0000-ffff', 'x'.repeat(50)]) {
      const c = endCuts(id);
      expect(c.cutStartM).toBeGreaterThanOrEqual(300);
      expect(c.cutStartM).toBeLessThanOrEqual(500);
      expect(c.cutEndM).toBeGreaterThanOrEqual(300);
      expect(c.cutEndM).toBeLessThanOrEqual(500);
      expect(endCuts(id)).toEqual(c);
    }
  });

  it('differs between trips and usually between the two ends', () => {
    const starts = new Set<number>();
    let sameEnds = 0;
    for (let i = 0; i < 50; i++) {
      const c = endCuts(`trip_${i}`);
      starts.add(Math.round(c.cutStartM));
      if (Math.abs(c.cutStartM - c.cutEndM) < 1) sameEnds++;
    }
    expect(starts.size).toBeGreaterThan(30);
    expect(sameEnds).toBeLessThan(5);
  });
});

describe('densify', () => {
  it('keeps every step at or under the spacing and the length unchanged', () => {
    const d = densify(straight(1000, 250), 20);
    for (let i = 1; i < d.length; i++) expect(haversine(d[i - 1], d[i])).toBeLessThanOrEqual(20.01);
    expect(pathLength(d)).toBeCloseTo(1000, 0);
  });
});

describe('trimForSharing', () => {
  it('cuts 300–500 m at both ends of a plain route', () => {
    const route = straight(3000);
    const r = trimForSharing(route, { tripId: 'trip-plain', simplifyM: 0 });
    expect(r.segments).toHaveLength(1);
    const seg = r.segments[0];
    const start = haversine(route[0], seg[0]);
    const end = haversine(route[route.length - 1], seg[seg.length - 1]);
    expect(start).toBeGreaterThanOrEqual(300);
    expect(start).toBeLessThanOrEqual(500);
    expect(end).toBeGreaterThanOrEqual(300);
    expect(end).toBeLessThanOrEqual(500);
    // The kept part starts and ends exactly at the cuts.
    expect(start).toBeCloseTo(r.cutStartM, 0);
    expect(end).toBeCloseTo(r.cutEndM, 0);
  });

  it('is deterministic per trip id', () => {
    const route = straight(3000);
    const a = trimForSharing(route, { tripId: 'same' });
    const b = trimForSharing(route, { tripId: 'same' });
    expect(b).toEqual(a);
    const c = trimForSharing(route, { tripId: 'other' });
    expect(c.cutStartM).not.toBeCloseTo(a.cutStartM, 3);
  });

  it('recomputes the distance on the trimmed geometry', () => {
    const route = straight(3000);
    const r = trimForSharing(route, { tripId: 'trip-dist' });
    expect(Math.abs(r.distanceM - (3000 - r.cutStartM - r.cutEndM))).toBeLessThan(2);
    expect(r.distanceM).toBeCloseTo(r.segments.reduce((a, s) => a + pathLength(s), 0), 6);
    expect(r.distanceM).toBeLessThan(pathLength(route));
  });

  it('encodes each segment with the trip polyline codec', () => {
    const r = trimForSharing(straight(3000), { tripId: 'trip-enc' });
    expect(r.encoded).toHaveLength(r.segments.length);
    r.segments.forEach((s, i) => {
      expect(r.encoded[i]).toBe(encodePolyline(s));
      const back = decodePolyline(r.encoded[i]);
      expect(back).toHaveLength(s.length);
      expect(haversine(back[0], s[0])).toBeLessThan(2);
    });
  });

  it('splits a route that passes through a zone into two pieces, never bridged', () => {
    const route = straight(5000);
    const zone: PrivacyZone = { ...toLatLng({ x: 2500, y: 0 }), radius_m: 300 };
    const r = trimForSharing(route, { tripId: 'trip-zone', zones: [zone] });
    expect(r.segments).toHaveLength(2);
    expect(r.encoded).toHaveLength(2);
    for (const s of r.segments) for (const p of s) expect(haversine(p, zone)).toBeGreaterThan(300);
    // The gap spans the zone (600 m, plus up to one densify step at each side).
    const gap = haversine(r.segments[0][r.segments[0].length - 1], r.segments[1][0]);
    expect(gap).toBeGreaterThanOrEqual(600);
    expect(gap).toBeLessThan(645);
    expect(Math.abs(r.distanceM - (5000 - r.cutStartM - r.cutEndM - gap))).toBeLessThan(2);
  });

  it('drops a piece shorter than the minimum left between the start cut and a zone', () => {
    const route = straight(3000);
    // The zone leaves ~50 m between the start cut and its edge.
    const { cutStartM } = endCuts('trip-short-piece');
    const zone: PrivacyZone = { ...toLatLng({ x: cutStartM + 50 + 300, y: 0 }), radius_m: 300 };
    const r = trimForSharing(route, { tripId: 'trip-short-piece', zones: [zone] });
    expect(r.segments).toHaveLength(1);
    expect(haversine(r.segments[0][0], route[0])).toBeGreaterThan(cutStartM + 650);
  });

  it('returns nothing for a trip shorter than both cuts', () => {
    for (const len of [0, 200, 600, 900]) {
      const r = trimForSharing(straight(len, 50), { tripId: 'trip-tiny' });
      expect(r.segments).toEqual([]);
      expect(r.encoded).toEqual([]);
      expect(r.distanceM).toBe(0);
    }
    expect(trimForSharing([], { tripId: 'empty' }).segments).toEqual([]);
    expect(trimForSharing([ORIGIN], { tripId: 'one' }).segments).toEqual([]);
  });

  it('returns nothing when the whole middle is inside a zone', () => {
    const route = straight(2000);
    const zone: PrivacyZone = { ...toLatLng({ x: 1000, y: 0 }), radius_m: 1000 };
    expect(trimForSharing(route, { tripId: 'trip-all-zone', zones: [zone] }).segments).toEqual([]);
  });

  describe('the social seed fixture', () => {
    const r = trimForSharing(fixturePoints, { tripId: fixtureTrip.id, zones: fixtureZones });
    const dense = densify(fixturePoints);

    it('keeps a route, shorter than the raw one', () => {
      expect(r.segments.length).toBeGreaterThan(0);
      expect(r.distanceM).toBeGreaterThan(1000);
      expect(r.distanceM).toBeLessThan(pathLength(fixturePoints) - 600);
    });

    it('fully excludes the zone the trip starts in', () => {
      for (const s of r.segments) {
        for (const p of s) for (const z of fixtureZones) expect(haversine(p, z)).toBeGreaterThan(z.radius_m);
      }
      for (const enc of r.encoded) {
        // Rounding to 1e-5° moves a point by about a metre at most.
        for (const p of decodePolyline(enc)) for (const z of fixtureZones) expect(haversine(p, z)).toBeGreaterThan(z.radius_m - 1);
      }
    });

    it('emits nothing within the end cuts', () => {
      const total = pathLength(dense);
      for (const s of r.segments) {
        for (const p of s) {
          const at = alongRoute(dense, p);
          expect(at).toBeGreaterThanOrEqual(r.cutStartM - 0.5);
          expect(at).toBeLessThanOrEqual(total - r.cutEndM + 0.5);
        }
      }
    });
  });

  it('never emits a point inside a zone or within the end cuts (random routes)', () => {
    // Deterministic LCG so a failure reproduces.
    let s = 12345;
    const rnd = () => (s = (Math.imul(s, 1103515245) + 12345) >>> 0) / 4294967296;
    let withRoute = 0;
    let split = 0;
    for (let trial = 0; trial < 60; trial++) {
      // Eastward with a random north–south wander: the route never crosses
      // itself, so a point's position along it is unambiguous.
      const route: LatLng[] = [];
      let x = 0;
      let y = 0;
      const n = 5 + Math.floor(rnd() * 40);
      for (let i = 0; i < n; i++) {
        route.push(toLatLng({ x, y }));
        x += 20 + rnd() * 400;
        y += (rnd() - 0.5) * 300;
      }
      const zones: PrivacyZone[] = [];
      const nz = Math.floor(rnd() * 4);
      for (let k = 0; k < nz; k++) {
        const at = route[Math.floor(rnd() * route.length)];
        zones.push({ lat: at.lat + (rnd() - 0.5) * 0.004, lng: at.lng + (rnd() - 0.5) * 0.004, radius_m: 100 + rnd() * 400 });
      }
      const r = trimForSharing(route, { tripId: `rand_${trial}`, zones });
      const dense = densify(route);
      const total = pathLength(dense);
      expect(r.cutStartM).toBeGreaterThanOrEqual(300);
      expect(r.cutEndM).toBeLessThanOrEqual(500);
      if (total < r.cutStartM + r.cutEndM) expect(r.segments).toEqual([]);
      expect(r.encoded).toHaveLength(r.segments.length);
      if (r.segments.length > 0) withRoute++;
      if (r.segments.length > 1) split++;
      for (const seg of r.segments) {
        expect(pathLength(seg)).toBeGreaterThanOrEqual(99);
        for (const p of seg) {
          for (const z of zones) expect(haversine(p, z)).toBeGreaterThan(z.radius_m);
          const at = alongRoute(dense, p);
          expect(at).toBeGreaterThanOrEqual(r.cutStartM - 0.5);
          expect(at).toBeLessThanOrEqual(total - r.cutEndM + 0.5);
        }
      }
      expect(r.distanceM).toBeLessThanOrEqual(Math.max(0, total - r.cutStartM - r.cutEndM) + 0.5);
    }
    // The run must actually exercise kept routes and zone splits.
    expect(withRoute).toBeGreaterThan(20);
    expect(split).toBeGreaterThan(3);
  });
});
