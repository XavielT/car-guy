/** Phase 7 (ADR-34): the releases/latest payload, the Android check, and /api/apk's responses. */
import handler, { CACHE } from '../../api/apk';
import { apkFromRelease, isAndroidBrowser, sizeLabel, STABLE_APK_URL } from '@/lib/release/apk';

const release = {
  tag_name: 'v2.2.0',
  published_at: '2026-10-02T12:00:00Z',
  body: '## 2.2.0 — Kaidō',
  assets: [
    { name: 'car-guy-v2.2.0.apk', browser_download_url: 'https://x/car-guy-v2.2.0.apk', size: 54_280_025 },
    { name: 'car-guy.apk', browser_download_url: 'https://github.com/XavielT/car-guy/releases/download/v2.2.0/car-guy.apk', size: 54_280_025 },
  ],
};

describe('apkFromRelease', () => {
  it('picks the asset named exactly car-guy.apk, strips the v', () => {
    expect(apkFromRelease(release)).toEqual({
      version: '2.2.0',
      publishedAt: '2026-10-02T12:00:00Z',
      url: 'https://github.com/XavielT/car-guy/releases/download/v2.2.0/car-guy.apk',
      size: 54_280_025,
      notes: '## 2.2.0 — Kaidō',
    });
  });
  it('is null without the stable asset or with junk', () => {
    expect(apkFromRelease({ ...release, assets: [release.assets[0]] })).toBeNull();
    expect(apkFromRelease(null)).toBeNull();
    expect(apkFromRelease({ message: 'Not Found' })).toBeNull();
  });
  it('the stable fallback is releases/latest/download', () => {
    expect(STABLE_APK_URL).toBe('https://github.com/XavielT/car-guy/releases/latest/download/car-guy.apk');
  });
});

it('sizeLabel rounds like the download sheet', () => {
  expect(sizeLabel(54_280_025)).toBe('52 MB');
  expect(sizeLabel(5 * 1024 * 1024 + 300_000)).toBe('5.3 MB');
  expect(sizeLabel(null)).toBeNull();
});

it('isAndroidBrowser: client hints first, then the UA; iOS and desktop never', () => {
  expect(isAndroidBrowser({ userAgentData: { platform: 'Android' } })).toBe(true);
  expect(isAndroidBrowser({ userAgentData: { platform: 'Windows' }, userAgent: 'Android' })).toBe(false);
  expect(isAndroidBrowser({ userAgent: 'Mozilla/5.0 (Linux; Android 14; 23124RA7EO) Chrome/130' })).toBe(true);
  expect(isAndroidBrowser({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)' })).toBe(false);
  expect(isAndroidBrowser(undefined)).toBe(false);
});

describe('/api/apk', () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
  });
  const call = async (fetchImpl: () => Promise<unknown>, env: Record<string, string | undefined> = {}) => {
    global.fetch = jest.fn(fetchImpl) as never;
    const headers: Record<string, string> = {};
    const res = { statusCode: 0, body: '', setHeader: (k: string, v: string) => (headers[k] = v), end: (b: string) => (res.body = b) };
    await handler({} as never, res as never, env);
    return { status: res.statusCode, headers, json: JSON.parse(res.body) };
  };

  it('200 with the CDN cache headers', async () => {
    const r = await call(async () => ({ ok: true, status: 200, json: async () => release }));
    expect(r.status).toBe(200);
    expect(r.json.version).toBe('2.2.0');
    expect(r.headers['Cache-Control']).toBe(CACHE);
    expect(CACHE).toContain('s-maxage=600');
    expect(CACHE).toContain('stale-if-error=86400');
  });
  it('sends the token only when set, and never echoes it', async () => {
    let auth: string | undefined;
    const r = await call(
      async () => ({ ok: false, status: 403, json: async () => ({}) }),
      { GITHUB_TOKEN: 'ghp_secret' },
    );
    auth = ((global.fetch as jest.Mock).mock.calls[0][1] as { headers: Record<string, string> }).headers.Authorization;
    expect(auth).toBe('Bearer ghp_secret');
    expect(r.status).toBe(502);
    expect(r.headers['X-Car-Guy-Error']).toBe('github-403');
    expect(JSON.stringify(r)).not.toContain('ghp_secret');
  });
  it('502 when GitHub is unreachable or the release has no car-guy.apk', async () => {
    expect((await call(async () => Promise.reject(new Error('ENOTFOUND')))).headers['X-Car-Guy-Error']).toBe('github-unreachable');
    const r = await call(async () => ({ ok: true, status: 200, json: async () => ({ ...release, assets: [] }) }));
    expect(r.status).toBe(502);
    expect(r.headers['X-Car-Guy-Error']).toBe('no-apk-asset');
  });
});
