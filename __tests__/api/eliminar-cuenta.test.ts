import handler, { bearer, chunks, objectsByBucket, serviceHeaders } from '../../api/eliminar-cuenta';

type Res = { statusCode: number; headers: Record<string, string>; body: string; setHeader: (k: string, v: string) => void; end: (b: string) => void };
const res = (): Res => {
  const r: Res = { statusCode: 0, headers: {}, body: '', setHeader: (k, v) => void (r.headers[k.toLowerCase()] = v), end: (b) => void (r.body = b) };
  return r;
};
const req = (method: string, authorization?: string) => ({ method, headers: authorization ? { authorization } : {} }) as never;
const json = (r: Res) => JSON.parse(r.body || 'null');

const ENV = { SUPABASE_URL: 'https://x.supabase.co/', SUPABASE_ANON_KEY: 'anon', SUPABASE_SERVICE_ROLE_KEY: 'service-jwt' };
const UID = '00000000-0000-0000-0000-00000000000a';
const OBJECTS = [
  { bucket: 'carguy-media', name: `${UID}/m1.jpg` },
  { bucket: 'carguy-media', name: 'v/veh_a/m2.jpg' },
  { bucket: 'carguy-public', name: 'ae85hchg/m1.jpg' },
  { bucket: 'carguy-feedback', name: 'dev/fb.jpg' },
  { bucket: 'musichub-covers', name: 'not/ours.jpg' },
  { bucket: 'carguy-media', name: '../escape.jpg' },
];

type Call = { url: string; method: string; headers: Record<string, string>; body?: string };

function fakeFetch(answers: Partial<Record<'user' | 'rpc' | 'storage' | 'admin', { status: number; body?: unknown }>> = {}) {
  const calls: Call[] = [];
  const fn = jest.fn(async (url: string, init: { method?: string; headers?: Record<string, string>; body?: string } = {}) => {
    calls.push({ url, method: init.method ?? 'GET', headers: init.headers ?? {}, body: init.body });
    const key = url.includes('/auth/v1/user') ? 'user' : url.includes('/rpc/') ? 'rpc' : url.includes('/storage/') ? 'storage' : 'admin';
    const fallback = {
      user: { status: 200, body: { id: UID, email: 'a@example.com' } },
      rpc: { status: 200, body: { user_id: UID, deleted: { vehicle: 1 }, objects: OBJECTS } },
      storage: { status: 200, body: [] },
      admin: { status: 200, body: {} },
    }[key];
    const a = answers[key] ?? fallback;
    return { ok: a.status >= 200 && a.status < 300, status: a.status, json: async () => a.body ?? null } as Response;
  });
  return { fn: fn as unknown as typeof fetch, calls };
}

