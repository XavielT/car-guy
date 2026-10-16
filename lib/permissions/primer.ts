import { settings } from '../db/repos';
import type { PermissionId } from './types';

/**
 * The primers a person has already read (IMP 16102026 SPEC-A "Bienvenida"): `permissions_primer_v1_seen`, a local
 * setting. A new user meets the primers in the welcome's last step; an existing one meets each the first time they
 * use the function. Reading one never grants anything — it only keeps the app from explaining the same thing twice
 * in a row when the system dialog is a tap away.
 */
export const PRIMER_SEEN_KEY = 'permissions_primer_v1_seen';

export async function seenPrimers(): Promise<PermissionId[]> {
  const raw = await settings.get<unknown>(PRIMER_SEEN_KEY, []);
  return Array.isArray(raw) ? (raw.filter((x) => typeof x === 'string') as PermissionId[]) : [];
}

export async function markPrimerSeen(id: PermissionId): Promise<void> {
  const seen = await seenPrimers();
  if (!seen.includes(id)) await settings.set(PRIMER_SEEN_KEY, [...seen, id]);
}
