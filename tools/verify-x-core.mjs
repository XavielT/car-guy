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
 *   8. Every schema v2 table answers.                           (sql/009)
 *   9. v2 rows are own-rows only.                               (sql/010)
 *  10. storage_usage_bytes() answers.                           (sql/010)
 *  11. The media quota column defaults to 300 MB.               (sql/010)
 *  12. A client cannot write vehicle_member.                    (sql/010)
 *  13. A uploads a thumb to its own folder; B cannot write there. (sql/004, 011)
 *  14. A cannot raise its own media quota.                      (sql/011)
 *  …
 *  24. anon feedback through submit_feedback; same-id retry is a no-op. (sql/021)
 *  25. the sixth from one device in an hour → rate_limited.   (sql/021)
 *  26. anon cannot select feedback.                           (sql/021)
 *  27. a signed-in user sees its own feedback row only.       (sql/021)
 *  28. screenshot upload only for its row; anon cannot read.  (021_feedback_storage.shared)
 *  (Admin sees all: local-rls 14n–14q only — never an account with the admin email.)
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

/** Schema v2 (IMP 28092026) — every new synced table, sql/009. */
const V2_TABLES = [
  'vehicle_ownership', 'album_item', 'milestone', 'mod_category', 'mod', 'mod_media',
  'vehicle_specsheet', 'spec_snapshot', 'torque_spec', 'wishlist_item', 'inventory_item',
  'wheel_set', 'tire', 'vehicle_dtc_event', 'contact', 'fluid_guide_item', 'venue',
  'track_event', 'track_session', 'setup_sheet', 'consumable_usage', 'vehicle_share', 'vehicle_member',
];

