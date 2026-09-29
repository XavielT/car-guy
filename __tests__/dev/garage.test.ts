/**
 * The real-garage dev seed against a real SQLite (see helpers/sqlite.ts).
 *
 * docs/imp-28092026/fixtures/car-guy-v2.0-backup.sample.json was written by
 * this seed at Phase 0 (commit 1875302), on schema v1. It is frozen: it stands
 * for a v2.0.0 install, and rewriting it from today's schema would make the
 * migration test prove nothing.
 */
import type { TestDb } from '../helpers/sqlite';
import { buildBackup } from '@/lib/backup';
import { seedCatalog } from '@/lib/db/seed';
import { GARAGE_IDS, seedRealGarage } from '@/lib/dev/garage';

jest.mock('@/lib/db/client', () => {
  const helpers = require('../helpers/sqlite');
  const testDb = helpers.createTestDb();
  return { ...helpers.clientModule(testDb), testDb };
});
const db = (jest.requireMock('@/lib/db/client') as { testDb: TestDb }).testDb.sqlite;
const TODAY = new Date(2026, 8, 28);

type Row = Record<string, unknown>;
const all = (sql: string, ...p: string[]) => db.prepare(sql).all(...p) as Row[];

beforeAll(async () => {
  await seedCatalog();
  await seedRealGarage(TODAY);
});

describe('seedRealGarage', () => {
  it('writes the four vehicles with no real identifiers', () => {
    const rows = all('SELECT * FROM vehicle ORDER BY sort_order');
    expect(rows.map((r) => r.id)).toEqual(Object.values(GARAGE_IDS));
    expect(rows.map((r) => `${r.make} ${r.model} ${r.year}`)).toEqual([
      'Toyota Sprinter Trueno 1985',
      'Citroën DS3 2015',
      'Citroën C3 2003',
      'Volkswagen Jetta 2003',
    ]);
    for (const r of rows) {
      expect(r.plate ?? null).toBeNull();
      expect(r.vin ?? null).toBeNull();
    }
  });

  it('marks the Jetta sold and archived, with no reminders', () => {
    const [jetta] = all('SELECT * FROM vehicle WHERE id = ?', GARAGE_IDS.jetta);
    expect(jetta.sold_date).toBe('2021-01-01');
    expect(jetta.is_archived).toBe(1);
    expect(all('SELECT id FROM reminder WHERE vehicle_id = ?', GARAGE_IDS.jetta)).toHaveLength(0);
    expect(all('SELECT id FROM reminder WHERE vehicle_id = ?', GARAGE_IDS.ae85).length).toBeGreaterThan(0);
  });

  it('puts the history on the AE85 and the DS3, and the open tasks on the C3', () => {
    const count = (table: string, vehicleId: string) =>
      all(`SELECT id FROM ${table} WHERE vehicle_id = ?`, vehicleId).length;
    expect(count('fuel_log', GARAGE_IDS.ae85)).toBe(8);
    expect(count('fuel_log', GARAGE_IDS.ds3)).toBe(12);
    expect(count('service_record', GARAGE_IDS.ds3)).toBe(3);
    expect(count('service_record', GARAGE_IDS.ae85)).toBe(1);
    expect(count('task', GARAGE_IDS.c3)).toBe(4);
    expect(count('fuel_log', GARAGE_IDS.c3) + count('fuel_log', GARAGE_IDS.jetta)).toBe(0);

    const [{ km }] = all(
      "SELECT MAX(value_km) AS km FROM odometer_reading WHERE vehicle_id = ? AND deleted_at IS NULL",
      GARAGE_IDS.ae85,
    );
    expect(km).toBe(52_400);
  });

  it('is idempotent', async () => {
    const before = all('SELECT id FROM fuel_log').length;
    const lines = await seedRealGarage(TODAY);
    expect(lines[0]).toMatch(/ya está sembrado/);
    expect(all('SELECT id FROM fuel_log')).toHaveLength(before);
  });

  it('exports as a v2 backup with the new tables', async () => {
    const backup = await buildBackup();
    expect(backup.app).toBe('car-guy');
    expect(backup.version).toBe(2);
    expect(backup.tables.vehicle).toHaveLength(4);
    expect(backup.tables.mod).toHaveLength(5);
    expect(backup.tables.tire).toHaveLength(4);
    expect(backup.tables).not.toHaveProperty('dtc_code');
  });
});

