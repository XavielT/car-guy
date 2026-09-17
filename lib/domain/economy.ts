/**
 * Fuel economy and money arithmetic — pure TypeScript, no React and no Expo.
 *
 * Moved verbatim out of lib/math.ts. The brim-to-brim maths is correct and has
 * been proven by two years of Xaviel's own fill-ups; the tests in
 * __tests__/domain/economy.test.ts pin the current behaviour so later phases
 * cannot drift it by accident. Do not "improve" it.
 */
import type { EconomyPoint, FillUp } from '../types';

const MONEY = 100;
const VOLUME = 1000;

export function roundMoney(n: number): number {
  return Math.round(n * MONEY) / MONEY;
}

export function roundVolume(n: number): number {
  return Math.round(n * VOLUME) / VOLUME;
}

export type AmountFields = {
  volume?: number | null;
  pricePerUnit?: number | null;
  totalDop?: number | null;
};

export function parseDecimal(raw: string): number | null {
  const cleaned = raw.trim().replace(',', '.');
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

/** Fill the missing amount when the user provides any two of three. */
export function completeAmounts(input: AmountFields): {
  volume: number;
  pricePerUnit: number;
  totalDop: number;
} | null {
  const volume = input.volume && input.volume > 0 ? input.volume : null;
  const price = input.pricePerUnit && input.pricePerUnit > 0 ? input.pricePerUnit : null;
  const total = input.totalDop && input.totalDop > 0 ? input.totalDop : null;
  const known = [volume, price, total].filter((v) => v != null).length;
  if (known < 2) return null;

  if (volume != null && price != null) {
    return {
      volume: roundVolume(volume),
      pricePerUnit: roundMoney(price),
      totalDop: roundMoney(volume * price),
    };
  }
  if (volume != null && total != null) {
    return {
      volume: roundVolume(volume),
      pricePerUnit: roundMoney(total / volume),
      totalDop: roundMoney(total),
    };
  }
  if (price != null && total != null) {
    return {
      volume: roundVolume(total / price),
      pricePerUnit: roundMoney(price),
      totalDop: roundMoney(total),
    };
  }
  return null;
}

export function sortFillUps(fillups: FillUp[]): FillUp[] {
  return [...fillups].sort((a, b) => {
    if (a.odometerKm !== b.odometerKm) return a.odometerKm - b.odometerKm;
    const ta = new Date(a.occurredAt).getTime();
    const tb = new Date(b.occurredAt).getTime();
    if (ta !== tb) return ta - tb;
    return a.createdAt.localeCompare(b.createdAt);
  });
}

/**
 * Brim-to-brim: between two full tanks, distance / sum of volumes added after the first full.
 * Partials in between are included in volume, never as their own tank.
 */
export function computeEconomy(fillups: FillUp[]): EconomyPoint[] {
  const sorted = sortFillUps(fillups);
  const points: EconomyPoint[] = [];
  let lastFullIndex = -1;

  for (let i = 0; i < sorted.length; i++) {
    const current = sorted[i];
    if (!current.isFullTank) continue;
    if (lastFullIndex === -1) {
      lastFullIndex = i;
      continue;
    }
    const previous = sorted[lastFullIndex];
    const distanceKm = current.odometerKm - previous.odometerKm;
    let volume = 0;
    let spend = 0;
    for (let j = lastFullIndex + 1; j <= i; j++) {
      volume += sorted[j].volume;
      spend += sorted[j].totalDop;
    }
    if (distanceKm > 0 && volume > 0) {
      points.push({
        fillUpId: current.id,
        occurredAt: current.occurredAt,
        distanceKm,
        volume: roundVolume(volume),
        kmPerUnit: roundVolume(distanceKm / volume),
        costPerKm: roundMoney(spend / distanceKm),
      });
    }
    lastFullIndex = i;
  }
  return points;
}

export function economyById(fillups: FillUp[]): Map<string, EconomyPoint> {
  return new Map(computeEconomy(fillups).map((p) => [p.fillUpId, p]));
}

export type EconomyInsight = {
  status: 'low' | 'great' | 'normal';
  current: EconomyPoint;
  baseline: number;
  differencePercent: number;
};

export type FillUpReview = {
  pricePerUnit: number;
  distanceKm: number | null;
  kmPerUnit: number | null;
  costPerKm: number | null;
  status: 'low' | 'great' | 'normal' | 'first';
  baseline: number | null;
};

/** Review the newly registered fill-up against the previous odometer reading. */
export function reviewFillUp(current: FillUp, previousFillups: FillUp[]): FillUpReview {
  const previous = sortFillUps(previousFillups).filter((fillup) => fillup.odometerKm <= current.odometerKm).at(-1);
  const distanceKm = previous ? current.odometerKm - previous.odometerKm : null;
  const kmPerUnit = distanceKm != null && distanceKm > 0 && current.volume > 0
    ? roundVolume(distanceKm / current.volume)
    : null;
  const costPerKm = distanceKm != null && distanceKm > 0
    ? roundMoney(current.totalDop / distanceKm)
    : null;
  const priorEconomy = computeEconomy(previousFillups);
  const baseline = priorEconomy.length
    ? priorEconomy.reduce((total, point) => total + point.kmPerUnit, 0) / priorEconomy.length
    : null;
  const differencePercent = baseline && kmPerUnit != null ? ((kmPerUnit - baseline) / baseline) * 100 : null;
  const status = kmPerUnit == null
    ? 'first'
    : differencePercent == null
      ? 'normal'
      : differencePercent <= -15
        ? 'low'
        : differencePercent >= 15
          ? 'great'
          : 'normal';

  return { pricePerUnit: current.pricePerUnit, distanceKm, kmPerUnit, costPerKm, status, baseline };
}

/** Compare the latest measured tank with this vehicle's previous measured tanks. */
export function latestEconomyInsight(fillups: FillUp[]): EconomyInsight | null {
  const points = computeEconomy(fillups);
  if (points.length < 2) return null;

  const current = points[points.length - 1];
  const previous = points.slice(0, -1);
  const baseline = previous.reduce((total, point) => total + point.kmPerUnit, 0) / previous.length;
  const differencePercent = ((current.kmPerUnit - baseline) / baseline) * 100;
  const status = differencePercent <= -15 ? 'low' : differencePercent >= 15 ? 'great' : 'normal';

  return { status, current, baseline, differencePercent };
}

export function inMonth(iso: string, year: number, month: number): boolean {
  const d = new Date(iso);
  return d.getFullYear() === year && d.getMonth() === month;
}

export function sumSpend(fillups: FillUp[]): number {
  return roundMoney(fillups.reduce((acc, f) => acc + f.totalDop, 0));
}

export function distanceInLogs(fillups: FillUp[]): number {
  const sorted = sortFillUps(fillups);
  if (sorted.length < 2) return 0;
  return Math.max(0, sorted[sorted.length - 1].odometerKm - sorted[0].odometerKm);
}

export function lastOdometer(fillups: FillUp[]): number | null {
  const sorted = sortFillUps(fillups);
  return sorted.length ? sorted[sorted.length - 1].odometerKm : null;
}
