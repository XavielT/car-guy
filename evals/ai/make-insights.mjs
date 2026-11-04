#!/usr/bin/env node
/**
 * Builds evals/ai/insights.json: 10 fact sets for `cg-ai-insights` (SPEC-E §E2, PROMPT-05 step 6). The facts are produced by the REAL
 * engine (lib/domain/predict.ts) from synthetic car inputs, so the fixtures cannot drift from what the app really sends, and a test
 * regenerates them to prove it.
 *
 *   node --experimental-strip-types evals/ai/make-insights.mjs
 *
 * (predict.ts imports nothing, so Node can run it as is: that is the Deno-boundary promise, exercised.)
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildFacts } from '../../lib/domain/predict.ts';

const here = dirname(fileURLToPath(import.meta.url));
const TODAY = '2026-11-15';
const day = (back) => new Date(Date.parse(`${TODAY}T12:00:00Z`) - back * 86_400_000).toISOString().slice(0, 10);
/** Weekly readings at `perDay` km/day, the last one `endBack` days ago. */
const readings = (perDay, endKm, endBack = 0, n = 9) => Array.from({ length: n }, (_, i) => ({ at: day(endBack + (n - 1 - i) * 7), km: Math.round(endKm - (n - 1 - i) * 7 * perDay) }));
const fills = (n, kmPerGal, distance = 300) => Array.from({ length: n }, (_, i) => ({ fillupId: `h${i}`, at: `2026-0${(i % 9) + 1}-15`, distanceKm: distance, volumeGal: distance / kmPerGal, kmPerGal, measured: true }));
const NONE = { rotacion: null, alineacion: null, frenos: null, bateria: null, correa: null, refrigerante: null };
const base = (over) => ({ today: TODAY, vehicle: { id: 'v1', class: 'car' }, readings: readings(40, 100_000), reminders: [], economy: [], spend: [], prices: [], referencePrices: {}, tires: [], lastService: NONE, ...over });

const cases = [
  { id: 'oil-due-soon', note: 'one km reminder 10 days away at the real pace', input: base({ reminders: [{ id: 'oil', title: 'Aceite', metric: 'km', dueKm: 100_400, dueDate: null, isEnabled: true }] }) },
  { id: 'fuel-below-baseline', note: 'the last full tank 45 % under the car’s own average', input: base({ economy: [...fills(4, 30), { fillupId: 'bad', at: day(2), distanceKm: 300, volumeGal: 18.2, kmPerGal: 16.5, measured: true }] }) },
  { id: 'fuel-out-of-range', note: 'a fill-up outside what a car can do (a typo in gallons)', input: base({ economy: [...fills(4, 30), { fillupId: 'typo', at: day(1), distanceKm: 300, volumeGal: 4.2, kmPerGal: 71, measured: true }] }) },
  { id: 'spend-spike', note: 'this month double the average of the previous three', input: base({ spend: [{ at: day(8), amountDop: 40_000, category: 'reparacion' }, { at: '2026-10-05', amountDop: 12_000, category: 'otros' }, { at: '2026-09-05', amountDop: 14_000, category: 'otros' }, { at: '2026-08-05', amountDop: 10_000, category: 'otros' }] }) },
  { id: 'old-tires', note: 'two tyres, 8 and 14 years from their DOT', input: base({ tires: [{ id: 'a', label: 'Delantera', dot: '2318', installedAt: null }, { id: 'b', label: 'Trasera', dot: '1112', installedAt: null }] }) },
  { id: 'wear-gaps', note: 'rotation, alignment and brakes overdue, an old battery', input: base({ lastService: { rotacion: '2026-01-10', alineacion: '2025-06-01', frenos: '2023-01-01', bateria: '2022-01-01', correa: null, refrigerante: null } }) },
  { id: 'stale-odometer', note: 'no reading for 80 days: every date is a guess', input: base({ readings: readings(35, 98_000, 80), reminders: [{ id: 'oil', title: 'Aceite', metric: 'km', dueKm: 99_000, dueDate: null, isEnabled: true }] }) },
  { id: 'busy-car', note: 'more than five facts at once: the model must choose', input: base({ reminders: [{ id: 'oil', title: 'Aceite', metric: 'km', dueKm: 100_300, dueDate: null, isEnabled: true }], economy: [...fills(4, 30), { fillupId: 'bad', at: day(2), distanceKm: 300, volumeGal: 18.2, kmPerGal: 16.5, measured: true }], spend: [{ at: day(8), amountDop: 40_000, category: 'reparacion' }, { at: '2026-10-05', amountDop: 12_000, category: 'otros' }, { at: '2026-09-05', amountDop: 14_000, category: 'otros' }, { at: '2026-08-05', amountDop: 10_000, category: 'otros' }, { at: day(5), amountDop: 6_000, category: 'combustible' }], tires: [{ id: 'a', label: 'Delantera', dot: '2318', installedAt: null }], lastService: { rotacion: '2026-01-10', alineacion: '2025-06-01', frenos: '2023-01-01', bateria: '2022-01-01', correa: null, refrigerante: null } }) },
  { id: 'quiet-car', note: 'nothing urgent: one cost fact only', input: base({ spend: [{ at: day(6), amountDop: 6_000, category: 'combustible' }] }) },
  { id: 'motorcycle-pricey-fuel', note: 'a motorcycle paying 12 % over the reference', input: base({ vehicle: { id: 'v1', class: 'motorcycle' }, economy: fills(4, 60), prices: [{ at: day(40), pricePerGal: 336, fuelGroup: 'regular' }, { at: day(10), pricePerGal: 336, fuelGroup: 'regular' }], referencePrices: { regular: 300 } }) },
];

const out = {
  note: 'PROMPT-05: 10 fact sets for cg-ai-insights, produced by lib/domain/predict.ts (make-insights.mjs). `mustCover` are the act-level facts an answer may not leave out. today = ' + TODAY + '.',
  today: TODAY,
  cases: cases.map((c) => {
    const facts = buildFacts(c.input);
    return { id: c.id, note: c.note, input: c.input, facts, mustCover: facts.filter((f) => f.severity === 'act').map((f) => f.id) };
  }),
};
writeFileSync(join(here, 'insights.json'), JSON.stringify(out, null, 2) + '\n');
console.log(`wrote insights.json: ${out.cases.length} cases, ${out.cases.map((c) => c.facts.length).join('/')} facts, mustCover ${out.cases.map((c) => c.mustCover.length).join('/')}`);
