/**
 * Trip geometry — distances, speed, simplification, polylines and per-trip
 * stats (IMP 29092026 note 2, docs/imp-29092026/01-research/01-trip-tracking.md
 * §1.3 and §3, ADR-29).
 *
 * Pure TypeScript, no dependencies: Douglas–Peucker and the Google polyline
 * codec are a few lines each, so the domain does not pull in simplify-js or
 * @mapbox/polyline (same output: precision 5, [lat, lng] order, the Mapbox
 * rounding rule).
 *
 * Units: meters, seconds, m/s inside; km/h only in the stats that are shown.
 * Timestamps are epoch milliseconds.
 */

export type LatLng = { lat: number; lng: number };

/** One GPS sample, as expo-location reports it (flattened). */
export type Fix = LatLng & {
  /** epoch ms */
  t: number;
  /** m/s as reported; null (web) or 0 (Android without `hasSpeed`) when unknown. */
  speed: number | null;
  /** Horizontal accuracy radius in meters; null when unknown. */
  acc: number | null;
  alt?: number | null;
  heading?: number | null;
};

/** [minLat, minLng, maxLat, maxLng] — the shape stored in `trip.bbox`. */
export type BBox = [number, number, number, number];

/** Thresholds shared by the stats and the state machine (research §1.3, §2.1, §3). */
export const GEO_DEFAULTS = {
  /** Fixes worse than this are left out of the track (research §2.1: "> 30 for the track"). */
  trackAccM: 30,
  /** A fix implying more than this from the last accepted one is a jump (~250 km/h). */
  maxJumpSpeedMs: 70,
  /** A segment at or above this counts as moving (research §3, same as STOP_SPEED). */
  movingSpeedMs: 1.5,
  /** Below this, a segment shorter than the combined accuracy is jitter (research §3). */
  jitterSpeedMs: 1,
  /** Accuracy assumed for a fix that reports none, for the jitter test. */
  unknownAccM: 5,
  /** Only fixes this accurate may set the top speed (research §3). */
  maxSpeedAccM: 20,
  /** Displacement speed is only derived over gaps up to this (research §1.3). */
  maxDerivedDtS: 30,
  /** Reported 0 with a displacement faster than this means "unknown" (Android). */
  fakeZeroMs: 2,
} as const;

// ---------------------------------------------------------------------------
// Distance and projection
// ---------------------------------------------------------------------------

/** Mean Earth radius (IUGG), meters. */
const R = 6371008.8;
const RAD = Math.PI / 180;

/** Great-circle distance in meters. */
export function haversine(a: LatLng, b: LatLng): number {
  const dLat = (b.lat - a.lat) * RAD;
  const dLng = (b.lng - a.lng) * RAD;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export type XY = { x: number; y: number };

/**
 * Equirectangular projection around `origin`, in meters (research §3). Good to
 * well under 1 % over a city-sized trip, which is all Douglas–Peucker and the
 * SVG route need.
 */
export function projector(origin: LatLng): { toXY: (p: LatLng) => XY; toLatLng: (p: XY) => LatLng } {
  const kx = Math.cos(origin.lat * RAD) * R * RAD;
  const ky = R * RAD;
  return {
    toXY: (p) => ({ x: (p.lng - origin.lng) * kx, y: (p.lat - origin.lat) * ky }),
    toLatLng: (p) => ({ lat: origin.lat + p.y / ky, lng: origin.lng + p.x / kx }),
  };
}

/** Mean of the points (the projection origin for a trip). */
export function centroid(points: readonly LatLng[]): LatLng | null {
  if (points.length === 0) return null;
  let lat = 0;
  let lng = 0;
  for (const p of points) {
    lat += p.lat;
    lng += p.lng;
  }
  return { lat: lat / points.length, lng: lng / points.length };
}

/** Projects points to meters around `origin` (default: their centroid). */
export function project(points: readonly LatLng[], origin?: LatLng): XY[] {
  const o = origin ?? centroid(points);
  if (!o) return [];
  const { toXY } = projector(o);
  return points.map(toXY);
}

export function bbox(points: readonly LatLng[]): BBox | null {
  if (points.length === 0) return null;
  let minLat = Infinity;
  let minLng = Infinity;
  let maxLat = -Infinity;
  let maxLng = -Infinity;
  for (const p of points) {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lng < minLng) minLng = p.lng;
    if (p.lng > maxLng) maxLng = p.lng;
  }
  return [minLat, minLng, maxLat, maxLng];
}

