import { activeFeatures, type FeatureDef } from './registry';
import type { FeatureId } from './ids';

/**
 * "Descubre" (IMP 16102026 SPEC-C §8): one function at a time that the person has never used, in an order that goes
 * from what saves the most trouble to what is nice to have. Dismissing one moves to the next and persists. Pure.
 */
export const DISCOVER_ORDER: FeatureId[] = [
  'obd',
  'repair',
  'check',
  'docs',
  'build',
  'album',
  'events',
  'stats',
  'book',
  'contacts',
  'track',
  'share',
  'juntes',
];

export function pickDiscover(used: ReadonlySet<string>, dismissed: ReadonlySet<string>, pool: FeatureDef[] = activeFeatures()): FeatureDef | null {
  for (const id of DISCOVER_ORDER) {
    if (used.has(id) || dismissed.has(id)) continue;
    const def = pool.find((f) => f.id === id);
    if (def) return def;
  }
  return null;
}

export const FEATURE_USED_KEY = 'feature_used';
export const DISCOVER_DISMISSED_KEY = 'discover_dismissed';
export const OBD_NOTICE_KEY = 'obd_notice_dismissed';
export const TOOLS_TOUR_KEY = 'tools_tour_done';
