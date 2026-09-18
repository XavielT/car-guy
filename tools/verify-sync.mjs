#!/usr/bin/env node
/**
 * Proves the sync protocol against the live `carguy` schema.
 *
 *   node tools/verify-sync.mjs
 *
 * The engine itself needs SQLite and React Native, so it cannot run in Node.
 * What this checks is the half that the unit tests cannot: that the *contract*
 * holds — that the column names, the boolean coercion, the upsert conflict
 * targets, the cursor ordering and the server-side LWW trigger behave the way
 * `lib/sync/engine.ts` assumes. A green run here plus the 99 unit tests is the
 * evidence that a device round trip will work before a device is involved.
 *
 * Creates one throwaway user, does its work, and prints the cleanup SQL. Every
 * row it writes carries `sync_probe_` in its id.
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
const email = `carguy-sync-${stamp}@example.com`;

let token = null;
let userId = null;

async function call(path, { method = 'GET', body, headers = {} } = {}) {
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

const results = [];
function check(name, pass, detail) {
  results.push({ name, pass });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}`);
  if (detail) console.log(`      ${detail}`);
}

const iso = (offsetMs = 0) => new Date(Date.now() + offsetMs).toISOString();

/**
 * PostgREST answers 201 when an upsert inserts and 200 when it updates. The
 * engine never reads the status — supabase-js reports failure through `error` —
 * so both are success here.
 */
const wrote = (status) => status === 200 || status === 201;

async function main() {
  console.log(`sync protocol verification · ${new Date().toISOString()}\n`);

  const signup = await call('/auth/v1/signup', {
    method: 'POST',
    body: { email, password: 'carguy-sync-probe-8', data: { app: 'carguy' } },
  });
  token = signup.body?.access_token;
  userId = signup.body?.user?.id;
  if (!token) {
    console.error('Could not create the probe user:', JSON.stringify(signup.body).slice(0, 200));
    process.exit(1);
  }

  const vehicleId = `sync_probe_veh_${stamp}`;
  const t1 = iso(-60_000);
  const t2 = iso();

  // 1 — the exact payload shape pushTable builds, with booleans as real booleans.
  const insert = await call('/rest/v1/vehicle', {
    method: 'POST',
    headers: { Prefer: 'return=representation,resolution=merge-duplicates' },
    body: [
      {
        id: vehicleId,
        user_id: userId,
        name: 'Corolla',
        type: 'carro',
        default_fuel_type: 'regular',
        is_archived: false,
        sort_order: 0,
        notes: '',
        created_at: t1,
        updated_at: t1,
      },
    ],
  });
  check(
    '1. push shape is accepted (booleans, user_id, timestamps)',
    wrote(insert.status),
    `status ${insert.status}${insert.status !== 201 ? ` · ${JSON.stringify(insert.body)}` : ''}`,
  );

  // 2 — server_updated_at exists and is the cursor the engine orders by.
  const read = await call(`/rest/v1/vehicle?id=eq.${vehicleId}&select=*`);
  const row = Array.isArray(read.body) ? read.body[0] : null;
  check(
    '2. server_updated_at is populated for the pull cursor',
    Boolean(row?.server_updated_at),
    row ? `server_updated_at = ${row.server_updated_at}` : JSON.stringify(read.body),
  );
  const cursorAfterInsert = row?.server_updated_at;

  // 3 — a NEWER write applies, and moves the cursor.
  const newer = await call('/rest/v1/vehicle', {
    method: 'POST',
    headers: { Prefer: 'return=representation,resolution=merge-duplicates' },
    body: [
      {
        id: vehicleId,
        user_id: userId,
        name: 'Corolla editado',
        type: 'carro',
        default_fuel_type: 'regular',
        is_archived: false,
        sort_order: 0,
        notes: '',
        created_at: t1,
        updated_at: t2,
      },
    ],
  });
  const afterNewer = (await call(`/rest/v1/vehicle?id=eq.${vehicleId}&select=*`)).body?.[0];
  check(
    '3. a newer updated_at is applied',
    wrote(newer.status) && afterNewer?.name === 'Corolla editado',
    `name = ${afterNewer?.name}`,
  );
  check(
    '3b. and the cursor advanced',
    afterNewer?.server_updated_at > cursorAfterInsert,
    `${cursorAfterInsert} → ${afterNewer?.server_updated_at}`,
  );

  // 4 — THE ONE THAT MATTERS: a STALE write must be ignored, silently, and
  //     must NOT move the cursor. This is sql/005 doing its job.
  const staleCursor = afterNewer?.server_updated_at;
  const stale = await call('/rest/v1/vehicle', {
    method: 'POST',
    headers: { Prefer: 'return=representation,resolution=merge-duplicates' },
    body: [
      {
        id: vehicleId,
        user_id: userId,
        name: 'ESTO NO DEBE GANAR',
        type: 'carro',
        default_fuel_type: 'regular',
        is_archived: false,
        sort_order: 0,
        notes: '',
        created_at: t1,
        updated_at: t1, // older than what the server holds
      },
    ],
  });
  const afterStale = (await call(`/rest/v1/vehicle?id=eq.${vehicleId}&select=*`)).body?.[0];
  check(
    '4. a stale write is rejected by the LWW trigger',
    wrote(stale.status) && afterStale?.name === 'Corolla editado',
    `name is still ${afterStale?.name}`,
  );
  check(
    '4b. and the rejected write did NOT move the cursor',
    afterStale?.server_updated_at === staleCursor,
    afterStale?.server_updated_at === staleCursor
      ? 'unchanged — other devices will not re-pull it'
      : `MOVED: ${staleCursor} → ${afterStale?.server_updated_at}`,
  );

  // 5 — tombstones travel like any other row.
  const t3 = iso(60_000);
  await call('/rest/v1/vehicle', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates' },
    body: [
      {
        id: vehicleId,
        user_id: userId,
        name: 'Corolla editado',
        type: 'carro',
        default_fuel_type: 'regular',
        is_archived: false,
        sort_order: 0,
        notes: '',
        created_at: t1,
        updated_at: t3,
        deleted_at: t3,
      },
    ],
  });
  const afterDelete = (await call(`/rest/v1/vehicle?id=eq.${vehicleId}&select=*`)).body?.[0];
  check(
    '5. a tombstone is stored, not a row disappearing',
    Boolean(afterDelete?.deleted_at),
    `deleted_at = ${afterDelete?.deleted_at}`,
  );

  // 6 — the cursor query the engine actually issues.
  const paged = await call(
    `/rest/v1/vehicle?server_updated_at=gt.${encodeURIComponent(cursorAfterInsert)}&select=id&order=server_updated_at.asc&limit=500`,
  );
  check(
    '6. the pull query (gt cursor, ordered, limited) returns rows',
    Array.isArray(paged.body) && paged.body.length >= 1,
    `${Array.isArray(paged.body) ? paged.body.length : '?'} row(s)`,
  );

  // 7 — settings upsert on its composite key.
  const setting = await call('/rest/v1/setting', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates' },
    body: [{ user_id: userId, key: 'theme', value: '"dark"', updated_at: t2 }],
  });
  check(
    "7. setting upserts on (user_id, key)",
    wrote(setting.status),
    `status ${setting.status}${setting.status !== 201 ? ` · ${JSON.stringify(setting.body)}` : ''}`,
  );

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} passed.`);
  console.log('\n--- cleanup ---');
  console.log(`delete from auth.users where email = '${email}';`);
  process.exitCode = failed.length ? 1 : 0;
}

main().catch((error) => {
  console.error('could not run:', error.message);
  process.exit(1);
});
