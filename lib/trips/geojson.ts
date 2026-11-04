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

import { bucketIndex, haversine, type Fix, type LatLng } from './geo';
import { segmentSpeedsKmh } from './speed';
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
 * fix's speed from the SpeedEngine (lib/trips/speed.ts: the same fused speed the cluster and the trip card use, smoothed over ±2 fixes);
 * the first fix takes the second's. The polyline has none.
 */
export function routePointsFromDrawn(drawn: DrawnRoute): RoutePoint[] {
  if (drawn.source === 'polyline') return drawn.points.map((p) => ({ lat: p.lat, lng: p.lng, speedKmh: null }));
  const pts: readonly Fix[] = drawn.points;
  const speeds = segmentSpeedsKmh(pts);
  const out: RoutePoint[] = pts.map((p, i) => ({ lat: p.lat, lng: p.lng, speedKmh: i > 0 ? speeds[i] : null, t: p.t }));
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

/** A route-frequency edge: how many times a ~15 m stretch of road was driven (both directions together). */
export type FrequencyProps = { count: number };

/** Resolution of the frequency layer: points every 15 m, edges snapped to a 15 m grid. */
export const FREQUENCY_STEP_M = 15;
/** The most edges drawn: a garage's years of driving stays a few thousand short lines. */
export const FREQUENCY_MAX_EDGES = 20_000;

/** Points every `stepM` along one route (its first vertex kept). The walk carries the remainder across vertices. */
function resample(route: readonly LatLng[], stepM: number): LatLng[] {
  if (!route.length) return [];
  const out: LatLng[] = [{ lat: route[0].lat, lng: route[0].lng }];
  let carry = 0;
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1];
    const b = route[i];
    const d = haversine(a, b);
    if (!(d > 0)) continue;
    let at = stepM - carry;
    while (at <= d) {
      const k = at / d;
      out.push({ lat: a.lat + (b.lat - a.lat) * k, lng: a.lng + (b.lng - a.lng) * k });
      at += stepM;
    }
    carry = d - (at - stepM);
  }
  return out;
}

/**
 * "Por dónde manejas" as FREQUENCY of road, not a blob of density (SPEC-I §I4, PROMPT-10 step 7): every route is resampled every 15 m, each
 * sample is snapped to a ~15 m grid cell, and every pair of consecutive cells is an EDGE whose `count` is how many times it was driven.
 * The two directions of a road are one edge (a commute there and back counts 2); a repeated cell is not an edge; and a cell's position is the
 * mean of the samples that fell in it, so the lines follow the roads instead of stair-stepping along the grid. At most
 * `FREQUENCY_MAX_EDGES` edges (a rarely driven stretch is dropped before a busy one is counted twice).
 */
export function routeFrequency(routes: readonly (readonly LatLng[])[], stepM = FREQUENCY_STEP_M, maxEdges = FREQUENCY_MAX_EDGES): FeatureCollection<LineString, FrequencyProps> {
  const first = routes.find((r) => r.length)?.[0];
  if (!first) return { type: 'FeatureCollection', features: [] };
  const dLat = stepM / 111_194.9;
  const dLng = stepM / (111_194.9 * Math.cos((first.lat * Math.PI) / 180));
  const cellOf = (p: LatLng): [number, number] => [Math.round(p.lng / dLng), Math.round(p.lat / dLat)];
  const keyOf = (c: [number, number]) => c[0] + ',' + c[1];
  const sums = new Map<string, { lat: number; lng: number; n: number }>();
  const edges = new Map<string, { a: string; b: string; count: number }>();
  for (const route of routes) {
    const pts = resample(route, stepM);
    let prev: string | null = null;
    for (const p of pts) {
      const k = keyOf(cellOf(p));
      const s = sums.get(k);
      if (s) {
        s.lat += p.lat;
        s.lng += p.lng;
        s.n += 1;
      } else sums.set(k, { lat: p.lat, lng: p.lng, n: 1 });
      if (prev != null && prev !== k) {
        const [x, y] = prev < k ? [prev, k] : [k, prev];
        const ek = x + '|' + y;
        const e = edges.get(ek);
        if (e) e.count += 1;
        else if (edges.size < maxEdges) edges.set(ek, { a: x, b: y, count: 1 });
      }
      prev = k;
    }
  }
  const at = (k: string): [number, number] => {
    const s = sums.get(k)!;
    return [s.lng / s.n, s.lat / s.n];
  };
  const features: Feature<LineString, FrequencyProps>[] = [];
  for (const e of edges.values()) features.push({ type: 'Feature', properties: { count: e.count }, geometry: { type: 'LineString', coordinates: [at(e.a), at(e.b)] } });
  return { type: 'FeatureCollection', features };
}

/** A line width that grows from `z10` to `z16` (px) and a little with how often the road was driven (+ up to 1 px by log count). */
const byCount = ['min', 1, ['*', 0.35, ['ln', ['max', 1, ['get', 'count']]]]];
const widthAt = (px: number) => ['+', px, byCount];

/**
 * Paint of the frequency layers (SPEC-I §I4). Thin: 0.8 px at z10 → 2.4 px at z16 for ONE pass, up to 1 px more by log(count); amber → orange → red by
 * count; opacity rises with zoom (it does not fade out); and a faint glow underneath (the same geometry at 2.5× the width, blurred, 20 % opacity).
 * No radius blobs, no casing. Typed loosely: the native and web style-spec typings differ.
 */
export function frequencyPaint(): { glow: Record<string, unknown>; line: Record<string, unknown>; layout: Record<string, unknown> } {
  const color = ['interpolate', ['linear'], ['get', 'count'], 1, '#FFB300', 4, '#FF5F00', 10, '#E10600'];
  return {
    glow: {
      'line-color': color,
      'line-width': ['interpolate', ['linear'], ['zoom'], 10, widthAt(0.8 * 2.5), 16, widthAt(2.4 * 2.5)],
      'line-blur': ['interpolate', ['linear'], ['zoom'], 10, 2, 16, 3],
      'line-opacity': 0.2,
    },
    line: {
      'line-color': color,
      'line-width': ['interpolate', ['linear'], ['zoom'], 10, widthAt(0.8), 16, widthAt(2.4)],
      'line-opacity': ['interpolate', ['linear'], ['zoom'], 10, 0.6, 16, 0.95],
    },
    layout: { 'line-cap': 'round', 'line-join': 'round' },
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

/**
 * Paint shared by both halves — the casing under the coloured line, then the line. One map language with the frequency layer (SPEC-I §I4):
 * ~3 px of line over a ~5 px casing at street zoom, thinner when zoomed out, so a whole city of routes does not become a thick smear.
 */
export const ROUTE_CASING_PAINT = { 'line-color': '#000000', 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 3, 16, 5.5], 'line-opacity': 0.55 } as const;
export const ROUTE_LINE_WIDTH = ['interpolate', ['linear'], ['zoom'], 10, 1.8, 16, 3.4] as const;
/** The live trail is a touch heavier than a finished route: it is what you watch while driving. */
export const TRAIL_LINE_WIDTH = ['interpolate', ['linear'], ['zoom'], 10, 2.4, 16, 4.2] as const;
export const ROUTE_LINE_LAYOUT = { 'line-cap': 'round', 'line-join': 'round' } as const;
