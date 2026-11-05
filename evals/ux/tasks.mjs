// SPEC-K §K8 browser check: the 15 everyday tasks (taps from a cold start on Hoy), the structure of Hoy, "Todas las funciones" = the registry,
// and axe on Hoy / Mi carro / Más. Mocked network, seeded garage (see evals/ai/e2e/lib.mjs).
//   PLAYWRIGHT_CORE=<playwright-core> CHROMIUM_PATH=<chrome> AXE=<axe.min.js> node evals/ux/tasks.mjs [390|1280]
import { readFileSync } from 'node:fs';
import { launch, seed, go, text } from '../ai/e2e/lib.mjs';

const WIDTH = Number(process.argv[2] || 390);
const SIZE = WIDTH >= 1024 ? { width: 1280, height: 800 } : { width: 390, height: 844 };
const results = [];
const check = (name, ok, detail = '') => {
  results.push(ok);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
};

const { browser, page, errors } = await launch({ canned: {}, viewport: SIZE });
await seed(page);
await page.setViewportSize(SIZE);

const home = async () => {
  await go(page, '/');
};
// Screens underneath a pushed one stay mounted but hidden: only a visible button can be tapped.
const btn = (name) => page.getByRole('button', { name }).locator('visible=true').first();
const tap = async (locator) => {
  await locator.click({ timeout: 8000 });
  await page.waitForTimeout(900);
};
/** A task: its taps, then what must be true. `max` is the SPEC-K §K0 ceiling. */
async function task(name, max, steps, done) {
  await home();
  let taps = 0;
  try {
    for (const s of steps) {
      await tap(s());
      taps++;
    }
    const ok = await done();
    check(`${name} — ${taps} tap${taps === 1 ? '' : 's'} (max ${max})`, ok && taps <= max, ok ? '' : 'did not arrive');
  } catch (e) {
    check(`${name} (max ${max})`, false, String(e.message).split('\n')[0].slice(0, 110));
  }
}
const urlHas = (re) => async () => re.test(page.url());
const textHas = (re) => async () => re.test(await text(page));
// On a wide screen the rail's labels double some names; always look inside the page area for those.
const more = () => btn(/Todo lo demás/);

// ---- the 15 tasks
await task('1 cargar gasolina', 2, [() => btn(/Cargar gasolina/)], urlHas(/carga\/nueva/));
await task('2 iniciar un viaje', 2, [() => btn(/Iniciar viaje/)], textHas(/ubicaci|permiso|viaje/i));
await task('3 ver mis viajes', 2, [() => page.getByText(/^conducir$/i).last(), () => page.getByText(/VER VIAJES/i).first()], urlHas(/\/viajes/));
await task('4 registrar un servicio', 2, [() => btn(/Registrar servicio/)], urlHas(/servicio\/nuevo/));
await task('5 registrar una reparación', 2, [more, () => btn(/Registrar reparaci/)], urlHas(/servicio\/nuevo/));
await task('6 ver cuánto gasté este mes', 2, [() => btn(/Este mes/)], textHas(/GASTO/));
await task('7 poner un recordatorio (marbete)', 2, [() => btn(/Aceite de motor y filtro/), () => btn(/NUEVO RECORDATORIO/i)], urlHas(/recordatorio\/nuevo/));
await task('8 guardar un documento', 2, [() => btn(/Marbete y seguro/), () => btn(/NUEVO DOCUMENTO/i)], urlHas(/documento\/nuevo/));
await task('9 ver el último kilometraje', 3, [], async () => (await page.getByLabel(/Odómetro 5\d,\d{3} km/).count()) > 0 || /52,400/.test(await text(page)));
await task('10 ver estadísticas de mi carro', 3, [() => btn(/Este mes/)], urlHas(/cifras/));
await task('11 agregar una modificación', 3, [more, () => btn(/Agregar modificaci/)], urlHas(/mod\/nuevo/));
await task('12 subir fotos', 3, [more, () => btn(/Agregar fotos/)], textHas(/foto|álbum|permiso|importar/i));
await task('13 ver el resumen del mes', 3, [() => btn(/Este mes/)], textHas(/GASTO|RESUMEN|KM/i));
await task('14 compartir mi garaje', 3, [more, () => btn(/^Mi carro/), () => btn(/^Compartir/i)], urlHas(/compartidos|compartir/));
await task('15 escanear un código OBD', 3, [() => btn(/Check engine/)], urlHas(/obd/));

// ---- search: any function in 2 taps (icon, then the result), typing is not a tap
await home();
try {
  await tap(btn(/Buscar/));
  await page.keyboard.type('gasolina');
  await page.waitForTimeout(700);
  await tap(btn(/Cargar gasolina/));
  check('search: "gasolina" → fuel in 2 taps', /carga\/nueva/.test(page.url()));
} catch (e) {
  check('search: "gasolina" → fuel in 2 taps', false, String(e.message).split('\n')[0].slice(0, 100));
}

// ---- Hoy: structure
await home();
const t = await text(page);
const bigLabels = [/Cargar gasolina/, /Iniciar viaje|Ver el viaje/, /Registrar servicio/, /Todo lo demás/];
let bigCount = 0;
for (const re of bigLabels) bigCount += await page.getByRole('button', { name: re }).count();
check('Hoy has ≤ 4 big actions', bigCount >= 1 && bigCount <= 4, String(bigCount));
check('Hoy has exactly one next-step card', (t.match(/SIGUIENTE PASO/g) ?? []).length === 1);

// ---- Todas las funciones = the registry
await go(page, '/herramientas');
const fixture = JSON.parse(readFileSync(new URL('./registry-titles.json', import.meta.url), 'utf8'));
const body = await text(page);
const missing = fixture.filter((f) => !body.includes(f.title)).map((f) => f.id);
check(`Todas las funciones lists all ${fixture.length} functions`, missing.length === 0, missing.join(','));

// ---- axe on Hoy, Mi carro (the vehicle screen), Más
if (process.env.AXE) {
  const axe = readFileSync(process.env.AXE, 'utf8');
  for (const [label, path] of [['Hoy', '/'], ['Mi carro', '/vehiculo/dev_ae85'], ['Más', '/mas']]) {
    await go(page, path);
    await page.evaluate(axe);
    const res = await page.evaluate(async () => {
      // eslint-disable-next-line no-undef
      const r = await axe.run(document, { runOnly: ['wcag2a', 'wcag2aa'], rules: { 'color-contrast': { enabled: false } } });
      return r.violations.map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length }));
    });
    const serious = res.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    check(`axe ${label}: no serious/critical violations`, serious.length === 0, JSON.stringify(serious.length ? serious : res.map((v) => v.id)));
  }
}
check('no page errors', errors.length === 0, errors.slice(0, 2).join(' | ').slice(0, 160));
await browser.close();
console.log(`${results.filter(Boolean).length}/${results.length} passed`);
process.exit(results.every(Boolean) ? 0 : 1);
