/**
 * The geo.ts code as it was BEFORE PROMPT-10 (the polyline distance, the 3-sample-median top speed, the dead-band display), kept verbatim so
 * the "before" numbers in docs/imp-03112026/speed-before-after.md can still be reproduced after the real code moved to the SpeedEngine.
 * TEST HELPER ONLY: nothing in the app imports this.
 */
import { GEO_DEFAULTS, bbox, bucketIndex, cleanCounts, cleanTrackReport, effectiveSpeed, segmentDistance, type BBox, type CleanCounts, type Fix, type TrackCfg } from '@/lib/trips/geo';

/** m/s → km/h for display, with a dead-band so a parked phone shows 0. */
export function displayKmh(ms: number | null, deadBandMs = 0.8): number {
  if (ms == null || ms < deadBandMs) return 0;
  return ms * 3.6;
}


export type LegacyTripStats = {
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
export function legacyStats(points: readonly Fix[], cfg: Partial<TrackCfg> = {}): LegacyTripStats {
  const cleaned = cleanTrackReport(points, cfg);
  const track = cleaned.track;
  const buckets: LegacyTripStats['speedBuckets'] = [0, 0, 0, 0, 0];
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


/** liveStore.reduceLive before PROMPT-10: an EMA (α 0.35, ≈ 3 s lag at 1 Hz) and a max taken over the SMOOTHED speed. */
import type { LiveTrip } from '@/lib/trips/liveStore';
export type LegacyLiveFix = { t: number; speedKmh: number; accM: number | null; stepM: number; moving: boolean };
const LEGACY_ALPHA = 0.35;
export function legacyReduceLive(trip: LiveTrip, fix: LegacyLiveFix): LiveTrip {
  const dt = trip.lastFixAt != null ? Math.max(0, (fix.t - trip.lastFixAt) / 1000) : 0;
  const speed = trip.lastFixAt == null ? fix.speedKmh : trip.speedKmh + LEGACY_ALPHA * (fix.speedKmh - trip.speedKmh);
  return {
    ...trip,
    speedKmh: Math.max(0, speed),
    maxKmh: Math.max(trip.maxKmh, speed),
    distanceM: trip.distanceM + Math.max(0, fix.stepM),
    movingS: trip.movingS + (fix.moving ? dt : 0),
    lastFixAt: fix.t,
    gps: fix.accM != null && fix.accM <= 20 ? 'good' : 'weak',
  };
}
