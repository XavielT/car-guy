import { getSupabase } from '../cloud/supabase';
import { vehicleMembers } from '../db/repos';
import type { GarageRole, VehicleMember } from '../db/types';
import { purgeVehicleLocal } from '../db/vehicleOps';
import { settings as settingsRepo } from '../db/repos';
import { REVOKED_KEY, sync } from '../sync/engine';
import { SITE } from './publish';

/**
 * The shared garage from the app (IMP 28092026 Phase 7). Every write is one of
 * sql/013's security-definer RPCs; `vehicle_member` itself is read-only to
 * clients and arrives by sync.
 */

export const inviteLink = (code: string) => `${SITE}/invitacion/${code}`;
export const inviteDeepLink = (code: string) => `carguy://invitacion/${code}`;

type Rpc = (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string; code?: string } | null }>;
function rpc(): Rpc | null {
  const s = getSupabase();
  return s ? ((fn, args) => (s.rpc as unknown as Rpc)(fn, args)) : null;
}

export async function myUserId(): Promise<string | null> {
  const s = getSupabase();
  if (!s) return null;
  const { data } = await s.auth.getSession();
  return data.session?.user.id ?? null;
}

/** The members of a vehicle, as pulled (owner first). */
export async function listMembers(vehicleId: string): Promise<VehicleMember[]> {
  const all = await vehicleMembers.listWhere({ vehicleId });
  const order: Record<GarageRole, number> = { owner: 0, editor: 1, viewer: 2 };
  return all.filter((m) => !m.deletedAt).sort((a, b) => order[a.role] - order[b.role] || (a.displayName ?? '').localeCompare(b.displayName ?? ''));
}

export type InviteResult = { ok: true; code: string } | { ok: false; reason: 'signed-out' | 'not-owner' | 'offline' };

/** Invites need the vehicle in the cloud: a sync first, so a brand-new car is there. */
export async function createInvite(vehicleId: string, role: 'editor' | 'viewer', email: string | null): Promise<InviteResult> {
  const call = rpc();
  if (!call || !(await myUserId())) return { ok: false, reason: 'signed-out' };
  await sync('manual');
  const { data, error } = await call('create_invite', { p_vehicle: vehicleId, p_role: role, p_email: email });
  if (error) return { ok: false, reason: error.code === '42501' ? 'not-owner' : 'offline' };
  return { ok: true, code: String(data) };
}

export type RedeemResult = { ok: true; vehicleId: string; role: GarageRole } | { ok: false; reason: 'signed-out' | 'not_found' | 'used' | 'expired' | 'email' | 'owner' | 'offline' };

export async function redeemInvite(code: string): Promise<RedeemResult> {
  const call = rpc();
  if (!call || !(await myUserId())) return { ok: false, reason: 'signed-out' };
  const { data, error } = await call('redeem_invite', { p_code: code.trim().toLowerCase() });
  if (error) return { ok: false, reason: 'offline' };
  const r = data as { ok: boolean; reason?: RedeemResult extends { reason: infer R } ? R : never; vehicle_id?: string; role?: GarageRole };
  if (!r?.ok) return { ok: false, reason: (r?.reason as never) ?? 'not_found' };
  // The pull sees the new membership and re-pulls the car (lib/sync/members.ts).
  await sync('manual');
  return { ok: true, vehicleId: r.vehicle_id!, role: r.role! };
}

export async function setMemberRole(vehicleId: string, userId: string, role: 'editor' | 'viewer'): Promise<boolean> {
  const call = rpc();
  if (!call) return false;
  const { error } = await call('set_member_role', { p_vehicle: vehicleId, p_user: userId, p_role: role });
  if (!error) await sync('manual');
  return !error;
}

/** The owner removes someone, or I leave (userId = me). */
export async function removeMember(vehicleId: string, userId: string): Promise<boolean> {
  const call = rpc();
  if (!call) return false;
  const { error } = await call('remove_member', { p_vehicle: vehicleId, p_user: userId });
  if (!error) await sync('manual');
  return !error;
}

/** Shared cars I lost access to, waiting for "Quitar del teléfono". */
export async function revokedVehicles(): Promise<string[]> {
  return settingsRepo.get<string[]>(REVOKED_KEY, []);
}

export async function purgeRevoked(vehicleId: string, keep = false): Promise<void> {
  if (!keep) await purgeVehicleLocal(vehicleId);
  const pending = await revokedVehicles();
  await settingsRepo.set(REVOKED_KEY, pending.filter((v) => v !== vehicleId));
}
