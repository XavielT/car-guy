import { decodePolyline, project, type LatLng } from '../trips/geo';

/**
 * A shared route (trip_share.polyline_trimmed): a JSON array of encoded pieces — a privacy zone splits a route
 * and the pieces are never joined (ADR-56). An older single string reads as one piece.
 */
export function encodeShareRoute(encoded: string[]): string {
  return JSON.stringify(encoded);
}

export function decodeShareRoute(stored: string | null | undefined): LatLng[][] {
  if (!stored) return [];
  let pieces: string[];
  try {
    const v = JSON.parse(stored);
    pieces = Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [stored];
  } catch {
    pieces = [stored];
  }
  return pieces.map((p) => decodePolyline(p)).filter((seg) => seg.length >= 2);
}

/** SVG paths fitted to a w×h box with padding, one per piece (same projection for all). */
export function routePaths(pieces: LatLng[][], w: number, h: number, pad = 8): string[] {
  const all = pieces.flat();
  if (all.length < 2) return [];
  const xy = project(all);
  const xs = xy.map((p) => p.x);
  const ys = xy.map((p) => p.y);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const scale = Math.min((w - 2 * pad) / Math.max(1, maxX - minX), (h - 2 * pad) / Math.max(1, maxY - minY));
  const ox = (w - (maxX - minX) * scale) / 2;
  const oy = (h - (maxY - minY) * scale) / 2;
  let i = 0;
  return pieces.map((seg) =>
    seg
      .map(() => {
        const p = xy[i++];
        // y grows north in the projection; SVG grows down.
        return `${(ox + (p.x - minX) * scale).toFixed(1)},${(h - oy - (p.y - minY) * scale).toFixed(1)}`;
      })
      .map((pt, k) => (k === 0 ? `M${pt}` : `L${pt}`))
      .join(' '),
  );
}
