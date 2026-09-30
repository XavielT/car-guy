/**
 * The trip route as GeoJSON for the MapLibre maps (IMP 30092026 Phase 4,
 * ADR-41/42, research 01 §1 "Per-segment colours", §5 heatmap, §6 live trail).
 * Pure — no React, no MapLibre: both halves (components/map/*.tsx and *.web.tsx)
 * build the same data from here.
 *
 * Colours: the speed buckets of the rest of the trip UI (lib/trips/present.ts
 * BUCKET_COLORS on lib/trips/geo.ts SPEED_BUCKET_EDGES_KMH: <30 · 30–60 ·
 * 60–90 · 90–120 · 120+), so the map, the share card and the distribution bar
 * agree. A segment without a speed (the decoded polyline, after the raw points
 * are purged) is bucket -1 and draws in the single-colour route red.
 */
import type { Feature, FeatureCollection, LineString, Point } from 'geojson';

import { bucketIndex, effectiveSpeed, haversine, type Fix, type LatLng } from './geo';
import { BUCKET_COLORS, type DrawnRoute } from './present';

/** Same shape as components/map/types.ts RoutePoint (kept here so lib/ does not import components/). */
export type RoutePoint = { lat: number; lng: number; speedKmh: number | null; t?: number };

/** [west, south, east, north] — MapLibre's LngLatBounds. */
export type LngLatBounds = [number, number, number, number];
export type Padding = { top: number; right: number; bottom: number; left: number };

/** The route colour when the speed is unknown (RouteSvg's single-colour line). */
export const UNKNOWN_SPEED_COLOR = '#FF3B30';
export const START_COLOR = '#3DDC84';
export const END_COLOR = '#E10600';

export type SegmentProps = { bucket: number };

/** Bucket of a speed in km/h; -1 when unknown. */
export function speedBucket(kmh: number | null | undefined): number {
  return kmh == null || !Number.isFinite(kmh) ? -1 : bucketIndex(Math.max(0, kmh));
}

/**
 * The drawn route (routePointsForDrawing) → RoutePoint[]. Raw points get each
 * fix's speed from the segment that ends at it (effectiveSpeed, the same rule
 * coloredRuns uses); the first fix takes the second's. The polyline has none.
 */
export function routePointsFromDrawn(drawn: DrawnRoute): RoutePoint[] {
  if (drawn.source === 'polyline') return drawn.points.map((p) => ({ lat: p.lat, lng: p.lng, speedKmh: null }));
  const pts: readonly Fix[] = drawn.points;
  const out: RoutePoint[] = pts.map((p, i) => {
    const v = i > 0 ? effectiveSpeed(pts[i - 1], p) : null;
    return { lat: p.lat, lng: p.lng, speedKmh: v == null ? null : v * 3.6, t: p.t };
  });
  if (out.length > 1) out[0].speedKmh = out[1].speedKmh;
  return out;
}

/**
 * LineString features, one per run of segments in the same speed bucket. A
 * segment (i-1 → i) takes point i's bucket; consecutive same-bucket segments
 * merge, and the next run starts on the previous run's last vertex so the line
 * has no gaps.
 */
export function routeSegments(points: readonly RoutePoint[]): FeatureCollection<LineString, SegmentProps> {
  const features: Feature<LineString, SegmentProps>[] = [];
  let cur: [number, number][] = [];
  let curB = Number.NaN;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const bucket = speedBucket(b.speedKmh);
    if (cur.length && bucket === curB) {
      cur.push([b.lng, b.lat]);
      continue;
    }
    if (cur.length > 1) features.push(lineFeature(cur, curB));
    cur = [
      [a.lng, a.lat],
      [b.lng, b.lat],
    ];
    curB = bucket;
  }
  if (cur.length > 1) features.push(lineFeature(cur, curB));
  return { type: 'FeatureCollection', features };
}

function lineFeature(coordinates: [number, number][], bucket: number): Feature<LineString, SegmentProps> {
  return { type: 'Feature', properties: { bucket }, geometry: { type: 'LineString', coordinates } };
}

/**
 * `line-color` for routeSegments: the bucket's colour, the route red when
 * unknown. Typed loosely: the native and web style-spec typings differ.
 */
export function speedColorExpression(): unknown[] {
  const stops: (number | string)[] = [];
  BUCKET_COLORS.forEach((c, i) => stops.push(i, c));
  return ['match', ['get', 'bucket'], ...stops, UNKNOWN_SPEED_COLOR];
}

/** The route's box, or null without points. */
export function routeBounds(points: readonly LatLng[]): LngLatBounds | null {
  if (!points.length) return null;
  let w = Infinity;
  let s = Infinity;
  let e = -Infinity;
  let n = -Infinity;
  for (const p of points) {
    if (p.lng < w) w = p.lng;
    if (p.lng > e) e = p.lng;
    if (p.lat < s) s = p.lat;
    if (p.lat > n) n = p.lat;
  }
  return [w, s, e, n];
}

