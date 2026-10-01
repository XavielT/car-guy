/**
 * The web half's shared plumbing (ADR-41): maplibre-gl v6 is imported lazily —
 * the first map on a screen pulls it in as its own chunk — and its worker is
 * served from public/maplibre/ (tools/copy-maplibre-worker.mjs). The CSS is a
 * static import in each .web.tsx (a dynamic CSS import breaks Metro).
 */
import type { GeoJSONSource, Map as GLMap, MapOptions } from 'maplibre-gl';

export type MapLibreGL = typeof import('maplibre-gl');
export type { GLMap };

const WORKER_URL = '/maplibre/maplibre-gl-worker.mjs';

let lib: Promise<MapLibreGL> | null = null;

export function loadMapLibre(): Promise<MapLibreGL> {
  if (!lib) {
    lib = import('maplibre-gl').then((m) => {
      m.setWorkerUrl(WORKER_URL);
      return m;
    });
    // A failed import (offline on first visit) may be retried by the next map.
    lib.catch(() => {
      lib = null;
    });
  }
  return lib;
}

/**
 * A map in `container` with `style`. `onFail` fires when the library or the
 * style cannot load (an error before the first `load`); tile errors after that
 * are the map's business. Resolves null when it failed or `cancelled()` turned
 * true meanwhile (the component unmounted).
 */
export async function createMap(
  container: HTMLElement,
  style: string,
  options: Omit<MapOptions, 'container' | 'style'>,
  onFail: () => void,
  cancelled: () => boolean,
): Promise<GLMap | null> {
  let gl: MapLibreGL;
  try {
    gl = await loadMapLibre();
  } catch {
    if (!cancelled()) onFail();
    return null;
  }
  if (cancelled()) return null;
  let map: GLMap;
  try {
    map = new gl.Map({ container, style, attributionControl: { compact: true }, ...options });
  } catch {
    // No WebGL2 (v6 needs it).
    onFail();
    return null;
  }
  let loaded = false;
  map.once('load', () => {
    loaded = true;
  });
  // The compact credit opens expanded once the style's attribution arrives;
  // collapse it to its (i) button (what a drag does) — the screens print the
  // full attribution under every map.
  const collapse = () => {
    const el = container.querySelector('.maplibregl-ctrl-attrib');
    if (!el?.classList.contains('maplibregl-compact')) return;
    el.classList.remove('maplibregl-compact-show');
    map.off('data', collapse);
    map.off('idle', collapse);
  };
  map.on('data', collapse);
  map.on('idle', collapse);
  map.on('error', () => {
    if (!loaded && !cancelled()) onFail();
  });
  return map;
}

/** Replaces a GeoJSON source's data (no-op if the style is not ready yet). */
export function setSourceData(map: GLMap, id: string, data: unknown): void {
  const src = map.getSource(id) as GeoJSONSource | undefined;
  src?.setData(data as Parameters<GeoJSONSource['setData']>[0]);
}
