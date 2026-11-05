/**
 * Monthly and yearly recaps (SPEC-J, ADR-74): a PURE function over records the app already has. No table, no AI, no React, nothing stored.
 *
 * Same numbers as everywhere else: distance and spend use the Cifras functions (`distanceInRange`, `inRange`, `totalSpend`) over the same
 * kind of ISO window; efficiency uses `computeEconomy` (full-to-full only). Rules (SPEC-J §J0/J7): a card without data is skipped, never a
 * "0 km" card; comparisons only when the previous period has data; boundaries are LOCAL calendar dates (built from local components, so
 * DST and the year boundary cannot shift them); a thin period yields fewer cards, not a shaming one.
 */
import type { FillUp } from '../types';
import { computeEconomy, roundMoney } from './economy';
import {
  delta,
  distanceInRange,
  inRange,
  spendByCategory,
  totalSpend,
  type Delta,
  type Reading,
  type SpendRow,
  type CategoryTotal,
} from './stats';

export type RecapPeriod = { kind: 'month'; year: number; month: number } | { kind: 'year'; year: number };
/** 'active' = one id; 'all' = every vehicle of the person. */
export type RecapScope = { kind: 'vehicle'; vehicleId: string } | { kind: 'all' };

export type RecapVehicle = { id: string; name: string; photoMediaId?: string | null };
export type RecapTrip = { vehicleId: string; startedAt: string; distanceM: number; durationS: number; movingS: number; maxKmh: number | null; avgMovingKmh: number | null };
export type RecapService = { vehicleId: string; occurredAt: string; kind: string };

export type RecapInput = {
  vehicles: RecapVehicle[];
  fillups: FillUp[];
  spend: (SpendRow & { vehicleId: string })[];
  readings: (Reading & { vehicleId: string })[];
  trips: RecapTrip[];
  services: RecapService[];
  /** Mods installed in the period with what they cost (build story). */
  mods?: { vehicleId: string; installedAt: string; costDop: number }[];
  /** Right now (not per period): overdue reminders and documents expiring within 60 days. */
  overdueNow?: number;
  docsExpiring?: number;
};

export type Comparison = { km: Delta | null; spend: Delta | null; efficiency: Delta | null };

export type RecapCard =
  | { kind: 'cover'; headlineKm: number | null; vehicleNames: string[]; photoMediaId: string | null }
  | { kind: 'distance'; km: number; trips: number; hours: number; longestTripKm: number | null; longestTripDate: string | null; busiestDay: string | null }
  | { kind: 'speed'; topKmh: number; topDate: string | null; avgMovingKmh: number | null }
  | { kind: 'fuel'; volume: number; spend: number; avgPrice: number | null; efficiency: number | null; efficiencyPairs: number }
  | { kind: 'cost'; total: number; byCategory: CategoryTotal[]; costPerKm: number | null; biggest: { amount: number; category: string } | null }
  | { kind: 'care'; services: number; repairs: number; overdueNow: number; docsExpiring: number }
  | { kind: 'build'; mods: number; invested: number }
  | { kind: 'compare'; previousLabel: string; deltas: Comparison }
  | { kind: 'months'; months: { month: number; km: number; spend: number }[] }
  | { kind: 'odometer'; startKm: number; endKm: number; km: number }
  | { kind: 'garage'; cars: { vehicleId: string; name: string; km: number; spend: number }[]; mostDriven: string | null }
  | { kind: 'closer'; highlight: { kind: 'km' | 'trips' | 'topSpeed'; value: number } | null };

export type Recap = {
  period: RecapPeriod;
  id: string;
  scope: RecapScope;
  /** True when there is next to nothing: the viewer shows the encouraging empty state. */
  thin: boolean;
  /** Fewer than 2 cards besides cover+closer: not offered for sharing. */
  shareable: boolean;
  /** The current month/year is "so far". */
  partial: boolean;
  cards: RecapCard[];
};

// ---- period helpers (local calendar)
const pad = (n: number) => String(n).padStart(2, '0');
export const recapId = (p: RecapPeriod): string => (p.kind === 'month' ? `${p.year}-${pad(p.month + 1)}` : String(p.year));

export function parseRecapId(id: string): RecapPeriod | null {
  const m = /^(\d{4})-(\d{2})$/.exec(id);
  if (m && Number(m[2]) >= 1 && Number(m[2]) <= 12) return { kind: 'month', year: Number(m[1]), month: Number(m[2]) - 1 };
  const y = /^(\d{4})$/.exec(id);
  return y ? { kind: 'year', year: Number(y[1]) } : null;
}

