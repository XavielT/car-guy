/**
 * Fuel prices (IMP 30092026 note 1, data model v8 §1.1, ADR-46). Pure and tested.
 *
 * Two sources: the person's own rows (`fuel_price`, synced) and the MICM rows
 * the cloud imports every Saturday (`fuel_price_ref`, a pull-only local cache).
 * The board shows, per fuel, the newest of the two and says which; on the same
 * date the person's row wins — they saw the pump, the notice is a reference.
 */
import { DEFAULT_PRICE_WEEK, DEFAULT_REFERENCE_PRICES, FUEL_ORDER } from '../fuel';
import { t } from '../i18n';
import type { FuelType, ReferencePrices, Settings } from '../types';
import { foldText } from './text';

export type FuelPriceSource = 'micm' | 'estacion' | 'recibo' | 'app' | 'otro' | 'manual';

export const FUEL_PRICE_SOURCES: FuelPriceSource[] = ['micm', 'estacion', 'recibo', 'app', 'otro', 'manual'];

/** Chip text, in the current language. `manual` is only the 2.3.x settings strings migrated in v8, never offered as a choice. */
export function fuelPriceSourceLabel(source: FuelPriceSource): string {
  return t.priceSources.labels[source];
}

/** The same, as a record (getters over the dictionary, so it follows the language). */
export const FUEL_PRICE_SOURCE_LABEL: Record<FuelPriceSource, string> = Object.defineProperties(
  {} as Record<FuelPriceSource, string>,
  Object.fromEntries(FUEL_PRICE_SOURCES.map((s) => [s, { get: () => fuelPriceSourceLabel(s), enumerable: true }])),
);

export type FuelPriceRow = {
  id: string;
  fuelType: FuelType;
  /** RD$ per the fuel's posted unit (gal; m³ for GNV). */
  price: number;
  /** ISO date: the week's first day, or the day the person saw it. */
  validFrom: string;
  source: FuelPriceSource;
  station: string;
  note: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
};

export type FuelPriceRefRow = {
  /** `${weekStart}:${fuelType}`. */
  id: string;
  fuelType: FuelType;
  price: number;
  weekStart: string;
  weekEnd: string;
  pdfUrl: string | null;
  importedAt: string;
  /** The importer failed to parse a newer notice; this week is the last good one. */
  stale: boolean | number;
};

export type BoardEntry = {
  fuelType: FuelType;
  price: number;
  /** ISO date the price is valid from (valid_from or week_start). */
  date: string;
  /** Only for MICM rows: the week's last day. */
  dateEnd: string | null;
  source: FuelPriceSource;
  station: string;
  /** The user row's note ('' for MICM rows). v8-migrated rows hold 2.3's week label here. */
  note: string;
  origin: 'user' | 'ref';
  stale: boolean;
  /** The row behind the entry (fuel_price.id or fuel_price_ref.id). */
  rowId: string;
};

export type PricePoint = {
  date: string;
  price: number;
  origin: 'user' | 'ref';
  source: FuelPriceSource;
};

// ---------------------------------------------------------------------------
// parseWeekLabel
// ---------------------------------------------------------------------------

const MONTHS: string[][] = [
  ['enero', 'january'],
  ['febrero', 'february'],
  ['marzo', 'march'],
  ['abril', 'april'],
  ['mayo', 'may'],
  ['junio', 'june'],
  ['julio', 'july'],
  ['agosto', 'august'],
  ['septiembre', 'setiembre', 'september'],
  ['octubre', 'october'],
  ['noviembre', 'november'],
  ['diciembre', 'december'],
];

/** 0–11 for "ago", "sept", "septiembre", "Aug."; null for any other word. Three letters minimum. */
function monthOf(word: string): number | null {
  if (word.length < 3) return null;
  const i = MONTHS.findIndex((names) => names.some((n) => n.startsWith(word)));
  return i < 0 ? null : i;
}

const pad = (n: number) => String(n).padStart(2, '0');

function isoDay(y: number, m: number, d: number): string | null {
  const date = new Date(y, m, d);
  if (date.getFullYear() !== y || date.getMonth() !== m || date.getDate() !== d) return null;
  return `${y}-${pad(m + 1)}-${pad(d)}`;
}

