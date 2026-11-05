// UX audit (SPEC-K §K0): for each top-level screen, the visible tappable elements above the fold and in total, the number of headings
// (sections), and the number of "primary" (filled accent) buttons, at 390x844 and 1280x800. Writes screenshots and a JSON table.
//   PLAYWRIGHT_CORE=<path to playwright-core> CHROMIUM_PATH=<chrome> node evals/ux/audit.mjs <label>     (label: before | after)
// The app must be running on BASE (default http://localhost:8100) with the dev seed available.
import { mkdirSync, writeFileSync } from 'node:fs';
import { launch, seed, go } from '../ai/e2e/lib.mjs';

const label = process.argv[2] || 'before';
const OUT = 'docs/imp-03112026/04-tracking/screens';
mkdirSync(OUT, { recursive: true });

const VIEWS = [
  ['390x844', { width: 390, height: 844 }],
  ['1280x800', { width: 1280, height: 800 }],
];

// Counted inside the page: visible, non-nested tappables.
const COUNT = () => {
  const sel = 'a[href], button, [role="button"], [role="link"], [role="tab"], [role="switch"], [role="checkbox"], [role="radio"], input, textarea, select, [tabindex="0"]';
  const vh = window.innerHeight;
  const vw = window.innerWidth;
  const els = [...document.querySelectorAll(sel)].filter((el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.width > 4 && r.height > 4 && cs.visibility !== 'hidden' && cs.display !== 'none' && r.right > 0 && r.left < vw && el.getAttribute('aria-hidden') !== 'true';
  });
  // A tappable inside another tappable is one target.
  const top = els.filter((el) => !els.some((o) => o !== el && o.contains(el)));
  const rects = top.map((el) => el.getBoundingClientRect());
  const above = rects.filter((r) => r.top < vh).length;
  // Primary buttons: a solid, non-transparent, accent-ish fill with text, ≥ 36px tall (what reads as "the" button).
  const primary = top.filter((el) => {
    const r = el.getBoundingClientRect();
    const bg = getComputedStyle(el).backgroundColor;
    const m = bg.match(/rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?\)/);
    if (!m || (m[4] !== undefined && Number(m[4]) < 0.9)) return false;
    const [rr, gg, bb] = [Number(m[1]), Number(m[2]), Number(m[3])];
    const sat = Math.max(rr, gg, bb) - Math.min(rr, gg, bb);
    return sat > 90 && r.height >= 36 && (el.innerText || '').trim().length > 0;
  }).length;
  const headings = document.querySelectorAll('[role="heading"], h1, h2, h3').length;
  return { total: top.length, above, primary, headings, scrollH: document.documentElement.scrollHeight };
};

const { browser, ctx, page } = await launch({ canned: {} });
await seed(page);

// The vehicle id from the garage.
await go(page, '/garaje');
await page.getByText(/TOYOTA SPRINTER TRUENO/i).first().click().catch(() => {});
await page.waitForTimeout(2500);
const vid = /vehiculo\/([^/?#]+)/.exec(page.url())?.[1] ?? 'x';

const SCREENS = [
  ['inicio', '/'],
  ['garaje', '/garaje'],
  ['historial', '/historial'],
  ['mas', '/mas'],
  ['herramientas', '/herramientas'],
  ['ficha', `/vehiculo/${vid}`],
  ['viajes', '/viajes'],
  ['conducir', '/conducir'],
  ['cifras', '/cifras'],
  ['carga-nueva', '/carga/nueva'],
  ['servicio-nuevo', '/servicio/nuevo'],
  ['gasto-nuevo', '/gasto/nuevo'],
  ['recordatorio-nuevo', '/recordatorio/nuevo'],
];

const rows = [];
for (const [vname, size] of VIEWS) {
  await page.setViewportSize(size);
  for (const [name, path] of SCREENS) {
    await go(page, path);
    const c = await page.evaluate(COUNT).catch(() => null);
    if (c) rows.push({ screen: name, view: vname, ...c });
    if (['inicio', 'mas', 'ficha'].includes(name)) await page.screenshot({ path: `${OUT}/f12-${label}-${name}-${vname.split('x')[0]}.png` });
  }
}
writeFileSync(`docs/imp-03112026/04-tracking/ux-audit-${label}.json`, JSON.stringify(rows, null, 2));
console.log('screen'.padEnd(20), 'view'.padEnd(9), 'above', 'total', 'prim', 'heads', 'height');
for (const r of rows) console.log(r.screen.padEnd(20), r.view.padEnd(9), String(r.above).padStart(5), String(r.total).padStart(5), String(r.primary).padStart(4), String(r.headings).padStart(5), String(r.scrollH).padStart(6));
await browser.close();
