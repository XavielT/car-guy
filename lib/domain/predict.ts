/**
 * The deterministic engine of prediction and alerts (IMP 03112026 SPEC-E §E1, ADR-68). Pure TypeScript over PLAIN data:
 * no React Native, no i18n, no database, no network, and no import from the rest of the app (only this file and its types), so
 * the very same file runs on the device, in the weekly digest on the server (Deno) and under jest. A test pins that boundary.
 *
 * What it computes, from the person's own records:
 *   · `usageRate`      kmPerDay: a robust median over the last 90 days of odometer readings, with a confidence level
 *   · `projectDue`     when a km-based reminder will really fall due at that pace ("≈ 12 Dec")
 *   · `classifyFuel`   the 4-state rule ported from SGC (insufficient / optimal / low / abnormal) on top of Car Guy's own
 *                      partial-fill and gauge logic: a partial or estimated fill is NEVER an anomaly, and a short distance is
 *                      "insufficient", never "optimal"
 *   · cost, price and wear facts
 *   · `buildFacts`     everything above as `Fact`s: an id, a kind, a severity, plain data, and actions from a CLOSED list
 *
 * Text is NOT made here. A fact carries numbers and ids; the screens render them with the dictionaries, and `cg-ai-insights`
 * may only reword them (the server rejects any number in its text that is not in the facts).
 * Thresholds are constants in this one file; the defaults are SGC's (dist_min 50 km, ±20 % low, ±40 % abnormal, ≥ 3 plausible).
 */

// ───────────────────────────────────────────────────────── constants ─────────────────────────────────────────────────────────

export const WINDOW_DAYS = 90;
/** A reading older than this makes "current km" a guess. */
export const STALE_DAYS = 45;
/** An odometer that moves less than this per day is "parked", not a rate to project from. */
export const MIN_KM_PER_DAY = 0.5;
/** A rate above this is a data error (a typo'd reading), not a car. */
export const MAX_KM_PER_DAY = 1500;
/** A reminder projected within this many days is "soon" (amber); within ACT_DAYS it is "act". */
export const SOON_DAYS = 30;
export const ACT_DAYS = 7;

export const FUEL = {
  /** SGC dist_min: under this a fill-up says nothing about consumption. */
  DIST_MIN_KM: 50,
  LOW_DEV: 0.2,
  ABNORMAL_DEV: 0.4,
  MIN_BASELINE: 3,
} as const;

export type VehicleClass = 'car' | 'suv' | 'truck' | 'motorcycle';
/** Plausible km per gallon by class (SGC's 10–35 is a car; a motorcycle or a pickup live elsewhere). */
export const FUEL_BOUNDS: Record<VehicleClass, readonly [number, number]> = {
  car: [10, 35],
  suv: [8, 30],
  truck: [6, 28],
  motorcycle: [25, 120],
};

// ───────────────────────────────────────────────────────── dates ─────────────────────────────────────────────────────────

const DAY_MS = 86_400_000;
const dayNum = (iso: string): number | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / DAY_MS : null;
};
const isoOf = (n: number): string => new Date(n * DAY_MS).toISOString().slice(0, 10);
const daysBetween = (from: string, to: string): number | null => {
  const a = dayNum(from);
  const b = dayNum(to);
  return a == null || b == null ? null : b - a;
};
const addDays = (iso: string, n: number): string => isoOf((dayNum(iso) ?? 0) + n);

const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const round1 = (n: number) => Math.round(n * 10) / 10;

// ───────────────────────────────────────────────────────── usage rate ─────────────────────────────────────────────────────────

export type Confidence = 'high' | 'medium' | 'low' | 'none';
export type Reading = { at: string; km: number };
export type UsageRate = {
  kmPerDay: number | null;
  confidence: Confidence;
  /** The most recent reading used, and how many days old it is. */
  lastReading: Reading | null;
  daysSinceLast: number | null;
  stale: boolean;
  /** Readings kept after cleaning, and the days they span. */
  readings: number;
  spanDays: number;
  /** Best guess of the odometer today (last reading + pace × days since), or the reading itself when there is no pace. */
  estimatedKmNow: number | null;
};

const NONE = (last: Reading | null, since: number | null): UsageRate => ({
  kmPerDay: null, confidence: 'none', lastReading: last, daysSinceLast: since, stale: since != null && since > STALE_DAYS, readings: 0, spanDays: 0, estimatedKmNow: last ? last.km : null,
});

