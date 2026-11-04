/**
 * cg-places (IMP 03112026 SPEC-G §G4, ADR-69, verdict D-04): "gomera / taller / gasolinera / lavado near me", as a LIST.
 *
 * Two sources behind ONE response shape:
 *   osm     (default) OpenStreetMap through Overpass. ODbL: name, phone and address MAY be stored (a contact), with
 *           "© OpenStreetMap contributors". Free, no key. Not Google, so a MapLibre map may sit beside it.
 *   google  (optional, OFF unless the server sets CG_PLACES_GOOGLE=on AND the key exists) Places API (New) text search.
 *           Terms (verified 2026-10-28): §14.1 allows Places content without a Google map; §14.2 forbids it with a non-Google
 *           map; nothing allows persisting its name/phone/address (only the place id). So: list only, Google attribution, "Open in
 *           Google Maps", and the app never saves its fields or draws them on a map. Fields requested are limited by a FieldMask.
 * Privacy: the position is rounded to ~500 m before it is used, and again on the server, so a precise fix never reaches either
 * provider or the logs. Nothing here is stored. Pure: no Deno, no network.
 */
export const KINDS = ['gomera', 'taller', 'gasolinera', 'lavado'] as const;
export type PlaceKind = (typeof KINDS)[number];
export const SOURCES = ['osm', 'google'] as const;
export type PlaceSource = (typeof SOURCES)[number];

/** 0.005° ≈ 550 m of latitude: the privacy grain of SPEC-G §G4. */
export const GRID = 0.005;
export const RADIUS_M = 3000;
export const MAX_RESULTS = 15;

export const roundCoord = (n: number): number => Math.round(n / GRID) * GRID;
/** Float noise from the multiplication (12.345000000000001) never reaches the wire. */
export const clean = (n: number): number => Math.round(n * 1000) / 1000;

export type PlacesInput = { kind: PlaceKind; lat: number; lng: number; source: PlaceSource };

export function parsePlacesInput(body: unknown): PlacesInput | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  const kind = typeof b.kind === 'string' && (KINDS as readonly string[]).includes(b.kind) ? (b.kind as PlaceKind) : null;
  const lat = typeof b.lat === 'number' && Number.isFinite(b.lat) && Math.abs(b.lat) <= 90 ? b.lat : null;
  const lng = typeof b.lng === 'number' && Number.isFinite(b.lng) && Math.abs(b.lng) <= 180 ? b.lng : null;
  if (!kind || lat === null || lng === null) return null;
  const source: PlaceSource = b.source === 'google' ? 'google' : 'osm';
  return { kind, lat: clean(roundCoord(lat)), lng: clean(roundCoord(lng)), source };
}

export type Place = {
  /** osm: "node/123"; google: the place id (the only Google field that may be kept). */
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  /** Google only. */
  rating: number | null;
  open_now: boolean | null;
  /** Metres from the (rounded) search point; null when the provider gave no position. */
  distance_m: number | null;
  /** External link only: the app never draws a place on its own map. */
  maps_url: string;
};
export type PlacesAnswer = { source: PlaceSource; kind: PlaceKind; places: Place[]; attribution: string };

export const ATTRIBUTION: Record<PlaceSource, string> = { osm: '© OpenStreetMap contributors', google: 'Google Maps' };

// ──────────────────────────────────────────────────────────────────────────── OpenStreetMap / Overpass
const OSM_FILTER: Record<PlaceKind, string> = {
  gomera: '["shop"="tyres"]',
  taller: '["shop"="car_repair"]',
  gasolinera: '["amenity"="fuel"]',
  lavado: '["amenity"="car_wash"]',
};

export function overpassQuery(i: Pick<PlacesInput, 'kind' | 'lat' | 'lng'>): string {
  return `[out:json][timeout:10];nwr${OSM_FILTER[i.kind]}(around:${RADIUS_M},${i.lat},${i.lng});out center ${MAX_RESULTS * 2};`;
}

export function haversineM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6_371_000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

const str = (v: unknown, max: number): string | null => (typeof v === 'string' && v.trim() ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : null);

/** A phone as OSM writes it: several numbers separated by ";" → the first, digits and the usual signs only. */
export function firstPhone(v: unknown): string | null {
  const s = str(v, 80);
  if (!s) return null;
  const first = s.split(/[;,/]/)[0]!.replace(/[^\d+()\-\s]/g, '').trim();
  return first.replace(/\D/g, '').length >= 7 ? first : null;
}

