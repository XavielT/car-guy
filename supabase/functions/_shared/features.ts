/**
 * The AI features the admin can switch off one by one (IMP 03112026 SPEC-G §G10, sql/044). A feature id is what lives in the
 * `ai_features_off` array of app_config; the gateway refuses a call for a switched-off feature with `ai_disabled`, before any provider
 * is reached. Pure, no imports. The app keeps the same list in lib/ai/features.ts (a test pins them).
 *
 *   search       G1 smart search (the app sends `feature: "search"` with its cg-ai-intent call; dictation is not affected)
 *   album        G2 album photo analysis and the part-label read in the mod form (cg-ai-read kinds album_batch, part_label)
 *   places       G4 nearby places (cg-places)
 *   check_photo  G6 weekly-check photos (cg-ai-read kind check_photo)
 *   accident     G7 accident photos (cg-ai-read kind damage_photos)
 *   sale         G9 sale-ready summary (cg-ai-sale)
 */
export const FEATURE_IDS = ['search', 'album', 'places', 'check_photo', 'accident', 'sale'] as const;
export type FeatureId = (typeof FEATURE_IDS)[number];

const READ_KIND_FEATURE: Record<string, FeatureId> = { album_batch: 'album', part_label: 'album', check_photo: 'check_photo', damage_photos: 'accident' };

/** cg-ai-read: the feature a kind belongs to (null for the older kinds, which have no switch of their own). */
export function readFeature(body: unknown): FeatureId | null {
  const kind = (body as { kind?: unknown } | null)?.kind;
  return typeof kind === 'string' ? (READ_KIND_FEATURE[kind] ?? null) : null;
}

/** cg-ai-intent: only a call that says it is the smart search counts as that feature. */
export function intentFeature(body: unknown): FeatureId | null {
  return (body as { feature?: unknown } | null)?.feature === 'search' ? 'search' : null;
}

export const fixedFeature = (id: FeatureId) => (): FeatureId => id;