describe('seedRealGarage — IMP 29092026 demo data', () => {
  it('gives all four cars a purchase price', () => {
    const rows = all('SELECT id, purchase_price FROM vehicle');
    expect(rows).toHaveLength(4);
    for (const r of rows) expect(Number(r.purchase_price)).toBeGreaterThan(0);
  });

  it('mixes full and partial fills among the DS3\'s last six', () => {
    const last6 = all('SELECT is_full_tank FROM fuel_log WHERE vehicle_id = ? ORDER BY occurred_at DESC LIMIT 6', GARAGE_IDS.ds3);
    const partials = last6.filter((r) => r.is_full_tank === 0).length;
    expect(partials).toBeGreaterThanOrEqual(2);
    expect(partials).toBeLessThan(6);
  });

  it('records one failed item on a DS3 weekly check', () => {
    const [check] = all('SELECT * FROM inspection WHERE vehicle_id = ?', GARAGE_IDS.ds3);
    expect(check.status).toBe('con_fallas');
    const failed = all("SELECT label_snapshot, note FROM inspection_result WHERE inspection_id = ? AND result = 'falla'", String(check.id));
    expect(failed).toHaveLength(1);
    expect(failed[0].label_snapshot).toBe('Luces');
  });

  it('puts costs on two standalone Trueno mods', () => {
    const costed = all(
      'SELECT name FROM mod WHERE vehicle_id = ? AND service_record_id IS NULL AND cost_part_dop + cost_labor_dop + cost_shipping_dop + cost_customs_dop > 0 ORDER BY name',
      GARAGE_IDS.ae85,
    );
    expect(costed.map((r) => r.name)).toEqual(['Aros 15x8 ET0', 'Gomas 195/50R15']);
  });
});

describe('seedRealGarage — schema v2', () => {
  it('writes identity, status and story', () => {
    const rows = Object.fromEntries(all('SELECT * FROM vehicle').map((r) => [r.id, r]));
    expect(rows[GARAGE_IDS.ae85]).toMatchObject({ nickname: 'hachi-gō', chassis_code: 'AE85', engine_code: '4A-GE 20V', drivetrain: 'rwd', origin: 'jdm' });
    expect(rows[GARAGE_IDS.c3].status).toBe('proyecto');
    expect(rows[GARAGE_IDS.jetta].status).toBe('vendido');
    expect(rows[GARAGE_IDS.jetta].story).toMatch(/álbum/);
  });

  it('gives the Jetta its 2018 → 2021 ownership', () => {
    const [own] = all('SELECT * FROM vehicle_ownership WHERE vehicle_id = ?', GARAGE_IDS.jetta);
    expect(own).toMatchObject({ acquired_at: '2018-01-01', sold_at: '2021-01-01' });
  });

  it('builds the AE85: mods with spec effects, wishlist, wheels, DOT-coded tires', () => {
    const mods = all('SELECT * FROM mod WHERE vehicle_id = ? ORDER BY name', GARAGE_IDS.ae85);
    expect(mods.map((m) => m.name)).toEqual([
      'Aros 15x8 ET0',
      'ECU tuneada',
      'Gomas 195/50R15',
      'Radiador y abanicos racing',
      'Swap 4A-GE 20V',
    ]);
    const swap = mods.find((m) => m.name === 'Swap 4A-GE 20V')!;
    expect(JSON.parse(swap.spec_effects as string)).toEqual({ engine_code: '4A-GE 20V', hp: 160 });
    // The radiator is the v2.0-style mejora record plus its mod, as migration v2 would leave it.
    const radiator = mods.find((m) => String(m.name).startsWith('Radiador'))!;
    expect(radiator.id).toBe(`mod_${radiator.service_record_id}`);

    expect(all('SELECT * FROM wishlist_item')[0]).toMatchObject({ name: 'Coilovers BC Racing BR', est_price_foreign: 1050, currency: 'USD' });
    expect(all('SELECT * FROM tire WHERE dot_code = ?', '2323')).toHaveLength(4);
    const [ficha] = all('SELECT * FROM vehicle_specsheet WHERE id = ?', GARAGE_IDS.ae85);
    expect(JSON.parse(ficha.stock as string)).toMatchObject({ engine_code: '3A-U', wheel_f: '13x5' });
  });

  it('shows the history once: the radiator as a mod, milestones as hitos', () => {
    const feed = all('SELECT kind, title FROM history_feed WHERE vehicle_id = ?', GARAGE_IDS.ae85);
    expect(feed.filter((r) => r.title === 'Radiador y abanicos racing')).toEqual([{ kind: 'mod', title: 'Radiador y abanicos racing' }]);
    expect(feed).toContainEqual({ kind: 'hito', title: 'Swap 4A-GE 20V' });
  });
});
