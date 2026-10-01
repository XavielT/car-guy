/**
 * /api/eliminar-cuenta — the last step of "Eliminar cuenta" (IMP 30092026 Phase 6, note 15, ADR-47,
 * 02-cloud-v4.md §028).
 *
 *   GET     → { configured }  (the app and the admin panel ask whether the login can be removed here)
 *   OPTIONS → CORS preflight  (the web app on another origin sends Authorization)
 *   POST    with `Authorization: Bearer <the caller's access token>`:
 *     1. verifies the token with Supabase Auth (GET /auth/v1/user) — the uid is the token's, never
 *        the request's;
 *     2. calls carguy.delete_my_account() AS THE CALLER (anon key + their token): it refuses an
 *        account with no carguy.profiles row (Music Hub, other x-core apps → 403 not-carguy), deletes
 *        the Car Guy rows and returns the Storage objects to remove (sql/028). Calling it twice is safe,
 *        so the app may have called it already;
 *     3. with SUPABASE_SERVICE_ROLE_KEY (Vercel env, read here at run time — never EXPO_PUBLIC_,
 *        never in the bundle) removes those objects, then the auth user (its profile cascades away).
 *        An object that fails leaves the login in place, so a retry (or the admin) can finish.
 *   Without the key: 503 { reason: 'no-service-key' } before anything runs — the app then says the
 *   login is removed by the admin (Admin → Cuentas por eliminar).
 *
 * Answers JSON, never cached; errors carry X-Car-Guy-Error, never a secret. Loads in plain Node
 * (tools/check-api-load.mjs): no app module is imported.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';

type Env = Record<string, string | undefined>;
type Fetch = typeof fetch;
type Req = IncomingMessage & { headers: IncomingMessage['headers'] };

export type StorageObject = { bucket: string; name: string };

export type DeleteReason =
  | 'not-configured'
  | 'no-service-key'
  | 'no-token'
  | 'bad-token'
  | 'not-carguy'
  | 'rpc-failed'
  | 'storage-failed'
  | 'auth-delete-failed'
  | 'method';

const TIMEOUT_MS = 15_000;
/** Storage's bulk delete takes a list of names per bucket; kept well under its limit. */
export const CHUNK = 500;

function send(res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store');
  // The app on native has no origin; the web app in development is on localhost. The bearer token
  // is what authorises, not the origin, and no cookie is ever read.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.end(body === undefined ? '' : JSON.stringify(body));
}

function fail(res: ServerResponse, status: number, reason: DeleteReason, extra: Record<string, unknown> = {}): void {
  send(res, status, { ok: false, reason, ...extra }, { 'X-Car-Guy-Error': reason });
}

export function supabaseBase(env: Env): { base: string; anon: string } | null {
  const base = (env.SUPABASE_URL ?? env.EXPO_PUBLIC_SUPABASE_URL)?.replace(/\/$/, '');
  const anon = env.SUPABASE_ANON_KEY ?? env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  return base && anon ? { base, anon } : null;
}

/** The service key's headers; new-style secret keys (sb_secret_…) are not JWTs and go in apikey only. */
export function serviceHeaders(env: Env): Record<string, string> | null {
  const key = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!key) return null;
  return key.startsWith('sb_secret_') ? { apikey: key } : { apikey: key, Authorization: `Bearer ${key}` };
}

export function bearer(req: Req): string | null {
  const raw = req.headers.authorization;
  const value = Array.isArray(raw) ? raw[0] : raw;
  const m = /^Bearer\s+(\S+)$/i.exec(value ?? '');
  return m ? m[1] : null;
}

