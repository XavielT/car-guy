import type { DoneBy, ServiceCategory, ServiceRecord } from '../db/types';
import { addDays, addMonths, daysBetween } from './dates';

/**
 * Repairs (IMP 16102026 Phase 5, N7/X7): the warranty choices, how much warranty is left, and the figures of the
 * "Reparaciones" screen. Pure — no database, no React.
 */

// ── Warranty ────────────────────────────────────────────────────────────────

export type WarrantyChoice = 'none' | 'd30' | 'd90' | 'm6' | 'y1' | 'other';
export const WARRANTY_CHOICES: WarrantyChoice[] = ['none', 'd30', 'd90', 'm6', 'y1', 'other'];

/** The warranty's end date for a quick choice, counted from the day of the repair (a local-noon ISO). */
export function warrantyEnd(choice: Exclude<WarrantyChoice, 'none' | 'other'>, repairedAt: string): string {
  switch (choice) {
    case 'd30':
      return addDays(repairedAt, 30);
    case 'd90':
      return addDays(repairedAt, 90);
    case 'm6':
      return addMonths(repairedAt, 6);
    case 'y1':
      return addMonths(repairedAt, 12);
  }
}

/** Which quick choice a stored warranty matches (so editing shows "90 días", not "Otra"). */
export function warrantyChoiceOf(repairedAt: string, untilDate: string | null, untilKm: number | null): WarrantyChoice {
  if (!untilDate && untilKm == null) return 'none';
  if (!untilDate) return 'other';
  const day = (iso: string) => iso.slice(0, 10);
  for (const c of ['d30', 'd90', 'm6', 'y1'] as const) if (day(warrantyEnd(c, repairedAt)) === day(untilDate)) return c;
  return 'other';
}

export type WarrantyState = { state: 'none' | 'active' | 'today' | 'expired'; days: number };

/** Days left (positive), today, or days since it ended. Without a date there is nothing to count. */
export function warrantyState(untilDate: string | null, today: string): WarrantyState {
  if (!untilDate) return { state: 'none', days: 0 };
  const days = daysBetween(today, untilDate);
  if (days > 0) return { state: 'active', days };
  if (days === 0) return { state: 'today', days: 0 };
  return { state: 'expired', days: -days };
}

/** A warranty "por vencer": still running and within this many days of its end. */
export const WARRANTY_SOON_DAYS = 14;
export function isWarrantySoon(untilDate: string | null, today: string, window = WARRANTY_SOON_DAYS): boolean {
  const s = warrantyState(untilDate, today);
  return (s.state === 'active' && s.days <= window) || s.state === 'today';
}

// ── The list ────────────────────────────────────────────────────────────────

export type RepairFilters = { system: ServiceCategory | ''; shop: string; year: string };
export const NO_REPAIR_FILTERS: RepairFilters = { system: '', shop: '', year: '' };

/** The name a repair's shop goes by in the summary: the contact's, else the typed shop, else null (own work). */
export function shopKey(r: Pick<ServiceRecord, 'doneBy' | 'shop'>): string | null {
  if (r.doneBy === 'self') return null;
  const name = r.shop.trim();
  return name || null;
}

export function repairsOf(records: readonly ServiceRecord[]): ServiceRecord[] {
  return records.filter((r) => r.kind === 'reparacion' && !r.deletedAt).sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
}

export function applyRepairFilters(list: readonly ServiceRecord[], f: RepairFilters): ServiceRecord[] {
  return list.filter(
    (r) =>
      (!f.system || r.system === f.system) &&
      (!f.shop || shopKey(r) === f.shop) &&
      (!f.year || r.occurredAt.slice(0, 4) === f.year),
  );
}

export function repairYears(list: readonly ServiceRecord[]): string[] {
  return [...new Set(list.map((r) => r.occurredAt.slice(0, 4)))].sort().reverse();
}

export function repairShops(list: readonly ServiceRecord[]): string[] {
  return [...new Set(list.map(shopKey).filter((s): s is string => Boolean(s)))].sort((a, b) => a.localeCompare(b));
}

export type ShopSummary = { shop: string; visits: number; spent: number; last: string };

/** Per shop: how many times, how much, and the last visit; biggest spender first. Own work is not a shop. */
export function summarizeByShop(list: readonly ServiceRecord[]): ShopSummary[] {
  const map = new Map<string, ShopSummary>();
  for (const r of list) {
    const key = shopKey(r);
    if (!key) continue;
    const cur = map.get(key) ?? { shop: key, visits: 0, spent: 0, last: '' };
    cur.visits += 1;
    cur.spent += r.totalDop;
    if (r.occurredAt > cur.last) cur.last = r.occurredAt;
    map.set(key, cur);
  }
  return [...map.values()].sort((a, b) => b.spent - a.spent || b.visits - a.visits);
}

export function totalSpent(list: readonly ServiceRecord[]): number {
  return Math.round(list.reduce((sum, r) => sum + r.totalDop, 0) * 100) / 100;
}

export function ownWork(list: readonly ServiceRecord[]): ServiceRecord[] {
  return list.filter((r) => r.doneBy === 'self');
}

/** What the form should ask for, by who did the work. */
export function askForShop(doneBy: DoneBy): boolean {
  return doneBy !== 'self';
}
export function askForLabor(doneBy: DoneBy): boolean {
  return doneBy !== 'self';
}