/**
 * Cleans the readings (one per day, the highest; an odometer that goes DOWN is a typo and is dropped; nothing in the future),
 * then takes the MEDIAN of the per-interval rates (an interval needs ≥ 2 days), so a long trip or a forgotten month does not
 * drag the pace. Confidence: high = ≥ 5 readings over ≥ 30 days; medium = ≥ 3 over ≥ 14; low = 2 over ≥ 14; none = otherwise
 * or parked. A stale last reading lowers it one level. One reading is never a rate.
 */
export function usageRate(readings: readonly Reading[], today: string): UsageRate {
  const t = dayNum(today);
  if (t == null) return NONE(null, null);
  const byDay = new Map<number, number>();
  for (const r of readings) {
    const d = dayNum(r.at);
    if (d == null || d > t || !Number.isFinite(r.km) || r.km < 0) continue;
    byDay.set(d, Math.max(byDay.get(d) ?? -1, r.km));
  }
  const all = [...byDay.entries()].sort((a, b) => a[0] - b[0]);
  if (!all.length) return NONE(null, null);
  const last = { at: isoOf(all[all.length - 1][0]), km: all[all.length - 1][1] };
  const since = t - all[all.length - 1][0];

  // Keep a non-decreasing chain: a reading below the previous kept one is the typo, not the one before it.
  const chain: [number, number][] = [];
  for (const [d, km] of all) {
    if (!chain.length || km >= chain[chain.length - 1][1]) chain.push([d, km]);
  }
  const inWindow = chain.filter(([d]) => t - d <= WINDOW_DAYS);
  // A reading just outside the window still anchors the first interval.
  const anchor = chain.filter(([d]) => t - d > WINDOW_DAYS).pop();
  const used = anchor && inWindow.length ? [anchor, ...inWindow] : inWindow;
  if (used.length < 2) return NONE(last, since);

  const span = used[used.length - 1][0] - used[0][0];
  const rates: number[] = [];
  for (let i = 1; i < used.length; i++) {
    const dt = used[i][0] - used[i - 1][0];
    if (dt >= 2) rates.push((used[i][1] - used[i - 1][1]) / dt);
  }
  const overall = span > 0 ? (used[used.length - 1][1] - used[0][1]) / span : 0;
  const rate = rates.length ? median(rates) : overall;
  if (!(rate >= MIN_KM_PER_DAY) || rate > MAX_KM_PER_DAY || span < 14) return NONE(last, since);

  let level: Confidence = used.length >= 5 && span >= 30 ? 'high' : used.length >= 3 ? 'medium' : 'low';
  const stale = since > STALE_DAYS;
  if (stale) level = level === 'high' ? 'medium' : level === 'medium' ? 'low' : 'low';
  const kmPerDay = round1(rate);
  return { kmPerDay, confidence: level, lastReading: last, daysSinceLast: since, stale, readings: used.length, spanDays: span, estimatedKmNow: Math.round(last.km + kmPerDay * since) };
}

// ───────────────────────────────────────────────────────── projection ─────────────────────────────────────────────────────────

export type ReminderInput = {
  id: string;
  title: string;
  metric: 'km' | 'date' | 'both';
  dueKm: number | null;
  dueDate: string | null;
  isEnabled: boolean;
};
export type Projection = {
  reminderId: string;
  /** YYYY-MM-DD when the km limit will be reached at the current pace; null when it cannot be projected. */
  projectedDueAt: string | null;
  daysLeft: number | null;
  /** The pace says it falls due BEFORE the calendar date (only for `both`). */
  earlierThanDate: boolean;
  confidence: Confidence;
  kmLeft: number | null;
};

/**
 * "≈ 12 Dec (at your pace)": today + (dueKm − current km) / kmPerDay. `currentKm` is the best known odometer (the app passes the
 * latest reading; with a stale one `rate.estimatedKmNow` is better). With no pace (confidence none) nothing is projected and the
 * reminder behaves exactly as before. An already-passed km limit projects to today.
 */
export function projectDue(r: ReminderInput, rate: UsageRate, currentKm: number | null, today: string): Projection {
  const empty: Projection = { reminderId: r.id, projectedDueAt: null, daysLeft: null, earlierThanDate: false, confidence: rate.confidence, kmLeft: null };
  if (!r.isEnabled || r.metric === 'date' || r.dueKm == null || currentKm == null) return empty;
  const kmLeft = r.dueKm - currentKm;
  if (rate.kmPerDay == null || rate.confidence === 'none') return { ...empty, kmLeft };
  const days = Math.max(0, Math.ceil(kmLeft / rate.kmPerDay));
  const projectedDueAt = addDays(today, days);
  const earlier = r.metric === 'both' && r.dueDate != null && (daysBetween(r.dueDate.slice(0, 10), projectedDueAt) ?? 0) < 0;
  return { reminderId: r.id, projectedDueAt, daysLeft: days, earlierThanDate: earlier, confidence: rate.confidence, kmLeft };
}

