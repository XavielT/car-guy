/**
 * The adapter between the app's data and the pure engine (IMP 03112026 SPEC-E §E1, PROMPT-05 step 1/2). `predict.ts` takes PLAIN
 * data and imports nothing from the app (so it can also run on the server); THIS file is where the app's own economy logic
 * (partial fills, gauge reconciliation, units) is turned into those plain inputs. It is pure too (no database, no React), so it is
 * tested directly; the database reads that feed it live in lib/db/predictQueries.ts.
 */
import type { VehicleType } from '../db/types';
import type { FillUp } from '../types';
import { partialEconomy, type FuelCfg } from './partialEconomy';
import { classifyFuel, fuelBaseline, type EconomyPoint, type FuelClass, type VehicleClass } from './predict';
import { GAL_L } from './units';

/** The legacy vehicle type → the class the fuel bounds are defined for (a motorcycle and a pickup do not live on a car's scale). */
export function vehicleClassOf(type: VehicleType | string | null | undefined): VehicleClass {
  switch (type) {
    case 'motor': return 'motorcycle';
    case 'camion':
    case 'camioneta':
    case 'guagua': return 'truck';
    case 'jeepeta': return 'suv';
    default: return 'car';
  }
}

/**
 * One engine point per fill-up that has a previous one, from the app's own `partialEconomy`. ONLY a full-to-full span is
 * `measured`: a partial fill, a gauge-reconciled part of a span and an estimate are not, so none of them can ever be called an
 * anomaly. Volumes and economy are normalised to gallons / km per gallon, whatever unit the car counts in.
 */
export function economyPointsOf(fillups: FillUp[], cfg: FuelCfg): EconomyPoint[] {
  const { segments, spans } = partialEconomy(fillups, cfg);
  const toGal = cfg.unitL / GAL_L; // gallons per display unit
  const point = (p: (typeof segments)[number], measured: boolean): EconomyPoint => ({
    fillupId: p.fillUpId,
    at: p.occurredAt.slice(0, 10),
    distanceKm: Number.isFinite(p.distanceKm) ? p.distanceKm : null,
    volumeGal: Number.isFinite(p.volume) ? p.volume * toGal : null,
    kmPerGal: Number.isFinite(p.kmPerUnit) && toGal > 0 ? p.kmPerUnit / toGal : null,
    measured,
  });
  const byFill = new Map<string, EconomyPoint>();
  for (const p of segments) byFill.set(p.fillUpId, point(p, false));
  for (const p of spans) byFill.set(p.fillUpId, point(p, true)); // the full-to-full reading of that fill-up wins
  return [...byFill.values()].sort((a, b) => a.at.localeCompare(b.at));
}

/** The 4-state classification of ONE fill-up, against this car's own plausible baseline (null when it has no previous fill-up). */
export function fuelClassOf(fillupId: string, fillups: FillUp[], cfg: FuelCfg, cls: VehicleClass): (FuelClass & { baseline: number | null; kmPerGal: number | null }) | null {
  const points = economyPointsOf(fillups, cfg);
  const point = points.find((p) => p.fillupId === fillupId);
  if (!point) return null;
  const baseline = fuelBaseline(points, cls, fillupId);
  return { ...classifyFuel(point, baseline, cls), baseline: baseline ? baseline.value : null, kmPerGal: point.kmPerGal };
}
