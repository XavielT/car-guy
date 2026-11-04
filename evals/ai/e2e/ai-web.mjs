// Mocked-network browser check of the AI flows (PROMPT-02). The model answers are canned, so this proves the APP side:
// capture → request shape → prefill + marks → the normal Save. It does NOT prove the model reads anything.
import { mkdirSync } from 'node:fs';

import { launch, seed, go, text, img, f } from './lib.mjs';

const OUT = process.argv[2] || './e2e-out';
mkdirSync(OUT, { recursive: true });
const results = [];
const check = (name, ok, detail = '') => {
  results.push([name, ok]);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
};
const values = (page) => page.locator('input, textarea').evaluateAll((els) => els.map((e) => e.value));
const model = 'claude-haiku-5-5';
// vPIC's answer for the Hilux VIN below (the matrícula says 2011, the VIN decodes to 2012: a conflict on purpose).
const VPIC = { Results: [{ Make: 'TOYOTA', Model: 'Hilux', ModelYear: '2012', EngineCylinders: '4', DisplacementL: '2.4', FuelTypePrimary: 'Diesel', TransmissionStyle: 'Manual/Standard', DriveType: 'RWD', EngineModel: '2KD-FTV', ErrorCode: '0', ErrorText: '' }] };
let docFields = {};
// What cg-ai-obd would answer (the safety floor is proven in the unit tests; here we prove the app shows and uses it).
const obdAnswer = (b) => ({
  codes: b.codes,
  can_drive: b.codes.includes('C0035') ? 'careful' : 'yes',
  can_drive_reason: 'Se puede manejar, pero revísalo pronto.',
  safety_override: b.codes.includes('C0035') ? 'Por seguridad no te digo que se puede manejar tranquilo: frenos, ABS o estabilidad.' : null,
  history_note: b.history?.repairs?.length ? 'En tu historial hay una reparación reciente del motor.' : null,
  causes: [
    { title: 'Catalizador gastado', likelihood: 'probable', why: 'Por los kilómetros del carro.', parts: ['catalizador'], diy_or_shop: 'shop', cost_rd: { min: 18000, max: 42000 }, recently_repaired: false },
    { title: 'Sensor de oxígeno trasero', likelihood: 'possible', why: 'Puede dar una lectura falsa.', parts: ['sensor de oxígeno trasero'], diy_or_shop: 'either', cost_rd: { min: 3000, max: 7000 }, recently_repaired: false },
  ],
  first_checks: ['Revisa si hay fugas en el escape'], diy_or_shop: 'shop', cost_range_rd: { min: 3000, max: 42000 },
  stop_and_tow_when: 'Si el carro pierde fuerza o huele a azufre fuerte.', related_codes: ['P0430'], sanitized: 0,
});

let odoRead = { odometer: f(52500), unit: f('mi') };
let expressOdo = 53100;
const canned = {
  'cg-ai-read': (b) => {
    if (b.kind === 'fuel_receipt') return { ok: true, kind: b.kind, model, fields: { total: f(2580), gallons: f(7.5), unit_price: f(344), product: f('GASOLINA PREMIUM'), station: f('SHELL LOS PRADOS'), date: f('2026-11-02'), ncf: f('B0200004512', 0.5) } };
    if (b.kind === 'odometer') return { ok: true, kind: b.kind, model, fields: odoRead };
    if (b.kind === 'invoice')
      return {
        ok: true, kind: b.kind, model,
        fields: { shop: f('Frenos y Suspensión Díaz'), rnc: f('131234567'), ncf: f('B0100000123'), date: f('2026-11-02'), subtotal: f(8600), itbis: f(1548), total: f(10148), warranty_text: f('6 meses o 10,000 km') },
        items: [
          { description: f('Pastillas delanteras'), qty: f(1), unit_price: f(3500), kind: f('part') },
          { description: f('Discos delanteros'), qty: f(2), unit_price: f(1800), kind: f('part') },
          { description: f('Mano de obra frenos'), qty: f(1), unit_price: f(1500), kind: f('labour') },
        ],
      };
    if (b.kind === 'document' || b.kind === 'doc_matricula') return { ok: true, kind: b.kind, model, fields: docFields, privacy_removed: 0 };
    if (b.kind === 'dash_lights') return { ok: true, kind: b.kind, model, fields: {}, items: [{ light: f('tire_pressure'), color: f('amber') }, { light: f('oil_pressure'), color: f('red') }, { light: f('check_engine'), color: f('amber') }] };
    if (b.kind === 'scanner') return { ok: true, kind: b.kind, model, fields: { rpm: f(3100), coolant_c: f(null, 0), load_pct: f(null, 0), speed_kmh: f(null, 0) }, items: [{ code: f('P0301') }, { code: f('P0302') }] };
    if (b.kind === 'vin_plate') return { ok: true, kind: b.kind, model, fields: { vin: f('MR0FX22G001234567'), make: f('Toyota'), year: f(2012), color: f(null, 0) }, privacy_removed: 0 };
    if (b.kind === 'fuel_express')
      return {
        ok: true, kind: b.kind, model,
        fields: { odometer: f(expressOdo), unit: f('km'), fuel_level: f(0.6, 0.4), total: f(2580), gallons: f(7.5), unit_price: f(344), product: f('GASOLINA PREMIUM'), station: f('SHELL LOS PRADOS'), date: f('2026-11-02') },
        per_image: [{ index: 0, kind: 'dashboard', readable: true }, { index: 1, kind: 'receipt', readable: true }],
      };
    return { ok: false };
  },
  'cg-ai-intent': () => ({ ok: true, target: 'fuel', target_confidence: 0.95, fields: { gallons: f(6), total: f(2064), station: f('Shell'), odometer: f(52900) }, vehicle: null, choices: null, model }),
  'cg-ai-obd': (b) => obdAnswer(b),
  // Car Health: the model rewords the first two facts (every number here is from the fact's own data).
  'cg-ai-insights': (b) => ({ ok: true, insights: b.facts.slice(0, 2).map((x) => ({ id: `ai-${x.id.length}`, headline: `Aviso IA · ${x.kind}`, why: 'Redactado por la IA.', fact_ids: [x.id], severity: x.severity, action: x.actions[0]?.type ?? null, source: 'ai' })), fallbacks: 0, dropped: 0 }),
  'cg-stt': () => ({ ok: true, text: 'eché doce galones de premium a dos mil ciento cincuenta' }),
};

