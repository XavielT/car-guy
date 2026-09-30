/**
 * A trip as GeoJSON for diagnostics (IMP 30092026 Phase 0, note 16: "the map
 * draws a straight line"). Pure: the raw GPS points the phone still has (30
 * days), the saved simplified polyline, and the numbers the audit needs —
 * point count, time span, the largest gap between fixes, accuracy.
 * lib/trips/shareGeojson.ts writes and shares it; the trip screen offers it on
 * a long press of the map.
 */
import type { Trip } from '../db/types';
import { cleanCounts, cleanTrackReport, decodePolyline, haversine, type CleanCounts, type Fix } from './geo';

type Feature = { type: 'Feature'; geometry: { type: string; coordinates: unknown }; properties: Record<string, unknown> };

export type TripDiagnostics = {
  pointCount: number;
  polylinePoints: number;
  firstFixAt: string | null;
  lastFixAt: string | null;
  /** Largest time between two consecutive raw fixes (s) and how far apart they were (m). */
  maxGapS: number | null;
  maxGapM: number | null;
  medianIntervalS: number | null;
  medianAccM: number | null;
  distanceRawM: number;
  distanceSavedM: number;
  /** Raw fixes after the trip's end (the parked tail of a 'stop' close) — left out of `cleaning`. */
  pointsAfterEnd: number;
  /**
   * The stats' cleaning over the fixes up to the end (what finalize saw):
   * raw vs kept, and what each rule dropped (ADR-42 — was it the excursion filter?).
   */
  cleaning: CleanCounts;
};

const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = xs.slice().sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export function tripDiagnostics(trip: Pick<Trip, 'polyline' | 'distanceM'> & { endedAt?: string | null }, points: readonly Fix[]): TripDiagnostics {
  const pts = points.slice().sort((a, b) => a.t - b.t);
  let maxGapS: number | null = null;
  let maxGapM: number | null = null;
  let raw = 0;
  const intervals: number[] = [];
  for (let i = 1; i < pts.length; i++) {
    const dt = (pts[i].t - pts[i - 1].t) / 1000;
    const d = haversine(pts[i - 1], pts[i]);
    raw += d;
    intervals.push(dt);
    if (maxGapS == null || dt > maxGapS) {
      maxGapS = dt;
      maxGapM = d;
    }
  }
  const acc = pts.map((p) => p.acc).filter((a): a is number => a != null);
  const end = trip.endedAt ? Date.parse(trip.endedAt) : NaN;
  const upToEnd = Number.isFinite(end) ? pts.filter((p) => p.t <= end) : pts;
  return {
    pointCount: pts.length,
    polylinePoints: trip.polyline ? decodePolyline(trip.polyline).length : 0,
    firstFixAt: pts.length ? new Date(pts[0].t).toISOString() : null,
    lastFixAt: pts.length ? new Date(pts[pts.length - 1].t).toISOString() : null,
    maxGapS,
    maxGapM: maxGapM != null ? Math.round(maxGapM) : null,
    medianIntervalS: median(intervals),
    medianAccM: median(acc),
    distanceRawM: Math.round(raw),
    distanceSavedM: trip.distanceM,
    pointsAfterEnd: pts.length - upToEnd.length,
    cleaning: cleanCounts(cleanTrackReport(upToEnd)),
  };
}

/** FeatureCollection: raw points (LineString + one Point per fix, `kept` by the cleaning), the cleaned track, the saved route, and the diagnostics. */
export function tripGeojson(trip: Trip, points: readonly Fix[]): string {
  const pts = points.slice().sort((a, b) => a.t - b.t);
  const features: Feature[] = [];
  const saved = trip.polyline ? decodePolyline(trip.polyline) : [];
  if (saved.length > 1) {
    features.push({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: saved.map((p) => [p.lng, p.lat]) },
      properties: { kind: 'saved-route', stroke: '#E10600' },
    });
  }
  if (pts.length > 1) {
    features.push({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: pts.map((p) => [p.lng, p.lat]) },
      properties: { kind: 'raw-track', stroke: '#FFB300' },
    });
  }
  // What the stats and the trip map use (ADR-42): the cleaned track, and per fix whether it survived.
  const end = trip.endedAt ? Date.parse(trip.endedAt) : NaN;
  const clean = cleanTrackReport(Number.isFinite(end) ? pts.filter((p) => p.t <= end) : pts).track;
  if (clean.length > 1) {
    features.push({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: clean.map((p) => [p.lng, p.lat]) },
      properties: { kind: 'clean-track', stroke: '#3DDC84' },
    });
  }
  const kept = new Set(clean);
  for (const p of pts) {
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
      properties: { kind: 'fix', t: new Date(p.t).toISOString(), speed: p.speed, acc: p.acc, alt: p.alt ?? null, heading: p.heading ?? null, kept: kept.has(p) },
    });
  }
  return JSON.stringify({
    type: 'FeatureCollection',
    properties: {
      app: 'car-guy',
      tripId: trip.id,
      source: trip.source,
      status: trip.status,
      startedAt: trip.startedAt,
      endedAt: trip.endedAt,
      segments: trip.segments,
      diagnostics: tripDiagnostics(trip, pts),
    },
    features,
  });
}
