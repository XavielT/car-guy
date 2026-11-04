/** @jest-environment node */
/**
 * IMP 03112026 SPEC-G §G4 / verdict D-04: cg-places. OpenStreetMap is the default source; Google is list-only, off unless the server
 * switches it on, asks only for list fields, and its content is never given coordinates to draw. The position is rounded to ~500 m.
 */
import type { GateSnapshot } from '../../supabase/functions/_shared/gate.ts';
import { evaluateGate } from '../../supabase/functions/_shared/gate.ts';
import type { Deps, UsageRow } from '../../supabase/functions/_shared/handler.ts';
import { handleAi } from '../../supabase/functions/_shared/handler.ts';
import { googleEnabled, placesConfigured, placesHandler } from '../../supabase/functions/cg-places/logic.ts';
import { ATTRIBUTION, GOOGLE_FIELD_MASK, GRID, firstPhone, googleBody, haversineM, mapsUrl, osmAddress, overpassQuery, parseGoogle, parseOverpass, parsePlacesInput, roundCoord } from '../../supabase/functions/cg-places/places.ts';

describe('parsePlacesInput', () => {
  it('rounds the position to ~500 m before anything uses it', () => {
    const p = parsePlacesInput({ kind: 'gomera', lat: 18.486057, lng: -69.931212 })!;
    expect(p.lat).toBe(18.485);
    expect(p.lng).toBe(-69.93);
    expect(Math.abs(p.lat - 18.486057)).toBeLessThanOrEqual(GRID / 2 + 1e-9);
    expect(roundCoord(18.4999)).toBeCloseTo(18.5, 3);
  });
  it('closed kinds only; a bad or missing position is rejected; osm is the default source', () => {
    expect(parsePlacesInput({ kind: 'hospital', lat: 18, lng: -69 })).toBeNull();
    expect(parsePlacesInput({ kind: 'taller', lat: 'x', lng: -69 })).toBeNull();
    expect(parsePlacesInput({ kind: 'taller', lat: 95, lng: -69 })).toBeNull();
    expect(parsePlacesInput(null)).toBeNull();
    expect(parsePlacesInput({ kind: 'taller', lat: 18, lng: -69 })!.source).toBe('osm');
    expect(parsePlacesInput({ kind: 'taller', lat: 18, lng: -69, source: 'google' })!.source).toBe('google');
    expect(parsePlacesInput({ kind: 'taller', lat: 18, lng: -69, source: 'bing' })!.source).toBe('osm');
  });
});

describe('Overpass', () => {
  it('the query uses the rounded point, a 3 km radius and the right tag per kind', () => {
    expect(overpassQuery({ kind: 'gomera', lat: 18.485, lng: -69.93 })).toContain('["shop"="tyres"](around:3000,18.485,-69.93)');
    expect(overpassQuery({ kind: 'taller', lat: 1, lng: 2 })).toContain('"car_repair"');
    expect(overpassQuery({ kind: 'gasolinera', lat: 1, lng: 2 })).toContain('"fuel"');
    expect(overpassQuery({ kind: 'lavado', lat: 1, lng: 2 })).toContain('"car_wash"');
  });
  const origin = { lat: 18.485, lng: -69.93 };
  const json = {
    elements: [
      { type: 'node', id: 2, lat: 18.49, lon: -69.93, tags: { name: 'Gomera Lejos', phone: '+1 809-555-0102; +1 809-555-0103' } },
      { type: 'way', id: 1, center: { lat: 18.486, lon: -69.931 }, tags: { name: 'Gomera Juan', 'addr:street': 'Calle Duarte', 'addr:housenumber': '12', 'addr:city': 'Santo Domingo', 'contact:phone': '809-555-0101' } },
      { type: 'node', id: 3, lat: 18.485, lon: -69.93, tags: { shop: 'tyres' } },
      { type: 'node', id: 4, tags: { name: 'Sin posición' } },
      { id: 9, tags: { name: 'Sin tipo' } },
    ],
  };
  it('names, nearest first; a place with no name is dropped; a missing position still lists', () => {
    const r = parseOverpass(json, origin);
    expect(r.map((p) => p.name)).toEqual(['Gomera Juan', 'Gomera Lejos', 'Sin posición']);
    expect(r[0]).toMatchObject({ id: 'way/1', phone: '809-555-0101', address: 'Calle Duarte 12, Santo Domingo', rating: null, open_now: null });
    expect(r[0]!.distance_m).toBeLessThan(300);
    expect(r[1]!.phone).toBe('+1 809-555-0102');
    expect(r[2]!.distance_m).toBeNull();
  });
  it('the link is an external Google Maps URL (never a map of ours); garbage in gives an empty list', () => {
    expect(parseOverpass(json, origin)[0]!.maps_url).toBe(mapsUrl(18.486, -69.931));
    expect(parseOverpass(null, origin)).toEqual([]);
    expect(parseOverpass({ elements: 'x' }, origin)).toEqual([]);
  });
  it('helpers', () => {
    expect(firstPhone('abc')).toBeNull();
    expect(firstPhone('123')).toBeNull();
    expect(osmAddress({})).toBeNull();
    expect(haversineM({ lat: 0, lng: 0 }, { lat: 0, lng: 0 })).toBe(0);
  });
});

