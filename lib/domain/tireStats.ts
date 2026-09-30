/**
 * Gomas quemadas (IMP 30092026 note 3, ADR-45): derived, never stored. Pure and tested.
 *
 * Counting rules, from the columns that exist:
 * - Every live `tire` row is a tire the car went through (total).
 * - Retired = status `quemada` or `vendida`; burned = `quemada`, plus track-day
 *   `consumable_usage` rows of kind `goma_quemada` — the one linked to a tire row
 *   counts that tire (once, even if it is not marked `quemada` yet); one with no
 *   tire row counts `qty` more tires (a set burned at the drag strip nobody
 *   typed in one by one).
 * - A tire's date is `purchasedAt`, else when it was written down (`createdAt`);
 *   a retired tire's end is its last edit (`updatedAt`) — there is no
 *   retired-at column, and a status change is the edit that retires it.
 * - Km per tire is NOT derivable: the tire row has no odometer at mount/removal.
 *   Punctures and repairs are not in the data model either; no badge claims them.
 */
import type { ConsumableUsage, Tire, WheelSet } from '../db/types';
import { money } from '../format';
import { currentLanguage, localeTag, type Dict, type Lang } from '../i18n';
import { en } from '../i18n/en';
import { es } from '../i18n/es';
import { dotAge } from './tires';

type TireStatus = Tire['status'];

export const TIRE_STATUSES: TireStatus[] = ['nueva', 'en_uso', 'guardada', 'quemada', 'vendida'];

/** Heat cycles on a mounted tire before the warning (settings default, PROMPT-05 §3). */
export const DEFAULT_HEAT_CYCLE_LIMIT = 8;

/** A set is four tires — "próximo juego". */
const SET_SIZE = 4;
const DAY_MS = 86_400_000;
const MONTH_DAYS = 30.44;
const PACE_MONTHS = 6;

export type TireInput = Pick<
  Tire,
  | 'id'
  | 'vehicleId'
  | 'wheelSetId'
  | 'brand'
  | 'model'
  | 'size'
  | 'position'
  | 'status'
  | 'heatCycles'
  | 'purchasedAt'
  | 'costDop'
  | 'dotCode'
  | 'treadMmNew'
  | 'treadMmCurrent'
  | 'createdAt'
  | 'updatedAt'
> & { deletedAt?: string | null };

export type WheelSetInput = Pick<WheelSet, 'id' | 'vehicleId'> & { deletedAt?: string | null };

export type ConsumableInput = Pick<ConsumableUsage, 'id' | 'kind' | 'tireId' | 'wheelSetId' | 'qty' | 'createdAt'> & {
  deletedAt?: string | null;
};

export type PerTireStat = {
  id: string;
  label: string;
  status: TireStatus;
  /** Days from its date to retirement, or to now while it is still around. */
  ageDays: number;
  /** From the DOT code, when readable. */
  dotAgeYears: number | null;
  heatCycles: number;
  /** % of the tread gone, when both depths are known. */
  treadUsedPct: number | null;
  /** Mounted (`en_uso`) with more heat cycles than the limit. */
  overHeatCycles: boolean;
};

export type TireStats = {
  /** Tires the car (or the garage) went through, consumable-only burns included. */
  total: number;
  byStatus: Record<TireStatus, number>;
  /** On the car now (`en_uso`). */
  mounted: number;
  /** Still owned: `nueva` + `en_uso` + `guardada`. */
  active: number;
  /** `quemada` + `vendida`. */
  retired: number;
  burned: number;
  /** Tires dated in `now`'s calendar year. */
  thisYear: number;
  byYear: { year: number; count: number }[];
  /** Sum of the tire rows' `costDop` (unknown costs count 0; `pricedCount` says how many had one). */
  spentDop: number;
  pricedCount: number;
  /** Sets (of 4) per month over the last 6 months; 0 when none. */
  setsPerMonth: number;
  /** At that pace, days until the next set is due (0 = due now); null with no pace. */
  nextSetInDays: number | null;
  /** Date of the n-th tire (ascending), for the badges' "reached on". */
  datedAsc: string[];
  perTire: PerTireStat[];
  /** Mounted tires past the heat-cycle limit. */
  heatWarnings: PerTireStat[];
};

export type TireStatsOptions = {
  now?: Date;
  consumables?: readonly ConsumableInput[];
  heatCycleLimit?: number;
};

function tireDate(t: TireInput): string {
  return (t.purchasedAt ?? t.createdAt).slice(0, 10);
}

function tireLabel(t: TireInput): string {
  const name = [t.brand, t.model].map((x) => x?.trim()).filter(Boolean).join(' ');
  return [name, t.size?.trim()].filter(Boolean).join(' · ') || dict().tireStats.unnamed;
}

