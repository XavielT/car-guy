// Shared bits of the mocked-network browser checks for the AI flows (no real model call, no real account).
// See evals/ai/README.md > "Browser check".
import { Buffer } from 'node:buffer';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
// playwright-core is a dev tool, not a dependency of the app: point PLAYWRIGHT_CORE at an install of it.
const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');

export const BASE = process.env.BASE || 'http://localhost:8100';
export const REPO = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const eas = JSON.parse(readFileSync(`${REPO}/eas.json`, 'utf8')).build.base.env;
export const SUPA = eas.EXPO_PUBLIC_SUPABASE_URL;
const REF = new URL(SUPA).hostname.split('.')[0];
export const img = (n) => `${REPO}/evals/ai/fixtures/img/${n}`;

const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const fakeJwt = `${b64u({ alg: 'HS256', typ: 'JWT' })}.${b64u({ sub: '00000000-0000-0000-0000-0000000000e2', role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 7200 })}.sig`;
const user = { id: '00000000-0000-0000-0000-0000000000e2', aud: 'authenticated', role: 'authenticated', email: 'e2e@example.test', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };

export const STATUS = { ok: true, signed_in: true, enabled: true, configured: true, consent: true, stt_configured: true, refusal: null, remainingToday: { hour: 30, dayUsd: 0.5 } };
export const f = (value, confidence = 0.95) => ({ value, confidence });

/** canned: { 'cg-ai-read': (body)=>json, 'cg-ai-intent': ..., 'cg-stt': ... } → records every call in `calls`. */
export async function launch({ canned = {}, viewport = { width: 390, height: 844 }, fakeMic = false, vpic = null } = {}) {
  const browser = await chromium.launch({
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
    args: fakeMic ? ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] : [],
  });
  const ctx = await browser.newContext({ viewport, locale: 'es-DO', permissions: fakeMic ? ['microphone'] : [] });
  const calls = [];
  const errors = [];
  // `net.offline = true` makes every AI function call fail like a dead connection (fetch rejects).
  const net = { offline: false };
  // The ai_insights cache (sql/043) as an in-memory table keyed by input_hash: GET returns the stored row or null, POST stores.
  const insights = new Map();
  await ctx.addInitScript(
    ([key, session]) => {
      try {
        if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(session));
      } catch {}
    },
    [`sb-${REF}-auth-token`, { access_token: fakeJwt, token_type: 'bearer', expires_in: 7200, expires_at: Math.floor(Date.now() / 1000) + 7200, refresh_token: 'e2e-refresh', user }],
  );
  await ctx.route(`${SUPA}/**`, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const fn = url.pathname.match(/\/functions\/v1\/([\w-]+)/)?.[1];
    const json = (status, body) => route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' }, body: JSON.stringify(body) });
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    if (fn && net.offline) return route.abort('internetdisconnected');
    if (fn === 'cg-ai-status') return json(200, STATUS);
    if (fn && canned[fn]) {
      let body = null;
      try { body = JSON.parse(req.postData() ?? 'null'); } catch {}
      calls.push({ fn, body });
      return json(200, canned[fn](body));
    }
    if (url.pathname.endsWith('/auth/v1/user')) return json(200, user);
    // The app only accepts a session after carguy.is_app_user() says yes (lib/cloud/membership.ts).
    if (url.pathname.endsWith('/rpc/is_app_user') || url.pathname.endsWith('/rpc/set_ai_consent') || url.pathname.endsWith('/rpc/my_ai_consent')) return json(200, true);
    if (url.pathname.endsWith('/rest/v1/ai_insights')) {
      if (req.method() === 'POST') {
        let row = null;
        try { row = JSON.parse(req.postData() ?? 'null'); } catch {}
        if (row?.input_hash) insights.set(row.input_hash, { payload: row.payload, status: row.status ?? 'new', created_at: new Date().toISOString() });
        return route.fulfill({ status: 201, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' });
      }
      const wanted = (url.searchParams.get('input_hash') ?? '').replace(/^eq\./, '');
      return json(200, insights.get(wanted) ?? null);
    }
    if (url.pathname.includes('/rest/v1/')) return json(200, []);
    return route.abort();
  });
  // NHTSA vPIC (the VIN decoder the vehicle form calls after a scan): canned, or unreachable when `vpic` is null.
  await ctx.route('https://vpic.nhtsa.dot.gov/**', (route) => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' } });
    if (!vpic) return route.abort('internetdisconnected');
    calls.push({ fn: 'vpic', body: route.request().url() });
    return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(vpic) });
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
  return { browser, ctx, page, calls, errors, net, insights };
}

/** Seeds the garage the same way the phase-0 screenshots did (/dev/seed → "Acepto" → "sembrar garaje"). */
export async function seed(page) {
  await page.goto(`${BASE}/dev/seed`, { waitUntil: 'networkidle', timeout: 180000 });
  await page.waitForTimeout(2500);
  const ac = page.getByText('Acepto', { exact: true });
  if (await ac.count()) {
    await ac.first().click();
    await page.waitForTimeout(1200);
  }
  const btn = page.getByText(/sembrar garaje/i);
  if (await btn.count()) {
    await btn.first().click();
    await page.waitForTimeout(12000);
  }
}

export async function go(page, path) {
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle', timeout: 120000 }).catch(() => {});
  await page.waitForTimeout(2500);
}

export const text = (page) => page.locator('body').innerText();
