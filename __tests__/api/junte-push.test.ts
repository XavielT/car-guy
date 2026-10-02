import handler, { claimOf, EXPO_PUSH_URL, pushMessages } from '../../api/junte-push';

type Res = { statusCode: number; headers: Record<string, string>; body: string; setHeader: (k: string, v: string) => void; end: (b: string) => void };
const res = (): Res => {
  const r: Res = { statusCode: 0, headers: {}, body: '', setHeader: (k, v) => void (r.headers[k.toLowerCase()] = v), end: (b) => void (r.body = b) };
  return r;
};
const MSG = '11111111-1111-4111-8111-111111111111';
const JUNTE = '22222222-2222-4222-8222-222222222222';
const UID = '00000000-0000-0000-0000-00000000000a';
const req = (method: string, body: unknown = { message_id: MSG }, authorization: string | null = 'Bearer user-jwt') =>
  ({ method, headers: authorization ? { authorization } : {}, body }) as never;
const json = (r: Res) => JSON.parse(r.body || 'null');

const ENV = { SUPABASE_URL: 'https://x.supabase.co/', SUPABASE_ANON_KEY: 'anon', SUPABASE_SERVICE_ROLE_KEY: 'service-jwt' };
const CLAIM = { junte_id: JUNTE, title: 'Junte del domingo', author: 'Ana', body: 'Salimos a las 8', tokens: ['ExponentPushToken[b]', 'ExponentPushToken[c]'] };

type Call = { url: string; headers: Record<string, string>; body?: string };
type Answer = { status: number; body?: unknown };

function fakeFetch(answers: Partial<Record<'user' | 'claim' | 'expo' | 'drop', Answer>> = {}) {
  const calls: Call[] = [];
  const fn = jest.fn(async (url: string, init: { headers?: Record<string, string>; body?: string } = {}) => {
    calls.push({ url, headers: init.headers ?? {}, body: init.body });
    const key = url.includes('/auth/v1/user') ? 'user' : url.includes('junte_push_claim') ? 'claim' : url === EXPO_PUSH_URL ? 'expo' : 'drop';
    const fallback: Record<string, Answer> = {
      user: { status: 200, body: { id: UID } },
      claim: { status: 200, body: CLAIM },
      expo: { status: 200, body: { data: [{ status: 'ok', id: 't1' }, { status: 'ok', id: 't2' }] } },
      drop: { status: 200, body: 1 },
    };
    const a = answers[key] ?? fallback[key];
    return { ok: a.status >= 200 && a.status < 300, status: a.status, json: async () => a.body ?? null } as Response;
  });
  return { fn: fn as unknown as typeof fetch, calls };
}

describe('POST /api/junte-push', () => {
  it("verifies the caller, claims as service_role with the token's uid, and pushes to the claimed tokens", async () => {
    const { fn, calls } = fakeFetch();
    const r = res();
    await handler(req('POST'), r as never, ENV, fn);
    expect(r.statusCode).toBe(200);
    expect(json(r)).toEqual({ ok: true, sent: 2, dropped: 0 });
    expect(r.headers['cache-control']).toBe('no-store');

    const [user, claim, expo] = calls;
    expect(user.headers.Authorization).toBe('Bearer user-jwt');
    expect(claim.url).toBe('https://x.supabase.co/rest/v1/rpc/junte_push_claim');
    expect(claim.headers.Authorization).toBe('Bearer service-jwt');
    expect(claim.headers['Content-Profile']).toBe('carguy');
    expect(JSON.parse(claim.body!)).toEqual({ p_message: MSG, p_caller: UID });
    expect(JSON.parse(expo.body!)).toEqual(pushMessages(CLAIM));
    expect(calls).toHaveLength(3);
  });

  it('forgets the tokens Expo says are gone', async () => {
    const { fn, calls } = fakeFetch({
      expo: { status: 200, body: { data: [{ status: 'ok' }, { status: 'error', details: { error: 'DeviceNotRegistered' } }] } },
    });
    const r = res();
    await handler(req('POST'), r as never, ENV, fn);
    expect(json(r)).toEqual({ ok: true, sent: 1, dropped: 1 });
    const drop = calls[3];
    expect(drop.url).toContain('/rpc/drop_push_tokens');
    expect(JSON.parse(drop.body!)).toEqual({ p_tokens: ['ExponentPushToken[c]'] });
  });

  it('sends nothing when the claim is null, a burst, or has no tokens', async () => {
    for (const body of [null, { skipped: 'burst' }, { ...CLAIM, tokens: [] }]) {
      const { fn, calls } = fakeFetch({ claim: { status: 200, body } });
      const r = res();
      await handler(req('POST'), r as never, ENV, fn);
      expect(json(r)).toEqual({ ok: true, sent: 0 });
      expect(calls.some((c) => c.url === EXPO_PUSH_URL)).toBe(false);
    }
  });

  it('refuses without the key, a token, a valid message id, or a valid caller', async () => {
    const cases: [unknown, number, string][] = [
      [[req('POST'), { SUPABASE_URL: 'https://x', SUPABASE_ANON_KEY: 'a' }], 503, 'no-service-key'],
      [[req('POST', { message_id: MSG }, null), ENV], 401, 'no-token'],
      [[req('POST', { message_id: 'nope' }), ENV], 400, 'bad-request'],
      [[req('GET'), ENV], 405, 'method'],
    ];
    for (const [[q, env], status, reason] of cases as [[never, Record<string, string>], number, string][]) {
      const { fn } = fakeFetch();
      const r = res();
      await handler(q, r as never, env, fn);
      expect([r.statusCode, json(r).reason, r.headers['x-car-guy-error']]).toEqual([status, reason, reason]);
    }
    const { fn } = fakeFetch({ user: { status: 401 } });
    const r = res();
    await handler(req('POST'), r as never, ENV, fn);
    expect([r.statusCode, json(r).reason]).toEqual([401, 'bad-token']);
  });

  it('a failed claim is a 502, not a push', async () => {
    const { fn, calls } = fakeFetch({ claim: { status: 500 } });
    const r = res();
    await handler(req('POST'), r as never, ENV, fn);
    expect([r.statusCode, json(r).reason]).toEqual([502, 'claim-failed']);
    expect(calls.some((c) => c.url === EXPO_PUSH_URL)).toBe(false);
  });
});

describe('claimOf / pushMessages', () => {
  it('rejects anything that is not a full claim', () => {
    expect(claimOf(null)).toBeNull();
    expect(claimOf({ skipped: 'burst' })).toBeNull();
    expect(claimOf({ ...CLAIM, junte_id: '../x' })).toBeNull();
  });
  it('one message per token: title, "author: body", the junte route, the juntes channel', () => {
    expect(pushMessages(CLAIM)[0]).toEqual({
      to: 'ExponentPushToken[b]',
      title: 'Junte del domingo',
      body: 'Ana: Salimos a las 8',
      sound: 'default',
      channelId: 'juntes',
      data: { route: `/juntes/${JUNTE}` },
    });
  });
});
