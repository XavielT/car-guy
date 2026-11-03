/** @jest-environment node */
/**
 * IMP 03112026 Phase 1 (ADR-66, SPEC-A §A3): the AI gateway's pure core, tested with fakes (no Deno, no network).
 * The Deno wiring (serve.ts) and the SQL (sql/042 + tools/local-rls/scenario_042.sql) are covered elsewhere.
 */
import { AiCallError, callClaude } from '../../supabase/functions/_shared/anthropic.ts';
import { costUsd, priceFor } from '../../supabase/functions/_shared/cost.ts';
import { ALLOWED_ORIGINS, corsHeaders, parseExtraOrigins } from '../../supabase/functions/_shared/cors.ts';
import { envRequired, modelReason, modelVision } from '../../supabase/functions/_shared/env.ts';
import { AI_ERRORS, errorBody } from '../../supabase/functions/_shared/errors.ts';
import { evaluateGate, remaining, type GateSnapshot } from '../../supabase/functions/_shared/gate.ts';
import { handleAi, type Deps, type Handler, type UsageRow } from '../../supabase/functions/_shared/handler.ts';
import { base64Bytes, MAX_IMAGE_BYTES, validateImages } from '../../supabase/functions/_shared/images.ts';
import { resolveSttConfig } from '../../supabase/functions/_shared/stt.ts';
import { handleStatus } from '../../supabase/functions/cg-ai-status/logic.ts';
import { pingHandler } from '../../supabase/functions/cg-ai-ping/logic.ts';

const OK_SNAP: GateSnapshot = {
  enabled: true,
  consent: true,
  limits: { user_hour: 30, user_day_usd: 0.5, global_day_usd: 5, places_user_day: 20 },
  used: { user_hour: 0, user_day_usd: 0, global_day_usd: 0, function_user_day: 0 },
};
type SnapPatch = { enabled?: boolean; consent?: boolean; used?: Partial<GateSnapshot['used']>; limits?: Partial<GateSnapshot['limits']> };
const snap = (patch: SnapPatch = {}): GateSnapshot => ({
  ...OK_SNAP,
  ...patch,
  limits: { ...OK_SNAP.limits, ...(patch.limits ?? {}) },
  used: { ...OK_SNAP.used, ...(patch.used ?? {}) },
});

describe('cost.ts', () => {
  it('prices Haiku 5.5 at $0.10/$0.50 per MTok', () => {
    expect(costUsd('claude-haiku-5-5', 100_000, 0)).toBeCloseTo(0.01, 6);
    expect(costUsd('claude-haiku-5-5', 0, 1_000_000)).toBeCloseTo(0.5, 6);
    expect(costUsd('claude-haiku-5-5', 1500, 300)).toBeCloseTo(0.0003, 6); // 0.00015 + 0.00015
  });
  it('uses the long-prompt tier above 100k input tokens', () => {
    expect(costUsd('claude-haiku-5-5', 200_000, 0)).toBeCloseTo(0.1, 6); // 0.5 per MTok
    expect(costUsd('claude-haiku-5-5', 100_000, 0)).toBeCloseTo(0.01, 6); // boundary stays on the short tier
  });
  it('prices Sonnet 5.5 at $2/$10 and the 4.5 fallback at $1/$5', () => {
    expect(costUsd('claude-sonnet-5-5', 1_000_000, 1_000_000)).toBeCloseTo(12, 6);
    expect(costUsd('claude-haiku-4-5-20251001', 1_000_000, 1_000_000)).toBeCloseTo(6, 6);
  });
  it('an unknown model costs like the most expensive one (a typo can only over-count)', () => {
    expect(priceFor('claude-typo')).toEqual({ input: 10, output: 50 });
  });
  it('rounds UP to 6 decimals and clamps negatives', () => {
    expect(costUsd('claude-haiku-5-5', 1, 0)).toBe(0.0000001 > 0 ? 0.000001 : 0);
    expect(costUsd('claude-haiku-5-5', -5, -5)).toBe(0);
  });
});

