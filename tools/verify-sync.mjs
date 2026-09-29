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

/** Storage speaks bytes, not JSON, so it gets its own caller. */
async function storage(path, { method = 'GET', body, contentType } = {}) {
  const response = await fetch(`${URL_BASE}/storage/v1${path}`, {
    method,
    headers: {
      apikey: ANON,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(contentType ? { 'Content-Type': contentType } : {}),
      ...(method === 'POST' ? { 'x-upsert': 'true' } : {}),
    },
    ...(body ? { body } : {}),
  });
  const buffer = await response.arrayBuffer();
  return { status: response.status, bytes: new Uint8Array(buffer) };
}

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

  // 8 — the media bytes path: `<user_id>/<media_id>.jpg` in a private bucket.
  //     `lib/sync/mediaBytes.ts` builds exactly this key, and sql/004's four
  //     policies allow exactly this shape and nothing else.
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x01, 0xff, 0xd9]);
  const objectPath = `${userId}/sync_probe_${stamp}.jpg`;
  const upload = await storage(`/object/carguy-media/${objectPath}`, {
    method: 'POST',
    body: jpeg,
    contentType: 'image/jpeg',
  });
  check(
    '8. media bytes upload to <user_id>/<id>.jpg',
    wrote(upload.status),
    `status ${upload.status}`,
  );

  // 9 — and come back byte-for-byte, which is what the other device downloads.
  const download = await storage(`/object/carguy-media/${objectPath}`);
  const sameBytes =
    download.bytes.length === jpeg.length && download.bytes.every((b, i) => b === jpeg[i]);
  check(
    '9. and download unchanged',
    download.status === 200 && sameBytes,
    `${download.bytes.length} byte(s), status ${download.status}`,
  );

  // 10 — THE ONE THAT MATTERS for Storage: another user's folder is refused.
  //      A photo of a marbete carries a plate number, so this is the whole
  //      reason the bucket is private and keyed by the first path segment.
  const foreign = await storage(
    `/object/carguy-media/00000000-0000-0000-0000-000000000000/stolen.jpg`,
    { method: 'POST', body: jpeg, contentType: 'image/jpeg' },
  );
  check(
    "10. writing into another user's folder is refused",
    foreign.status === 403 || foreign.status === 400,
    `status ${foreign.status} — ${wrote(foreign.status) ? 'ACCEPTED, sql/004 is not in force' : 'refused'}`,
  );

  // Its own litter, through the Storage API: `storage.protect_delete()` rejects
  // deleting the row directly, so SQL cleanup cannot do this one.
  const removed = await storage(`/object/carguy-media/${objectPath}`, { method: 'DELETE' });
  check('11. and the probe object deletes cleanly', removed.status === 200, `status ${removed.status}`);

  // 12 — the compound pull cursor, live. Three rows in ONE request are one
  //      transaction, so they share `server_updated_at` (`now()` is the
  //      transaction start). The engine's filter "strictly after (ts, first id)"
  //      must return exactly the other two — a plain "after ts" returns none,
  //      which is the bug that dropped rows on a new device. Same filter string
  //      as lib/sync/merge.ts afterCursorFilter.
  const tieIds = ['a', 'b', 'c'].map((s) => `sync_probe_tie_${stamp}_${s}`);
  await call('/rest/v1/vehicle', {
    method: 'POST',
    headers: { Prefer: 'return=minimal,resolution=merge-duplicates' },
    body: tieIds.map((id) => ({
      id,
      user_id: userId,
      name: 'Tie',
      type: 'carro',
      default_fuel_type: 'regular',
      is_archived: false,
      sort_order: 0,
      notes: '',
      created_at: t1,
      updated_at: t1,
    })),
  });
  const tied = await call(
    `/rest/v1/vehicle?id=in.(${tieIds.join(',')})&select=id,server_updated_at&order=id.asc`,
  );
  const tieTs = Array.isArray(tied.body) ? tied.body[0]?.server_updated_at : null;
  const sameStamp =
    Array.isArray(tied.body) && tied.body.length === 3 && tied.body.every((r) => r.server_updated_at === tieTs);
  const q = (v) => `"${String(v).replace(/"/g, '\\"')}"`;
  const filter = `server_updated_at.gt.${q(tieTs)},and(server_updated_at.eq.${q(tieTs)},id.gt.${q(tieIds[0])})`;
  const after = await call(
    `/rest/v1/vehicle?or=(${encodeURIComponent(filter)})&id=like.sync_probe_tie_${stamp}_*&select=id&order=server_updated_at.asc,id.asc`,
  );
  const afterIds = Array.isArray(after.body) ? after.body.map((r) => r.id) : after.body;
  check(
    '12. rows sharing a server timestamp are all reachable by the (ts, id) cursor',
    sameStamp && JSON.stringify(afterIds) === JSON.stringify(tieIds.slice(1)),
    `one stamp for all three: ${sameStamp} · after (ts, ${tieIds[0].slice(-1)}) → ${JSON.stringify(afterIds)}`,
  );

  // 15–17 — the shared garage (sql/013), as the engine sees it. B's writes are
  //          stamped minutes ahead: check 5's tombstone left the car's updated_at a
  //          minute in the future, and LWW would (rightly) drop anything older. A second
  //          account B joins the probe's car: its pull cursor is newer than the
  //          car's rows, so the ordinary pull must miss them — which is why
  //          lib/sync/members.ts resets the cursors on a grant — and the reset
  //          pull must bring them. Then B pushes the car the way pushTable does
  //          (its own user_id) and the car must stay the probe's.
  const emailB = `carguy-sync-${stamp}-b@example.com`;
  const signupB = await call('/auth/v1/signup', { method: 'POST', body: { email: emailB, password: 'carguy-sync-probe-8', data: { app: 'carguy' } } });
  const tokenA = token;
  const tokenB = signupB.body?.access_token;
  const userB = signupB.body?.user?.id;
  if (!tokenB) {
    check('15–17. second account for the member scenario', false, JSON.stringify(signupB.body).slice(0, 160));
  } else {
    const cursorB = iso(1000);
    const invite = await call('/rest/v1/rpc/create_invite', { method: 'POST', body: { p_vehicle: vehicleId, p_role: 'editor', p_email: null }, headers: { 'Content-Profile': 'carguy' } });
    token = tokenB;
    const redeem = await call('/rest/v1/rpc/redeem_invite', { method: 'POST', body: { p_code: invite.body }, headers: { 'Content-Profile': 'carguy' } });
    const q2 = (v) => `"${String(v).replace(/"/g, '\\"')}"`;
    const since = await call(`/rest/v1/vehicle?or=(${encodeURIComponent(`server_updated_at.gt.${q2(cursorB)}`)})&id=eq.${vehicleId}&select=id`);
    const full = await call(`/rest/v1/vehicle?id=eq.${vehicleId}&select=id,name&order=server_updated_at.asc,id.asc`);
    const member = await call(`/rest/v1/vehicle_member?user_id=eq.${userB}&select=vehicle_id,role,deleted_at,server_updated_at`);
    check(
      '15. after a grant, the old cursor misses the car and a reset pull brings it',
      redeem.body?.ok === true && Array.isArray(since.body) && since.body.length === 0 && full.body?.length === 1 && member.body?.[0]?.role === 'editor',
      `redeem ${JSON.stringify(redeem.body)} · since cursor ${JSON.stringify(since.body)} · full ${JSON.stringify(full.body)} · member ${JSON.stringify(member.body)}`,
    );

    const pushB = await call('/rest/v1/vehicle', {
      method: 'POST',
      headers: { Prefer: 'return=minimal,resolution=merge-duplicates' },
      body: [{ id: vehicleId, user_id: userB, updated_by: userB, name: 'Corolla de B', type: 'carro', default_fuel_type: 'regular', is_archived: false, sort_order: 0, notes: '', created_at: t1, updated_at: iso(300_000) }],
    });
    token = tokenA;
    const seen = await call(`/rest/v1/vehicle?id=eq.${vehicleId}&select=name,user_id,updated_by`);
    check(
      "16. B's push (its own user_id, as pushTable sends it) edits the car; it stays A's",
      wrote(pushB.status) && seen.body?.[0]?.name === 'Corolla de B' && seen.body?.[0]?.user_id === userId && seen.body?.[0]?.updated_by === userB,
      `push ${pushB.status} · A reads ${JSON.stringify(seen.body)}`,
    );

    const removed = await call('/rest/v1/rpc/remove_member', { method: 'POST', body: { p_vehicle: vehicleId, p_user: userB }, headers: { 'Content-Profile': 'carguy' } });
    token = tokenB;
    const gone = await call(`/rest/v1/vehicle?id=eq.${vehicleId}&select=id`);
    const ended = await call(`/rest/v1/vehicle_member?user_id=eq.${userB}&select=deleted_at`);
    const refused = await call('/rest/v1/vehicle', {
      method: 'POST',
      headers: { Prefer: 'return=minimal,resolution=merge-duplicates' },
      body: [{ id: vehicleId, user_id: userB, name: 'Otra vez', type: 'carro', default_fuel_type: 'regular', is_archived: false, sort_order: 0, notes: '', created_at: t1, updated_at: iso(400_000) }],
    });
    token = tokenA;
    check(
      '17. removed: B stops seeing the car, pulls its ended membership, and a push is refused (42501)',
      removed.body === true && gone.body?.length === 0 && Boolean(ended.body?.[0]?.deleted_at) && (refused.status === 403 || refused.body?.code === '42501'),
      `remove ${JSON.stringify(removed.body)} · car ${JSON.stringify(gone.body)} · member ${JSON.stringify(ended.body)} · push ${refused.status}`,
    );
  }

  // 18–20 — schema v6 (IMP 29092026 Phase 2, sql/019–020). Back as account A.
  token = tokenA ?? token;
  const GAL_L = 3.785411784;
  const fuelId = `sync_probe_fuel_${stamp}`;
  const hinted = await call('/rest/v1/fuel_log', {
    method: 'POST',
    headers: { Prefer: 'return=representation,resolution=merge-duplicates' },
    // Exactly what lib/sync/unitBridge.ts pushes: gallons in the legacy
    // columns, liters alongside, and the hint.
    body: [{
      id: fuelId, user_id: userId, vehicle_id: vehicleId, occurred_at: t1, odometer_km: 1000,
      volume: 11.2, price_per_unit: 322, volume_l: 11.2 * GAL_L, price_per_l: 322 / GAL_L,
      volume_entered: 11.2, volume_entered_unit: 'gal', total_dop: 3606.4, fuel_type: 'premium',
      is_full_tank: true, missed_previous: false, in_reserve: false, gauge_before_eighths: 2,
      station: '', notes: '', schema_hint: 'v6', created_at: t1, updated_at: t1,
    }],
  });
  const back = (await call(`/rest/v1/fuel_log?id=eq.${fuelId}&select=*`)).body?.[0];
  // The gate as 2.1.3 ships it (lib/sync/merge.ts, SCHEMA_HINT 'v5'): newer hint → skipped.
  const hintNumber = (h) => (typeof h === 'string' && /^v\d+$/.test(h) ? Number(h.slice(1)) : null);
  check(
    '18. a v6 row carries its hint, so a 2.1.3 client (v5) skips it',
    wrote(hinted.status) && hintNumber(back?.schema_hint) > 5 && hintNumber(back?.schema_hint) === 6,
    `status ${hinted.status} · schema_hint ${back?.schema_hint}${hinted.status >= 300 ? ` · ${JSON.stringify(hinted.body).slice(0, 160)}` : ''}`,
  );
  check(
    '19. liters round-trip beside the legacy gallons (in_reserve a real boolean, gauge 0–8)',
    Math.abs(back?.volume_l - 11.2 * GAL_L) < 1e-6 && back?.volume === 11.2 && Math.abs(back?.price_per_l - 322 / GAL_L) < 1e-6 &&
      back?.in_reserve === false && back?.gauge_before_eighths === 2,
    `volume ${back?.volume} gal · volume_l ${back?.volume_l} · price_per_l ${back?.price_per_l} · in_reserve ${back?.in_reserve}`,
  );
  const badGauge = await call('/rest/v1/fuel_log', {
    method: 'POST',
    headers: { Prefer: 'return=minimal,resolution=merge-duplicates' },
    body: [{ ...hinted.body?.[0], id: `${fuelId}_bad`, gauge_after_eighths: 9, server_updated_at: undefined }],
  });
  check('19b. a gauge outside 0–8 is refused', badGauge.status >= 400, `status ${badGauge.status}`);

  const tripId = `sync_probe_trip_${stamp}`;
  const tripRow = (updatedAt, notes) => ({
    id: tripId, user_id: userId, vehicle_id: vehicleId, source: 'manual', status: 'done', started_at: t1,
    distance_m: 12400, duration_s: 1500, notes, schema_hint: 'v6', updated_by: userId, created_at: t1, updated_at: updatedAt,
  });
  const upsertTrip = (row) => call('/rest/v1/trip', { method: 'POST', headers: { Prefer: 'return=minimal,resolution=merge-duplicates' }, body: [row] });
  const tripIn = await upsertTrip(tripRow(iso(10_000), 'primero'));
  const tripStale = await upsertTrip(tripRow(iso(-120_000), 'viejo'));
  const tripAfterStale = (await call(`/rest/v1/trip?id=eq.${tripId}&select=notes`)).body?.[0]?.notes;
  const tripNewer = await upsertTrip(tripRow(iso(20_000), 'nuevo'));
  const tripBack = (await call(`/rest/v1/trip?id=eq.${tripId}&select=notes,server_updated_at`)).body?.[0];
  check(
    '20. trip syncs with last-write-wins (a stale write does not replace a newer one)',
    wrote(tripIn.status) && tripAfterStale === 'primero' && wrote(tripNewer.status) && tripBack?.notes === 'nuevo',
    `insert ${tripIn.status} · stale ${tripStale.status} → ${tripAfterStale} · newer ${tripNewer.status} → ${tripBack?.notes}`,
  );

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} passed.`);
  console.log('\n--- cleanup ---');
  console.log(`delete from auth.users where email = '${email}' or email = '${emailB}';`);
  process.exitCode = failed.length ? 1 : 0;
}

main().catch((error) => {
  console.error('could not run:', error.message);
  process.exit(1);
});
