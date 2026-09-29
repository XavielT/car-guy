#!/usr/bin/env node
/**
 * Writes docs/imp-29092026/fixtures/drive-synthetic.gpx — a synthetic ~12 km,
 * ~25 min drive across Santo Domingo for the emulator (Extended controls →
 * Location → Routes → Load GPX) and for __tests__/trips/machine.test.ts.
 *
 * Route (approximate, plausible coordinates, not surveyed): Av. 27 de Febrero
 * eastbound from Plaza de la Bandera past Av. Winston Churchill and
 * Av. Abraham Lincoln to Av. Máximo Gómez, then south on Máximo Gómez and
 * west on Av. Independencia / Bolívar back towards Churchill.
 *
 * Profile: speeds 0–95 km/h, two 2-minute stops (lights / traffic), one
 * 5-minute stop (gas station), a final park. One trkpt every 2 s. Position
 * noise is a slow random walk (±~3 m), like a real phone, with a fixed seed so
 * the file is reproducible: `node tools/gen-drive-gpx.mjs`.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../docs/imp-29092026/fixtures/drive-synthetic.gpx');
const DT = 2; // s between trkpts
const START = Date.parse('2026-09-29T13:00:00Z'); // 09:00 in Santo Domingo (UTC−4)

// Polyline of the route (lat, lng).
const WAY = [
  [18.4497, -69.9700], // 27 de Febrero, Plaza de la Bandera
  [18.4540, -69.9615],
  [18.4580, -69.9530], // Núñez de Cáceres
  [18.4612, -69.9460],
  [18.4640, -69.9395], // Winston Churchill
  [18.4682, -69.9318], // Abraham Lincoln
  [18.4712, -69.9235],
  [18.4745, -69.9150], // Máximo Gómez
  [18.4690, -69.9128],
  [18.4630, -69.9102], // Máximo Gómez south
  [18.4598, -69.9090], // Independencia
  [18.4585, -69.9160],
  [18.4570, -69.9245],
  [18.4556, -69.9330],
  [18.4548, -69.9392], // near Churchill
  [18.4538, -69.9455],
];

// Cruise speed (km/h) by distance along the route (m) — and the stops.
const CRUISE = [
  [0, 40],
  [1500, 60],
  [3200, 95], // elevated stretch of 27 de Febrero
  [4800, 55],
  [6200, 45],
  [7600, 35],
  [9500, 45],
  [11200, 30],
];
const STOPS = [
  { at: 1400, holdS: 120 }, // light / traffic
  { at: 5600, holdS: 120 },
  { at: 8900, holdS: 300 }, // gas station
];
const ACC = 2.0; // m/s² accelerating
const DEC = 2.5; // m/s² braking

// ---- geometry ----
const R = 6371008.8;
const RAD = Math.PI / 180;
const hav = (a, b) => {
  const dLat = (b[0] - a[0]) * RAD;
  const dLng = (b[1] - a[1]) * RAD;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * RAD) * Math.cos(b[0] * RAD) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};
const cum = [0];
for (let i = 1; i < WAY.length; i++) cum.push(cum[i - 1] + hav(WAY[i - 1], WAY[i]));
const TOTAL = cum[cum.length - 1];
function at(dist) {
  const d = Math.min(Math.max(dist, 0), TOTAL);
  let i = 1;
  while (i < cum.length - 1 && cum[i] < d) i++;
  const f = (d - cum[i - 1]) / (cum[i] - cum[i - 1]);
  return [WAY[i - 1][0] + f * (WAY[i][0] - WAY[i - 1][0]), WAY[i - 1][1] + f * (WAY[i][1] - WAY[i - 1][1])];
}
const cruiseAt = (d) => {
  let v = CRUISE[0][1];
  for (const [from, kmh] of CRUISE) if (d >= from) v = kmh;
  return v / 3.6;
};

// ---- seeded noise (mulberry32 + Box–Muller) ----
let seed = 0x27f2b;
const rnd = () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const gauss = () => Math.sqrt(-2 * Math.log(1 - rnd())) * Math.cos(2 * Math.PI * rnd());
let nx = 0;
let ny = 0;
const noise = () => {
  // AR(1): slow wander, bounded around ±3 m.
  nx = 0.9 * nx + 0.35 * gauss();
  ny = 0.9 * ny + 0.35 * gauss();
  return [ny / 110540, nx / (111320 * Math.cos(18.46 * RAD))];
};

// ---- simulate at 1 s, sample every DT ----
const pts = [];
let t = 0;
let d = 0;
let v = 0;
let stopIdx = 0;
let holdLeft = 0;
const sample = () => {
  if (t % DT !== 0) return;
  const [la, ln] = at(d);
  const [ea, en] = noise();
  pts.push({ t: START + t * 1000, lat: la + ea, lng: ln + en, kmh: v * 3.6 });
};
// A few parked seconds before leaving.
for (let i = 0; i < 20; i++, t++) sample();
while (d < TOTAL - 0.5 || v > 0.05) {
  if (holdLeft > 0) {
    holdLeft -= 1;
    v = 0;
    sample();
    t++;
    continue;
  }
  const nextStop = stopIdx < STOPS.length ? STOPS[stopIdx].at : TOTAL;
  const remain = nextStop - d;
  const vBrake = Math.sqrt(Math.max(0, 2 * DEC * remain));
  const target = Math.min(cruiseAt(d), vBrake);
  v = target > v ? Math.min(target, v + ACC) : Math.max(target, v - DEC);
  if (remain < 1.5 && v < 1.5) {
    d = nextStop;
    v = 0;
    if (stopIdx < STOPS.length) {
      holdLeft = STOPS[stopIdx].holdS;
      stopIdx++;
    } else {
      break;
    }
  } else {
    d = Math.min(nextStop, d + v);
  }
  sample();
  t++;
}
// Parked at the end.
for (let i = 0; i < 30; i++, t++) sample();

const maxKmh = Math.max(...pts.map((p) => p.kmh));
const xml = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<gpx version="1.1" creator="Car Guy tools/gen-drive-gpx.mjs" xmlns="http://www.topografix.com/GPX/1/1">',
  '  <metadata>',
  '    <name>Car Guy — drive-synthetic</name>',
  `    <desc>Synthetic drive, Santo Domingo (27 de Febrero → Máximo Gómez → Independencia). ${(TOTAL / 1000).toFixed(1)} km, ${Math.round(t / 60)} min, 0–${Math.round(maxKmh)} km/h; stops 2 min, 2 min, 5 min. Generated by tools/gen-drive-gpx.mjs.</desc>`,
  `    <time>${new Date(START).toISOString()}</time>`,
  '  </metadata>',
  '  <trk>',
  '    <name>drive-synthetic</name>',
  '    <trkseg>',
  ...pts.map(
    (p) =>
      `      <trkpt lat="${p.lat.toFixed(6)}" lon="${p.lng.toFixed(6)}"><ele>20</ele><time>${new Date(p.t).toISOString().replace('.000Z', 'Z')}</time></trkpt>`,
  ),
  '    </trkseg>',
  '  </trk>',
  '</gpx>',
  '',
].join('\n');

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, xml);
console.log(`${OUT}: ${pts.length} trkpts, ${(TOTAL / 1000).toFixed(2)} km, ${(t / 60).toFixed(1)} min, max ${maxKmh.toFixed(0)} km/h`);