describe('gate.ts — the order is the contract', () => {
  it('lets a clean snapshot through', () => {
    expect(evaluateGate(snap(), 'cg-ai-read', true)).toBeNull();
  });
  it('kill switch wins over everything (even consent, caps, configuration)', () => {
    expect(evaluateGate(snap({ enabled: false, consent: false, used: { user_hour: 999 } }), 'x', false)).toBe('ai_disabled');
  });
  it('not configured comes before consent', () => {
    expect(evaluateGate(snap({ consent: false }), 'x', false)).toBe('ai_not_configured');
  });
  it('consent comes before the limits', () => {
    expect(evaluateGate(snap({ consent: false, used: { user_hour: 999 } }), 'x', true)).toBe('sin_consentimiento_ia');
  });
  it('per-user hour limit, then per-user day cap, then global day cap', () => {
    expect(evaluateGate(snap({ used: { user_hour: 30, user_day_usd: 9, global_day_usd: 9 } }), 'x', true)).toBe('rate_user');
    expect(evaluateGate(snap({ used: { user_day_usd: 0.5, global_day_usd: 9 } }), 'x', true)).toBe('cap_user_day');
    expect(evaluateGate(snap({ used: { global_day_usd: 5 } }), 'x', true)).toBe('cap_global_day');
  });
  it('a limit of 0 blocks everything (how the admin and the smoke test prove the brakes)', () => {
    expect(evaluateGate(snap({ limits: { user_hour: 0 } }), 'x', true)).toBe('rate_user');
    expect(evaluateGate(snap({ limits: { user_day_usd: 0 } }), 'x', true)).toBe('cap_user_day');
    expect(evaluateGate(snap({ limits: { global_day_usd: 0 } }), 'x', true)).toBe('cap_global_day');
  });
  it('one under the limit still passes', () => {
    expect(evaluateGate(snap({ used: { user_hour: 29, user_day_usd: 0.499999, global_day_usd: 4.99 } }), 'x', true)).toBeNull();
  });
  it('cg-places has its own per-day count', () => {
    expect(evaluateGate(snap({ used: { function_user_day: 20 } }), 'cg-places', true)).toBe('cap_user_day');
    expect(evaluateGate(snap({ used: { function_user_day: 20 } }), 'cg-ai-read', true)).toBeNull();
  });
  it('numbers that arrive as strings (numeric from Postgres) compare correctly', () => {
    const s = snap();
    (s.used as Record<string, unknown>).user_day_usd = '0.50';
    (s.limits as Record<string, unknown>).user_day_usd = '0.50';
    expect(evaluateGate(s, 'x', true)).toBe('cap_user_day');
  });
  it('remaining() is never negative and uses the tighter of the user and global caps', () => {
    expect(remaining(snap({ used: { user_hour: 40, user_day_usd: 0.2, global_day_usd: 4.9 } }))).toEqual({ hour: 0, dayUsd: 0.1 });
    expect(remaining(snap({ used: { user_day_usd: 9 } })).dayUsd).toBe(0);
  });
});

describe('errors.ts', () => {
  it('every code has a status and a Spanish message, and the body carries the stable code', () => {
    for (const [code, e] of Object.entries(AI_ERRORS)) {
      expect(e.status).toBeGreaterThanOrEqual(400);
      expect(e.message.length).toBeGreaterThan(5);
      expect(errorBody(code as keyof typeof AI_ERRORS)).toEqual({ ok: false, error: e.message, error_code: code });
    }
  });
  it('maps the contract statuses (403 consent, 429 caps, 503 disabled)', () => {
    expect(AI_ERRORS.sin_consentimiento_ia.status).toBe(403);
    expect(AI_ERRORS.rate_user.status).toBe(429);
    expect(AI_ERRORS.cap_user_day.status).toBe(429);
    expect(AI_ERRORS.cap_global_day.status).toBe(429);
    expect(AI_ERRORS.ai_disabled.status).toBe(503);
    expect(AI_ERRORS.ai_not_configured.status).toBe(503);
  });
});

