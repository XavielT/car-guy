/**
 * "Borrar datos locales" against a real SQLite with foreign keys on — the
 * setting under which it used to fail and roll back on any phone with data.
 */
import type { TestDb } from '../helpers/sqlite';
import { resetDatabase } from '@/lib/db/reset';
import { ALL_TABLES } from '@/lib/db/repos';

jest.mock('@/lib/db/client', () => {
  const helpers = require('../helpers/sqlite');
  const testDb = helpers.createTestDb();
  return { ...helpers.clientModule(testDb), testDb };
});
const db = (jest.requireMock('@/lib/db/client') as { testDb: TestDb }).testDb.sqlite;

const T = '2026-09-25T12:00:00.000Z';
function insert(table: string, row: Record<string, unknown>) {
  const info = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string; type: string; notnull: number; dflt_value: unknown }[];
  const full: Record<string, unknown> = { created_at: T, updated_at: T };
  for (const c of info) if (c.notnull && c.dflt_value == null && !(c.name in row) && !(c.name in full)) full[c.name] = /INT|REAL/i.test(c.type) ? 0 : 'x';
  Object.assign(full, row);
  const cols = Object.keys(full);
  db.prepare(`INSERT INTO ${table} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`).run(...(Object.values(full) as never[]));
}

it('clears every table even when rows reference each other', async () => {
  insert('vehicle', { id: 'v' });
  insert('service_type', { id: 'st' });
  insert('odometer_reading', { id: 'o', vehicle_id: 'v' });
  insert('fuel_log', { id: 'f', vehicle_id: 'v' });
  insert('service_record', { id: 's', vehicle_id: 'v' });
  insert('service_record_item', { id: 'si', service_record_id: 's', service_type_id: 'st' });
  insert('part', { id: 'p', service_record_id: 's' });
  insert('inspection_template', { id: 't', vehicle_id: 'v' });
  insert('inspection_item', { id: 'i', template_id: 't' });
  insert('inspection', { id: 'ins', vehicle_id: 'v', template_id: 't' });
  insert('inspection_result', { id: 'r', inspection_id: 'ins', item_id: 'i' });
  insert('task', { id: 'tk', vehicle_id: 'v' });
  db.prepare(`INSERT INTO setting (key, value, updated_at) VALUES ('active_vehicle_id', '"v"', ?)`).run(T);

  await resetDatabase();

  const left = [...ALL_TABLES, 'setting'].filter(
    (t) => (db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get() as { n: number }).n > 0,
  );
  expect(left).toEqual([]);
});
