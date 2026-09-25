import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { MIGRATIONS } from '@/lib/db/migrations';
import { BOOLEAN_COLUMNS, conflictTarget, SYNC_TABLES } from '@/lib/sync/tables';

/**
 * The local schema and the cloud schema have to agree, column for column, or
 * sync fails one table at a time in production with a PostgREST error nobody
 * sees until a user reports missing data.
 *
 * Nothing enforces that agreement: `sql/002_schema_carguy.sql` is applied by
 * hand in the Supabase SQL editor and has no connection to `lib/db/migrations.ts`
 * beyond someone having written both. This test is that connection. It parses
 * the CREATE TABLE statements out of each and compares them, so a column added
 * to SQLite in a later phase fails here until the cloud mirror gains it too.
 *
 * It reads the .sql file from disk on purpose. Importing it is impossible and
 * copying its column list into a fixture would just move the drift somewhere
 * less visible.
 */

const SQL_PATH = join(__dirname, '../../sql/002_schema_carguy.sql');

/** Column names out of `CREATE TABLE <name> ( … )`, as they appear. */
function parseColumns(sql: string, open: RegExp): Map<string, Set<string>> {
  const tables = new Map<string, Set<string>>();
  let match: RegExpExecArray | null;

  while ((match = open.exec(sql)) !== null) {
    const table = match[1];
    // Walk from the opening paren to its match, so a `(` inside a type or a
    // default does not end the block early.
    let depth = 0;
    let index = open.lastIndex - 1;
    let start = -1;
    for (; index < sql.length; index++) {
      if (sql[index] === '(') {
        if (depth === 0) start = index + 1;
        depth++;
      } else if (sql[index] === ')') {
        depth--;
        if (depth === 0) break;
      }
    }
    const body = sql.slice(start, index);

    const columns = new Set<string>();
    for (const line of body.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('--')) continue;
      // Table-level constraints, not columns.
      if (/^(primary key|unique|check|foreign key|constraint)\b/i.test(trimmed)) continue;

      // `a TEXT, b TEXT` on one line — the local schema does this.
      for (const part of trimmed.split(',')) {
        const name = part.trim().split(/\s+/)[0];
        if (/^[a-z_][a-z0-9_]*$/.test(name)) columns.add(name);
      }
    }
    if (columns.size) tables.set(table, columns);
  }

  return tables;
}

