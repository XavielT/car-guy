/**
 * Reading the password-reset link.
 *
 * The client uses supabase-js's implicit flow, so after the email's link goes
 * through x-core's /verify endpoint it lands on `…/nueva-contrasena` with the
 * session in the fragment:
 *
 *   carguy://nueva-contrasena#access_token=…&refresh_token=…&type=recovery
 *   https://car-guy.vercel.app/nueva-contrasena#access_token=…
 *
 * or, when the link expired or was already used, with an error there instead
 * (`#error=access_denied&error_code=otp_expired&error_description=…`). Some
 * redirects put the same pairs in the query string, so both are read.
 */

export type RecoveryLink =
  | { kind: 'tokens'; accessToken: string; refreshToken: string }
  | { kind: 'error'; code: string }
  | { kind: 'none' };

export function parseRecoveryUrl(url: string | null | undefined): RecoveryLink {
  if (!url) return { kind: 'none' };

  const params = new URLSearchParams();
  const hash = url.indexOf('#');
  const query = url.indexOf('?');
  if (query !== -1) {
    const end = hash > query ? hash : url.length;
    new URLSearchParams(url.slice(query + 1, end)).forEach((v, k) => params.set(k, v));
  }
  if (hash !== -1) {
    new URLSearchParams(url.slice(hash + 1)).forEach((v, k) => params.set(k, v));
  }

  const error = params.get('error_code') ?? params.get('error');
  if (error) return { kind: 'error', code: error };

  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (accessToken && refreshToken) return { kind: 'tokens', accessToken, refreshToken };

  return { kind: 'none' };
}
