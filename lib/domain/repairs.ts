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

// ── "Is this price fair?" — against the person's OWN history only (SPEC-D §D4) ──────────────────────────────

export type PriceVerdict = 'no_baseline' | 'higher' | 'similar' | 'lower';
export type PriceComparison = {
  verdict: PriceVerdict;
  /** How many earlier repairs make up the baseline. */
  n: number;
  last: { total: number; date: string; title: string } | null;
  median: number | null;
  /** +38 means 38 % more than the last one; negative = cheaper. Whole percent. */
  vsLastPct: number | null;
  vsMedianPct: number | null;
};

/** Within ± this share of the baseline it is "similar". */
export const SIMILAR_BAND = 0.1;
/** With at least this many earlier repairs the median is the baseline; with fewer, the last one is. */
export const MEDIAN_FROM = 3;

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const words = (s: string) => new Set(fold(s).split(/[^a-z0-9]+/).filter((w) => w.length >= 4));
const sharesWord = (a: string, b: string) => {
  const wb = words(b);
  for (const w of words(a)) if (wb.has(w)) return true;
  return false;
};
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const pct = (now: number, base: number) => (base > 0 ? Math.round(((now - base) / base) * 100) : null);

/**
 * Compares a repair's total with the SAME person's earlier repairs of the same system (and, when some of them share a word
 * with the title, only those: "frenos" next to "pastillas de frenos"). No market figure is ever invented: with nothing to
 * compare against the answer is `no_baseline` and the screen says so.
 */
export function priceVsHistory(
  candidate: { id?: string; system: ServiceCategory | null; title: string; totalDop: number; occurredAt: string },
  history: readonly ServiceRecord[],
): PriceComparison {
  const none: PriceComparison = { verdict: 'no_baseline', n: 0, last: null, median: null, vsLastPct: null, vsMedianPct: null };
  if (!(candidate.totalDop > 0)) return none;

  const earlier = repairsOf(history).filter((r) => r.id !== candidate.id && r.totalDop > 0 && r.occurredAt < candidate.occurredAt);
  const sameSystem = candidate.system ? earlier.filter((r) => r.system === candidate.system) : earlier;
  const sameThing = sameSystem.filter((r) => sharesWord(r.title, candidate.title));
  const base = sameThing.length ? sameThing : candidate.system ? sameSystem : [];
  if (!base.length) return none;

  const last = base[0]; // repairsOf sorts newest first
  const med = median(base.map((r) => r.totalDop));
  const vsLastPct = pct(candidate.totalDop, last.totalDop);
  const vsMedianPct = base.length >= MEDIAN_FROM ? pct(candidate.totalDop, med) : null;
  const against = vsMedianPct ?? vsLastPct;
  const verdict: PriceVerdict = against == null ? 'no_baseline' : Math.abs(against) <= SIMILAR_BAND * 100 ? 'similar' : against > 0 ? 'higher' : 'lower';
  return { verdict, n: base.length, last: { total: last.totalDop, date: last.occurredAt.slice(0, 10), title: last.title }, median: base.length >= MEDIAN_FROM ? med : null, vsLastPct, vsMedianPct };
}

// ── Warranty watcher (SPEC-D §D4) ────────────────────────────────────────────────────────────────────────

export type WarrantyBanner = {
  recordId: string;
  title: string;
  shop: string | null;
  untilDate: string | null;
  untilKm: number | null;
  /** Days left, or null when the warranty is counted only in km. */
  daysLeft: number | null;
  /** Km left, or null when the odometer is unknown or the warranty has no km limit. */
  kmLeft: number | null;
};

/**
 * Earlier repairs of the SAME system whose warranty is still running, so a new repair in that system can say "this part may
 * still be under warranty (Taller Pérez, until 12 Jan)". A warranty "6 months OR 10,000 km" ends at whichever comes first:
 * it is active only while NEITHER limit has been passed. A repair with no system never matches (nothing to compare).
 */
export function activeWarrantiesFor(
  system: ServiceCategory | null,
  history: readonly ServiceRecord[],
  today: string,
  odometerKm: number | null,
  excludeId?: string,
): WarrantyBanner[] {
  if (!system) return [];
  const out: WarrantyBanner[] = [];
  for (const r of repairsOf(history)) {
    if (r.id === excludeId || r.system !== system) continue;
    if (!r.warrantyUntilDate && r.warrantyUntilKm == null) continue;
    const date = r.warrantyUntilDate ? warrantyState(r.warrantyUntilDate, today) : null;
    if (date && date.state === 'expired') continue;
    const kmLeft = r.warrantyUntilKm != null && odometerKm != null ? r.warrantyUntilKm - odometerKm : null;
    if (kmLeft != null && kmLeft < 0) continue;
    out.push({ recordId: r.id, title: r.title, shop: shopKey(r), untilDate: r.warrantyUntilDate, untilKm: r.warrantyUntilKm, daysLeft: date ? date.days : null, kmLeft });
  }
  return out.sort((a, b) => (a.daysLeft ?? Infinity) - (b.daysLeft ?? Infinity));
}

// ── Closing the loop from an OBD code (SPEC-D §D4) ───────────────────────────────────────────────────────

export const RESCAN_DAYS = 3;

/** The reminder offered after a repair that came from a code: scan again in a few days to see it stayed away. */
export function rescanReminder(code: string, today: string, days = RESCAN_DAYS): { title: string; dueDate: string } {
  const d = new Date(`${today.slice(0, 10)}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return { title: `Volver a escanear ${code}`, dueDate: d.toISOString().slice(0, 10) };
}
