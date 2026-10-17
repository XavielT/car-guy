/**
 * Schema v12 (IMP 16102026 Phase 5, N7/X7): repairs get "who did it" and photos with a role.
 *
 *  - `service_record.done_by` — 'self' | 'shop' | 'friend' | 'other'. Backfill: 'self' only for a record with neither
 *    contact nor shop name; everything else was done by a shop.
 *  - `service_record.system` — the system a repair touched (motor, frenos, …: a `ServiceCategory`), null for the rest.
 *  - `service_media` — the photos of a service with a role (before / after / invoice / other), the pattern of
 *    `mod_media`. Until now a service had one photo found through `media.owner_table = 'service_record'`; each of
 *    those becomes a link with the derived id `sm_<media id>` — the id the cloud backfill (sql/041) derives too, so
 *    a phone that migrates and one that syncs converge on the same row.
 *
 * `updated_at` of service_record is left alone by the backfill: sql/041 makes the same change in the cloud.
 */
export function migrationV12(): string[] {
  return [
    `ALTER TABLE service_record ADD COLUMN done_by TEXT NOT NULL DEFAULT 'shop' CHECK (done_by IN ('self','shop','friend','other'))`,
    `ALTER TABLE service_record ADD COLUMN system TEXT`,
    `UPDATE service_record SET done_by = 'self' WHERE COALESCE(contact_id, '') = '' AND TRIM(COALESCE(shop, '')) = ''`,
    `CREATE TABLE service_media (
       id TEXT PRIMARY KEY NOT NULL,
       service_record_id TEXT NOT NULL REFERENCES service_record(id),
       media_id TEXT NOT NULL,
       role TEXT NOT NULL DEFAULT 'other' CHECK (role IN ('before','after','invoice','other')),
       sort INTEGER NOT NULL DEFAULT 0,
       created_at TEXT NOT NULL,
       updated_at TEXT NOT NULL,
       deleted_at TEXT,
       synced_at TEXT
     )`,
    `CREATE INDEX idx_service_media_record ON service_media(service_record_id)`,
    `INSERT INTO service_media (id, service_record_id, media_id, role, sort, created_at, updated_at)
       SELECT 'sm_' || m.id, m.owner_id, m.id, 'other', 0, m.created_at, m.updated_at
         FROM media m JOIN service_record sr ON sr.id = m.owner_id
        WHERE m.owner_table = 'service_record' AND m.deleted_at IS NULL`,
  ];
}