describe('env.ts / cors.ts / images.ts / stt.ts', () => {
  it('envRequired names the missing variable and never a value', () => {
    expect(() => envRequired(() => undefined, 'ANTHROPIC_API_KEY')).toThrow('Missing environment variable ANTHROPIC_API_KEY');
    expect(envRequired((n) => (n === 'A' ? 'v' : undefined), 'A')).toBe('v');
  });
  it('models default to Haiku 5.5 / Sonnet 5.5 and come from secrets when set', () => {
    expect(modelVision(() => undefined)).toBe('claude-haiku-5-5');
    expect(modelReason(() => undefined)).toBe('claude-sonnet-5-5');
    expect(modelVision((n) => (n === 'CG_MODEL_VISION' ? 'claude-haiku-4-5-20251001' : undefined))).toBe('claude-haiku-4-5-20251001');
  });
  it('CORS reflects only listed origins; native (no Origin) gets no ACAO', () => {
    expect(corsHeaders('https://car-guy.vercel.app')['Access-Control-Allow-Origin']).toBe('https://car-guy.vercel.app');
    expect(corsHeaders('http://localhost:8081')['Access-Control-Allow-Origin']).toBe('http://localhost:8081');
    expect(corsHeaders('https://evil.example')['Access-Control-Allow-Origin']).toBeUndefined();
    expect(corsHeaders(null)['Access-Control-Allow-Origin']).toBeUndefined();
    expect(corsHeaders('https://evil.example').Vary).toBe('Origin');
    expect(ALLOWED_ORIGINS).not.toContain('*');
  });
  it('extra origins come from a secret and are validated', () => {
    expect(parseExtraOrigins('https://a.vercel.app, junk ,http://b.test')).toEqual(['https://a.vercel.app', 'http://b.test']);
    expect(corsHeaders('https://a.vercel.app', ['https://a.vercel.app'])['Access-Control-Allow-Origin']).toBe('https://a.vercel.app');
  });
  it('validateImages enforces count, type, base64 and size', () => {
    const ok = { data: 'A'.repeat(64), mime: 'image/jpeg' };
    expect(validateImages([ok])).toBeNull();
    expect(validateImages([])).toBe('no images');
    expect(validateImages([ok, ok, ok, ok, ok])).toMatch(/more than 4/);
    expect(validateImages([{ ...ok, mime: 'image/gif' }])).toMatch(/unsupported/);
    expect(validateImages([{ data: 'not base64 !! not base64 !!', mime: 'image/png' }])).toMatch(/not base64/);
    expect(validateImages([{ data: 'A'.repeat(Math.ceil((MAX_IMAGE_BYTES * 4) / 3) + 8), mime: 'image/png' }])).toMatch(/too large/);
    expect(base64Bytes('AAAA')).toBe(3);
    expect(base64Bytes('AAA=')).toBe(2);
  });
  it('STT: no key = null; STT_* chosen; OpenAI key is the fallback; Azure is not a path', () => {
    expect(resolveSttConfig(() => undefined)).toBeNull();
    expect(resolveSttConfig((n) => (n === 'AZURE_SPEECH_KEY' ? 'x' : undefined))).toBeNull();
    const groq = resolveSttConfig((n) => ({ STT_API_KEY: 'k', STT_PROVIDER: 'GROQ' } as Record<string, string>)[n]);
    expect(groq?.provider).toBe('groq');
    expect(groq?.model).toBe('whisper-large-v3-turbo');
    expect(resolveSttConfig((n) => (n === 'OPENAI_API_KEY' ? 'k' : undefined))?.model).toBe('gpt-4o-mini-transcribe');
    expect(resolveSttConfig((n) => ({ STT_API_KEY: 'k', STT_PROVIDER: 'nope' } as Record<string, string>)[n])?.provider).toBe('openai');
  });
});

// --------------------------------------------------------------------------- anthropic.ts
const TOOL = { name: 'fill', description: 'x', input_schema: { type: 'object', properties: {} } };
const apiOk = (content: unknown[], inTok = 100, outTok = 20, model = 'claude-haiku-5-5') =>
  new Response(JSON.stringify({ content, usage: { input_tokens: inTok, output_tokens: outTok }, model }), { status: 200 });
const noSleep = async () => {};