describe('POST /api/eliminar-cuenta', () => {
  it('verifies the token, runs the RPC as the caller, removes the objects and the login with the service key', async () => {
    const { fn, calls } = fakeFetch();
    const r = res();
    await handler(req('POST', `Bearer user-jwt`), r as never, ENV, fn);
    expect(r.statusCode).toBe(200);
    expect(json(r)).toEqual({ ok: true, removed: 4, deleted: { vehicle: 1 } });
    expect(r.headers['cache-control']).toBe('no-store');

    const [user, rpc, ...rest] = calls;
    expect(user.url).toBe('https://x.supabase.co/auth/v1/user');
    expect(user.headers.Authorization).toBe('Bearer user-jwt');
    expect(rpc.url).toBe('https://x.supabase.co/rest/v1/rpc/delete_my_account');
    // As the caller: their token, the anon key — never the service key.
    expect(rpc.headers).toMatchObject({ apikey: 'anon', Authorization: 'Bearer user-jwt', 'Content-Profile': 'carguy' });

    const storage = rest.filter((c) => c.url.includes('/storage/'));
    expect(storage.map((c) => [c.url.split('/object/')[1], JSON.parse(c.body ?? '{}').prefixes])).toEqual([
      ['carguy-media', [`${UID}/m1.jpg`, 'v/veh_a/m2.jpg']],
      ['carguy-public', ['ae85hchg/m1.jpg']],
      ['carguy-feedback', ['dev/fb.jpg']],
    ]);
    for (const c of storage) expect(c.headers).toMatchObject({ apikey: 'service-jwt', Authorization: 'Bearer service-jwt' });
    const admin = rest[rest.length - 1];
    expect(admin).toMatchObject({ url: `https://x.supabase.co/auth/v1/admin/users/${UID}`, method: 'DELETE' });
    expect(admin.headers.apikey).toBe('service-jwt');
  });

  it('without SUPABASE_SERVICE_ROLE_KEY: 503 no-service-key before anything is called', async () => {
    const { fn, calls } = fakeFetch();
    const r = res();
    await handler(req('POST', 'Bearer user-jwt'), r as never, { ...ENV, SUPABASE_SERVICE_ROLE_KEY: '' }, fn);
    expect(r.statusCode).toBe(503);
    expect(json(r)).toEqual({ ok: false, reason: 'no-service-key' });
    expect(r.headers['x-car-guy-error']).toBe('no-service-key');
    expect(calls).toEqual([]);
  });

  it('refuses a Music Hub-only account (the RPC says not_carguy): 403, nothing deleted', async () => {
    const { fn, calls } = fakeFetch({ rpc: { status: 403, body: { code: '42501', message: 'not_carguy' } } });
    const r = res();
    await handler(req('POST', 'Bearer mh-jwt'), r as never, ENV, fn);
    expect(r.statusCode).toBe(403);
    expect(json(r)).toEqual({ ok: false, reason: 'not-carguy' });
    expect(calls.some((c) => c.url.includes('/storage/') || c.url.includes('/admin/'))).toBe(false);
  });

  it('no token / a bad token: 401 and no RPC', async () => {
    const none = res();
    const a = fakeFetch();
    await handler(req('POST'), none as never, ENV, a.fn);
    expect(none.statusCode).toBe(401);
    expect(json(none).reason).toBe('no-token');
    expect(a.calls).toEqual([]);

    const bad = res();
    const b = fakeFetch({ user: { status: 401, body: { msg: 'invalid JWT' } } });
    await handler(req('POST', 'Bearer forged'), bad as never, ENV, b.fn);
    expect(bad.statusCode).toBe(401);
    expect(json(bad).reason).toBe('bad-token');
    expect(b.calls).toHaveLength(1);
  });

  it('an RPC answer for another user is refused', async () => {
    const { fn, calls } = fakeFetch({ rpc: { status: 200, body: { user_id: 'someone-else', objects: OBJECTS } } });
    const r = res();
    await handler(req('POST', 'Bearer user-jwt'), r as never, ENV, fn);
    expect(r.statusCode).toBe(502);
    expect(calls.some((c) => c.url.includes('/storage/'))).toBe(false);
  });

  it('a Storage failure keeps the login (a retry or the admin finishes)', async () => {
    const { fn, calls } = fakeFetch({ storage: { status: 500 } });
    const r = res();
    await handler(req('POST', 'Bearer user-jwt'), r as never, ENV, fn);
    expect(r.statusCode).toBe(502);
    expect(json(r)).toEqual({ ok: false, reason: 'storage-failed', removed: 0 });
    expect(calls.some((c) => c.url.includes('/auth/v1/admin/'))).toBe(false);
  });

  it('the login already gone (404) is fine; another auth failure is not', async () => {
    const gone = res();
    await handler(req('POST', 'Bearer user-jwt'), gone as never, ENV, fakeFetch({ admin: { status: 404 } }).fn);
    expect(gone.statusCode).toBe(200);
    const fail = res();
    await handler(req('POST', 'Bearer user-jwt'), fail as never, ENV, fakeFetch({ admin: { status: 500 } }).fn);
    expect(fail.statusCode).toBe(502);
    expect(json(fail).reason).toBe('auth-delete-failed');
  });
});

describe('GET / OPTIONS / others', () => {
  it('GET says whether the login can be removed here, and never needs a token', async () => {
    const yes = res();
    await handler(req('GET'), yes as never, ENV, fakeFetch().fn);
    expect(json(yes)).toEqual({ configured: true });
    const no = res();
    await handler(req('GET'), no as never, { ...ENV, SUPABASE_SERVICE_ROLE_KEY: undefined }, fakeFetch().fn);
    expect(json(no)).toEqual({ configured: false });
  });

  it('OPTIONS answers the preflight; PUT is refused', async () => {
    const pre = res();
    await handler(req('OPTIONS'), pre as never, ENV, fakeFetch().fn);
    expect(pre.statusCode).toBe(204);
    expect(pre.headers['access-control-allow-headers']).toContain('authorization');
    const put = res();
    await handler(req('PUT'), put as never, ENV, fakeFetch().fn);
    expect(put.statusCode).toBe(405);
  });
});

describe('helpers', () => {
  it('new-style secret keys go in apikey only', () => {
    expect(serviceHeaders({ SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_abc' })).toEqual({ apikey: 'sb_secret_abc' });
    expect(serviceHeaders({})).toBeNull();
  });
  it('bearer, chunks, and the object list cleaned of foreign buckets, path tricks and duplicates', () => {
    expect(bearer({ headers: { authorization: 'Bearer abc' } } as never)).toBe('abc');
    expect(bearer({ headers: { authorization: 'Basic abc' } } as never)).toBeNull();
    expect(chunks([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    const m = objectsByBucket([...OBJECTS, OBJECTS[0], { bucket: 'carguy-media', name: '/abs.jpg' }, null]);
    expect([...m.keys()]).toEqual(['carguy-media', 'carguy-public', 'carguy-feedback']);
    expect(m.get('carguy-media')).toEqual([`${UID}/m1.jpg`, 'v/veh_a/m2.jpg']);
    expect(objectsByBucket('nope').size).toBe(0);
  });
});
