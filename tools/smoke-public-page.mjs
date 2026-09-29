#!/usr/bin/env node
/**
 * Smoke test of the deployed public page (api/c/[slug].ts) on production.
 *
 *   node tools/smoke-public-page.mjs [https://car-guy.vercel.app]
 *
 * One throwaway `carguy-test-<stamp>-smoke@example.com` account publishes a test
 * car, the page must render with its OG tags, an unknown slug must 404, and after
 * the revoke it must 404 too. `?t=` busts the edge cache (the page is cached for
 * 5 minutes — a revoke takes effect at the edge within that window). Clean up
 * with sql/999 (it matches carguy-test-* users and veh_test_* rows).
 */
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n').map((l) => l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)).filter(Boolean).map((m) => [m[1], m[2].replace(/^["']|["']$/g, '')]));
const URL_BASE = env.EXPO_PUBLIC_SUPABASE_URL;
const ANON = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const SITE = process.argv[2] ?? 'https://car-guy.vercel.app';
const stamp = Date.now();
const ALPHA = 'abcdefghjkmnpqrstuvwxyz23456789';
const slug = Array.from({ length: 8 }, () => ALPHA[Math.floor(Math.random() * ALPHA.length)]).join('');
let token = null;
const results = [];
const check = (name, pass, detail) => { results.push(pass); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? `\n      ${detail}` : ''}`); };

async function rest(path, { method = 'GET', body } = {}) {
  const r = await fetch(`${URL_BASE}${path}`, {
    method,
    headers: { apikey: ANON, Authorization: `Bearer ${token ?? ANON}`, 'Content-Type': 'application/json', ...(method === 'GET' ? { 'Accept-Profile': 'carguy' } : { 'Content-Profile': 'carguy' }) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: r.status, body: await r.text() };
}

const signup = await fetch(`${URL_BASE}/auth/v1/signup`, {
  method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: `carguy-test-${stamp}-smoke@example.com`, password: 'carguy-test-password-8', data: { app: 'carguy' } }),
}).then((r) => r.json());
token = signup.access_token;
if (!token) { console.error('no session', signup); process.exit(1); }

const now = new Date().toISOString();
const vehicleId = `veh_test_smoke_${stamp}`;
await rest('/rest/v1/vehicle', { method: 'POST', body: { id: vehicleId, name: 'Smoke Test', make: 'Toyota', model: 'Sprinter Trueno', year: 1985, default_fuel_type: 'premium', story: 'Prueba del link público.', created_at: now, updated_at: now } });
const share = await rest('/rest/v1/vehicle_share', { method: 'POST', body: { id: `veh_test_share_${stamp}`, vehicle_id: vehicleId, slug, visibility: 'link', published_at: now, created_at: now, updated_at: now } });
check('share row written', share.status === 201, `status ${share.status}`);

const page = await fetch(`${SITE}/c/${slug}?t=${stamp}`);
const html = await page.text();
check('/c/<slug> renders 200 with OG tags and no script', page.status === 200 && html.includes('<meta property="og:title" content="Smoke Test · 1985 Toyota Sprinter Trueno">') && html.includes('twitter:card') && !html.includes('<script'),
  `status ${page.status} · cache ${page.headers.get('cache-control')} · robots ${page.headers.get('x-robots-tag')} · error ${page.headers.get('x-car-guy-error')}`);
check('the page shows the story, and is noindex (visibility link)', html.includes('Prueba del link público.') && html.includes('noindex'));

const unknown = await fetch(`${SITE}/c/zzzzzzzz?t=${stamp}`);
check('an unknown slug is 404', unknown.status === 404, `status ${unknown.status}`);
const bad = await fetch(`${SITE}/c/..%2F..%2Fetc?t=${stamp}`);
check('a malformed slug is refused (404, or 400 from the edge)', bad.status === 404 || bad.status === 400, `status ${bad.status}`);

await rest(`/rest/v1/vehicle_share?id=eq.veh_test_share_${stamp}`, { method: 'PATCH', body: { revoked_at: new Date().toISOString(), slug: null } });
const gone = await fetch(`${SITE}/c/${slug}?t=${stamp}-revoked`);
check('after revoke it is 404', gone.status === 404, `status ${gone.status}`);

console.log(`\n${results.filter(Boolean).length}/${results.length} passed · ${SITE}/c/${slug}`);
process.exitCode = results.every(Boolean) ? 0 : 1;
