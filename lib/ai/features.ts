/**
 * The AI features the admin can switch off one by one (SPEC-G §G10, sql/044). Same ids as supabase/functions/_shared/features.ts (a test
 * pins them). The server refuses a call for a switched-off feature; the app also hides its button (`useAiStatus().featureOff`), so the
 * person is not offered something that would fail.
 */
export const AI_FEATURES = ['search', 'album', 'places', 'check_photo', 'accident', 'sale'] as const;
export type AiFeature = (typeof AI_FEATURES)[number];

/** The list to save after flipping one feature; unknown ids already stored are kept out, so the list never grows garbage. */
export function withFeature(off: readonly string[], id: AiFeature, on: boolean): string[] {
  const rest = off.filter((x) => x !== id && (AI_FEATURES as readonly string[]).includes(x));
  return on ? rest : [...rest, id];
}