describe('Google (list-only)', () => {
  it('asks only for list fields: no coordinates, no photos, no review text', () => {
    expect(GOOGLE_FIELD_MASK).not.toMatch(/location|photos|reviews|viewport/);
    expect(GOOGLE_FIELD_MASK).toContain('places.id');
    expect(googleBody({ kind: 'gomera', lat: 18.485, lng: -69.93 })).toMatchObject({ regionCode: 'DO', locationBias: { circle: { center: { latitude: 18.485, longitude: -69.93 } } } });
  });
  it('maps the answer without a position and with the place id', () => {
    const r = parseGoogle({ places: [{ id: 'ChIJabc', displayName: { text: 'Taller X' }, formattedAddress: 'Av. 1', nationalPhoneNumber: '(809) 555-0100', rating: 4.5, currentOpeningHours: { openNow: true }, googleMapsUri: 'https://maps.google.com/?cid=1' }, { id: 'no-name' }] });
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ id: 'ChIJabc', rating: 4.5, open_now: true, distance_m: null, maps_url: 'https://maps.google.com/?cid=1' });
    expect(JSON.stringify(r)).not.toMatch(/latitude|longitude/);
  });
  it('attribution is stated per source', () => {
    expect(ATTRIBUTION.osm).toMatch(/OpenStreetMap/);
    expect(ATTRIBUTION.google).toBe('Google Maps');
  });
  it('Google needs BOTH the server switch and the key', () => {
    expect(googleEnabled(() => undefined)).toBe(false);
    expect(googleEnabled((k) => (k === 'GOOGLE_MAPS_API_KEY' ? 'k' : undefined))).toBe(false);
    expect(googleEnabled((k) => (k === 'CG_PLACES_GOOGLE' ? 'on' : undefined))).toBe(false);
    expect(googleEnabled((k) => ({ CG_PLACES_GOOGLE: 'on', GOOGLE_MAPS_API_KEY: 'k' })[k])).toBe(true);
    expect(placesConfigured(() => undefined)).toBe(true);
  });
});

// ──────────────────────────── through the handler
const OK: GateSnapshot = { enabled: true, consent: true, limits: { user_hour: 30, user_day_usd: 0.5, global_day_usd: 5, places_user_day: 3 }, used: { user_hour: 0, user_day_usd: 0, global_day_usd: 0, function_user_day: 0 } };
const overpassRes = () => new Response(JSON.stringify({ elements: [{ type: 'node', id: 1, lat: 18.486, lon: -69.931, tags: { name: 'Gomera Juan' } }] }), { status: 200 });
function run(body: unknown, opts: { env?: Record<string, string>; model?: (url: string) => Response; gate?: Partial<GateSnapshot['used']> } = {}) {
  const usage: UsageRow[] = [];
  const calls: { url: string; body: string }[] = [];
  const deps: Deps = {
    env: (k) => opts.env?.[k], authUser: async () => 'u1', gateSnapshot: async () => ({ ...OK, used: { ...OK.used, ...opts.gate } }), isAdmin: async () => false,
    insertUsage: async (r) => void usage.push(r),
    fetchImpl: (async (url: string, init: { body: string }) => (calls.push({ url, body: init.body }), (opts.model ?? overpassRes)(url))) as unknown as typeof fetch, sleep: async () => {},
  };
  const req = new Request('https://x.test/f', { method: 'POST', headers: { authorization: 'Bearer t', 'content-type': 'application/json' }, body: JSON.stringify(body) });
  return handleAi(req, 'cg-places', placesHandler, deps, { configured: placesConfigured }).then(async (res) => ({ res, json: await res.json(), usage, calls }));
}

