/**
 * GET /api/precios — the MICM weekly fuel prices into carguy.fuel_price_ref
 * (IMP 30092026 note 1, ADR-46). Vercel Cron calls it on Saturday 12:00 UTC
 * (08:00 in Santo Domingo, vercel.json); the app calls it from Precios →
 * "Importar MICM ahora" and, once a day, when its newest week is > 8 days old.
 *
 * lib/micm/importer.ts does the work; this file only wires fetch, pdf.js
 * (unpdf, the serverless build) and two PostgREST calls:
 *   · read the last weeks with the public anon key (the table is anon-readable);
 *   · write through carguy.upsert_fuel_price_ref(rows) with a writer token:
 *     CARGUY_IMPORTER_JWT (a JWT whose role is carguy_importer, sql/027), or
 *     SUPABASE_SERVICE_ROLE_KEY as the fallback (ADR-38). Read here, at run
 *     time, in a Vercel function — never EXPO_PUBLIC_, never in the web bundle.
 *
 * Answers JSON (ImportResult). Success is cached an hour at the CDN, so a
 * crowd of taps is one MICM fetch; failures five minutes. Errors carry
 * X-Car-Guy-Error, never a secret.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';

import { runMicmImport, type ImportDeps, type ImportResult, type StoredRefRow, type UpsertRow } from '../lib/micm/importer';
import { itemsToLines, type PdfTextItem } from '../lib/micm/pdfText';

export const CACHE_OK = 'public, max-age=60, s-maxage=3600, stale-while-revalidate=600';
export const CACHE_FAIL = 'public, max-age=0, s-maxage=300';

const UA = 'Mozilla/5.0 (compatible; CarGuy/2.4; +https://car-guy.vercel.app)';
const TIMEOUT_MS = 15_000;

type Env = Record<string, string | undefined>;

function send(res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // Public data; the app on localhost (web dev) and native fetch it cross-origin.
  res.setHeader('Access-Control-Allow-Origin', '*');
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.end(JSON.stringify(body));
}

/** Which key writes, and how it goes on the wire. */
export function writerHeaders(env: Env): Record<string, string> | null {
  const anon = env.SUPABASE_ANON_KEY ?? env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const jwt = env.CARGUY_IMPORTER_JWT?.trim();
  if (jwt && anon) return { apikey: anon, Authorization: `Bearer ${jwt}` };
  const service = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!service) return null;
  // New-style secret keys (sb_secret_…) are not JWTs: they go in apikey only.
  return service.startsWith('sb_secret_') ? { apikey: service } : { apikey: service, Authorization: `Bearer ${service}` };
}

export async function pdfToText(bytes: Uint8Array): Promise<string> {
  const { getDocumentProxy } = await import('unpdf');
  const pdf = await getDocumentProxy(bytes, { verbosity: 0 });
  const pages: string[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    pages.push(itemsToLines(content.items as PdfTextItem[]));
  }
  return pages.join('\n');
}

export function realDeps(env: Env): ImportDeps | null {
  const base = (env.SUPABASE_URL ?? env.EXPO_PUBLIC_SUPABASE_URL)?.replace(/\/$/, '');
  const anon = env.SUPABASE_ANON_KEY ?? env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!base || !anon) return null;
  const get = async (url: string) => {
    const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!r.ok) throw new Error(`http ${r.status}`);
    return r;
  };
  const writer = writerHeaders(env);
  return {
    fetchText: async (url) => (await get(url)).text(),
    fetchBytes: async (url) => new Uint8Array(await (await get(url)).arrayBuffer()),
    pdfToText,
    lastStored: async () => {
      const r = await fetch(
        `${base}/rest/v1/fuel_price_ref?select=week_start,week_end,fuel_type,price,pdf_url,stale&order=week_start.desc&limit=36`,
        { headers: { apikey: anon, 'Accept-Profile': 'carguy' }, signal: AbortSignal.timeout(TIMEOUT_MS) },
      );
      if (!r.ok) throw new Error(`stored ${r.status}`);
      return (await r.json()) as StoredRefRow[];
    },
    upsert: writer
      ? async (rows: UpsertRow[]) => {
          const r = await fetch(`${base}/rest/v1/rpc/upsert_fuel_price_ref`, {
            method: 'POST',
            headers: { ...writer, 'Content-Type': 'application/json', 'Content-Profile': 'carguy' },
            body: JSON.stringify({ rows }),
            signal: AbortSignal.timeout(TIMEOUT_MS),
          });
          if (!r.ok) throw new Error(`upsert ${r.status}`);
          return Number(await r.json()) || 0;
        }
      : undefined,
  };
}

export function statusFor(result: ImportResult): number {
  if (result.ok) return 200;
  switch (result.reason) {
    case 'notices-unreachable':
    case 'pdf-unreachable':
    case 'store-failed':
      return 502;
    case 'no-writer-key':
      return 503;
    default:
      return 422; // pdf-not-text, parse-failed, validation-failed, no-pdf-link, pdf-unreadable
  }
}

export default async function handler(
  _req: IncomingMessage,
  res: ServerResponse,
  env: Env = process.env,
  deps: ImportDeps | null = realDeps(env),
): Promise<void> {
  if (!deps) {
    return send(res, 503, { ok: false, stale: true, reason: 'not-configured' }, { 'X-Car-Guy-Error': 'no-supabase-env', 'Cache-Control': 'no-store' });
  }
  let result: ImportResult;
  try {
    result = await runMicmImport(deps);
  } catch {
    return send(res, 500, { ok: false, stale: true, reason: 'crashed' }, { 'X-Car-Guy-Error': 'importer-crashed', 'Cache-Control': 'no-store' });
  }
  const status = statusFor(result);
  send(res, status, result, {
    'Cache-Control': result.ok ? CACHE_OK : CACHE_FAIL,
    ...(result.ok ? {} : { 'X-Car-Guy-Error': result.reason ?? 'unknown' }),
  });
}
