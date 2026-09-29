#!/usr/bin/env node
/**
 * Removes probe objects left in the `carguy-media` bucket by verify-sync.
 *
 *   node tools/cleanup-probe-media.mjs          # list what it would remove
 *   node tools/cleanup-probe-media.mjs --delete # remove them
 *
 * `sql/999` cannot do this: Supabase installs `storage.protect_delete()` on
 * storage.objects and rejects any direct delete with 42501, precisely so bytes
 * are never orphaned by a row disappearing. The Storage API is the only way in,
 * and reaching another user's folder needs the service-role key.
 *
 * Scoped hard, and deliberately so — this key can see Music Hub's buckets too:
 *   · only the `carguy-media` and `carguy-public` buckets
 *   · in carguy-media: object names containing `sync_probe_`, and the
 *     `v/<vehicle_id>/` folders of test vehicles (`veh_test_*`, `sync_probe_*`)
 *   · with --orphans: `<user_id>/` folders whose account no longer exists in
 *     auth.users (a deleted test user's photos — the account cascade removes
 *     rows, never Storage bytes)
 *   · in carguy-public: slug folders no live vehicle_share points at (a test
 *     share whose row was deleted, or a revoke that could not finish)
 * Anything else is listed and skipped. Read the listing before passing --delete.
 */

import { readFileSync } from 'node:fs';

const BUCKET = 'carguy-media';
const MARKER = 'sync_probe_';

function loadEnv(file) {
  const env = {};
  const text = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return env;
}

const local = loadEnv('.env.local');
// The service-role key lives only in .env.supabase, which is gitignored and
// never bundled (04-conventions.md keeps it out of the repo proper).
const secrets = loadEnv('.env.supabase');

const URL_BASE = local.EXPO_PUBLIC_SUPABASE_URL;
const KEY =
  secrets.SUPABASE_SERVICE_ROLE_KEY ?? secrets.SERVICE_ROLE_KEY ?? secrets.SUPABASE_SECRET_KEY;

if (!URL_BASE || !KEY) {
  console.error('Need EXPO_PUBLIC_SUPABASE_URL (.env.local) and a service-role key (.env.supabase).');
  process.exit(1);
}

const apply = process.argv.includes('--delete');
const orphans = process.argv.includes('--orphans');

/** Every account id, through the admin API (paginated). Read-only. */
async function userIds() {
  const ids = new Set();
  for (let page = 1; page < 100; page++) {
    const r = await fetch(`${URL_BASE}/auth/v1/admin/users?page=${page}&per_page=1000`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } });
    const body = await r.json();
    const users = body.users ?? [];
    for (const u of users) ids.add(u.id);
    if (users.length < 1000) break;
  }
  return ids;
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const accounts = orphans ? await userIds() : null;
if (orphans) console.log(`orphans mode: ${accounts.size} account(s) exist`);

async function api(path, init = {}) {
  const response = await fetch(`${URL_BASE}/storage/v1${path}`, {
    ...init,
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  const text = await response.text();
  try {
    return { status: response.status, body: JSON.parse(text) };
  } catch {
    return { status: response.status, body: text };
  }
}

/** One level at a time: Storage's list is per-prefix, not recursive. */
async function list(prefix, bucket = BUCKET) {
  const { body } = await api(`/object/list/${bucket}`, {
    method: 'POST',
    body: JSON.stringify({ prefix, limit: 1000, offset: 0 }),
  });
  return Array.isArray(body) ? body : [];
}

const folders = await list('');
const targets = [];
const skipped = [];

for (const folder of folders) {
  // A folder entry has no id; a file at the root does. Neither should hold a
  // probe object at the root, but list both so nothing is invisible.
  const prefix = folder.id ? '' : `${folder.name}/`;
  if (prefix === 'v/') {
    // Phase 7 layout: v/<vehicle_id>/<media>.jpg — a test vehicle's folder goes whole.
    for (const vehicle of await list('v/')) {
      const test = /^(veh_test_|sync_probe_)/.test(vehicle.name);
      for (const entry of await list(`v/${vehicle.name}/`)) {
        const name = `v/${vehicle.name}/${entry.name}`;
        (test || name.includes(MARKER) ? targets : skipped).push(name);
      }
    }
    continue;
  }
  const orphanFolder = Boolean(accounts && prefix && UUID.test(folder.name) && !accounts.has(folder.name));
  const entries = prefix ? await list(prefix) : [folder];
  for (const entry of entries) {
    const name = `${prefix}${entry.name}`;
    (name.includes(MARKER) || orphanFolder ? targets : skipped).push(name);
  }
}

// carguy-public: slug folders without a live share row.
const PUBLIC = 'carguy-public';
const shares = await fetch(`${URL_BASE}/rest/v1/vehicle_share?select=slug&slug=not.is.null&revoked_at=is.null`, {
  headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Accept-Profile': 'carguy' },
}).then((r) => r.json());
const live = new Set(Array.isArray(shares) ? shares.map((r) => r.slug) : []);
const publicTargets = [];
if (!Array.isArray(shares)) console.log(`carguy-public skipped: could not read vehicle_share (${JSON.stringify(shares).slice(0, 120)})`);
else {
  for (const folder of await list('', PUBLIC)) {
    if (folder.id || live.has(folder.name)) continue;
    for (const entry of await list(`${folder.name}/`, PUBLIC)) publicTargets.push(`${folder.name}/${entry.name}`);
  }
  console.log(`bucket ${PUBLIC} · ${live.size} live slug(s) · ${publicTargets.length} orphaned object(s)`);
  for (const name of publicTargets) console.log(`  orphan  ${name}`);
}

console.log(`bucket ${BUCKET} · ${targets.length + skipped.length} object(s)\n`);
for (const name of targets) console.log(`  probe   ${name}`);
for (const name of skipped) console.log(`  keep    ${name}`);

if (!targets.length && !publicTargets.length) {
  console.log('\nNothing to remove.');
  process.exit(0);
}

if (!apply) {
  console.log(`\n${targets.length + publicTargets.length} object(s) would be removed. Re-run with --delete.`);
  process.exit(0);
}

if (publicTargets.length) {
  const r = await api(`/object/${PUBLIC}`, { method: 'DELETE', body: JSON.stringify({ prefixes: publicTargets }) });
  console.log(`\nDELETE ${PUBLIC} → ${r.status}`);
}
if (!targets.length) process.exit(0);

const { status, body } = await api(`/object/${BUCKET}`, {
  method: 'DELETE',
  body: JSON.stringify({ prefixes: targets }),
});
console.log(`\nDELETE → ${status}`);
if (status !== 200) {
  console.error(JSON.stringify(body).slice(0, 300));
  process.exit(1);
}
console.log(`Removed ${targets.length} probe object(s).`);
