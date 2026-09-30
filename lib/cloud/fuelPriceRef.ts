import { enqueue, now } from '../db/client';
import type { FuelPriceRef } from '../db/types';
import { recordError } from '../diagnostics';
import { getSupabase } from './supabase';

/**
 * The MICM weekly prices, pulled into the local `fuel_price_ref` cache (v8).
 *
 * Not the sync engine: the cloud table is anyone's to read (anon SELECT) and
 * nobody's to write from the app, so there is no push, no cursor and no
 * user_id. It is created in Phase 5 (sql/027); until then the table does not
 * exist and the fetch answers "not there" — that is silence, not an error.
 */

/** A cloud row of carguy.fuel_price_ref (sql/027). */
export type CloudFuelPriceRef = {
  week_start: string;
  week_end: string;
  fuel_type: string;
  price: number | string;
  pdf_url: string | null;
  imported_at: string;
  stale: boolean | null;
};

/** PostgREST / Postgres codes for "that table is not there (yet)". */
const MISSING = new Set(['42P01', 'PGRST205', 'PGRST202', '404']);

export function isMissingTable(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  if (error.code && MISSING.has(error.code)) return true;
  return /does not exist|could not find the table/i.test(error.message ?? '');
}

/** Cloud rows → local cache rows; a row without a usable price or dates is skipped. */
export function mapRefRows(rows: readonly CloudFuelPriceRef[]): FuelPriceRef[] {
  const out: FuelPriceRef[] = [];
  for (const r of rows) {
    const price = typeof r.price === 'string' ? Number(r.price) : r.price;
    if (!Number.isFinite(price) || price <= 0 || !r.week_start || !r.week_end || !r.fuel_type) continue;
    const weekStart = r.week_start.slice(0, 10);
    out.push({
      id: `${weekStart}:${r.fuel_type}`,
      fuelType: r.fuel_type,
      price,
      weekStart,
      weekEnd: r.week_end.slice(0, 10),
      pdfUrl: r.pdf_url ?? null,
      importedAt: r.imported_at,
      stale: r.stale === true,
    });
  }
  return out;
}

/** The last 26 weeks is plenty for the board and the chart. */
const WEEKS = 26;

/**
 * Fetches the reference rows and replaces the cache. Returns how many rows the
 * cache now holds, or null when nothing was fetched (offline, no cloud, no table).
 */
export async function refreshFuelPriceRef(): Promise<number | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const since = new Date(Date.now() - WEEKS * 7 * 86_400_000).toISOString().slice(0, 10);
  // Not in the generated types until sql/027 exists (Phase 5).
  const untyped = supabase as unknown as {
    from(table: string): {
      select(columns: string): {
        gte(column: string, value: string): Promise<{ data: CloudFuelPriceRef[] | null; error: { code?: string; message?: string } | null }>;
      };
    };
  };
  let result: Awaited<ReturnType<ReturnType<ReturnType<typeof untyped.from>['select']>['gte']>>;
  try {
    result = await untyped.from('fuel_price_ref').select('week_start, week_end, fuel_type, price, pdf_url, imported_at, stale').gte('week_start', since);
  } catch {
    return null; // offline
  }
  if (result.error) {
    if (!isMissingTable(result.error)) recordError('fuel-price-ref', result.error.message ?? String(result.error.code));
    return null;
  }
  const rows = mapRefRows(result.data ?? []);
  if (!rows.length) return 0;
  await enqueue(async (db) => {
    for (const r of rows) {
      await db.runAsync(
        `INSERT INTO fuel_price_ref (id, fuel_type, price, week_start, week_end, pdf_url, imported_at, stale)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET price = excluded.price, week_end = excluded.week_end, pdf_url = excluded.pdf_url,
           imported_at = excluded.imported_at, stale = excluded.stale`,
        [r.id, r.fuelType, r.price, r.weekStart, r.weekEnd, r.pdfUrl, r.importedAt || now(), r.stale ? 1 : 0] as never,
      );
    }
  });
  return rows.length;
}
