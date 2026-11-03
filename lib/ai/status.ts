/**
 * What an AI button does, decided in ONE place (IMP 03112026 SPEC-A §A5): `deriveAiStatus` turns the gateway's
 * `cg-ai-status` answer (or its absence) into one state, and every AI button shows that state's message. The button
 * never hides: it says why it cannot be used, and the manual form underneath is untouched (offline-first, ADR-05).
 */
import { CAPPED_CODES, isServerCode } from './codes';

export type AiState =
  | 'loading'
  | 'available'
  | 'needs_account'
  | 'needs_consent'
  | 'offline'
  | 'capped'
  | 'disabled'
  | 'not_configured';

/** The body of `cg-ai-status` (supabase/functions/cg-ai-status/logic.ts). */
export type StatusResponse = {
  ok: true;
  signed_in: boolean;
  enabled: boolean;
  configured: boolean;
  consent?: boolean;
  stt_configured?: boolean;
  /** What a model call would be refused for right now; null = it would go ahead. */
  refusal?: string | null;
  remainingToday?: { hour: number; dayUsd: number };
};

export type StatusInput = {
  /** EXPO_PUBLIC_SUPABASE_* present in this build. */
  cloudConfigured: boolean;
  signedIn: boolean;
  /** null = not fetched yet. */
  response: StatusResponse | null;
  /** The status call failed: no network / timeout (`offline`) or an unexpected answer (`error`). */
  failure: 'offline' | 'error' | null;
};

export function deriveAiStatus(i: StatusInput): AiState {
  if (!i.cloudConfigured) return 'not_configured';
  // No network / timeout is "offline"; an unexpected answer (the function is not deployed, a 5xx) is "not available here".
  if (i.failure === 'offline') return 'offline';
  if (i.failure === 'error') return 'not_configured';
  if (!i.response) return i.signedIn ? 'loading' : 'needs_account';
  const r = i.response;
  if (!r.enabled) return 'disabled';
  if (!r.configured) return 'not_configured';
  if (!i.signedIn || !r.signed_in) return 'needs_account';
  if (!r.consent) return 'needs_consent';
  if (r.refusal && isServerCode(r.refusal) && CAPPED_CODES.includes(r.refusal)) return 'capped';
  return 'available';
}

/** Voice needs the speech-to-text key too; without it the microphone shows "not configured" while photos still work. */
export function voiceAvailable(state: AiState, r: StatusResponse | null): boolean {
  return state === 'available' && r?.stt_configured === true;
}
