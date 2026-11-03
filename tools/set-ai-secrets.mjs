#!/usr/bin/env node
/**
 * Sets the AI gateway's secrets on x-core (IMP 03112026, ADR-65, SPEC-A §A2). The company's Anthropic and Google Maps
 * keys, and the model names, become Supabase Edge Function secrets read ONLY by the `cg-*` functions. They are never
 * put in the app, the bundle or the repo.
 *
 *   node tools/set-ai-secrets.mjs --dry-run      read + validate the sources, print NAMES and LENGTHS, send nothing
 *   node tools/set-ai-secrets.mjs --check        list which secret NAMES exist on x-core (values are never readable)
 *   node tools/set-ai-secrets.mjs --apply        set them on x-core (the ONLY mode that writes; no flags = this help)
 *   node tools/set-ai-secrets.mjs --sgc-ref <ref>   also list the secret NAMES of SGC's project (read-only) to see
 *                                                     whether STT_* exist there; values cannot be copied by API
 *
 * Sources (read here, never echoed):
 *   C:\dev\SGC\ANTHROPIC_API_KEY.env           → ANTHROPIC_API_KEY      (raw value in the file)
 *   C:\dev\SGC\maps_platform_api_key.env       → GOOGLE_MAPS_API_KEY    (raw value; server use only)
 *   env STT_API_KEY / STT_PROVIDER / STT_MODEL → set when present in THIS shell (SGC's STT secrets live in its
 *                                                 Supabase project and the API never returns secret values)
 *   --with-azure                               → AZURE_SPEECH_KEY/REGION from SGC's .env.local (off by default:
 *                                                 Azure is not an SGC runtime STT path — PROMPT-00 decision D-02)
 *   CG_MODEL_VISION / CG_MODEL_REASON          → defaults claude-haiku-5-5 / claude-sonnet-5-5, or the env override
 * Override a source path with CG_SGC_DIR (default C:\dev\SGC).
 *
 * The management token comes from the gitignored `.env.supabase` (same as tools/apply-sql.mjs). Values travel in the
 * request BODY only: never argv, never a log line, never an error message. Output is `NAME set (length N)`.
 * Only names in ALLOWED_SECRET_NAMES can be set. x-core is Music Hub's database too: these secrets are shared
 * project-wide, which is why the names are `CG_*`, `ANTHROPIC_API_KEY`, `GOOGLE_MAPS_API_KEY`, `STT_*`, nothing generic.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import shapes from './lib/secret-shapes.cjs';

const { ALLOWED_SECRET_NAMES, checkReport, parseEnvVar, parseKeyFile, setLine, validateShape } = shapes;

const PROJECT_REF = 'nakgrkcqyuycadeuenuw';
const API = 'https://api.supabase.com/v1/projects';
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const sgcDir = process.env.CG_SGC_DIR || 'C:\\dev\\SGC';

const args = process.argv.slice(2);
const flag = (f) => args.includes(f);
const optValue = (f) => {
  const i = args.indexOf(f);
  return i >= 0 ? args[i + 1] : undefined;
};
const dryRun = flag('--dry-run');
const apply = flag('--apply');
const check = flag('--check');
const withAzure = flag('--with-azure');
const sgcRef = optValue('--sgc-ref');

function token() {
  const raw = readFileSync(resolve(root, '.env.supabase'), 'utf8');
  for (const line of raw.split('\n')) {
    const [key, ...rest] = line.split('=');
    if (['access_token', 'expo_supabase_access_token'].includes(key?.trim().toLowerCase())) return rest.join('=').trim();
  }
  throw new Error('ACCESS_TOKEN not found in .env.supabase');
}

async function listSecretNames(ref) {
  const res = await fetch(`${API}/${ref}/secrets`, { headers: { Authorization: `Bearer ${token()}` } });
  if (!res.ok) throw new Error(`listing secrets of ${ref} failed (HTTP ${res.status})`);
  return (await res.json()).map((s) => s.name); // the API returns name + a digest; only the name is kept
}

/** Reads one source file. Returns { value } or { skipped: reason } — never throws a message that contains content. */
function fromFile(name, file, parse = parseKeyFile) {
  if (!existsSync(file)) return { skipped: `${name}: source file not found (${file})` };
  let raw;
  try {
    raw = readFileSync(file, 'utf8');
  } catch {
    return { skipped: `${name}: source file could not be read (permission?)` };
  }
  const value = parse(raw);
  if (!value) return { skipped: `${name}: no value found in ${file}` };
  return { value };
}

