import { rpc, type RpcResult } from './rpc';

/**
 * Client stubs for sql/034 (IMP 01102026 Phase 2). No screen calls these until FEATURE_SOCIAL (Phase 5).
 * Everything is keyed by @handle: the app never holds another person's user id (ADR-54).
 */

export type FollowStatus = 'requested' | 'accepted';

/** get_public_profile — what anyone may see of a handle; the optional parts only when `can_see`. */
export type PublicProfile = {
  handle: string;
  display_name: string | null;
  avatar_id: string | null;
  /** Only when the owner made the photo public. */
  avatar_path: string | null;
  is_public: boolean;
  is_me: boolean;
  premium: boolean;
  followers: number;
  following: number;
  my_follow: FollowStatus | null;
  follows_me: boolean;
  can_see: boolean;
  bio?: string | null;
  instagram?: string | null;
  cars?: { name: string; nickname: string | null; make: string | null; model: string | null; year: number | null; status: string | null; slug: string | null }[];
  stats?: { km_trips: number; tires_burned: number; mods: number; cars: number };
};

export type ProfileHit = { handle: string; display_name: string | null; avatar_id: string | null; is_public: boolean; my_follow: FollowStatus | null };

export type PersonRef = { handle: string; display_name: string | null; avatar_id: string | null };

/** my_social — counts and the pending requests, cached in social_cache under 'me'. */
export type MySocial = { followers: number; following: number; friends: number; requests: PersonRef[]; blocked: string[] };

/** list_trip_shares — someone's shared (already trimmed) routes. */
export type SharedTrip = {
  id: string;
  title: string | null;
  visibility: 'followers' | 'friends' | 'public';
  polyline: string;
  distance_m: number | null;
  duration_s: number | null;
  day: string | null;
};

export type ReportType = 'profile' | 'trip_share' | 'junte' | 'junte_message';

export const getPublicProfile = (handle: string) => rpc<PublicProfile | null>('get_public_profile', { p_handle: handle });
export const searchProfiles = (q: string, lim = 20) => rpc<ProfileHit[]>('search_profiles', { q, lim });
/** 'accepted' (public account) or 'requested' (private); the cloud decides, never the client. */
export const followUser = (handle: string) => rpc<FollowStatus>('follow_user', { p_handle: handle });
export const unfollowUser = (handle: string) => rpc<null>('unfollow_user', { p_handle: handle });
export const acceptFollow = (handle: string) => rpc<boolean>('accept_follow', { p_handle: handle });
export const removeFollower = (handle: string) => rpc<null>('remove_follower', { p_handle: handle });
export const blockUser = (handle: string) => rpc<null>('block_user', { p_handle: handle });
export const unblockUser = (handle: string) => rpc<null>('unblock_user', { p_handle: handle });
export const mySocial = () => rpc<MySocial>('my_social');
export const reportTarget = (type: ReportType, target: string, reason = ''): Promise<RpcResult<string>> =>
  rpc<string>('report_target', { p_type: type, p_target: target, p_reason: reason });
export const listTripShares = (handle: string, lim = 30) => rpc<SharedTrip[]>('list_trip_shares', { p_handle: handle, lim });
