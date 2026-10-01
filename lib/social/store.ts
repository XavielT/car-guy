import { useSyncExternalStore } from 'react';

import { getSupabase } from '../cloud/supabase';
import { enqueue } from '../db/client';
import { recordError } from '../diagnostics';
import {
  acceptFollow,
  blockUser,
  followUser,
  listFollows,
  mySocial,
  removeFollower,
  unblockUser,
  unfollowUser,
  type FollowListKind,
  type PersonRef,
} from './api';
import { EMPTY_SNAPSHOT, reduceSocial, type SocialAction, type SocialSnapshot } from './cache';
import type { RpcResult } from './rpc';

/**
 * The social graph on this phone (IMP 01102026 Phase 5): the cache in `social_cache`, refreshed from the cloud
 * on launch and after every action, applied optimistically first. Offline the screens show the cache with
 * "sin conexión". The cloud decides; a refused action is undone by the refresh that follows it.
 */
type State = SocialSnapshot & { offline: boolean; loaded: boolean };

let state: State = { ...EMPTY_SNAPSHOT, offline: false, loaded: false };
const listeners = new Set<() => void>();
const set = (next: State) => {
  state = next;
  for (const l of listeners) l();
};

const KEY = 'me';
const KINDS: FollowListKind[] = ['followers', 'following', 'friends', 'requests_sent'];

async function readCache(): Promise<SocialSnapshot> {
  return enqueue(async (db) => {
    const row = await db.getFirstAsync<{ json: string }>('SELECT json FROM social_cache WHERE key = ?', [KEY]);
    try {
      return row ? ({ ...EMPTY_SNAPSHOT, ...JSON.parse(row.json) } as SocialSnapshot) : EMPTY_SNAPSHOT;
    } catch {
      return EMPTY_SNAPSHOT;
    }
  });
}

async function writeCache(s: SocialSnapshot): Promise<void> {
  const { me, lists, at } = s;
  await enqueue((db) =>
    db.runAsync('INSERT OR REPLACE INTO social_cache (key, json, updated_at) VALUES (?, ?, ?)', [KEY, JSON.stringify({ me, lists, at }), new Date().toISOString()]),
  );
}

/** Cache first (instant, offline), then the cloud. */
export async function loadSocial(): Promise<void> {
  if (!state.loaded) set({ ...state, ...(await readCache()), loaded: true });
  await refreshSocial();
}

export async function refreshSocial(): Promise<boolean> {
  const [me, ...lists] = await Promise.all([mySocial(), ...KINDS.map((k) => listFollows(k))]);
  if (!me.ok) {
    set({ ...state, offline: me.reason === 'offline' || me.reason === 'error' });
    return false;
  }
  const next: SocialSnapshot = {
    me: me.data,
    lists: Object.fromEntries(KINDS.map((k, i) => [k, lists[i].ok ? lists[i].data : (state.lists[k] ?? [])])),
    at: new Date().toISOString(),
  };
  set({ ...state, ...next, offline: false, loaded: true });
  await writeCache(next).catch((e) => recordError('social-cache', e));
  return true;
}

async function act<T>(action: SocialAction, call: () => Promise<RpcResult<T>>): Promise<RpcResult<T>> {
  const before = state;
  set({ ...state, ...reduceSocial(state, action) });
  const r = await call();
  if (!r.ok) set(before);
  void refreshSocial();
  return r;
}

export const socialActions = {
  async follow(person: PersonRef) {
    const r = await followUser(person.handle);
    if (r.ok) set({ ...state, ...reduceSocial(state, { type: 'followed', person, status: r.data }) });
    void refreshSocial();
    return r;
  },
  unfollow: (handle: string) => act({ type: 'unfollowed', handle }, () => unfollowUser(handle)),
  accept: (handle: string) => act({ type: 'accepted', handle }, () => acceptFollow(handle)),
  // A declined request is a follower row in 'requested' — remove_follower deletes it either way.
  decline: (handle: string) => act({ type: 'declined', handle }, () => removeFollower(handle)),
  removeFollower: (handle: string) => act({ type: 'removedFollower', handle }, () => removeFollower(handle)),
  block: (handle: string) => act({ type: 'blocked', handle }, () => blockUser(handle)),
  unblock: (handle: string) => act({ type: 'unblocked', handle }, () => unblockUser(handle)),
};

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useSocial(): State {
  return useSyncExternalStore(subscribe, () => state, () => state);
}

/** Reset (sign-out, "borrar datos"): the next account must not see this one's graph. */
export function clearSocialMemory(): void {
  set({ ...EMPTY_SNAPSHOT, offline: false, loaded: false });
}

// ------------------------------------------------------------------ own profile (cloud row) ----

/** The social half of my own `carguy.profiles` row (sql/034 + 037). */
export type MySocialProfile = {
  handle: string | null;
  bio: string;
  instagram: string | null;
  is_public: boolean;
  photo_public: boolean;
  show_cars: boolean;
  show_stats: boolean;
  show_fichas: boolean;
};

const PROFILE_COLUMNS = 'handle, bio, instagram, is_public, photo_public, show_cars, show_stats, show_fichas';

export async function readMySocialProfile(): Promise<MySocialProfile | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const uid = (await supabase.auth.getSession()).data.session?.user.id;
  if (!uid) return null;
  const { data, error } = await supabase.from('profiles').select(PROFILE_COLUMNS).eq('user_id', uid).maybeSingle();
  if (error || !data) return null;
  return { ...(data as unknown as MySocialProfile), bio: (data as { bio: string | null }).bio ?? '' };
}

export type SaveProfileResult = { ok: true } | { ok: false; reason: 'signed-out' | 'handle_taken' | 'handle_reserved' | 'handle_cooldown' | 'handle_format' | 'error' };

/** Writes the changed fields; `photo_public_jpeg` comes with the photo switch (lib/social/publicPhoto.ts). */
export async function saveMySocialProfile(patch: Partial<MySocialProfile> & { photo_public_jpeg?: string | null }): Promise<SaveProfileResult> {
  const supabase = getSupabase();
  const uid = supabase && (await supabase.auth.getSession()).data.session?.user.id;
  if (!supabase || !uid) return { ok: false, reason: 'signed-out' };
  const { error } = await supabase.from('profiles').update({ ...patch, updated_at: new Date().toISOString() }).eq('user_id', uid);
  if (!error) return { ok: true };
  const m = error.message;
  if (/duplicate key.*handle/i.test(m)) return { ok: false, reason: 'handle_taken' };
  for (const r of ['handle_reserved', 'handle_cooldown'] as const) if (m.includes(r)) return { ok: false, reason: r };
  if (m.includes('profiles_handle_format')) return { ok: false, reason: 'handle_format' };
  recordError('social-profile', m);
  return { ok: false, reason: 'error' };
}