describe('cg-places handler', () => {
  it('OSM by default: works with NO Anthropic key, sends only the ROUNDED point, one usage row at cost 0', async () => {
    const { res, json, usage, calls } = await run({ kind: 'gomera', lat: 18.486057, lng: -69.931212 });
    expect(res.status).toBe(200);
    expect(json).toMatchObject({ source: 'osm', kind: 'gomera', attribution: '© OpenStreetMap contributors' });
    expect(json.places).toHaveLength(1);
    expect(calls).toHaveLength(1);
    expect(decodeURIComponent(calls[0]!.body)).toContain('18.485,-69.93');
    expect(calls[0]!.body).not.toContain('18.486057');
    expect(usage).toEqual([expect.objectContaining({ function: 'cg-places', model: 'overpass', cost_usd: 0, ok: true })]);
  });
  it('falls back to the second Overpass mirror when the first fails', async () => {
    let n = 0;
    const r = await run({ kind: 'taller', lat: 18, lng: -69 }, { model: () => (n++ === 0 ? new Response('busy', { status: 429 }) : overpassRes()) });
    expect(r.res.status).toBe(200);
    expect(r.calls).toHaveLength(2);
    expect(r.calls[0]!.url).not.toBe(r.calls[1]!.url);
  });
  it('every mirror down → a stable error, not a made-up list', async () => {
    const r = await run({ kind: 'taller', lat: 18, lng: -69 }, { model: () => new Response('no', { status: 500 }) });
    expect(r.res.status).not.toBe(200);
    expect(r.json.ok).toBe(false);
  });
  it('Google is refused unless switched on, with no outbound call', async () => {
    const r = await run({ kind: 'gomera', lat: 18, lng: -69, source: 'google' });
    expect(r.res.status).toBe(503);
    expect(r.calls).toHaveLength(0);
  });
  it('Google, when on: field mask sent, key in a header (not the URL), attribution Google Maps, cost recorded', async () => {
    const r = await run(
      { kind: 'gomera', lat: 18, lng: -69, source: 'google' },
      { env: { CG_PLACES_GOOGLE: 'on', GOOGLE_MAPS_API_KEY: 'secret-key' }, model: () => new Response(JSON.stringify({ places: [{ id: 'P1', displayName: { text: 'Gomera' } }] }), { status: 200 }) },
    );
    expect(r.res.status).toBe(200);
    expect(r.json).toMatchObject({ source: 'google', attribution: 'Google Maps' });
    expect(r.calls[0]!.url).toBe('https://places.googleapis.com/v1/places:searchText');
    expect(r.calls[0]!.url).not.toContain('secret-key');
    expect(JSON.stringify(r.json)).not.toContain('secret-key');
    expect(r.usage[0]).toMatchObject({ model: 'google-places', cost_usd: 0.032 });
  });
  it('the daily places limit applies: at the cap the call is refused and nothing is fetched', async () => {
    const r = await run({ kind: 'gomera', lat: 18, lng: -69 }, { gate: { function_user_day: 3 } });
    expect(r.res.status).toBe(429);
    expect(r.calls).toHaveLength(0);
    expect(evaluateGate({ ...OK, used: { ...OK.used, function_user_day: 3 } }, 'cg-places', true)).toBe('cap_user_day');
    expect(evaluateGate({ ...OK, used: { ...OK.used, function_user_day: 2 } }, 'cg-places', true)).toBeNull();
  });
  it('a bad kind is 400 and fetches nothing', async () => {
    const r = await run({ kind: 'casino', lat: 18, lng: -69 });
    expect(r.res.status).toBe(400);
    expect(r.calls).toHaveLength(0);
  });
});
