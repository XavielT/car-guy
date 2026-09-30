import { useEffect, useSyncExternalStore } from 'react';

import { recordError } from '../diagnostics';
import { useSession } from './auth';
import { isRole, type Role } from './roles';
import { getSupabase } from './supabase';

export { isRole, ROLES, type Role } from './roles';

/**
 * The signed-in account's role lives on its `carguy.profiles` row; the server is
 * what enforces it (carguy.is_admin() in every admin policy and function). The
 * app reads it only to decide what to show.
 */
/** role null + loaded: the server could not be asked (offline, error). */
let current: { userId: string; role: Role | null; loaded: boolean } | null = null;
const listeners = new Set<() => void>();
const inFlight = new Map<string, Promise<Role | null>>();

function publish(next: typeof current): void {
  current = next;
  for (const l of listeners) l();
}

/** The signed-in account's role from its own profile row (RLS: own row only); null offline / signed out. */
export async function fetchRole(userId: string): Promise<Role | null> {
  const running = inFlight.get(userId);
  if (running) return running;
  const run = (async () => {
    const supabase = getSupabase();
    if (!supabase) return null;
    const { data, error } = await supabase.from('profiles').select('role').eq('user_id', userId).maybeSingle();
    if (error) {
      recordError('role', error.message);
      publish({ userId, role: null, loaded: true });
      return null;
    }
    const role = isRole(data?.role) ? data.role : 'member';
    publish({ userId, role, loaded: true });
    return role;
  })().finally(() => inFlight.delete(userId));
  inFlight.set(userId, run);
  return run;
}

/** Re-read after a change (the panel changed someone's role — maybe one's own view of it). */
export function refreshRole(): void {
  if (current) void fetchRole(current.userId);
}

/** The signed-in account's role; null while unknown (signed out, offline, loading). */
export function useRole(): Role | null {
  const { session } = useSession();
  const userId = session?.user.id ?? null;
  const snapshot = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
    () => current,
  );
  useEffect(() => {
    if (userId && snapshot?.userId !== userId) void fetchRole(userId);
  }, [userId, snapshot?.userId]);
  return userId && snapshot?.userId === userId ? snapshot.role : null;
}

/** True while the signed-in Car Guy account has the admin role. */
export function useIsAdmin(): boolean {
  return useRole() === 'admin';
}

export type AdminGate = 'loading' | 'admin' | 'not-admin' | 'offline';

/** For the admin screens: wait for the role instead of flashing "solo para el administrador". */
export function useAdminGate(): AdminGate {
  const { session, ready } = useSession();
  const role = useRole();
  const loaded = current != null && current.userId === session?.user.id && current.loaded;
  if (!ready) return 'loading';
  if (!session) return 'not-admin';
  if (role === 'admin') return 'admin';
  if (!loaded) return 'loading';
  return role == null ? 'offline' : 'not-admin';
}

// —— The admin panel (sql/024: every call is refused unless the caller is admin) ——

export type AdminStats = {
  users: number;
  users_new_7d: number;
  users_new_30d: number;
  users_active_7d: number;
  roles: Partial<Record<Role, number>>;
  vehicles: number;
  fuel_logs: number;
  fuel_logs_30d: number;
  trips: number;
  trip_km: number;
  shares_published: number;
  feedback_new: number;
  feedback_total: number;
  at: string;
};

export type AdminUser = {
  user_id: string;
  email: string;
  role: Role;
  created_at: string;
  last_sign_in_at: string | null;
  vehicles: number;
  fuel_logs: number;
  trips: number;
  last_activity: string | null;
};

export async function fetchAdminStats(): Promise<AdminStats> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('offline');
  const { data, error } = await supabase.rpc('admin_stats');
  if (error) throw new Error(error.message);
  return data as unknown as AdminStats;
}

export async function fetchAdminUsers(limit = 200): Promise<AdminUser[]> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('offline');
  const { data, error } = await supabase.rpc('admin_users', { p_limit: limit });
  if (error) throw new Error(error.message);
  return (data ?? []).map((u) => ({ ...u, role: isRole(u.role) ? u.role : 'member', vehicles: Number(u.vehicles), fuel_logs: Number(u.fuel_logs), trips: Number(u.trips) }));
}

export type SetRoleResult = { ok: true } | { ok: false; reason: 'self_demote' | 'forbidden' | 'error' };

export async function setUserRole(userId: string, role: Role): Promise<SetRoleResult> {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, reason: 'error' };
  const { error } = await supabase.rpc('admin_set_role', { p_user: userId, p_role: role });
  if (!error) return { ok: true };
  if (error.message.includes('self_demote')) return { ok: false, reason: 'self_demote' };
  if (error.message.includes('forbidden')) return { ok: false, reason: 'forbidden' };
  recordError('admin-role', error.message);
  return { ok: false, reason: 'error' };
}