/** `ok` beyond SOON_DAYS, `soon` within it, `act` within ACT_DAYS or already due. */
export function projectionState(daysLeft: number | null): 'ok' | 'soon' | 'act' {
  if (daysLeft == null) return 'ok';
  return daysLeft <= ACT_DAYS ? 'act' : daysLeft <= SOON_DAYS ? 'soon' : 'ok';
}

// ───────────────────────────────────────────────────────── fuel ─────────────────────────────────────────────────────────

export type FuelState = 'insufficient' | 'optimal' | 'low' | 'abnormal';
export type FuelReason = 'partial' | 'short_distance' | 'no_data' | 'no_baseline' | 'out_of_range' | 'within_band' | 'below_baseline' | 'above_baseline';
export type FuelClass = { state: FuelState; reason: FuelReason; direction: 'below' | 'above' | null; deviationPct: number | null };

/** One fill-up as the economy modules already computed it. `measured` = a full-to-full or gauge-reconciled reading. */
export type EconomyPoint = { fillupId: string; at: string; distanceKm: number | null; volumeGal: number | null; kmPerGal: number | null; measured: boolean };

/** The average of this car's PLAUSIBLE fill-ups (long enough, in range, measured), needing ≥ MIN_BASELINE; else null. Never short ones: that poisoned SGC's. */
export function fuelBaseline(points: readonly EconomyPoint[], cls: VehicleClass, excludeId?: string): { value: number; n: number } | null {
  const [lo, hi] = FUEL_BOUNDS[cls];
  const ok = points.filter((p) => p.fillupId !== excludeId && p.measured && p.kmPerGal != null && (p.distanceKm ?? 0) >= FUEL.DIST_MIN_KM && p.kmPerGal >= lo && p.kmPerGal <= hi);
  if (ok.length < FUEL.MIN_BASELINE) return null;
  return { value: ok.reduce((n, p) => n + (p.kmPerGal as number), 0) / ok.length, n: ok.length };
}

/**
 * SGC's 4-state rule, in this order (the first that applies wins):
 *   1. not measured (partial or estimated fill) → insufficient: a partial fill is NEVER an anomaly
 *   2. distance < 50 km → insufficient: a 10–11 km fill-up says nothing, and is never "optimal"
 *   3. no volume or no economy → insufficient
 *   4. economy outside the class's plausible floor/ceiling → abnormal
 *   5. no baseline (fewer than 3 plausible fills) → insufficient
 *   6. against the baseline: within ±20 % optimal; ±20–40 % low; ≥ 40 % abnormal
 */
export function classifyFuel(p: EconomyPoint, baseline: { value: number; n: number } | null, cls: VehicleClass): FuelClass {
  const out = (state: FuelState, reason: FuelReason, direction: FuelClass['direction'] = null, deviationPct: number | null = null): FuelClass => ({ state, reason, direction, deviationPct });
  if (!p.measured) return out('insufficient', 'partial');
  if (p.distanceKm == null || p.distanceKm < FUEL.DIST_MIN_KM) return out('insufficient', 'short_distance');
  if (p.kmPerGal == null || p.volumeGal == null || !(p.volumeGal > 0)) return out('insufficient', 'no_data');
  const [lo, hi] = FUEL_BOUNDS[cls];
  if (p.kmPerGal < lo) return out('abnormal', 'out_of_range', 'below');
  if (p.kmPerGal > hi) return out('abnormal', 'out_of_range', 'above');
  if (!baseline) return out('insufficient', 'no_baseline');
  const dev = (p.kmPerGal - baseline.value) / baseline.value;
  const pct = Math.round(dev * 100);
  const dir = dev < 0 ? 'below' : 'above';
  if (Math.abs(dev) >= FUEL.ABNORMAL_DEV) return out('abnormal', dir === 'below' ? 'below_baseline' : 'above_baseline', dir, pct);
  if (Math.abs(dev) > FUEL.LOW_DEV) return out('low', dir === 'below' ? 'below_baseline' : 'above_baseline', dir, pct);
  return out('optimal', 'within_band', dir, pct);
}

