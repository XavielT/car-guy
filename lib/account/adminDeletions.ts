import { getSupabase } from '../cloud/supabase';

/** Admin → Cuentas por eliminar (sql/028 carguy.admin_pending_deletions(), refused unless admin). */

export type PendingDeletion = {
  user_id: string;
  email: string;
  requested_at: string;
  objects: number;
  last_sign_in_at: string | null;
};

type Rpc = (fn: string) => Promise<{ data: unknown; error: { message: string } | null }>;

export async function fetchPendingDeletions(): Promise<PendingDeletion[]> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('offline');
  // Not in database.types.ts yet (sql/028 is newer than the last `npm run types:gen`).
  const { data, error } = await (supabase.rpc as unknown as Rpc).call(supabase, 'admin_pending_deletions');
  if (error) throw new Error(error.message);
  return ((data as PendingDeletion[] | null) ?? []).map((p) => ({ ...p, objects: Number(p.objects) || 0 }));
}

/** The project's Authentication → Users page, from the Supabase URL (https://<ref>.supabase.co). */
export function supabaseUsersUrl(url: string | undefined = process.env.EXPO_PUBLIC_SUPABASE_URL): string | null {
  const ref = /^https:\/\/([a-z0-9]+)\.supabase\.co/i.exec(url ?? '')?.[1];
  return ref ? `https://supabase.com/dashboard/project/${ref}/auth/users` : null;
}