function localIso(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * The first day of a week label, as an ISO date: "15–21 ago 2026 (MICM)" →
 * 2026-08-15, "25 sep – 2 oct 2026" → 2026-09-25, "28 dic 2026 – 3 ene 2027" →
 * 2026-12-28. The year is the first one written after the first month; with
 * only the closing year written and the range crossing New Year ("28 dic – 3
 * ene 2027"), it is the year before. English order ("Sep 26 – Oct 2, 2026")
 * reads too: a month right before the first day is that day's. No year at all
 * → today's year. Anything
 * unreadable → today (local calendar day), never an error: the v8 migration
 * runs this over whatever a person typed into the 2.3.x settings field.
 */
export function parseWeekLabel(label: string | null | undefined, today: Date = new Date()): string {
  const fallback = localIso(today);
  const s = foldText(label).trim();
  if (!s) return fallback;

  const iso = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return isoDay(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])) ?? fallback;
  const dmy = s.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
  if (dmy) return isoDay(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1])) ?? fallback;

  const tokens = [...s.matchAll(/\d+|[a-z]+/g)].map((m) => m[0]);
  const dayAt = tokens.findIndex((t) => /^\d{1,2}$/.test(t) && Number(t) >= 1 && Number(t) <= 31);
  if (dayAt < 0) return fallback;
  const day = Number(tokens[dayAt]);

  let monthAt = -1;
  let month = -1;
  // English order, "Sep 26 – Oct 2, 2026": a month right before the first day is that day's.
  const before = dayAt > 0 && /^[a-z]+$/.test(tokens[dayAt - 1]) ? monthOf(tokens[dayAt - 1]) : null;
  if (before != null) {
    monthAt = dayAt;
    month = before;
  }
  for (let i = dayAt + 1; monthAt < 0 && i < tokens.length; i++) {
    const m = /^[a-z]+$/.test(tokens[i]) ? monthOf(tokens[i]) : null;
    if (m != null) {
      monthAt = i;
      month = m;
      break;
    }
  }
  if (monthAt < 0) return fallback;

  let year = today.getFullYear();
  let laterMonth: number | null = null;
  for (let i = monthAt + 1; i < tokens.length; i++) {
    const t = tokens[i];
    if (/^\d{4}$/.test(t)) {
      year = Number(t);
      // "28 dic – 3 ene 2027": the year written belongs to the closing date.
      if (laterMonth != null && laterMonth < month) year -= 1;
      break;
    }
    const m = /^[a-z]+$/.test(t) ? monthOf(t) : null;
    if (m != null && laterMonth == null) laterMonth = m;
  }
  return isoDay(year, month, day) ?? fallback;
}

// ---------------------------------------------------------------------------
// Board and series
// ---------------------------------------------------------------------------

const dayOf = (iso: string) => iso.slice(0, 10);

function liveUserRows(rows: readonly FuelPriceRow[]): FuelPriceRow[] {
  return rows.filter((r) => !r.deletedAt && Number.isFinite(r.price) && r.price > 0);
}

function liveRefRows(rows: readonly FuelPriceRefRow[]): FuelPriceRefRow[] {
  return rows.filter((r) => Number.isFinite(r.price) && r.price > 0);
}

/** Newest date first; on the same day the row written last (a correction) wins. */
function newestUser(rows: FuelPriceRow[]): FuelPriceRow | null {
  let best: FuelPriceRow | null = null;
  for (const r of rows) {
    if (!best) best = r;
    else {
      const d = dayOf(r.validFrom).localeCompare(dayOf(best.validFrom));
      if (d > 0 || (d === 0 && r.createdAt.localeCompare(best.createdAt) > 0)) best = r;
    }
  }
  return best;
}

function newestRef(rows: FuelPriceRefRow[]): FuelPriceRefRow | null {
  let best: FuelPriceRefRow | null = null;
  for (const r of rows) {
    if (!best || dayOf(r.weekStart).localeCompare(dayOf(best.weekStart)) > 0) best = r;
  }
  return best;
}

function userEntry(r: FuelPriceRow): BoardEntry {
  return {
    fuelType: r.fuelType,
    price: r.price,
    date: dayOf(r.validFrom),
    dateEnd: null,
    source: r.source,
    station: r.station ?? '',
    note: r.note ?? '',
    origin: 'user',
    stale: false,
    rowId: r.id,
  };
}