// ───────────────────────────────────────────────────────── facts ─────────────────────────────────────────────────────────

export type Severity = 'info' | 'watch' | 'act';

/** The CLOSED list of things a fact can offer (ADR-67): each opens a normal flow; nothing is ever written silently. */
export type FactAction =
  | { type: 'open_reminder'; reminderId: string }
  | { type: 'open_fillup'; fillupId: string }
  | { type: 'new_service'; title: string }
  | { type: 'new_reminder'; title: string; dueDate: string | null }
  | { type: 'open_tires' }
  | { type: 'open_costs' }
  | { type: 'open_obd' };

export type FactKind =
  | 'reminder_projection' | 'fuel_anomaly' | 'cost_per_km' | 'monthly_spend' | 'fuel_price' | 'biggest_expense'
  | 'tire_age' | 'service_gap' | 'battery_age' | 'odometer_stale';

export type Fact = {
  id: string;
  kind: FactKind;
  vehicleId: string;
  severity: Severity;
  /** Plain values only (numbers, ids, ISO dates, short enum strings). Everything an insight may quote is in here. */
  data: Record<string, number | string | boolean | null>;
  actions: FactAction[];
};

export type SpendRow = { at: string; amountDop: number; category: 'combustible' | 'mantenimiento' | 'reparacion' | 'legal' | 'otros' };
export type TireInput = { id: string; label: string; dot: string | null; installedAt: string | null };
export type LastService = { rotacion: string | null; alineacion: string | null; frenos: string | null; bateria: string | null; correa: string | null; refrigerante: string | null };
export type FillupPrice = { at: string; pricePerGal: number | null; fuelGroup: string };

export type PredictInput = {
  today: string;
  vehicle: { id: string; class: VehicleClass };
  readings: Reading[];
  reminders: ReminderInput[];
  economy: EconomyPoint[];
  spend: SpendRow[];
  prices: FillupPrice[];
  /** MICM reference price per gallon by fuel group, when known. */
  referencePrices: Record<string, number>;
  tires: TireInput[];
  lastService: LastService;
};

/** Months after which each wear item deserves a look (catalogue-style defaults; the person's own reminders still win). */
export const WEAR_MONTHS = { rotacion: [6, 12], alineacion: [12, 24], frenos: [24, 36], bateria: [36, 48], correa: [60, 84], refrigerante: [24, 36] } as const;
/** Tire age (years from the DOT week/year): watch / act. */
export const TIRE_AGE_YEARS = [6, 10] as const;

/** DOT "2321" = week 23 of 2021 → ISO date of that week's Monday-ish (week × 7 days into the year). Null for anything else. */
export function dotDate(dot: string | null): string | null {
  const m = /^(\d{2})(\d{2})$/.exec((dot ?? '').trim());
  if (!m) return null;
  const week = Number(m[1]);
  const year = 2000 + Number(m[2]);
  if (week < 1 || week > 53) return null;
  return isoOf(Date.UTC(year, 0, 1) / DAY_MS + (week - 1) * 7);
}

const monthsBetween = (from: string, to: string): number | null => {
  const d = daysBetween(from, to);
  return d == null ? null : Math.floor(d / 30.44);
};
const sum = (xs: number[]) => xs.reduce((n, x) => n + x, 0);

function windowSpend(rows: readonly SpendRow[], today: string, days: number): number {
  return sum(rows.filter((r) => { const d = daysBetween(r.at, today); return d != null && d >= 0 && d < days; }).map((r) => r.amountDop));
}

/**
 * Every fact this car has right now. Deterministic order (severity, then kind, then id) so the same data always gives the same
 * list and the same `input_hash` for the cache. A fact is emitted only when it carries a real number: with no data there is no fact.
 */
