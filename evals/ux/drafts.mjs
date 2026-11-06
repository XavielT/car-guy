// Draft autosave browser check: type into the new-expense form, leave, come back: the draft is offered, restores, and is gone after saving.
//   PLAYWRIGHT_CORE=<playwright-core> CHROMIUM_PATH=<chrome> node evals/ux/drafts.mjs      (needs the web build served on BASE, default :8100)
import { launch, seed, go, text } from '../ai/e2e/lib.mjs';

const results = [];
const check = (name, ok, detail = '') => {
  results.push(ok);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
};

const { browser, page } = await launch({ canned: {}, viewport: { width: 390, height: 844 } });
await seed(page);

await go(page, '/gasto/nuevo');
const amount = page.getByLabel('Monto (RD$)').first();
await amount.fill('1850');
await page.waitForTimeout(1600); // the autosave waits ~0.9 s after the last keystroke
await go(page, '/');
await go(page, '/gasto/nuevo');
await page.waitForTimeout(800);
check('the draft is offered when the form opens again', (await text(page)).includes('Tienes un borrador'));
await page.getByRole('button', { name: 'Recuperar borrador' }).first().click();
check('Recuperar puts the typed amount back', (await page.getByLabel('Monto (RD$)').first().inputValue()) === '1850');

await go(page, '/gasto/nuevo');
await page.waitForTimeout(800);
await page.getByRole('button', { name: 'Empezar de cero' }).first().click();
await go(page, '/gasto/nuevo');
await page.waitForTimeout(800);
check('Empezar de cero forgets it', !(await text(page)).includes('Tienes un borrador'));

await browser.close();
const ok = results.filter(Boolean).length;
console.log(`${ok}/${results.length} passed`);
process.exit(ok === results.length ? 0 : 1);
