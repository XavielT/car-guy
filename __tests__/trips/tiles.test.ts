/** OSM tiles under the route: Web Mercator, the fitting zoom, the covering tiles. */
import { fitTiles, MAX_ZOOM, TILE_SIZE, worldPx } from '@/lib/trips/tiles';

it('worldPx: the known tile of Santo Domingo at z=12', () => {
  // Plaza de la Bandera 18.4497, -69.9700 → tile x = 1251, y = 1834 at z12 (slippy-map formula)
  const p = worldPx({ lat: 18.4497, lng: -69.97 }, 12);
  expect(Math.floor(p.x / TILE_SIZE)).toBe(1251);
  expect(Math.floor(p.y / TILE_SIZE)).toBe(1834);
});

it('fits a city drive at a street zoom, centred, and covers the box with tiles', () => {
  const route = [
    { lat: 18.4497, lng: -69.97 },
    { lat: 18.4612, lng: -69.946 },
    { lat: 18.472, lng: -69.925 },
  ];
  const box = { width: 340, height: 220, pad: 16 };
  const fit = fitTiles(route, box)!;
  expect(fit.zoom).toBeGreaterThanOrEqual(12);
  expect(fit.zoom).toBeLessThanOrEqual(14);
  for (const p of fit.xy) {
    expect(p.x).toBeGreaterThanOrEqual(16 - 0.5);
    expect(p.x).toBeLessThanOrEqual(340 - 16 + 0.5);
    expect(p.y).toBeGreaterThanOrEqual(16 - 0.5);
    expect(p.y).toBeLessThanOrEqual(220 - 16 + 0.5);
  }
  // the tiles cover every corner of the box
  const covers = (x: number, y: number) => fit.tiles.some((t) => t.left <= x && x < t.left + TILE_SIZE && t.top <= y && y < t.top + TILE_SIZE);
  expect(covers(0, 0) && covers(339, 0) && covers(0, 219) && covers(339, 219)).toBe(true);
  expect(fit.tiles.length).toBeLessThanOrEqual(9);
  expect(fit.tiles[0].url).toMatch(/^https:\/\/tile\.openstreetmap\.org\/\d+\/\d+\/\d+\.png$/);
});

it('the next zoom in would not fit (deepest that fits)', () => {
  const route = [{ lat: 18.4497, lng: -69.97 }, { lat: 18.472, lng: -69.925 }];
  const box = { width: 340, height: 220, pad: 16 };
  const z = fitTiles(route, box)!.zoom;
  const a = worldPx(route[0], z + 1);
  const b = worldPx(route[1], z + 1);
  expect(Math.abs(a.x - b.x) > 308 || Math.abs(a.y - b.y) > 188).toBe(true);
});

it('one point: street level, centred; nothing for an empty route', () => {
  const fit = fitTiles([{ lat: 18.45, lng: -69.97 }], { width: 200, height: 100 })!;
  expect(fit.zoom).toBe(MAX_ZOOM);
  expect(fit.xy[0]).toEqual({ x: 100, y: 50 });
  expect(fitTiles([], { width: 200, height: 100 })).toBeNull();
});

it('project() places other points in the same box as the fitted ones', () => {
  const route = [{ lat: 18.4497, lng: -69.97 }, { lat: 18.472, lng: -69.925 }];
  const fit = fitTiles(route, { width: 300, height: 200 })!;
  expect(fit.project(route[1])).toEqual(fit.xy[1]);
});
