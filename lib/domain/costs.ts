/**
 * "Lo que me ha costado" (IMP 29092026 note 8, 01-data-model-v6.md §2) — the one
 * number for what a car has cost its owner, and the only function that
 * computes it. Cifras, the PDF report, the CSV export and the public dossier all
 * read this; nothing else adds a purchase price to a spend total.
 *
 *   total = compra − venta del carro
 *         + mods (instalados, quitados, vendidos, dañados) − lo que dieron los mods vendidos
 *         + servicios (mantenimiento, reparación; las piezas van dentro del servicio)
 *         + combustible + gastos + pista (entrada, gasolina, otros)
 *         + inventario comprado para este carro
 *
 * Pure, like `stats.ts`: it takes the lifetime `SpendRow[]` that
 * `lib/db/statsQueries.ts#spendRows` already builds (so a mod linked to a
 * service record is counted once, through the record) plus the three facts that
 * list does not carry — mod sales, inventory and the odometer. Every amount is
 * RD$: a mod bought in USD stores its converted `cost_*_dop` at entry time, and
 * the foreign price is only the entry helper (lib/domain/build.ts), so there is
 * no conversion to do here.
 *
 * Phase 0 audit (d): this replaces `totalCostOfOwnership` (stats.ts). The old
 * figure was purchase − sale + spendRows; this one is the same plus inventory
 * and minus mod sales, and it no longer needs a purchase price to exist.
 */
import { daysBetween } from './dates';
import { roundMoney } from './economy';
import { distanceInRange, type Reading, type SpendRow, type StatCategory } from './stats';

/** The card's buckets, in the order the card lists them (03-screens.md Phase 6). */
export type CostCategory = 'mods' | 'mantenimiento' | 'combustible' | 'pista' | 'otros';

export const COST_CATEGORIES: CostCategory[] = ['mods', 'mantenimiento', 'combustible', 'pista', 'otros'];

/**
 * Cifras' seven stat buckets folded into the card's five. A v2.0 `mejora`
 * service record (and every mod) is a mod; legal and otros are "otros".
 */
const FROM_STAT: Record<StatCategory, CostCategory> = {
  combustible: 'combustible',
  mantenimiento: 'mantenimiento',
  reparacion: 'mantenimiento',
  mejora: 'mods',
  pista: 'pista',
  legal: 'otros',
  otros: 'otros',
};

/** A dated amount that is not in `spendRows`: a mod's sale, an inventory purchase. */
export type DatedAmount = { occurredAt: string | null; amountDop: number };

export type OwnershipInput = {
  vehicle: {
    purchaseDate: string | null;
    purchasePrice: number | null;
    soldDate: string | null;
    soldPrice: number | null;
  };
  /** Lifetime spend, as `spendRows(vehicleId)` returns it. */
  spend: SpendRow[];
  /** Sold mods: what came back (subtracted from "mods"). */
  modSales?: DatedAmount[];
  /** Inventory bought for this car and not already turned into a mod (see `inventoryCounts`). */
  inventory?: DatedAmount[];
  readings?: Reading[];
};

export type OwnershipCost = {
  /** Null when no purchase price was recorded. */
  purchasePrice: number | null;
  /** What the car itself sold for, or null. */
  soldPrice: number | null;
  /** Net per bucket; `mods` already has `modsSold` taken off. */
  byCategory: Record<CostCategory, number>;
  /** What sold mods brought back, as a positive number. */
  modsSold: number;
  /** Everything but the car's purchase and sale. */
  spend: number;
  /** purchase − sale + spend: "lo que me ha costado". */
  total: number;
  /** Odometer span over every reading (max − min); 0 when unknown. */
  distanceKm: number;
  /** total / distance, or null without a distance. */
  perKm: number | null;
  /** spend / distance — the running cost, without the purchase. */
  runningPerKm: number | null;
  /** "Desde …": the purchase date, else the first dated record. */
  since: string | null;
  sinceBasis: 'compra' | 'primer_registro' | null;
  monthsOwned: number;
  /** Null until a month has passed; a one-week "cost per month" is a fiction. */
  costPerMonth: number | null;
};

function emptyBuckets(): Record<CostCategory, number> {
  return { mods: 0, mantenimiento: 0, combustible: 0, pista: 0, otros: 0 };
}

/**
 * The figure, per vehicle. `today` bounds the ownership period of a car that
 * has not been sold.
 */
