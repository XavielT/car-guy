/**
 * The MICM weekly fuel-price notice, as text → the week and one price per fuel
 * (IMP 30092026 note 1, ADR-46, research 03 §A). Pure: no network, no PDF.
 *
 * The notice ("Aviso Precios Combustibles", micm.gob.do) is a text PDF. Its
 * text — from `pdftotext -layout` (the fixtures) or from pdf.js items joined
 * into lines (api/precios.ts) — has one sentence with the week:
 *
 *   "… regirán a partir de la 00:00 hora del sábado veintiséis (26) de
 *    septiembre al día viernes dos (02) de octubre de dos mil veintiséis (2026)."
 *
 * and one table row per fuel, the price to the public second from the end
 * (the last column is the week's change, negative in parentheses):
 *
 *   "Gasolina Premium   203.63  71.85 … 358.40  (5.30)   353.10   3.00"
 *
 * The EGP-C / EGP-T rows (power-plant gasoil) and the fuels the app has no id
 * for (Avtur, Kerosene, Fuel Oil) are skipped. MICM publishes no GNV price in
 * the notice; a row for "Gas Natural" is read if it ever appears.
 */
import type { FuelType } from '../types';

export type MicmRow = { fuelType: FuelType; price: number };

export type MicmNotice = {
  /** ISO date, the first day named ("del sábado 26 de septiembre"). */
  weekStart: string;
  /** ISO date, the last day named ("al día viernes 2 de octubre"). */
  weekEnd: string;
  /** In the app's FUEL_ORDER-independent order of the notice. */
  rows: MicmRow[];
};

export type MicmParseResult =
  | { ok: true; notice: MicmNotice }
  | { ok: false; reason: 'empty-text' | 'no-week' | 'no-prices'; partial?: Partial<MicmNotice> };

/** Lower case, accents off, whitespace collapsed. Line breaks kept when `lines`. */
function fold(s: string, lines = false): string {
  const out = s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
  return lines ? out.replace(/[ \t ]+/g, ' ') : out.replace(/\s+/g, ' ');
}

const MONTHS: Record<string, number> = {
  enero: 1,
  febrero: 2,
  marzo: 3,
  abril: 4,
  mayo: 5,
  junio: 6,
  julio: 7,
  agosto: 8,
  septiembre: 9,
  setiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12,
};

/** "sep", "sept", "SEP." → 9. Three letters at least, Spanish names. */
function monthNumber(word: string | undefined): number | null {
  if (!word) return null;
  const w = fold(word).replace(/[^a-z]/g, '');
  if (w.length < 3) return null;
  for (const [name, n] of Object.entries(MONTHS)) if (name.startsWith(w)) return n;
  return null;
}

const pad = (n: number) => String(n).padStart(2, '0');

