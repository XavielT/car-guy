import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

/**
 * The one Supabase client, pointed at the `carguy` schema on `x-core`.
 *
 * `x-core` is shared with Music Hub and xaviel-web, which is why `db.schema` is
 * set: without it the client would read `public`, where Music Hub's tables
 * live. The schema also has to be listed under Project Settings → API →
 * Exposed schemas or PostgREST answers `PGRST106` — `describeSchemaError()`
 * below turns that into a sentence aimed at whoever can fix it.
 *
 * The client is created lazily and may not exist at all: Car Guy works with no
 * account and no network (ADR-05), so a missing URL or key is a configuration
 * state to report, never a crash at import time.
 */

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/** True when both variables are present, so the UI can say why sign-in is off. */
export const isCloudConfigured = Boolean(url && anonKey);

/**
 * Session storage.
 *
 * On web `localStorage` throws in Safari's private mode and when a browser is
 * configured to block site data — and it throws on *read*, not just on write,
 * which would take the whole app down at import. Every call is wrapped; the
 * cost of failing is that the session does not persist, which is a worse
 * experience and not a broken one.
 */
const webStorage = {
  getItem(key: string) {
    try {
      return Promise.resolve(window.localStorage.getItem(key));
    } catch {
      return Promise.resolve(null);
    }
  },
  setItem(key: string, value: string) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // Private mode, or site data blocked. The session lives for this tab only.
    }
    return Promise.resolve();
  },
  removeItem(key: string) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Same.
    }
    return Promise.resolve();
  },
};

/**
 * Built through a factory so the client type carries `schema: 'carguy'` without
 * this file having to name the generic — supabase-js has moved which position
 * the schema sits in more than once, and `ReturnType` cannot be wrong about it.
 */
function createCarGuyClient(projectUrl: string, key: string) {
  return createClient(projectUrl, key, {
    db: { schema: 'carguy' },
    auth: {
      storage: Platform.OS === 'web' ? webStorage : AsyncStorage,
      persistSession: true,
      autoRefreshToken: true,
      // Car Guy has no OAuth redirect to read back, and leaving this on makes
      // the web client parse every URL it is handed. x-core's other apps set it
      // the same way.
      detectSessionInUrl: false,
    },
  });
}

export type CarGuyClient = ReturnType<typeof createCarGuyClient>;

let client: CarGuyClient | null = null;

/**
 * The client, or null when the project is not configured.
 *
 * Callers must handle null. That is deliberate: it is the same branch they
 * already need for "signed out", and it keeps a missing `.env.local` from
 * looking like a bug in the account screen.
 */
export function getSupabase(): CarGuyClient | null {
  if (!url || !anonKey) return null;
  if (!client) client = createCarGuyClient(url, anonKey);
  return client;
}

/** PostgREST's code for "that schema is not exposed". */
export const SCHEMA_NOT_EXPOSED = 'PGRST106';

/**
 * Translates the one error that is a configuration mistake rather than a user
 * one, so it reads as an instruction to whoever administers the project.
 */
export function describeSchemaError(error: { code?: string } | null): string | null {
  if (error?.code === SCHEMA_NOT_EXPOSED) {
    return 'El schema carguy no está expuesto en Supabase (Project Settings → API → Exposed schemas).';
  }
  return null;
}
