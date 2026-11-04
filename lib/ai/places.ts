/**
 * Nearby places, the app side of `cg-places` (IMP 03112026 SPEC-G §G4). The position is ROUNDED to ~500 m here as well as on the server,
 * so a precise fix never leaves the phone. Results are a LIST: nothing is drawn on a map, and nothing from Google is ever saved (only OSM
 * results may become a contact; for Google the app keeps nothing but what the person types).
 */
import type { Place, PlaceKind, PlacesAnswer } from '../../supabase/functions/cg-places/places';
import { GRID, roundCoord } from '../../supabase/functions/cg-places/places';
import type { ContactKind } from '../db/types';
import { callAi } from './client';

export type { Place, PlaceKind, PlacesAnswer };
export { PLACE_KINDS } from './placeKinds';

export async function askPlaces(kind: PlaceKind, fix: { lat: number; lng: number }, source: 'osm' | 'google' = 'osm'): Promise<PlacesAnswer> {
  return callAi<PlacesAnswer>('cg-places', { kind, lat: Math.round(roundCoord(fix.lat) * 1000) / 1000, lng: Math.round(roundCoord(fix.lng) * 1000) / 1000, source });
}

export const PRIVACY_GRID_M = Math.round(GRID * 111_000);

/** What kind of contact a search result becomes. */
export const CONTACT_KIND_FOR: Record<PlaceKind, ContactKind> = { gomera: 'gomera', taller: 'mecanico', gasolinera: 'otro', lavado: 'otro' };

/** The contact form's prefill from a place. Only OpenStreetMap results carry fields; a Google result gives the form nothing but a kind. */
export function contactPrefill(place: Place, kind: PlaceKind, source: 'osm' | 'google'): Record<string, string> {
  const base: Record<string, string> = { kind: CONTACT_KIND_FOR[kind] };
  if (source !== 'osm') return base;
  return {
    ...base,
    name: place.name,
    ...(place.phone ? { phone: place.phone } : {}),
    ...(place.address ? { address: place.address } : {}),
    notes: '© OpenStreetMap contributors',
  };
}

export const distanceLabel = (m: number | null): string => (m == null ? '' : m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1)} km`);
