/** IMP 01102026 Phase 5: handle rules, the visibility resolver, the social cache reducer. */
import type { FollowPerson, MySocial } from '@/lib/social/api';
import { EMPTY_SNAPSHOT, reduceSocial, type SocialSnapshot } from '@/lib/social/cache';
import { handleProblem, normalizeHandle, normalizeInstagram } from '@/lib/social/handle';
import { canSeeShare, followButton, visibleBlocks } from '@/lib/social/visibility';

describe('handles', () => {
  it('normalises what was typed', () => {
    expect(normalizeHandle('@Trueño AE85')).toBe('trueno_ae85');
    expect(normalizeHandle('  José.Pérez!! ')).toBe('joseperez');
    expect(normalizeHandle('a'.repeat(30))).toHaveLength(20);
  });
  it('says what is wrong before asking the cloud', () => {
    expect(handleProblem('ab')).toBe('short');
    expect(handleProblem('ok_handle')).toBeNull();
    expect(handleProblem('Mal')).toBe('format');
  });
  it('instagram: a user name, a link, or nothing', () => {
    expect(normalizeInstagram('@car.guy_rd')).toBe('car.guy_rd');
    expect(normalizeInstagram('https://www.instagram.com/car.guy_rd/')).toBe('car.guy_rd');
    expect(normalizeInstagram('no vale!')).toBeNull();
  });
});

describe('visibility', () => {
  const none = { isOwner: false, follows: false, friends: false, blocked: false };
  it('shares: public to all, followers to followers, friends to friends, never to a blocked pair', () => {
    expect(canSeeShare('public', none)).toBe(true);
    expect(canSeeShare('followers', none)).toBe(false);
    expect(canSeeShare('followers', { ...none, follows: true })).toBe(true);
    expect(canSeeShare('friends', { ...none, follows: true })).toBe(false);
    expect(canSeeShare('friends', { ...none, friends: true })).toBe(true);
    expect(canSeeShare('public', { ...none, blocked: true })).toBe(false);
    expect(canSeeShare('friends', { ...none, isOwner: true })).toBe(true);
  });
  it('profile blocks follow the switches; a private profile is a card for strangers', () => {
    const sw = { is_public: false, photo_public: true, show_cars: true, show_stats: false, show_fichas: false };
    expect(visibleBlocks(sw, none)).toEqual(['photo']);
    expect(visibleBlocks(sw, { ...none, follows: true })).toEqual(['photo', 'bio', 'cars', 'shares']);
    expect(visibleBlocks({ ...sw, is_public: true, photo_public: false, show_stats: true }, none)).toEqual(['bio', 'cars', 'stats', 'shares']);
    expect(visibleBlocks(sw, { ...none, blocked: true })).toEqual([]);
  });
  it('the follow button', () => {
    expect(followButton({ is_me: true, is_public: true, my_follow: null, follows_me: false })).toBe('me');
    expect(followButton({ is_me: false, is_public: true, my_follow: null, follows_me: false })).toBe('follow');
    expect(followButton({ is_me: false, is_public: false, my_follow: null, follows_me: false })).toBe('request');
    expect(followButton({ is_me: false, is_public: false, my_follow: 'requested', follows_me: false })).toBe('requested');
    expect(followButton({ is_me: false, is_public: true, my_follow: 'accepted', follows_me: false })).toBe('following');
    expect(followButton({ is_me: false, is_public: true, my_follow: 'accepted', follows_me: true })).toBe('friends');
    expect(followButton({ is_me: false, is_public: true, my_follow: null, follows_me: true })).toBe('follow_back');
  });
});

describe('the cache reducer', () => {
  const p = (handle: string, extra: Partial<FollowPerson> = {}): FollowPerson => ({ handle, display_name: null, avatar_id: null, follows_me: false, i_follow: false, since: '2026-10-01', ...extra });
  const me: MySocial = { followers: 1, following: 0, friends: 0, requests: [{ handle: 'pedro', display_name: null, avatar_id: null }], blocked: [] };
  const s: SocialSnapshot = { ...EMPTY_SNAPSHOT, me, lists: { followers: [p('ana', { follows_me: true })], following: [], friends: [] } };

  it('following someone who follows me makes a friend', () => {
    const n = reduceSocial(s, { type: 'followed', person: { handle: 'ana', display_name: null, avatar_id: null }, status: 'accepted' });
    expect(n.lists.friends?.map((x) => x.handle)).toEqual(['ana']);
    expect(n.me).toMatchObject({ following: 1, friends: 1 });
  });
  it('a request to a private account goes to "sent", not to following', () => {
    const n = reduceSocial(s, { type: 'followed', person: { handle: 'priv', display_name: null, avatar_id: null }, status: 'requested' });
    expect(n.lists.requests_sent?.map((x) => x.handle)).toEqual(['priv']);
    expect(n.me?.following).toBe(0);
  });
  it('accepting a request adds a follower; declining just drops it', () => {
    expect(reduceSocial(s, { type: 'accepted', handle: 'pedro' }).me).toMatchObject({ followers: 2, requests: [] });
    expect(reduceSocial(s, { type: 'declined', handle: 'pedro' }).me).toMatchObject({ followers: 1, requests: [] });
  });
  it('a block removes the person from every list and the counts', () => {
    const friends = reduceSocial(s, { type: 'followed', person: { handle: 'ana', display_name: null, avatar_id: null }, status: 'accepted' });
    const n = reduceSocial(friends, { type: 'blocked', handle: 'ana' });
    expect([n.lists.followers, n.lists.following, n.lists.friends].every((l) => !l?.length)).toBe(true);
    expect(n.me).toMatchObject({ followers: 0, following: 0, friends: 0, blocked: ['ana'] });
    expect(reduceSocial(n, { type: 'unblocked', handle: 'ana' }).me?.blocked).toEqual([]);
  });
});