function collect() {
  const picked = [];
  const skipped = [];
  const add = (name, r) => {
    if (r.skipped) return skipped.push(r.skipped);
    const bad = validateShape(name, r.value);
    if (bad) return skipped.push(bad);
    picked.push({ name, value: r.value });
  };

  add('ANTHROPIC_API_KEY', fromFile('ANTHROPIC_API_KEY', join(sgcDir, 'ANTHROPIC_API_KEY.env')));
  add('GOOGLE_MAPS_API_KEY', fromFile('GOOGLE_MAPS_API_KEY', join(sgcDir, 'maps_platform_api_key.env')));

  for (const name of ['STT_API_KEY', 'STT_PROVIDER', 'STT_MODEL']) {
    if (process.env[name]) add(name, { value: process.env[name] });
  }
  if (withAzure) {
    const envLocal = join(sgcDir, '.env.local');
    add('AZURE_SPEECH_KEY', fromFile('AZURE_SPEECH_KEY', envLocal, (raw) => parseEnvVar(raw, 'AZURE_SPEECH_KEY')));
    add('AZURE_SPEECH_REGION', fromFile('AZURE_SPEECH_REGION', envLocal, (raw) => parseEnvVar(raw, 'AZURE_SPEECH_REGION')));
  }
  add('CG_MODEL_VISION', { value: process.env.CG_MODEL_VISION || 'claude-haiku-5-5' });
  add('CG_MODEL_REASON', { value: process.env.CG_MODEL_REASON || 'claude-sonnet-5-5' });
  return { picked, skipped };
}

function usage() {
  console.log('usage: node tools/set-ai-secrets.mjs --dry-run | --check | --apply   [--with-azure] [--sgc-ref <ref>]');
  console.log('  --dry-run  read and validate the sources; print NAMES and LENGTHS; send nothing');
  console.log('  --check    list which secret NAMES exist on x-core');
  console.log('  --apply    set the secrets on x-core (the only mode that writes)');
}

async function main() {
  if (flag('--help') || flag('-h') || (!dryRun && !check && !apply)) return usage();
  if (check) {
    const names = await listSecretNames(PROJECT_REF);
    const r = checkReport(names);
    console.log(`x-core (${PROJECT_REF}) secret NAMES — values are never shown:`);
    for (const s of r.required) console.log(`  ${s.present ? 'present' : 'MISSING'}  ${s.name}  (required)`);
    for (const s of r.optional) console.log(`  ${s.present ? 'present' : 'absent '}  ${s.name}  (optional)`);
    if (r.missingRequired.length) {
      console.log(`Missing required: ${r.missingRequired.join(', ')} — run: node tools/set-ai-secrets.mjs --apply`);
      process.exit(1);
    }
    console.log('Required secrets are present.');
    return;
  }

  const { picked, skipped } = collect();
  for (const p of picked) console.log(`${dryRun ? 'would set' : 'ready    '} ${setLine(p.name, p.value)}`);
  for (const s of skipped) console.log(`skipped   ${s}`);

  if (sgcRef) {
    const names = await listSecretNames(sgcRef);
    const stt = names.filter((n) => /^STT_/.test(n) || n === 'OPENAI_API_KEY');
    console.log(`SGC project ${sgcRef}: STT-related secret NAMES present: ${stt.length ? stt.join(', ') : 'none'} (values cannot be read; to reuse one, export it in this shell as STT_API_KEY and re-run)`);
  }

  if (!picked.some((p) => p.name === 'ANTHROPIC_API_KEY')) {
    console.log('\nNo ANTHROPIC_API_KEY could be read from the SGC key file. Run this from a normal terminal where the file is readable:');
    console.log('  node tools/set-ai-secrets.mjs --apply');
    if (!dryRun) process.exit(1);
  }
  if (dryRun) {
    console.log(`\n--dry-run: nothing sent. Project: ${PROJECT_REF}`);
    return;
  }

  const body = picked.filter((p) => ALLOWED_SECRET_NAMES.includes(p.name)).map((p) => ({ name: p.name, value: p.value }));
  const res = await fetch(`${API}/${PROJECT_REF}/secrets`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    console.error(`Setting secrets failed (HTTP ${res.status}). Nothing about the request is printed.`);
    process.exit(1);
  }
  for (const p of picked) console.log(setLine(p.name, p.value));
  console.log(`Done on ${PROJECT_REF}. Verify with: node tools/set-ai-secrets.mjs --check`);
}

main().catch((e) => {
  // Only the message of errors WE throw (no values in them); never the provider body.
  console.error(`set-ai-secrets: ${e instanceof Error ? e.message : 'failed'}`);
  process.exit(1);
});
