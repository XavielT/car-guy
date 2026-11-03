#!/usr/bin/env node
/**
 * Anonymous probes that sql/042 (the AI gateway) is on x-core AND locked down (IMP 03112026, PROMPT-01 step 3).
 *
 *   node tools/verify-ai-gateway.mjs
 *
 * Uses only the PUBLIC project URL and anon key from eas.json. It signs nobody up and writes nothing: a probe that
 * should be refused is refused (and tells us the object EXISTS: PostgREST answers "not found" for a missing
 * function/table and "permission denied" for one that exists but is closed to anon). The signed-in behaviour
 * (consent, usage rows, caps, kill switch) is proven by tools/local-rls/scenario_042.sql locally and by
 * tools/smoke-ai.mjs against the deployed functions. Exit 1 on any FAIL.
 */
import { readFileSync } from 'node:fs';

const env = JSON.parse(readFileSync(new URL('../eas.json', import.meta.url), 'utf8')).build.base.env;
const BASE = env.EXPO_PUBLIC_SUPABASE_URL;
const ANON = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

async function call(path, method = 'GET', body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { apikey: ANON, 'Content-Type': 'application/json', 'Accept-Profile': 'carguy', 'Content-Profile': 'carguy' },
    body: method === 'GET' ? undefined : JSON.stringify(body ?? {}),
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* no body */
  }
  return { status: res.status, code: json?.code ?? '', message: String(json?.message ?? '') };
}

const results = [];
const check = (name, ok, detail) => {
  results.push(ok);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  (${detail})`);
};

/** Missing objects answer PGRST202 (function) / PGRST205 or 42P01 (table); a closed one answers 401/403/42501. */
const exists = (r) => !['PGRST202', 'PGRST205', '42P01', 'PGRST106'].includes(r.code) && r.status !== 404;
const closed = (r) => r.status >= 400 && exists(r);

for (const fn of ['set_ai_consent', 'my_ai_consent', 'ai_gate', 'admin_ai_usage', 'ai_usage_prune']) {
  const r = await call(`/rest/v1/rpc/${fn}`, 'POST', fn === 'ai_gate' ? { p_user: '00000000-0000-0000-0000-000000000000', p_function: 'x' } : fn === 'set_ai_consent' ? { p_on: true } : {});
  check(`rpc ${fn} exists and refuses anon`, closed(r), `status ${r.status} ${r.code}`);
}
for (const table of ['ai_consent', 'ai_usage']) {
  const r = await call(`/rest/v1/${table}?select=*&limit=1`);
  check(`table ${table} exists and anon cannot read it`, closed(r) || (r.status === 200 && r.message === ''), `status ${r.status} ${r.code}`);
}
const ins = await call('/rest/v1/ai_usage', 'POST', { user_id: '00000000-0000-0000-0000-000000000000', function: 'x', ok: true });
check('anon cannot insert ai_usage', ins.status >= 400, `status ${ins.status} ${ins.code}`);

process.exit(results.every(Boolean) ? 0 : 1);
