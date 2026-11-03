#!/usr/bin/env node
/**
 * Two checks over an APK or an exported bundle:
 *
 *  1. PRESENT  — the bundle carries the Supabase project URL. Refuses an APK built without it: the 2.1.0–2.1.2
 *     mistake (IMP 29092026 note 13), where the app then said "cuenta no disponible" to every user.
 *  2. FORBIDDEN — the bundle carries NO secret. IMP 03112026 (ADR-65): the company's Anthropic / Google / STT keys
 *     live only as Edge Function secrets of x-core; anything an APK or a web bundle holds can be unpacked by anyone.
 *     A hit is `sk-ant-…`, an `AIza…` Google key, a service-role JWT, or the NAME of a server-only secret
 *     (ANTHROPIC_API_KEY, GOOGLE_MAPS_API_KEY, STT_API_KEY, AZURE_SPEECH…, SUPABASE_SERVICE_ROLE…).
 *     Only the name and the file are printed — never the matched value.
 *
 *   node tools/check-bundle-env.mjs releases/car-guy-v2.1.3.apk
 *   node tools/check-bundle-env.mjs dist/                       # after `npx expo export`
 *   node tools/check-bundle-env.mjs dist/ --forbidden-only      # web build: skip check 1 (Vercel may not carry the env)
 *
 * The project ref comes from eas.json `build.base.env` (the public URL), so the check needs no secrets. Hermes
 * bytecode keeps string literals readable, so a byte search on `assets/index.android.bundle` is enough.
 * Exit 0 = clean, 1 = a check failed, 2 = bad usage.
 */
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const target = args.find((a) => !a.startsWith('--'));
const forbiddenOnly = args.includes('--forbidden-only');
if (!target) {
  console.error('usage: node tools/check-bundle-env.mjs <file.apk | bundle | export-dir> [--forbidden-only]');
  process.exit(2);
}

/** Server-only secret NAMES: if one appears in a client bundle, a server value is being referenced from the client. */
export const FORBIDDEN_NAMES = [
  'ANTHROPIC_API_KEY',
  'GOOGLE_MAPS_API_KEY',
  'STT_API_KEY',
  'OPENAI_API_KEY',
  'AZURE_SPEECH',
  'SUPABASE_SERVICE_ROLE',
  'SERVICE_ROLE_KEY',
  'BOVEDA_MASTER_KEY',
  'WHATSAPP_TOKEN',
];

/** Value shapes. Each regex is matched against the bundle as latin1 text; the match itself is never printed. */
export const FORBIDDEN_SHAPES = [
  { label: 'Anthropic key (sk-ant-…)', re: /sk-ant-[A-Za-z0-9_-]{16,}/ },
  { label: 'Google API key (AIza…)', re: /AIza[0-9A-Za-z_-]{35}/ },
  { label: 'OpenAI/Groq-style key (sk-… / gsk_…)', re: /\b(?:sk-(?:proj-)?[A-Za-z0-9_-]{32,}|gsk_[A-Za-z0-9]{32,})/ },
  { label: 'private key block', re: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
];

/** A JWT whose payload says role=service_role is the one Supabase key that must never ship. */
function hasServiceRoleJwt(text) {
  const re = /eyJ[A-Za-z0-9_-]{8,}\.(eyJ[A-Za-z0-9_-]{8,})\.[A-Za-z0-9_-]{8,}/g;
  for (const m of text.matchAll(re)) {
    try {
      const payload = JSON.parse(Buffer.from(m[1], 'base64url').toString('utf8'));
      if (payload && payload.role === 'service_role') return true;
    } catch {
      /* not a JWT payload */
    }
  }
  return false;
}

/** What is forbidden in one file: a list of human labels (names/shapes), never values. */
export function forbiddenIn(bytes) {
  const text = bytes.toString('latin1');
  const hits = [];
  for (const name of FORBIDDEN_NAMES) if (text.includes(name)) hits.push(`secret name ${name}`);
  for (const { label, re } of FORBIDDEN_SHAPES) if (re.test(text)) hits.push(label);
  if (hasServiceRoleJwt(text)) hits.push('Supabase service-role JWT');
  return hits;
}

/** Every JS/HBC/HTML bundle the target holds, as buffers. */
function bundles(path) {
  if (statSync(path).isDirectory()) {
    const out = [];
    const walk = (dir) => {
      for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) walk(full);
        else if (/\.(js|hbc|bundle|html|json|map)$/.test(name)) out.push({ name: full, bytes: readFileSync(full) });
      }
    };
    walk(path);
    return out;
  }
  if (path.endsWith('.apk')) {
    const bytes = execFileSync('unzip', ['-p', path, 'assets/index.android.bundle'], { maxBuffer: 512 * 1024 * 1024 });
    return [{ name: `${path}!assets/index.android.bundle`, bytes }];
  }
  return [{ name: path, bytes: readFileSync(path) }];
}

const all = bundles(target);
let failed = false;

// 2. FORBIDDEN (always).
const leaks = all.map((b) => ({ name: b.name, hits: forbiddenIn(b.bytes) })).filter((b) => b.hits.length);
if (leaks.length) {
  failed = true;
  for (const l of leaks) console.error(`✗ ${l.name}: ${l.hits.join('; ')} — a server secret must never be in a client bundle (ADR-65). Do not release it.`);
} else {
  console.log(`✓ ${target}: no server secret (names or values) in ${all.length} file(s)`);
}

// 1. PRESENT (unless --forbidden-only).
if (!forbiddenOnly) {
  const eas = JSON.parse(readFileSync(new URL('../eas.json', import.meta.url), 'utf8'));
  const url = eas?.build?.base?.env?.EXPO_PUBLIC_SUPABASE_URL ?? '';
  const ref = url.match(/^https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];
  if (!ref) {
    console.error('eas.json build.base.env.EXPO_PUBLIC_SUPABASE_URL is missing or not a supabase.co URL');
    process.exit(2);
  }
  const found = all.filter((b) => b.bytes.includes(Buffer.from(`${ref}.supabase.co`)));
  if (!found.length) {
    console.error(`✗ ${target}: no "${ref}.supabase.co" in the bundle — built without EXPO_PUBLIC_SUPABASE_URL. Do not release it.`);
    failed = true;
  } else {
    console.log(`✓ ${target}: the bundle carries ${ref}.supabase.co (${found.map((b) => b.name).join(', ')})`);
  }
}

process.exit(failed ? 1 : 0);
