import { getDb } from './client';
import { albumItems, media as mediaRepo, milestones as milestoneRepo, specSnapshots } from './repos';
import type { Media, Milestone } from './types';
import {
  jsonObject,
  type DatePrecision,
  type StateMod,
  type TimelineEvent,
  type TimelinePhoto,
} from '../domain/album';
import { id as newId } from '../format';

/**
 * What the album screens read (IMP 28092026 Phase 3). SQL lives here (ADR-02);
 * the rules that turn the rows into a timeline live in lib/domain/album.ts.
 */

export type AlbumPhoto = TimelinePhoto & {
  albumItemId: string | null;
  caption: string;
  width: number | null;
  height: number | null;
  /** A check photo (IMP 29092026 note 3): the run it came from and the item's label. */
  inspectionId?: string | null;
  checkLabel?: string | null;
};

type PhotoRow = {
  id: string;
  album_item_id: string | null;
  taken_at: string | null;
  created_at: string;
  date_precision: DatePrecision;
  blurhash: string | null;
  is_favorite: number;
  caption: string;
  width: number | null;
  height: number | null;
  milestone_id: string | null;
  mod_id: string | null;
  track_event_id: string | null;
  service_id: string | null;
  inspection_id: string | null;
  check_label: string | null;
};

function toPhoto(r: PhotoRow): AlbumPhoto {
  return {
    id: r.id,
    albumItemId: r.album_item_id,
    takenAt: r.taken_at,
    createdAt: r.created_at,
    precision: r.date_precision ?? 'day',
    blurhash: r.blurhash,
    isFavorite: Boolean(r.is_favorite),
    caption: r.caption ?? '',
    width: r.width,
    height: r.height,
    milestoneId: r.milestone_id,
    modId: r.mod_id,
    trackEventId: r.track_event_id,
    serviceId: r.service_id,
    inspectionId: r.inspection_id,
    checkLabel: r.check_label,
  };
}

/**
 * Every photo of the vehicle's album: album items, plus the photos its service
 * records own (a repair photo is a photo of the car too — they appear on the
 * timeline's MANTENIMIENTO cards), plus the photos of its checks (IMP 29092026
 * note 3: media owned by an inspection_result, or a result's legacy media_id,
 * with the item's label). Newest first.
 */
export async function albumPhotos(vehicleId: string): Promise<AlbumPhoto[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<PhotoRow>(
    `SELECT m.id, a.id AS album_item_id, m.taken_at, m.created_at, m.date_precision, m.blurhash, m.is_favorite,
            m.caption, m.width, m.height, a.milestone_id, a.mod_id, a.track_event_id, NULL AS service_id,
            NULL AS inspection_id, NULL AS check_label
       FROM album_item a JOIN media m ON m.id = a.media_id
      WHERE a.vehicle_id = ? AND a.deleted_at IS NULL AND m.deleted_at IS NULL
     UNION ALL
     SELECT m.id, NULL, m.taken_at, m.created_at, m.date_precision, m.blurhash, m.is_favorite,
            m.caption, m.width, m.height, NULL, NULL, NULL, s.id, NULL, NULL
       FROM media m JOIN service_record s ON s.id = m.owner_id AND m.owner_table = 'service_record'
      WHERE s.vehicle_id = ? AND s.deleted_at IS NULL AND m.deleted_at IS NULL AND m.kind = 'photo'
        AND NOT EXISTS (SELECT 1 FROM album_item x WHERE x.media_id = m.id AND x.deleted_at IS NULL)
     UNION ALL
     SELECT m.id, NULL, m.taken_at, m.created_at, m.date_precision, m.blurhash, m.is_favorite,
            m.caption, m.width, m.height, NULL, NULL, NULL, NULL, i.id, r.label_snapshot
       FROM inspection_result r
       JOIN inspection i ON i.id = r.inspection_id
       JOIN media m ON (m.owner_table = 'inspection_result' AND m.owner_id = r.id) OR m.id = r.media_id
      WHERE i.vehicle_id = ? AND i.deleted_at IS NULL AND r.deleted_at IS NULL
        AND m.deleted_at IS NULL AND m.kind = 'photo'
        AND NOT EXISTS (SELECT 1 FROM album_item x WHERE x.media_id = m.id AND x.deleted_at IS NULL)
     ORDER BY 3 DESC, 4 DESC`,
    [vehicleId, vehicleId, vehicleId],
  );
  return rows.map(toPhoto);
}

/** Shapes of the album's photos, for duplicate detection on import. */
export async function findAlbumDupShapes(vehicleId: string): Promise<
  { width: number | null; height: number | null; takenAt: string | null; sizeBytes: number | null }[]
> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ width: number | null; height: number | null; taken_at: string | null; size_bytes: number | null }>(
    `SELECT m.width, m.height, m.taken_at, m.size_bytes FROM album_item a JOIN media m ON m.id = a.media_id
      WHERE a.vehicle_id = ? AND a.deleted_at IS NULL AND m.deleted_at IS NULL`,
    [vehicleId],
  );
  return rows.map((r) => ({ width: r.width, height: r.height, takenAt: r.taken_at, sizeBytes: r.size_bytes }));
}

