/** A missing variable fails with its NAME, never a bare `undefined` (SGC `_shared/env.ts` pattern). Names only, no values. */
export type EnvGetter = (name: string) => string | undefined;

export function envRequired(get: EnvGetter, name: string): string {
  const v = get(name);
  if (v == null || v === '') throw new Error(`Missing environment variable ${name}`);
  return v;
}

/** Models come from secrets so changing one is a secret change, not a code change (ADR-65). */
export const DEFAULT_MODEL_VISION = 'claude-haiku-5-5';
export const DEFAULT_MODEL_REASON = 'claude-sonnet-5-5';

export function modelVision(get: EnvGetter): string {
  return get('CG_MODEL_VISION') || DEFAULT_MODEL_VISION;
}
export function modelReason(get: EnvGetter): string {
  return get('CG_MODEL_REASON') || DEFAULT_MODEL_REASON;
}
