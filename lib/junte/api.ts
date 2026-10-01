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
  visibility: JunteVisibility;
  status: JunteStatus;
  is_owner: boolean;
  code: string | null;
  live_window: boolean;
  members: {
    handle: string;
    display_name: string | null;
    avatar_id: string | null;
    avatar_path: string | null;
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
  meet?: { lat: number; lng: number; label?: string | null } | null;
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
    p_meet_label: j.meet?.label ?? null,
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
/** FEATURE_JUNTE_CHAT is off; the RPC exists so Phase 6 can build the screen. */
export const sendJunteMessage = (id: string, body: string) => rpc<string>('send_junte_message', { p_junte: id, p_body: body });
export const deleteJunteMessage = (messageId: string) => rpc<null>('delete_junte_message', { p_message: messageId });
