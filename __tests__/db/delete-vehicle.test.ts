/**
 * `deleteVehicleCascade` against a real SQLite: node's built-in `node:sqlite`,
 * with the app's own migrations. Found on a phone — deleting a vehicle from its
 * profile tombstoned the vehicle row and nothing else, so its reminders, tasks,
 * checks and readings lived on and would have been pushed by the next sync.
 */
import { DatabaseSync } from 'node:sqlite';

import { MIGRATIONS } from '@/lib/db/migrations';

const sqlite = new DatabaseSync(':memory:');
sqlite.exec('PRAGMA foreign_keys = ON');
for (const migration of MIGRATIONS) for (const sql of migration.up) sqlite.exec(sql);

/** The slice of expo-sqlite's async API the cascade uses. */
const mockHandle = {
  runAsync: async (sql: string, params: unknown[] = []) =>
    sqlite.prepare(sql).run(...(params as never[])),
};

jest.mock('@/lib/db/client', () => ({
  enqueue: (fn: (db: unknown) => Promise<unknown>) => fn(mockHandle),
  now: () => '2026-09-25T12:00:00.000Z',
  getDb: async () => mockHandle,
}));

// eslint-disable-next-line import/first
import { deleteVehicleCascade } from '@/lib/db/vehicleOps';

const T = '2026-09-01T12:00:00.000Z';
/**
 * Inserts the columns given, and a filler for every other NOT NULL column
 * without a default — so the test names only the links it is about, and keeps
 * working when a table grows a column.
 */
const insert = (table: string, row: Record<string, unknown>) => {
  const info = sqlite.prepare(`PRAGMA table_info(${table})`).all() as {
    name: string;
    type: string;
    notnull: number;
    dflt_value: unknown;
  }[];
  const full: Record<string, unknown> = { created_at: T, updated_at: T };
  for (const col of info) {
    if (col.notnull && col.dflt_value == null && !(col.name in row) && !(col.name in full)) {
      full[col.name] = /INT|REAL/i.test(col.type) ? 0 : 'x';
    }
  }
  const known = new Set(info.map((c) => c.name));
  for (const [key, value] of Object.entries(row)) if (known.has(key)) full[key] = value;
  const cols = Object.keys(full);
  sqlite
    .prepare(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`)
    .run(...(Object.values(full) as never[]));
};

/** One vehicle with a live row in every table that can belong to it. */
function seedVehicle(v: string) {
  insert('vehicle', { id: v, name: v, type: 'carro', default_fuel_type: 'regular' });
  insert('vehicle_spec', { id: `${v}_spec`, vehicle_id: v, label: 'Aceite', value: '5W-30' });
  insert('odometer_reading', { id: `${v}_odo`, vehicle_id: v, occurred_at: T, value_km: 1000, source: 'manual' });
  insert('fuel_log', {
    id: `${v}_fuel`, vehicle_id: v, occurred_at: T, fuel_type: 'regular',
    volume_gal: 10, price_per_gal_dop: 280, total_dop: 2800,
  });
  insert('service_record', {
    id: `${v}_svc`, vehicle_id: v, kind: 'mantenimiento', occurred_at: T, title: 'Aceite',
  });
  insert('service_record_item', { id: `${v}_svc_item`, service_record_id: `${v}_svc`, service_type_id: 'aceite_motor' });
  insert('part', { id: `${v}_part`, service_record_id: `${v}_svc`, name: 'Filtro' });
  insert('expense', { id: `${v}_exp`, vehicle_id: v, occurred_at: T, category: 'otro', amount_dop: 100 });
  insert('reminder', { id: `${v}_rem`, vehicle_id: v, title: 'Aceite', metric: 'date' });
  insert('inspection_template', { id: `carro_semanal@${v}`, vehicle_id: v, name: 'Semanal', cadence: 'semanal' });
  insert('inspection_item', {
    id: `carro_semanal__0@${v}`, template_id: `carro_semanal@${v}`, group_name: 'Fluidos', label: 'Refrigerante',
  });
  insert('inspection', { id: `${v}_insp`, vehicle_id: v, template_id: `carro_semanal@${v}`, occurred_at: T, status: 'con_fallas' });
  insert('inspection_result', {
    id: `${v}_insp__item`, inspection_id: `${v}_insp`, item_id: `carro_semanal__0@${v}`,
    label_snapshot: 'Refrigerante', result: 'falla',
  });
  insert('task', { id: `${v}_task`, vehicle_id: v, title: 'Revisar refrigerante', kind: 'reparacion' });
  insert('document', { id: `${v}_doc`, vehicle_id: v, kind: 'seguro', title: 'Póliza' });
  for (const [table, owner] of [
    ['vehicle', v],
    ['service_record', `${v}_svc`],
    ['inspection_result', `${v}_insp__item`],
    ['document', `${v}_doc`],
  ]) {
    insert('media', { id: `${v}_media_${table}`, owner_table: table, owner_id: owner, kind: 'photo', mime: 'image/jpeg' });
  }
}

const OWNED = [
  'vehicle', 'vehicle_spec', 'odometer_reading', 'fuel_log', 'service_record', 'service_record_item',
  'part', 'expense', 'reminder', 'inspection_template', 'inspection_item', 'inspection',
  'inspection_result', 'task', 'document', 'media',
];

const live = (table: string, v: string) =>
  (sqlite
    .prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE deleted_at IS NULL AND id LIKE ?`)
    .get(`%${v}%`) as { n: number }).n;

describe('deleteVehicleCascade', () => {
  beforeAll(() => {
    insert('service_type', { id: 'aceite_motor', name: 'Aceite', category: 'motor' });
    seedVehicle('veh_a');
    seedVehicle('veh_b');
  });

  it('tombstones the vehicle and every row it owns', async () => {
    await deleteVehicleCascade('veh_a');
    const leftovers = OWNED.filter((table) => live(table, 'veh_a') > 0);
    expect(leftovers).toEqual([]);
  });

  it('marks every tombstone dirty so sync carries the delete', () => {
    for (const table of OWNED) {
      const dirty = sqlite
        .prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE id LIKE '%veh_a%' AND (synced_at IS NOT NULL OR deleted_at IS NULL)`)
        .get() as { n: number };
      expect(`${table}:${dirty.n}`).toBe(`${table}:0`);
    }
  });

  it('leaves every other vehicle alone', () => {
    const touched = OWNED.filter((table) => live(table, 'veh_b') === 0);
    expect(touched).toEqual([]);
  });

  it('leaves the shared catalogue alone', () => {
    expect(live('service_type', 'aceite_motor')).toBe(1);
  });
});
