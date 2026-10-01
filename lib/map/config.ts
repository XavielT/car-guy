/**
 * Map configuration (IMP 30092026 Phase 4, ADR-41): the style, the fallback,
 * the attribution and the style health check the map screens use to decide
 * between the MapLibre map and the offline mosaic ("Sin mapa en línea").
 *
 * - Style: OpenFreeMap `dark` (no key, no request limit, no SLA) — fixed, no picker.
 * - Fallback: MapTiler `streets-v2-dark`, only when EXPO_PUBLIC_MAPTILER_KEY is set
 *   (free tier: non-commercial, logo required — fine for a personal app).
 * - Health check: the style JSON is fetched once; a success is remembered for
 *   1 h, a failure for 1 min (a phone that was briefly offline gets the map
 *   back on the next screen, not an hour later). In memory only.
 */
import { t } from '../i18n';

export const OPENFREEMAP_DARK = 'https://tiles.openfreemap.org/styles/dark';
export const OPENFREEMAP_URL = 'https://openfreemap.org';
export const OSM_COPYRIGHT_URL = 'https://www.openstreetmap.org/copyright';
/** Where the attribution link goes: OSM's copyright page names OpenStreetMap, ODbL and the contributors. */
export const ATTRIBUTION_URL = OSM_COPYRIGHT_URL;

const OK_TTL_MS = 60 * 60 * 1000;
const FAIL_TTL_MS = 60 * 1000;
const TIMEOUT_MS = 8000;

/** Dot access on purpose: Metro inlines `process.env.EXPO_PUBLIC_*` only when written out. */
function maptilerKey(): string {
  return (process.env.EXPO_PUBLIC_MAPTILER_KEY ?? '').trim();
}

export function maptilerDark(key: string): string {
  return `https://api.maptiler.com/maps/streets-v2-dark/style.json?key=${encodeURIComponent(key)}`;
}

/** The styles to try, in order. */
export function styleCandidates(key: string = maptilerKey()): string[] {
  return key ? [OPENFREEMAP_DARK, maptilerDark(key)] : [OPENFREEMAP_DARK];
}

/** The attribution shown under every map (in the current language). */
export function mapAttribution(url: string | null = OPENFREEMAP_DARK): string {
  return url && url.includes('maptiler.com') ? t.trips.mapAttributionMaptiler : t.trips.mapAttribution;
}

type Fetch = (url: string, init?: { signal?: AbortSignal }) => Promise<{ ok: boolean; json(): Promise<unknown> }>;

let cache: { url: string | null; at: number } | null = null;
let inflight: Promise<string | null> | null = null;

/** Tests: forget the cached answer. */
export function resetMapStyleCache(): void {
  cache = null;
  inflight = null;
}

/** The cached answer while it is fresh: a style URL, null (no map), or undefined (unknown — check). */
export function cachedMapStyle(now: number = Date.now()): string | null | undefined {
  if (!cache) return undefined;
  const ttl = cache.url ? OK_TTL_MS : FAIL_TTL_MS;
  return now - cache.at < ttl ? cache.url : undefined;
}

async function healthy(url: string, fetchImpl: Fetch): Promise<boolean> {
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), TIMEOUT_MS) : null;
  try {
    const res = await fetchImpl(url, ctrl ? { signal: ctrl.signal } : undefined);
    if (!res.ok) return false;
    const body = (await res.json()) as { version?: unknown; sources?: unknown; layers?: unknown };
    return body != null && typeof body === 'object' && body.version === 8 && Array.isArray(body.layers);
  } catch {
    return false;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * The first style that answers with a valid style JSON, or null when none
 * does (the screens then show the mosaic and "Sin mapa en línea"). Concurrent
 * callers share one check.
 */
export function resolveMapStyle(fetchImpl: Fetch = fetch as unknown as Fetch, candidates: string[] = styleCandidates(), now: () => number = Date.now): Promise<string | null> {
  const hit = cachedMapStyle(now());
  if (hit !== undefined) return Promise.resolve(hit);
  if (inflight) return inflight;
  inflight = (async () => {
    let found: string | null = null;
    for (const url of candidates) {
      if (await healthy(url, fetchImpl)) {
        found = url;
        break;
      }
    }
    cache = { url: found, at: now() };
    inflight = null;
    return found;
  })();
  return inflight;
}

/** A map reported that its style failed after the check passed: remember it as down (1 min). */
export function markMapStyleFailed(now: number = Date.now()): void {
  cache = { url: null, at: now };
}
