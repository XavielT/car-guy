/**
 * /api/junte-push — tells a junte's members about a new chat message (sql/039).
 *
 *   OPTIONS → CORS preflight  (the web app sends Authorization)
 *   POST    { message_id } with `Authorization: Bearer <the sender's access token>`, right after
 *           send_junte_message:
 *     1. verifies the token with Supabase Auth (GET /auth/v1/user) — the uid is the token's, never the request's;
 *     2. calls carguy.junte_push_claim(message, uid) with SUPABASE_SERVICE_ROLE_KEY (service_role only): the RPC
 *        checks the uid wrote the message in the last 5 minutes, marks it pushed ONCE, folds a burst (15 s) into
 *        one notification, and returns the members to tell — never the author, a muted member, or a blocked pair;
 *     3. sends through Expo's push service (exp.host, 100 per request; EXPO_ACCESS_TOKEN only if the project
 *        turns on enhanced push security) and forgets the tokens Expo answers DeviceNotRegistered for.
 *   Without the key: 503 { reason: 'no-service-key' } — the message is still sent, just nobody is told.
 *
 * The notification carries the junte's title, "<author>: <body>" (≤ 140 chars) and `route: /juntes/<id>` — the
 * route app/_layout.tsx follows on a tap (routeOf). Answers JSON, never cached; errors carry X-Car-Guy-Error,
 * never a secret. Loads in plain Node (tools/check-api-load.mjs): no app module is imported.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';

type Env = Record<string, string | undefined>;
type Fetch = typeof fetch;
type Req = IncomingMessage & { headers: IncomingMessage['headers']; body?: unknown };

export type PushReason =
  | 'not-configured'
  | 'no-service-key'
  | 'no-token'
  | 'bad-token'
  | 'bad-request'
  | 'claim-failed'
  | 'method';

export const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
/** Expo's limit per request. */
export const EXPO_BATCH = 100;
export const ANDROID_CHANNEL = 'juntes';
const TIMEOUT_MS = 15_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function send(res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store');
  // The bearer token is what authorises, not the origin; no cookie is ever read.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.end(body === undefined ? '' : JSON.stringify(body));
}

function fail(res: ServerResponse, status: number, reason: PushReason): void {
  send(res, status, { ok: false, reason }, { 'X-Car-Guy-Error': reason });
}

function supabaseBase(env: Env): { base: string; anon: string } | null {
  const base = (env.SUPABASE_URL ?? env.EXPO_PUBLIC_SUPABASE_URL)?.replace(/\/$/, '');
  const anon = env.SUPABASE_ANON_KEY ?? env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  return base && anon ? { base, anon } : null;
}

/** New-style secret keys (sb_secret_…) are not JWTs and go in apikey only. */
function serviceHeaders(env: Env): Record<string, string> | null {
  const key = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!key) return null;
  return key.startsWith('sb_secret_') ? { apikey: key } : { apikey: key, Authorization: `Bearer ${key}` };
}

function bearer(req: Req): string | null {
  const raw = req.headers.authorization;
  const value = Array.isArray(raw) ? raw[0] : raw;
  const m = /^Bearer\s+(\S+)$/i.exec(value ?? '');
  return m ? m[1] : null;
}

/** Vercel parses JSON bodies into req.body; plain Node (tests, check-api-load) streams them. */
async function readBody(req: Req): Promise<unknown> {
  if (req.body !== undefined) return typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  if (typeof (req as { on?: unknown }).on !== 'function') return null;
  const parts: Buffer[] = [];
  let size = 0;
  for await (const part of req as AsyncIterable<Buffer>) {
    size += part.length;
    if (size > 4096) return null;
    parts.push(part);
  }
  return parts.length ? JSON.parse(Buffer.concat(parts).toString('utf8')) : null;
}

export type Claim = { junte_id: string; title: string; author: string | null; body: string; tokens: string[] };