/** The RPC's object list, cleaned: known buckets only, no path tricks, no duplicates. */
export function objectsByBucket(objects: unknown): Map<string, string[]> {
  const out = new Map<string, string[]>();
  if (!Array.isArray(objects)) return out;
  const allowed = new Set(['carguy-media', 'carguy-public', 'carguy-feedback']);
  for (const o of objects as Partial<StorageObject>[]) {
    if (!o || typeof o.bucket !== 'string' || typeof o.name !== 'string') continue;
    if (!allowed.has(o.bucket) || !o.name || o.name.startsWith('/') || o.name.split('/').includes('..')) continue;
    const list = out.get(o.bucket) ?? [];
    if (!list.includes(o.name)) list.push(o.name);
    out.set(o.bucket, list);
  }
  return out;
}

export function chunks<T>(items: readonly T[], size: number = CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export default async function handler(req: Req, res: ServerResponse, env: Env = process.env, fetchImpl: Fetch = fetch): Promise<void> {
  const method = (req.method ?? 'GET').toUpperCase();
  if (method === 'OPTIONS') return send(res, 204, undefined);

  const supabase = supabaseBase(env);
  const service = serviceHeaders(env);
  if (method === 'GET') return send(res, 200, { configured: Boolean(supabase && service) });
  if (method !== 'POST') return fail(res, 405, 'method');

  if (!supabase) return fail(res, 503, 'not-configured');
  if (!service) return fail(res, 503, 'no-service-key');
  const token = bearer(req);
  if (!token) return fail(res, 401, 'no-token');
  const { base, anon } = supabase;
  const signal = () => AbortSignal.timeout(TIMEOUT_MS);

  // 1 — whose token is it?
  let userId: string | null = null;
  try {
    const r = await fetchImpl(`${base}/auth/v1/user`, { headers: { apikey: anon, Authorization: `Bearer ${token}` }, signal: signal() });
    if (r.ok) {
      const user = (await r.json()) as { id?: unknown } | null;
      userId = typeof user?.id === 'string' ? user.id : null;
    }
  } catch {
    userId = null;
  }
  if (!userId) return fail(res, 401, 'bad-token');

  // 2 — the Car Guy data, as the caller (the RPC refuses another app's account).
  let objects: unknown = [];
  let deleted: unknown = {};
  try {
    const r = await fetchImpl(`${base}/rest/v1/rpc/delete_my_account`, {
      method: 'POST',
      headers: { apikey: anon, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'Content-Profile': 'carguy' },
      body: '{}',
      signal: signal(),
    });
    const body = (await r.json().catch(() => null)) as { objects?: unknown; deleted?: unknown; user_id?: unknown; message?: unknown } | null;
    if (!r.ok) {
      if (/not_carguy/.test(String(body?.message ?? ''))) return fail(res, 403, 'not-carguy');
      return fail(res, 502, 'rpc-failed', { status: r.status });
    }
    if (body?.user_id !== userId) return fail(res, 502, 'rpc-failed');
    objects = body?.objects;
    deleted = body?.deleted ?? {};
  } catch {
    return fail(res, 502, 'rpc-failed');
  }

  // 3a — the Storage objects, with the service key.
  let removed = 0;
  for (const [bucket, names] of objectsByBucket(objects)) {
    for (const part of chunks(names)) {
      try {
        const r = await fetchImpl(`${base}/storage/v1/object/${encodeURIComponent(bucket)}`, {
          method: 'DELETE',
          headers: { ...service, 'Content-Type': 'application/json' },
          body: JSON.stringify({ prefixes: part }),
          signal: signal(),
        });
        if (!r.ok) return fail(res, 502, 'storage-failed', { removed });
      } catch {
        return fail(res, 502, 'storage-failed', { removed });
      }
      removed += part.length;
    }
  }

  // 3b — the login. 404: already gone (a retry after a lost answer).
  try {
    const r = await fetchImpl(`${base}/auth/v1/admin/users/${encodeURIComponent(userId)}`, { method: 'DELETE', headers: service, signal: signal() });
    if (!r.ok && r.status !== 404) return fail(res, 502, 'auth-delete-failed', { removed });
  } catch {
    return fail(res, 502, 'auth-delete-failed', { removed });
  }

  send(res, 200, { ok: true, removed, deleted });
}
