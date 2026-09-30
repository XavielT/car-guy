/**
 * Trip presentation helpers (IMP 29092026 Phase 5A, 03-screens.md "Phase 5"):
 * the SVG route fitted into a box, the speed-bucket distribution, the month
 * summary, the DR equivalences and the small formatters the trip screens
 * share. Pure — no React, no Expo, no database.
 */
import type { Trip } from '../db/types';
import { bucketIndex, centroid, decodePolyline, effectiveSpeed, projector, type Fix, type LatLng, type XY } from './geo';

export type Buckets = [number, number, number, number, number];

/**
 * The five bucket colours (<30 · 30–60 · 60–90 · 90–120 · 120+), green → red
 * like the Wheelz route, ending on the house JDM red.
 */
export const BUCKET_COLORS = ['#3DDC84', '#B8E04A', '#FFB300', '#FF5F00', '#E10600'] as const;

/** `trip.speed_buckets` → five seconds values; anything malformed reads as zeros. */
export function parseBuckets(json: string | null | undefined): Buckets {
  try {
    const v = JSON.parse(json ?? '[]') as unknown;
    if (Array.isArray(v) && v.length === 5 && v.every((n) => typeof n === 'number' && Number.isFinite(n))) {
      return v.map((n) => Math.max(0, n)) as Buckets;
    }
  } catch {
    // fall through
  }
  return [0, 0, 0, 0, 0];
}

/**
 * Whole percentages that add up to exactly 100 (largest remainder), or null
 * when there is no moving time to distribute.
 */
export function bucketPercents(buckets: readonly number[]): number[] | null {
  const total = buckets.reduce((a, b) => a + Math.max(0, b), 0);
  if (!(total > 0)) return null;
  const raw = buckets.map((b) => (Math.max(0, b) / total) * 100);
  const floors = raw.map(Math.floor);
  let left = 100 - floors.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => ({ i, rem: r - Math.floor(r) })).sort((a, b) => b.rem - a.rem || a.i - b.i);
  for (const { i } of order) {
    if (left <= 0) break;
    floors[i] += 1;
    left -= 1;
  }
  return floors;
}

// ---------------------------------------------------------------------------
// Route geometry
// ---------------------------------------------------------------------------

export type Box = { width: number; height: number; pad?: number };

/**
 * Projects lat/lng to meters around their centroid, then scales them into the
 * box with `pad` on every side, keeping the aspect ratio (a north–south trip
 * stays tall) and centring the result. SVG y grows downward, so north is up.
 * A single point (or a trip that never moved) lands in the centre.
 */
export function fitRoute(points: readonly LatLng[], box: Box): XY[] {
  if (!points.length) return [];
  const pad = box.pad ?? 16;
  const o = centroid(points)!;
  const { toXY } = projector(o);
  const xy = points.map(toXY);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of xy) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  const w = Math.max(0, box.width - 2 * pad);
  const h = Math.max(0, box.height - 2 * pad);
  const spanX = maxX - minX;
  const spanY = maxY - minY;
  const span = Math.max(spanX, spanY);
  if (!(span > 0)) return xy.map(() => ({ x: box.width / 2, y: box.height / 2 }));
  const k = Math.min(spanX > 0 ? w / spanX : Infinity, spanY > 0 ? h / spanY : Infinity);
  const offX = pad + (w - spanX * k) / 2;
  const offY = pad + (h - spanY * k) / 2;
  return xy.map((p) => ({ x: offX + (p.x - minX) * k, y: offY + (maxY - p.y) * k }));
}

const r1 = (n: number) => Math.round(n * 10) / 10;

/** "M x y L x y …" for an SVG <Path>, one decimal. Empty for < 2 points. */
export function pathD(xy: readonly XY[]): string {
  if (xy.length < 2) return '';
  return xy.map((p, i) => `${i ? 'L' : 'M'}${r1(p.x)} ${r1(p.y)}`).join(' ');
}

export type ColoredRun = { bucket: number; d: string };

/** Every n-th point so about `maxPoints` remain; first and last always kept. */
export function thinPoints<T>(points: readonly T[], maxPoints = 900): T[] {
  const step = Math.max(1, Math.ceil(points.length / maxPoints));
  if (step === 1) return points.slice();
  const out: T[] = [];
  for (let i = 0; i < points.length; i += step) out.push(points[i]);
  if (out[out.length - 1] !== points[points.length - 1]) out.push(points[points.length - 1]);
  return out;
}

/**
 * The raw GPS points as runs of one speed bucket each, fitted into the box.
 * Each run starts where the previous one ended, so the line is continuous.
 * Long tracks are thinned to about `maxPoints` first (a 1 Hz hour is 3 600
 * points; the phone does not need them all to colour a 360-px card).
 */
export function coloredRuns(
  points: readonly Fix[],
  box: Box,
  maxPoints = 900,
  /** Another projection (the map's Web Mercator, lib/trips/tiles.ts); default fitRoute. */
  project: (pts: readonly LatLng[], box: Box) => XY[] = fitRoute,
): ColoredRun[] {
  if (points.length < 2) return [];
  const thin = thinPoints(points, maxPoints);
  const xy = project(thin, box);
  const runs: { bucket: number; pts: XY[] }[] = [];
  for (let i = 1; i < thin.length; i++) {
    const v = effectiveSpeed(thin[i - 1], thin[i]);
    const b = bucketIndex((v ?? 0) * 3.6);
    const last = runs[runs.length - 1];
    if (last && last.bucket === b) last.pts.push(xy[i]);
    else runs.push({ bucket: b, pts: [xy[i - 1], xy[i]] });
  }
  return runs.map((r) => ({ bucket: r.bucket, d: pathD(r.pts) }));
}

