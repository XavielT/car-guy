/**
 * Trimming a trip before it is shared (IMP 01102026 note 13, ADR-56,
 * 02-specs/01-data-model-v10.md §2 "Trimming", research
 * 01-research/02-social-follows-live-location-juntes.md §2.2).
 *
 * Pure, no I/O: the trim runs on the device from the local raw points, so the
 * server only ever receives the trimmed geometry and the raw `trip` RLS never
 * opens. The output feeds `trip_share.polyline_trimmed` (one encoded polyline
 * per segment, because a privacy zone splits a route into pieces).
 *
 * Rules, in order:
 * 1. densify to ~20 m so a long straight leg between two outside points
 *    cannot carry the route through a zone without a point landing in it;
 * 2. cut `endCutM` + a seeded 0–`jitterMaxM` m off BOTH ends, measured along
 *    the route — the jitter blurs the "every trip ends 300 m from home"
 *    circle, and the seed (trip id) makes re-sharing the same trip give the
 *    same cut, so two shares never reveal more than one;
 * 3. drop every point inside any privacy zone and split there — never
 *    reconnect across a zone;
 * 4. drop pieces shorter than `minSegmentM`.
 *
 * Geometry and the polyline codec are the trip ones (lib/trips/geo.ts), so a
 * shared route encodes exactly like a stored trip polyline.
 */
import { encodePolyline, haversine, simplify, type LatLng } from '../trips/geo';

/** A privacy zone as stored (`privacy_zone`): a circle around a point. */
export type PrivacyZone = LatLng & { radius_m: number };

export type TrimOptions = {
  /** Seeds the end-cut jitter: the same trip always gets the same cut. */
  tripId: string;
  zones?: readonly PrivacyZone[];
  /** Fixed part of each end cut, m (ADR-56: 300). */
  endCutM?: number;
  /** Upper bound of the seeded extra cut at each end, m (ADR-56: 200). */
  jitterMaxM?: number;
  /** Maximum spacing after densifying, m. */
  densifyM?: number;
  /** Pieces shorter than this are dropped (research §2.2: 100 m). */
  minSegmentM?: number;
  /**
   * Douglas–Peucker tolerance before encoding, m. Same as the stored trip
   * polyline (ROUTE_SIMPLIFY_M in lib/trips/finalize.ts, ADR-42); repeated
   * here because finalize pulls in the database. 0 keeps every densified point.
   */
  simplifyM?: number;
};

export type TrimmedShare = {
  /** The pieces that may be shown, in route order. */
  segments: LatLng[][];
  /** One Google polyline (precision 5) per segment, same codec as `trip.polyline`. */
  encoded: string[];
  /** Length of the segments, m — never the raw trip's distance. */
  distanceM: number;
  /** What was cut at the start / end, m along the densified route. */
  cutStartM: number;
  cutEndM: number;
};

export const TRIM_DEFAULTS = {
  endCutM: 300,
  jitterMaxM: 200,
  densifyM: 20,
  minSegmentM: 100,
  simplifyM: 3,
} as const;

// ---------------------------------------------------------------------------
// Seeded jitter
// ---------------------------------------------------------------------------

/** FNV-1a over the string: a stable 32-bit seed from a trip id. */
function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * mulberry32: a tiny PRNG in [0, 1). Not for anything cryptographic — it only
 * needs to be deterministic per trip and spread the cuts evenly.
 */
