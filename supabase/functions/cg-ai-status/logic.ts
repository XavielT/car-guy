/**
 * cg-ai-status (SPEC-A §A3): what the app needs to decide what an AI button does, with NO provider call and no model
 * cost. Works signed in or out. Signed out: only {enabled, configured}. Signed in: also consent and what is left today.
 */
import { bearer, preflight, reply, refuse, type Deps } from '../_shared/handler.ts';
import { evaluateGate, remaining } from '../_shared/gate.ts';
import { resolveSttConfig } from '../_shared/stt.ts';

const NIL_UUID = '00000000-0000-0000-0000-000000000000';

export async function handleStatus(req: Request, deps: Deps): Promise<Response> {
  const { env } = deps;
  if (req.method === 'OPTIONS') return preflight(req, env);
  if (req.method !== 'GET' && req.method !== 'POST') return refuse(req, env, 'method_not_allowed');

  const configured = !!env('ANTHROPIC_API_KEY');
  const token = bearer(req);
  let userId: string | null = null;
  if (token) {
    try {
      userId = await deps.authUser(token);
    } catch {
      return refuse(req, env, 'internal');
    }
    if (!userId) return refuse(req, env, 'sesion_invalida');
  }

  let snap;
  try {
    snap = await deps.gateSnapshot(userId ?? NIL_UUID, 'cg-ai-status');
  } catch {
    return refuse(req, env, 'internal');
  }

  if (!userId) return reply(req, env, 200, { ok: true, signed_in: false, enabled: snap.enabled, configured });

  // `refusal` is what a model call would be refused for right now (null = it would go ahead): the app shows it as the reason.
  const refusal = evaluateGate(snap, 'cg-ai-status', configured);
  return reply(req, env, 200, {
    ok: true,
    signed_in: true,
    enabled: snap.enabled,
    configured,
    consent: snap.consent,
    stt_configured: resolveSttConfig(env) !== null,
    refusal,
    remainingToday: remaining(snap),
    // The features the admin switched off: the app hides those buttons instead of letting them fail (SPEC-G §G10).
    features_off: Array.isArray(snap.features_off) ? snap.features_off : [],
  });
}
