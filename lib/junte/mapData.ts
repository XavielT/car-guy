/** Pure helpers for the junte map (both halves): bounds of everything shown, route GeoJSON, member colours. */
export type LL = { lat: number; lng: number };

/** Distinct, readable on the dark map; the owner keeps the first. */
export const MEMBER_COLORS = ['#FFB300', '#29B6F6', '#EF5350', '#66BB6A', '#AB47BC', '#FF7043', '#26C6DA', '#D4E157'];
export const memberColor = (i: number) => MEMBER_COLORS[i % MEMBER_COLORS.length];

/** [[west, south], [east, north]] around every point; null without points. A single point gets ~300 m around it. */
export function boundsOf(points: LL[]): [[number, number], [number, number]] | null {
  if (!points.length) return null;
  let [w, s, e, n] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const p of points) {
    w = Math.min(w, p.lng);
    e = Math.max(e, p.lng);
    s = Math.min(s, p.lat);
    n = Math.max(n, p.lat);
  }
  const pad = 0.003;
  if (e - w < pad) [w, e] = [w - pad, e + pad];
  if (n - s < pad) [s, n] = [s - pad, n + pad];
  return [[w, s], [e, n]];
}

export function routesGeoJson(routes: { handle: string; color: string; pieces: LL[][] }[]) {
  return {
    type: 'FeatureCollection' as const,
    features: routes.flatMap((r) =>
      r.pieces
        .filter((p) => p.length >= 2)
        .map((p) => ({
          type: 'Feature' as const,
          properties: { handle: r.handle, color: r.color },
          geometry: { type: 'LineString' as const, coordinates: p.map((q) => [q.lng, q.lat]) },
        })),
    ),
  };
}
