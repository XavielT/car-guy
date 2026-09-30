/**
 * Fuel stations for the fill-up picker (IMP 30092026 note 7, research 03 §B).
 * Pure. Brands come from refdata/stations.json; what a log stores stays the
 * text the person saw (a brand's name or their own "Otra"), so editing the
 * list never rewrites a saved fill-up.
 */
import type { FuelGroup } from '../types';
import stationsFile from './refdata/stations.json';
import type { RefFile } from './refdata';
import { foldText } from './text';

export type StationBrand = { id: string; name: string; fuels: FuelGroup[]; aliases?: string[] };

export const STATION_BRANDS: StationBrand[] = (stationsFile as RefFile<StationBrand>).items;

/**
 * Brands for a fuel. GLP-only brands (Propagas, Tropigas) only for GLP. Which
 * brands sell GNV is not known, so GNV sees every brand that is not GLP-only.
 */
export function brandsForFuel(group: FuelGroup): StationBrand[] {
  if (group === 'gnv') return STATION_BRANDS.filter((b) => !(b.fuels.length === 1 && b.fuels[0] === 'glp'));
  return STATION_BRANDS.filter((b) => b.fuels.includes(group));
}

/** A typed name that is a brand (accents, case, aliases ignored) becomes the brand's name; else it is kept trimmed. */
export function normaliseStation(typed: string): string {
  const t = typed.trim();
  const f = foldText(t).replace(/\s+/g, ' ');
  if (!f) return '';
  const hit = STATION_BRANDS.find((b) => foldText(b.name) === f || (b.aliases ?? []).some((a) => foldText(a) === f));
  return hit ? hit.name : t;
}

/** The car's own stations, most recent first, without repeats or blanks (the logs' order is newest first or any). */
export function recentStations(logs: readonly { station: string; occurredAt: string }[], limit = 5): string[] {
  const out: string[] = [];
  for (const l of logs.slice().sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))) {
    const s = l.station?.trim();
    if (!s || s === 'Otra' || out.some((o) => foldText(o) === foldText(s))) continue;
    out.push(s);
    if (out.length >= limit) break;
  }
  return out;
}