/** A box never thinner than `minSpanDeg` (≈ 200 m at 0.002°), so one point or a straight N–S line still frames. */
export function padBounds(b: LngLatBounds, minSpanDeg = 0.002): LngLatBounds {
  let [w, s, e, n] = b;
  if (e - w < minSpanDeg) {
    const c = (w + e) / 2;
    w = c - minSpanDeg / 2;
    e = c + minSpanDeg / 2;
  }
  if (n - s < minSpanDeg) {
    const c = (s + n) / 2;
    s = c - minSpanDeg / 2;
    n = c + minSpanDeg / 2;
  }
  return [w, s, e, n];
}

/**
 * Where the camera goes to show the whole route in a `width`×`height` map:
 * the (padded) bounds and a padding of ~12 % of each side (min `minPad`),
 * never more than a third of the side — so a tiny card still has room for the
 * line. Null without points.
 */
export function cameraFit(points: readonly LatLng[], width: number, height: number, minPad = 24): { bounds: LngLatBounds; padding: Padding } | null {
  const b = routeBounds(points);
  if (!b) return null;
  const px = (side: number) => Math.round(Math.min(Math.max(minPad, side * 0.12), side / 3));
  const h = px(width);
  const v = px(height);
  return { bounds: padBounds(b), padding: { top: v, right: h, bottom: v, left: h } };
}

/** Start (green) and end (red) as two Point features with `kind`. */
export function endpointFeatures(points: readonly LatLng[]): FeatureCollection<Point, { kind: 'start' | 'end' }> {
  if (!points.length) return { type: 'FeatureCollection', features: [] };
  const a = points[0];
  const z = points[points.length - 1];
  const pt = (p: LatLng, kind: 'start' | 'end'): Feature<Point, { kind: 'start' | 'end' }> => ({
    type: 'Feature',
    properties: { kind },
    geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
  });
  return { type: 'FeatureCollection', features: points.length > 1 ? [pt(a, 'start'), pt(z, 'end')] : [pt(a, 'start')] };
}

/** One point (the replay dot), or an empty collection. */
export function pointFeature(p: LatLng | null | undefined): FeatureCollection<Point> {
  return { type: 'FeatureCollection', features: p ? [{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [p.lng, p.lat] } }] : [] };
}

/**
 * Points every `spacingM` along each route (research 01 §5: fixed spacing, so
 * dense GPS in slow traffic does not dominate the heat by itself). Each route's
 * first vertex is kept; the walk carries the remainder across vertices. Stops
 * at `maxPoints` overall.
 */
export function sampleAlong(routes: readonly (readonly LatLng[])[], spacingM = 35, maxPoints = 20_000): LatLng[] {
  const out: LatLng[] = [];
  for (const r of routes) {
    if (!r.length) continue;
    if (out.length >= maxPoints) break;
    out.push({ lat: r[0].lat, lng: r[0].lng });
    let carry = 0; // metres walked since the last sample
    for (let i = 1; i < r.length && out.length < maxPoints; i++) {
      const a = r[i - 1];
      const b = r[i];
      const d = haversine(a, b);
      if (!(d > 0)) continue;
      let at = spacingM - carry; // distance along this segment of the next sample
      while (at <= d && out.length < maxPoints) {
        const k = at / d;
        out.push({ lat: a.lat + (b.lat - a.lat) * k, lng: a.lng + (b.lng - a.lng) * k });
        at += spacingM;
      }
      carry = d - (at - spacingM);
    }
  }
  return out;
}

/** Sampled points as a Point FeatureCollection for the heatmap layer. */
export function heatFeatures(points: readonly LatLng[]): FeatureCollection<Point> {
  return {
    type: 'FeatureCollection',
    features: points.map((p) => ({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [p.lng, p.lat] } })),
  };
}

/**
 * The live trail in two sources (research 01 §6): the committed part — the
 * first `committedLength(n)` points, which changes only every `every` updates
 * (≈ 10 s at the caller's ≤ 1 Hz) — and the tail from the last committed
 * point to the newest, rebuilt on every update. Both slices share the joint
 * point so the lines meet.
 */
export function committedLength(n: number, every = 10): number {
  return Math.max(0, Math.floor(n / every) * every);
}

export function tailStart(committedLen: number): number {
  return Math.max(0, committedLen - 1);
}

/** Paint shared by both halves — the casing under the coloured line, then the line. */
export const ROUTE_CASING_PAINT = { 'line-color': '#000000', 'line-width': 8, 'line-opacity': 0.55 } as const;
export const ROUTE_LINE_WIDTH = 4.5;
export const ROUTE_LINE_LAYOUT = { 'line-cap': 'round', 'line-join': 'round' } as const;

/** heatmap layer paint: the JDM amber → red ramp; fades out at street zoom where the lines take over. */
export function heatmapPaint(): Record<string, unknown> {
  return {
    'heatmap-weight': 1,
    'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 8, 0.6, 15, 1.6],
    'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 8, 8, 12, 14, 15, 22],
    'heatmap-color': [
      'interpolate',
      ['linear'],
      ['heatmap-density'],
      0,
      'rgba(0,0,0,0)',
      0.15,
      'rgba(255,179,0,0.35)',
      0.4,
      '#FFB300',
      0.7,
      '#FF5F00',
      1,
      '#E10600',
    ],
    'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 13, 0.9, 16, 0.25],
  };
}
