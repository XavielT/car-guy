/**
 * Per-trip stats from the stored points (research §3, PROMPT-10). The numbers come from the SpeedEngine (lib/trips/speed.ts), the same
 * code the live needle uses, so a trip's saved top speed IS the one the cluster showed (ADR-72). The track itself is cleaned here with the
 * unchanged rules of geo.ts (accuracy, jumps, excursions): the engine decides speed and distance, the cleaning decides which fixes exist.
 */
import { bbox, cleanCounts, cleanTrackReport, bucketIndex, type BBox, type CleanCounts, type Fix, type TrackCfg } from './geo';
import { analyzeFixes } from './speed';

export type TripStats = {
  distanceM: number;
  /** last − first accepted fix, s. */
  durationS: number;
  /** Time the car moved (stops excluded), s. */
  movingS: number;
  /** Distance ÷ elapsed. */
  avgKmh: number | null;
  /** Distance ÷ moving time. */
  avgMovingKmh: number | null;
  /** The highest speed SUSTAINED ≥ 2 s on accurate fixes; never a single spike. */
  maxKmh: number | null;
  /** When the top speed was reached (epoch ms). */
  topAt: number | null;
  /** True when no fix was accurate enough for the top speed and it comes from worse ones. */
  topApprox: boolean;
  /**
   * Seconds in <30 · 30–60 · 60–90 · 90–120 · 120+ km/h over **moving** time only: they sum to `movingS`. Stopped time is
   * `durationS − movingS` and is shown on its own; counting it in "<30" would make every city trip look like it was walked.
   */
  speedBuckets: [number, number, number, number, number];
  bbox: BBox | null;
  /** The accepted fixes (after cleaning). */
  track: Fix[];
  /** What the cleaning dropped, by rule. */
  cleaning: CleanCounts;
};

/** Works on any order and any quality of input: it cleans the track first. Durations are fractional seconds; round when writing INTEGER columns. */
export function stats(points: readonly Fix[], cfg: Partial<TrackCfg> = {}): TripStats {
  const cleaned = cleanTrackReport(points, cfg);
  const track = cleaned.track;
  const { samples, summary } = analyzeFixes(track);

  const buckets: TripStats['speedBuckets'] = [0, 0, 0, 0, 0];
  for (let i = 1; i < samples.length; i++) {
    if (!samples[i].moving) continue;
    const dt = Math.min(5, (samples[i].t - samples[i - 1].t) / 1000);
    buckets[bucketIndex(samples[i].ms * 3.6)] += dt;
  }
  const bucketSum = buckets.reduce((a, b) => a + b, 0);
  // The buckets and `movingS` are two sums of the same moments; make them agree exactly (a gap longer than 5 s is not "moving time" in either).
  const movingS = Math.min(summary.movingS, bucketSum > 0 ? bucketSum : summary.movingS);

  const durationS = track.length > 1 ? (track[track.length - 1].t - track[0].t) / 1000 : 0;
  return {
    distanceM: summary.distanceM,
    durationS,
    movingS,
    avgKmh: durationS > 0 ? (summary.distanceM / durationS) * 3.6 : null,
    avgMovingKmh: movingS > 0 ? (summary.distanceM / movingS) * 3.6 : null,
    maxKmh: summary.topKmh,
    topAt: summary.topAt,
    topApprox: summary.topApprox,
    speedBuckets: buckets,
    bbox: bbox(track),
    track,
    cleaning: cleanCounts(cleaned),
  };
}