/** ISO window of a period, from LOCAL midnight of its first day to just before local midnight of the next period. */
export function periodWindow(p: RecapPeriod): { from: string; to: string } {
  const start = p.kind === 'month' ? new Date(p.year, p.month, 1) : new Date(p.year, 0, 1);
  const next = p.kind === 'month' ? new Date(p.year, p.month + 1, 1) : new Date(p.year + 1, 0, 1);
  return { from: start.toISOString(), to: new Date(next.getTime() - 1).toISOString() };
}

export function previousPeriod(p: RecapPeriod): RecapPeriod {
  if (p.kind === 'year') return { kind: 'year', year: p.year - 1 };
  return p.month === 0 ? { kind: 'month', year: p.year - 1, month: 11 } : { kind: 'month', year: p.year, month: p.month - 1 };
}

const localDay = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** Today as local components, so "is this the current period" does not depend on the server's zone. */
function isCurrent(p: RecapPeriod, today: string): boolean {
  const t = new Date(today);
  return p.kind === 'year' ? t.getFullYear() === p.year : t.getFullYear() === p.year && t.getMonth() === p.month;
}

const inScope = <T extends { vehicleId: string }>(rows: T[], ids: Set<string>) => rows.filter((r) => ids.has(r.vehicleId));

/** Per-vehicle odometer distance, summed (an odometer is per car; mixing two cars' readings would be nonsense). */
function distanceKm(readings: (Reading & { vehicleId: string })[], ids: string[], from: string, to: string): number {
  let km = 0;
  for (const id of ids) km += distanceInRange(readings.filter((r) => r.vehicleId === id), from, to);
  return Math.round(km);
}

type Window = { from: string; to: string };

/**
 * Distance per month of a year the way the Cifras bars do it (`distancePerMonth`): each gap between two consecutive readings of a car goes to the
 * month of the LATER reading. A month with a single reading is not zero kilometres, it is just where the gap landed.
 */
function monthlyGapKm(readings: (Reading & { vehicleId: string })[], idList: string[], year: number): number[] {
  const out = new Array<number>(12).fill(0);
  for (const id of idList) {
    const sorted = readings.filter((r) => r.vehicleId === id).sort((a, b) => a.valueKm - b.valueKm);
    for (let i = 1; i < sorted.length; i++) {
      const gap = sorted[i].valueKm - sorted[i - 1].valueKm;
      const d = new Date(sorted[i].occurredAt);
      if (gap > 0 && d.getFullYear() === year) out[d.getMonth()] += gap;
    }
  }
  return out.map((v) => Math.round(v));
}

function fuelFacts(input: RecapInput, ids: Set<string>, w: Window) {
  const fills = inRange(inScope(input.fillups, ids), w.from, w.to);
  const volume = fills.reduce((s, f) => s + f.volume, 0);
  const spend = roundMoney(fills.reduce((s, f) => s + f.totalDop, 0));
  // Efficiency: per car, full-to-full pairs that CLOSE inside the window; combined as total distance / total volume.
  let dist = 0;
  let vol = 0;
  let pairs = 0;
  for (const id of ids) {
    const pts = computeEconomy(input.fillups.filter((f) => f.vehicleId === id)).filter((p) => p.occurredAt >= w.from && p.occurredAt <= w.to);
    for (const p of pts) {
      dist += p.distanceKm;
      vol += p.volume;
      pairs++;
    }
  }
  return { count: fills.length, volume: Math.round(volume * 10) / 10, spend, avgPrice: volume > 0 ? roundMoney(spend / volume) : null, efficiency: vol > 0 ? Math.round((dist / vol) * 10) / 10 : null, pairs };
}

function periodFacts(input: RecapInput, ids: Set<string>, idList: string[], w: Window) {
  const spendRows = inRange(inScope(input.spend, ids), w.from, w.to);
  const trips = inRange(inScope(input.trips.map((t) => ({ ...t, occurredAt: t.startedAt })), ids), w.from, w.to);
  const odoKm = distanceKm(input.readings, idList, w.from, w.to);
  const tripKm = Math.round(trips.reduce((s, t) => s + t.distanceM, 0) / 1000);
  return { spendRows, trips, km: odoKm > 0 ? odoKm : tripKm, odoKm, fuel: fuelFacts(input, ids, w) };
}

