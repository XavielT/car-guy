import { settings } from '../db/repos';
import { DISCOVER_DISMISSED_KEY, FEATURE_USED_KEY } from './discover';
import type { FeatureId } from './ids';

/** Local-only memory of which functions the person has opened (and which suggestions they waved away). */
async function readList(key: string): Promise<string[]> {
  const value = await settings.get<string[]>(key, []).catch(() => []);
  return Array.isArray(value) ? value : [];
}

export const readUsed = () => readList(FEATURE_USED_KEY);
export const readDismissed = () => readList(DISCOVER_DISMISSED_KEY);

export async function markFeatureUsed(id: FeatureId): Promise<void> {
  const used = await readUsed();
  if (used.includes(id)) return;
  await settings.set(FEATURE_USED_KEY, [...used, id]).catch(() => {});
}

export async function dismissDiscover(id: FeatureId): Promise<void> {
  const list = await readDismissed();
  if (list.includes(id)) return;
  await settings.set(DISCOVER_DISMISSED_KEY, [...list, id]).catch(() => {});
}