/** The route of a trip row: its stored (simplified) polyline, decoded. */
export function tripRoute(trip: Pick<Trip, 'polyline'>): LatLng[] {
  return trip.polyline ? decodePolyline(trip.polyline) : [];
}

/** Start and end coordinates: the row's columns, else the route's ends. */
export function tripEnds(trip: Pick<Trip, 'startLat' | 'startLng' | 'endLat' | 'endLng' | 'polyline'>): { start: LatLng; end: LatLng } | null {
  const route = tripRoute(trip);
  const start = trip.startLat != null && trip.startLng != null ? { lat: trip.startLat, lng: trip.startLng } : route[0];
  const end = trip.endLat != null && trip.endLng != null ? { lat: trip.endLat, lng: trip.endLng } : route[route.length - 1];
  return start && end ? { start, end } : null;
}

const coord = (p: LatLng) => `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`;

/** Google Maps directions from the start to the end (opens outside the app). */
export function mapsUrl(trip: Pick<Trip, 'startLat' | 'startLng' | 'endLat' | 'endLng' | 'polyline'>): string | null {
  const ends = tripEnds(trip);
  if (!ends) return null;
  return `https://www.google.com/maps/dir/?api=1&origin=${coord(ends.start)}&destination=${coord(ends.end)}`;
}

// ---------------------------------------------------------------------------
// Summaries
// ---------------------------------------------------------------------------

type SummaryTrip = Pick<Trip, 'status' | 'deletedAt' | 'startedAt' | 'distanceM' | 'durationS' | 'maxKmh'>;

export type TripSummary = { count: number; distanceM: number; durationS: number; maxKmh: number | null; longestM: number };

/** Totals over the done, non-deleted trips given. */
export function summarize(trips: readonly SummaryTrip[]): TripSummary {
  const out: TripSummary = { count: 0, distanceM: 0, durationS: 0, maxKmh: null, longestM: 0 };
  for (const t of trips) {
    if (t.status !== 'done' || t.deletedAt) continue;
    out.count += 1;
    out.distanceM += t.distanceM || 0;
    out.durationS += t.durationS || 0;
    out.longestM = Math.max(out.longestM, t.distanceM || 0);
    if (t.maxKmh != null && (out.maxKmh == null || t.maxKmh > out.maxKmh)) out.maxKmh = t.maxKmh;
  }
  return out;
}

/** True when `iso` falls in the local calendar month of `now`. */
export function inMonth(iso: string, now: Date = new Date()): boolean {
  const d = new Date(iso);
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

/** The month's summary (local calendar month of `now`). */
export function monthSummary(trips: readonly SummaryTrip[], now: Date = new Date()): TripSummary {
  return summarize(trips.filter((t) => inMonth(t.startedAt, now)));
}

export type Equivalence = { key: string; km: number };

/** How many times each reference distance fits in `km` (e.g. 7 km → 2 Autódromo laps). */
export function equivalences(km: number, defs: readonly Equivalence[]): { key: string; times: number }[] {
  return defs.filter((d) => d.km > 0).map((d) => ({ key: d.key, times: Math.max(0, km) / d.km }));
}

/** "×12" / "×1.4" / "×0.08": whole above 10, one decimal above 1, two below. */
export function timesLabel(times: number): string {
  if (times >= 10) return `×${Math.round(times).toLocaleString('en-US')}`;
  if (times >= 1) return `×${(Math.round(times * 10) / 10).toString()}`;
  return `×${(Math.round(times * 100) / 100).toString()}`;
}

// ---------------------------------------------------------------------------
// List ordering and formatting
// ---------------------------------------------------------------------------

export type TripFilter = 'todos' | 'mes' | 'largos' | 'rapidos';

type ListTrip = SummaryTrip & { id: string };

/** The list filters of 03-screens.md: all (newest first), this month, longest, fastest. */
export function filterTrips<T extends ListTrip>(trips: readonly T[], filter: TripFilter, now: Date = new Date()): T[] {
  const done = trips.filter((t) => t.status === 'done' && !t.deletedAt);
  const newest = (a: T, b: T) => b.startedAt.localeCompare(a.startedAt);
  switch (filter) {
    case 'mes':
      return done.filter((t) => inMonth(t.startedAt, now)).sort(newest);
    case 'largos':
      return done.sort((a, b) => (b.distanceM || 0) - (a.distanceM || 0) || newest(a, b));
    case 'rapidos':
      return done.sort((a, b) => (b.maxKmh ?? -1) - (a.maxKmh ?? -1) || newest(a, b));
    default:
      return done.sort(newest);
  }
}

/** "12.4" — km with one decimal from meters. */
export function kmLabel(m: number): string {
  return (Math.round((m || 0) / 100) / 10).toFixed(1);
}

/** "25 min" · "1 h 05 min" · "0 min". */
export function durationLabel(s: number): string {
  const min = Math.round(Math.max(0, s || 0) / 60);
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')} min`;
}

/** Local "8:12". */
export function clock(iso: string): string {
  const d = new Date(iso);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** "8:12–8:37", or just the start while the end is unknown. */
export function timeRange(startIso: string, endIso: string | null): string {
  return endIso ? `${clock(startIso)}–${clock(endIso)}` : clock(startIso);
}

/** Whole km/h, or "—". */
export function kmhLabel(v: number | null | undefined): string {
  return v == null || !Number.isFinite(v) ? '—' : String(Math.round(v));
}
