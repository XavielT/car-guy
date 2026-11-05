/**
 * What a shared recap image may contain (SPEC-J §J5, ADR-74). The privacy rules live HERE, in the model the image is drawn from, not in the
 * drawing: a field that is not in the share model cannot appear in the image. `toShareModel` DROPS, it never hides.
 *
 * Always dropped: the odometer (absolute readings), plate, VIN, anything about overdue reminders or documents, exact places, other people's
 * names. Dropped unless the person turns it on: spend (default OFF), the car's name, the person's own name (default OFF).
 */
import type { Comparison, Recap, RecapCard } from './recap';

export type ShareOptions = { showSpend: boolean; showVehicleName: boolean; showUserName: boolean; userName?: string | null };
export const DEFAULT_SHARE: ShareOptions = { showSpend: false, showVehicleName: true, showUserName: false, userName: null };

export type ShareCard =
  | { kind: 'cover'; headlineKm: number | null; vehicleNames: string[] }
  | { kind: 'distance'; km: number; trips: number; hours: number; longestTripKm: number | null }
  | { kind: 'speed'; topKmh: number; avgMovingKmh: number | null }
  | { kind: 'fuel'; volume: number; efficiency: number | null; spend?: number; avgPrice?: number | null }
  | { kind: 'cost'; total: number; costPerKm: number | null }
  | { kind: 'care'; services: number; repairs: number }
  | { kind: 'build'; mods: number; invested?: number }
  | { kind: 'compare'; previousLabel: string; deltas: { km: Comparison['km']; efficiency: Comparison['efficiency']; spend?: Comparison['spend'] } }
  | { kind: 'months'; months: { month: number; km: number; spend?: number }[] }
  | { kind: 'garage'; cars: { name: string | null; km: number; spend?: number }[] }
  | { kind: 'closer'; highlight: { kind: 'km' | 'trips' | 'topSpeed'; value: number } | null };

export type ShareModel = { id: string; period: Recap['period']; partial: boolean; userName: string | null; cards: ShareCard[] };

export function toShareModel(recap: Recap, options: ShareOptions = DEFAULT_SHARE): ShareModel {
  const cards: ShareCard[] = [];
  for (const c of recap.cards as RecapCard[]) {
    switch (c.kind) {
      case 'cover':
        cards.push({ kind: 'cover', headlineKm: c.headlineKm, vehicleNames: options.showVehicleName ? c.vehicleNames : [] });
        break;
      case 'distance':
        cards.push({ kind: 'distance', km: c.km, trips: c.trips, hours: c.hours, longestTripKm: c.longestTripKm });
        break;
      case 'speed':
        cards.push({ kind: 'speed', topKmh: c.topKmh, avgMovingKmh: c.avgMovingKmh });
        break;
      case 'fuel':
        cards.push(options.showSpend ? { kind: 'fuel', volume: c.volume, efficiency: c.efficiency, spend: c.spend, avgPrice: c.avgPrice } : { kind: 'fuel', volume: c.volume, efficiency: c.efficiency });
        break;
      case 'cost':
        if (options.showSpend) cards.push({ kind: 'cost', total: c.total, costPerKm: c.costPerKm });
        break;
      case 'care':
        // The counts only: never which reminder is overdue or which document expires.
        if (c.services + c.repairs > 0) cards.push({ kind: 'care', services: c.services, repairs: c.repairs });
        break;
      case 'build':
        cards.push(options.showSpend ? { kind: 'build', mods: c.mods, invested: c.invested } : { kind: 'build', mods: c.mods });
        break;
      case 'compare': {
        const deltas: Extract<ShareCard, { kind: 'compare' }>['deltas'] = options.showSpend ? { km: c.deltas.km, efficiency: c.deltas.efficiency, spend: c.deltas.spend } : { km: c.deltas.km, efficiency: c.deltas.efficiency };
        if (deltas.km || deltas.efficiency || deltas.spend) cards.push({ kind: 'compare', previousLabel: c.previousLabel, deltas });
        break;
      }
      case 'months':
        cards.push({ kind: 'months', months: c.months.map((m) => (options.showSpend ? { month: m.month, km: m.km, spend: m.spend } : { month: m.month, km: m.km })) });
        break;
      case 'odometer':
        break; // never: it is an absolute odometer value
      case 'garage':
        cards.push({ kind: 'garage', cars: c.cars.map((x) => (options.showSpend ? { name: options.showVehicleName ? x.name : null, km: x.km, spend: x.spend } : { name: options.showVehicleName ? x.name : null, km: x.km })) });
        break;
      case 'closer':
        cards.push({ kind: 'closer', highlight: c.highlight });
        break;
    }
  }
  return { id: recap.id, period: recap.period, partial: recap.partial, userName: options.showUserName ? (options.userName ?? null) : null, cards };
}

/** Not worth sharing below two cards besides the cover (SPEC-J §J7). */
export const shareableCount = (m: ShareModel): number => m.cards.filter((c) => c.kind !== 'cover' && c.kind !== 'closer').length;
