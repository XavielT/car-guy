import handler from '../../api/c/[slug]';

type Res = { statusCode: number; headers: Record<string, string>; body: string; setHeader: (k: string, v: string) => void; end: (b: string) => void };
const res = (): Res => {
  const r: Res = { statusCode: 0, headers: {}, body: '', setHeader: (k, v) => void (r.headers[k.toLowerCase()] = v), end: (b) => void (r.body = b) };
  return r;
};

const DOSSIER = {
  slug: 'ae85hchg',
  visibility: 'link',
  show: { plate: false, vin: false, costs: false, odometer: false, maintenance: false, mods: false, track: false, story: true },
  vehicle: { name: 'Trueno AE85', make: 'Toyota', model: 'Sprinter Trueno', year: 1985, color: null, nickname: null, chassis_code: 'AE85', engine_code: null, hero_media_id: 'h1', plate: null, vin: null, story: 'Drift.' },
  photos: ['h1'],
};

beforeAll(() => {
  process.env.SUPABASE_URL = 'https://x.supabase.co';
  process.env.SUPABASE_ANON_KEY = 'anon';
});

it('renders a shared car with the edge cache header', async () => {
  const fetchMock = jest.fn(async () => ({ ok: true, json: async () => DOSSIER }));
  global.fetch = fetchMock as never;
  const r = res();
  await handler({ query: { slug: 'ae85hchg' }, url: '/c/ae85hchg' } as never, r as never);
  expect(r.statusCode).toBe(200);
  expect(r.headers['cache-control']).toBe('public, s-maxage=300, stale-while-revalidate=86400');
  expect(r.headers['x-robots-tag']).toBe('noindex');
  expect(r.body).toContain('og:image" content="https://x.supabase.co/storage/v1/object/public/carguy-public/ae85hchg/h1.jpg"');
  const [url, init] = fetchMock.mock.calls[0] as unknown as [string, { body: string; headers: Record<string, string> }];
  expect(url).toBe('https://x.supabase.co/rest/v1/rpc/public_dossier');
  expect(JSON.parse(init.body)).toEqual({ p_slug: 'ae85hchg' });
  expect(init.headers['Content-Profile']).toBe('carguy');
});

it('404s an unknown or revoked slug, and never asks the database about a malformed one', async () => {
  const fetchMock = jest.fn(async () => ({ ok: true, json: async () => null }));
  global.fetch = fetchMock as never;
  const gone = res();
  await handler({ query: { slug: 'zzzzzzzz' } } as never, gone as never);
  expect(gone.statusCode).toBe(404);
  expect(gone.body).toContain('No está aquí');

  const bad = res();
  await handler({ query: { slug: "x'; drop" } } as never, bad as never);
  expect(bad.statusCode).toBe(404);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
