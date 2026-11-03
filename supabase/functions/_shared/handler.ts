/**
 * The request pipeline every `cg-*` model function shares (IMP 03112026 ADR-66). Pure and dependency-injected: the
 * Deno wiring (supabase-js clients, Deno.env) lives in serve.ts, so this file is unit-tested with fakes.
 *
 *   OPTIONS: CORS preflight. Not POST: 405. Bearer JWT: 401. (adminOnly: 403.) Gate (enabled, configured, consent,
 *   limits): refuse with a stable error_code, NOTHING recorded (nothing was spent). Parse body. Handler: success body
 *   plus ONE ai_usage row. AiCallError: error_code, plus a usage row if tokens were spent.
 *
 * The response never carries provider text, the key, the prompt or the cost. `error_code` is what the app translates.
 */
import { AiCallError, callClaude, type CallArgs, type CallResult, type Usage } from './anthropic.ts';
import { corsHeaders, parseExtraOrigins } from './cors.ts';
import type { EnvGetter } from './env.ts';
import { AI_ERRORS, errorBody, type AiErrorCode } from './errors.ts';
import { evaluateGate, type GateSnapshot } from './gate.ts';

export type UsageRow = {
  user_id: string;
  function: string;
  model: string | null;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  vehicle_id: string | null;
  ok: boolean;
  error_code: string | null;
};

export type Deps = {
  env: EnvGetter;
  /** The user id behind a JWT, or null when the token is not valid. */
  authUser(token: string): Promise<string | null>;
  /** carguy.ai_gate(user, fn): kill switch, consent, limits and counters in one round trip. */
  gateSnapshot(userId: string, fn: string): Promise<GateSnapshot>;
  isAdmin(token: string): Promise<boolean>;
  insertUsage(row: UsageRow): Promise<void>;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
};

export type Ctx = {
  req: Request;
  userId: string;
  body: unknown;
  env: EnvGetter;
  /** The injected fetch (tests) or the global one; for providers other than Anthropic (speech to text). */
  fetch: typeof fetch;
  /** callClaude with the key and the injected fetch already in place. */
  call(args: Omit<CallArgs, 'apiKey' | 'fetchImpl' | 'sleep'>): Promise<CallResult>;
};
export type HandlerResult = { body: Record<string, unknown>; usage?: Usage; vehicleId?: string };
export type Handler = (ctx: Ctx) => Promise<HandlerResult>;
export type Options = {
  adminOnly?: boolean;
  /** What "configured" means for this function. Default: the Anthropic key exists. cg-stt: a speech-to-text key exists. */
  configured?: (env: EnvGetter) => boolean;
};

export function reply(req: Request, env: EnvGetter, status: number, body: unknown): Response {
  const headers = {
    ...corsHeaders(req.headers.get('origin'), parseExtraOrigins(env('CG_ALLOWED_ORIGINS'))),
    'content-type': 'application/json',
  };
  return new Response(JSON.stringify(body), { status, headers });
}

export function refuse(req: Request, env: EnvGetter, code: AiErrorCode): Response {
  return reply(req, env, AI_ERRORS[code].status, errorBody(code));
}

export function preflight(req: Request, env: EnvGetter): Response {
  // A 204 must have a null body (the Fetch spec; Deno and Node both throw otherwise).
  return new Response(null, { status: 204, headers: corsHeaders(req.headers.get('origin'), parseExtraOrigins(env('CG_ALLOWED_ORIGINS'))) });
}

export function bearer(req: Request): string | null {
  const h = req.headers.get('authorization') ?? '';
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m ? m[1].trim() : null;
}

export async function handleAi(req: Request, fn: string, handler: Handler, deps: Deps, opts: Options = {}): Promise<Response> {
  const { env } = deps;
  if (req.method === 'OPTIONS') return preflight(req, env);
  if (req.method !== 'POST') return refuse(req, env, 'method_not_allowed');

  // 1. a valid JWT
  const token = bearer(req);
  if (!token) return refuse(req, env, 'no_auth');
  let userId: string | null;
  try {
    userId = await deps.authUser(token);
  } catch {
    return refuse(req, env, 'internal');
  }
  if (!userId) return refuse(req, env, 'sesion_invalida');
  if (opts.adminOnly) {
    let admin = false;
    try {
      admin = await deps.isAdmin(token);
    } catch {
      return refuse(req, env, 'internal');
    }
    if (!admin) return refuse(req, env, 'forbidden');
  }

  // 2-5. kill switch, configured, consent, limits
  let snapshot: GateSnapshot;
  try {
    snapshot = await deps.gateSnapshot(userId, fn);
  } catch {
    return refuse(req, env, 'internal');
  }
  const apiKey = env('ANTHROPIC_API_KEY');
  const refusal = evaluateGate(snapshot, fn, opts.configured ? opts.configured(env) : !!apiKey);
  if (refusal) return refuse(req, env, refusal);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const uid: string = userId;
  const ctx: Ctx = {
    req,
    userId: uid,
    body,
    env,
    fetch: deps.fetchImpl ?? fetch,
    call: (args) => callClaude({ ...args, apiKey: apiKey ?? '', fetchImpl: deps.fetchImpl, sleep: deps.sleep }),
  };

  const log = async (u: Usage | undefined, ok: boolean, errorCode: string | null, vehicleId: string | null) => {
    if (!u) return;
    try {
      await deps.insertUsage({
        user_id: uid,
        function: fn,
        model: u.model,
        input_tokens: u.inputTokens,
        output_tokens: u.outputTokens,
        cost_usd: u.costUsd,
        vehicle_id: vehicleId,
        ok,
        error_code: errorCode,
      });
    } catch {
      console.error(`[${fn}] usage row not written`); // best effort: an accounting failure must not fail the person's call
    }
  };

  try {
    const result = await handler(ctx);
    await log(result.usage, true, null, result.vehicleId ?? null);
    return reply(req, env, 200, { ok: true, ...result.body, model: result.usage?.model ?? null });
  } catch (e) {
    if (e instanceof AiCallError) {
      await log(e.usage, false, e.code, null);
      console.error(`[${fn}] ${e.code}${e.status ? ` (provider ${e.status})` : ''}`); // status only, never the body
      return refuse(req, env, e.code);
    }
    console.error(`[${fn}] internal ${e instanceof Error ? e.name : 'error'}`);
    return refuse(req, env, 'internal');
  }
}