const localSql = MIGRATIONS.flatMap((migration) => migration.up).join('\n');
const localTables = parseColumns(localSql, /CREATE TABLE (\w+)\s*\(/gi);
const cloudTables = parseColumns(readFileSync(SQL_PATH, 'utf8'), /create table if not exists carguy\.(\w+)\s*\(/gi);

/** Local bookkeeping that is deliberately absent from the cloud (ADR-03). */
const NEVER_IN_CLOUD = new Set(['synced_at', 'blob']);

describe('the parser itself', () => {
  it('found both schemas — an empty map would make every test below vacuous', () => {
    expect(localTables.size).toBeGreaterThan(10);
    expect(cloudTables.size).toBeGreaterThan(10);
  });

  it('reads a known table correctly', () => {
    expect(localTables.get('fuel_log')).toContain('missed_previous');
    expect(cloudTables.get('fuel_log')).toContain('missed_previous');
  });
});

describe('every synced table exists in both schemas', () => {
  for (const table of SYNC_TABLES) {
    it(`${table.name}`, () => {
      expect(localTables.has(table.name)).toBe(true);
      expect(cloudTables.has(table.name)).toBe(true);
    });
  }
});

describe('every local column has a home in the cloud', () => {
  for (const table of SYNC_TABLES) {
    // `setting` is keyed by (user_id, key) in the cloud and by `key` locally;
    // it is the one table whose shapes differ by design.
    if (table.name === 'setting') continue;

    it(`${table.name} loses nothing on the way up`, () => {
      const localColumns = localTables.get(table.name);
      const cloudColumns = cloudTables.get(table.name);
      expect(localColumns).toBeDefined();
      expect(cloudColumns).toBeDefined();

      const missing = [...localColumns!].filter(
        (column) => !NEVER_IN_CLOUD.has(column) && !cloudColumns!.has(column),
      );
      expect(missing).toEqual([]);
    });
  }
});

describe('the cloud adds exactly what the spec says it adds', () => {
  for (const table of SYNC_TABLES) {
    if (table.name === 'setting') continue;

    it(`${table.name} carries user_id and server_updated_at, and no bytes`, () => {
      const cloudColumns = cloudTables.get(table.name)!;
      expect(cloudColumns.has('user_id')).toBe(true);
      expect(cloudColumns.has('server_updated_at')).toBe(true);
      // The two columns that must never leave the device.
      expect(cloudColumns.has('synced_at')).toBe(false);
      expect(cloudColumns.has('blob')).toBe(false);
    });
  }
});

describe('the boolean map matches the cloud schema exactly', () => {
  /**
   * The one hand-written table in the sync layer, and therefore the one most
   * likely to rot. SQLite has no boolean; PostgREST sends real true/false. A
   * column missing from the map syncs as the *string* "true" into an INTEGER
   * column, where `is_full_tank = 1` then matches nothing — silent, total, and
   * invisible until someone notices their fuel history is empty.
   */
  const sql = readFileSync(SQL_PATH, 'utf8');

  /** Every `<name> boolean` column, grouped by the table it appears in. */
  function booleansFromSql(): Record<string, string[]> {
    const out: Record<string, string[]> = {};
    let table: string | null = null;
    for (const line of sql.split('\n')) {
      const open = line.match(/create table if not exists carguy\.(\w+)/i);
      if (open) {
        table = open[1];
        continue;
      }
      if (/^\);/.test(line.trim())) table = null;
      const column = line.trim().match(/^(\w+)\s+boolean\b/i);
      if (table && column) (out[table] ??= []).push(column[1]);
    }
    return out;
  }

  const fromSql = booleansFromSql();

  it('found the boolean columns — an empty parse would pass vacuously', () => {
    expect(Object.keys(fromSql).length).toBeGreaterThan(3);
  });

  it('declares every boolean column the cloud has, and no others', () => {
    const sortedMap = Object.fromEntries(
      Object.entries(BOOLEAN_COLUMNS).map(([t, c]) => [t, [...c].sort()]),
    );
    const sortedSql = Object.fromEntries(
      Object.entries(fromSql).map(([t, c]) => [t, [...c].sort()]),
    );
    expect(sortedMap).toEqual(sortedSql);
  });
});

describe("a deleted user's rows go with them", () => {
  const cascade = readFileSync(join(__dirname, '../../sql/007_user_cascade.sql'), 'utf8');

  it('every synced table is covered by the cascade migration', () => {
    // Found by exercising the system, not by reading it: carguy.setting still
    // held rows for users that had been deleted, because only carguy.profiles
    // was written with a foreign key to auth.users. A table missing from this
    // list keeps its rows forever, unreachable — no session can ever match
    // their user_id again, so RLS hides them from everyone.
    for (const table of SYNC_TABLES) {
      expect(cascade).toContain(`'${table.name}'`);
    }
  });

  it('cascades rather than restricting', () => {
    expect(cascade).toMatch(/on delete cascade/i);
    expect(cascade).not.toMatch(/on delete restrict/i);
  });

  it('clears existing orphans before adding the constraint', () => {
    // Postgres refuses to add a foreign key while rows violate it, so the
    // delete has to come first in the same migration.
    const deleteAt = cascade.indexOf('delete from carguy');
    const constraintAt = cascade.indexOf('add constraint');
    expect(deleteAt).toBeGreaterThan(-1);
    expect(deleteAt).toBeLessThan(constraintAt);
  });
});

describe('sql/002 keeps its safety properties', () => {
  const sql = readFileSync(SQL_PATH, 'utf8');
  /**
   * Comments stripped: the rollback block at the bottom of the file names the
   * same objects it would undo, and counting those as statements would make the
   * assertions below measure the documentation rather than the migration.
   */
  const executable = sql
    .split('\n')
    .filter((line: string) => !line.trim().startsWith('--'))
    .join('\n');

  it('touches nothing in the public schema', () => {
    // x-core is production for Music Hub. The only shared object this phase may
    // change is enforce_invite_only(), and that lives in sql/001.
    expect(executable).not.toMatch(/\b(drop|alter)\s+table\s+public\./i);
    expect(executable).not.toMatch(/\bdrop\s+schema\s+public\b/i);
  });

  it('creates exactly one trigger on auth.users, under its own name', () => {
    const onAuthUsers = executable.match(/on auth\.users/gi) ?? [];
    // Exactly two: one `drop trigger if exists … on auth.users` and the
    // `create trigger` that replaces it. A third would mean this migration had
    // grown a second opinion about a table Music Hub depends on.
    expect(onAuthUsers).toHaveLength(2);
    expect(executable).toContain('carguy_on_auth_user_created');
  });

  it('is idempotent — every create guards itself', () => {
    const creates = executable.match(/^create (table|schema|function|trigger)/gim) ?? [];
    for (const statement of creates) {
      const line = executable.slice(executable.indexOf(statement)).split('\n')[0];
      const guarded = /if not exists/i.test(line) || /or replace/i.test(line);
      // `create trigger` has no IF NOT EXISTS; it is preceded by a DROP instead.
      expect(guarded || /^create trigger/i.test(statement)).toBe(true);
    }
  });

  it('ends with a rollback block', () => {
    expect(sql).toMatch(/--\s*rollback:/i);
  });
});

/**
 * The push's conflict target has to be exactly the cloud's primary key —
 * PostgREST refuses an `on_conflict` that matches no unique constraint, and one
 * narrower than the key is how a second account ended up locked out of the
 * seeded catalogue (sql/008). The key starts as `id` in sql/002 (`setting`:
 * `user_id, key`); a later migration may re-key tables, and the last one wins.
 */
describe('every push targets the cloud primary key', () => {
  const sqlDir = join(__dirname, '../../sql');
  const cloudKey = new Map<string, string>();
  for (const table of SYNC_TABLES) cloudKey.set(table.name, table.name === 'setting' ? 'user_id,key' : 'id');

  // Numbered migrations after 002, in order: a re-key is a loop over a table
  // list that adds `primary key (<cols>)`.
  const later = require('node:fs')
    .readdirSync(sqlDir)
    .filter((f: string) => /^0\d\d_.*\.sql$/.test(f) && f > '002')
    .sort();
  for (const file of later) {
    const sql: string = readFileSync(join(sqlDir, file), 'utf8').replace(/^\s*--.*$/gm, '');
    const rekey = sql.match(/array\[([^\]]+)\][\s\S]*?add constraint[^;]*primary key \(([^)]+)\)/i);
    if (!rekey) continue;
    const tables = rekey[1].match(/'(\w+)'/g)!.map((t) => t.replace(/'/g, ''));
    const cols = rekey[2].replace(/\s+/g, '');
    for (const t of tables) cloudKey.set(t, cols);
  }

  it('found the sql/008 re-key', () => {
    expect(cloudKey.get('service_type')).toBe('user_id,id');
  });

  for (const table of SYNC_TABLES) {
    it(`${table.name} pushes on (${cloudKey.get(table.name)})`, () => {
      expect(conflictTarget(table)).toBe(cloudKey.get(table.name));
    });
  }
});
