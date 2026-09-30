/**
 * "Lo que me ha costado" (IMP 29092026 note 8): `ownershipCost` in
 * lib/domain/costs.ts, against a real SQLite (helpers/sqlite.ts) so the
 * queries that feed it are tested too.
 *
 * Every expected value below was worked out by hand before the code ran.
 */
import type { TestDb } from '../helpers/sqlite';
import { seedCatalog } from '@/lib/db/seed';
import {
  expenses,
  fuel,
  inventory,
  mods,
  odometer,
  parts,
  serviceRecords,
  trackEvents,
  vehicles,
} from '@/lib/db/repos';
import { garageOwnershipCost, spendRows, vehicleOwnershipCost, vehicleStats } from '@/lib/db/statsQueries';
import { garageCost, inventoryCounts, isEmptyCost, ownershipCost, USED_IN_MOD_PREFIX } from '@/lib/domain/costs';
import { GARAGE_IDS, seedRealGarage } from '@/lib/dev/garage';
import { costsCsv } from '@/lib/export/csv';
import { es } from '@/lib/i18n/es';

jest.mock('@/lib/db/client', () => {
  const helpers = require('../helpers/sqlite');
  const testDb = helpers.createTestDb();
  return { ...helpers.clientModule(testDb), testDb };
});
void (jest.requireMock('@/lib/db/client') as { testDb: TestDb });

const TODAY_DATE = new Date(2026, 8, 28);
const TODAY = '2026-09-28T12:00:00.000Z';
const V = 'v_costs';

/**
 * The every-category car:
 *   compra                                  500,000.00
 *   mods        v2.0 "mejora" record  10,000 (its linked mod is not counted again)
 *               instalado 15,000 + 2,000 + 1,500 + 1,500 = 20,000
 *               quitado 5,000 · vendido 8,000 − sold for 3,000
 *               planeado 50,000 and a deleted 9,999: not counted
 *               → 10,000 + 20,000 + 5,000 + 8,000 − 3,000 = 40,000
 *   mantenimiento  4,000 (parts 2,500 itemised — inside the record, not added) + reparación 12,000 = 16,000
 *   combustible    3,000 + 3,500 = 6,500
 *   pista          entrada 2,500 + gasolina 3,000 + otros 1,000 = 6,500
 *   otros          seguro 18,000 + lavado 500 + inventory 4,000 = 22,500
 *                  (not: inventory used in a mod 7,000, garage stock 9,000, no cost)
 *   → spend 91,500 · total 591,500
 *   odometer 9,000 → 11,000 = 2,000 km → 295.75 RD$/km, 45.75 without the purchase
 *   desde la compra, 2025-09-18 → 375 días / 30.44 = 12 meses → 49,291.67 al mes
 */
