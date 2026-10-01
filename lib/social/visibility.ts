import type { PublicProfile } from './api';

/**
 * Who may see what (IMP 01102026 Phase 5, ADR-55/56) — the client's mirror of list_trip_shares and
 * get_public_profile, for previews ("Qué ven los demás") and for not offering what the cloud will refuse.
 * The cloud stays the authority; this never widens anything.
 */
export type Relation = { isOwner: boolean; follows: boolean; friends: boolean; blocked: boolean };
export type ShareVisibility = 'followers' | 'friends' | 'public';

export function canSeeShare(visibility: ShareVisibility, rel: Relation): boolean {
  if (rel.blocked) return false;
  if (rel.isOwner) return true;
  if (visibility === 'public') return true;
  if (visibility === 'followers') return rel.follows || rel.friends;
  return rel.friends;
}

export type ProfileSwitches = { is_public: boolean; photo_public: boolean; show_cars: boolean; show_stats: boolean; show_fichas: boolean };
export type ProfileBlock = 'photo' | 'bio' | 'cars' | 'stats' | 'shares';

/** The blocks a viewer gets (the order the public profile draws them). */
export function visibleBlocks(sw: ProfileSwitches, rel: Relation): ProfileBlock[] {
  if (rel.blocked) return [];
  const canSee = sw.is_public || rel.isOwner || rel.follows || rel.friends;
  const out: ProfileBlock[] = [];
  if (sw.photo_public) out.push('photo');
  if (!canSee) return out;
  out.push('bio');
  if (sw.show_cars) out.push('cars');
  if (sw.show_stats) out.push('stats');
  out.push('shares');
  return out;
}

/** The follow button's state from get_public_profile. */
export type FollowButton = 'me' | 'follow' | 'request' | 'requested' | 'following' | 'friends' | 'follow_back';

export function followButton(p: Pick<PublicProfile, 'is_me' | 'is_public' | 'my_follow' | 'follows_me'>): FollowButton {
  if (p.is_me) return 'me';
  if (p.my_follow === 'requested') return 'requested';
  if (p.my_follow === 'accepted') return p.follows_me ? 'friends' : 'following';
  if (p.follows_me) return 'follow_back';
  return p.is_public ? 'follow' : 'request';
}
