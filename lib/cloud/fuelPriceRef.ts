import { Platform } from 'react-native';

import { enqueue, now } from '../db/client';
import { listFuelPriceRefs } from '../db/priceOps';
import { settings } from '../db/repos';
import { shouldPingImporter } from '../domain/fuelPrices';
import type { FuelPriceRef } from '../db/types';
import { recordError } from '../diagnostics';
import { getSupabase } from './supabase';

/**
 * The MICM weekly prices, pulled into the local `fuel_price_ref` cache (v8).
 *
 * Not the sync engine: the cloud table is anyone's to read (anon SELECT) and
 * nobody's to write from the app, so there is no push, no cursor and no
 * user_id. The table is sql/027 (Phase 5); until it is applied the fetch answers
 * "not there" — that is silence, not an error. Phase 5 adds the importer
 * calls (api/precios.ts): the button on Precios and the launch ping.
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

type RefreshOutcome = { status: 'ok'; count: number } | { status: 'missing' | 'offline' | 'error' | 'no-cloud' };

async function pullRefs(): Promise<RefreshOutcome> {
  const supabase = getSupabase();
  if (!supabase) return { status: 'no-cloud' };
  const since = new Date(Date.now() - WEEKS * 7 * 86_400_000).toISOString().slice(0, 10);
  // Not in the generated types (sql/027 is applied by hand).
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
    return { status: 'offline' };
  }
  if (result.error) {
    if (isMissingTable(result.error)) return { status: 'missing' };
    recordError('fuel-price-ref', result.error.message ?? String(result.error.code));
    return { status: 'error' };
  }
  const rows = mapRefRows(result.data ?? []);
  if (!rows.length) return { status: 'ok', count: 0 };
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
  return { status: 'ok', count: rows.length };
}

/**
 * Fetches the reference rows and replaces the cache. Returns how many rows the
 * cache now holds, or null when nothing was fetched (offline, no cloud, no table).
 */
export async function refreshFuelPriceRef(): Promise<number | null> {
  const outcome = await pullRefs();
  return outcome.status === 'ok' ? outcome.count : null;
}

// ---------------------------------------------------------------------------
// The importer (api/precios.ts, Phase 5)
// ---------------------------------------------------------------------------

const SITE = 'https://car-guy.vercel.app';

/** The deployed function: same origin on the deployed web app, the production URL from native and localhost. */
export function importerUrl(platform: string = Platform.OS, host: string | null = typeof location !== 'undefined' ? location.hostname : null): string {
  if (platform === 'web' && host && host !== 'localhost' && host !== '127.0.0.1') return '/api/precios';
  return `${SITE}/api/precios`;
}

/** What /api/precios answers (lib/micm/importer.ts ImportResult, as JSON). */
export type ImporterAnswer = {
  ok: boolean;
  stale: boolean;
  reason?: string;
  upToDate?: boolean;
  imported: number;
  weekStart: string | null;
  weekEnd: string | null;
};

/** GET /api/precios; null when it could not be reached or did not answer JSON. */
export async function callImporter(): Promise<ImporterAnswer | null> {
  try {
    const response = await fetch(importerUrl(), { headers: { Accept: 'application/json' } });
    const body = (await response.json()) as ImporterAnswer;
    return body && typeof body === 'object' && 'ok' in body ? body : null;
  } catch {
    return null;
  }
}

/** Precios → "Importar MICM ahora": the function, then the cache. */
export async function importMicmNow(): Promise<{ answer: ImporterAnswer | null; cached: number | null }> {
  const answer = await callImporter();
  const cached = await refreshFuelPriceRef();
  return { answer, cached };
}

const PING_KEY = 'micm_import_ping_day';

function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * On launch: pull the cache; when its newest week is more than 8 days old (the
 * Saturday cron did not run, or Hobby skipped it), ping the importer once a day
 * and pull again. Silent: the table missing (sql/027 not applied), offline, or
 * the importer failing changes nothing on screen. Returns rows pulled, or null.
 */
export async function refreshFuelPriceRefOnLaunch(): Promise<number | null> {
  const first = await pullRefs();
  if (first.status !== 'ok') return null;
  const newest = (await listFuelPriceRefs())[0]?.weekStart ?? null;
  const today = localToday();
  const lastPing = await settings.get<string | null>(PING_KEY, null);
  if (!shouldPingImporter(newest, today, lastPing)) return first.count;
  await settings.set(PING_KEY, today);
  const answer = await callImporter();
  if (!answer?.ok || answer.upToDate) return first.count;
  return refreshFuelPriceRef();
}
