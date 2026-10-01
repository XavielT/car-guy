/**
 * The MICM import, step by step, with every outside call injected so it can be
 * tested without the network (ADR-46, research 03 §A). api/precios.ts wires
 * the real fetch, pdf.js and the Supabase RPC.
 *
 *   notices page → newest PDF link → PDF → text → parse → validate → upsert
 *
 * Rules:
 *   · the five fuels MICM always prints (Premium, Regular, Gasoil regular and
 *     óptimo, GLP) must all be there; GNV is never in the notice;
 *   · each price within ±20 % of the same fuel's last stored week before it;
 *   · the week 5–8 days long and not older than what is stored;
 *   · a failed parse or validation marks the last good week `stale` (the app
 *     then says so) and never writes a guess; a network failure writes nothing;
 *   · the newest link already imported (same pdf_url, not stale) is a no-op.
 */
import type { FuelType } from '../types';
import { daysBetween, micmPdfLinks, parseMicmNotice, type MicmNotice, type MicmRow } from './parse';

export const MICM_NOTICES_URL =
  'https://micm.gob.do/direcciones/combustibles/avisos-semanales-de-precios/avisos-semanales-de-precios-de-combustibles/';

/** The fuels every notice carries. */
export const MICM_CORE_FUELS: FuelType[] = ['premium', 'regular', 'gasoil_regular', 'gasoil_optimo', 'glp'];

export const MICM_TOLERANCE = 0.2;

/** A row of carguy.fuel_price_ref as the importer reads it (anon select). */
export type StoredRefRow = {
  week_start: string;
  week_end: string;
  fuel_type: string;
  price: number | string;
  pdf_url: string | null;
  stale: boolean | null;
};

/** What upsert_fuel_price_ref(rows jsonb) takes, one element per fuel. */
export type UpsertRow = {
  week_start: string;
  week_end: string;
  fuel_type: string;
  price: number;
  source: 'micm';
  pdf_url: string | null;
  raw_text: string | null;
  stale: boolean;
};

export type ImportReason =
  | 'notices-unreachable'
  | 'no-pdf-link'
  | 'pdf-unreachable'
  | 'pdf-unreadable'
  | 'pdf-not-text'
  | 'parse-failed'
  | 'validation-failed'
  | 'no-writer-key'
  | 'store-failed';

export type ImportResult = {
  ok: boolean;
  /** True when the newest good week on record is older than the newest notice (or unknown). */
  stale: boolean;
  reason?: ImportReason;
  /** The newest notice was imported before: nothing written. */
  upToDate?: boolean;
  imported: number;
  weekStart: string | null;
  weekEnd: string | null;
  pdfUrl: string | null;
  rows: MicmRow[];
  problems?: string[];
};

export type ImportDeps = {
  fetchText: (url: string) => Promise<string>;
  fetchBytes: (url: string) => Promise<Uint8Array>;
  pdfToText: (bytes: Uint8Array) => Promise<string>;
  /** Stored rows, newest week first (a few weeks is enough). */
  lastStored: () => Promise<StoredRefRow[]>;
  /** The RPC; absent when no writer key is configured. Returns rows written. */
  upsert?: (rows: UpsertRow[]) => Promise<number>;
};

const num = (p: number | string) => (typeof p === 'string' ? Number(p) : p);
const day = (s: string) => s.slice(0, 10);

/** Per fuel, the newest stored price from a week that started before `weekStart`. */
export function previousPrices(stored: readonly StoredRefRow[], weekStart: string): Map<string, number> {
  const out = new Map<string, { week: string; price: number }>();
  for (const r of stored) {
    const week = day(r.week_start);
    const price = num(r.price);
    if (week >= weekStart || !Number.isFinite(price) || price <= 0) continue;
    const prev = out.get(r.fuel_type);
    if (!prev || week > prev.week) out.set(r.fuel_type, { week, price });
  }
  return new Map([...out].map(([k, v]) => [k, v.price]));
}

/** Problems with a parsed notice; empty = good to store. */
export function validateMicm(notice: MicmNotice, stored: readonly StoredRefRow[], tolerance = MICM_TOLERANCE): string[] {
  const problems: string[] = [];
  const span = daysBetween(notice.weekStart, notice.weekEnd);
  if (span < 5 || span > 8) problems.push(`week-span:${span}`);
  const newest = stored.reduce<string | null>((m, r) => (m == null || day(r.week_start) > m ? day(r.week_start) : m), null);
  if (newest && notice.weekStart < newest) problems.push(`older-than-stored:${newest}`);
  for (const f of MICM_CORE_FUELS) if (!notice.rows.some((r) => r.fuelType === f)) problems.push(`missing:${f}`);
  const prev = previousPrices(stored, notice.weekStart);
  for (const r of notice.rows) {
    const p = prev.get(r.fuelType);
    if (p == null) continue;
    if (Math.abs(r.price - p) / p > tolerance) problems.push(`jump:${r.fuelType}:${p}->${r.price}`);
  }
  return problems;
}

