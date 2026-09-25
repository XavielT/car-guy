#!/usr/bin/env node
/**
 * Proves that two accounts can each sync the same seeded catalog row.
 *
 *   node tools/verify-shared-ids.mjs            # conflict target (user_id, id) — the engine's
 *   node tools/verify-shared-ids.mjs --legacy   # conflict target id — what it used to send
 *
 * Every device seeds `service_type`, `inspection_template` and
 * `inspection_item` from lib/domain/catalog.ts with the same slug ids
 * (`aceite_motor`, `carro_semanal`, `carro_semanal__0`). With `id` alone as the
 * cloud primary key, the first account to push one owns it, and the second
 * account's upsert lands on a row its RLS policy cannot update — the push
 * fails, and since a push error aborts the sync, that account never syncs
 * again. sql/008 keys those three tables by (user_id, id).
 *
 * Creates two throwaway users (`carguy-sync-shared-…@example.com`, removed by
 * sql/999_cleanup_test_users.sql). Every row id carries `sync_probe_`.
 */

import { readFileSync } from 'node:fs';

function loadEnv() {
  const env = {};
  const text = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return env;
}

const env = loadEnv();
const URL_BASE = env.EXPO_PUBLIC_SUPABASE_URL;
const ANON = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const stamp = Date.now();
const legacy = process.argv.includes('--legacy');
const onConflict = legacy ? 'id' : 'user_id,id';

async function call(path, { method = 'GET', body, token, headers = {} } = {}) {
  const write = method !== 'GET';
  const response = await fetch(`${URL_BASE}${path}`, {
    method,
    headers: {
      apikey: ANON,
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(path.startsWith('/rest/')
        ? write
          ? { 'Content-Profile': 'carguy' }
          : { 'Accept-Profile': 'carguy' }
        : {}),
      ...headers,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await response.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = text;
  }
  return { status: response.status, body: parsed };
}

async function signUp(tag) {
  const email = `carguy-sync-shared-${stamp}-${tag}@example.com`;
  const res = await call('/auth/v1/signup', {
    method: 'POST',
    body: { email, password: 'carguy-sync-probe-8', data: { app: 'carguy' } },
  });
  if (!res.body?.access_token) {
    console.error(`Could not create ${email}:`, JSON.stringify(res.body).slice(0, 200));
    process.exit(1);
  }
  return { email, token: res.body.access_token, userId: res.body.user.id };
}

const now = new Date().toISOString();
const shared = {
  service_type: {
    id: `sync_probe_st_${stamp}`,
    name: 'Aceite de motor y filtro',
    category: 'motor',
    default_interval_km: 5000,
    default_interval_months: 6,
    is_seeded: true,
  },
  inspection_template: {
    id: `sync_probe_tpl_${stamp}`,
    name: 'Chequeo semanal',
    cadence: 'semanal',
    is_seeded: true,
    is_enabled: true,
  },
  inspection_item: {
    id: `sync_probe_tpl_${stamp}__0`,
    template_id: `sync_probe_tpl_${stamp}`,
    group_name: 'Fluidos',
    label: 'Refrigerante',
    requires_cold_engine: true,
  },
};

/** The exact request supabase-js builds for `upsert(rows, { onConflict })`. */
const push = (user, table, extra = {}) =>
  call(`/rest/v1/${table}?on_conflict=${onConflict}`, {
    method: 'POST',
    token: user.token,
    headers: { Prefer: 'return=minimal,resolution=merge-duplicates' },
    body: [{ ...shared[table], ...extra, user_id: user.userId, created_at: now, updated_at: now }],
  });

const results = [];
function check(name, pass, detail) {
  results.push(pass);
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}`);
  if (detail) console.log(`      ${detail}`);
}
const ok = (s) => s === 200 || s === 201 || s === 204;

console.log(`shared seeded ids · on_conflict=${onConflict} · ${now}\n`);
const a = await signUp('a');
const b = await signUp('b');

for (const table of Object.keys(shared)) {
  const first = await push(a, table);
  check(`${table}: account A pushes the seeded row`, ok(first.status), `status ${first.status}`);
  const second = await push(b, table);
  check(
    `${table}: account B pushes the same id`,
    ok(second.status),
    `status ${second.status}${ok(second.status) ? '' : ` · ${JSON.stringify(second.body).slice(0, 160)}`}`,
  );
}

// Each account edits its own copy; neither edit may reach the other.
await push(a, 'service_type', { default_interval_km: 7000 });
await push(b, 'service_type', { default_interval_km: 10000 });
const readKm = async (user) => {
  const res = await call(
    `/rest/v1/service_type?id=eq.${shared.service_type.id}&select=default_interval_km,user_id`,
    { token: user.token },
  );
  return Array.isArray(res.body) ? res.body : [];
};
const [rowsA, rowsB] = [await readKm(a), await readKm(b)];
check(
  'each account reads only its own row, with its own edit',
  rowsA.length === 1 && rowsA[0].default_interval_km === 7000 &&
    rowsB.length === 1 && rowsB[0].default_interval_km === 10000,
  `A=${JSON.stringify(rowsA)} B=${JSON.stringify(rowsB)}`,
);

const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} passed`);
console.log('\n--- cleanup (sql/999_cleanup_test_users.sql covers these) ---');
console.log(`delete from auth.users where email in ('${a.email}', '${b.email}');`);
process.exit(passed === results.length ? 0 : 1);