/** The claim, checked: anything that is not a full claim (null, skipped, garbage) sends nothing. */
export function claimOf(body: unknown): Claim | null {
  const c = body as Partial<Claim> | null;
  if (!c || typeof c.junte_id !== 'string' || !UUID.test(c.junte_id) || typeof c.body !== 'string') return null;
  const tokens = Array.isArray(c.tokens) ? c.tokens.filter((t): t is string => typeof t === 'string') : [];
  return { junte_id: c.junte_id, title: String(c.title ?? 'Junte'), author: typeof c.author === 'string' ? c.author : null, body: c.body, tokens };
}

export function pushMessages(c: Claim) {
  const body = c.author ? `${c.author}: ${c.body}` : c.body;
  return c.tokens.map((to) => ({
    to,
    title: c.title,
    body,
    sound: 'default',
    channelId: ANDROID_CHANNEL,
    data: { route: `/juntes/${c.junte_id}` },
  }));
}

export default async function handler(req: Req, res: ServerResponse, env: Env = process.env, fetchImpl: Fetch = fetch): Promise<void> {
  const method = (req.method ?? 'GET').toUpperCase();
  if (method === 'OPTIONS') return send(res, 204, undefined);
  if (method !== 'POST') return fail(res, 405, 'method');

  const supabase = supabaseBase(env);
  const service = serviceHeaders(env);
  if (!supabase) return fail(res, 503, 'not-configured');
  if (!service) return fail(res, 503, 'no-service-key');
  const token = bearer(req);
  if (!token) return fail(res, 401, 'no-token');

  let messageId: unknown = null;
  try {
    messageId = ((await readBody(req)) as { message_id?: unknown } | null)?.message_id;
  } catch {
    messageId = null;
  }
  if (typeof messageId !== 'string' || !UUID.test(messageId)) return fail(res, 400, 'bad-request');

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

  // 2 — the claim, as service_role (the RPC checks authorship, the window and "once").
  const rpc = (name: string, args: unknown) =>
    fetchImpl(`${base}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: { ...service, 'Content-Type': 'application/json', 'Content-Profile': 'carguy' },
      body: JSON.stringify(args),
      signal: signal(),
    });
  let claim: Claim | null;
  try {
    const r = await rpc('junte_push_claim', { p_message: messageId, p_caller: userId });
    if (!r.ok) return fail(res, 502, 'claim-failed');
    claim = claimOf(await r.json().catch(() => null));
  } catch {
    return fail(res, 502, 'claim-failed');
  }
  if (!claim || claim.tokens.length === 0) return send(res, 200, { ok: true, sent: 0 });

  // 3 — Expo, in batches; a failed batch is lost (the chat itself still has the message).
  const messages = pushMessages(claim);
  const expoHeaders: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
  if (env.EXPO_ACCESS_TOKEN?.trim()) expoHeaders.Authorization = `Bearer ${env.EXPO_ACCESS_TOKEN.trim()}`;
  let sent = 0;
  const gone: string[] = [];
  for (let i = 0; i < messages.length; i += EXPO_BATCH) {
    const batch = messages.slice(i, i + EXPO_BATCH);
    try {
      const r = await fetchImpl(EXPO_PUSH_URL, { method: 'POST', headers: expoHeaders, body: JSON.stringify(batch), signal: signal() });
      const tickets = ((await r.json().catch(() => null)) as { data?: unknown } | null)?.data;
      if (!r.ok || !Array.isArray(tickets)) continue;
      tickets.forEach((t: { status?: unknown; details?: { error?: unknown } } | null, k) => {
        if (t?.status === 'ok') sent += 1;
        else if (t?.details?.error === 'DeviceNotRegistered' && batch[k]) gone.push(batch[k].to);
      });
    } catch {
      // next batch
    }
  }
  if (gone.length) {
    try {
      await rpc('drop_push_tokens', { p_tokens: gone });
    } catch {
      // the next push tries again
    }
  }
  return send(res, 200, { ok: true, sent, dropped: gone.length });
}
