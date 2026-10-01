import { Platform } from 'react-native';

import { getSupabase } from '../cloud/supabase';
import { resetDatabase } from '../db/reset';
import { seedCatalog } from '../db/seed';
import { recordError } from '../diagnostics';
import { loadAcceptances } from '../legal/acceptance';
import { whenSyncIdle } from '../sync/engine';
import { deleteAccount, type DeletionResult, type DeletionStep, type FunctionAnswer, type RpcResult } from './deleteAccount';

/** The real dependencies of lib/account/deleteAccount.ts. */

const SITE = 'https://car-guy.vercel.app';

/** Same origin on the deployed web app; the production URL from native and from localhost. */
export function deletionUrl(platform: string = Platform.OS, host: string | null = typeof location !== 'undefined' ? location.hostname : null): string {
  if (platform === 'web' && host && host !== 'localhost' && host !== '127.0.0.1') return '/api/eliminar-cuenta';
  return `${SITE}/api/eliminar-cuenta`;
}

/** Can the function remove a login (SUPABASE_SERVICE_ROLE_KEY set on Vercel)? null when unreachable. */
export async function deletionConfigured(): Promise<boolean | null> {
  try {
    const r = await fetch(deletionUrl(), { headers: { Accept: 'application/json' } });
    const body = (await r.json()) as { configured?: unknown };
    return typeof body?.configured === 'boolean' ? body.configured : null;
  } catch {
    return null;
  }
}

export function rpcFailure(message: string): RpcResult {
  if (/not_carguy/.test(message)) return { ok: false, reason: 'not-carguy' };
  if (/fetch|network|timed? ?out/i.test(message)) return { ok: false, reason: 'network' };
  return { ok: false, reason: 'failed' };
}

type Rpc = (fn: string) => Promise<{ error: { message: string } | null }>;

/** Runs the whole deletion; `reload` re-reads the store once the phone is empty. */
export async function deleteMyAccount(reload: () => Promise<void>, onStep?: (step: DeletionStep) => void): Promise<DeletionResult> {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, reason: 'not-signed-in' };
  const result = await deleteAccount({
    accessToken: async () => (await supabase.auth.getSession()).data.session?.access_token ?? null,
    whenSyncIdle,
    callRpc: async () => {
      try {
        // Not in database.types.ts (sql/028 is newer than the last `npm run types:gen`).
        const { error } = await (supabase.rpc as unknown as Rpc).call(supabase, 'delete_my_account');
        if (!error) return { ok: true };
        recordError('delete-account', error.message);
        return rpcFailure(error.message);
      } catch (e) {
        return rpcFailure(String((e as Error)?.message ?? e));
      }
    },
    callFunction: async (token): Promise<FunctionAnswer> => {
      try {
        const r = await fetch(deletionUrl(), { method: 'POST', headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
        const body = (await r.json().catch(() => null)) as { reason?: string } | null;
        if (r.status !== 200) recordError('delete-account', `function ${r.status} ${body?.reason ?? ''}`);
        return { status: r.status, reason: body?.reason ?? null };
      } catch {
        return null;
      }
    },
    signOutLocal: async () => {
      await supabase.auth.signOut({ scope: 'local' });
    },
    wipeLocal: async () => {
      await resetDatabase();
      await seedCatalog();
      await loadAcceptances();
      await reload();
    },
    onStep,
  });
  return result;
}