// ---------------------------------------------------------------------------
// Douglas–Peucker
// ---------------------------------------------------------------------------

/** Squared distance from p to the segment a–b. */
function segDist2(p: XY, a: XY, b: XY): number {
  let x = a.x;
  let y = a.y;
  const dx = b.x - x;
  const dy = b.y - y;
  if (dx !== 0 || dy !== 0) {
    const t = ((p.x - x) * dx + (p.y - y) * dy) / (dx * dx + dy * dy);
    if (t > 1) {
      x = b.x;
      y = b.y;
    } else if (t > 0) {
      x += dx * t;
      y += dy * t;
    }
  }
  return (p.x - x) ** 2 + (p.y - y) ** 2;
}

/**
 * Douglas–Peucker with the tolerance in meters (default 8 m, ADR-29; the
 * stored trip polyline uses 3 m since ADR-42), on the
 * equirectangular projection around the points' centroid. Returns a subset of
 * the input objects (first and last always kept), so extra fields survive.
 * Iterative, so a 2 000-point drive cannot overflow the stack.
 */
export function simplify<T extends LatLng>(points: readonly T[], toleranceM = 8): T[] {
  const n = points.length;
  if (n <= 2 || toleranceM <= 0) return points.slice();
  const xy = project(points);
  const keep = new Uint8Array(n);
  keep[0] = 1;
  keep[n - 1] = 1;
  const tol2 = toleranceM * toleranceM;
  const stack: [number, number][] = [[0, n - 1]];
  while (stack.length) {
    const [first, last] = stack.pop()!;
    let maxD = tol2;
    let index = -1;
    for (let i = first + 1; i < last; i++) {
      const d = segDist2(xy[i], xy[first], xy[last]);
      if (d > maxD) {
        maxD = d;
        index = i;
      }
    }
    if (index !== -1) {
      keep[index] = 1;
      if (index - first > 1) stack.push([first, index]);
      if (last - index > 1) stack.push([index, last]);
    }
  }
  const out: T[] = [];
  for (let i = 0; i < n; i++) if (keep[i]) out.push(points[i]);
  return out;
}

// ---------------------------------------------------------------------------
// Google encoded polyline (precision 5 by default)
// ---------------------------------------------------------------------------

/** Round half away from zero — what Google's and Mapbox's encoders do. */
function roundAway(v: number): number {
  return Math.sign(v) * Math.floor(Math.abs(v) + 0.5);
}

function encodeValue(delta: number): string {
  let v = delta < 0 ? ~(delta << 1) : delta << 1;
  let out = '';
  while (v >= 0x20) {
    out += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
    v >>= 5;
  }
  return out + String.fromCharCode(v + 63);
}

export function encodePolyline(points: readonly LatLng[], precision = 5): string {
  const f = 10 ** precision;
  let prevLat = 0;
  let prevLng = 0;
  let out = '';
  for (const p of points) {
    const lat = roundAway(p.lat * f);
    const lng = roundAway(p.lng * f);
    out += encodeValue(lat - prevLat) + encodeValue(lng - prevLng);
    prevLat = lat;
    prevLng = lng;
  }
  return out;
}