function ms(iso: string): number {
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return day ? new Date(Number(day[1]), Number(day[2]) - 1, Number(day[3])).getTime() : new Date(iso).getTime();
}

const isRetired = (s: TireStatus) => s === 'quemada' || s === 'vendida';

function compute(tires: TireInput[], consumables: ConsumableInput[], opts: TireStatsOptions): TireStats {
  const now = opts.now ?? new Date();
  const limit = opts.heatCycleLimit ?? DEFAULT_HEAT_CYCLE_LIMIT;
  const nowMs = now.getTime();

  const byStatus = Object.fromEntries(TIRE_STATUSES.map((s) => [s, 0])) as Record<TireStatus, number>;
  for (const t of tires) byStatus[t.status] = (byStatus[t.status] ?? 0) + 1;

  const tireIds = new Set(tires.map((t) => t.id));
  const burnedIds = new Set(tires.filter((t) => t.status === 'quemada').map((t) => t.id));
  const extraDates: string[] = [];
  for (const c of consumables) {
    if (c.kind !== 'goma_quemada') continue;
    if (c.tireId && tireIds.has(c.tireId)) burnedIds.add(c.tireId);
    else if (!c.tireId) {
      const n = Math.max(1, Math.round(c.qty ?? 1));
      for (let i = 0; i < n; i++) extraDates.push(c.createdAt.slice(0, 10));
    }
  }

  const datedAsc = [...tires.map(tireDate), ...extraDates].sort();
  const year = now.getFullYear();
  const years = new Map<number, number>();
  for (const d of datedAsc) {
    const y = Number(d.slice(0, 4));
    years.set(y, (years.get(y) ?? 0) + 1);
  }

  let spentDop = 0;
  let pricedCount = 0;
  for (const t of tires) {
    if (t.costDop != null && Number.isFinite(t.costDop)) {
      spentDop += t.costDop;
      pricedCount++;
    }
  }

  // Pace: tires dated in the last 6 months, in sets per month.
  const since = nowMs - PACE_MONTHS * MONTH_DAYS * DAY_MS;
  const recent = datedAsc.filter((d) => ms(d) >= since && ms(d) <= nowMs);
  const setsPerMonth = recent.length / SET_SIZE / PACE_MONTHS;
  let nextSetInDays: number | null = null;
  if (setsPerMonth > 0) {
    const everyDays = MONTH_DAYS / setsPerMonth;
    const last = ms(recent[recent.length - 1]);
    nextSetInDays = Math.max(0, Math.round((last + everyDays * DAY_MS - nowMs) / DAY_MS));
  }

  const perTire: PerTireStat[] = tires
    .slice()
    .sort((a, b) => tireDate(a).localeCompare(tireDate(b)))
    .map((t) => {
      const end = isRetired(t.status) ? ms(t.updatedAt) : nowMs;
      const dot = dotAge(t.dotCode, now);
      const treadUsedPct =
        t.treadMmNew != null && t.treadMmCurrent != null && t.treadMmNew > 0
          ? Math.min(100, Math.max(0, Math.round(((t.treadMmNew - t.treadMmCurrent) / t.treadMmNew) * 100)))
          : null;
      return {
        id: t.id,
        label: tireLabel(t),
        status: t.status,
        ageDays: Math.max(0, Math.floor((end - ms(tireDate(t))) / DAY_MS)),
        dotAgeYears: dot && 'ageYears' in dot ? Math.round(dot.ageYears * 10) / 10 : null,
        heatCycles: t.heatCycles ?? 0,
        treadUsedPct,
        overHeatCycles: t.status === 'en_uso' && (t.heatCycles ?? 0) > limit,
      };
    });

  return {
    total: tires.length + extraDates.length,
    byStatus,
    mounted: byStatus.en_uso,
    active: byStatus.nueva + byStatus.en_uso + byStatus.guardada,
    retired: byStatus.quemada + byStatus.vendida,
    burned: burnedIds.size + extraDates.length,
    thisYear: years.get(year) ?? 0,
    byYear: [...years.entries()].sort((a, b) => a[0] - b[0]).map(([y, count]) => ({ year: y, count })),
    spentDop,
    pricedCount,
    setsPerMonth: Math.round(setsPerMonth * 100) / 100,
    nextSetInDays,
    datedAsc,
    perTire,
    heatWarnings: perTire.filter((p) => p.overHeatCycles),
  };
}

/**
 * One car's tire stats. Wheel sets let a `goma_quemada` consumable with only a
 * wheel set (no tire) count for the car that set belongs to; without them such
 * rows are counted only when their tire is one of this car's.
 */