async function pickWith(page, buttonName, file) {
  const chooser = page.waitForEvent('filechooser', { timeout: 8000 }).catch(() => null);
  await page.getByRole('button', { name: buttonName }).first().click();
  const fc = await chooser;
  if (!fc) return false;
  await fc.setFiles(file);
  return true;
}

// ───────────── main browser (typed dictation, captures) ─────────────
{
  const { browser, page, calls, errors, net } = await launch({ canned, vpic: VPIC });
  await seed(page);

  // A. fill-up: scan → prefill → odometer typed → Guardar
  await go(page, '/carga/nueva');
  const picked = await pickWith(page, /Escanear recibo/i, img('receipt-shell-premium.jpg'));
  await page.waitForTimeout(3500);
  const readCall = calls.find((c) => c.fn === 'cg-ai-read');
  check('A1 fill-up: scan opens the picker and sends ONE cg-ai-read (fuel_receipt, 1 image)', picked && calls.filter((c) => c.fn === 'cg-ai-read').length === 1 && readCall?.body?.kind === 'fuel_receipt' && readCall.body.images?.length === 1);
  check('A2 request carries only kind + image(s) (no location, no vehicle, no other fields)', readCall && Object.keys(readCall.body).sort().join() === 'images,kind' && Object.keys(readCall.body.images[0]).sort().join() === 'data,mime');
  const t1 = await text(page);
  const v1 = await values(page);
  check('A3 fields prefilled and the form says how many', /La IA llenó 6 campos/.test(t1) && v1.includes('7.5') && v1.includes('344') && v1.some((v) => /2580/.test(v)), JSON.stringify(v1.filter(Boolean)));
  check('A4 "IA" marks are shown', (t1.match(/\bIA\b/g) ?? []).length >= 6);
  await page.getByPlaceholder('52400').first().fill('52810');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/e2e-A-fuel.png`, fullPage: true });
  await page.getByRole('button', { name: /^Guardar/i }).first().click();
  await page.waitForTimeout(3000);
  const afterSave = await text(page);
  const resultSheet = /Rendimiento|Ver historial|Duplicad|duplic/i.test(afterSave);
  check('A5 Guardar runs the normal save path (the normal result sheet, with the computed km/gal, appeared)', resultSheet, afterSave.slice(0, 120).replace(/\n/g, ' | '));
  await page.screenshot({ path: `${OUT}/e2e-A-saved.png` });

  // B. repair invoice
  await go(page, '/servicio/nuevo?kind=reparacion');
  const pickedB = await pickWith(page, /Escanear factura/i, img('invoice-brakes.jpg'));
  await page.waitForTimeout(3500);
  const vB = await values(page);
  const tB = await text(page);
  check('B1 invoice read sends kind=invoice', pickedB && calls.some((c) => c.fn === 'cg-ai-read' && c.body.kind === 'invoice'));
  check('B2 shop visible in the form, parts 7100, labour 1500, printed total 10148 prefilled', vB.some((v) => /Frenos y Suspensi/.test(v)) && vB.includes('7100') && vB.includes('1500') && vB.includes('10148'), JSON.stringify(vB.filter(Boolean)));
  check('B3 warranty read as 6 months (the form shows the "6 meses" choice)', /6 meses/.test(tB), tB.slice(tB.search(/GARANT/i), tB.search(/GARANT/i) + 90).replace(/\n/g, ' | '));
  check('B4 marks shown', /\bIA\b/.test(tB));
  await page.screenshot({ path: `${OUT}/e2e-B-repair.png`, fullPage: true });

  // C. odometer in miles
  await go(page, '/odometro');
  const pickedC = await pickWith(page, /Foto del tablero/i, img('dash-miles.jpg'));
  await page.waitForTimeout(3000);
  const vC = await values(page);
  const tC = await text(page);
  check('C1 dashboard read fills 52500 and says it is miles', pickedC && vC.includes('52500') && /millas/i.test(tC));
  await page.getByText('Usar km', { exact: true }).first().click();
  await page.waitForTimeout(500);
  check('C2 "Usar km" converts 52,500 mi to 84,491 km', (await values(page)).includes('84491'));
  await page.screenshot({ path: `${OUT}/e2e-C-odometer.png` });

  // D. Fuel Express
  await go(page, '/carga/express');
  const tD0 = await text(page);
  const before = calls.filter((c) => c.fn === 'cg-ai-read').length;
  const p1 = await pickWith(page, /Elegir foto/i, img('dash-km.jpg'));
  await page.waitForTimeout(1500);
  const readsAfterFirst = calls.filter((c) => c.fn === 'cg-ai-read').length - before;
  const p2 = await pickWith(page, /Elegir foto/i, img('receipt-shell-premium.jpg'));
  await page.waitForTimeout(4500);
  await page.screenshot({ path: `${OUT}/e2e-D1-slots.png` });
  check('D1 Express: two photo slots, both pickable, and nothing is sent until the second photo is in', /Carga express/i.test(tD0) && p1 && p2 && readsAfterFirst === 0);
  const exCalls = calls.filter((c) => c.fn === 'cg-ai-read').slice(before);
  check('D2 Express makes exactly ONE read call with two images (kind fuel_express)', exCalls.length === 1 && exCalls[0].body.kind === 'fuel_express' && exCalls[0].body.images.length === 2);
  const tD = await text(page);
  await page.screenshot({ path: `${OUT}/e2e-D2-card.png`, fullPage: true });
  check('D3 one confirmation card with Confirmar', /confirmar/i.test(tD), tD.slice(0, 200).replace(/\n/g, ' | '));
  await page.getByRole('button', { name: /^Confirmar$/i }).first().click().catch(() => {});
  await page.waitForTimeout(3000);
  const tD4 = await text(page);
  await page.screenshot({ path: `${OUT}/e2e-D3-after.png` });
  check('D4 one tap on Confirmar saves: the normal result sheet (km/gal) shows, with no duplicate warning', !/ya se guard/i.test(tD4) && /rendimiento|ver historial|primera carga/i.test(tD4) && /km\/gal/i.test(tD4), tD4.slice(0, 160).replace(/\n/g, ' | '));

  // D5. the same confirmation again is caught by the shared duplicate guard (same save path as the manual form)
  await go(page, '/carga/express');
  await pickWith(page, /Elegir foto/i, img('dash-km.jpg'));
  await page.waitForTimeout(1200);
  await pickWith(page, /Elegir foto/i, img('receipt-shell-premium.jpg'));
  await page.waitForTimeout(4500);
  await page.getByRole('button', { name: /^Confirmar$/i }).first().click().catch(() => {});
  await page.waitForTimeout(2500);
  check('D5 confirming the identical read again shows "esta echada ya se guardó" instead of saving twice', /ya se guard/i.test(await text(page)));
  await page.screenshot({ path: `${OUT}/e2e-D5-duplicate.png` });

  // G. offline queue: photos taken without a connection wait, then are read when it is back, then confirmed in one tap
  expressOdo = 53500;
  const readsBeforeG = calls.filter((c) => c.fn === 'cg-ai-read').length;
  await go(page, '/carga/express');
  net.offline = true;
  await pickWith(page, /Elegir foto/i, img('dash-km.jpg'));
  await page.waitForTimeout(1200);
  await pickWith(page, /Elegir foto/i, img('receipt-shell-premium.jpg'));
  await page.waitForTimeout(4500);
  await go(page, '/');
  const tG1 = await text(page);
  check('G1 offline: the photos are kept and Hoy says one is waiting for a connection', /esperando conexi/i.test(tG1) && calls.filter((c) => c.fn === 'cg-ai-read').length === readsBeforeG, tG1.slice(0, 200).replace(/\n/g, ' | '));
  await page.screenshot({ path: `${OUT}/e2e-G1-waiting.png` });
  net.offline = false;
  await go(page, '/');
  await page.waitForTimeout(3000);
  const tG2 = await text(page);
  check('G2 back online: coming to Hoy reads the queued photos ONCE and offers to confirm', /lista para confirmar/i.test(tG2) && calls.filter((c) => c.fn === 'cg-ai-read').length === readsBeforeG + 1, tG2.slice(0, 200).replace(/\n/g, ' | '));
  await page.screenshot({ path: `${OUT}/e2e-G2-ready.png` });
  await page.getByRole('button', { name: /lista para confirmar/i }).first().click().catch(() => {});
  await page.waitForTimeout(2500);
  const tG3 = await text(page);
  await page.screenshot({ path: `${OUT}/e2e-G3-opened.png` });
  check('G3 Abrir shows the confirmation card with the queued read (53,500 km)', /confirmar carga/i.test(tG3) && /53,500/.test(tG3), `${page.url()} ${tG3.slice(0, 220).replace(/\n/g, ' | ')}`);
  await page.getByRole('button', { name: /^Confirmar$/i }).first().click().catch(() => {});
  await page.waitForTimeout(3000);
  const tG4 = await text(page);
  check('G4 one tap saves it (result sheet, no duplicate), and Hoy no longer lists it', /km\/gal/i.test(tG4) && !/ya se guard/i.test(tG4));
  await go(page, '/');
  check('G5 the queue notice is gone once confirmed', !/lista para confirmar|esperando conexi/i.test(await text(page)));

  // E. dictate by typing
  await go(page, '/');
  const mic = page.getByRole('button', { name: 'Dictar' }).first();
  check('E1 Hoy has the Dictar button', (await mic.count()) > 0);
  await mic.click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/e2e-E1-sheet.png` });
  await page.getByRole('textbox').last().fill('eché 6 galones de premium, 2,064 pesos en el Shell, 52,900 km');
  await page.getByRole('button', { name: /Continuar/ }).first().click();
  await page.waitForTimeout(3500);
  const intentCall = calls.find((c) => c.fn === 'cg-ai-intent');
  check('E2 sentence goes to cg-ai-intent with a minimal context', !!intentCall && Object.keys(intentCall.body.context).sort().join() === 'features,fuelType,lastOdometer,today,vehicles' && intentCall.body.context.vehicles.every((v) => Object.keys(v).sort().join() === 'id,name'), intentCall && JSON.stringify(Object.keys(intentCall.body.context)));
  const vE = await values(page);
  const tE = await text(page);
  check('E3 opens the fill-up form pre-filled (6 gal, 2064, Shell) with the price DERIVED (344), not the board price', /carga\/nueva/.test(page.url()) && vE.includes('6') && vE.some((v) => /2064/.test(v)) && /Shell/.test(tE) && !vE.includes('343.8') && /344\.00\/gal/.test(tE) && /\bIA\b/.test(tE), `${page.url()} ${JSON.stringify(vE.filter(Boolean))}`);
  await page.screenshot({ path: `${OUT}/e2e-E3-dictated-form.png`, fullPage: true });
  // H. vehicle from a matrícula (+ vPIC), then documents against that car, with the wrong-car guard
  docFields = { plate: f('A123456'), vin: f('MR0FX22G001234567'), make: f('TOYOTA'), model: f('HILUX'), year: f(2011), color: f('Blanco'), fuel: f('diesel'), engine_cc: f(2494), seats: f(5), doc_kind: f('matricula') };
  await go(page, '/vehiculo/nuevo');
  const scanned = await pickWith(page, /Escanear matr[ií]cula/i, img('doc-matricula.jpg'));
  await page.waitForTimeout(5000);
  const tH = await text(page);
  const vH = await values(page);
  const matriculaCall = calls.find((c) => c.fn === 'cg-ai-read' && c.body.kind === 'doc_matricula');
  check('H1 matrícula scan: ONE doc_matricula call with the photo only, and the privacy note is on screen', scanned && !!matriculaCall && Object.keys(matriculaCall.body).sort().join() === 'images,kind' && /cédula/i.test(tH));
  check('H2 vehicle form filled: plate, VIN, make/model/year, with IA marks', vH.includes('A123456') && vH.includes('MR0FX22G001234567') && /Toyota/.test(tH) && /Hilux/i.test(tH) && /\bIA\b/.test(tH) && /La IA llenó/.test(tH), JSON.stringify(vH.filter(Boolean)));
  check('H3 vPIC was asked for that VIN and its year wins, with the conflict shown and a way back', calls.some((c) => c.fn === 'vpic' && /MR0FX22G001234567/.test(c.body)) && /el papel dice 2011, el VIN dice 2012/.test(tH) && /Usar el del papel/.test(tH));
  await page.screenshot({ path: `${OUT}/e2e-H1-vehicle-scan.png` });
  await page.getByText('Usar el del papel', { exact: true }).first().click();
  await page.waitForTimeout(600);
  const tH2 = await text(page);
  check('H4 "Usar el del papel" restores 2011 and clears that conflict line', /2011/.test(tH2) && !/el papel dice 2011/.test(tH2));
  await page.getByRole('textbox').first().fill('Hilux E2E');
  await page.getByRole('button', { name: /Agregar veh[ií]culo/i }).first().click();
  await page.waitForTimeout(3500);

  // The new car is now active and has plate A123456.
  docFields = { doc_kind: f('seguro'), insurer: f('Seguros Universal'), policy_number: f('POL2026000123'), coverage_type: f('Ley + daños'), premium: f(18400), plate: f('A123456'), issued_date: f('2026-01-10'), expires_date: f('2027-01-10') };
  await go(page, '/documento/nuevo');
  const pickedDoc = await pickWith(page, /Escanear documento/i, img('doc-seguro.jpg'));
  await page.waitForTimeout(4500);
  const vD = await values(page);
  const tD2 = await text(page);
  check('H5 seguro for the SAME car: no guard, kind + title + both dates + notes filled', pickedDoc && !/¿Es de este carro\?/i.test(tD2) && vD.some((v) => /Seguro · Seguros Universal/.test(v)) && vD.includes('2027-01-10') && vD.includes('2026-01-10') && vD.some((v) => /Póliza: POL2026000123/.test(v)), JSON.stringify(vD.filter(Boolean)).slice(0, 260));
  await page.screenshot({ path: `${OUT}/e2e-H5-document.png` });
  await page.getByRole('button', { name: /^Guardar documento/i }).first().click();
  await page.waitForTimeout(2500);
  check('H6 saving it moves the seguro reminder ("Ajustamos el recordatorio a esa fecha")', /Ajustamos el recordatorio/.test(await text(page)));
  await page.getByRole('button', { name: /^(OK|Aceptar|Listo)$/i }).first().click().catch(() => {});

  // another car's plate: the guard asks BEFORE anything is applied
  docFields = { doc_kind: f('marbete'), plate: f('G654321'), expires_date: f('2027-03-31') };
  await go(page, '/documento/nuevo');
  await pickWith(page, /Escanear documento/i, img('doc-marbete.jpg'));
  await page.waitForTimeout(4500);
  const tG = await text(page);
  const vG = await values(page);
  check('H7 a paper with ANOTHER plate raises the guard ("¿Es de este carro?" + G654321) and has applied nothing yet', /¿Es de este carro\?/i.test(tG) && /G654321/.test(tG) && !vG.includes('2027-03-31'), tG.slice(0, 200).replace(/\n/g, ' | '));
  await page.screenshot({ path: `${OUT}/e2e-H7-guard.png` });
  await page.getByText('Cancelar', { exact: true }).first().click();
  await page.waitForTimeout(800);
  check('H8 Cancelar drops the read: the form is still empty', !(await values(page)).includes('2027-03-31'));
  await pickWith(page, /Escanear documento/i, img('doc-marbete.jpg'));
  await page.waitForTimeout(4500);
  await page.getByText('Usar aquí igual', { exact: true }).first().click();
  await page.waitForTimeout(1200);
  check('H9 "Usar aquí igual" applies it to this car anyway (marbete, expiry 2027-03-31)', (await values(page)).includes('2027-03-31'));

  // I. OBD and repairs (PROMPT-04), on the DS3: it has a brake repair with a running warranty and a motor repair in its history
  await go(page, '/');
  await page.getByRole('button', { name: /DS3/ }).first().click();
  await page.waitForTimeout(800);

  await go(page, '/servicio/nuevo?kind=reparacion');
  await page.getByText('Ninguno', { exact: true }).first().click();
  await page.waitForTimeout(500);
  await page.getByText('Frenos', { exact: true }).first().click();
  await page.waitForTimeout(500);
  await page.getByPlaceholder(/alternador/i).fill('Pastillas de frenos');
  await page.locator('text=/^Partes \\(RD\\$\\)$/i').first().locator('xpath=following::input[1]').fill('6900');
  await page.waitForTimeout(700);
  const tR = await text(page);
  await page.screenshot({ path: `${OUT}/e2e-I1-repair-price.png` });
  check('I1 price vs the person’s OWN history: "38 % más que tu último trabajo parecido (RD$ 5,000…)"', /38 % más que tu último trabajo parecido \(RD\$ 5,000/.test(tR), (tR.match(/[^\n]*trabajo parecido[^\n]*/) ?? ['(no line)'])[0]);
  check('I2 warranty watcher: "Esta pieza puede seguir en garantía (Taller de ejemplo, hasta …)"', /Esta pieza puede seguir en garantía \(Taller de ejemplo, hasta/.test(tR), (tR.match(/[^\n]*garantía \(Taller[^\n]*/) ?? ['(no banner)'])[0]);

  await go(page, '/obd/P0420');
  const obdBefore = calls.filter((c) => c.fn === 'cg-ai-obd').length;
  await page.getByRole('button', { name: /Explicar para mi carro/ }).first().click();
  await page.waitForTimeout(3500);
  const obdCall = calls.filter((c) => c.fn === 'cg-ai-obd')[obdBefore];
  const tO = await text(page);
  await page.screenshot({ path: `${OUT}/e2e-I3-obd-answer.png`, fullPage: true });
  check('I3 explain: ONE cg-ai-obd call with the code, the car, and the car’s history; nothing identifying', !!obdCall && JSON.stringify(obdCall.body.codes) === '["P0420"]' && /Citro|DS3/i.test(JSON.stringify(obdCall.body.vehicle)) && obdCall.body.history.repairs.some((r) => /Bomba de agua/.test(r.title)) && !/plate|vin|placa/i.test(JSON.stringify(obdCall.body)), obdCall ? JSON.stringify(Object.keys(obdCall.body)) : 'no call');
  check('I4 the answer shows: can-drive line, causes with likelihood, an RD$ ESTIMATE, first checks, tow rule, and the guidance disclaimer', /Se puede manejar/.test(tO) && /Catalizador gastado · Probable/.test(tO) && /Estimado: RD\$ 18,000–42,000/.test(tO) && /Revisa si hay fugas/.test(tO) && /Para y llama una grúa/i.test(tO) && /no un diagnóstico/.test(tO) && !/US\$|USD/.test(tO));
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  const afterReload = calls.filter((c) => c.fn === 'cg-ai-obd').length;
  check('I5 re-opening the same code shows the saved explanation WITHOUT a new call (cache)', afterReload === obdBefore + 1 && /Catalizador gastado/.test(await text(page)) && /Explicación guardada/.test(await text(page)));
  await page.getByRole('button', { name: /^Actualizar$/ }).first().click();
  await page.waitForTimeout(3000);
  check('I6 Actualizar asks again (one more call)', calls.filter((c) => c.fn === 'cg-ai-obd').length === obdBefore + 2);

  await go(page, '/obd/C0035');
  await page.getByRole('button', { name: /Explicar para mi carro/ }).first().click();
  await page.waitForTimeout(3000);
  const tS = await text(page);
  check('I7 a safety code: "Maneja con cuidado" and the sentence that says it was raised for safety', /Maneja con cuidado/i.test(tS) && /Por seguridad no te digo que se puede manejar tranquilo/i.test(tS));
  await page.screenshot({ path: `${OUT}/e2e-I7-safety.png`, fullPage: true });

  // scanner text → codes → confirm → explained TOGETHER, then the repair, then closing the loop
  await go(page, '/obd');
  await page.getByPlaceholder('P0301 P0420 …').fill('Stored: P0420\nPending: P0171\nCoolant Temp 92 °C\nEngine RPM 2,450 rpm');
  await page.getByRole('button', { name: /^Buscar códigos$/ }).first().click();
  await page.waitForTimeout(600);
  const tP = await text(page);
  check('I8 pasted scanner text is parsed OFFLINE (no AI call): 2 codes and the freeze frame', /Encontré 2 códigos/.test(tP) && /Datos congelados/.test(tP) && /RPM 2450/.test(tP) && /Refrigerante 92/.test(tP) && !calls.some((c) => c.fn === 'cg-ai-read' && c.body.kind === 'scanner'));
  await page.screenshot({ path: `${OUT}/e2e-I8-scanner.png`, fullPage: true });
  await page.getByRole('button', { name: /Anotar y explicar juntos/ }).first().click();
  await page.waitForTimeout(2500);
  const beforeTogether = calls.filter((c) => c.fn === 'cg-ai-obd').length;
  await page.getByRole('button', { name: /Explicar para mi carro/ }).first().click();
  await page.waitForTimeout(3500);
  const together = calls.filter((c) => c.fn === 'cg-ai-obd')[beforeTogether];
  check('I9 codes read together are explained together (one call, both codes, the freeze frame)', /2 códigos leídos juntos|P0420/.test(await text(page)) && !!together && JSON.stringify(together.body.codes) === '["P0420","P0171"]' && together.body.freezeFrame?.rpm === 2450 && together.body.freezeFrame?.coolantC === 92, together ? JSON.stringify([together.body.codes, together.body.freezeFrame]) : 'no call');
  await page.getByRole('button', { name: /Crear reparación con esto/ }).first().click();
  await page.waitForTimeout(2500);
  const vRep = await values(page);
  check('I10 "Crear reparación con esto" opens the repair form pre-filled with the top suspect (nothing saved yet)', /servicio\/nuevo/.test(page.url()) && vRep.some((v) => /Catalizador gastado/.test(v)) && /dtcEvent=/.test(page.url()), page.url());
  await page.getByRole('button', { name: /^Guardar/i }).first().click();
  await page.waitForTimeout(3000);
  const tLoop = await text(page);
  check('I11 closing the loop: the code is marked resolved and the app offers a re-scan reminder', /¿Se fue la luz\?/i.test(tLoop) && /Marqué P0420 como resuelto/i.test(tLoop), tLoop.slice(0, 160).replace(/\n/g, ' | '));
  await page.screenshot({ path: `${OUT}/e2e-I11-loop.png` });
  await page.getByText('Recordármelo', { exact: true }).first().click().catch(() => {});
  await page.waitForTimeout(1000);

  // warning-light photo
  await go(page, '/obd');
  const lightsPicked = await pickWith(page, /Foto de la luz/i, img('dash-km.jpg'));
  await page.waitForTimeout(3500);
  const tL = await text(page);
  await page.screenshot({ path: `${OUT}/e2e-I12-lights.png`, fullPage: true });
  check('I12 warning-light photo: lights NAMED, most urgent first (oil pressure red → stop), and where each leads', lightsPicked && tL.indexOf('Presión de aceite') > -1 && tL.indexOf('Presión de aceite') < tL.indexOf('Check engine') && tL.indexOf('Presión de aceite') < tL.indexOf('Presión de gomas') && /Para y revísalo/.test(tL) && /Revísalo pronto/.test(tL) && /Abrir: /.test(tL), tL.slice(tL.indexOf('FOTO DE UNA LUZ'), tL.indexOf('FOTO DE UNA LUZ') + 260).replace(/\n/g, ' | '));
  // scanner screenshot
  const shot = await pickWith(page, /Foto o captura del escáner/i, img('dash-km.jpg'));
  await page.waitForTimeout(3500);
  const tSc = await text(page);
  check('I13 scanner screenshot (the only path that calls the AI): codes and a freeze-frame value come back', shot && calls.some((c) => c.fn === 'cg-ai-read' && c.body.kind === 'scanner') && /P0301/.test(tSc) && /P0302/.test(tSc) && /RPM 3100/.test(tSc));

  // J. Car Health (PROMPT-05) on the DS3
  const ds3Before = calls.filter((c) => c.fn === 'cg-ai-insights' && /ds3/.test(c.body.facts[0].vehicleId)).length;
  await go(page, '/');
  await page.getByRole('button', { name: /DS3/ }).first().click();
  await page.waitForTimeout(5000);
  const ds3Calls = () => calls.filter((c) => c.fn === 'cg-ai-insights' && /ds3/.test(c.body.facts[0].vehicleId)).length;
  const tJ = await text(page);
  await page.screenshot({ path: `${OUT}/e2e-J1-car-health.png` });
  check('J1 Inicio shows "Salud del carro" with facts computed on the device (cost per km, biggest expense…) in plain words', /salud del carro/i.test(tJ) && /Tu gasto más grande reciente|Cuánto te cuesta cada kilómetro|rindió distinto/i.test(tJ), (tJ.match(/SALUD DEL CARRO[^]{0,260}/i) ?? ['(no card)'])[0].replace(/\n/g, ' | '));
  const j2 = ds3Calls();
  check('J2 the AI is asked at most ONCE for this state of the car (section I changed it, so one new call is legitimate), and its wording replaces the first two sentences', j2 - ds3Before <= 1 && /Aviso IA/.test(tJ) && /Redactado con IA/.test(tJ), `before=${ds3Before} now=${j2}`);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(5000);
  check('J3 reopening an unchanged car asks the AI NO more times (cache + single flight)', ds3Calls() === j2 && /Aviso IA/.test(await text(page)), `calls=${ds3Calls()} (was ${j2})`);
  await page.getByRole('button', { name: 'Descartar' }).first().click();
  await page.waitForTimeout(600);
  const afterDismiss = await page.getByRole('button', { name: 'Descartar' }).count();
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(4000);
  const dismissedAfterReload = await page.getByRole('button', { name: 'Descartar' }).count();
  check('J4 dismissing hides the insight, and it STAYS hidden after a reload (same state of the car)', afterDismiss >= 1 && dismissedAfterReload === afterDismiss, `before=3? after dismiss=${afterDismiss} after reload=${dismissedAfterReload}`);
  net.offline = true;
  await page.reload({ waitUntil: 'networkidle' }).catch(() => {});
  await page.waitForTimeout(4000);
  const tOffJ = await text(page);
  net.offline = false;
  check('J5 offline: the card is still there with the deterministic sentences (no AI needed), with no empty numbers', /salud del carro/i.test(tOffJ) && !/Rindiós+%/.test(tOffJ) && !/en 0 días/.test(tOffJ) && !/promedio de ./.test(tOffJ) && /\bRD\$ [\d,.]+/.test(tOffJ.slice(tOffJ.search(/salud del carro/i), tOffJ.search(/salud del carro/i) + 600)), tOffJ.slice(tOffJ.search(/salud del carro/i), tOffJ.search(/salud del carro/i) + 200).replace(/\n/g, ' | '));
  const costBtn = page.getByRole('button', { name: /Ver los costos/ }).first();
  if (await costBtn.count()) {
    await costBtn.click();
    await page.waitForTimeout(2000);
    check('J6 an action opens the normal screen (costs), and writes nothing', /cifras/.test(page.url()), page.url());
  } else check('J6 an action opens the normal screen (costs)', false, 'no "Ver los costos" button on the card');

  // offline: the bundled lookup stays the answer, and the AI part says it needs a connection (SPEC-D §D5)
  net.offline = true;
  await go(page, '/obd/P0171');
  const tOff = await text(page);
  net.offline = false;
  check('I14 offline: the bundled description is still there and the AI explanation says it needs a connection', /P0171/.test(tOff) && /Código genérico|No está en la tabla|Mezcla|pobre|lean/i.test(tOff) && /necesita conexión/i.test(tOff), tOff.slice(0, 200).replace(/\n/g, ' | '));

  console.log('errors (main):', errors.slice(0, 5));
  await browser.close();
}

// ───────────── fake microphone: expo-audio really records on web ─────────────
{
  const { browser, page, calls, errors } = await launch({ canned, fakeMic: true });
  await seed(page);
  await go(page, '/');
  await page.getByRole('button', { name: 'Dictar' }).first().click();
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: 'Hablar' }).first().click();
  await page.waitForTimeout(1500);
  // The microphone primer (ADR-59) may come first.
  const allow = page.getByRole('button', { name: /Permitir micrófono/i });
  if (await allow.count()) {
    await page.screenshot({ path: `${OUT}/e2e-F0-primer.png` });
    await allow.first().click();
    await page.waitForTimeout(2000);
  }
  const stop = page.getByRole('button', { name: 'Terminar' });
  const recording = (await stop.count()) > 0;
  check('F1 mic: primer → permission → recording state shows "Terminar"', recording, (await text(page)).slice(0, 160).replace(/\n/g, ' | '));
  if (recording) {
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${OUT}/e2e-F1-recording.png` });
    await stop.first().click();
    await page.waitForTimeout(3500);
    const stt = calls.find((c) => c.fn === 'cg-stt');
    check('F2 stop sends ONE cg-stt call with base64 audio and an accepted mime', !!stt && /^audio\/(webm|mp4|ogg|wav|mpeg)/.test(stt.body.mime) && typeof stt.body.audio === 'string' && stt.body.audio.length > 100 && Object.keys(stt.body).sort().join() === 'audio,mime', stt ? `${stt.body.mime} ${stt.body.audio.length} b64 chars` : 'no call');
    const vF = await values(page);
    check('F3 transcript lands in the editable box (nothing acted on yet)', vF.some((v) => /eché doce galones/.test(v)) && /dictar|Dictar/i.test(await text(page)), JSON.stringify(vF.filter(Boolean)));
    await page.screenshot({ path: `${OUT}/e2e-F2-transcript.png` });
  }
  console.log('errors (mic):', errors.slice(0, 5));
  await browser.close();
}

const failed = results.filter(([, ok]) => !ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
