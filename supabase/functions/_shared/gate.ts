/**
 * The AI gate (IMP 03112026 ADR-66): every `cg-*` model function runs the SAME checks in the SAME order, so a
 * function can never forget one:
 *
 *   1. a valid user JWT                      → 401 no_auth / sesion_invalida
 *   2. app_config.ai_enabled (kill switch)   → 503 ai_disabled
 *   3. the provider key is configured        → 503 ai_not_configured
 *   4. ai_consent for this person            → 403 sin_consentimiento_ia   (server-side, never the client alone)
 *   5. per-user hour limit                   → 429 rate_user
 *      per-user day cap (USD)                → 429 cap_user_day
 *      global day cap (USD)                  → 429 cap_global_day
 *      places: per-user day count            → 429 cap_user_day
 *   6. the call, then ONE ai_usage row (function, model, tokens, cost, ok) — written by handler.ts.
 *
 * `>=` everywhere: a cap of 0 stops everything, which is how the admin (and the smoke test) proves the brakes work.
 * Pure: the snapshot comes from `carguy.ai_gate()` (sql/042) in one round trip; nothing here touches the network.
 */
import type { AiErrorCode } from './errors.ts';

export type GateSnapshot = {
  enabled: boolean;
  consent: boolean;
  limits: { user_hour: number; user_day_usd: number; global_day_usd: number; places_user_day: number };
  used: { user_hour: number; user_day_usd: number; global_day_usd: number; function_user_day: number };
  day_start?: string;
};

/** The first failing check, or null when the call may go ahead. `configured` = the provider key exists. */
export function evaluateGate(s: GateSnapshot, fn: string, configured: boolean): AiErrorCode | null {
  if (!s.enabled) return 'ai_disabled';
  if (!configured) return 'ai_not_configured';
  if (!s.consent) return 'sin_consentimiento_ia';
  if (Number(s.used.user_hour) >= Number(s.limits.user_hour)) return 'rate_user';
  if (Number(s.used.user_day_usd) >= Number(s.limits.user_day_usd)) return 'cap_user_day';
  if (Number(s.used.global_day_usd) >= Number(s.limits.global_day_usd)) return 'cap_global_day';
  if (fn === 'cg-places' && Number(s.used.function_user_day) >= Number(s.limits.places_user_day)) return 'cap_user_day';
  return null;
}

/** What the app shows next to an AI button, with no provider call (cg-ai-status). */
export function remaining(s: GateSnapshot) {
  const usd = (n: number) => Math.max(0, Math.round(n * 1_000_000) / 1_000_000);
  return {
    hour: Math.max(0, Number(s.limits.user_hour) - Number(s.used.user_hour)),
    dayUsd: usd(Math.min(Number(s.limits.user_day_usd) - Number(s.used.user_day_usd), Number(s.limits.global_day_usd) - Number(s.used.global_day_usd))),
  };
}
