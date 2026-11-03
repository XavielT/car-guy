#!/usr/bin/env node
/**
 * Deploys Car Guy's Edge Functions to x-core (IMP 03112026, PROMPT-01 step 6). x-core is Music Hub's project too, so:
 *   · only functions named `cg-*` that exist under supabase/functions/ can be deployed (new names only; it never
 *     touches a function Music Hub or xaviel-web owns);
 *   · `--dry-run` prints what would be deployed and sends nothing;
 *   · the management token comes from the gitignored `.env.supabase` and reaches the Supabase CLI through the CHILD's
 *     environment (SUPABASE_ACCESS_TOKEN), never argv, never a log line.
 *
 *   node tools/deploy-edge.mjs cg-ai-status cg-ai-ping --dry-run
 *   node tools/deploy-edge.mjs cg-ai-status cg-ai-ping --yes     (--yes = confirm the hosted deploy, required by the CLI)
 *
 * Functions authenticate themselves (the user's JWT is checked in code, the SGC pattern), so they deploy with
 * --no-verify-jwt: that keeps cg-ai-status answerable signed out and avoids the legacy-JWT-secret gateway check.
 * `--use-api` bundles on Supabase's side, so Docker is not needed on this machine.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT_REF = 'nakgrkcqyuycadeuenuw';
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
// The Supabase CLI refuses a non-interactive hosted deploy unless it is confirmed with --yes. We never add it
// implicitly: the person running this tool (or the one who asked for it) opts in with `--yes`.
const confirmed = args.includes('--yes');
const names = args.filter((a) => !a.startsWith('--'));

if (names.length === 0) {
  console.error('usage: node tools/deploy-edge.mjs <cg-function> [<cg-function> …] [--dry-run]');
  process.exit(1);
}
for (const n of names) {
  if (!/^cg-[a-z0-9-]{2,40}$/.test(n)) {
    console.error(`Refusing "${n}": only functions named cg-* may be deployed to x-core.`);
    process.exit(1);
  }
  if (!existsSync(resolve(root, 'supabase', 'functions', n, 'index.ts'))) {
    console.error(`Refusing "${n}": supabase/functions/${n}/index.ts does not exist.`);
    process.exit(1);
  }
}

function token() {
  const raw = readFileSync(resolve(root, '.env.supabase'), 'utf8');
  for (const line of raw.split('\n')) {
    const [key, ...rest] = line.split('=');
    if (['access_token', 'expo_supabase_access_token'].includes(key?.trim().toLowerCase())) return rest.join('=').trim();
  }
  throw new Error('ACCESS_TOKEN not found in .env.supabase');
}

for (const n of names) {
  const cmd = ['--yes', 'supabase@latest', 'functions', 'deploy', n, '--project-ref', PROJECT_REF, '--use-api', '--no-verify-jwt', ...(confirmed ? ['--yes'] : [])];
  console.log(`${dryRun ? 'would deploy' : 'deploying   '} ${n} → ${PROJECT_REF}   (npx ${cmd.join(' ')})`);
  if (dryRun) continue;
  const r = spawnSync('npx', cmd, {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, SUPABASE_ACCESS_TOKEN: token() },
  });
  if (r.status !== 0) {
    console.error(`Deploying ${n} failed (exit ${r.status}).`);
    process.exit(r.status ?? 1);
  }
}
console.log(dryRun ? '--dry-run: nothing deployed.' : 'Done. Log it in docs/imp-03112026/04-tracking/PROGRESS.md → Edge Functions / SQL deployed.');
