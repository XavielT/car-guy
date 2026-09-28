/**
 * The real-garage dev seed against a real SQLite (see helpers/sqlite.ts).
 *
 * With WRITE_FIXTURE=1 it also writes the v2.0 backup fixture PROMPT-01's
 * migration test imports:
 *   WRITE_FIXTURE=1 npx jest __tests__/dev/garage.test.ts
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

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

  it('exports as a v2 backup (and writes the fixture on request)', async () => {
    const backup = await buildBackup();
    expect(backup.app).toBe('car-guy');
    expect(backup.version).toBe(2);
    expect(backup.tables.vehicle).toHaveLength(4);

    if (process.env.WRITE_FIXTURE === '1') {
      const out = join(__dirname, '../../docs/imp-28092026/fixtures/car-guy-v2.0-backup.sample.json');
      writeFileSync(out, JSON.stringify(backup, null, 2) + '\n');
    }
  });
});