async function seedEveryCategory() {
  await vehicles.upsertRaw({
    id: V,
    name: 'Every',
    type: 'carro',
    defaultFuelType: 'regular',
    notes: '',
    sortOrder: 9,
    purchasePrice: 500_000,
    purchaseDate: '2025-09-18T12:00:00.000Z',
  } as never);
  await odometer.upsert({ id: 'odo_init_vc', vehicleId: V, occurredAt: '2025-09-18T12:00:00.000Z', valueKm: 9_000, source: 'manual', sourceId: V } as never);

  const fill = (id: string, occurredAt: string, odometerKm: number, totalDop: number) =>
    fuel.upsert({ id, vehicleId: V, occurredAt, odometerKm, volume: 10, pricePerUnit: totalDop / 10, totalDop, fuelType: 'regular', isFullTank: true, missedPrevious: false, station: '', notes: '' } as never);
  await fill('vc_f1', '2026-01-10T12:00:00.000Z', 10_000, 3_000);
  await fill('vc_f2', '2026-05-10T12:00:00.000Z', 11_000, 3_500);

  const service = (id: string, kind: string, costPartsDop: number, costLaborDop: number) =>
    serviceRecords.upsert({ id, vehicleId: V, kind, occurredAt: '2026-03-01T12:00:00.000Z', odometerKm: null, title: kind, description: '', costPartsDop, costLaborDop, totalDop: costPartsDop + costLaborDop, shop: '' } as never);
  await service('vc_s1', 'mantenimiento', 2_500, 1_500);
  await parts.upsert({ id: 'vc_p1', serviceRecordId: 'vc_s1', name: 'Filtro', quantity: 1, unitCostDop: 2_500 } as never);
  await service('vc_s2', 'reparacion', 9_000, 3_000);
  await service('vc_s3', 'mejora', 10_000, 0);

  const mod = (id: string, status: string, costs: Record<string, number>, extra: Record<string, unknown> = {}) =>
    mods.upsert({ id, vehicleId: V, categoryId: 'motor', name: id, status, installedAt: '2026-04-01T12:00:00.000Z', ...costs, ...extra } as never);
  await mod('vc_m_linked', 'instalado', { costPartDop: 10_000 }, { serviceRecordId: 'vc_s3' });
  await mod('vc_m_inst', 'instalado', { costPartDop: 15_000, costLaborDop: 2_000, costShippingDop: 1_500, costCustomsDop: 1_500 }, { priceForeign: 250, currency: 'USD', fxRateToDop: 60 });
  await mod('vc_m_quitado', 'quitado', { costPartDop: 5_000 });
  await mod('vc_m_vendido', 'vendido', { costPartDop: 8_000 }, { soldPriceDop: 3_000, removedAt: '2026-08-01T12:00:00.000Z' });
  await mod('vc_m_planeado', 'planeado', { costPartDop: 50_000 });
  await mod('vc_m_deleted', 'instalado', { costPartDop: 9_999 }, { deletedAt: '2026-06-01T12:00:00.000Z' });

  const expense = (id: string, category: string, amountDop: number) =>
    expenses.upsert({ id, vehicleId: V, occurredAt: '2026-02-01T12:00:00.000Z', odometerKm: null, category, amountDop, description: '', vendor: '' } as never);
  await expense('vc_e1', 'seguro', 18_000);
  await expense('vc_e2', 'lavado', 500);

  await trackEvents.upsert({ id: 'vc_t1', vehicleId: V, occurredAt: '2026-06-01T12:00:00.000Z', title: 'Track day', discipline: 'track_day', entryFeeDop: 2_500, fuelCostDop: 3_000, otherCostDop: 1_000, notes: '' } as never);

  const item = (id: string, ownerVehicleId: string | null, costDop: number | null, notes = '') =>
    inventory.upsert({ id, ownerVehicleId, kind: 'pieza', name: id, qty: 1, condition: 'nuevo', costDop, acquiredAt: '2026-07-01T12:00:00.000Z', fitsVehicleIds: '[]', notes } as never);
  await item('vc_i_counts', V, 4_000);
  await item('vc_i_used', V, 7_000, `Llegó en caja\n${es.inventory.usedIn('vc_m_inst')}`);
  await item('vc_i_stock', null, 9_000);
  await item('vc_i_free', V, null);
}

beforeAll(async () => {
  await seedCatalog();
  await seedRealGarage(TODAY_DATE);
  await seedEveryCategory();
});

describe('ownershipCost — a car with every category', () => {
  it('adds up each bucket as worked out by hand', async () => {
    const cost = await vehicleOwnershipCost(V, TODAY);
    expect(cost).not.toBeNull();
    expect(cost!.purchasePrice).toBe(500_000);
    expect(cost!.byCategory).toEqual({ mods: 40_000, mantenimiento: 16_000, combustible: 6_500, pista: 6_500, otros: 22_500 });
    expect(cost!.modsSold).toBe(3_000);
    expect(cost!.spend).toBe(91_500);
    expect(cost!.total).toBe(591_500);
  });

  it('divides by the odometer span, with and without the purchase', async () => {
    const cost = (await vehicleOwnershipCost(V, TODAY))!;
    expect(cost.distanceKm).toBe(2_000);
    expect(cost.perKm).toBe(295.75);
    expect(cost.runningPerKm).toBe(45.75);
  });

  it('counts from the purchase date', async () => {
    const cost = (await vehicleOwnershipCost(V, TODAY))!;
    expect(cost.since).toBe('2025-09-18T12:00:00.000Z');
    expect(cost.sinceBasis).toBe('compra');
    expect(cost.monthsOwned).toBe(12);
    expect(cost.costPerMonth).toBe(49_291.67);
  });

  it('is the number Cifras and the report show — one function, one number', async () => {
    const stats = await vehicleStats(V, 'mes', TODAY);
    expect(stats!.ownership).toEqual(await vehicleOwnershipCost(V, TODAY));
    // And it is purchase + every lifetime spend row + inventory − mod sales, nothing else.
    const rows = await spendRows(V);
    expect(rows.reduce((t, r) => t + r.amountDop, 0) + 500_000 + 4_000 - 3_000).toBe(stats!.ownership!.total);
  });
});

