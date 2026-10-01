import { useEffect, useSyncExternalStore } from 'react';

import type { SettingsKV } from './welcome';

/**
 * First-visit tips (research 02 §3.3): one inline card at the top of a screen,
 * shown until dismissed. Dismissed ids live in the `tips_seen` setting as a JSON
 * list; Más → Ayuda → Consejos empties it.
 */
export const TIP_IDS = ['trips', 'build', 'track', 'album', 'events', 'drive', 'odometer'] as const;
export type TipId = (typeof TIP_IDS)[number];
export const TIPS_KEY = 'tips_seen';

/** Whatever is stored → a clean list of known ids, no duplicates. */
export function parseTipsSeen(raw: unknown): TipId[] {
  if (!Array.isArray(raw)) return [];
  const known = new Set<string>(TIP_IDS);
  return raw.filter((id, i): id is TipId => typeof id === 'string' && known.has(id) && raw.indexOf(id) === i);
}

export function withTipSeen(seen: readonly TipId[], id: TipId): TipId[] {
  return seen.includes(id) ? [...seen] : [...seen, id];
}

export function isTipSeen(seen: readonly TipId[], id: TipId): boolean {
  return seen.includes(id);
}

function defaultKV(): SettingsKV {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return (require('../db/repos') as typeof import('../db/repos')).settings;
}

type State = { loaded: boolean; seen: TipId[] };
let state: State = { loaded: false, seen: [] };
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

function setState(next: State): void {
  state = next;
  for (const l of listeners) l();
}

export function loadTips(kv: SettingsKV = defaultKV()): Promise<void> {
  if (state.loaded) return Promise.resolve();
  loading ??= kv
    .get<unknown>(TIPS_KEY, [])
    .then((raw) => setState({ loaded: true, seen: parseTipsSeen(raw) }))
    // Unreadable: show nothing rather than a tip on every visit.
    .catch(() => setState({ loaded: true, seen: [...TIP_IDS] }))
    .finally(() => {
      loading = null;
    });
  return loading;
}

export async function dismissTip(id: TipId, kv: SettingsKV = defaultKV()): Promise<void> {
  const seen = withTipSeen(state.seen, id);
  setState({ loaded: true, seen });
  await kv.set(TIPS_KEY, seen).catch(() => {});
}

/** Más → Ayuda → Consejos: every tip shows again. */
export async function resetTips(kv: SettingsKV = defaultKV()): Promise<void> {
  setState({ loaded: true, seen: [] });
  await kv.set(TIPS_KEY, []).catch(() => {});
}

export function getTipsSeen(): TipId[] {
  return state.seen;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** True while the tip should show (false until the setting is read, so it never flashes). */
export function useTip(id: TipId): boolean {
  const s = useSyncExternalStore(subscribe, () => state, () => state);
  useEffect(() => {
    if (!s.loaded) void loadTips();
  }, [s.loaded]);
  return s.loaded && !isTipSeen(s.seen, id);
}

/** Test hook. */
export function __resetTipsForTests(): void {
  state = { loaded: false, seen: [] };
  loading = null;
}
