import type { GarageRole } from '../db/types';

/**
 * The shared garage's sync rules (IMP 28092026 Phase 7, 02-cloud-v2.md §5).
 * Pure; the engine reads the local `vehicle_member` rows before and after a
 * pull and asks this file what changed.
 *
 * - **granted**: a live membership of mine that was not live before (a redeemed
 *   invite, or a re-invite after removal). The rows of that vehicle were written
 *   before my cursors, so the pull just done skipped them: the engine resets the
 *   cursors and pulls again. The cursors are per table, not per vehicle, so the
 *   reset is global — a one-off full pull, correct and simple.
 * - **revoked**: a membership of mine that is now ended (removed by the owner,
 *   or I left). Never an owner row. The engine does not purge on its own: the
 *   screen asks first, then purges locally (nothing is pushed).
 * - **roles**: my role per vehicle, mirrored into `vehicle.garage_role`.
 */

export type MemberRow = { vehicle_id: string; user_id: string; role: GarageRole; deleted_at: string | null };

export type MembershipChanges = {
  granted: string[];
  revoked: string[];
  roles: Record<string, GarageRole | null>;
};

export function membershipChanges(before: MemberRow[], after: MemberRow[], me: string): MembershipChanges {
  const mine = (rows: MemberRow[]) => new Map(rows.filter((r) => r.user_id === me).map((r) => [r.vehicle_id, r]));
  const was = mine(before);
  const now = mine(after);
  const granted: string[] = [];
  const revoked: string[] = [];
  const roles: Record<string, GarageRole | null> = {};
  for (const [vehicleId, row] of now) {
    const prev = was.get(vehicleId);
    const live = !row.deleted_at;
    const wasLive = Boolean(prev && !prev.deleted_at);
    roles[vehicleId] = live ? row.role : null;
    if (live && !wasLive && row.role !== 'owner') granted.push(vehicleId);
    if (!live && row.role !== 'owner' && (wasLive || !prev)) revoked.push(vehicleId);
  }
  return { granted, revoked, roles };
}

/** A viewer's local edits are not pushed (the server would refuse them). */
export function canPushFor(role: GarageRole | null | undefined): boolean {
  return role !== 'viewer';
}

/**
 * Where a photo's bytes go since Phase 7: `v/<vehicle_id>/…` when the photo
 * belongs to a vehicle (so every member can read it under one policy), the old
 * `<user_id>/…` otherwise (a contact's photo, an inventory item on the shelf).
 */
export function mediaObjectPath(userId: string, vehicleId: string | null, mediaId: string, ext: string, thumb = false): string {
  const name = thumb ? `${mediaId}.thumb.jpg` : `${mediaId}.${ext}`;
  return vehicleId ? `v/${vehicleId}/${name}` : `${userId}/${name}`;
}

/** Tables whose cloud rows carry `updated_by` (sql/009 for v2, sql/013 for v1). */
export const UPDATED_BY_TABLES = new Set([
  'vehicle', 'vehicle_spec', 'odometer_reading', 'fuel_log', 'service_record', 'service_record_item', 'part', 'expense',
  'reminder', 'inspection', 'inspection_result', 'task', 'document', 'media',
  'vehicle_ownership', 'album_item', 'milestone', 'mod', 'mod_media', 'vehicle_specsheet', 'spec_snapshot', 'torque_spec',
  'wishlist_item', 'inventory_item', 'wheel_set', 'tire', 'vehicle_dtc_event', 'fluid_guide_item', 'track_event',
  'track_session', 'setup_sheet', 'consumable_usage', 'vehicle_share',
]);