export function tireStats(
  tires: readonly TireInput[],
  wheelSets: readonly WheelSetInput[] | null | undefined,
  vehicleId: string,
  opts: TireStatsOptions = {},
): TireStats {
  const mine = tires.filter((t) => t.vehicleId === vehicleId && !t.deletedAt);
  const tireIds = new Set(mine.map((t) => t.id));
  const setIds = new Set((wheelSets ?? []).filter((w) => w.vehicleId === vehicleId && !w.deletedAt).map((w) => w.id));
  const consumables = (opts.consumables ?? []).filter(
    (c) => !c.deletedAt && ((c.tireId && tireIds.has(c.tireId)) || (!c.tireId && c.wheelSetId && setIds.has(c.wheelSetId))),
  );
  return compute(mine, consumables, opts);
}

/** Every car in the garage together (the Cifras block across cars). Unattributed consumables count too. */
export function garageTireStats(allTires: readonly TireInput[], opts: TireStatsOptions = {}): TireStats {
  return compute(
    allTires.filter((t) => !t.deletedAt),
    (opts.consumables ?? []).filter((c) => !c.deletedAt),
    opts,
  );
}

// ---------------------------------------------------------------------------
// Badges and messages
// ---------------------------------------------------------------------------

export type TireBadgeId = 'primer_juego' | 'quemagomas' | 'fabricante_humo' | 'cliente_gomero' | 'leyenda_lao';

/** Thresholds; the names are in the dictionary (`tireStats.badges`). */
export const TIRE_BADGES: { id: TireBadgeId; threshold: number }[] = [
  { id: 'primer_juego', threshold: 4 },
  { id: 'quemagomas', threshold: 10 },
  { id: 'fabricante_humo', threshold: 25 },
  { id: 'cliente_gomero', threshold: 50 },
  { id: 'leyenda_lao', threshold: 100 },
];

/** A given language's dictionary, or the current one's. */
function dict(locale: Lang = currentLanguage()): Dict {
  return locale === 'en' ? en : es;
}

export type TireBadge = {
  id: TireBadgeId;
  threshold: number;
  label: string;
  earned: boolean;
  /** Date of the n-th tire when earned. */
  reachedAt: string | null;
  /** Tires to go ("faltan 2"); 0 when earned. */
  remaining: number;
};

/** Every badge, earned ones with the date of the tire that earned them. */
export function badgesFor(stats: Pick<TireStats, 'total' | 'datedAsc'>, locale?: Lang): TireBadge[] {
  const names = dict(locale).tireStats.badges;
  return TIRE_BADGES.map((b) => {
    const earned = stats.total >= b.threshold;
    return {
      id: b.id,
      threshold: b.threshold,
      label: names[b.id],
      earned,
      reachedAt: earned ? (stats.datedAsc[b.threshold - 1] ?? null) : null,
      remaining: Math.max(0, b.threshold - stats.total),
    };
  });
}

/** The next badge to earn, or null when all are. */
export function nextBadge(stats: Pick<TireStats, 'total' | 'datedAsc'>, locale?: Lang): TireBadge | null {
  return badgesFor(stats, locale).find((b) => !b.earned) ?? null;
}

/** "~3 semanas" / "~5 días" / "~2 meses"; null when it is due now. */
function soon(d: Dict, days: number): string | null {
  if (days <= 1) return null;
  if (days < 14) return d.tireStats.days(days);
  if (days < 60) return d.tireStats.weeks(Math.round(days / 7));
  return d.tireStats.months(Math.round(days / MONTH_DAYS));
}

/** "RD$ 96,000" — whole pesos for an approximate total. */
function moneyWhole(n: number): string {
  return money(Math.round(n)).replace(/\.00$/, '');
}

/**
 * Short sentences for the Gomas header card, in this order: headline, money
 * (when any tire has a cost), pace, next badge, heat-cycle warnings.
 */
export function messagesFor(stats: TireStats, locale?: Lang): string[] {
  const lang = locale ?? currentLanguage();
  const d = dict(lang);
  const m = d.tireStats;
  if (stats.total === 0) return [m.none];
  const int = new Intl.NumberFormat(localeTag(lang), { maximumFractionDigits: 0 });
  const out = [m.headline(int.format(stats.total), int.format(stats.thisYear), stats.total === 1)];
  if (stats.pricedCount > 0 && stats.spentDop > 0) out.push(m.spent(moneyWhole(stats.spentDop)));
  if (stats.nextSetInDays != null) {
    const when = soon(d, stats.nextSetInDays);
    out.push(when ? m.pace(when) : m.paceNow);
  }
  const next = nextBadge(stats, locale);
  if (next) out.push(m.next(next.remaining, next.label));
  for (const w of stats.heatWarnings) out.push(m.heat(w.label, w.heatCycles));
  return out;
}
