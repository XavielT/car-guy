/**
 * cg-places handler (SPEC-G §G4). Same gateway as every function (JWT, kill switch, consent, hour limit, daily USD caps, and the
 * per-user DAILY PLACES LIMIT `ai_limit_places_user_day`, counted from this function's own usage rows); the provider is not Anthropic,
 * so "configured" is always true for OpenStreetMap and needs the server switch AND the key for Google. One usage row per call, with the
 * model column naming the provider ("overpass" / "google-places") and a cost of 0 for OSM.
 */
import { AiCallError } from '../_shared/anthropic.ts';
import type { EnvGetter } from '../_shared/env.ts';
import type { Handler } from '../_shared/handler.ts';
import { ATTRIBUTION, GOOGLE_COST_USD, GOOGLE_FIELD_MASK, googleBody, overpassQuery, parseGoogle, parseOverpass, parsePlacesInput, type PlacesAnswer } from './places.ts';

/** The OSM source needs nothing; Google is a separate, explicit server switch (verdict D-04: default OFF). */
export const placesConfigured = (_env: EnvGetter) => true;
export const googleEnabled = (env: EnvGetter) => env('CG_PLACES_GOOGLE') === 'on' && !!env('GOOGLE_MAPS_API_KEY');

export const OVERPASS_ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
const UA = 'CarGuy/2.7 (+https://car-guy.vercel.app; cg-places)';

async function withTimeout<T>(ms: number, run: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  try {
    return await run(ctl.signal);
  } finally {
    clearTimeout(timer);
  }
}

export const placesHandler: Handler = async (ctx) => {
  const input = parsePlacesInput(ctx.body);
  if (!input) throw new AiCallError('bad_input');

  if (input.source === 'google') {
    if (!googleEnabled(ctx.env)) throw new AiCallError('ai_not_configured');
    let json: unknown;
    try {
      json = await withTimeout(10_000, async (signal) => {
        const res = await ctx.fetch('https://places.googleapis.com/v1/places:searchText', {
          method: 'POST',
          signal,
          headers: { 'content-type': 'application/json', 'X-Goog-Api-Key': ctx.env('GOOGLE_MAPS_API_KEY') ?? '', 'X-Goog-FieldMask': GOOGLE_FIELD_MASK },
          body: JSON.stringify(googleBody(input)),
        });
        if (!res.ok) throw new Error(`google ${res.status}`);
        return res.json();
      });
    } catch {
      throw new AiCallError('provider_error');
    }
    const answer: PlacesAnswer = { source: 'google', kind: input.kind, places: parseGoogle(json), attribution: ATTRIBUTION.google };
    return { body: { ...answer }, usage: { model: 'google-places', inputTokens: 0, outputTokens: 0, costUsd: GOOGLE_COST_USD } };
  }

  let json: unknown = null;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      json = await withTimeout(12_000, async (signal) => {
        const res = await ctx.fetch(endpoint, {
          method: 'POST',
          signal,
          headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': UA },
          body: `data=${encodeURIComponent(overpassQuery(input))}`,
        });
        if (!res.ok) throw new Error(`overpass ${res.status}`);
        return res.json();
      });
      break;
    } catch {
      json = null;
    }
  }
  if (json === null) throw new AiCallError('provider_error');
  const answer: PlacesAnswer = { source: 'osm', kind: input.kind, places: parseOverpass(json, input), attribution: ATTRIBUTION.osm };
  return { body: { ...answer }, usage: { model: 'overpass', inputTokens: 0, outputTokens: 0, costUsd: 0 } };
};
