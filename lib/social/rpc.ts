import type { Database } from '../cloud/database.types';
import { getSupabase } from '../cloud/supabase';

/**
 * One door to the cloud-only social RPCs (sql/034–035, IMP 01102026). The name is checked against the generated
 * types; the JSON shapes (jsonb in Postgres) are declared by the callers in lib/social/api.ts and lib/junte/api.ts.
 *
 * Errors come back as the code the SQL raises ('forbidden', 'not_member', 'rate_limited', …)
 * so screens map them to Spanish without parsing PostgREST text.
 */
export type RpcResult<T> = { ok: true; data: T } | { ok: false; reason: string };

/** Every code sql/033–035 raises; 'status' last, it is the loosest substring. */
const KNOWN = [
  'forbidden', 'not_found', 'not_member', 'rate_limited', 'blocked', 'kicked', 'full', 'owner_cannot_leave',
  'bad_window', 'code_collision', 'handle_cooldown', 'handle_reserved', 'status',
] as const;

export function reasonOf(message: string): string {
  // A unique violation on profiles.handle (two people racing for the same @).
  if (/duplicate key.*handle/i.test(message)) return 'handle_taken';
  if (message.includes('profiles_handle_format')) return 'handle_format';
  return KNOWN.find((k) => message.includes(k)) ?? 'error';
}

export type RpcName = keyof Database['carguy']['Functions'];

export async function rpc<T>(name: RpcName, args: Record<string, unknown> = {}): Promise<RpcResult<T>> {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, reason: 'offline' };
  const { data, error } = await (supabase.rpc as unknown as (
    fn: string,
    a: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>)(name, args);
  if (error) return { ok: false, reason: reasonOf(error.message) };
  return { ok: true, data: data as T };
}
