#!/usr/bin/env node
/**
 * Smoke test of the public legal pages (IMP 30092026 note 15, ADR-47):
 * /terminos, /privacidad, /eliminar-cuenta answer 200 as HTML, carry LEGAL_VERSION in the raw HTML
 * (no JS needed — store reviewers and crawlers read it as served) and both languages; /api/eliminar-cuenta
 * answers GET with { configured } (whether the login can be removed there — informational).
 *
 *   node tools/smoke-legal.mjs [https://car-guy.vercel.app]
 *   node tools/smoke-legal.mjs http://localhost:8112      (dev server: the pages are /<doc>.html there)
 *
 * Read-only: no account, no write. Exit 1 on any FAIL.
 */
import { readFileSync } from 'node:fs';

const SITE = (process.argv[2] ?? 'https://car-guy.vercel.app').replace(/\/$/, '');
const VERSION = /LEGAL_VERSION = '([^']+)'/.exec(readFileSync(new URL('../lib/legal/index.ts', import.meta.url), 'utf8'))?.[1];
const local = /localhost|127\.0\.0\.1/.test(SITE);
const DOCS = [
  ['terminos', 'Términos de uso', 'Terms of Use'],
  ['privacidad', 'Política de privacidad', 'Privacy Policy'],
  ['eliminar-cuenta', 'Eliminar tu cuenta', 'Delete your Car Guy account'],
];
const results = [];
const check = (name, pass, detail) => {
  results.push(pass);
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? `\n      ${detail}` : ''}`);
};

console.log(`legal smoke · ${SITE} · version ${VERSION}\n`);
if (!VERSION) {
  console.log('FAIL  LEGAL_VERSION not found in lib/legal/index.ts');
  process.exit(1);
}

for (const [doc, es, en] of DOCS) {
  // The dev server has no cleanUrls; Vercel serves /<doc> from <doc>.html.
  const url = `${SITE}/${doc}${local ? '.html' : ''}?t=${Date.now()}`;
  let status = 0;
  let type = '';
  let html = '';
  try {
    const r = await fetch(url, { redirect: 'follow', headers: { 'User-Agent': 'car-guy-smoke-legal' } });
    status = r.status;
    type = r.headers.get('content-type') ?? '';
    html = await r.text();
  } catch (e) {
    html = String(e?.message ?? e);
  }
  check(
    `/${doc} → 200 text/html, version ${VERSION}, both languages`,
    status === 200 && /text\/html/.test(type) && html.includes(VERSION) && html.includes(es) && html.includes(en) && html.includes('data-lang="en"'),
    `status ${status} · ${type || 'no content-type'} · ${html.length} bytes${html.includes(VERSION) ? '' : ' · version missing'}`,
  );
  check(`/${doc} carries no "not legal advice" draft note`, !/asesor[ií]a legal|legal advice/i.test(html));
}

try {
  const r = await fetch(`${SITE}/api/eliminar-cuenta`, { headers: { Accept: 'application/json' } });
  const body = await r.json().catch(() => null);
  const ok = r.status === 200 && typeof body?.configured === 'boolean';
  console.log(`${ok ? 'INFO' : 'WARN'}  /api/eliminar-cuenta GET → ${r.status} ${JSON.stringify(body)}${body?.configured === false ? ' (no SUPABASE_SERVICE_ROLE_KEY: logins are removed from Admin → Cuentas por eliminar)' : ''}`);
} catch (e) {
  console.log(`WARN  /api/eliminar-cuenta unreachable (${e?.message ?? e})${local ? ' — expected on the dev server' : ''}`);
}

const failed = results.filter((p) => !p).length;
console.log(`\n${results.length - failed}/${results.length} passed.`);
process.exit(failed ? 1 : 0);
