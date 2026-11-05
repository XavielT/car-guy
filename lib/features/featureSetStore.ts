/**
 * Where "Qué quiero ver" lives: the existing local settings (key `feature_set`), re-read when it changes. Local first, like the other
 * display preferences; no table, no migration (SPEC-K §K3: "stored with the existing preferences mechanism").
 */
import { useEffect, useState } from 'react';

import { settings } from '../db/repos';
import { DEFAULT_FEATURE_SET, FEATURE_SET_KEY, parseFeatureSet, type FeatureSet } from './featureSet';

const listeners = new Set<() => void>();

export async function loadFeatureSet(): Promise<FeatureSet> {
  return parseFeatureSet(await settings.get<unknown>(FEATURE_SET_KEY, null).catch(() => null));
}

export async function saveFeatureSet(next: FeatureSet): Promise<void> {
  await settings.set(FEATURE_SET_KEY, parseFeatureSet({ ...next, answered: true }));
  for (const l of listeners) l();
}

/** Back to "Todo" and unanswered: the reversal of any choice. */
export async function resetFeatureSet(): Promise<void> {
  await settings.set(FEATURE_SET_KEY, DEFAULT_FEATURE_SET);
  for (const l of listeners) l();
}

export function useFeatureSet(): { set: FeatureSet; ready: boolean } {
  const [state, setState] = useState<{ set: FeatureSet; ready: boolean }>({ set: DEFAULT_FEATURE_SET, ready: false });
  useEffect(() => {
    let live = true;
    const read = () => void loadFeatureSet().then((set) => live && setState({ set, ready: true }));
    read();
    listeners.add(read);
    return () => {
      live = false;
      listeners.delete(read);
    };
  }, []);
  return state;
}
