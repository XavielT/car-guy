import { settings } from '../db/repos';
import { DISCOVER_DISMISSED_KEY, FEATURE_USED_KEY } from './discover';
import { FEATURE_USED_AT_KEY } from './featureSet';
import type { FeatureId } from './ids';

/** Local-only memory of which functions the person has opened (and which suggestions they waved away). */
async function readList(key: string): Promise<string[]> {
  const value = await settings.get<string[]>(key, []).catch(() => []);
  return Array.isArray(value) ? value : [];
}

export const readUsed = () => readList(FEATURE_USED_KEY);
export const readDismissed = () => readList(DISCOVER_DISMISSED_KEY);

/** When each function was last opened (ms): what "¿Quieres ver solo lo que usas?" is pre-filled from (last 60 days). */
export async function readUsedAt(): Promise<Record<string, number>> {
  const v = await settings.get<Record<string, number>>(FEATURE_USED_AT_KEY, {}).catch((): Record<string, number> => ({}));
  return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
}

export async function markFeatureUsed(id: FeatureId): Promise<void> {
  const at = await readUsedAt();
  await settings.set(FEATURE_USED_AT_KEY, { ...at, [id]: Date.now() }).catch(() => {});
  const used = await readUsed();
  if (used.includes(id)) return;
  await settings.set(FEATURE_USED_KEY, [...used, id]).catch(() => {});
}

export async function dismissDiscover(id: FeatureId): Promise<void> {
  const list = await readDismissed();
  if (list.includes(id)) return;
  await settings.set(DISCOVER_DISMISSED_KEY, [...list, id]).catch(() => {});
}