function refEntry(r: FuelPriceRefRow): BoardEntry {
  return {
    fuelType: r.fuelType,
    price: r.price,
    date: dayOf(r.weekStart),
    dateEnd: r.weekEnd ? dayOf(r.weekEnd) : null,
    source: 'micm',
    station: '',
    note: '',
    origin: 'ref',
    stale: Boolean(r.stale),
    rowId: r.id,
  };
}

/**
 * Per fuel, the newest price among the person's rows (tombstones ignored) and
 * the MICM rows; on the same date the person's row wins. Fuels with no price at
 * all are left out. Order: FUEL_ORDER (Premium, Regular, Gasoil…).
 */
export function currentBoard(userRows: readonly FuelPriceRow[], refRows: readonly FuelPriceRefRow[]): BoardEntry[] {
  const users = liveUserRows(userRows);
  const refs = liveRefRows(refRows);
  const out: BoardEntry[] = [];
  for (const fuel of FUEL_ORDER) {
    const u = newestUser(users.filter((r) => r.fuelType === fuel));
    const r = newestRef(refs.filter((x) => x.fuelType === fuel));
    if (u && (!r || dayOf(u.validFrom) >= dayOf(r.weekStart))) out.push(userEntry(u));
    else if (r) out.push(refEntry(r));
  }
  return out;
}

/**
 * One fuel over time for the Cifras chart: every date that has a price, oldest
 * first, each point labelled by origin so the chart can draw the two series.
 * One point per date — the person's row when both exist (the board's rule).
 */
