/** Repairs in the costs card, the CSV and the book (IMP 16102026 Phase 5, N7). */
import type { ServiceRecord } from '@/lib/db/types';
import { ownershipCost } from '@/lib/domain/costs';
import { repairsCsv, costsCsv } from '@/lib/export/csv';
import { publicDossier, type RawDossier } from '@/lib/share/dossier';
const buildDossier = (raw: RawDossier) => publicDossier(raw, { storageBase: 'https://example.test' });

const T = '2026-03-15T12:00:00.000Z';
const vehicle = { purchaseDate: null, purchasePrice: null, soldDate: null, soldPrice: null };
const spend = (category: string, amountDop: number) => ({ category, amountDop, occurredAt: T }) as never;

describe('the costs card', () => {
  it('counts repairs inside mantenimiento and also shows them on their own', () => {
    const cost = ownershipCost({ vehicle, spend: [spend('reparacion', 6000), spend('mantenimiento', 1500), spend('combustible', 400)] }, T);
    expect(cost.byCategory.mantenimiento).toBe(7500);
    expect(cost.repairs).toBe(6000);
    expect(cost.spend).toBe(7900);
  });
  it('no repairs, no line', () => {
    expect(ownershipCost({ vehicle, spend: [spend('mantenimiento', 1500)] }, T).repairs).toBe(0);
  });
  it('the costs CSV carries the repairs row right under mantenimiento', () => {
    const cost = ownershipCost({ vehicle, spend: [spend('reparacion', 6000), spend('mantenimiento', 1500)] }, T);
    const csv = costsCsv({ vehicles: [{ name: 'AE85', cost }], total: cost.total, distanceKm: 0, since: null } as never);
    const lines = csv.split('\r\n');
    const i = lines.findIndex((l) => l.includes('mantenimiento'));
    expect(lines[i + 1]).toContain('de_ellas_reparaciones');
  });
});

const rec = (id: string, over: Partial<ServiceRecord>) =>
  ({ id, vehicleId: 'v', kind: 'reparacion', occurredAt: T, title: id, odometerKm: null, costPartsDop: 0, costLaborDop: 0, totalDop: 0, shop: '', doneBy: 'shop', system: null, warrantyUntilDate: null, warrantyUntilKm: null, ...over }) as ServiceRecord;

describe('repairsCsv', () => {
  it('one row per repair: who, shop, the cost split, the warranty', () => {
    const csv = repairsCsv([
      rec('own', { doneBy: 'self', shop: 'Taller de ejemplo', costPartsDop: 4500, totalDop: 4500, system: 'electrico', odometerKm: 51000 }),
      rec('shop', { shop: 'Taller de ejemplo', costPartsDop: 4000, costLaborDop: 2000, totalDop: 6000, warrantyUntilDate: '2026-06-13T12:00:00.000Z', warrantyUntilKm: 5000 }),
      rec('maint', { kind: 'mantenimiento', totalDop: 999 }),
    ]);
    const [head, own, shop, ...rest] = csv.replace(/^﻿/, '').split('\r\n');
    expect(head).toBe('fecha,titulo,sistema,quien,taller,odometro_km,piezas_dop,mano_obra_dop,total_dop,garantia_hasta,garantia_km');
    expect(own).toContain(',electrico,yo,,');
    // your own work has no shop, whatever text a record carried
    expect(own).not.toContain('Taller de ejemplo');
    expect(shop).toContain(',taller,Taller de ejemplo,');
    expect(shop).toContain('2026-06-13');
    expect(rest.filter(Boolean)).toEqual([]);
  });
});

describe('the book', () => {
  const raw = (services: NonNullable<RawDossier['services']>): RawDossier =>
    ({
      slug: null,
      visibility: 'private',
      show: { plate: false, vin: false, costs: true, odometer: true, maintenance: true, mods: false, track: false, story: false, status: false },
      vehicle: { name: 'AE85', make: null, model: null, year: null, color: null, nickname: null, chassis_code: null, engine_code: null, hero_media_id: null, plate: null, vin: null, story: null },
      photos: [],
      services,
    }) as unknown as RawDossier;

  it('lists the repairs with who did them, what they cost and the warranty', () => {
    const d = buildDossier(raw([
      { kind: 'reparacion', occurred_at: T, title: 'Alternador', total_dop: 4500, shop: '', done_by: 'self', warranty_until_date: null },
      { kind: 'reparacion', occurred_at: T, title: 'Frenos', total_dop: 6000, shop: 'Taller de ejemplo', done_by: 'shop', warranty_until_date: '2026-06-13T12:00:00.000Z' },
      { kind: 'mantenimiento', occurred_at: T, title: 'Aceite', total_dop: 1500 },
    ]));
    expect(d.repairs?.count).toBe(2);
    expect(d.repairs?.recent.map((r) => r.who)).toEqual(['Yo mismo', 'Taller de ejemplo']);
    expect(d.repairs?.recent[1].warranty).toBeTruthy();
    expect(d.repairs?.total).toBeTruthy();
    // maintenance keeps counting everything, repairs included, as before
    expect(d.maintenance?.count).toBe(3);
  });
  it('without costs the totals stay out; without repairs there is no section', () => {
    const noCosts = buildDossier({ ...raw([{ kind: 'reparacion', occurred_at: T, title: 'X', total_dop: null, done_by: 'self' }]), show: { ...raw([]).show, costs: false } });
    expect(noCosts.repairs?.total).toBeNull();
    expect(buildDossier(raw([{ kind: 'mantenimiento', occurred_at: T, title: 'Aceite' }])).repairs).toBeNull();
  });
});
