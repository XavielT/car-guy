/**
 * The only way the app talks to the AI gateway (IMP 03112026 ADR-65/66, SPEC-A §A5): `cg-*` Edge Functions on x-core,
 * with the person's own JWT. No third-party key exists in the app. A 20 s timeout; a 4xx is never retried (the gate
 * already said no); every failure becomes an `AiError` with a stable code the UI translates.
 */
import { getSupabase } from '../cloud/supabase';
import { rpc } from '../social/rpc';
import { AiError, isServerCode } from './codes';
import type { StatusResponse } from './status';

/** The wording the person accepted. Bump it when the consent text changes materially (the old row stays valid until re-asked). */
export const AI_CONSENT_VERSION = '1';
export const AI_TIMEOUT_MS = 20_000;

// Dot access on purpose: Metro inlines `process.env.EXPO_PUBLIC_*` only when written exactly like this.
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export function aiEndpoint(fn: string): string | null {
  return url ? `${url}/functions/v1/${fn}` : null;
}

async function accessToken(): Promise<string | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

type Fetch = typeof fetch;

/** Pure: a Response becomes the typed body, or throws AiError. Exported for the tests. */
export async function readAiResponse<T>(res: Response): Promise<T> {
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    /* not JSON */
  }
  const b = body as { ok?: boolean; error_code?: unknown } | null;
  if (res.ok && b && b.ok !== false) return body as T;
  const code = b?.error_code;
  throw new AiError(isServerCode(code) ? code : res.status >= 500 ? 'provider_error' : 'internal');
}

export function mapFetchFailure(e: unknown): AiError {
  if (e instanceof AiError) return e;
  const name = (e as { name?: string } | null)?.name;
  return new AiError(name === 'AbortError' || name === 'TimeoutError' ? 'timeout' : 'offline');
}

/** POST a payload to a `cg-*` function and return its typed answer, or throw `AiError`. */
export async function callAi<T>(fn: string, payload: unknown, fetchImpl: Fetch = fetch): Promise<T> {
  const endpoint = aiEndpoint(fn);
  if (!endpoint || !anonKey) throw new AiError('offline');
  const token = await accessToken();
  if (!token) throw new AiError('needs_account');
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), AI_TIMEOUT_MS);
  try {
    const res = await fetchImpl(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json', apikey: anonKey, authorization: `Bearer ${token}` },
      body: JSON.stringify(payload ?? {}),
      signal: ctl.signal,
    });
    return await readAiResponse<T>(res);
  } catch (e) {
    throw mapFetchFailure(e);
  } finally {
    clearTimeout(timer);
  }
}

/** cg-ai-status: works signed in or out. null = the cloud is not configured in this build. Throws AiError when unreachable. */
export async function fetchAiStatus(fetchImpl: Fetch = fetch): Promise<StatusResponse | null> {
  const endpoint = aiEndpoint('cg-ai-status');
  if (!endpoint || !anonKey) return null;
  const token = await accessToken();
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), AI_TIMEOUT_MS);
  try {
    const res = await fetchImpl(endpoint, {
      method: 'GET',
      headers: { apikey: anonKey, ...(token ? { authorization: `Bearer ${token}` } : {}) },
      signal: ctl.signal,
    });
    return await readAiResponse<StatusResponse>(res);
  } catch (e) {
    throw mapFetchFailure(e);
  } finally {
    clearTimeout(timer);
  }
}

/** Accept or withdraw the AI terms: carguy.set_ai_consent (sql/042). Returns the stored state, or null on failure. */
export async function setAiConsent(on: boolean): Promise<boolean | null> {
  const r = await rpc<boolean>('set_ai_consent', { p_on: on, p_version: AI_CONSENT_VERSION });
  return r.ok ? r.data === true : null;
}
