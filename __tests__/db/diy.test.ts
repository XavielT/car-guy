/**
 * The DIY block against a real SQLite with the real-garage seed (IMP 28092026
 * Phase 5): the DS3's preset, verification, the OBD log linked to a repair,
 * the feed's obd rows (migration v4) and a contact's linked records.
 */
import type { TestDb } from '../helpers/sqlite';
import {
  applyVin,
  contactLinks,
  createRepairForDtc,
  loadPreset,
  logDtc,
  readFicha,
  saveContact,
  setFichaValue,
  setVerified,
} from '@/lib/db/diyQueries';
import { LATEST_VERSION } from '@/lib/db/migrations';
import { serviceRecords } from '@/lib/db/repos';
import { seedCatalog } from '@/lib/db/seed';
import { GARAGE_IDS, seedRealGarage } from '@/lib/dev/garage';

jest.mock('@/lib/db/client', () => {
  const helpers = require('../helpers/sqlite');
  const testDb = helpers.createTestDb();
  return { ...helpers.clientModule(testDb), testDb };
});
const db = (jest.requireMock('@/lib/db/client') as { testDb: TestDb }).testDb.sqlite;
const row = (sql: string, ...p: string[]) => db.prepare(sql).get(...p) as Record<string, unknown>;
const DS3 = GARAGE_IDS.ds3;

beforeAll(async () => {
  await seedCatalog();
  await seedRealGarage(new Date(2026, 8, 28));
});

it('the schema is at v4 (the feed test below proves the harness applied it)', () => {
  expect(LATEST_VERSION).toBe(7);
});

it('the DS3 preset fills only what is empty, as PRESET, unverified', async () => {
  // The seed already has bolt_pattern and fuel_tank_l (source preset) — a user value must survive.
  await setFichaValue(DS3, 'brake_fluid', 'DOT 5.1');
  const n = await loadPreset(DS3, 'ds3_sa_ep6');
  const f = await readFicha(DS3);
  expect(n).toBe(3); // center bore, lug thread, oil spec
  expect(f.values).toMatchObject({ bolt_pattern: '4x108', center_bore_mm: 65.1, lug_thread: 'M12x1.25', brake_fluid: 'DOT 5.1', fuel_tank_l: 50, oil_spec: 'PSA B71 2290', oil_capacity_l: null });
  expect(f.sources).toMatchObject({ center_bore_mm: 'preset', lug_thread: 'preset', oil_spec: 'preset', brake_fluid: 'user' });
  expect(f.verified).toEqual([]);
  expect(row('SELECT preset_id FROM vehicle_specsheet WHERE id = ?', DS3)).toEqual({ preset_id: 'ds3_sa_ep6' });
});

it('verifying two fields, and a typed value is TÚ and no longer verified', async () => {
  await setVerified(DS3, 'bolt_pattern', true);
  await setVerified(DS3, 'center_bore_mm', true);
  expect((await readFicha(DS3)).verified).toEqual(['bolt_pattern', 'center_bore_mm']);
  await setFichaValue(DS3, 'center_bore_mm', 65.2);
  const f = await readFicha(DS3);
  expect(f.verified).toEqual(['bolt_pattern']);
  expect(f.sources.center_bore_mm).toBe('user');
});

it('a VIN decode fills only empty vehicle fields', async () => {
  const filled = await applyVin(GARAGE_IDS.c3, { make: 'HONDA', model: 'Accord', year: 2003, cylinders: 6, displacementCc: 2999, fuel: 'Gasoline', transmission: 'automatica', drivetrain: 'fwd', engineModel: null });
  // The C3 has make/model/year already; transmission is set by the seed too.
  expect(row('SELECT make, model, year FROM vehicle WHERE id = ?', GARAGE_IDS.c3)).toEqual({ make: 'Citroën', model: 'C3', year: 2003 });
  expect(filled).not.toContain('marca');
});

it('P0301 logged, linked to a new repair, and in the feed as an obd row', async () => {
  const event = (await logDtc({ vehicleId: DS3, code: 'p0301', seenAt: '2026-09-20T12:00:00.000Z', odometerKm: 51_800 }))!;
  expect(event.code).toBe('P0301');
  const repair = await createRepairForDtc(event, 'Falla de encendido en el cilindro 1');
  expect(row('SELECT repair_record_id FROM vehicle_dtc_event WHERE id = ?', event.id)).toEqual({ repair_record_id: repair.id });
  expect(await serviceRecords.getById(repair.id)).toMatchObject({ kind: 'reparacion', title: 'Código P0301', odometerKm: 51_800 });
  expect(row("SELECT kind, title, subtitle FROM history_feed WHERE id = ?", event.id)).toEqual({ kind: 'obd', title: 'P0301', subtitle: 'abierto' });
  // The mod rows keep v3's status subtitle.
  expect(row("SELECT subtitle FROM history_feed WHERE id = 'dev_mod_swap'").subtitle).toMatch(/^instalado\|/);
});

it('a contact lists the services and mods it did', async () => {
  const tony = row("SELECT id FROM contact WHERE name = 'Taller de Tony'").id as string;
  const other = await saveContact({ name: 'Gomera La 27', kind: 'gomera', phone: '809-555-1234' });
  await serviceRecords.upsert({ id: 'srv_contact', vehicleId: DS3, kind: 'mantenimiento', occurredAt: '2026-09-01T12:00:00.000Z', title: 'Balanceo', totalDop: 800, costPartsDop: 0, costLaborDop: 800, shop: 'Gomera La 27', contactId: other.id, deletedAt: null });
  expect((await contactLinks(other.id)).map((l) => [l.kind, l.title])).toEqual([['servicio', 'Balanceo']]);
  // The seed's swap and ECU were done at Tony's.
  expect((await contactLinks(tony)).filter((l) => l.kind === 'mod').map((l) => l.title).sort()).toEqual(['ECU tuneada', 'Swap 4A-GE 20V']);
});
