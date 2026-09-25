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

/**
 * Reads a number the way a Dominican receipt writes it — "RD$ 3,487.26": dot
 * for decimals, comma for thousands — while still accepting a comma typed as
 * the decimal mark ("11,4").
 *
 * It used to turn the first comma into a dot, so "2,583" became 2.583 and
 * "3,487.26" became nothing at all.
 *
 * - both marks present: the last one is the decimal ("3.487,26" works too)
 * - only commas, each followed by exactly three digits: thousands ("2,583")
 * - any other single comma: decimal ("11,4")
 * - repeated dots with no comma: thousands ("1.234.567")
 */
export function parseDecimal(raw: string): number | null {
  let s = raw.trim().replace(/^RD\$\s*/i, '').replace(/\s+/g, '');
  if (!s) return null;
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma !== -1 && lastDot !== -1) {
    s = lastComma > lastDot ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (lastComma !== -1) {
    s = /^\d{1,3}(,\d{3})+$/.test(s) ? s.replace(/,/g, '') : s.replace(',', '.');
  } else if ((s.match(/\./g) ?? []).length > 1) {
    if (!/^\d{1,3}(\.\d{3})+$/.test(s)) return null;
    s = s.replace(/\./g, '');
  }
  if (!/^\d*\.?\d+$|^\d+\.$/.test(s)) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

/**
 * Something was typed but it is not a usable amount ("abc", "-200"). Forms
 * refuse to save on this instead of storing 0 or dropping the value — a
 * negative catalog interval used to silently delete the interval.
 */
export function isInvalidNumber(raw: string): boolean {
  return raw.trim() !== '' && parseDecimal(raw) == null;
}

/**
 * The odometer range a fill-up on `occurredAt` can have: at least the reading
 * of the fill-up before it, at most the one after. `excludeId` is the fill-up
 * being edited — its own old value is not a neighbour.
 *
 * The form used to check only new fill-ups, and only against the latest one,
 * so editing a past tank to a lower number went through and bent every km/gal
 * around it into nonsense.
 */
export function odometerBounds(
  fillups: FillUp[],
  occurredAt: string,
  excludeId?: string,
): { min: number | null; max: number | null } {
  const others = sortFillUps(fillups.filter((f) => f.id !== excludeId));
  const day = occurredAt.slice(0, 10);
  const before = others.filter((f) => f.occurredAt.slice(0, 10) <= day);
  const after = others.filter((f) => f.occurredAt.slice(0, 10) > day);
  return {
    min: before.length ? Math.max(...before.map((f) => f.odometerKm)) : null,
    max: after.length ? Math.min(...after.map((f) => f.odometerKm)) : null,
  };
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

  // All three typed (off a receipt): what was paid and what went into the
  // tank are the facts; the price is derived from them. Recomputing the total
  // from volume × price silently replaced the receipt's own amount.
  if (volume != null && price != null && total != null) {
    return {
      volume: roundVolume(volume),
      pricePerUnit: roundMoney(total / volume),
      totalDop: roundMoney(total),
    };
  }
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
 *
 * A fill-up flagged `missedPrevious` breaks the chain (PROMPT-06). The driver is
 * telling us the odometer climbed on fuel that never reached the log, so the
 * distance is real but the volume is not — any km/gal measured across that gap
 * would be flattering and wrong. Rather than publish a number we know to be
 * false, the chain restarts: a flagged full tank becomes a new baseline exactly
 * as the very first one does, and yields no point of its own.
 */
export function computeEconomy(fillups: FillUp[]): EconomyPoint[] {
  const sorted = sortFillUps(fillups);
  const points: EconomyPoint[] = [];
  let lastFullIndex = -1;

  for (let i = 0; i < sorted.length; i++) {
    const current = sorted[i];

    if (current.missedPrevious) {
      // A flagged full tank is the new baseline; a flagged partial leaves us
      // with no baseline at all, because its own volume cannot be trusted to
      // belong to the next full tank's distance either.
      lastFullIndex = current.isFullTank ? i : -1;
      continue;
    }

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
  status: 'low' | 'great' | 'normal' | 'first' | 'partial';
  baseline: number | null;
};

/**
 * Reviews a just-saved fill-up — with the same full/partial chain as
 * `computeEconomy`, never a shortcut of its own.
 *
 * It used to divide "km since the previous fill-up, of any kind" by this
 * fill-up's volume alone. After a partial that told the partial "100 km/gal,
 * buen rendimiento" and the next full tank "25 km/gal, posibles fugas" — a false
 * leak alarm — while Inicio, which uses the chain, said 40 and "estable".
 *
 * A partial is never measured on its own (the next full tank measures it), and
 * the first measured tank has nothing to compare against.
 */
export function reviewFillUp(current: FillUp, previousFillups: FillUp[]): FillUpReview {
  const previous = sortFillUps(previousFillups)
    .filter((fillup) => fillup.id !== current.id && fillup.odometerKm <= current.odometerKm)
    .at(-1);
  // Shown as "km recorridos": plain distance since the last fill-up.
  const distanceKm = previous && !current.missedPrevious ? current.odometerKm - previous.odometerKm : null;

  const others = previousFillups.filter((fillup) => fillup.id !== current.id);
  const point = computeEconomy([...others, current]).find((p) => p.fillUpId === current.id) ?? null;
  const priorEconomy = computeEconomy(others);
  const baseline = priorEconomy.length
    ? priorEconomy.reduce((total, p) => total + p.kmPerUnit, 0) / priorEconomy.length
    : null;

  const kmPerUnit = point?.kmPerUnit ?? null;
  const differencePercent = baseline && kmPerUnit != null ? ((kmPerUnit - baseline) / baseline) * 100 : null;
  const status: FillUpReview['status'] = !current.isFullTank && !current.missedPrevious
    ? 'partial'
    : kmPerUnit == null || differencePercent == null
      ? 'first'
      : differencePercent <= -15
        ? 'low'
        : differencePercent >= 15
          ? 'great'
          : 'normal';

  return {
    pricePerUnit: current.pricePerUnit,
    distanceKm,
    kmPerUnit,
    costPerKm: point?.costPerKm ?? null,
    status,
    baseline,
  };
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
