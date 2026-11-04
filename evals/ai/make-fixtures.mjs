#!/usr/bin/env node
/**
 * Renders the SYNTHETIC eval photos (receipts, dashboards, invoices) to fixtures/img/*.jpg from HTML, so the evals are
 * reproducible and contain no one's real data. They are clean and well lit: a FLOOR for the reader, not a claim about
 * real-world accuracy. Real photos go in evals/ai/real/ (gitignored) with the same manifest shape; see README.md.
 *
 *   PLAYWRIGHT_CORE=/path/to/node_modules/playwright-core [CHROMIUM_PATH=/path/to/chrome] node evals/ai/make-fixtures.mjs
 *
 * Needs playwright-core and a Chromium (npx playwright install chromium). Dev tool only: not a dependency of the app.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, 'fixtures', 'img');
mkdirSync(out, { recursive: true });
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');

const receipt = (o) => `
<body style="margin:0;background:#d9d9d9"><div style="width:360px;margin:20px auto;background:#fff;padding:18px 16px;font:15px/1.45 'Courier New',monospace;color:#111;box-shadow:0 2px 8px #0004">
  ${o.station ? `<div style="text-align:center;font-weight:bold;font-size:18px">${o.station}</div>` : '<div style="height:8px"></div>'}
  <div style="text-align:center">${o.address ?? 'Av. Principal, Santo Domingo'}</div>
  ${o.rnc ? `<div>RNC: ${o.rnc}</div>` : ''}
  ${o.ncf ? `<div>NCF: ${o.ncf}</div>` : ''}
  <div>FECHA: ${o.dateText}  HORA: ${o.time}</div>
  <div>BOMBA: ${o.pump}</div><hr style="border:1px dashed #555">
  <div>${o.product}</div>
  <div>QTY: ${o.qty} GAL</div>
  <div>PRECIO/GAL: RD$ ${o.price}</div><hr style="border:1px dashed #555">
  <div style="font-weight:bold;font-size:18px">TOTAL: RD$ ${o.total}</div>
  <div style="text-align:center;margin-top:10px">GRACIAS POR SU COMPRA</div></div></body>`;

const dash = (o) => `
<body style="margin:0;background:#1b1b1b"><div style="width:420px;margin:24px auto;background:#050505;border-radius:18px;padding:26px;color:#9fe;font-family:'Courier New',monospace;border:3px solid #333">
  <div style="display:flex;justify-content:space-between;color:#aaa;font-size:14px"><span>${o.rpm} x1000 r/min</span><span></span></div>
  <div style="font-size:54px;letter-spacing:4px;text-align:center;margin:16px 0 4px;color:#cfe">${o.odo}<span style="font-size:22px"> ${o.unit}</span></div>
  <div style="text-align:center;color:#8aa;font-size:20px">TRIP A ${o.tripA} ${o.unit}</div>
  <div style="margin-top:14px;text-align:center;color:#6c6;font-size:13px">E ▮▮▮▮▮▮▯▯▯▯ F</div></div></body>`;

const invoice = (o) => `
<body style="margin:0;background:#eee"><div style="width:520px;margin:18px auto;background:#fff;padding:22px;font:14px/1.4 Arial,sans-serif;color:#111;box-shadow:0 2px 8px #0003">
  <div style="font-size:22px;font-weight:bold">${o.shop}</div>
  <div>RNC ${o.rnc} · Tel 809-555-0147</div><div>NCF: ${o.ncf}</div><div>Fecha: ${o.dateText}</div><div>Cliente: Juan Pérez · Cédula 001-0000000-0</div><hr>
  <table style="width:100%;border-collapse:collapse"><tr style="text-align:left;border-bottom:1px solid #999"><th>Descripción</th><th>Cant</th><th>Precio</th><th>Importe</th></tr>
  ${o.items.map((i) => `<tr><td>${i[0]}</td><td>${i[1]}</td><td>${i[2]}</td><td>${i[3]}</td></tr>`).join('')}</table><hr>
  <div style="text-align:right">Subtotal: ${o.subtotal}</div><div style="text-align:right">ITBIS 18%: ${o.itbis}</div>
  <div style="text-align:right;font-weight:bold;font-size:17px">TOTAL: RD$ ${o.total}</div>
  ${o.warranty ? `<div style="margin-top:12px;font-size:12px">${o.warranty}</div>` : ''}</div></body>`;

const jobs = {
  'receipt-shell-premium': [receipt({ station: 'SHELL LOS PRADOS', rnc: '101-00000-1', ncf: 'B0200004512', dateText: '02/11/2026', time: '17:42', pump: '04', product: 'GASOLINA PREMIUM', qty: '7.500', price: '344.00', total: '2,580.00' }), 400, 560],
  'receipt-thousands': [receipt({ station: 'TEXACO CHURCHILL', ncf: 'B0200001977', dateText: '29/10/2026', time: '08:15', pump: '11', product: 'GASOLINA REGULAR', qty: '3.800', price: '325.50', total: '1,236.90' }), 400, 560],
  'receipt-no-station-no-ncf': [receipt({ station: '', dateText: '03/11/2026', time: '12:03', pump: '02', product: 'GASOIL OPTIMO', qty: '15.000', price: '280.00', total: '4,200.00', address: '' }), 400, 520],
  'receipt-sunoco-eslash': [receipt({ station: 'SUNOCO 27 DE FEBRERO', ncf: 'E310000000123', dateText: '01/11/2026', time: '19:30', pump: '07', product: 'GASOLINA PREMIUM', qty: '9.250', price: '344.00', total: '3,182.00' }), 400, 560],
  'dash-km': [dash({ odo: '084830', unit: 'km', tripA: '312.4', rpm: '0', gauge: '1/2' }), 560, 380],
  'dash-miles': [dash({ odo: '052500', unit: 'mi', tripA: '88.0', rpm: '0', gauge: '' }), 560, 380],
  'invoice-brakes': [invoice({ shop: 'Frenos y Suspensión Díaz', rnc: '131234567', ncf: 'B0100000123', dateText: '02/11/2026', items: [['Pastillas delanteras', '1', '3,500.00', '3,500.00'], ['Discos delanteros', '2', '1,800.00', '3,600.00'], ['Mano de obra frenos', '1', '1,500.00', '1,500.00']], subtotal: '8,600.00', itbis: '1,548.00', total: '10,148.00', warranty: 'Garantía: 6 meses o 10,000 km' }), 560, 560],
  'invoice-simple': [invoice({ shop: 'Gomera El Rápido', rnc: '102345678', ncf: 'B0200000456', dateText: '30/10/2026', items: [['Parche de goma', '1', '300.00', '300.00']], subtotal: '300.00', itbis: '0.00', total: '300.00', warranty: '' }), 560, 420],
};

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
for (const [name, [html, w, h]] of Object.entries(jobs)) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
  await page.setContent(html);
  // The card only (no empty background): what a person would frame.
  await page.locator('body > div').screenshot({ path: join(out, `${name}.jpg`), type: 'jpeg', quality: 82 });
  await page.close();
}
await browser.close();
writeFileSync(join(out, '.generated'), `generated by make-fixtures.mjs: ${Object.keys(jobs).length} synthetic images\n`);
console.log(`wrote ${Object.keys(jobs).length} images to ${out}`);
