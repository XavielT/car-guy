#!/usr/bin/env node
/**
 * AI evals against the DEPLOYED functions (IMP 03112026 SPEC-B §B8). Reads photos and sentences, calls the real
 * `cg-ai-read` / `cg-ai-intent` with a test account's own session, scores with score.cjs and prints the accuracy.
 *
 *   SMOKE_EMAIL=… SMOKE_PASSWORD=… node evals/ai/run.mjs [--only read|intent] [--real] [--bar 0.9] [--delay 400]
 *
 * · The account needs AI consent ON (Cuenta > Privacidad, or tools/smoke-ai.mjs turns it on). This script does not
 *   change consent, caps or any setting.
 * · It spends real money (a few cents for the whole set) and counts against the per-hour limit (30 by default: the
 *   full set is ~39 calls, so run `--only read` and `--only intent` in different hours or raise the limit).
 * · A rate limit / cap / kill switch stops the run and the report says it is PARTIAL.
 * · `--real` adds evals/ai/real/manifest.json (your own photos; gitignored; same shape as fixtures/manifest.json).
 * · Exit code 1 when the critical-field accuracy or the false-fill bar is missed. Writes evals/ai/results/<time>.json
 *   (gitignored). No token, no image and no API key is printed or saved.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { scoreCase, scoreIntent, summarize } = require('./score.cjs');

const argv = process.argv.slice(2);
const flag = (n) => argv.includes(n);
const opt = (n, d) => (argv.includes(n) ? argv[argv.indexOf(n) + 1] : d);
const only = opt('--only', 'all');
const bar = Number(opt('--bar', '0.9'));
const delay = Number(opt('--delay', '400'));
const FALSE_FILL_MAX = 0.1;

const eas = JSON.parse(readFileSync(join(here, '../../eas.json'), 'utf8')).build.base.env;
const URL_ = eas.EXPO_PUBLIC_SUPABASE_URL;
const ANON = eas.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const { SMOKE_EMAIL, SMOKE_PASSWORD } = process.env;
if (!SMOKE_EMAIL || !SMOKE_PASSWORD) {
  console.error('usage: SMOKE_EMAIL=<test account> SMOKE_PASSWORD=<password> node evals/ai/run.mjs [--only read|intent] [--real]');
  process.exit(2);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const STOP_CODES = new Set(['rate_user', 'cap_user_day', 'cap_global_day', 'ai_disabled', 'ai_not_configured', 'sin_consentimiento_ia', 'no_auth', 'sesion_invalida']);

async function signIn() {
  const r = await fetch(`${URL_}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON, 'content-type': 'application/json' },
    body: JSON.stringify({ email: SMOKE_EMAIL, password: SMOKE_PASSWORD }),
  });
  if (!r.ok) throw new Error(`sign-in failed (HTTP ${r.status})`);
  return (await r.json()).access_token;
}

async function call(token, fn, body) {
  const r = await fetch(`${URL_}/functions/v1/${fn}`, {
    method: 'POST',
    headers: { apikey: ANON, authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await r.json().catch(() => ({}));
  return { status: r.status, json };
}

const pct = (x) => (x == null ? '  n/a' : `${(x * 100).toFixed(1)}%`.padStart(6));
const wrong = (verdicts) =>
  Object.entries(verdicts)
    .filter(([, v]) => v.verdict !== 'correct' && v.verdict !== 'correct_null')
    .map(([k, v]) => `${k}:${v.verdict}`);

class Stop extends Error {}

async function runRead(token, manifestPath, baseDir, label) {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const cases = [];
  for (const c of manifest.cases) {
    const images = c.images.map((p) => ({ data: readFileSync(join(baseDir, p)).toString('base64'), mime: 'image/jpeg' }));
    const { status, json } = await call(token, 'cg-ai-read', { kind: c.kind, images });
    if (!(status === 200 && json.ok)) {
      const code = json.error_code ?? `http_${status}`;
      console.log(`  ${label}/${c.id}: ${code}`);
      if (STOP_CODES.has(code)) throw new Stop(code);
      cases.push({ id: c.id, kind: c.kind, critical: c.critical, verdicts: scoreCase(c.expected, null), error: code });
    } else {
      const got = { ...json.fields };
      if ('items_count' in c.expected) got.items_count = { value: (json.items ?? []).length, confidence: 1 };
      const verdicts = scoreCase(c.expected, got);
      cases.push({ id: c.id, kind: c.kind, critical: c.critical, verdicts, model: json.model });
      const bad = wrong(verdicts);
      console.log(`  ${label}/${c.id.padEnd(34)} ${bad.length ? bad.join(' ') : 'all fields right'}`);
    }
    await sleep(delay);
  }
  return cases;
}

async function runIntent(token) {
  const fx = JSON.parse(readFileSync(join(here, 'fixtures/intents.json'), 'utf8'));
  const cases = [];
  let targetOk = 0;
  for (const c of fx.cases) {
    const vehicles = c.cars === 'two' ? fx.twoCars : fx.context.vehicles;
    const { status, json } = await call(token, 'cg-ai-intent', { text: c.text, context: { ...fx.context, vehicles } });
    if (!(status === 200 && json.ok)) {
      const code = json.error_code ?? `http_${status}`;
      console.log(`  intent/${c.id}: ${code}`);
      if (STOP_CODES.has(code)) throw new Stop(code);
      cases.push({ id: c.id, kind: 'intent', verdicts: scoreCase(c.expected.fields ?? {}, null), targetOk: false, error: code });
      await sleep(delay);
      continue;
    }
    const r = scoreIntent(c.expected, json);
    let extra = '';
    if ('vehicle' in c.expected) {
      const v = json.vehicle?.id ?? null;
      const choices = Array.isArray(json.choices) && json.choices.length > 1;
      const ok = c.expected.choices ? choices && v === null : v === c.expected.vehicle;
      if (!ok) extra = ` vehicle:${v ?? (choices ? 'choices' : 'none')}`;
      r.targetOk = r.targetOk && ok;
    }
    if (r.targetOk) targetOk++;
    cases.push({ id: c.id, kind: 'intent', verdicts: r.verdicts, targetOk: r.targetOk });
    console.log(`  intent/${c.id.padEnd(22)} target ${r.targetOk ? 'ok ' : `WRONG (${json.target})`}${extra} ${wrong(r.verdicts).join(' ')}`);
    await sleep(delay);
  }
  return { cases, targetOk, total: fx.cases.length };
}

const report = { at: new Date().toISOString(), partial: null, read: null, intent: null };
let failed = false;
try {
  const token = await signIn();
  if (only === 'all' || only === 'read') {
    console.log('READ (cg-ai-read)');
    const cases = await runRead(token, join(here, 'fixtures/manifest.json'), join(here, 'fixtures'), 'synthetic');
    const real = join(here, 'real/manifest.json');
    if (flag('--real') && existsSync(real)) cases.push(...(await runRead(token, real, join(here, 'real'), 'real')));
    report.read = { summary: summarize(cases), cases };
  }
  if (only === 'all' || only === 'intent') {
    console.log('INTENT (cg-ai-intent)');
    const r = await runIntent(token);
    report.intent = { targetAccuracy: r.targetOk / r.total, summary: summarize(r.cases), cases: r.cases };
  }
} catch (e) {
  if (e instanceof Stop) {
    report.partial = e.message;
    console.log(`\nSTOPPED: ${e.message}. The numbers below cover only the cases that ran.`);
  } else {
    console.error(`eval failed: ${e.message}`);
    process.exit(2);
  }
}

console.log('\n──────── RESULT ────────');
if (report.partial) console.log(`PARTIAL (stopped on ${report.partial})`);
if (report.read) {
  const s = report.read.summary;
  console.log(`read    fields in photo ${s.fields} · accuracy ${pct(s.accuracy)} · confident-only ${pct(s.confidentAccuracy)} · critical ${pct(s.criticalAccuracy)} · false fills ${pct(s.falseFillRate)}`);
  for (const [k, v] of Object.entries(s.perField).sort()) console.log(`        ${k.padEnd(14)} ${v.correct}/${v.n}`);
  if (s.criticalAccuracy != null && s.criticalAccuracy < bar) failed = true;
  if (s.falseFillRate != null && s.falseFillRate > FALSE_FILL_MAX) failed = true;
}
if (report.intent) {
  const t = report.intent;
  console.log(`intent  target ${pct(t.targetAccuracy)} · field accuracy ${pct(t.summary.accuracy)} · false fills ${pct(t.summary.falseFillRate)}`);
  if (t.targetAccuracy < bar) failed = true;
  if (t.summary.falseFillRate != null && t.summary.falseFillRate > FALSE_FILL_MAX) failed = true;
}
console.log(`bar: critical/target ≥ ${bar * 100}% and false fills ≤ ${FALSE_FILL_MAX * 100}%  →  ${report.partial ? 'INCOMPLETE' : failed ? 'MISSED' : 'MET'}`);

mkdirSync(join(here, 'results'), { recursive: true });
const file = join(here, 'results', `${report.at.replace(/[:.]/g, '-')}.json`);
writeFileSync(file, JSON.stringify(report, null, 2));
console.log(`saved ${file}`);
process.exit(failed ? 1 : 0);
