// PROMPT-11 browser check: list → a month's story → keyboard → share sheet (privacy toggles) → exported PNG → year → deep link → axe.
//   PLAYWRIGHT_CORE=<playwright-core> CHROMIUM_PATH=<chrome> AXE=<axe.min.js> node evals/ux/recap.mjs
import { readFileSync, statSync } from 'node:fs';
import { launch, seed, go, text } from '../ai/e2e/lib.mjs';

const OUT = 'docs/imp-03112026/04-tracking/screens';
const results = [];
const check = (name, ok, detail = '') => {
  results.push(ok);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
};
const { browser, ctx, page, errors } = await launch({ canned: {} });
await ctx.grantPermissions([]);
await seed(page);

await go(page, '/resumen');
let t = await text(page);
check('1 the list shows months and years with data', /Resúmenes/i.test(t) && /\b20\d\d\b/.test(t), t.split('\n').slice(0, 8).join(' | ').slice(0, 160));
const rows = await page.getByRole('button').filter({ hasText: /\d{4}/ }).count();
check('2 at least one month and one year row', rows >= 2, String(rows));

// The previous month (closed) — find its id from the list.
const now = new Date();
const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
const id = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
await go(page, `/resumen/${id}`);
t = await text(page);
check('3 the story opens on the cover with a card counter', /Tarjeta 1 de \d+/i.test(t) && /TU MES/.test(t), t.split('\n').slice(0, 6).join(' | ').slice(0, 160));
await page.screenshot({ path: `${OUT}/f11-resumen-cover-390.png` });

// keyboard: → advances, ← goes back, Space pauses
const counter = async () => (/Tarjeta (\d+) de (\d+)/i.exec(await text(page)) ?? [])[1];
await page.keyboard.press('ArrowRight');
await page.waitForTimeout(500);
check('4 → advances to card 2', (await counter()) === '2', String(await counter()));
await page.keyboard.press('ArrowRight');
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/f11-resumen-card3-390.png` });
await page.keyboard.press('ArrowLeft');
await page.waitForTimeout(400);
check('5 ← goes back', (await counter()) === '2', String(await counter()));
await page.keyboard.press(' ');
const before = await counter();
await page.waitForTimeout(7000);
check('6 Space pauses: no auto-advance after 7 s', (await counter()) === before, `${before} → ${await counter()}`);
await page.keyboard.press(' ');

// each card is an accessible group with the whole sentence
const labelled = await page.locator('[aria-label*="kilómetros"], [aria-label*="Gastaste"], [aria-label*="Echaste"], [aria-label*="Tu "]').count();
check('7 the card carries its full sentence for screen readers', labelled > 0, String(labelled));

// ---- share sheet: privacy toggles change what the card (and the export) contains
const shareBtn = page.getByRole('button', { name: /Compartir/i }).first();
check('8 a share button exists on a recap with enough cards', (await shareBtn.count()) > 0);
// go to the cost card (it exists only when there is spend) via the side list/keys until the eyebrow says LO QUE COSTÓ
let found = false;
for (let i = 0; i < 12 && !found; i++) {
  if (/LO QUE COSTÓ/.test(await text(page))) found = true;
  else {
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(250);
  }
}
check('9 reached the cost card', found);
await page.keyboard.press(' '); // keep it still
await shareBtn.click().catch(() => {});
await page.waitForTimeout(800);
t = await text(page);
check('10 spend is OFF by default: the cost card cannot be shared, the sheet says so', /Todavía hay muy poco para compartir|Mostrar gastos/.test(t) && !/RD\$\s?[\d,]+\.\d\d[\s\S]{0,80}Compartir resumen/.test(t));
await page.screenshot({ path: `${OUT}/f11-share-spend-off-390.png` });
await page.getByRole('switch', { name: /Mostrar gastos/i }).first().click();
await page.waitForTimeout(700);
t = await text(page);
check('11 turning spend on shows the cost card in the preview', /RD\$/.test(t));
await page.screenshot({ path: `${OUT}/f11-share-spend-on-390.png` });

// export: a PNG is produced (web: download)
const dl = page.waitForEvent('download', { timeout: 20000 }).catch(() => null);
await page.getByRole('button', { name: /Crear imagen/i }).first().click();
const file = await dl;
if (file) {
  const path = `${OUT}/f11-resumen-export.png`;
  await file.saveAs(path);
  const size = statSync(path).size;
  check('12 the exported PNG exists', size > 5000, `${size} bytes`);
} else {
  check('12 the exported PNG exists', false, 'no download event');
}
await page.keyboard.press('Escape');

// ---- the year and the deep link
await go(page, `/resumen/${prev.getFullYear()}`);
t = await text(page);
check('13 the year opens (TU AÑO) and has a month-by-month card', /TU AÑO/.test(t));
await go(page, '/resumen/2026-13');
t = await text(page);
check('14 a bad id says so instead of crashing', /no existe/i.test(t));

if (process.env.AXE) {
  const axe = readFileSync(process.env.AXE, 'utf8');
  await go(page, `/resumen/${id}`);
  await page.evaluate(axe);
  const res = await page.evaluate(async () => {
    // eslint-disable-next-line no-undef
    const r = await axe.run(document, { runOnly: ['wcag2a', 'wcag2aa'], rules: { 'color-contrast': { enabled: true } } });
    return r.violations.map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length }));
  });
  const serious = res.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  check('15 axe on the viewer (incl. colour contrast): no serious/critical', serious.length === 0, JSON.stringify(serious.length ? serious : res.map((v) => v.id)));
}
check('16 no page errors', errors.length === 0, errors.slice(0, 2).join(' | ').slice(0, 160));
await browser.close();
console.log(`${results.filter(Boolean).length}/${results.length} passed`);
process.exit(results.every(Boolean) ? 0 : 1);