export function ownershipCost(input: OwnershipInput, today: string): OwnershipCost {
  const { vehicle } = input;
  const buckets = emptyBuckets();
  const dates: string[] = [];

  for (const row of input.spend) {
    buckets[FROM_STAT[row.category]] += row.amountDop || 0;
    if (row.occurredAt) dates.push(row.occurredAt);
  }
  for (const item of input.inventory ?? []) {
    buckets.otros += item.amountDop || 0;
    if (item.occurredAt) dates.push(item.occurredAt);
  }
  const modsSold = (input.modSales ?? []).reduce((t, s) => t + (s.amountDop || 0), 0);
  buckets.mods -= modsSold;

  const byCategory = emptyBuckets();
  for (const key of COST_CATEGORIES) byCategory[key] = roundMoney(buckets[key]);
  const spend = roundMoney(COST_CATEGORIES.reduce((t, key) => t + buckets[key], 0));

  const purchasePrice = vehicle.purchasePrice != null && vehicle.purchasePrice > 0 ? vehicle.purchasePrice : null;
  const soldPrice = vehicle.soldPrice != null && vehicle.soldPrice > 0 ? vehicle.soldPrice : null;
  const total = roundMoney((purchasePrice ?? 0) - (soldPrice ?? 0) + spend);

  // Every reading: a sold car stops getting new ones, so no cut-off is needed
  // (and a date-only sold_date would drop the reading taken on the day).
  const distanceKm = distanceInRange(input.readings ?? [], null, '9999-12-31');
  const perKm = distanceKm > 0 ? roundMoney(total / distanceKm) : null;
  const runningPerKm = distanceKm > 0 ? roundMoney(spend / distanceKm) : null;

  const firstRecord = dates.length ? dates.reduce((a, b) => (a < b ? a : b)) : null;
  const since = vehicle.purchaseDate ?? firstRecord;
  const sinceBasis = vehicle.purchaseDate ? 'compra' : firstRecord ? 'primer_registro' : null;

  // Owned until it was sold, or until today.
  const days = since ? daysBetween(since, vehicle.soldDate ?? today) : 0;
  const monthsOwned = Math.max(0, Math.floor(days / 30.44));

  return {
    purchasePrice,
    soldPrice,
    byCategory,
    modsSold: roundMoney(modsSold),
    spend,
    total,
    distanceKm,
    perKm,
    runningPerKm,
    since,
    sinceBasis,
    monthsOwned,
    costPerMonth: monthsOwned >= 1 ? roundMoney(total / monthsOwned) : null,
  };
}

/** Nothing to show: no purchase price and not a peso recorded. */
export function isEmptyCost(cost: OwnershipCost): boolean {
  return cost.purchasePrice == null && cost.soldPrice == null && cost.spend === 0 && cost.modsSold === 0;
}

/**
 * `es.inventory.usedIn` stamps this on an inventory item when "Usar en un mod"
 * copies its cost into a new mod. That item's money is then the mod's, so it
 * is not counted a second time.
 */
export const USED_IN_MOD_PREFIX = 'Usado en:';

/** An inventory item counts toward a car when it belongs to it, cost something and was not used in a mod. */
export function inventoryCounts(item: { costDop: number | null; notes: string | null }): boolean {
  if (item.costDop == null || item.costDop <= 0) return false;
  return !(item.notes ?? '').split('\n').some((line) => line.startsWith(USED_IN_MOD_PREFIX));
}

export type GarageCost = {
  vehicles: { vehicleId: string; name: string; cost: OwnershipCost }[];
  byCategory: Record<CostCategory, number>;
  purchase: number;
  sold: number;
  spend: number;
  total: number;
  distanceKm: number;
  perKm: number | null;
  since: string | null;
};

/**
 * The garage total: the per-vehicle figures added up — never recomputed from
 * rows, so the total row is always the sum of the cards above it. Cars with
 * nothing recorded are left out.
 */
export function garageCost(list: { vehicleId: string; name: string; cost: OwnershipCost }[]): GarageCost {
  const vehicles = list.filter((entry) => !isEmptyCost(entry.cost));
  const byCategory = emptyBuckets();
  let purchase = 0;
  let sold = 0;
  let distanceKm = 0;
  let since: string | null = null;
  for (const { cost } of vehicles) {
    for (const key of COST_CATEGORIES) byCategory[key] += cost.byCategory[key];
    purchase += cost.purchasePrice ?? 0;
    sold += cost.soldPrice ?? 0;
    distanceKm += cost.distanceKm;
    if (cost.since && (since == null || cost.since < since)) since = cost.since;
  }
  for (const key of COST_CATEGORIES) byCategory[key] = roundMoney(byCategory[key]);
  const spend = roundMoney(vehicles.reduce((t, v) => t + v.cost.spend, 0));
  const total = roundMoney(vehicles.reduce((t, v) => t + v.cost.total, 0));
  return {
    vehicles,
    byCategory,
    purchase: roundMoney(purchase),
    sold: roundMoney(sold),
    spend,
    total,
    distanceKm,
    perKm: distanceKm > 0 ? roundMoney(total / distanceKm) : null,
    since,
  };
}
