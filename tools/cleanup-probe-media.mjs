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
 *   · only the `carguy-media` bucket
 *   · only object names containing `sync_probe_`
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
async function list(prefix) {
  const { body } = await api(`/object/list/${BUCKET}`, {
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
  const entries = prefix ? await list(prefix) : [folder];
  for (const entry of entries) {
    const name = `${prefix}${entry.name}`;
    (name.includes(MARKER) ? targets : skipped).push(name);
  }
}

console.log(`bucket ${BUCKET} · ${targets.length + skipped.length} object(s)\n`);
for (const name of targets) console.log(`  probe   ${name}`);
for (const name of skipped) console.log(`  keep    ${name}`);

if (!targets.length) {
  console.log('\nNothing to remove.');
  process.exit(0);
}

if (!apply) {
  console.log(`\n${targets.length} probe object(s) would be removed. Re-run with --delete.`);
  process.exit(0);
}

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
