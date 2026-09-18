#!/usr/bin/env node
/**
 * Applies one `sql/*.sql` file to x-core through the Supabase Management API.
 *
 *   node tools/apply-sql.mjs sql/002_schema_carguy.sql
 *   node tools/apply-sql.mjs sql/002_schema_carguy.sql --dry-run
 *
 * Reads `ACCESS_TOKEN` from the gitignored `.env.supabase`. The token is never
 * printed, never written anywhere, and never passed on a command line where it
 * would show up in `ps`.
 *
 * This exists instead of a curl pipeline so that the whole capability is one
 * named command: `x-core` is Music Hub's production database, and "allow Claude
 * to run this script on files under sql/" is a permission a person can reason
 * about, where "allow Claude to run curl" is not.
 *
 * Guard rails, in order:
 *   · only paths inside sql/ are accepted;
 *   · the file is printed as a summary before anything is sent;
 *   · `--dry-run` sends nothing;
 *   · a file that MODIFIES an object Music Hub owns is refused unless `--shared`
 *     is passed as well. Mentioning `auth.users` is fine — sql/002 references it
 *     for a foreign key and hangs its own `carguy_`-prefixed trigger there, both
 *     by design. Replacing `public.enforce_invite_only()` or dropping anything
 *     in `public` is not, and only sql/001 and rollback.sql may do it.
 */

import { readFileSync } from 'node:fs';
import { resolve, relative } from 'node:path';

const PROJECT_REF = 'nakgrkcqyuycadeuenuw';
const ENDPOINT = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`;

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--'));
const dryRun = args.includes('--dry-run');
const allowShared = args.includes('--shared');

if (!file) {
  console.error('usage: node tools/apply-sql.mjs <sql/file.sql> [--dry-run] [--shared]');
  process.exit(1);
}

const root = resolve(new URL('..', import.meta.url).pathname);
const target = resolve(root, file);
const rel = relative(root, target);

if (!rel.startsWith('sql/') || rel.includes('..')) {
  console.error(`Refusing ${rel}: only files under sql/ may be applied.`);
  process.exit(1);
}

function token() {
  const raw = readFileSync(resolve(root, '.env.supabase'), 'utf8');
  for (const line of raw.split('\n')) {
    const [key, ...rest] = line.split('=');
    if (key?.trim().toLowerCase() === 'access_token') return rest.join('=').trim();
  }
  throw new Error('ACCESS_TOKEN not found in .env.supabase');
}

const sql = readFileSync(target, 'utf8');

/** Comments describe; only executable lines can do anything. */
const executable = sql
  .split('\n')
  .filter((line) => !line.trim().startsWith('--'))
  .join('\n');

/**
 * What counts as touching Music Hub: replacing or dropping something in
 * `public`, or putting a trigger on `auth.users` under a name that is not ours.
 * A foreign key pointing at `auth.users` is not a modification of it.
 */
const SHARED_PATTERNS = [
  /create\s+or\s+replace\s+function\s+public\./i,
  /\bdrop\s+(table|function|trigger|schema|policy)\s+(if\s+exists\s+)?public\./i,
  /\balter\s+(table|function|schema)\s+public\./i,
  /\bdrop\s+schema\s+public\b/i,
];
const foreignTrigger = [...executable.matchAll(/create\s+trigger\s+(\w+)[\s\S]{0,120}?on\s+auth\.users/gi)]
  .map((m) => m[1])
  .filter((name) => !name.startsWith('carguy_'));

const reasons = [
  ...SHARED_PATTERNS.filter((p) => p.test(executable)).map((p) => String(p)),
  ...foreignTrigger.map((name) => `trigger '${name}' on auth.users is not carguy_-prefixed`),
];
const touchesShared = reasons.length > 0;

if (touchesShared && !allowShared) {
  console.error(`Refusing ${rel}: it modifies something Music Hub owns.`);
  for (const reason of reasons) console.error(`  · ${reason}`);
  console.error('Re-run with --shared if that is genuinely intended.');
  process.exit(1);
}

const statements = executable.split(';').filter((s) => s.trim()).length;
console.log(`file:       ${rel}`);
console.log(`statements: ~${statements}`);
console.log(`shared:     ${touchesShared ? `YES — ${reasons.join('; ')}` : 'no — carguy/storage only'}`);
console.log(`project:    ${PROJECT_REF}`);

if (dryRun) {
  console.log('\n--dry-run: nothing sent.');
  process.exit(0);
}

const response = await fetch(ENDPOINT, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token()}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ query: sql }),
});

const text = await response.text();
if (!response.ok) {
  console.error(`\nHTTP ${response.status}`);
  console.error(text.slice(0, 1200));
  process.exit(1);
}

console.log(`\nHTTP ${response.status} — applied.`);
// A DDL batch answers with an empty array; anything else is worth seeing.
if (text.trim() && text.trim() !== '[]') console.log(text.slice(0, 1200));