function iso(y: number, m: number, d: number): string | null {
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

/** Whole days from a to b (ISO dates). */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

/**
 * The week from the notice's sentence. Both wordings MICM uses:
 *   "del sábado diecinueve (19) al día viernes veinticinco (25) de septiembre de … (2026)"
 *   "del sábado veintiséis (26) de septiembre al día viernes dos (02) de octubre de … (2026)"
 * The digits in parentheses are what is read; the words around them are not.
 */
export function parseMicmWeek(text: string): { weekStart: string; weekEnd: string } | null {
  const s = fold(text);
  const at = s.indexOf('a partir de');
  const tail = at >= 0 ? s.slice(at) : s;
  const m = tail.match(
    /\((\d{1,2})\)\s*(?:de\s+([a-z]+)\s+)?(?:del?\s+(\d{4}|[a-z ]+?\((\d{4})\))\s+)?al\s+(?:dia\s+)?(?:[a-z]+\s+)*?\((\d{1,2})\)\s*de\s+([a-z]+)\s+de\s+(?:[a-z ]+)?\((\d{4})\)/,
  );
  if (!m) return null;
  const startDay = Number(m[1]);
  const endDay = Number(m[5]);
  const endMonth = monthNumber(m[6]);
  const endYear = Number(m[7]);
  if (endMonth == null) return null;
  const startMonth = monthNumber(m[2]) ?? endMonth;
  const startYearWritten = m[4] ? Number(m[4]) : /^\d{4}$/.test(m[3] ?? '') ? Number(m[3]) : null;
  // "28 de diciembre al … 3 de enero de 2027": the year written is the closing one.
  const startYear = startYearWritten ?? (startMonth > endMonth ? endYear - 1 : endYear);
  const weekStart = iso(startYear, startMonth, startDay);
  const weekEnd = iso(endYear, endMonth, endDay);
  if (!weekStart || !weekEnd || weekEnd < weekStart) return null;
  return { weekStart, weekEnd };
}

/**
 * The week from the PDF's file name, the fallback when the sentence is unreadable:
 *   AVISO-PRE.-SEM.CORTE-19-25-SEP-DE-2026.pdf
 *   AVISO-PRE.-SEM.CORTE-26-SEP-02-OCT-DE-2026-ESC.-2-ESC.-3.pdf
 */
export function weekFromPdfUrl(url: string): { weekStart: string; weekEnd: string } | null {
  const name = fold(decodeURIComponent(url.split('/').pop() ?? ''));
  const m = name.match(/(\d{1,2})-(?:([a-z]{3,})-)?(\d{1,2})-([a-z]{3,})-(?:de-)?(\d{4})/);
  if (!m) return null;
  const endMonth = monthNumber(m[4]);
  if (endMonth == null) return null;
  const startMonth = monthNumber(m[2]) ?? endMonth;
  const endYear = Number(m[5]);
  const startYear = startMonth > endMonth ? endYear - 1 : endYear;
  const weekStart = iso(startYear, startMonth, Number(m[1]));
  const weekEnd = iso(endYear, endMonth, Number(m[3]));
  if (!weekStart || !weekEnd || weekEnd < weekStart || daysBetween(weekStart, weekEnd) > 8) return null;
  return { weekStart, weekEnd };
}

/** Row name (folded, at the start of a line, followed by the first number) → the app's fuel id. */
const ROWS: { fuelType: FuelType; re: RegExp }[] = [
  { fuelType: 'premium', re: /^gasolina premium\s+(?=[\d(])/ },
  { fuelType: 'regular', re: /^gasolina regular\s+(?=[\d(])/ },
  { fuelType: 'gasoil_regular', re: /^gasoil regular\s+(?=[\d(])/ },
  { fuelType: 'gasoil_optimo', re: /^gasoil optimo\s+(?=[\d(])/ },
  { fuelType: 'glp', re: /^gas licuado de petroleo(?:\s*\(glp\))?[\s*]+(?=[\d(])/ },
  { fuelType: 'gnv', re: /^gas natural(?: vehicular)?(?:\s*\(gnv\))?[\s*]+(?=[\d(])/ },
];

const NUMBER = /\(?-?\d{1,3}(?:,\d{3})*(?:\.\d+)?\)?/g;

/** "(5.30)" → −5.3, "3,380.07" → 3380.07. */
function toNumber(token: string): number {
  const neg = token.startsWith('(') || token.startsWith('-');
  const n = Number(token.replace(/[(),-]/g, ''));
  return neg ? -n : n;
}

/** The price to the public in one table row: the second number from the end. */
export function priceFromRow(rest: string): number | null {
  const nums = (rest.match(NUMBER) ?? []).map(toNumber).filter((n) => Number.isFinite(n));
  if (nums.length < 3) return null;
  const price = nums[nums.length - 2];
  return price > 0 ? Math.round(price * 100) / 100 : null;
}

/** The fuel rows the app knows, each once (the first row of that name wins). */
export function parseMicmRows(text: string): MicmRow[] {
  const out: MicmRow[] = [];
  for (const raw of fold(text, true).split(/\r?\n/)) {
    const line = raw.trim();
    for (const { fuelType, re } of ROWS) {
      const m = line.match(re);
      if (!m || out.some((r) => r.fuelType === fuelType)) continue;
      const price = priceFromRow(line.slice(m[0].length));
      if (price != null) out.push({ fuelType, price });
    }
  }
  return out;
}

/** The whole notice; `pdfUrl` lends its file name when the sentence cannot be read. */
export function parseMicmNotice(text: string, pdfUrl?: string | null): MicmParseResult {
  if (!text || text.replace(/\s+/g, '').length < 40) return { ok: false, reason: 'empty-text' };
  const week = parseMicmWeek(text) ?? (pdfUrl ? weekFromPdfUrl(pdfUrl) : null);
  const rows = parseMicmRows(text);
  if (!week) return { ok: false, reason: 'no-week', partial: { rows } };
  if (!rows.length) return { ok: false, reason: 'no-prices', partial: week };
  return { ok: true, notice: { ...week, rows } };
}

/**
 * The notices page → its PDF links, newest first (the page lists the four
 * latest in that order, each a "Descargar .PDF" button). Relative links are
 * made absolute against `base`; repeats are dropped.
 */
export function micmPdfLinks(html: string, base = 'https://micm.gob.do/'): string[] {
  const out: string[] = [];
  for (const m of html.matchAll(/href\s*=\s*["']([^"']+?\.pdf(?:\?[^"']*)?)["']/gi)) {
    let url: string;
    try {
      url = new URL(m[1].replace(/&amp;/g, '&'), base).toString();
    } catch {
      continue;
    }
    if (!out.includes(url)) out.push(url);
  }
  return out;
}