const MOD_REMOVED = new Set(['quitado', 'vendido', 'danado']);

/** Milestones, mod installs/removals, track events and services with photos — the timeline's cards. */
export async function timelineEvents(vehicleId: string): Promise<TimelineEvent[]> {
  const db = await getDb();
  const [hitos, mods, events, services, checks] = await Promise.all([
    db.getAllAsync<{ id: string; kind: string; occurred_at: string; title: string; story: string; odometer_km: number | null }>(
      'SELECT id, kind, occurred_at, title, story, odometer_km FROM milestone WHERE vehicle_id = ? AND deleted_at IS NULL',
      [vehicleId],
    ),
    db.getAllAsync<{ id: string; name: string; status: string; installed_at: string | null; removed_at: string | null; vendor: string | null; brand: string | null }>(
      "SELECT id, name, status, installed_at, removed_at, vendor, brand FROM mod WHERE vehicle_id = ? AND deleted_at IS NULL",
      [vehicleId],
    ),
    db.getAllAsync<{ id: string; occurred_at: string; title: string; discipline: string }>(
      'SELECT id, occurred_at, title, discipline FROM track_event WHERE vehicle_id = ? AND deleted_at IS NULL',
      [vehicleId],
    ),
    db.getAllAsync<{ id: string; occurred_at: string; title: string; shop: string }>(
      `SELECT s.id, s.occurred_at, s.title, s.shop FROM service_record s
        WHERE s.vehicle_id = ? AND s.deleted_at IS NULL
          AND EXISTS (SELECT 1 FROM media m WHERE m.owner_table = 'service_record' AND m.owner_id = s.id AND m.deleted_at IS NULL AND m.kind = 'photo')`,
      [vehicleId],
    ),
    // Checks whose items have photos (owned by the result, or the pre-v6 single media_id).
    db.getAllAsync<{ id: string; occurred_at: string; labels: string }>(
      `SELECT i.id, i.occurred_at, group_concat(r.label_snapshot, ', ') AS labels
         FROM inspection i JOIN inspection_result r ON r.inspection_id = i.id AND r.deleted_at IS NULL
        WHERE i.vehicle_id = ? AND i.deleted_at IS NULL
          AND (r.media_id IS NOT NULL OR EXISTS (SELECT 1 FROM media m WHERE m.owner_table = 'inspection_result' AND m.owner_id = r.id AND m.deleted_at IS NULL))
        GROUP BY i.id`,
      [vehicleId],
    ),
  ]);

  const out: TimelineEvent[] = [];
  for (const h of hitos) {
    out.push({ kind: 'hito', id: h.id, date: h.occurred_at, title: h.title, story: h.story, milestoneKind: h.kind, subtitle: h.odometer_km != null ? `${Math.round(h.odometer_km).toLocaleString('en-US')} km` : null });
  }
  for (const m of mods) {
    if (m.installed_at) out.push({ kind: 'mod', id: m.id, date: m.installed_at, title: m.name, subtitle: m.brand ?? m.vendor });
    if (m.removed_at && MOD_REMOVED.has(m.status)) out.push({ kind: 'mod', id: `${m.id}:removed`, date: m.removed_at, title: m.name, removed: true });
  }
  for (const e of events) out.push({ kind: 'pista', id: e.id, date: e.occurred_at, title: e.title || 'Evento de pista', discipline: e.discipline });
  for (const s of services) out.push({ kind: 'mantenimiento', id: s.id, date: s.occurred_at, title: s.title, subtitle: s.shop || null });
  for (const c of checks) out.push({ kind: 'chequeo', id: c.id, date: c.occurred_at, title: c.labels });
  return out;
}

/** ANTES/DESPUÉS media per mod, from mod_media roles. */
export async function modPairs(vehicleId: string): Promise<Record<string, { before: string | null; after: string | null }>> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ mod_id: string; media_id: string; role: string }>(
    `SELECT mm.mod_id, mm.media_id, mm.role FROM mod_media mm JOIN mod ON mod.id = mm.mod_id
      WHERE mod.vehicle_id = ? AND mm.deleted_at IS NULL AND mm.role IN ('antes', 'despues')`,
    [vehicleId],
  );
  const out: Record<string, { before: string | null; after: string | null }> = {};
  for (const r of rows) {
    const pair = (out[r.mod_id] ??= { before: null, after: null });
    if (r.role === 'antes') pair.before ??= r.media_id;
    else pair.after ??= r.media_id;
  }
  return out;
}

export async function odometerReadings(vehicleId: string): Promise<{ occurredAt: string; valueKm: number }[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ occurred_at: string; value_km: number }>(
    'SELECT occurred_at, value_km FROM odometer_reading WHERE vehicle_id = ? AND deleted_at IS NULL ORDER BY occurred_at',
    [vehicleId],
  );
  return rows.map((r) => ({ occurredAt: r.occurred_at, valueKm: r.value_km }));
}