describe('ownershipCost — the dev seed', () => {
  /**
   * The Trueno AE85 (lib/dev/garage.ts), by hand:
   *   compra 350,000 (placeholder), no date
   *   combustible 8 × 11.2 gal at 322 + (i % 3) × 3 for i = 7…0
   *     → prices 325, 322, 328, 325, 322, 328, 325, 322 = 2,597 × 11.2 = 29,086.40
   *   mods  radiador (the v2.0 mejora record, 14,500 + 2,500 = 17,000; its mod is linked, not re-added)
   *         + aros 28,800 + 3,500 = 32,300 (USD 480 × 60, stored in RD$) + gomas 16,000 + 800 = 16,800
   *         + swap and ECU at 0 → 66,100
   *   otros multa 1,500 + parqueo 200 = 1,700
   *   pista drift day 2,500 + 3,800 + 3,500 = 9,800
   *   → 350,000 + 29,086.40 + 66,100 + 1,700 + 9,800 = 456,686.40
   *   odometer 49,040 → 52,400 = 3,360 km → 135.92 RD$/km
   */
  it("the Trueno's total equals the seed's sum", async () => {
    const cost = (await vehicleOwnershipCost(GARAGE_IDS.ae85, TODAY))!;
    expect(cost.byCategory).toEqual({ mods: 66_100, mantenimiento: 0, combustible: 29_086.4, pista: 9_800, otros: 1_700 });
    expect(cost.total).toBe(456_686.4);
    expect(cost.distanceKm).toBe(3_360);
    expect(cost.perKm).toBe(135.92);
    // No purchase date: "desde el primer registro" — the swap (15 ago 2025, a RD$ 0 mod row) is the oldest.
    expect(cost.sinceBasis).toBe('primer_registro');
    expect(cost.since).toBe('2025-08-15T12:00:00.000Z');
  });

  it('the garage total is the sum of the cards, and the CSV carries both', async () => {
    const garage = await garageOwnershipCost(TODAY);
    const sum = garage.vehicles.reduce((t, v) => t + v.cost.total, 0);
    expect(garage.total).toBeCloseTo(sum, 2);
    expect(garage.vehicles.map((v) => v.vehicleId)).toEqual(expect.arrayContaining([GARAGE_IDS.ae85, GARAGE_IDS.ds3, V]));

    const csv = costsCsv(garage);
    expect(csv).toContain('Trueno AE85,total,456686.40');
    expect(csv).toContain(`garaje,total,${garage.total.toFixed(2)}`);
  });
});

describe('ownershipCost — pure edges', () => {
  const vehicle = { purchaseDate: null, purchasePrice: null, soldDate: null, soldPrice: null };

  it('is empty with nothing recorded, and the garage leaves such a car out', () => {
    const cost = ownershipCost({ vehicle, spend: [] }, TODAY);
    expect(isEmptyCost(cost)).toBe(true);
    expect(cost.perKm).toBeNull();
    expect(cost.since).toBeNull();
    expect(garageCost([{ vehicleId: 'x', name: 'x', cost }]).vehicles).toHaveLength(0);
  });

  it('subtracts the sale of the car itself', () => {
    const cost = ownershipCost(
      {
        vehicle: { purchaseDate: '2018-01-01', purchasePrice: 420_000, soldDate: '2021-01-01', soldPrice: 300_000 },
        spend: [{ occurredAt: '2019-01-01T12:00:00.000Z', category: 'reparacion', amountDop: 20_000 }],
      },
      TODAY,
    );
    expect(cost.total).toBe(140_000);
    expect(cost.byCategory.mantenimiento).toBe(20_000);
  });

  it('knows the note "Usar en un mod" leaves on an inventory item', () => {
    expect(es.inventory.usedIn('Aros').startsWith(USED_IN_MOD_PREFIX)).toBe(true);
    expect(inventoryCounts({ costDop: 100, notes: es.inventory.usedIn('Aros') })).toBe(false);
    expect(inventoryCounts({ costDop: 100, notes: 'Usado. En buen estado' })).toBe(true);
    expect(inventoryCounts({ costDop: 0, notes: '' })).toBe(false);
  });
});