export function series(
  fuelType: FuelType,
  userRows: readonly FuelPriceRow[],
  refRows: readonly FuelPriceRefRow[],
): PricePoint[] {
  const byDate = new Map<string, PricePoint & { createdAt?: string }>();
  for (const r of liveRefRows(refRows)) {
    if (r.fuelType !== fuelType) continue;
    const date = dayOf(r.weekStart);
    if (!byDate.has(date)) byDate.set(date, { date, price: r.price, origin: 'ref', source: 'micm' });
  }
  for (const r of liveUserRows(userRows)) {
    if (r.fuelType !== fuelType) continue;
    const date = dayOf(r.validFrom);
    const prev = byDate.get(date);
    if (prev && prev.origin === 'user' && (prev.createdAt ?? '') >= r.createdAt) continue;
    byDate.set(date, { date, price: r.price, origin: 'user', source: r.source, createdAt: r.createdAt });
  }
  return [...byDate.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(({ date, price, origin, source }) => ({ date, price, origin, source }));
}

// ---------------------------------------------------------------------------
// Bridge to the 2.3.x settings shape
// ---------------------------------------------------------------------------

function parts(iso: string): { y: number; m: number; d: number } {
  const [y, m, d] = iso.split('-').map(Number);
  return { y, m: m - 1, d };
}

/** "15–21 ago 2026", "25 sep – 2 oct 2026", "28 dic 2026 – 3 ene 2027", or one day "15 ago 2026". */
export function weekRangeLabel(start: string, end?: string | null): string {
  const months = t.priceSources.months;
  const a = parts(start);
  if (!end || dayOf(end) === dayOf(start)) return `${a.d} ${months[a.m]} ${a.y}`;
  const b = parts(end);
  if (a.y !== b.y) return `${a.d} ${months[a.m]} ${a.y} – ${b.d} ${months[b.m]} ${b.y}`;
  if (a.m !== b.m) return `${a.d} ${months[a.m]} – ${b.d} ${months[b.m]} ${b.y}`;
  return `${a.d}–${b.d} ${months[a.m]} ${a.y}`;
}

/**
 * The board in the shape the store has exposed since 2.0 (`settings.referencePrices`
 * + `settings.priceWeekLabel`), so the fill-up form and the estimates keep working
 * unchanged. A fuel with no price keeps the bundled default. The label is the
 * newest entry's date and source: "15–21 ago 2026 (MICM)", "12 sep 2026 (Estación)";
 * when that entry is a user row with a note, the note verbatim (the v8 migration
 * keeps 2.3's week label there, so the board reads exactly as before). An empty
 * board reads 2.3's default week.
 */
export function referencePricesFromBoard(
  board: readonly BoardEntry[],
  fallback: ReferencePrices = DEFAULT_REFERENCE_PRICES,
): Pick<Settings, 'referencePrices' | 'priceWeekLabel'> {
  const referencePrices: ReferencePrices = { ...fallback };
  let newest: BoardEntry | null = null;
  for (const e of board) {
    referencePrices[e.fuelType] = e.price;
    if (!newest || e.date > newest.date) newest = e;
  }
  let priceWeekLabel = DEFAULT_PRICE_WEEK;
  if (newest?.origin === 'user' && newest.note.trim()) priceWeekLabel = newest.note.trim();
  else if (newest) priceWeekLabel = `${weekRangeLabel(newest.date, newest.dateEnd)} (${fuelPriceSourceLabel(newest.source)})`;
  return { referencePrices, priceWeekLabel };
}

// ---------------------------------------------------------------------------
// Phase 5: the board's chips, the history, the fill-up prefill, the chart
// ---------------------------------------------------------------------------

/** "26 sep" (no year), in the current language. */
export function shortDayLabel(iso: string): string {
  const { m, d } = parts(dayOf(iso));
  return `${d} ${t.priceSources.months[m]}`;
}

/** The board row's chip: "MICM · semana del 26 sep", "Manual · 3 oct", "Estación · 28 sep". */
export function boardSourceLabel(entry: Pick<BoardEntry, 'source' | 'date'>): string {
  const day = shortDayLabel(entry.date);
  return entry.source === 'micm'
    ? t.fuelPricesUi.chip(fuelPriceSourceLabel('micm'), t.fuelPricesUi.weekOf(day))
    : t.fuelPricesUi.chip(fuelPriceSourceLabel(entry.source), day);
}

/** The MICM week a day falls in: the Saturday on or before it (notices run Saturday–Friday). */
export function micmWeekOf(iso: string): string {
  const { y, m, d } = parts(dayOf(iso));
  const date = new Date(Date.UTC(y, m, d));
  date.setUTCDate(d - ((date.getUTCDay() + 1) % 7));
  return date.toISOString().slice(0, 10);
}

export function addDays(iso: string, n: number): string {
  const { y, m, d } = parts(dayOf(iso));
  return new Date(Date.UTC(y, m, d + n)).toISOString().slice(0, 10);
}

export type HistoryItem = {
  /** fuel_price.id or fuel_price_ref.id. */
  key: string;
  date: string;
  price: number;
  origin: 'user' | 'ref';
  source: FuelPriceSource;
  station: string;
  note: string;
  stale: boolean;
  /** The row the board shows for this fuel right now. */
  current: boolean;
};

export type HistoryWeek = { weekStart: string; weekEnd: string; items: HistoryItem[] };

/**
 * One fuel's prices, every row (user and MICM), grouped by MICM week (Saturday
 * to Friday), newest week first; inside a week the newest date first, and on
 * the same date the person's row before MICM's (the board's tie rule).
 */
export function priceHistory(fuelType: FuelType, userRows: readonly FuelPriceRow[], refRows: readonly FuelPriceRefRow[]): HistoryWeek[] {
  const board = currentBoard(userRows, refRows).find((e) => e.fuelType === fuelType);
  const items: (HistoryItem & { createdAt: string })[] = [];
  for (const r of liveUserRows(userRows)) {
    if (r.fuelType !== fuelType) continue;
    items.push({
      key: r.id,
      date: dayOf(r.validFrom),
      price: r.price,
      origin: 'user',
      source: r.source,
      station: r.station ?? '',
      note: r.note ?? '',
      stale: false,
      current: board?.rowId === r.id,
      createdAt: r.createdAt,
    });
  }
  for (const r of liveRefRows(refRows)) {
    if (r.fuelType !== fuelType) continue;
    items.push({
      key: r.id,
      date: dayOf(r.weekStart),
      price: r.price,
      origin: 'ref',
      source: 'micm',
      station: '',
      note: '',
      stale: Boolean(r.stale),
      current: board?.rowId === r.id,
      createdAt: '',
    });
  }
  items.sort(
    (a, b) =>
      b.date.localeCompare(a.date) ||
      (a.origin === b.origin ? b.createdAt.localeCompare(a.createdAt) : a.origin === 'user' ? -1 : 1),
  );
  const weeks: HistoryWeek[] = [];
  for (const { createdAt: _c, ...item } of items) {
    const weekStart = micmWeekOf(item.date);
    let week = weeks.find((w) => w.weekStart === weekStart);
    if (!week) {
      week = { weekStart, weekEnd: addDays(weekStart, 6), items: [] };
      weeks.push(week);
    }
    week.items.push(item);
  }
  return weeks;
}

/** GAL_L without importing units (pure, and the same constant). */
const LITERS_PER_GALLON = 3.785411784;

export type PricePrefill = { price: number; entry: BoardEntry };

/**
 * What the fill-up form's price field starts with: the board's price for the
 * fuel, in the vehicle's volume unit (the board is per gallon; per liter
 * divides; GNV stays per m³), rounded to cents. Null when the board has none.
 */
export function prefillPrice(board: readonly BoardEntry[], fuelType: FuelType, volumeUnit: 'gal' | 'l' = 'gal'): PricePrefill | null {
  const entry = board.find((e) => e.fuelType === fuelType);
  if (!entry) return null;
  const perUnit = volumeUnit === 'l' && fuelType !== 'gnv' ? entry.price / LITERS_PER_GALLON : entry.price;
  return { price: Math.round(perUnit * 100) / 100, entry };
}

/**
 * Launch rule: ping the importer (GET /api/precios) when the newest MICM week
 * in the cache started more than 8 days ago — or there is none — and it was not
 * pinged today already. `null` newest with `tableMissing` (sql/027 not applied)
 * never pings. Days are local calendar days (ISO).
 */
export function shouldPingImporter(newestWeekStart: string | null, today: string, lastPingDay: string | null, tableMissing = false): boolean {
  if (tableMissing) return false;
  if (lastPingDay === today) return false;
  if (!newestWeekStart) return true;
  const age = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${dayOf(newestWeekStart)}T00:00:00Z`)) / 86_400_000);
  return age > 8;
}

export type ChartSeries = { user: { date: string; price: number }[]; micm: { date: string; price: number }[] };

/**
 * The Cifras chart's two series for one fuel over the last `months` months:
 * every MICM week, and every price the person recorded (not merged, so a
 * station price under the MICM line is visible). Oldest first.
 */
export function chartSeries(
  fuelType: FuelType,
  userRows: readonly FuelPriceRow[],
  refRows: readonly FuelPriceRefRow[],
  today: string,
  months = 12,
): ChartSeries {
  const { y, m, d } = parts(today);
  const since = new Date(Date.UTC(y, m - months, d)).toISOString().slice(0, 10);
  const user = liveUserRows(userRows)
    .filter((r) => r.fuelType === fuelType && dayOf(r.validFrom) >= since && dayOf(r.validFrom) <= today)
    .map((r) => ({ date: dayOf(r.validFrom), price: r.price }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const micm = liveRefRows(refRows)
    .filter((r) => r.fuelType === fuelType && dayOf(r.weekStart) >= since && dayOf(r.weekStart) <= today)
    .map((r) => ({ date: dayOf(r.weekStart), price: r.price }))
    .sort((a, b) => a.date.localeCompare(b.date));
  return { user, micm };
}

/** The line under "Importar MICM ahora" for what /api/precios answered (null = not reached). */
export function importMessage(
  answer: { ok: boolean; upToDate?: boolean; reason?: string; weekStart: string | null; weekEnd: string | null } | null,
): string {
  const ui = t.fuelPricesUi;
  if (!answer) return ui.importOffline;
  const week = answer.weekStart ? weekRangeLabel(answer.weekStart, answer.weekEnd) : '';
  if (answer.ok) return answer.upToDate ? ui.importUpToDate(week) : ui.importDone(week);
  switch (answer.reason) {
    case 'pdf-not-text':
      return ui.importFailed(ui.reasons.notText);
    case 'no-writer-key':
    case 'not-configured':
      return ui.importFailed(ui.reasons.notConfigured);
    case 'notices-unreachable':
    case 'pdf-unreachable':
      return ui.importFailed(ui.reasons.unreachable);
    default:
      return ui.importFailed(ui.reasons.unreadable);
  }
}
