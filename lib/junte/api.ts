import { Platform } from 'react-native';

import { getSupabase } from '../cloud/supabase';
import { rpc } from '../social/rpc';

/**
 * Client stubs for sql/035 (IMP 01102026 Phase 2). No screen calls these until FEATURE_JUNTES (Phase 6).
 * Live positions never go through these: they travel on the Realtime topic `junteTopic(id)` only and are
 * never stored (ADR-57).
 */

export type JunteStatus = 'planned' | 'live' | 'ended';
export type JunteMemberStatus = 'invited' | 'going' | 'live' | 'left' | 'kicked';
export type JunteVisibility = 'invite' | 'followers' | 'public';

/** junte_detail — members by handle, never an id or a position. */
export type JunteDetail = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string | null;
  meet: { lat: number; lng: number; label: string | null } | null;
  /** sql/038: the place's name, also without a pin. */
  meet_label?: string | null;
  visibility: JunteVisibility;
  status: JunteStatus;
  is_owner: boolean;
  code: string | null;
  live_window: boolean;
  members: {
    handle: string;
    display_name: string | null;
    avatar_id: string | null;
    /** sql/037: public photo copy (data URI) or null. */
    photo: string | null;
    role: 'owner' | 'member';
    status: JunteMemberStatus;
    is_me: boolean;
    route: { polyline: string; distance_m: number | null } | null;
  }[];
  photos: number;
};

/** my_juntes — the list, cached in junte_cache. */
export type JunteSummary = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string | null;
  status: JunteStatus;
  is_owner: boolean;
  my_status: JunteMemberStatus;
  members: number;
};

export type NewJunte = {
  title: string;
  startsAt: string;
  endsAt?: string | null;
  meet?: { lat: number; lng: number } | null;
  /** The place's name — saved even without a pin. */
  meetLabel?: string | null;
  visibility?: JunteVisibility;
};

/** The Realtime topic sql/036's policies accept (prefix checked before any uuid cast). */
export const junteTopic = (id: string) => `carguy:junte:${id}`;

export const createJunte = (j: NewJunte) =>
  rpc<{ id: string; code: string }>('create_junte', {
    p_title: j.title,
    p_starts_at: j.startsAt,
    p_ends_at: j.endsAt ?? null,
    p_meet_lat: j.meet?.lat ?? null,
    p_meet_lng: j.meet?.lng ?? null,
    p_meet_label: j.meetLabel ?? null,
    p_visibility: j.visibility ?? 'invite',
  });
export const joinJunte = (code: string) => rpc<string>('join_junte', { p_code: code.trim().toLowerCase() });
export const setJunteStatus = (id: string, status: 'going' | 'live' | 'left') =>
  rpc<null>('set_junte_status', { p_junte: id, p_status: status });
export const kickJunteMember = (id: string, handle: string) => rpc<null>('kick_junte_member', { p_junte: id, p_handle: handle });
export const endJunte = (id: string) => rpc<null>('end_junte', { p_junte: id });
export const linkJunteTrip = (id: string, tripShareId: string | null) =>
  rpc<null>('link_junte_trip', { p_junte: id, p_trip_share: tripShareId });
export const junteDetail = (id: string) => rpc<JunteDetail | null>('junte_detail', { p_junte: id });
export const myJuntes = () => rpc<JunteSummary[]>('my_juntes');
export const sendJunteMessage = (id: string, body: string) => rpc<string>('send_junte_message', { p_junte: id, p_body: body });
export const deleteJunteMessage = (messageId: string) => rpc<null>('delete_junte_message', { p_message: messageId });

/** junte_messages (sql/039): authors by @handle, never a user id; `muted` is the caller's own switch. */
export type JunteMessage = {
  id: string;
  body: string;
  created_at: string;
  mine: boolean;
  can_delete: boolean;
  author: { handle: string | null; display_name: string | null; avatar_id: string | null };
};
export type JunteChatPage = { muted: boolean; messages: JunteMessage[] };
export const junteMessages = (id: string, after?: string | null) =>
  rpc<JunteChatPage | null>('junte_messages', after ? { p_junte: id, p_after: after } : { p_junte: id });
export const setJunteMuted = (id: string, muted: boolean) => rpc<null>('set_junte_muted', { p_junte: id, p_muted: muted });

const SITE = 'https://car-guy.vercel.app';
/** Same origin on the deployed web app; the production URL from native and from localhost. */
export function juntePushUrl(platform: string = Platform.OS, host: string | null = typeof location !== 'undefined' ? location.hostname : null): string {
  if (platform === 'web' && host && host !== 'localhost' && host !== '127.0.0.1') return '/api/junte-push';
  return `${SITE}/api/junte-push`;
}

/**
 * After a send: asks api/junte-push.ts to tell the other members. Fire and forget — the message is already in the
 * chat; a push that fails (no key, offline, Expo down) only means nobody's phone buzzed.
 */
export async function notifyJunteMessage(messageId: string): Promise<void> {
  try {
    const token = (await getSupabase()?.auth.getSession())?.data.session?.access_token;
    if (!token) return;
    await fetch(juntePushUrl(), {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ message_id: messageId }),
    });
  } catch {
    // nobody is told; the chat still has it
  }
}

/** junte_invite_card (sql/038): what an invite shows before joining — no ids, no coordinates. */
export type JunteInviteCard = {
  title: string;
  starts_at: string;
  ends_at: string | null;
  meet_label: string | null;
  status: JunteStatus;
  owner_handle: string | null;
  owner_name: string | null;
  going: number;
};
export const junteInviteCard = (code: string) => rpc<JunteInviteCard | null>('junte_invite_card', { p_code: code.trim().toLowerCase() });

/** The web invite link (api/j/[code].ts) — opens the app when installed. */
export const junteInviteUrl = (code: string) => `https://car-guy.vercel.app/j/${code}`;