export function buildRecap(input: RecapInput, period: RecapPeriod, scope: RecapScope, today: string): Recap {
  const idList = scope.kind === 'vehicle' ? [scope.vehicleId] : input.vehicles.map((v) => v.id);
  const ids = new Set(idList);
  const names = input.vehicles.filter((v) => ids.has(v.id));
  const w = periodWindow(period);
  const f = periodFacts(input, ids, idList, w);
  const cards: RecapCard[] = [];

  // 1 cover (always present: it is the frame, not a number)
  cards.push({ kind: 'cover', headlineKm: f.km > 0 ? f.km : null, vehicleNames: names.map((v) => v.name), photoMediaId: names[0]?.photoMediaId ?? null });

  // 2 distance and time
  if (f.km > 0 || f.trips.length > 0) {
    const longest = f.trips.reduce<RecapTrip | null>((m, t) => (m == null || t.distanceM > m.distanceM ? t : m), null);
    const perDay = new Map<string, number>();
    for (const t of f.trips) perDay.set(localDay(t.startedAt), (perDay.get(localDay(t.startedAt)) ?? 0) + t.distanceM);
    const busiest = [...perDay.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    const seconds = f.trips.reduce((s, t) => s + t.durationS, 0);
    if (f.km > 0)
      cards.push({
        kind: 'distance',
        km: f.km,
        trips: f.trips.length,
        hours: Math.round((seconds / 3600) * 10) / 10,
        longestTripKm: longest ? Math.round((longest.distanceM / 1000) * 10) / 10 : null,
        longestTripDate: longest ? longest.startedAt : null,
        busiestDay: busiest,
      });
  }

  // 3 speed (GPS, from the saved trips: the same numbers as the trip detail)
  const top = f.trips.filter((t) => t.maxKmh != null).sort((a, b) => (b.maxKmh as number) - (a.maxKmh as number))[0];
  if (top && (top.maxKmh as number) > 0) {
    const avgs = f.trips.filter((t) => t.avgMovingKmh != null && t.movingS > 0);
    const movingS = avgs.reduce((s, t) => s + t.movingS, 0);
    cards.push({
      kind: 'speed',
      topKmh: Math.round(top.maxKmh as number),
      topDate: top.startedAt,
      avgMovingKmh: movingS > 0 ? Math.round(avgs.reduce((s, t) => s + (t.avgMovingKmh as number) * t.movingS, 0) / movingS) : null,
    });
  }

  // 4 fuel
  if (f.fuel.count > 0) cards.push({ kind: 'fuel', volume: f.fuel.volume, spend: f.fuel.spend, avgPrice: f.fuel.avgPrice, efficiency: f.fuel.efficiency, efficiencyPairs: f.fuel.pairs });

  // 5 cost
  const total = totalSpend(f.spendRows);
  if (total > 0) {
    const biggest = f.spendRows.reduce<SpendRow | null>((m, r) => (m == null || r.amountDop > m.amountDop ? r : m), null);
    cards.push({
      kind: 'cost',
      total,
      byCategory: spendByCategory(f.spendRows),
      costPerKm: f.km > 0 ? roundMoney(total / f.km) : null,
      biggest: biggest ? { amount: roundMoney(biggest.amountDop), category: biggest.category } : null,
    });
  }

  // 6 care
  const svc = inRange(inScope(input.services.map((s) => ({ ...s })), ids), w.from, w.to);
  const repairs = svc.filter((s) => s.kind === 'reparacion').length;
  const services = svc.length - repairs;
  const overdueNow = isCurrent(period, today) ? (input.overdueNow ?? 0) : 0;
  const docsExpiring = isCurrent(period, today) ? (input.docsExpiring ?? 0) : 0;
  if (services + repairs + overdueNow + docsExpiring > 0) cards.push({ kind: 'care', services, repairs, overdueNow, docsExpiring });

  // 7 build
  const mods = inRange(inScope((input.mods ?? []).map((m) => ({ ...m, occurredAt: m.installedAt })), ids), w.from, w.to);
  if (mods.length) cards.push({ kind: 'build', mods: mods.length, invested: roundMoney(mods.reduce((s, m) => s + m.costDop, 0)) });

  // 9 compare (monthly and yearly): only if the PREVIOUS period has data, as neutral deltas
  const prevP = previousPeriod(period);
  const prevW = periodWindow(prevP);
  const pf = periodFacts(input, ids, idList, prevW);
  const prevSpend = totalSpend(pf.spendRows);
  if (pf.km > 0 || prevSpend > 0) {
    cards.push({
      kind: 'compare',
      previousLabel: recapId(prevP),
      deltas: {
        km: f.km > 0 && pf.km > 0 ? delta(f.km, pf.km) : null,
        spend: total > 0 && prevSpend > 0 ? delta(total, prevSpend) : null,
        efficiency: f.fuel.efficiency != null && pf.fuel.efficiency != null ? delta(f.fuel.efficiency, pf.fuel.efficiency) : null,
      },
    });
  }

  // yearly extras
  if (period.kind === 'year') {
    const gapKm = monthlyGapKm(input.readings, idList, period.year);
    const months = Array.from({ length: 12 }, (_, m) => {
      const mw = periodWindow({ kind: 'month', year: period.year, month: m });
      return { month: m, km: gapKm[m], spend: totalSpend(inRange(inScope(input.spend, ids), mw.from, mw.to)) };
    });
    if (months.some((m) => m.km > 0 || m.spend > 0)) cards.splice(1, 0, { kind: 'months', months });
    const inYear = inRange(inScope(input.readings, ids), w.from, w.to).sort((a, b) => a.valueKm - b.valueKm);
    if (inYear.length >= 2 && idList.length === 1) cards.push({ kind: 'odometer', startKm: inYear[0].valueKm, endKm: inYear[inYear.length - 1].valueKm, km: f.odoKm });
    if (idList.length > 1) {
      const cars = names
        .map((v) => ({ vehicleId: v.id, name: v.name, km: distanceKm(input.readings, [v.id], w.from, w.to), spend: totalSpend(inRange(inScope(input.spend, new Set([v.id])), w.from, w.to)) }))
        .filter((c) => c.km > 0 || c.spend > 0)
        .sort((a, b) => b.km - a.km);
      if (cars.length > 1) cards.push({ kind: 'garage', cars, mostDriven: cars[0]?.name ?? null });
    }
  }

  // 10 closer: one number worth keeping (never a zero)
  const highlight: Extract<RecapCard, { kind: 'closer' }>['highlight'] = f.km > 0 ? { kind: 'km', value: f.km } : f.trips.length > 0 ? { kind: 'trips', value: f.trips.length } : top ? { kind: 'topSpeed', value: Math.round(top.maxKmh as number) } : null;
  const body = cards.length - 1; // everything but the cover
  if (highlight) cards.push({ kind: 'closer', highlight });

  return { period, id: recapId(period), scope, thin: body < 2, shareable: body >= 2, partial: isCurrent(period, today), cards };
}

/** Which months/years have anything at all (the Cifras → Resúmenes list): newest first. */
export function periodsWithData(input: RecapInput, today: string): RecapPeriod[] {
  const months = new Set<string>();
  const note = (iso: string) => {
    const d = new Date(iso);
    months.add(`${d.getFullYear()}-${d.getMonth()}`);
  };
  for (const r of input.spend) if (r.amountDop > 0) note(r.occurredAt);
  for (const t of input.trips) if (t.distanceM > 0) note(t.startedAt);
  for (const r of input.readings) note(r.occurredAt);
  const out: RecapPeriod[] = [];
  const years = new Set<number>();
  for (const key of months) {
    const [y, m] = key.split('-').map(Number);
    out.push({ kind: 'month', year: y, month: m });
    years.add(y);
  }
  for (const y of years) out.push({ kind: 'year', year: y });
  const nowKey = (p: RecapPeriod) => (p.kind === 'month' ? p.year * 100 + p.month : p.year * 100 + 12);
  void today;
  return out.sort((a, b) => nowKey(b) - nowKey(a));
}

/**
 * "Tu resumen de octubre está listo" (SPEC-J §J1): on days 1–14 of a month, the month that just closed — and from 1 January, the year too.
 * Pure; the caller checks that the recap has data and that the person has not hidden it. Returns the periods, newest first.
 */
export function recapReady(today: string): RecapPeriod[] {
  const t = new Date(today);
  if (t.getDate() > 14) return [];
  const prev = t.getMonth() === 0 ? { kind: 'month' as const, year: t.getFullYear() - 1, month: 11 } : { kind: 'month' as const, year: t.getFullYear(), month: t.getMonth() - 1 };
  const out: RecapPeriod[] = [];
  if (t.getMonth() === 0) out.push({ kind: 'year', year: t.getFullYear() - 1 });
  out.push(prev);
  return out;
}

/** Local boundary of the next notification: 09:00 local on the 1st of the next month. */
export function nextRecapNotificationAt(now: Date): Date {
  const first = new Date(now.getFullYear(), now.getMonth(), 1, 9, 0, 0, 0);
  return first.getTime() > now.getTime() ? first : new Date(now.getFullYear(), now.getMonth() + 1, 1, 9, 0, 0, 0);
}

