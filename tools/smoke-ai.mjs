#!/usr/bin/env node
/**
 * Smoke test of the deployed AI gateway (IMP 03112026, PROMPT-01 step 6). Run AFTER sql/042, the secrets and the
 * deploy. It proves the four brakes against the real x-core, with an ADMIN Car Guy test account (cg-ai-ping is admin
 * only, and the caps are changed through set_app_config, which is admin only):
 *
 *   SMOKE_EMAIL=… SMOKE_PASSWORD=… node tools/smoke-ai.mjs
 *
 *   1. signed out: cg-ai-status answers {enabled, configured}
 *   2. no consent        → cg-ai-ping 403 sin_consentimiento_ia
 *   3. consent           → 200 and an ai_usage row appears with a cost
 *   4. cap lowered to 0  → 429 rate_user      (limit restored in `finally`)
 *   5. kill switch off   → 503 ai_disabled    (restored in `finally`)
 *
 * It uses the PUBLIC anon key from eas.json plus the account's own session; no service key, no secret. The
 * caps and the kill switch are put back to the values they had, even when a step fails. Prints no token.
 */
import { readFileSync } from 'node:fs';

const eas = JSON.parse(readFileSync(new URL('../eas.json', import.meta.url), 'utf8')).build.base.env;
const URL_ = eas.EXPO_PUBLIC_SUPABASE_URL;
const ANON = eas.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const { SMOKE_EMAIL, SMOKE_PASSWORD } = process.env;
if (!SMOKE_EMAIL || !SMOKE_PASSWORD) {
  console.error('usage: SMOKE_EMAIL=<admin car guy account> SMOKE_PASSWORD=<password> node tools/smoke-ai.mjs');
  process.exit(2);
}

const results = [];
const check = (name, ok, detail = '') => {
  results.push(ok);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
};

async function signIn() {
  const r = await fetch(`${URL_}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON, 'content-type': 'application/json' },
    body: JSON.stringify({ email: SMOKE_EMAIL, password: SMOKE_PASSWORD }),
  });
  if (!r.ok) throw new Error(`sign-in failed (HTTP ${r.status})`);
  return (await r.json()).access_token;
}

const fn = (name, token, method = 'POST') =>
  fetch(`${URL_}/functions/v1/${name}`, {
    method,
    headers: { apikey: ANON, ...(token ? { authorization: `Bearer ${token}` } : {}), 'content-type': 'application/json' },
    body: method === 'POST' ? '{}' : undefined,
  }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }));

const rpc = (name, token, args = {}) =>
  fetch(`${URL_}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: ANON, authorization: `Bearer ${token}`, 'content-type': 'application/json', 'content-profile': 'carguy', 'accept-profile': 'carguy' },
    body: JSON.stringify(args),
  }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));

const setConfig = (token, key, value) => rpc('set_app_config', token, { p_key: key, p_value: value, p_public: false });

async function main() {
  const out = await fn('cg-ai-status', null, 'GET');
  check('1. signed out: status answers enabled + configured', out.status === 200 && out.body.signed_in === false && typeof out.body.enabled === 'boolean', `configured=${out.body.configured}`);

  const token = await signIn();
  await rpc('set_ai_consent', token, { p_on: false });
  const noConsent = await fn('cg-ai-ping', token);
  check('2. no consent → 403 sin_consentimiento_ia', noConsent.status === 403 && noConsent.body.error_code === 'sin_consentimiento_ia', `status ${noConsent.status} ${noConsent.body.error_code ?? ''}`);

  await rpc('set_ai_consent', token, { p_on: true, p_version: '1' });
  const ok = await fn('cg-ai-ping', token);
  check('3. consent → 200 pong', ok.status === 200 && ok.body.ok === true, `status ${ok.status} ${ok.body.error_code ?? ''}`);
  const usage = await fetch(`${URL_}/rest/v1/ai_usage?select=function,cost_usd,ok&function=eq.cg-ai-ping&order=id.desc&limit=1`, {
    headers: { apikey: ANON, authorization: `Bearer ${token}`, 'accept-profile': 'carguy' },
  }).then((r) => r.json());
  check('3b. an ai_usage row with a cost was written', Array.isArray(usage) && usage[0]?.ok === true && Number(usage[0]?.cost_usd) > 0, usage?.[0] ? `cost_usd ${usage[0].cost_usd}` : 'no row');

  const original = {};
  try {
    for (const key of ['ai_limit_user_hour', 'ai_enabled']) {
      const r = await fetch(`${URL_}/rest/v1/app_config?select=value&key=eq.${key}`, { headers: { apikey: ANON, authorization: `Bearer ${token}`, 'accept-profile': 'carguy' } }).then((x) => x.json());
      original[key] = r?.[0]?.value;
    }
    await setConfig(token, 'ai_limit_user_hour', 0);
    const capped = await fn('cg-ai-ping', token);
    check('4. cap lowered to 0 → 429 rate_user', capped.status === 429 && capped.body.error_code === 'rate_user', `status ${capped.status} ${capped.body.error_code ?? ''}`);
    await setConfig(token, 'ai_limit_user_hour', original.ai_limit_user_hour ?? 30);

    await setConfig(token, 'ai_enabled', false);
    const killed = await fn('cg-ai-ping', token);
    check('5. kill switch off → 503 ai_disabled', killed.status === 503 && killed.body.error_code === 'ai_disabled', `status ${killed.status} ${killed.body.error_code ?? ''}`);
  } finally {
    await setConfig(token, 'ai_limit_user_hour', original.ai_limit_user_hour ?? 30);
    await setConfig(token, 'ai_enabled', original.ai_enabled ?? true);
    console.log('restored: ai_limit_user_hour and ai_enabled are back to their original values');
  }
  process.exit(results.every(Boolean) ? 0 : 1);
}

main().catch((e) => {
  console.error(`smoke-ai: ${e instanceof Error ? e.message : 'failed'}`);
  process.exit(1);
});
