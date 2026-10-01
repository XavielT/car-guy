#!/usr/bin/env node
/**
 * Smoke test of the deployed public profile (api/u/[handle].ts, IMP 01102026 Phase 5).
 *
 *   node tools/smoke-profile.mjs <handle> [https://car-guy.vercel.app]
 *
 * Three checks, read-only: a real handle renders with its OG tags and @handle and no user id; an unknown
 * handle is a 404; ?photo=1 is a JPEG or a 404 (never HTML with a 200).
 */
const [handle, site = 'https://car-guy.vercel.app'] = process.argv.slice(2);
if (!handle) {
  console.error('usage: node tools/smoke-profile.mjs <handle> [site]');
  process.exit(2);
}
const results = [];
const check = (name, pass, detail) => {
  results.push(pass);
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? `\n      ${detail}` : ''}`);
};
const t = `t=${Date.now()}`;

const page = await fetch(`${site}/u/${handle}?${t}`);
const html = await page.text();
check(
  '1. /u/<handle> renders with og:title, the @handle, and no uuid',
  page.status === 200 && /og:title/.test(html) && html.includes(`@${handle}`) && !/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/.test(html),
  `status ${page.status} · ${html.length} bytes`,
);
const missing = await fetch(`${site}/u/zz_no_existe_${Date.now() % 100000}?${t}`);
check('2. an unknown handle is a 404', missing.status === 404, `status ${missing.status}`);
const photo = await fetch(`${site}/u/${handle}?photo=1&${t}`);
check(
  '3. ?photo=1 is a JPEG or a 404',
  (photo.status === 200 && photo.headers.get('content-type') === 'image/jpeg') || photo.status === 404,
  `status ${photo.status} · ${photo.headers.get('content-type')}`,
);
console.log(`\n${results.filter(Boolean).length}/${results.length} passed.`);
process.exitCode = results.every(Boolean) ? 0 : 1;
