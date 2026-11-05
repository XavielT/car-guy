/**
 * "Qué quiero ver" (SPEC-K §K3, ADR-73): the person's own feature set. Pure rules; the screens read them.
 *
 * Hidden is never deleted and never unreachable: `visibleIn` only decides what is PROMINENT (Hoy, Mi carro, the primary rows of Más).
 * Search, "Todas las funciones" and deep links always reach every registry feature. Nothing here ever filters a valid option.
 */
import { FEATURE_TOPICS, type FeatureGroup, type FeatureId } from './ids';
import type { FeatureDef } from './registry';

export type Topic = Exclude<FeatureGroup, 'basics'>;
export type FeatureSet = { topics: Topic[] | 'all'; answered: boolean };

/** What a person who never answered sees: everything. Existing people notice only the new layout. */
export const DEFAULT_FEATURE_SET: FeatureSet = { topics: 'all', answered: false };
/** The core a new person starts from in the chooser (SPEC-K §K3). */
export const CORE_TOPICS: Topic[] = ['fuel_expenses', 'maintenance', 'documents', 'trips'];
export const FEATURE_SET_KEY = 'feature_set';
/** Local: when each function was last opened (ms). `feature_used` (a list) stays as it was. */
export const FEATURE_USED_AT_KEY = 'feature_used_at';
export const SUGGEST_DAYS = 60;

export function parseFeatureSet(raw: unknown): FeatureSet {
  if (!raw || typeof raw !== 'object') return DEFAULT_FEATURE_SET;
  const r = raw as { topics?: unknown; answered?: unknown };
  if (r.topics === 'all') return { topics: 'all', answered: r.answered === true };
  if (Array.isArray(r.topics)) {
    const topics = FEATURE_TOPICS.filter((t) => (r.topics as unknown[]).includes(t));
    // An empty selection would show only the basics: treat it as "everything" rather than a dead end.
    return topics.length ? { topics, answered: r.answered === true } : { topics: 'all', answered: r.answered === true };
  }
  return DEFAULT_FEATURE_SET;
}

export const includesTopic = (set: FeatureSet, topic: FeatureGroup): boolean => topic === 'basics' || set.topics === 'all' || set.topics.includes(topic);

/** Is this function prominent for this person? (Reachability does not depend on it.) */
export const isProminent = (def: Pick<FeatureDef, 'group'>, set: FeatureSet): boolean => includesTopic(set, def.group);

/** The prominent functions, then the rest — `rest` is what "Más → Todas las funciones" adds, never a loss. */
export function splitBySet<T extends Pick<FeatureDef, 'group'>>(defs: readonly T[], set: FeatureSet): { shown: T[]; rest: T[] } {
  const shown: T[] = [];
  const rest: T[] = [];
  for (const d of defs) (isProminent(d, set) ? shown : rest).push(d);
  return { shown, rest };
}

/** Within what is shown, `advanced` ones go to "Avanzado" — unless everything was chosen explicitly ("Todo"). */
export function splitAdvanced<T extends Pick<FeatureDef, 'level'>>(defs: readonly T[], set: FeatureSet): { main: T[]; advanced: T[] } {
  if (set.topics === 'all' && set.answered) return { main: [...defs], advanced: [] };
  const main: T[] = [];
  const advanced: T[] = [];
  for (const d of defs) (d.level === 'advanced' ? advanced : main).push(d);
  return { main, advanced };
}

/**
 * Pre-fill for "¿Quieres ver solo lo que usas?": the topics of everything the person opened or recorded in the last 60 days.
 * `usedAt` is the local last-opened map; `activity` is what their records show (fill-ups, services, documents, trips…).
 * Returns null when there is no evidence at all (then the chooser starts from the core four).
 */
export function suggestTopics(defs: readonly Pick<FeatureDef, 'id' | 'group'>[], usedAt: Record<string, number>, activity: readonly FeatureId[], now: number): Topic[] | null {
  const since = now - SUGGEST_DAYS * 86_400_000;
  const used = new Set<string>(activity);
  for (const [id, at] of Object.entries(usedAt)) if (at >= since) used.add(id);
  const topics = new Set<Topic>();
  for (const d of defs) if (used.has(d.id) && d.group !== 'basics') topics.add(d.group);
  return topics.size ? FEATURE_TOPICS.filter((t) => topics.has(t)) : null;
}

/** Offer the "see only what you use" card once: not answered yet, and the person has used enough to pre-fill sensibly. */
export const shouldOfferSet = (set: FeatureSet, suggestion: Topic[] | null, dismissed: boolean): boolean => !set.answered && !dismissed && suggestion != null && suggestion.length >= 1;
