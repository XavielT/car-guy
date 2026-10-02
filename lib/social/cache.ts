import type { FollowListKind, FollowPerson, MySocial, PersonRef } from './api';

/**
 * The social screens' cache (IMP 01102026 Phase 5): the last answers of my_social / list_follows, kept in the
 * local `social_cache` table (key 'me'), shown at once and offline ("sin conexión"), refreshed on launch and
 * after each action. Pure reducer here; lib/social/store.ts does the I/O.
 */
export type SocialSnapshot = {
  me: MySocial | null;
  lists: Partial<Record<FollowListKind, FollowPerson[]>>;
  /** ISO time of the last successful refresh. */
  at: string | null;
};

export const EMPTY_SNAPSHOT: SocialSnapshot = { me: null, lists: {}, at: null };

export type SocialAction =
  | { type: 'followed'; person: PersonRef; status: 'accepted' | 'requested' }
  | { type: 'unfollowed'; handle: string }
  | { type: 'accepted'; handle: string }
  | { type: 'declined'; handle: string }
  | { type: 'removedFollower'; handle: string }
  | { type: 'blocked'; handle: string }
  | { type: 'unblocked'; handle: string };

const without = (list: FollowPerson[] | undefined, handle: string) => (list ?? []).filter((p) => p.handle !== handle);
const person = (p: PersonRef, extra: Partial<FollowPerson> = {}): FollowPerson => ({
  follows_me: false,
  i_follow: false,
  since: new Date(0).toISOString(),
  ...p,
  ...extra,
});

/** The optimistic change an action makes, so the list moves before the cloud answers. */
export function reduceSocial(s: SocialSnapshot, a: SocialAction): SocialSnapshot {
  const me = s.me;
  const lists = { ...s.lists };
  switch (a.type) {
    case 'followed': {
      if (a.status === 'requested') {
        lists.requests_sent = [person(a.person), ...without(lists.requests_sent, a.person.handle)];
        return { ...s, lists };
      }
      const followsMe = (lists.followers ?? []).some((p) => p.handle === a.person.handle);
      lists.following = [person(a.person, { i_follow: true, follows_me: followsMe }), ...without(lists.following, a.person.handle)];
      if (followsMe) lists.friends = [person(a.person, { i_follow: true, follows_me: true }), ...without(lists.friends, a.person.handle)];
      return { ...s, lists, me: me && { ...me, following: me.following + 1, friends: me.friends + (followsMe ? 1 : 0) } };
    }
    case 'unfollowed': {
      const was = (lists.following ?? []).some((p) => p.handle === a.handle);
      const wasFriend = (lists.friends ?? []).some((p) => p.handle === a.handle);
      lists.following = without(lists.following, a.handle);
      lists.friends = without(lists.friends, a.handle);
      lists.requests_sent = without(lists.requests_sent, a.handle);
      return { ...s, lists, me: me && { ...me, following: me.following - (was ? 1 : 0), friends: me.friends - (wasFriend ? 1 : 0) } };
    }
    case 'accepted': {
      const req = me?.requests.find((r) => r.handle === a.handle);
      if (!me || !req) return s;
      const iFollow = (lists.following ?? []).some((p) => p.handle === a.handle);
      lists.followers = [person(req, { follows_me: true, i_follow: iFollow }), ...without(lists.followers, a.handle)];
      if (iFollow) lists.friends = [person(req, { follows_me: true, i_follow: true }), ...without(lists.friends, a.handle)];
      return { ...s, lists, me: { ...me, requests: me.requests.filter((r) => r.handle !== a.handle), followers: me.followers + 1, friends: me.friends + (iFollow ? 1 : 0) } };
    }
    case 'declined':
      return me ? { ...s, me: { ...me, requests: me.requests.filter((r) => r.handle !== a.handle) } } : s;
    case 'removedFollower': {
      const was = (lists.followers ?? []).some((p) => p.handle === a.handle);
      const wasFriend = (lists.friends ?? []).some((p) => p.handle === a.handle);
      lists.followers = without(lists.followers, a.handle);
      lists.friends = without(lists.friends, a.handle);
      return { ...s, lists, me: me && { ...me, followers: me.followers - (was ? 1 : 0), friends: me.friends - (wasFriend ? 1 : 0) } };
    }
    case 'blocked': {
      // A block removes the follows both ways (sql/034): out of every list.
      const next = (['followers', 'following', 'friends', 'requests_sent'] as FollowListKind[]).reduce(
        (acc, k) => ({ ...acc, [k]: without(lists[k], a.handle) }),
        {} as SocialSnapshot['lists'],
      );
      const counts = (k: FollowListKind) => ((lists[k] ?? []).some((p) => p.handle === a.handle) ? 1 : 0);
      return {
        ...s,
        lists: next,
        me: me && {
          ...me,
          followers: me.followers - counts('followers'),
          following: me.following - counts('following'),
          friends: me.friends - counts('friends'),
          requests: me.requests.filter((r) => r.handle !== a.handle),
          blocked: [a.handle, ...me.blocked.filter((h) => h !== a.handle)],
        },
      };
    }
    case 'unblocked':
      return me ? { ...s, me: { ...me, blocked: me.blocked.filter((h) => h !== a.handle) } } : s;
  }
}
