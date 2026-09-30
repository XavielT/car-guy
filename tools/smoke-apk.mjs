#!/usr/bin/env node
/**
 * Smoke test of the APK distribution on a deployed site (IMP 29092026 Phase 7,
 * ADR-34). Read-only: no account, nothing written.
 *
 *   node tools/smoke-apk.mjs [https://car-guy.vercel.app]
 *
 * 1) /api/apk answers with the version of GitHub's latest release,
 * 2) its url (and the stable releases/latest/download link) resolves to a 200,
 * 3) /instalar is served and its bundle carries the page (title + button copy).
 */
const SITE = (process.argv[2] ?? 'https://car-guy.vercel.app').replace(/\/$/, '');
const results = [];
const check = (name, pass, detail) => {
  results.push(pass);
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? `\n      ${detail}` : ''}`);
};

const gh = await fetch('https://api.github.com/repos/XavielT/car-guy/releases/latest', {
  headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'car-guy-smoke' },
}).then((r) => (r.ok ? r.json() : null), () => null);
const latest = gh?.tag_name?.replace(/^v/i, '') ?? null;

let apk = null;
try {
  const r = await fetch(`${SITE}/api/apk?t=${Date.now()}`);
  apk = r.ok ? await r.json() : null;
  check('/api/apk = latest release', apk != null && apk.version === latest, `api ${apk?.version ?? r.status} · github ${latest} · cache ${r.headers.get('cache-control')}`);
} catch (e) {
  check('/api/apk = latest release', false, String(e));
}

const resolves = async (url) => {
  try {
    const r = await fetch(url, { method: 'HEAD', redirect: 'follow' });
    return { ok: r.ok, status: r.status, host: new URL(r.url).host };
  } catch (e) {
    return { ok: false, status: String(e), host: '' };
  }
};
const direct = apk?.url ? await resolves(apk.url) : { ok: false, status: 'no url', host: '' };
const stable = await resolves('https://github.com/XavielT/car-guy/releases/latest/download/car-guy.apk');
check('download resolves', direct.ok && stable.ok, `api url ${direct.status} @ ${direct.host} · stable ${stable.status} @ ${stable.host}`);

// The static export serves the app shell for every route (the screen renders
// once the local database opens), so the page's copy is looked for in its bundle.
try {
  const r = await fetch(`${SITE}/instalar`);
  const html = await r.text();
  const scripts = [...html.matchAll(/<script[^>]+src="([^"]+\.js)"/g)].map((m) => new URL(m[1], SITE).href);
  let found = false;
  for (const src of scripts) {
    const js = await fetch(src).then((x) => x.text(), () => '');
    if (js.includes('Car Guy para Android') && js.includes('Descargar APK')) found = true;
  }
  check('/instalar renders', r.ok && found, `status ${r.status} · ${scripts.length} bundle(s) · copy ${found ? 'found' : 'missing'}`);
} catch (e) {
  check('/instalar renders', false, String(e));
}

const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