/** The newest stored week's rows, newest first by week. */
function newestWeek(stored: readonly StoredRefRow[]): StoredRefRow[] {
  if (!stored.length) return [];
  const week = stored.map((r) => day(r.week_start)).sort().at(-1)!;
  return stored.filter((r) => day(r.week_start) === week);
}

function fromStored(rows: readonly StoredRefRow[]): Pick<ImportResult, 'weekStart' | 'weekEnd' | 'pdfUrl' | 'rows'> {
  return {
    weekStart: rows[0] ? day(rows[0].week_start) : null,
    weekEnd: rows[0] ? day(rows[0].week_end) : null,
    pdfUrl: rows[0]?.pdf_url ?? null,
    rows: rows.map((r) => ({ fuelType: r.fuel_type as FuelType, price: num(r.price) })),
  };
}

export async function runMicmImport(deps: ImportDeps): Promise<ImportResult> {
  let stored: StoredRefRow[] = [];
  try {
    stored = await deps.lastStored();
  } catch {
    stored = []; // the table may not exist yet; validation then has nothing to compare with
  }
  const last = newestWeek(stored);
  const lastIsStale = last.some((r) => r.stale);

  /** A failure: the last good week answers, flagged stale (in the table too, when `mark`). */
  const fail = async (reason: ImportReason, mark: boolean, extra: Partial<ImportResult> = {}): Promise<ImportResult> => {
    if (mark && deps.upsert && last.length && !lastIsStale) {
      try {
        await deps.upsert(
          last.map((r) => ({
            week_start: day(r.week_start),
            week_end: day(r.week_end),
            fuel_type: r.fuel_type,
            price: num(r.price),
            source: 'micm',
            pdf_url: r.pdf_url,
            raw_text: null,
            stale: true,
          })),
        );
      } catch {
        // marking is best effort; the answer still says stale
      }
    }
    return { ok: false, stale: true, reason, imported: 0, ...fromStored(last), ...extra };
  };

  let html: string;
  try {
    html = await deps.fetchText(MICM_NOTICES_URL);
  } catch {
    return fail('notices-unreachable', false);
  }
  const pdfUrl = micmPdfLinks(html, MICM_NOTICES_URL)[0];
  if (!pdfUrl) return fail('no-pdf-link', true);

  if (last.length && !lastIsStale && last[0].pdf_url === pdfUrl) {
    return { ok: true, stale: false, upToDate: true, imported: 0, ...fromStored(last) };
  }

  let bytes: Uint8Array;
  try {
    bytes = await deps.fetchBytes(pdfUrl);
  } catch {
    return fail('pdf-unreachable', false, { pdfUrl });
  }
  let text: string;
  try {
    text = await deps.pdfToText(bytes);
  } catch {
    return fail('pdf-unreadable', true, { pdfUrl });
  }
  const parsed = parseMicmNotice(text, pdfUrl);
  if (!parsed.ok) {
    return fail(parsed.reason === 'empty-text' ? 'pdf-not-text' : 'parse-failed', true, { problems: [parsed.reason] });
  }
  const { notice } = parsed;
  const problems = validateMicm(notice, stored);
  if (problems.length) return fail('validation-failed', true, { problems });

  const base = { weekStart: notice.weekStart, weekEnd: notice.weekEnd, pdfUrl, rows: notice.rows };
  if (!deps.upsert) return { ok: false, stale: true, reason: 'no-writer-key', imported: 0, ...base };
  try {
    const imported = await deps.upsert(
      notice.rows.map((r) => ({
        week_start: notice.weekStart,
        week_end: notice.weekEnd,
        fuel_type: r.fuelType,
        price: r.price,
        source: 'micm',
        pdf_url: pdfUrl,
        raw_text: text.slice(0, 20_000),
        stale: false,
      })),
    );
    return { ok: true, stale: false, imported, ...base };
  } catch {
    return { ok: false, stale: true, reason: 'store-failed', imported: 0, ...base };
  }
}