describe('anthropic.ts', () => {
  const base = { apiKey: 'test-key', model: 'claude-haiku-5-5', system: 's', messages: [{ role: 'user' as const, content: 'hi' }], maxTokens: 50, sleep: noSleep };

  it('forces the tool and returns its input, tokens and cost', async () => {
    const f = jest.fn(async () => apiOk([{ type: 'tool_use', name: 'fill', input: { km: 52400 } }], 1500, 300));
    const r = await callClaude({ ...base, tool: TOOL, fetchImpl: f as unknown as typeof fetch });
    expect(r.toolInput).toEqual({ km: 52400 });
    expect(r.usage).toEqual({ model: 'claude-haiku-5-5', inputTokens: 1500, outputTokens: 300, costUsd: 0.0003 });
    const sent = JSON.parse((f.mock.calls[0] as unknown as [string, { body: string }])[1].body);
    expect(sent.tool_choice).toEqual({ type: 'tool', name: 'fill' });
    expect((f.mock.calls[0] as unknown as [string, { headers: Record<string, string> }])[1].headers['x-api-key']).toBe('test-key');
  });
  it('retries 429 then succeeds', async () => {
    const f = jest.fn().mockResolvedValueOnce(new Response('{}', { status: 429 })).mockResolvedValueOnce(apiOk([{ type: 'text', text: 'ok' }]));
    const r = await callClaude({ ...base, fetchImpl: f as unknown as typeof fetch });
    expect(r.text).toBe('ok');
    expect(f).toHaveBeenCalledTimes(2);
  });
  it('retries 529 and a network error, gives up after maxRetries with provider_error', async () => {
    const f = jest.fn().mockRejectedValue(new Error('net'));
    await expect(callClaude({ ...base, fetchImpl: f as unknown as typeof fetch })).rejects.toMatchObject({ code: 'provider_error' });
    expect(f).toHaveBeenCalledTimes(3);
    const g = jest.fn().mockResolvedValue(new Response('{}', { status: 529 }));
    await expect(callClaude({ ...base, fetchImpl: g as unknown as typeof fetch })).rejects.toMatchObject({ code: 'provider_error' });
    expect(g).toHaveBeenCalledTimes(3);
  });
  it('never retries another 4xx and never leaks the provider body', async () => {
    const f = jest.fn().mockResolvedValue(new Response('{"error":"your photo says secret-123"}', { status: 401 }));
    const e = await callClaude({ ...base, fetchImpl: f as unknown as typeof fetch }).catch((x) => x);
    expect(e).toBeInstanceOf(AiCallError);
    expect(e.code).toBe('provider_error');
    expect(e.status).toBe(401);
    expect(JSON.stringify(e)).not.toContain('secret-123');
    expect(f).toHaveBeenCalledTimes(1);
  });
  it('a 400 on a forced tool retries ONCE with tool_choice auto', async () => {
    const f = jest.fn().mockResolvedValueOnce(new Response('{}', { status: 400 })).mockResolvedValueOnce(apiOk([{ type: 'tool_use', input: { a: 1 } }]));
    const r = await callClaude({ ...base, tool: TOOL, fetchImpl: f as unknown as typeof fetch });
    expect(r.toolInput).toEqual({ a: 1 });
    const second = JSON.parse((f.mock.calls[1] as unknown as [string, { body: string }])[1].body);
    expect(second.tool_choice).toEqual({ type: 'auto' });
    expect(second.system).toContain('calling the tool "fill"');
  });
  it('no tool call when one was required = unreadable, WITH usage (the tokens were spent)', async () => {
    const f = jest.fn(async () => apiOk([{ type: 'text', text: 'sorry' }], 500, 10));
    const e = await callClaude({ ...base, tool: TOOL, fetchImpl: f as unknown as typeof fetch }).catch((x) => x);
    expect(e.code).toBe('unreadable');
    expect(e.usage.inputTokens).toBe(500);
    expect(e.usage.costUsd).toBeGreaterThan(0);
  });
});