/** Inputs for stateAt(): the vehicle's mods with their effects, and the stock ficha. */
export async function stateInputs(vehicleId: string): Promise<{ mods: StateMod[]; stock: Record<string, unknown> }> {
  const db = await getDb();
  const [mods, sheet] = await Promise.all([
    db.getAllAsync<{ id: string; name: string; status: string; installed_at: string | null; removed_at: string | null; spec_effects: string }>(
      'SELECT id, name, status, installed_at, removed_at, spec_effects FROM mod WHERE vehicle_id = ? AND deleted_at IS NULL',
      [vehicleId],
    ),
    db.getFirstAsync<{ stock: string }>('SELECT stock FROM vehicle_specsheet WHERE vehicle_id = ? AND deleted_at IS NULL', [vehicleId]),
  ]);
  return {
    mods: mods.map((m) => ({ id: m.id, name: m.name, status: m.status, installedAt: m.installed_at, removedAt: m.removed_at, specEffects: jsonObject(m.spec_effects) })),
    stock: jsonObject(sheet?.stock),
  };
}

// --------------------------------------------------------------- writes ---

export async function setPhotoDate(mediaId: string, takenAt: string, precision: DatePrecision): Promise<void> {
  await mediaRepo.upsert({ id: mediaId, takenAt, datePrecision: precision });
}

export async function setPhotoCaption(mediaId: string, caption: string): Promise<void> {
  await mediaRepo.upsert({ id: mediaId, caption });
}

export async function setPhotoFavorite(mediaId: string, isFavorite: boolean): Promise<void> {
  await mediaRepo.upsert({ id: mediaId, isFavorite });
}

/**
 * Soft-deletes a photo and its album item. The bytes leave Storage on the next
 * sync (removeDeletedMediaBytes); the local file stays until a reset — a
 * tombstone's file costs space, not correctness.
 */
export async function deletePhoto(mediaId: string): Promise<void> {
  const db = await getDb();
  const items = await db.getAllAsync<{ id: string }>('SELECT id FROM album_item WHERE media_id = ? AND deleted_at IS NULL', [mediaId]);
  const now = new Date().toISOString();
  for (const i of items) await albumItems.upsert({ id: i.id, deletedAt: now });
  await mediaRepo.upsert({ id: mediaId, deletedAt: now });
}

/** Links existing album photos to a milestone (or unlinks with null). */
export async function linkPhotosToMilestone(mediaIds: string[], milestoneId: string | null): Promise<void> {
  const db = await getDb();
  for (const mediaId of mediaIds) {
    const item = await db.getFirstAsync<{ id: string }>('SELECT id FROM album_item WHERE media_id = ? AND deleted_at IS NULL', [mediaId]);
    if (item) await albumItems.upsert({ id: item.id, milestoneId });
  }
}

export async function milestonePhotoIds(milestoneId: string): Promise<string[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ media_id: string }>(
    `SELECT a.media_id FROM album_item a JOIN media m ON m.id = a.media_id
      WHERE a.milestone_id = ? AND a.deleted_at IS NULL AND m.deleted_at IS NULL`,
    [milestoneId],
  );
  return rows.map((r) => r.media_id);
}

export async function saveMilestone(input: Partial<Milestone> & Pick<Milestone, 'vehicleId' | 'kind' | 'occurredAt' | 'title'>): Promise<Milestone> {
  return milestoneRepo.upsert({ id: input.id ?? newId(), story: '', odometerKm: null, coverMediaId: null, deletedAt: null, ...input });
}

export async function deleteMilestone(id: string): Promise<void> {
  const db = await getDb();
  const items = await db.getAllAsync<{ id: string }>('SELECT id FROM album_item WHERE milestone_id = ? AND deleted_at IS NULL', [id]);
  // The photos stay in the album; only the link goes.
  for (const i of items) await albumItems.upsert({ id: i.id, milestoneId: null });
  await milestoneRepo.upsert({ id, deletedAt: new Date().toISOString() });
}

/** "Fijar como snapshot": the specs of that day, frozen with a label. */
export async function pinSnapshot(input: { vehicleId: string; label: string; asOf: string; specs: Record<string, unknown>; coverMediaId: string | null }): Promise<void> {
  await specSnapshots.upsert({
    id: newId(),
    vehicleId: input.vehicleId,
    label: input.label,
    asOf: input.asOf,
    specs: JSON.stringify(input.specs),
    coverMediaId: input.coverMediaId,
    deletedAt: null,
  });
}

export async function getMediaRow(id: string): Promise<Media | null> {
  return mediaRepo.getById(id);
}

/** Photos of the vehicle's album whose full copy is in the cloud — the meter's "N respaldadas". */
export async function backedUpCount(vehicleId: string): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ n: number }>(
    `SELECT COUNT(*) AS n FROM album_item a JOIN media m ON m.id = a.media_id
      WHERE a.vehicle_id = ? AND a.deleted_at IS NULL AND m.deleted_at IS NULL AND m.remote_path IS NOT NULL`,
    [vehicleId],
  );
  return row?.n ?? 0;
}
