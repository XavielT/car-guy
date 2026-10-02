import { useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import { getSupabase } from '../cloud/supabase';
import { settings } from '../db/repos';
import { recordError } from '../diagnostics';
import { junteTopic } from './api';
import { positionPayload, prunePeers, readPayload, shouldPublish, upsertPeer, type Fix, type LastSent, type Peers } from './live';

/**
 * A junte's live channel (IMP 01102026 Phase 6, ADR-57, research 02 §3): Realtime **private** channel
 * `carguy:junte:<id>` — sql/036's policies decide who may join (members, in the window). Presence says who is
 * online and sharing; Broadcast `pos` carries positions (never stored); Broadcast `kick` tells a removed member
 * to leave before their token refresh would. One junte at a time.
 */
export type LiveStatus = 'off' | 'joining' | 'joined' | 'refused';
export type PresenceMeta = { handle: string; avatar_id: string | null; live: boolean };

type State = {
  junteId: string | null;
  status: LiveStatus;
  /** Am I sharing my position? */
  sharing: boolean;
  peers: Peers;
  online: Record<string, PresenceMeta>;
  kicked: boolean;
};

let state: State = { junteId: null, status: 'off', sharing: false, peers: {}, online: {}, kicked: false };
const listeners = new Set<() => void>();
const set = (patch: Partial<State>) => {
  state = { ...state, ...patch };
  for (const l of listeners) l();
};

type Channel = ReturnType<NonNullable<ReturnType<typeof getSupabase>>['channel']>;
let channel: Channel | null = null;
let me: { handle: string; avatar_id: string | null } | null = null;
let members = 1;
let lastSent: LastSent = null;
let authSub: { unsubscribe: () => void } | null = null;

/** The background task reads this (settings) to publish over REST while the app is not in front. */
export const LIVE_SETTING = 'junte_live';
export type LiveSetting = { junteId: string; handle: string; until: number; members: number } | null;

export async function joinJunte(junteId: string, who: { handle: string; avatar_id: string | null }, window: { to: number }): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  if (state.junteId === junteId && channel) return;
  await leaveJunte();
  me = who;
  set({ junteId, status: 'joining', peers: {}, online: {}, kicked: false, sharing: false });
  // The socket must carry the user's JWT for the private-channel policies (and a fresh one after a refresh).
  const session = (await supabase.auth.getSession()).data.session;
  if (session) await supabase.realtime.setAuth(session.access_token);
  authSub = supabase.auth.onAuthStateChange((event, next) => {
    if (event === 'TOKEN_REFRESHED' && next) void supabase.realtime.setAuth(next.access_token);
  }).data.subscription;

  const ch = supabase.channel(junteTopic(junteId), { config: { private: true, broadcast: { self: false, ack: false }, presence: { key: who.handle } } });
  channel = ch;
  ch.on('broadcast', { event: 'pos' }, ({ payload }) => {
    const p = readPayload(payload);
    if (p) set({ peers: upsertPeer(state.peers, p, Date.now(), me?.handle ?? null) });
  })
    .on('broadcast', { event: 'kick' }, ({ payload }) => {
      if ((payload as { h?: string })?.h === me?.handle) {
        set({ kicked: true });
        void leaveJunte();
      }
    })
    .on('presence', { event: 'sync' }, () => {
      const raw = ch.presenceState<PresenceMeta>();
      const online: Record<string, PresenceMeta> = {};
      for (const [key, metas] of Object.entries(raw)) if (metas[0]) online[key] = metas[0] as unknown as PresenceMeta;
      members = Math.max(1, Object.keys(online).length);
      set({ online, peers: prunePeers(state.peers, Date.now(), Object.keys(online)) });
    })
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        set({ status: 'joined' });
        void ch.track({ handle: who.handle, avatar_id: who.avatar_id, live: state.sharing } satisfies PresenceMeta);
      }
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') set({ status: 'refused' });
    });
  const stored = await settings.get<LiveSetting>(LIVE_SETTING, null);
  if (stored && stored.junteId !== junteId) await settings.set(LIVE_SETTING, null);
  windowEnd = window.to;
}

let windowEnd = 0;

export async function setSharing(on: boolean): Promise<void> {
  set({ sharing: on });
  lastSent = null;
  if (channel && me) void channel.track({ handle: me.handle, avatar_id: me.avatar_id, live: on } satisfies PresenceMeta);
  const value: LiveSetting = on && state.junteId && me ? { junteId: state.junteId, handle: me.handle, until: windowEnd, members } : null;
  await settings.set(LIVE_SETTING, value);
}

/** Foreground: a fix from the screen's position watch. */
export function publishFix(fix: Fix): void {
  if (!channel || !me || !state.sharing || state.status !== 'joined') return;
  const now = Date.now();
  if (now > windowEnd || !shouldPublish(lastSent, fix, now, members)) return;
  lastSent = { t: now, lat: fix.lat, lng: fix.lng };
  void channel.send({ type: 'broadcast', event: 'pos', payload: positionPayload(me.handle, fix) }).catch((e) => recordError('junte-send', e));
}

/** The owner removing someone: the RPC already ended their membership; this tells their open map to close. */
export function sendKick(handle: string): void {
  void channel?.send({ type: 'broadcast', event: 'kick', payload: { h: handle } });
}

export async function leaveJunte(): Promise<void> {
  const supabase = getSupabase();
  authSub?.unsubscribe();
  authSub = null;
  if (channel && supabase) {
    try {
      await channel.untrack();
      await supabase.removeChannel(channel);
    } catch (e) {
      recordError('junte-leave', e);
    }
  }
  channel = null;
  lastSent = null;
  await settings.set(LIVE_SETTING, null);
  set({ junteId: null, status: 'off', sharing: false, peers: {}, online: {} });
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}
export function useJunteLive(): State {
  return useSyncExternalStore(subscribe, () => state, () => state);
}

// ------------------------------------------------------------------ background (Android) ----

let bgLast: LastSent = null;

/**
 * From the trip task when the app is not in front (research §3.4): REST broadcast — no socket needed, the same
 * message cost. Only with a stored "En vivo" for a junte whose window is still open.
 */
export async function publishFromBackground(fixes: Fix[]): Promise<void> {
  if (AppState.currentState === 'active' || !fixes.length) return;
  const live = await settings.get<LiveSetting>(LIVE_SETTING, null);
  const now = Date.now();
  if (!live || now > live.until) return;
  const fix = fixes[fixes.length - 1];
  if (!shouldPublish(bgLast, fix, now, live.members)) return;
  const supabase = getSupabase();
  if (!supabase) return;
  try {
    const session = (await supabase.auth.getSession()).data.session;
    if (!session) return;
    await supabase.realtime.setAuth(session.access_token);
    const ch = supabase.channel(junteTopic(live.junteId), { config: { private: true } });
    const r = await ch.httpSend('pos', positionPayload(live.handle, fix));
    void supabase.removeChannel(ch);
    if ((r as { success?: boolean })?.success !== false) bgLast = { t: now, lat: fix.lat, lng: fix.lng };
  } catch (e) {
    recordError('junte-bg', e);
  }
}