/** Never print a token. A redacted transcript is still evidence. */
function redact(value) {
  if (typeof value !== 'string') return value;
  return value.replace(/[A-Za-z0-9_-]{30,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, '<token>');
}

/**
 * PostgREST serves one schema per request, chosen by a header — `Accept-Profile`
 * for reads and `Content-Profile` for writes. Without them every /rest/v1 call
 * lands in `public`, which is Music Hub's schema: the first run of this script
 * reported "Could not find the table 'public.vehicle'" and would have gone on
 * to look for Car Guy's RLS on tables that were never Car Guy's.
 */
async function call(path, options = {}) {
  const write = options.method && options.method !== 'GET';
  const response = await fetch(`${URL_BASE}${path}`, {
    ...options,
    headers: {
      apikey: ANON,
      'Content-Type': 'application/json',
      ...(write ? { 'Content-Profile': 'carguy' } : { 'Accept-Profile': 'carguy' }),
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
/** Feedback rows this run created (24–28), for the cleanup SQL. */
const feedbackDevices = [];
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
  // PGRST106: the schema is not in the exposed list.
  // PGRST205: the schema is exposed but the table is not there — i.e. sql/002
  // has not been applied. The first run treated a bare 404 as a pass, which is
  // exactly the kind of green tick that hides a missing migration.
  const code = probe.body?.code;
  const notExposed = code === 'PGRST106';
  const noTable = code === 'PGRST205';
  record(
    '3. schema carguy is exposed and has the tables',
    !notExposed && !noTable && probe.status < 400,
    notExposed
      ? 'PGRST106 — add `carguy` under Settings → Data API → Exposed schemas'
      : noTable
        ? 'PGRST205 — schema reachable but empty; apply sql/002_schema_carguy.sql'
        : `status ${probe.status}`,
  );
  if (notExposed || noTable) {
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

    // 8–12 — schema v2 (sql/009, sql/010).
    const missing = [];
    for (const table of V2_TABLES) {
      const probeV2 = await call(`/rest/v1/${table}?select=id&limit=1`, { headers: authA });
      if (probeV2.status >= 400) missing.push(`${table} (${probeV2.body?.code ?? probeV2.status})`);
    }
    record(
      `8. all ${V2_TABLES.length} v2 tables answer (sql/009)`,
      missing.length === 0,
      missing.length ? `missing: ${missing.join(', ')}` : 'ok',
    );

    const modId = `veh_test_mod_${stamp}`;
    const modA = await call('/rest/v1/mod', {
      method: 'POST',
      headers: authA,
      body: JSON.stringify({
        id: modId,
        vehicle_id: vehicleId,
        category_id: 'motor',
        name: 'Verificación',
        created_at: now,
        updated_at: now,
      }),
    });
    const modB = await call(`/rest/v1/mod?id=eq.${modId}&select=id`, { headers: authB });
    record(
      "9. user A writes a mod; user B cannot see it (sql/010)",
      modA.status === 201 && Array.isArray(modB.body) && modB.body.length === 0,
      `insert ${modA.status}${modA.status !== 201 ? ` · ${JSON.stringify(modA.body)}` : ''} · B sees ${JSON.stringify(modB.body)}`,
    );

    const usage = await call('/rest/v1/rpc/storage_usage_bytes', { method: 'POST', headers: authA, body: '{}' });
    record(
      '10. storage_usage_bytes() answers for a user (sql/010)',
      usage.status === 200 && typeof usage.body === 'number',
      `status ${usage.status} · ${JSON.stringify(usage.body)}`,
    );

    const quota = await call('/rest/v1/profiles?select=media_quota_bytes', { headers: authA });
    record(
      '11. profiles.media_quota_bytes defaults to 300 MB (sql/010)',
      Array.isArray(quota.body) && quota.body[0]?.media_quota_bytes === 314572800,
      `status ${quota.status} · ${JSON.stringify(quota.body)}`,
    );

    const selfMember = await call('/rest/v1/vehicle_member', {
      method: 'POST',
      headers: authB,
      body: JSON.stringify({ vehicle_id: vehicleId, user_id: b.body?.user?.id, role: 'owner' }),
    });
    record(
      "12. a client cannot make itself a member of A's vehicle (sql/010)",
      selfMember.status === 401 || selfMember.status === 403 || selfMember.body?.code === '42501',
      `status ${selfMember.status} · ${JSON.stringify(selfMember.body?.code ?? selfMember.body)}`,
    );

    // 13 — thumbs: the `<user>/<id>.thumb.jpg` shape passes the insert policy
    // (with 011's quota check) for the owner and fails for anyone else.
    const thumbPath = `${userIdA}/verify_${stamp}.thumb.jpg`;
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
    const upA = await fetch(`${URL_BASE}/storage/v1/object/carguy-media/${thumbPath}`, {
      method: 'POST',
      headers: { apikey: ANON, ...authA, 'Content-Type': 'image/jpeg' },
      body: bytes,
    });
    const upB = await fetch(`${URL_BASE}/storage/v1/object/carguy-media/${userIdA}/verify_${stamp}_b.thumb.jpg`, {
      method: 'POST',
      headers: { apikey: ANON, ...authB, 'Content-Type': 'image/jpeg' },
      body: bytes,
    });
    // Leave nothing behind in the bucket.
    await fetch(`${URL_BASE}/storage/v1/object/carguy-media`, {
      method: 'DELETE',
      headers: { apikey: ANON, ...authA, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefixes: [thumbPath] }),
    });
    record(
      "13. A uploads a thumb to its folder; B cannot write into A's (sql/004, 011)",
      upA.status === 200 && upB.status >= 400,
      `A ${upA.status} · B ${upB.status}`,
    );

    const raise = await call(`/rest/v1/profiles?user_id=eq.${userIdA}`, {
      method: 'PATCH',
      headers: { ...authA, Prefer: 'return=representation' },
      body: JSON.stringify({ media_quota_bytes: 1099511627776 }),
    });
    const after = await call('/rest/v1/profiles?select=media_quota_bytes', { headers: authA });
    record(
      '14. A cannot raise its own media quota (sql/011)',
      Array.isArray(after.body) && after.body[0]?.media_quota_bytes === 314572800,
      `patch ${raise.status} · now ${JSON.stringify(after.body)}`,
    );
    // 15–17 — the public page (sql/012): one security-definer RPC for anon.
    const rpcAnon = (slug) => call('/rest/v1/rpc/public_dossier', { method: 'POST', headers: { 'Content-Profile': 'carguy' }, body: JSON.stringify({ p_slug: slug }) });
    const slug = `vx${String(stamp).slice(-6).replace(/[01]/g, '2')}`.slice(0, 8).replace(/[^a-hj-km-np-z2-9]/g, 'k');
    const none = await rpcAnon(slug);
    const list = await fetch(`${URL_BASE}/storage/v1/object/list/carguy-public`, {
      method: 'POST',
      headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefix: '' }),
    }).then((r) => r.json()).catch(() => null);
    record(
      '15. anon: unknown slug is null, carguy-public cannot be listed (sql/012)',
      none.status === 200 && none.body === null && Array.isArray(list) && list.length === 0,
      `rpc ${none.status} ${JSON.stringify(none.body)} · list ${JSON.stringify(list)}`,
    );

    await call(`/rest/v1/vehicle?id=eq.${vehicleId}`, { method: 'PATCH', headers: authA, body: JSON.stringify({ vin: 'JT2AE850000000001', plate: 'A700001' }) });
    await call(`/rest/v1/mod?id=eq.${modId}`, { method: 'PATCH', headers: authA, body: JSON.stringify({ cost_part_dop: 14500 }) });
    const share = await call('/rest/v1/vehicle_share', {
      method: 'POST', headers: authA,
      body: JSON.stringify({ id: `veh_test_share_${stamp}`, vehicle_id: vehicleId, slug, visibility: 'link', published_at: now, show_costs: false, created_at: now, updated_at: now }),
    });
    const pub = await rpcAnon(slug);
    const text = JSON.stringify(pub.body ?? null);
    record(
      '16. a published share renders for anon, without costs, VIN/plate masked (sql/012)',
      share.status === 201 && pub.body?.vehicle?.name === 'Verificación' && !/14500|JT2AE850000000001|A700001/.test(text) && pub.body?.vehicle?.vin === 'JT2••••',
      `share ${share.status} · ${text.slice(0, 160)}`,
    );

    const stealShare = await call('/rest/v1/vehicle_share', {
      method: 'POST', headers: authB,
      body: JSON.stringify({ id: `veh_test_share_b_${stamp}`, vehicle_id: vehicleId, slug: `${slug.slice(0, 7)}z`, visibility: 'link', published_at: now, created_at: now, updated_at: now }),
    });
    const stolen = await rpcAnon(`${slug.slice(0, 7)}z`);
    await call(`/rest/v1/vehicle_share?id=eq.veh_test_share_${stamp}`, { method: 'PATCH', headers: authA, body: JSON.stringify({ revoked_at: now, slug: null }) });
    const revoked = await rpcAnon(slug);
    record(
      "17. revoke → null; B cannot publish A's car (sql/012, 013)",
      revoked.body === null && stolen.body === null && stealShare.status >= 400,
      `revoked ${JSON.stringify(revoked.body)} · B share ${stealShare.status} · B slug ${JSON.stringify(stolen.body)}`,
    );

    // 18–23 — the shared garage (sql/013).
    const rpc = (auth, fn, args) => call(`/rest/v1/rpc/${fn}`, { method: 'POST', headers: { ...auth, 'Content-Profile': 'carguy' }, body: JSON.stringify(args) });
    const inviteByB = await rpc(authB, 'create_invite', { p_vehicle: vehicleId, p_role: 'editor', p_email: null });
    record("18. B cannot invite to A's car (is_member denies)", inviteByB.status >= 400, `status ${inviteByB.status} · ${JSON.stringify(inviteByB.body?.code ?? inviteByB.body)}`);

    const invite = await rpc(authA, 'create_invite', { p_vehicle: vehicleId, p_role: 'editor', p_email: userB });
    const redeem = await rpc(authB, 'redeem_invite', { p_code: invite.body });
    const seeCar = await call(`/rest/v1/vehicle?id=eq.${vehicleId}&select=id,name`, { headers: authB });
    const seeMod = await call(`/rest/v1/mod?id=eq.${modId}&select=id`, { headers: authB });
    record(
      '19. A invites B as editor; B redeems and sees the car and its mod',
      typeof invite.body === 'string' && redeem.body?.ok === true && seeCar.body?.length === 1 && seeMod.body?.length === 1,
      `invite ${invite.status} · redeem ${JSON.stringify(redeem.body)} · car ${JSON.stringify(seeCar.body)} · mod ${JSON.stringify(seeMod.body)}`,
    );

    const modByB = `veh_test_modb_${stamp}`;
    const bWrites = await call('/rest/v1/mod', {
      method: 'POST', headers: authB,
      body: JSON.stringify({ id: modByB, vehicle_id: vehicleId, category_id: 'motor', name: 'Hecho por B', created_at: now, updated_at: now }),
    });
    const bUpserts = await call('/rest/v1/vehicle?on_conflict=id', {
      method: 'POST', headers: { ...authB, Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify({ id: vehicleId, user_id: b.body?.user?.id, name: 'Verificación', default_fuel_type: 'regular', notes: 'editado por B', created_at: now, updated_at: new Date().toISOString() }),
    });
    const aSees = await call(`/rest/v1/mod?id=eq.${modByB}&select=id,user_id`, { headers: authA });
    const owner = await call(`/rest/v1/vehicle?id=eq.${vehicleId}&select=user_id,notes`, { headers: authA });
    record(
      "20. B adds a mod and edits the car; A sees both; the car stays A's (keep_creator)",
      bWrites.status === 201 && aSees.body?.length === 1 && bUpserts.status < 300 && owner.body?.[0]?.user_id === userIdA && owner.body?.[0]?.notes === 'editado por B',
      `B mod ${bWrites.status} · B upsert ${bUpserts.status} · A sees ${JSON.stringify(aSees.body)} · car ${JSON.stringify(owner.body)}`,
    );

    const upV = await fetch(`${URL_BASE}/storage/v1/object/carguy-media/v/${vehicleId}/verify_${stamp}.jpg`, {
      method: 'POST', headers: { apikey: ANON, ...authB, 'Content-Type': 'image/jpeg' }, body: bytes,
    });
    const readV = await fetch(`${URL_BASE}/storage/v1/object/authenticated/carguy-media/v/${vehicleId}/verify_${stamp}.jpg`, { headers: { apikey: ANON, ...authA } });
    await fetch(`${URL_BASE}/storage/v1/object/carguy-media`, {
      method: 'DELETE', headers: { apikey: ANON, ...authA, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefixes: [`v/${vehicleId}/verify_${stamp}.jpg`] }),
    });
    record('21. B uploads under v/<vehicle>/, A reads it (sql/013 storage)', upV.status === 200 && readV.status === 200, `B up ${upV.status} · A read ${readV.status}`);

    const toViewer = await rpc(authA, 'set_member_role', { p_vehicle: vehicleId, p_user: b.body?.user?.id, p_role: 'viewer' });
    const viewerWrite = await call('/rest/v1/mod', {
      method: 'POST', headers: authB,
      body: JSON.stringify({ id: `veh_test_modv_${stamp}`, vehicle_id: vehicleId, category_id: 'motor', name: 'No debería', created_at: now, updated_at: now }),
    });
    const viewerRead = await call(`/rest/v1/mod?vehicle_id=eq.${vehicleId}&select=id`, { headers: authB });
    record(
      '22. as viewer B still reads, but cannot write (42501)',
      toViewer.body === true && (viewerWrite.status === 403 || viewerWrite.body?.code === '42501') && viewerRead.body?.length === 2,
      `role ${JSON.stringify(toViewer.body)} · write ${viewerWrite.status} · read ${viewerRead.body?.length}`,
    );

    const removed = await rpc(authA, 'remove_member', { p_vehicle: vehicleId, p_user: b.body?.user?.id });
    const goneCar = await call(`/rest/v1/vehicle?id=eq.${vehicleId}&select=id`, { headers: authB });
    const goneMod = await call(`/rest/v1/mod?vehicle_id=eq.${vehicleId}&select=id`, { headers: authB });
    const myRow = await call(`/rest/v1/vehicle_member?vehicle_id=eq.${vehicleId}&select=role,deleted_at`, { headers: authB });
    record(
      '23. A removes B: B sees nothing of the car, only its ended membership',
      removed.body === true && goneCar.body?.length === 0 && goneMod.body?.length === 0 && myRow.body?.length === 1 && Boolean(myRow.body[0].deleted_at),
      `remove ${JSON.stringify(removed.body)} · car ${JSON.stringify(goneCar.body)} · mods ${JSON.stringify(goneMod.body)} · member ${JSON.stringify(myRow.body)}`,
    );
  }

  // 24–28 — Enviar comentario (sql/021 + 021_feedback_storage.shared). No
  // admin check here: that would need an account with Xaviel's email, which is
  // never created — local-rls covers it with a shimmed JWT claim (14n–14q).
  {
    const fbRpc = (auth, fn, args) => call(`/rest/v1/rpc/${fn}`, { method: 'POST', headers: { ...auth, 'Content-Profile': 'carguy' }, body: JSON.stringify(args) });
    const hex = stamp.toString(16).padStart(12, '0').slice(-12);
    const device = `0000feed-0000-4000-8000-${hex}`;
    const firstId = `0000feed-0001-4000-8000-${hex}`;
    const send = (auth, extra = {}) => fbRpc(auth, 'submit_feedback', { p: { kind: 'bug', message: `Verificación ${stamp}`, device_id: device, app_version: 'verify', platform: 'verify', ...extra } });

    const first = await send({}, { id: firstId });
    const retry = await send({}, { id: firstId });
    record(
      '24. anon inserts feedback through the RPC; a retry with the same id is a no-op (sql/021)',
      first.status === 200 && first.body === firstId && retry.status === 200 && retry.body === firstId,
      `first ${first.status} ${JSON.stringify(first.body)} · retry ${retry.status} ${JSON.stringify(retry.body)}`,
    );

    for (let i = 2; i <= 5; i += 1) await send({});
    const sixth = await send({});
    record(
      '25. the sixth in an hour from one device → rate_limited',
      sixth.status >= 400 && /rate_limited/.test(JSON.stringify(sixth.body)),
      `status ${sixth.status} · ${JSON.stringify(sixth.body?.message ?? sixth.body)}`,
    );

    const anonRead = await call(`/rest/v1/feedback?select=id&device_id=eq.${device}`);
    record(
      '26. anon cannot select feedback',
      anonRead.status === 401 || anonRead.body?.code === '42501' || (Array.isArray(anonRead.body) && anonRead.body.length === 0),
      `status ${anonRead.status} · ${JSON.stringify(anonRead.body?.code ?? anonRead.body)}`,
    );

    const ownDevice = `0000feed-0000-4000-8000-${(stamp + 1).toString(16).padStart(12, '0').slice(-12)}`;
    const own = await fbRpc(authA, 'submit_feedback', { p: { kind: 'idea', message: `Verificación A ${stamp}`, device_id: ownDevice } });
    const ownRead = await call(`/rest/v1/feedback?select=id,user_id,status&device_id=in.(${device},${ownDevice})`, { headers: authA });
    record(
      '27. signed-in A sees its own row only (not the anon ones), status new',
      own.status === 200 && Array.isArray(ownRead.body) && ownRead.body.length === 1 && ownRead.body[0].id === own.body && ownRead.body[0].status === 'new',
      `submit ${own.status} · read ${JSON.stringify(ownRead.body)}`,
    );

    // Needs the --shared bucket; a 404 "Bucket not found" means it was not applied yet.
    const shot = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
    const up = await fetch(`${URL_BASE}/storage/v1/object/carguy-feedback/${device}/${firstId}.jpg`, {
      method: 'POST', headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, 'Content-Type': 'image/jpeg' }, body: shot,
    });
    const stray = await fetch(`${URL_BASE}/storage/v1/object/carguy-feedback/${device}/0000feed-9999-4000-8000-${hex}.jpg`, {
      method: 'POST', headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, 'Content-Type': 'image/jpeg' }, body: shot,
    });
    const attach = await fbRpc({}, 'attach_feedback_screenshot', { p_id: firstId, p_device_id: device });
    const anonGet = await fetch(`${URL_BASE}/storage/v1/object/authenticated/carguy-feedback/${device}/${firstId}.jpg`, { headers: { apikey: ANON } });
    record(
      '28. anon uploads its row\'s screenshot, not a stray one; attach ok; cannot read it back (storage, --shared)',
      up.status === 200 && stray.status >= 400 && attach.body === true && anonGet.status >= 400,
      `upload ${up.status} · stray ${stray.status} · attach ${JSON.stringify(attach.body)} · anon read ${anonGet.status}`,
    );
    feedbackDevices.push(device, ownDevice);
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
  console.log(`delete from carguy.mod where id like 'veh_test_%${stamp}%';`);
  console.log(`delete from carguy.vehicle_share where id like 'veh_test_%${stamp}%';`);
  console.log(`delete from carguy.vehicle_member where vehicle_id like 'veh_test_%${stamp}%';`);
  console.log(`delete from carguy.vehicle_invite where vehicle_id like 'veh_test_%${stamp}%';`);
  if (feedbackDevices.length) {
    console.log(`delete from carguy.feedback where device_id in (${feedbackDevices.map((d) => `'${d}'`).join(', ')});`);
    console.log(`delete from storage.objects where bucket_id = 'carguy-feedback' and name like '${feedbackDevices[0]}/%';`);
  }
  console.log('-- and confirm nothing of Music Hub was touched:');
  console.log(`select id, email from public.profiles where email like 'carguy-test-%';`);
}

main().catch((error) => {
  console.error('Verification could not run:', error.message);
  process.exit(1);
});
