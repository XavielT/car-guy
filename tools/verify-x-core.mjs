#!/usr/bin/env node
/**
 * Phase 8 verification against x-core, run after the SQL in sql/ is applied.
 *
 *   node tools/verify-x-core.mjs
 *
 * Reads EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY from
 * .env.local. Nothing is hard-coded and nothing is written to the repo — the
 * output goes to stdout with tokens redacted, to be pasted into PROGRESS.md.
 *
 * What it checks, in order:
 *   1. A signup carrying `data.app = 'carguy'` succeeds.        (sql/001)
 *   2. The same signup WITHOUT the flag still fails P0001.      (sql/001)
 *   3. The `carguy` schema answers through PostgREST.           (exposed schemas)
 *   4. User A can insert a vehicle and read it back.            (sql/002, 003)
 *   5. User B sees none of A's rows.                            (sql/003)
 *   6. User B cannot insert a row owned by A.                   (sql/003)
 *   7. Anonymous access is refused.                             (sql/003)
 *
 * It creates two throwaway users named `carguy-test-<timestamp>-<a|b>@example.com`
 * and CANNOT delete them — that needs the service-role key, which must never be
 * in this repo. The cleanup SQL is printed at the end for you to run.
 */

import { readFileSync } from 'node:fs';

function loadEnv() {
  let text = '';
  try {
    text = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
  } catch {
    console.error('No .env.local found. Copy .env.example and fill it in.');
    process.exit(1);
  }

  const env = {};
  for (const line of text.split('\n')) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match) env[match[1]] = match[2].replace(/^["']|["']$/g, '');
  }
  return env;
}

const env = loadEnv();
const URL_BASE = env.EXPO_PUBLIC_SUPABASE_URL;
const ANON = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!URL_BASE || !ANON) {
  console.error('EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY must both be set.');
  process.exit(1);
}

const stamp = Date.now();
const userA = `carguy-test-${stamp}-a@example.com`;
const userB = `carguy-test-${stamp}-b@example.com`;
const PASSWORD = 'carguy-test-password-8';

/** Never print a token. A redacted transcript is still evidence. */
function redact(value) {
  if (typeof value !== 'string') return value;
  return value.replace(/[A-Za-z0-9_-]{30,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, '<token>');
}

async function call(path, options = {}) {
  const response = await fetch(`${URL_BASE}${path}`, {
    ...options,
    headers: {
      apikey: ANON,
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  });
  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: response.status, body };
}

const results = [];
function record(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}`);
  if (detail) console.log(`      ${redact(typeof detail === 'string' ? detail : JSON.stringify(detail))}`);
}

async function signUp(email, withFlag) {
  return call('/auth/v1/signup', {
    method: 'POST',
    body: JSON.stringify({
      email,
      password: PASSWORD,
      ...(withFlag ? { data: { app: 'carguy' } } : {}),
    }),
  });
}

async function main() {
  console.log(`x-core verification · ${new Date().toISOString()}`);
  console.log(`project: ${URL_BASE}\n`);

  // 1 — Car Guy signup is allowed through the invite trigger.
  const a = await signUp(userA, true);
  const tokenA = a.body?.access_token;
  record(
    '1. signup with data.app=carguy succeeds',
    a.status === 200 && Boolean(tokenA),
    `status ${a.status}${tokenA ? ' · session returned' : ` · ${JSON.stringify(a.body)}`}`,
  );

  // 2 — A bare signup still hits Music Hub's rule, unchanged.
  const bare = await signUp(`carguy-test-${stamp}-bare@example.com`, false);
  const bareMessage = bare.body?.msg || bare.body?.message || bare.body?.error_description || '';
  record(
    '2. signup without the flag still fails (invite-only)',
    bare.status >= 400 && /invite/i.test(String(bareMessage)),
    `status ${bare.status} · ${JSON.stringify(bareMessage)}`,
  );

  if (!tokenA) {
    console.log('\nNo session for user A — stopping. Check sql/001 has been applied.');
    printCleanup();
    return;
  }

  const authA = { Authorization: `Bearer ${tokenA}` };

  // 3 — Is the schema exposed at all?
  const probe = await call('/rest/v1/vehicle?select=id&limit=1', { headers: authA });
  const notExposed = probe.body?.code === 'PGRST106';
  record(
    '3. schema carguy is exposed through PostgREST',
    !notExposed && probe.status < 500,
    notExposed
      ? 'PGRST106 — add `carguy` under Project Settings → API → Exposed schemas'
      : `status ${probe.status}`,
  );
  if (notExposed) {
    printCleanup();
    return;
  }

  // 4 — A writes and reads back its own row.
  const now = new Date().toISOString();
  const vehicleId = `veh_test_${stamp}`;
  const insertA = await call('/rest/v1/vehicle', {
    method: 'POST',
    headers: { ...authA, Prefer: 'return=representation' },
    body: JSON.stringify({
      id: vehicleId,
      name: 'Verificación',
      default_fuel_type: 'regular',
      created_at: now,
      updated_at: now,
    }),
  });
  record(
    '4. user A inserts and reads back its own vehicle',
    insertA.status === 201,
    `status ${insertA.status}${insertA.status !== 201 ? ` · ${JSON.stringify(insertA.body)}` : ''}`,
  );

  // 5 & 6 — B must see nothing of A's and must not be able to write as A.
  const b = await signUp(userB, true);
  const tokenB = b.body?.access_token;
  if (!tokenB) {
    record('5/6. second user for the RLS tests', false, `status ${b.status}`);
  } else {
    const authB = { Authorization: `Bearer ${tokenB}` };

    const readB = await call(`/rest/v1/vehicle?id=eq.${vehicleId}&select=id`, { headers: authB });
    record(
      "5. user B cannot see user A's vehicle",
      Array.isArray(readB.body) && readB.body.length === 0,
      `status ${readB.status} · ${JSON.stringify(readB.body)}`,
    );

    const userIdA = a.body?.user?.id;
    const stealB = await call('/rest/v1/vehicle', {
      method: 'POST',
      headers: authB,
      body: JSON.stringify({
        id: `veh_test_steal_${stamp}`,
        user_id: userIdA,
        name: 'Robado',
        default_fuel_type: 'regular',
        created_at: now,
        updated_at: now,
      }),
    });
    record(
      '6. user B cannot insert a row owned by user A (42501)',
      stealB.status === 403 || stealB.body?.code === '42501',
      `status ${stealB.status} · ${JSON.stringify(stealB.body?.code ?? stealB.body)}`,
    );
  }

  // 7 — anon has no grant at all.
  const anon = await call('/rest/v1/vehicle?select=id&limit=1');
  record(
    '7. anonymous select is refused',
    anon.status === 401 || anon.body?.code === '42501' || anon.body?.code === 'PGRST301',
    `status ${anon.status} · ${JSON.stringify(anon.body?.code ?? anon.body)}`,
  );

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} passed.`);
  printCleanup();
  process.exitCode = failed.length ? 1 : 0;
}

function printCleanup() {
  console.log('\n--- Run this in the SQL editor to remove the test users ---');
  console.log(`delete from auth.users where email like 'carguy-test-${stamp}-%';`);
  console.log(`delete from carguy.vehicle where id like 'veh_test_%${stamp}%';`);
  console.log('-- and confirm nothing of Music Hub was touched:');
  console.log(`select id, email from public.profiles where email like 'carguy-test-%';`);
}

main().catch((error) => {
  console.error('Verification could not run:', error.message);
  process.exit(1);
});
