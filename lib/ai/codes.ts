/**
 * The error vocabulary of the AI gateway as the app sees it (IMP 03112026 ADR-66, SPEC-A §A5). The first block is
 * exactly what the Edge Functions send as `error_code` (supabase/functions/_shared/errors.ts); the last three are
 * raised by the client itself (no network, timeout, no account). The app translates the code: no provider text and
 * no server sentence ever reaches the screen.
 */
export const SERVER_CODES = [
  'method_not_allowed',
  'no_auth',
  'sesion_invalida',
  'forbidden',
  'ai_disabled',
  'ai_not_configured',
  'sin_consentimiento_ia',
  'rate_user',
  'cap_user_day',
  'cap_global_day',
  'bad_input',
  'provider_error',
  'unreadable',
  'internal',
] as const;

export type ServerCode = (typeof SERVER_CODES)[number];
export type AiErrorCode = ServerCode | 'offline' | 'timeout' | 'needs_account';

export function isServerCode(x: unknown): x is ServerCode {
  return typeof x === 'string' && (SERVER_CODES as readonly string[]).includes(x);
}

export class AiError extends Error {
  constructor(public code: AiErrorCode) {
    super(code);
    this.name = 'AiError';
  }
}

/** Codes where the person can do nothing now but fill the form by hand (or wait): the button shows why, not a retry. */
export const CAPPED_CODES: readonly AiErrorCode[] = ['rate_user', 'cap_user_day', 'cap_global_day'];