export function decodePolyline(str: string, precision = 5): LatLng[] {
  const f = 10 ** precision;
  const out: LatLng[] = [];
  let i = 0;
  let lat = 0;
  let lng = 0;
  const next = (): number | null => {
    let result = 0;
    let shift = 0;
    let b: number;
    do {
      if (i >= str.length) return null;
      b = str.charCodeAt(i++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    return result & 1 ? ~(result >> 1) : result >> 1;
  };
  while (i < str.length) {
    const dLat = next();
    const dLng = next();
    if (dLat == null || dLng == null) break; // truncated string: keep what decoded
    lat += dLat;
    lng += dLng;
    out.push({ lat: lat / f, lng: lng / f });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Speed
// ---------------------------------------------------------------------------

const accOf = (f: Fix) => f.acc ?? GEO_DEFAULTS.unknownAccM;

/** Displacement ÷ Δt between two fixes, or null when Δt is not usable. */
function derivedSpeed(prev: Fix, cur: Fix): { v: number; d: number } | null {
  const dt = (cur.t - prev.t) / 1000;
  if (!(dt > 0) || dt > GEO_DEFAULTS.maxDerivedDtS) return null;
  const d = haversine(prev, cur);
  return { v: d / dt, d };
}

/**
 * The speed to believe for `cur`, m/s (research §1.3):
 * - a fix less accurate than `maxAccM` (default 50 m, the start-detection
 *   limit) has no usable speed → null;
 * - reported speed ≥ 0 wins, except a reported 0 while the fix moved farther
 *   than both accuracy radii at > 2 m/s: that is Android's "no speed" 0;
 * - otherwise (null, negative = iOS invalid) displacement ÷ Δt from `prev`,
 *   when Δt is in (0, 30] s and `prev` is accurate enough too.
 */
export function effectiveSpeed(prev: Fix | null | undefined, cur: Fix, maxAccM = 50): number | null {
  if (cur.acc != null && cur.acc > maxAccM) return null;
  const usablePrev = prev && !(prev.acc != null && prev.acc > maxAccM) ? prev : null;
  const der = usablePrev ? derivedSpeed(usablePrev, cur) : null;
  const s = cur.speed;
  if (s != null && Number.isFinite(s) && s >= 0) {
    if (s === 0 && der && usablePrev && der.v > GEO_DEFAULTS.fakeZeroMs && der.d > accOf(usablePrev) + accOf(cur)) {
      return der.v;
    }
    return s;
  }
  return der ? der.v : null;
}

/**
 * Exponential moving average for the live needle (research §5: α 0.35 ≈ 3 s
 * response at 1 Hz). A missing sample keeps the previous value.
 */
export function emaSpeed(prev: number | null, sample: number | null, alpha = 0.35): number | null {
  if (sample == null) return prev;
  if (prev == null) return sample;
  return alpha * sample + (1 - alpha) * prev;
}

/** m/s → km/h for display, with a dead-band so a parked phone shows 0. */
export function displayKmh(ms: number | null, deadBandMs = 0.8): number {
  if (ms == null || ms < deadBandMs) return 0;
  return ms * 3.6;
}

// ---------------------------------------------------------------------------
// Track cleaning and stats
// ---------------------------------------------------------------------------

export type TrackCfg = {
  trackAccM: number;
  maxJumpSpeedMs: number;
};

/** How many fixes each cleaning rule dropped (IMP 30092026 note 16 diagnostics, ADR-42). */
export type CleanCounts = {
  /** Fixes given. */
  raw: number;
  /** Fixes left after every rule. */
  kept: number;
  /** Accuracy worse than `trackAccM`. */
  droppedAccuracy: number;
  /** Same or earlier timestamp than the last accepted fix. */
  droppedDuplicates: number;
  /** Faster than `maxJumpSpeedMs` from the last accepted fix. */
  droppedJumps: number;
  /** Out-and-back excursions (dropExcursions). */
  droppedExcursions: number;
};

export type CleanReport<T> = CleanCounts & { track: T[] };

/**
 * cleanTrack with the count of what each rule dropped — the same fixes come
 * out; finalize logs the counts and the GeoJSON export carries them.
 */
export function cleanTrackReport<T extends Fix>(points: readonly T[], cfg: Partial<TrackCfg> = {}): CleanReport<T> {
  const trackAccM = cfg.trackAccM ?? GEO_DEFAULTS.trackAccM;
  const maxJump = cfg.maxJumpSpeedMs ?? GEO_DEFAULTS.maxJumpSpeedMs;
  const sorted = points.slice().sort((a, b) => a.t - b.t);
  const out: T[] = [];
  let droppedAccuracy = 0;
  let droppedDuplicates = 0;
  let droppedJumps = 0;
  for (const p of sorted) {
    if (p.acc != null && p.acc > trackAccM) {
      droppedAccuracy++;
      continue;
    }
    const last = out[out.length - 1];
    if (last) {
      if (p.t <= last.t) {
        droppedDuplicates++;
        continue;
      }
      if (isJump(last, p, maxJump)) {
        droppedJumps++;
        continue;
      }
    }
    out.push(p);
  }
  const track = dropExcursions(out);
  return {
    raw: points.length,
    kept: track.length,
    droppedAccuracy,
    droppedDuplicates,
    droppedJumps,
    droppedExcursions: out.length - track.length,
    track,
  };
}

/** The counts of a CleanReport, without the track. */
export function cleanCounts(r: CleanCounts): CleanCounts {
  const { raw, kept, droppedAccuracy, droppedDuplicates, droppedJumps, droppedExcursions } = r;
  return { raw, kept, droppedAccuracy, droppedDuplicates, droppedJumps, droppedExcursions };
}

/**
 * The fixes a track is built from: sorted by time, one per timestamp, accuracy
 * ≤ `trackAccM` (unknown accuracy is kept), no jump faster than
 * `maxJumpSpeedMs` from the last accepted fix, and no out-and-back excursion.
 * Same rules as the state machine (plus the excursions), so recomputing from
 * stored points gives the same route. The trip map draws through it too.
 */
export function cleanTrack<T extends Fix>(points: readonly T[], cfg: Partial<TrackCfg> = {}): T[] {
  return cleanTrackReport(points, cfg).track;
}

/** An excursion leaves the track by more than this… */
const EXCURSION_MIN_M = 300;
/** …at a speed no car turns around at (144 km/h)… */
const EXCURSION_SPEED_MS = 40;
/** …and comes back within this share of how far it went, within this many fixes. */
const EXCURSION_RETURN = 0.5;
const EXCURSION_MAX_FIXES = 12;

/**
 * Drops out-and-back excursions: from fix A the track leaves by more than
 * EXCURSION_MIN_M at over EXCURSION_SPEED_MS and, within a few fixes, comes back
 * near A. The per-fix jump filter lets these through when each leg is slow
 * enough — a phone flipping between two position sources (GPS and a Wi-Fi fix
 * across town) draws exactly that. A real U-turn is never that fast.
 */
export function dropExcursions<T extends Fix>(track: T[]): T[] {
  const out: T[] = [];
  let i = 0;
  while (i < track.length) {
    const a = out[out.length - 1];
    const p = track[i];
    if (a) {
      const dOut = haversine(a, p);
      const dt = (p.t - a.t) / 1000;
      if (dOut > EXCURSION_MIN_M && dt > 0 && dOut / dt > EXCURSION_SPEED_MS) {
        let far = dOut;
        let back = -1;
        for (let j = i + 1; j < Math.min(track.length, i + 1 + EXCURSION_MAX_FIXES); j++) {
          const d = haversine(a, track[j]);
          if (d < far * EXCURSION_RETURN) {
            back = j;
            break;
          }
          far = Math.max(far, d);
        }
        if (back > 0) {
          i = back;
          continue;
        }
      }
    }
    out.push(p);
    i++;
  }
  return out;
}

/** True when going from `a` to `b` implies more than `maxSpeedMs`. */
export function isJump(a: Fix, b: Fix, maxSpeedMs: number = GEO_DEFAULTS.maxJumpSpeedMs): boolean {
  const dt = (b.t - a.t) / 1000;
  if (dt <= 0) return true;
  return haversine(a, b) / dt > maxSpeedMs;
}

/**
 * Distance a segment adds to the trip (research §3 jitter rule): 0 when it is
 * shorter than both accuracy radii together and the speed is under 1 m/s —
 * a parked phone wandering inside its own error circle.
 */
export function segmentDistance(a: Fix, b: Fix, speedMs: number | null): number {
  const d = haversine(a, b);
  const v = speedMs ?? d / Math.max(0.001, (b.t - a.t) / 1000);
  if (d < accOf(a) + accOf(b) && v < GEO_DEFAULTS.jitterSpeedMs) return 0;
  return d;
}

/** Upper edges, km/h, of the first four buckets; the fifth is 120+. */
export const SPEED_BUCKET_EDGES_KMH = [30, 60, 90, 120] as const;

export function bucketIndex(kmh: number): number {
  let i = 0;
  while (i < SPEED_BUCKET_EDGES_KMH.length && kmh >= SPEED_BUCKET_EDGES_KMH[i]) i++;
  return i;
}

export type TripStats = {
  distanceM: number;
  /** last − first accepted fix, s. */
  durationS: number;
  /** Σ Δt of segments at ≥ 1.5 m/s, s. */
  movingS: number;
  avgKmh: number | null;
  avgMovingKmh: number | null;
  /** Max of the 3-sample running median over fixes with acc ≤ 20 m. */
  maxKmh: number | null;
  /**
   * Seconds in <30 · 30–60 · 60–90 · 90–120 · 120+ km/h, over **moving** time
   * only: they sum to `movingS`. Stopped time is `durationS − movingS` and is
   * shown on its own; counting it in "<30" would make every city trip look
   * like it was driven at walking pace.
   */
  speedBuckets: [number, number, number, number, number];
  bbox: BBox | null;
  /** The accepted fixes (after cleanTrack). */
  track: Fix[];
  /** What the cleaning dropped, by rule. */
  cleaning: CleanCounts;
};

const median3 = (a: number, b: number, c: number) => Math.max(Math.min(a, b), Math.min(Math.max(a, b), c));

/**
 * Per-trip stats from its stored points (research §3). Works on any order and
 * any quality of input: it cleans the track first. Durations are fractional
 * seconds; round when writing the INTEGER columns.
 */
export function stats(points: readonly Fix[], cfg: Partial<TrackCfg> = {}): TripStats {
  const cleaned = cleanTrackReport(points, cfg);
  const track = cleaned.track;
  const buckets: TripStats['speedBuckets'] = [0, 0, 0, 0, 0];
  let distanceM = 0;
  let movingS = 0;
  // Speeds of accurate fixes, for the top-speed median.
  const accurate: number[] = [];

  for (let i = 0; i < track.length; i++) {
    const cur = track[i];
    const prev = i > 0 ? track[i - 1] : null;
    const v = effectiveSpeed(prev, cur);
    if (v != null && cur.acc != null && cur.acc <= GEO_DEFAULTS.maxSpeedAccM) accurate.push(v);
    if (!prev) continue;
    const dt = (cur.t - prev.t) / 1000;
    const d = segmentDistance(prev, cur, v);
    distanceM += d;
    // Segment speed: what the fix says, else the displacement over the segment
    // (also covers a GPS gap longer than effectiveSpeed's 30 s window).
    const segV = v ?? d / dt;
    if (segV >= GEO_DEFAULTS.movingSpeedMs) {
      movingS += dt;
      buckets[bucketIndex(segV * 3.6)] += dt;
    }
  }

  let maxMs: number | null = null;
  for (let i = 1; i + 1 < accurate.length; i++) {
    const m = median3(accurate[i - 1], accurate[i], accurate[i + 1]);
    if (maxMs == null || m > maxMs) maxMs = m;
  }

  const durationS = track.length > 1 ? (track[track.length - 1].t - track[0].t) / 1000 : 0;
  return {
    distanceM,
    durationS,
    movingS,
    avgKmh: durationS > 0 ? (distanceM / durationS) * 3.6 : null,
    avgMovingKmh: movingS > 0 ? (distanceM / movingS) * 3.6 : null,
    maxKmh: maxMs == null ? null : maxMs * 3.6,
    speedBuckets: buckets,
    bbox: bbox(track),
    track,
    cleaning: cleanCounts(cleaned),
  };
}
