import { getDb } from './client';
import { vehicleOwnership } from './repos';
import type { VehicleOwnership } from './types';

/**
 * What the Garaje cards and the vehicle hub need beyond the vehicle row, in
 * one pass per vehicle (ADR-02: SQL lives in lib/db). Everything is derived;
 * nothing here is stored.
 */
export type GarageFacts = {
  installedMods: number;
  /** Lower-cased tags of installed mods, for the discipline badge. */
  tags: string[];
  lastDiscipline: string | null;
  photos: number;
  openTasks: number;
  ownership: VehicleOwnership | null;
  /** The first favourite album photo — the cover when the vehicle has no hero set. */
  favoriteMediaId: string | null;
};

export async function garageFacts(vehicleId: string): Promise<GarageFacts> {
  const db = await getDb();
  const [mods, event, photos, tasks, ownership, favorite] = await Promise.all([
    db.getAllAsync<{ tags: string }>(
      "SELECT tags FROM mod WHERE vehicle_id = ? AND deleted_at IS NULL AND status = 'instalado'",
      [vehicleId],
    ),
    db.getFirstAsync<{ discipline: string }>(
      'SELECT discipline FROM track_event WHERE vehicle_id = ? AND deleted_at IS NULL ORDER BY occurred_at DESC LIMIT 1',
      [vehicleId],
    ),
    // Album items plus any photo owned by the vehicle itself (its v2.0 avatar).
    db.getFirstAsync<{ n: number }>(
      `SELECT (SELECT COUNT(*) FROM album_item WHERE vehicle_id = ? AND deleted_at IS NULL) AS n`,
      [vehicleId],
    ),
    db.getFirstAsync<{ n: number }>(
      "SELECT COUNT(*) AS n FROM task WHERE vehicle_id = ? AND deleted_at IS NULL AND status <> 'hecha'",
      [vehicleId],
    ),
    vehicleOwnership.getById(`own_${vehicleId}`),
    db.getFirstAsync<{ id: string }>(
      `SELECT m.id FROM album_item a JOIN media m ON m.id = a.media_id
       WHERE a.vehicle_id = ? AND a.deleted_at IS NULL AND m.deleted_at IS NULL AND m.is_favorite = 1
       ORDER BY a.sort_order, m.taken_at LIMIT 1`,
      [vehicleId],
    ),
  ]);

  const tags = new Set<string>();
  for (const m of mods) {
    try {
      for (const t of JSON.parse(m.tags || '[]') as unknown[]) if (typeof t === 'string') tags.add(t.toLowerCase());
    } catch {
      // A hand-edited tags column must not take the garage down.
    }
  }

  return {
    installedMods: mods.length,
    tags: [...tags],
    lastDiscipline: event?.discipline ?? null,
    photos: photos?.n ?? 0,
    openTasks: tasks?.n ?? 0,
    ownership: ownership && !ownership.deletedAt ? ownership : null,
    favoriteMediaId: favorite?.id ?? null,
  };
}

/** The last weekly check, for Inicio's chequeo lamp; null when the car has no weekly template. */
export async function lastWeeklyCheck(vehicleId: string): Promise<{ lastAt: string | null; lastHadFailures: boolean } | null> {
  const db = await getDb();
  const template = await db.getFirstAsync<{ id: string }>(
    "SELECT id FROM inspection_template WHERE cadence = 'semanal' AND is_enabled = 1 AND deleted_at IS NULL AND (vehicle_id IS NULL OR vehicle_id = ?) LIMIT 1",
    [vehicleId],
  );
  if (!template) return null;
  const last = await db.getFirstAsync<{ occurred_at: string; status: string }>(
    `SELECT i.occurred_at, i.status FROM inspection i
     JOIN inspection_template t ON t.id = i.template_id
     WHERE i.vehicle_id = ? AND i.deleted_at IS NULL AND t.cadence = 'semanal'
     ORDER BY i.occurred_at DESC LIMIT 1`,
    [vehicleId],
  );
  return { lastAt: last?.occurred_at ?? null, lastHadFailures: last?.status === 'con_fallas' };
}
