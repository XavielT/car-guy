/**
 * Migration v12 (IMP 16102026 Phase 5, N7): service_record.done_by + service_media, against node's real SQLite.
 * A 2.5.x database upgrades: records with a shop or contact stay "shop", the rest are the owner's own work, and the
 * one photo each service had becomes a link with the derived id the cloud backfill (sql/041) derives too.
 */
import { DatabaseSync } from 'node:sqlite';

import { LATEST_VERSION, MIGRATIONS } from '@/lib/db/migrations';

const T = '2026-10-01T12:00:00.000Z';

function v11Database(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  for (const m of MIGRATIONS.filter((m) => m.version <= 11)) {
    db.exec('BEGIN');
    for (const sql of m.up) db.exec(sql);
    db.exec('COMMIT');
  }
  db.prepare(`INSERT INTO vehicle (id, name, default_fuel_type, created_at, updated_at) VALUES ('v', 'v', 'regular', ?, ?)`).run(T, T);
  return db;
}

function record(db: DatabaseSync, id: string, over: { shop?: string; contactId?: string | null; kind?: string }) {
  db.prepare(
    `INSERT INTO service_record (id, vehicle_id, kind, occurred_at, title, shop, contact_id, created_at, updated_at)
     VALUES (?, 'v', ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, over.kind ?? 'reparacion', T, id, over.shop ?? '', over.contactId ?? null, T, T);
}

function photo(db: DatabaseSync, mediaId: string, ownerId: string, over: { table?: string; deleted?: boolean } = {}) {
  db.prepare(
    `INSERT INTO media (id, owner_table, owner_id, kind, mime, created_at, updated_at, deleted_at) VALUES (?, ?, ?, 'photo', 'image/jpeg', ?, ?, ?)`,
  ).run(mediaId, over.table ?? 'service_record', ownerId, T, T, over.deleted ? T : null);
}

function upgrade(db: DatabaseSync) {
  const v12 = MIGRATIONS.find((m) => m.version === 12)!;
  db.exec('BEGIN');
  for (const sql of v12.up) db.exec(sql);
  db.exec('COMMIT');
}

const doneBy = (db: DatabaseSync, id: string) => (db.prepare('SELECT done_by AS d FROM service_record WHERE id = ?').get(id) as { d: string }).d;

describe('fresh install', () => {
  it('v12 is the latest; done_by defaults to shop and only takes the four values', () => {
    expect(LATEST_VERSION).toBeGreaterThanOrEqual(12);
    const db = v11Database();
    upgrade(db);
    record(db, 'r1', { shop: 'Taller' });
    expect(doneBy(db, 'r1')).toBe('shop');
    expect(() => db.prepare(`UPDATE service_record SET done_by = 'robot' WHERE id = 'r1'`).run()).toThrow();
    for (const v of ['self', 'friend', 'other']) db.prepare(`UPDATE service_record SET done_by = ? WHERE id = 'r1'`).run(v);
  });

  it('a link takes only the four roles, and one record can carry several', () => {
    const db = v11Database();
    upgrade(db);
    record(db, 'r1', {});
    const link = db.prepare(`INSERT INTO service_media (id, service_record_id, media_id, role, sort, created_at, updated_at) VALUES (?, 'r1', ?, ?, ?, ?, ?)`);
    for (const [i, role] of (['before', 'after', 'invoice', 'other'] as const).entries()) link.run(`l${i}`, `m${i}`, role, i, T, T);
    expect(() => link.run('bad', 'mx', 'selfie', 9, T, T)).toThrow();
    expect((db.prepare('SELECT COUNT(*) AS n FROM service_media WHERE service_record_id = ?').get('r1') as { n: number }).n).toBe(4);
  });
});

describe('a 2.5.x database: 11 → 12', () => {
  it('backfills done_by: shop or contact → shop, neither → self', () => {
    const db = v11Database();
    db.prepare(`INSERT INTO contact (id, name, kind, created_at, updated_at) VALUES ('c1', 'Pedro', 'taller', ?, ?)`).run(T, T);
    record(db, 'with_shop', { shop: 'Taller El Rápido' });
    record(db, 'with_contact', { contactId: 'c1' });
    record(db, 'own', {});
    record(db, 'blank_shop', { shop: '   ' });
    record(db, 'service', { kind: 'mantenimiento' });
    upgrade(db);
    expect(doneBy(db, 'with_shop')).toBe('shop');
    expect(doneBy(db, 'with_contact')).toBe('shop');
    expect(doneBy(db, 'own')).toBe('self');
    expect(doneBy(db, 'blank_shop')).toBe('self');
    // a maintenance record with no shop is also "self": it is who did it, not what it was
    expect(doneBy(db, 'service')).toBe('self');
  });

  it('turns each live service photo into a link with the derived id, leaving other owners alone', () => {
    const db = v11Database();
    record(db, 'r1', {});
    record(db, 'r2', {});
    photo(db, 'm1', 'r1');
    photo(db, 'm2', 'r2', { deleted: true });
    photo(db, 'm3', 'v', { table: 'vehicle' });
    upgrade(db);
    const rows = db.prepare('SELECT id, service_record_id AS r, media_id AS m, role FROM service_media ORDER BY id').all() as Array<{ id: string; r: string; m: string; role: string }>;
    expect(rows).toEqual([{ id: 'sm_m1', r: 'r1', m: 'm1', role: 'other' }]);
  });

  it('does not bump updated_at (the cloud makes the same change)', () => {
    const db = v11Database();
    record(db, 'own', {});
    upgrade(db);
    expect((db.prepare('SELECT updated_at AS u FROM service_record WHERE id = ?').get('own') as { u: string }).u).toBe(T);
  });
});
