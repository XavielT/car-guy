/**
 * OpenStreetMap tiles under a trip's route (2.2.2). Pure: Web Mercator maths
 * (the projection the tiles are drawn in), the zoom that fits a route into a
 * box, and which 256 px tiles cover that box.
 *
 * Tile policy (operations.osmfoundation.org/policies/tiles): standard tiles,
 * a User-Agent that names the app (native; a browser sends its own with the
 * page as referrer), the "© OpenStreetMap" credit on the map, only the tiles a
 * screen shows, and the image cache keeps repeat views off the servers.
 */
import type { LatLng, XY } from './geo';
import type { Box } from './present';

export const TILE_SIZE = 256;
export const TILE_URL = (z: number, x: number, y: number) => `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
export const OSM_COPYRIGHT_URL = 'https://www.openstreetmap.org/copyright';
/** Standard tiles go to 19; 17 is street level and plenty for a drive. */
export const MAX_ZOOM = 17;
/** Zoom from which the tiles show individual streets; fitTiles reaches it whenever the route fits. */
export const STREET_ZOOM = 15;
const MIN_ZOOM = 2;
/** Web Mercator's latitude limit. */
const MAX_LAT = 85.05112878;

/** A point in world pixels at zoom `z` (the tile grid is these / 256). */
export function worldPx(p: LatLng, z: number): XY {
  const scale = TILE_SIZE * 2 ** z;
  const lat = Math.max(-MAX_LAT, Math.min(MAX_LAT, p.lat));
  const s = Math.sin((lat * Math.PI) / 180);
  return {
    x: ((p.lng + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * scale,
  };
}

export type TileFit = {
  zoom: number;
  /** The route in box pixels, same order as the input. */
  xy: XY[];
  /** Any other point in the same box pixels (several trips on one map). */
  project: (p: LatLng) => XY;
  /** Tiles to draw: grid coordinates and their place in the box. */
  tiles: { key: string; url: string; left: number; top: number }[];
};

/**
 * The deepest whole zoom at which the route fits the box (minus `pad`), the
 * route centred in it, and the tiles that cover the box. Whole zooms keep the
 * tiles at their native 256 px — no blurry scaling. A route with no extent
 * (one point) gets MAX_ZOOM around it.
 *
 * Street level (IMP 30092026 note 16, ADR-42): the search goes down from
 * MAX_ZOOM (17), so any route that fits at 15 or deeper is drawn at ≥ 15 —
 * where the tiles show the streets the denser route follows. A route too big
 * for the box at 15 gets the deepest zoom that still fits it: cropping the
 * route to force 15 would hide where the trip went.
 */
export function fitTiles(points: readonly LatLng[], box: Box): TileFit | null {
  if (!points.length || !(box.width > 0) || !(box.height > 0)) return null;
  const pad = box.pad ?? 16;
  const w = Math.max(1, box.width - 2 * pad);
  const h = Math.max(1, box.height - 2 * pad);

  const at = (z: number) => {
    const px = points.map((p) => worldPx(p, z));
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of px) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    return { px, minX, minY, maxX, maxY };
  };

  let zoom = MAX_ZOOM;
  let g = at(zoom);
  while (zoom > MIN_ZOOM && (g.maxX - g.minX > w || g.maxY - g.minY > h)) {
    zoom -= 1;
    g = at(zoom);
  }

  // The box's top-left corner in world pixels, with the route centred.
  const originX = (g.minX + g.maxX) / 2 - box.width / 2;
  const originY = (g.minY + g.maxY) / 2 - box.height / 2;
  const xy = g.px.map((p) => ({ x: p.x - originX, y: p.y - originY }));

  const n = 2 ** zoom;
  const tiles: TileFit['tiles'] = [];
  const x0 = Math.floor(originX / TILE_SIZE);
  const x1 = Math.floor((originX + box.width) / TILE_SIZE);
  const y0 = Math.max(0, Math.floor(originY / TILE_SIZE));
  const y1 = Math.min(n - 1, Math.floor((originY + box.height) / TILE_SIZE));
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      const wx = ((tx % n) + n) % n; // wraps across the antimeridian
      tiles.push({
        key: `${zoom}/${wx}/${ty}@${tx}`,
        url: TILE_URL(zoom, wx, ty),
        left: tx * TILE_SIZE - originX,
        top: ty * TILE_SIZE - originY,
      });
    }
  }
  const project = (p: LatLng) => {
    const w0 = worldPx(p, zoom);
    return { x: w0.x - originX, y: w0.y - originY };
  };
  return { zoom, xy, tiles, project };
}
