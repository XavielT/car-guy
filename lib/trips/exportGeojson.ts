/**
 * A trip as GeoJSON for diagnostics (IMP 30092026 Phase 0, note 16: "the map
 * draws a straight line"). Pure: the raw GPS points the phone still has (30
 * days), the saved simplified polyline, and the numbers the audit needs —
 * point count, time span, the largest gap between fixes, accuracy.
 * lib/trips/shareGeojson.ts writes and shares it; the trip screen offers it on
 * a long press of the map.
 */
import type { Trip } from '../db/types';
import { decodePolyline, haversine, type Fix } from './geo';

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
};

const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = xs.slice().sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export function tripDiagnostics(trip: Pick<Trip, 'polyline' | 'distanceM'>, points: readonly Fix[]): TripDiagnostics {
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
  };
}

/** FeatureCollection: raw points (LineString + one Point per fix), the saved route, and the diagnostics. */
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
  for (const p of pts) {
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
      properties: { kind: 'fix', t: new Date(p.t).toISOString(), speed: p.speed, acc: p.acc, alt: p.alt ?? null, heading: p.heading ?? null },
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