export function osmAddress(tags: Record<string, unknown>): string | null {
  const street = [str(tags['addr:street'], 60), str(tags['addr:housenumber'], 12)].filter(Boolean).join(' ');
  const parts = [street || null, str(tags['addr:suburb'], 40), str(tags['addr:city'], 40)].filter(Boolean);
  return parts.length ? parts.join(', ') : null;
}

export const mapsUrl = (lat: number, lng: number): string => `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

export function parseOverpass(json: unknown, origin: { lat: number; lng: number }): Place[] {
  const els = (json as { elements?: unknown })?.elements;
  if (!Array.isArray(els)) return [];
  const out: Place[] = [];
  for (const el of els) {
    const e = el as { type?: string; id?: number; lat?: number; lon?: number; center?: { lat?: number; lon?: number }; tags?: Record<string, unknown> };
    const tags = e.tags ?? {};
    const name = str(tags.name, 80);
    // A place with no name is of no use in a list, and cannot be a contact.
    if (!name || !e.type || typeof e.id !== 'number') continue;
    const lat = e.lat ?? e.center?.lat;
    const lng = e.lon ?? e.center?.lon;
    const has = typeof lat === 'number' && typeof lng === 'number';
    out.push({
      id: `${e.type}/${e.id}`,
      name,
      address: osmAddress(tags),
      phone: firstPhone(tags.phone ?? tags['contact:phone']),
      rating: null,
      open_now: null,
      distance_m: has ? haversineM(origin, { lat: lat!, lng: lng! }) : null,
      maps_url: has ? mapsUrl(lat!, lng!) : `https://www.google.com/maps/search/${encodeURIComponent(name)}`,
    });
  }
  return out.sort((a, b) => (a.distance_m ?? 1e9) - (b.distance_m ?? 1e9)).slice(0, MAX_RESULTS);
}

// ──────────────────────────────────────────────────────────────────────────── Google Places (New), list-only
const GOOGLE_QUERY: Record<PlaceKind, string> = { gomera: 'gomera', taller: 'taller mecánico', gasolinera: 'gasolinera', lavado: 'lavado de carros' };
/** Only what the list shows: no photos, no reviews text, no coordinates (nothing that could be drawn on a map). */
export const GOOGLE_FIELD_MASK = 'places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.rating,places.currentOpeningHours.openNow,places.googleMapsUri';

export function googleBody(i: Pick<PlacesInput, 'kind' | 'lat' | 'lng'>) {
  return {
    textQuery: GOOGLE_QUERY[i.kind],
    languageCode: 'es',
    regionCode: 'DO',
    maxResultCount: MAX_RESULTS,
    locationBias: { circle: { center: { latitude: i.lat, longitude: i.lng }, radius: RADIUS_M } },
  };
}

export function parseGoogle(json: unknown): Place[] {
  const list = (json as { places?: unknown })?.places;
  if (!Array.isArray(list)) return [];
  const out: Place[] = [];
  for (const p of list) {
    const g = p as { id?: string; displayName?: { text?: string }; formattedAddress?: string; nationalPhoneNumber?: string; rating?: number; currentOpeningHours?: { openNow?: boolean }; googleMapsUri?: string };
    const name = str(g.displayName?.text, 80);
    if (!name || typeof g.id !== 'string') continue;
    out.push({
      id: g.id,
      name,
      address: str(g.formattedAddress, 120),
      phone: firstPhone(g.nationalPhoneNumber),
      rating: typeof g.rating === 'number' && g.rating >= 0 && g.rating <= 5 ? g.rating : null,
      open_now: typeof g.currentOpeningHours?.openNow === 'boolean' ? g.currentOpeningHours.openNow : null,
      distance_m: null,
      maps_url: typeof g.googleMapsUri === 'string' && g.googleMapsUri.startsWith('https://') ? g.googleMapsUri : `https://www.google.com/maps/place/?q=place_id:${g.id}`,
    });
  }
  return out.slice(0, MAX_RESULTS);
}

/** Text Search (Pro) is billed per request; the estimate keeps the daily USD cap honest. */
export const GOOGLE_COST_USD = 0.032;