// ------------------------------------------------------------------------------ handler.ts
function deps(over: Partial<Deps> & { snapshot?: GateSnapshot; apiKey?: string | null; fetchImpl?: typeof fetch } = {}) {
  const usage: UsageRow[] = [];
  const env = (n: string) => (n === 'ANTHROPIC_API_KEY' ? (over.apiKey === null ? undefined : (over.apiKey ?? 'test-key')) : undefined);
  const d: Deps = {
    env,
    authUser: async (t) => (t === 'good' || t === 'admin' ? 'user-1' : null),
    gateSnapshot: async () => over.snapshot ?? OK_SNAP,
    isAdmin: async (t) => t === 'admin',
    insertUsage: async (row) => {
      usage.push(row);
    },
    fetchImpl: over.fetchImpl,
    sleep: noSleep,
    ...over,
  };
  return { d, usage };
}
const post = (token?: string, body: unknown = {}) =>
  new Request('https://x.test/f', { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
const echo: Handler = async () => ({ body: { value: 42 }, usage: { model: 'claude-haiku-5-5', inputTokens: 1000, outputTokens: 200, costUsd: 0.0002 }, vehicleId: 'veh_1' });
const never: Handler = async () => {
  throw new Error('the handler must not run');
};

describe('handler.ts — the pipeline', () => {
  it('OPTIONS answers the preflight; GET is 405', async () => {
    const { d } = deps();
    expect((await handleAi(new Request('https://x.test', { method: 'OPTIONS', headers: { origin: 'https://car-guy.vercel.app' } }), 'f', never, d)).status).toBe(204);
    expect((await handleAi(new Request('https://x.test', { method: 'GET' }), 'f', never, d)).status).toBe(405);
  });
  it('no token = 401 no_auth; bad token = 401 sesion_invalida', async () => {
    const { d } = deps();
    const a = await handleAi(post(), 'f', never, d);
    expect(a.status).toBe(401);
    expect((await a.json()).error_code).toBe('no_auth');
    const b = await handleAi(post('bad'), 'f', never, d);
    expect((await b.json()).error_code).toBe('sesion_invalida');
  });
  it('adminOnly: a normal user is 403 forbidden, the admin passes', async () => {
    const { d } = deps();
    const r = await handleAi(post('good'), 'f', echo, d, { adminOnly: true });
    expect(r.status).toBe(403);
    expect((await r.json()).error_code).toBe('forbidden');
    expect((await handleAi(post('admin'), 'f', echo, d, { adminOnly: true })).status).toBe(200);
  });
  it('NO CONSENT: 403 sin_consentimiento_ia, the handler never runs, no usage row', async () => {
    const { d, usage } = deps({ snapshot: snap({ consent: false }) });
    const r = await handleAi(post('good'), 'f', never, d);
    expect(r.status).toBe(403);
    expect((await r.json()).error_code).toBe('sin_consentimiento_ia');
    expect(usage).toHaveLength(0);
  });
  it('KILL SWITCH: 503 ai_disabled even for a consented person', async () => {
    const { d } = deps({ snapshot: snap({ enabled: false }) });
    const r = await handleAi(post('good'), 'f', never, d);
    expect(r.status).toBe(503);
    expect((await r.json()).error_code).toBe('ai_disabled');
  });
  it('no provider key: 503 ai_not_configured', async () => {
    const { d } = deps({ apiKey: null });
    const r = await handleAi(post('good'), 'f', never, d);
    expect((await r.json()).error_code).toBe('ai_not_configured');
  });
  it('CAP LOWERED TO 0: 429, with the right code per cap', async () => {
    for (const [patch, code] of [
      [{ limits: { user_hour: 0 } }, 'rate_user'],
      [{ limits: { user_day_usd: 0 } }, 'cap_user_day'],
      [{ limits: { global_day_usd: 0 } }, 'cap_global_day'],
    ] as const) {
      const { d, usage } = deps({ snapshot: snap(patch) });
      const r = await handleAi(post('good'), 'f', never, d);
      expect(r.status).toBe(429);
      expect((await r.json()).error_code).toBe(code);
      expect(usage).toHaveLength(0);
    }
  });
  it('success: 200, ONE usage row with tokens, cost and vehicle; the body has no cost, key or prompt', async () => {
    const { d, usage } = deps();
    const r = await handleAi(post('good', { anything: 1 }), 'cg-ai-read', echo, d);
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body).toEqual({ ok: true, value: 42, model: 'claude-haiku-5-5' });
    expect(JSON.stringify(body)).not.toMatch(/cost|test-key|prompt/i);
    expect(usage).toEqual([{ user_id: 'user-1', function: 'cg-ai-read', model: 'claude-haiku-5-5', input_tokens: 1000, output_tokens: 200, cost_usd: 0.0002, vehicle_id: 'veh_1', ok: true, error_code: null }]);
  });
  it('a failed call that spent tokens is recorded ok=false with its error_code', async () => {
    const f = jest.fn(async () => apiOk([{ type: 'text', text: 'no tool' }], 800, 5));
    const h: Handler = async (ctx) => {
      const r = await ctx.call({ model: 'claude-haiku-5-5', system: 's', messages: [{ role: 'user', content: 'x' }], tool: TOOL, maxTokens: 20 });
      return { body: {}, usage: r.usage };
    };
    const { d, usage } = deps({ fetchImpl: f as unknown as typeof fetch });
    const r = await handleAi(post('good'), 'cg-ai-read', h, d);
    expect(r.status).toBe(422);
    expect((await r.json()).error_code).toBe('unreadable');
    expect(usage).toHaveLength(1);
    expect(usage[0]).toMatchObject({ ok: false, error_code: 'unreadable', input_tokens: 800 });
  });
  it('a provider outage with no tokens writes no usage row and answers provider_error', async () => {
    const f = jest.fn().mockRejectedValue(new Error('net'));
    const h: Handler = async (ctx) => ({ body: (await ctx.call({ model: 'm', system: 's', messages: [], maxTokens: 5 })) as never });
    const { d, usage } = deps({ fetchImpl: f as unknown as typeof fetch });
    const r = await handleAi(post('good'), 'f', h, d);
    expect(r.status).toBe(502);
    expect(usage).toHaveLength(0);
  });
  it('an accounting failure does not fail the person’s call', async () => {
    const { d } = deps({ insertUsage: async () => { throw new Error('db down'); } });
    expect((await handleAi(post('good'), 'f', echo, d)).status).toBe(200);
  });
  it('an unexpected throw is 500 internal with no message', async () => {
    const { d } = deps();
    const r = await handleAi(post('good'), 'f', async () => { throw new Error('boom: SECRET'); }, d);
    expect(r.status).toBe(500);
    expect(JSON.stringify(await r.json())).not.toContain('SECRET');
  });
  it('a gate RPC failure is internal, never a pass', async () => {
    const { d } = deps({ gateSnapshot: async () => { throw new Error('rpc'); } });
    expect((await handleAi(post('good'), 'f', never, d)).status).toBe(500);
  });
  it('CORS header only for a listed origin', async () => {
    const { d } = deps();
    const req = new Request('https://x.test', { method: 'POST', headers: { origin: 'https://car-guy.vercel.app', authorization: 'Bearer good' }, body: '{}' });
    expect((await handleAi(req, 'f', echo, d)).headers.get('access-control-allow-origin')).toBe('https://car-guy.vercel.app');
    const bad = new Request('https://x.test', { method: 'POST', headers: { origin: 'https://evil.example', authorization: 'Bearer good' }, body: '{}' });
    expect((await handleAi(bad, 'f', echo, d)).headers.get('access-control-allow-origin')).toBeNull();
  });
});

describe('cg-ai-status', () => {
  const get = (token?: string) => new Request('https://x.test/s', { method: 'GET', headers: token ? { authorization: `Bearer ${token}` } : {} });
  it('signed out: only enabled + configured, no per-user data', async () => {
    const { d } = deps();
    const body = await (await handleStatus(get(), d)).json();
    expect(body).toEqual({ ok: true, signed_in: false, enabled: true, configured: true });
  });
  it('signed in: consent, refusal reason and what is left today', async () => {
    const { d } = deps({ snapshot: snap({ used: { user_hour: 5, user_day_usd: 0.2, global_day_usd: 1 } }) });
    const body = await (await handleStatus(get('good'), d)).json();
    expect(body).toMatchObject({ signed_in: true, enabled: true, configured: true, consent: true, refusal: null, remainingToday: { hour: 25, dayUsd: 0.3 } });
  });
  it('signed in without consent reports the reason the app shows', async () => {
    const { d } = deps({ snapshot: snap({ consent: false }) });
    expect((await (await handleStatus(get('good'), d)).json()).refusal).toBe('sin_consentimiento_ia');
  });
  it('kill switch and an invalid token are reported, not hidden', async () => {
    expect((await (await handleStatus(get('good'), deps({ snapshot: snap({ enabled: false }) }).d)).json()).refusal).toBe('ai_disabled');
    expect((await handleStatus(get('bad'), deps().d)).status).toBe(401);
  });
  it('makes no provider call and writes no usage', async () => {
    const f = jest.fn();
    const { d, usage } = deps({ fetchImpl: f as unknown as typeof fetch });
    await handleStatus(get('good'), d);
    expect(f).not.toHaveBeenCalled();
    expect(usage).toHaveLength(0);
  });
});

describe('cg-ai-ping', () => {
  it('is admin only, asks the vision model for 5 tokens and records the usage', async () => {
    const f = jest.fn(async () => apiOk([{ type: 'text', text: 'ok' }], 20, 2));
    const { d, usage } = deps({ fetchImpl: f as unknown as typeof fetch });
    expect((await handleAi(post('good'), 'cg-ai-ping', pingHandler, d, { adminOnly: true })).status).toBe(403);
    expect(f).not.toHaveBeenCalled();
    const r = await handleAi(post('admin'), 'cg-ai-ping', pingHandler, d, { adminOnly: true });
    expect(await r.json()).toEqual({ ok: true, pong: true, text: 'ok', model: 'claude-haiku-5-5' });
    const sent = JSON.parse((f.mock.calls[0] as unknown as [string, { body: string }])[1].body);
    expect(sent.max_tokens).toBe(5);
    expect(sent.model).toBe('claude-haiku-5-5');
    expect(usage).toHaveLength(1);
    expect(usage[0]).toMatchObject({ function: 'cg-ai-ping', ok: true, input_tokens: 20, output_tokens: 2 });
  });
});