export function buildFacts(input: PredictInput): Fact[] {
  const { today, vehicle: v } = input;
  const facts: Fact[] = [];
  const rate = usageRate(input.readings, today);
  const km = rate.estimatedKmNow;
  const id = (kind: FactKind, key: string) => `${kind}:${v.id}:${key}`;

  // — the odometer itself is stale: every projection is a guess
  if (rate.lastReading && rate.daysSinceLast != null && rate.daysSinceLast > STALE_DAYS) {
    facts.push({ id: id('odometer_stale', 'now'), kind: 'odometer_stale', vehicleId: v.id, severity: 'watch', data: { daysSince: rate.daysSinceLast, lastKm: rate.lastReading.km }, actions: [] });
  }

  // — reminders projected at the real pace
  for (const r of input.reminders) {
    const p = projectDue(r, rate, km, today);
    if (p.projectedDueAt == null || p.daysLeft == null) continue;
    const state = projectionState(p.daysLeft);
    if (state === 'ok') continue;
    facts.push({
      id: id('reminder_projection', r.id), kind: 'reminder_projection', vehicleId: v.id, severity: state === 'act' ? 'act' : 'watch',
      data: { reminderId: r.id, title: r.title, dueKm: r.dueKm, currentKm: km, kmLeft: p.kmLeft, projectedDueAt: p.projectedDueAt, daysLeft: p.daysLeft, kmPerDay: rate.kmPerDay, confidence: p.confidence, earlierThanDate: p.earlierThanDate },
      actions: [{ type: 'open_reminder', reminderId: r.id }, { type: 'new_service', title: r.title }],
    });
  }

  // — the latest full-to-full fill-up against this car's own baseline
  const ordered = [...input.economy].sort((a, b) => a.at.localeCompare(b.at));
  const latest = ordered[ordered.length - 1];
  if (latest) {
    const cls = classifyFuel(latest, fuelBaseline(ordered, v.class, latest.fillupId), v.class);
    if (cls.state === 'abnormal' || cls.state === 'low') {
      facts.push({
        id: id('fuel_anomaly', latest.fillupId), kind: 'fuel_anomaly', vehicleId: v.id, severity: cls.state === 'abnormal' ? 'act' : 'watch',
        data: { fillupId: latest.fillupId, kmPerGal: round1(latest.kmPerGal ?? 0), state: cls.state, reason: cls.reason, direction: cls.direction, deviationPct: cls.deviationPct, baseline: round1(fuelBaseline(ordered, v.class, latest.fillupId)?.value ?? 0) || null },
        actions: [{ type: 'open_fillup', fillupId: latest.fillupId }, { type: 'open_obd' }],
      });
    }
  }

  // — cost per km over 30 / 90 / 365 days (needs the distance driven in that window, from the readings)
  const kmIn = (days: number): number | null => {
    const t = dayNum(today);
    if (t == null) return null;
    const inside = input.readings.filter((r) => { const d = dayNum(r.at); return d != null && t - d <= days && d <= t; }).map((r) => r.km);
    return inside.length >= 2 ? Math.max(...inside) - Math.min(...inside) : null;
  };
  const cpk: Record<string, number | null> = {};
  for (const days of [30, 90, 365]) {
    const dist = kmIn(days);
    const spent = windowSpend(input.spend, today, days);
    // No money spent is no fact: a cost per km of 0 would be noise, not a finding.
    cpk[`d${days}`] = dist != null && dist >= 50 && spent > 0 ? Math.round((spent / dist) * 100) / 100 : null;
  }
  if (cpk.d30 != null || cpk.d90 != null || cpk.d365 != null) {
    facts.push({ id: id('cost_per_km', 'now'), kind: 'cost_per_km', vehicleId: v.id, severity: 'info', data: { perKm30: cpk.d30, perKm90: cpk.d90, perKm365: cpk.d365 }, actions: [{ type: 'open_costs' }] });
  }

  // — this month's spend against the average of the previous three
  const t0 = dayNum(today);
  if (t0 != null) {
    const monthKey = (iso: string) => iso.slice(0, 7);
    const cur = monthKey(today);
    const byMonth = new Map<string, number>();
    for (const r of input.spend) byMonth.set(monthKey(r.at), (byMonth.get(monthKey(r.at)) ?? 0) + r.amountDop);
    const prev: number[] = [];
    for (let i = 1; i <= 3; i++) {
      const d = new Date(Date.UTC(Number(cur.slice(0, 4)), Number(cur.slice(5, 7)) - 1 - i, 1));
      prev.push(byMonth.get(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`) ?? 0);
    }
    const withData = prev.filter((x) => x > 0);
    const thisMonth = byMonth.get(cur) ?? 0;
    // At least two prior months of data, and today past the 10th (a month that just started is always "low").
    if (withData.length >= 2 && Number(today.slice(8, 10)) >= 10) {
      const avg = sum(withData) / withData.length;
      const changePct = Math.round(((thisMonth - avg) / avg) * 100);
      if (changePct >= 40) {
        facts.push({ id: id('monthly_spend', cur), kind: 'monthly_spend', vehicleId: v.id, severity: changePct >= 100 ? 'act' : 'watch', data: { month: cur, thisMonth: Math.round(thisMonth), previousAvg: Math.round(avg), changePct }, actions: [{ type: 'open_costs' }] });
      }
    }
  }

  // — fuel price paid against the MICM reference
  const recent = input.prices.filter((p) => { const d = daysBetween(p.at, today); return d != null && d >= 0 && d <= 90 && p.pricePerGal != null && input.referencePrices[p.fuelGroup] != null; });
  if (recent.length >= 2) {
    const paid = sum(recent.map((p) => p.pricePerGal as number)) / recent.length;
    const ref = sum(recent.map((p) => input.referencePrices[p.fuelGroup])) / recent.length;
    const overPct = Math.round(((paid - ref) / ref) * 100);
    if (overPct >= 5) facts.push({ id: id('fuel_price', 'now'), kind: 'fuel_price', vehicleId: v.id, severity: overPct >= 12 ? 'watch' : 'info', data: { paidPerGal: Math.round(paid * 100) / 100, referencePerGal: Math.round(ref * 100) / 100, overPct, fills: recent.length }, actions: [] });
  }

  // — the biggest single expense of the last 90 days
  const big = input.spend.filter((r) => { const d = daysBetween(r.at, today); return d != null && d >= 0 && d <= 90 && r.category !== 'combustible'; }).sort((a, b) => b.amountDop - a.amountDop)[0];
  if (big && big.amountDop > 0) facts.push({ id: id('biggest_expense', big.at), kind: 'biggest_expense', vehicleId: v.id, severity: 'info', data: { amountDop: Math.round(big.amountDop), at: big.at.slice(0, 10), category: big.category }, actions: [{ type: 'open_costs' }] });

  // — tires: age from the DOT
  for (const tire of input.tires) {
    const made = dotDate(tire.dot);
    const months = made ? monthsBetween(made, today) : null;
    if (months == null) continue;
    const years = Math.floor(months / 12);
    if (years >= TIRE_AGE_YEARS[0]) facts.push({ id: id('tire_age', tire.id), kind: 'tire_age', vehicleId: v.id, severity: years >= TIRE_AGE_YEARS[1] ? 'act' : 'watch', data: { tireId: tire.id, label: tire.label, dot: tire.dot, ageYears: years }, actions: [{ type: 'open_tires' }] });
  }

  // — time since the last rotation / alignment / brake service / battery / belt / coolant
  for (const item of ['rotacion', 'alineacion', 'frenos', 'correa', 'refrigerante'] as const) {
    const last = input.lastService[item];
    const months = last ? monthsBetween(last, today) : null;
    if (months == null) continue;
    const [watch, act] = WEAR_MONTHS[item];
    if (months >= watch) facts.push({ id: id('service_gap', item), kind: 'service_gap', vehicleId: v.id, severity: months >= act ? 'act' : 'watch', data: { item, monthsSince: months, lastAt: (last as string).slice(0, 10) }, actions: [{ type: 'new_service', title: item }] });
  }
  const battery = input.lastService.bateria;
  const bMonths = battery ? monthsBetween(battery, today) : null;
  if (bMonths != null && bMonths >= WEAR_MONTHS.bateria[0]) facts.push({ id: id('battery_age', 'now'), kind: 'battery_age', vehicleId: v.id, severity: bMonths >= WEAR_MONTHS.bateria[1] ? 'act' : 'watch', data: { monthsSince: bMonths, lastAt: (battery as string).slice(0, 10) }, actions: [{ type: 'new_service', title: 'bateria' }] });

  const rank: Record<Severity, number> = { act: 0, watch: 1, info: 2 };
  return facts.sort((a, b) => rank[a.severity] - rank[b.severity] || a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id));
}

// ───────────────────────────────────────────────────────── the cache key ─────────────────────────────────────────────────────────

function fnv(s: string, seed: number): string {
  let h = seed >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/**
 * The same facts → the same key; a changed number or a new fact → a new one. Ids, kinds, severities and data are in it; the
 * ORDER of the list is already canonical. 16 hex digits. Used by `ai_insights` (no new call for an unchanged car) and by the
 * weekly digest ("only when the hash changed").
 */
export function factsHash(facts: readonly Fact[]): string {
  const canon = JSON.stringify(facts.map((f) => [f.id, f.severity, f.data]));
  return fnv(canon, 0x811c9dc5) + fnv(canon, 0x9747b28c);
}
