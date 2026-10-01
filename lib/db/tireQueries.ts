import { consumables, settings, tires, wheelSets } from './repos';
import { badgesFor, DEFAULT_HEAT_CYCLE_LIMIT, messagesFor, tireStats, type TireBadge, type TireStats } from '../domain/tireStats';

/**
 * Gomas quemadas (IMP 30092026 note 3, ADR-45): the reads behind the Build →
 * Gomas card, the Cifras block and the share card. Everything is derived from
 * the tire, wheel_set and consumable_usage rows; only the heat-cycle limit is a
 * setting.
 */

export const HEAT_CYCLE_SETTING = 'tire_heat_cycle_limit';
export const HEAT_CYCLE_MIN = 1;
export const HEAT_CYCLE_MAX = 30;

export async function heatCycleLimit(): Promise<number> {
  const n = await settings.get<number>(HEAT_CYCLE_SETTING, DEFAULT_HEAT_CYCLE_LIMIT);
  return Number.isFinite(n) ? Math.min(HEAT_CYCLE_MAX, Math.max(HEAT_CYCLE_MIN, Math.round(n))) : DEFAULT_HEAT_CYCLE_LIMIT;
}

export async function setHeatCycleLimit(n: number): Promise<number> {
  const v = Math.min(HEAT_CYCLE_MAX, Math.max(HEAT_CYCLE_MIN, Math.round(n)));
  await settings.set(HEAT_CYCLE_SETTING, v);
  return v;
}

export type VehicleTireSummary = { stats: TireStats; badges: TireBadge[]; messages: string[]; limit: number };

export async function vehicleTireSummary(vehicleId: string, now: Date = new Date()): Promise<VehicleTireSummary> {
  const [rows, sets, burns, limit] = await Promise.all([
    tires.list(vehicleId),
    wheelSets.list(vehicleId),
    consumables.listWhere({ kind: 'goma_quemada' }),
    heatCycleLimit(),
  ]);
  const stats = tireStats(rows, sets, vehicleId, { now, consumables: burns, heatCycleLimit: limit });
  return { stats, badges: badgesFor(stats), messages: messagesFor(stats), limit };
}
