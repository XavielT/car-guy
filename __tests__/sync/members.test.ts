import { canPushFor, mediaObjectPath, membershipChanges, UPDATED_BY_TABLES, type MemberRow } from '@/lib/sync/members';

const ME = 'u_b';
const row = (vehicle_id: string, role: MemberRow['role'], deleted_at: string | null = null, user_id = ME): MemberRow => ({ vehicle_id, user_id, role, deleted_at });

describe('membershipChanges', () => {
  it('a redeemed invite is a grant (→ full re-pull) and sets my role', () => {
    const c = membershipChanges([row('mine', 'owner')], [row('mine', 'owner'), row('ae85', 'editor'), row('ae85', 'owner', null, 'u_a')], ME);
    expect(c.granted).toEqual(['ae85']);
    expect(c.revoked).toEqual([]);
    expect(c.roles).toEqual({ mine: 'owner', ae85: 'editor' });
  });

  it('my own vehicles never trigger a re-pull, and a role change is not a grant', () => {
    expect(membershipChanges([], [row('mine', 'owner')], ME).granted).toEqual([]);
    const c = membershipChanges([row('ae85', 'editor')], [row('ae85', 'viewer')], ME);
    expect(c.granted).toEqual([]);
    expect(c.roles.ae85).toBe('viewer');
  });

  it('an ended membership is a revocation (→ purge prompt), once', () => {
    const c = membershipChanges([row('ae85', 'editor')], [row('ae85', 'editor', '2026-09-28T12:00:00Z')], ME);
    expect(c.revoked).toEqual(['ae85']);
    expect(c.roles.ae85).toBeNull();
    // Already ended before this pull: nothing new to say.
    expect(membershipChanges([row('ae85', 'editor', 'x')], [row('ae85', 'editor', 'x')], ME).revoked).toEqual([]);
  });

  it('a re-invite after removal is a grant again', () => {
    expect(membershipChanges([row('ae85', 'editor', 'x')], [row('ae85', 'viewer')], ME).granted).toEqual(['ae85']);
  });

  it('ignores co-members', () => {
    const c = membershipChanges([], [row('ae85', 'viewer', null, 'u_c')], ME);
    expect(c).toEqual({ granted: [], revoked: [], roles: {} });
  });
});

it('viewers do not push; photos of a car go under v/<vehicle_id>/', () => {
  expect(canPushFor('viewer')).toBe(false);
  expect(canPushFor('editor')).toBe(true);
  expect(canPushFor(null)).toBe(true);
  expect(mediaObjectPath('u1', 'veh1', 'm1', 'jpg')).toBe('v/veh1/m1.jpg');
  expect(mediaObjectPath('u1', 'veh1', 'm1', 'jpg', true)).toBe('v/veh1/m1.thumb.jpg');
  expect(mediaObjectPath('u1', null, 'm1', 'pdf')).toBe('u1/m1.pdf');
});

it('updated_by goes to exactly the tables that have it in sql/009 + sql/013 + sql/019', () => {
  const { readFileSync } = jest.requireActual('node:fs') as typeof import('node:fs');
  const v2 = readFileSync('sql/009_schema_v2.sql', 'utf8') + readFileSync('sql/019_schema_v3.sql', 'utf8');
  const v1 = readFileSync('sql/013_members.sql', 'utf8');
  const withCol = new Set<string>();
  for (const m of v2.matchAll(/create table if not exists carguy\.(\w+)\s*\(([\s\S]*?)\n\);/g)) if (/updated_by/.test(m[2])) withCol.add(m[1]);
  const list = v1.match(/foreach t in array array\[([^\]]+)\]\s*loop\s*execute format\('alter table carguy\.%I add column if not exists updated_by/)![1];
  for (const t of list.matchAll(/'(\w+)'/g)) withCol.add(t[1]);
  expect([...UPDATED_BY_TABLES].sort()).toEqual([...withCol].sort());
});
