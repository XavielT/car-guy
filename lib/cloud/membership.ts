import AsyncStorage from '@react-native-async-storage/async-storage';

import { recordError } from '../diagnostics';
import type { CarGuyClient } from './supabase';

/**
 * Is this x-core account a Car Guy account?
 *
 * x-core has one auth.users for every app on it, so a Music Hub email and
 * password sign in there just fine. Xaviel's rule (2026-09-29): an account made
 * in one app does not open another. A Car Guy account is one that signed up
 * from Car Guy — the signup trigger gives it a `carguy.profiles` row, which the
 * user cannot create by hand (sql/018) — and `carguy.is_app_user()` answers it.
 *
 * The server enforces the same rule with a restrictive policy on every table,
 * so this check is for the person: it turns "everything is empty and nothing
 * syncs" into a sentence on the Cuenta screen.
 *
 * A yes is remembered per user id, so a cold start offline keeps its session.
 * A no is never cached: the answer is re-read at the next sign-in.
 */

const key = (userId: string) => `carguy_member:${userId}`;
const inFlight = new Map<string, Promise<boolean | null>>();

export async function isKnownMember(userId: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(key(userId))) === '1';
  } catch {
    return false;
  }
}

export async function rememberMember(userId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(key(userId), '1');
  } catch {
    // Storage blocked: the check simply runs again next launch.
  }
}

/** true / false from the server, or null when it could not be asked (offline). */
export function checkMembership(supabase: CarGuyClient, userId: string): Promise<boolean | null> {
  const running = inFlight.get(userId);
  if (running) return running;

  const run = (async () => {
    const { data, error } = await supabase.rpc('is_app_user');
    if (error) {
      recordError('auth', `is_app_user: ${error.message}`);
      return null;
    }
    if (data === true) await rememberMember(userId);
    return data === true;
  })()
    .catch(() => null)
    .finally(() => inFlight.delete(userId));

  inFlight.set(userId, run);
  return run;
}