export function seededRandom(seed: string): () => number {
  let h = hashSeed(seed);
  return () => {
    h = (h + 0x6d2b79f5) | 0;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The two end cuts for a trip, m. Two draws from the same stream, so the start
 * and the end usually get different offsets (one shared offset would let the
 * two ends be lined up against each other).
 */
export function endCuts(
  tripId: string,
  endCutM: number = TRIM_DEFAULTS.endCutM,
  jitterMaxM: number = TRIM_DEFAULTS.jitterMaxM,
): { cutStartM: number; cutEndM: number } {
  const rnd = seededRandom(tripId);
  return { cutStartM: endCutM + rnd() * jitterMaxM, cutEndM: endCutM + rnd() * jitterMaxM };
}

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

const lerp = (a: LatLng, b: LatLng, t: number): LatLng => ({
  lat: a.lat + (b.lat - a.lat) * t,
  lng: a.lng + (b.lng - a.lng) * t,
});

/** Inserts points so no step is longer than `maxStepM`. Keeps the originals. */
export function densify(points: readonly LatLng[], maxStepM: number = TRIM_DEFAULTS.densifyM): LatLng[] {
  if (points.length === 0) return [];
  const out: LatLng[] = [{ lat: points[0].lat, lng: points[0].lng }];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const n = Math.max(1, Math.ceil(haversine(a, b) / maxStepM));
    for (let k = 1; k <= n; k++) out.push(lerp(a, b, k / n));
  }
  return out;
}

/** Sum of the steps of one polyline, m. */
export function pathLength(points: readonly LatLng[]): number {
  let d = 0;
  for (let i = 1; i < points.length; i++) d += haversine(points[i - 1], points[i]);
  return d;
}

export function inAnyZone(p: LatLng, zones: readonly PrivacyZone[]): boolean {
  for (const z of zones) if (haversine(p, z) <= z.radius_m) return true;
  return false;
}

// ---------------------------------------------------------------------------
// The trim
// ---------------------------------------------------------------------------

/**
 * The geometry of a trip that may be shown to other people (ADR-56). A trip
 * shorter than both end cuts (or whose middle is all inside zones) comes back
 * with no segments — the caller must then not create a share.
 */
export function trimForSharing(points: readonly LatLng[], opts: TrimOptions): TrimmedShare {
  const zones = opts.zones ?? [];
  const minSeg = opts.minSegmentM ?? TRIM_DEFAULTS.minSegmentM;
  const simplifyM = opts.simplifyM ?? TRIM_DEFAULTS.simplifyM;
  const { cutStartM, cutEndM } = endCuts(
    opts.tripId,
    opts.endCutM ?? TRIM_DEFAULTS.endCutM,
    opts.jitterMaxM ?? TRIM_DEFAULTS.jitterMaxM,
  );
  const empty: TrimmedShare = { segments: [], encoded: [], distanceM: 0, cutStartM, cutEndM };
  if (points.length < 2) return empty;

  const pts = densify(points, opts.densifyM ?? TRIM_DEFAULTS.densifyM);
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum[i] = cum[i - 1] + haversine(pts[i - 1], pts[i]);
  const total = cum[cum.length - 1];
  const from = cutStartM;
  const to = total - cutEndM;
  if (to - from < minSeg) return empty;

  // 1) End cuts, interpolating the exact cut points so the kept part starts
  // and ends at `from` / `to` instead of at the nearest densified point
  // (which could sit a few metres inside the cut).
  const mid: LatLng[] = [];
  for (let i = 1; i < pts.length; i++) {
    const d0 = cum[i - 1];
    const d1 = cum[i];
    if (d1 < from || d0 > to) continue;
    const len = d1 - d0;
    const a = d0 < from && len > 0 ? lerp(pts[i - 1], pts[i], (from - d0) / len) : pts[i - 1];
    const b = d1 > to && len > 0 ? lerp(pts[i - 1], pts[i], (to - d0) / len) : pts[i];
    if (mid.length === 0) mid.push(a);
    mid.push(b);
  }

  // 2) Zones: a point inside any zone ends the current piece; the next piece
  // starts at the next outside point. Never bridged.
  const pieces: LatLng[][] = [];
  let cur: LatLng[] = [];
  for (const p of mid) {
    if (inAnyZone(p, zones)) {
      if (cur.length > 1) pieces.push(cur);
      cur = [];
    } else {
      cur.push(p);
    }
  }
  if (cur.length > 1) pieces.push(cur);

  // 3) Short pieces carry little route and a lot of "where it started".
  // Simplify like the stored trip polyline (the subset keeps only outside
  // points), then measure what is actually shared.
  const segments = pieces
    .filter((s) => pathLength(s) >= minSeg)
    .map((s) => (simplifyM > 0 ? simplify(s, simplifyM) : s));
  const distanceM = segments.reduce((acc, s) => acc + pathLength(s), 0);
  return { segments, encoded: segments.map((s) => encodePolyline(s)), distanceM, cutStartM, cutEndM };
}
