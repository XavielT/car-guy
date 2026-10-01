/**
 * Others' avatars in Garaje → Miembros (sql/031 member_avatars). Best effort: any failure — signed out,
 * offline, a cloud without 031 — leaves the list on initials.
 */
const mockRpc = jest.fn();
const mockGetSession = jest.fn();
jest.mock('@/lib/cloud/supabase', () => ({
  isCloudConfigured: true,
  getSupabase: () => ({ rpc: mockRpc, auth: { getSession: mockGetSession } }),
}));
jest.mock('@/lib/db/repos', () => ({ vehicleMembers: {}, settings: {} }));
jest.mock('@/lib/db/vehicleOps', () => ({ purgeVehicleLocal: jest.fn() }));
jest.mock('@/lib/sync/engine', () => ({ REVOKED_KEY: 'revoked', sync: jest.fn() }));

import { memberAvatars } from '@/lib/share/members';

beforeEach(() => {
  jest.clearAllMocks();
  mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'me' } } } });
});

describe('memberAvatars', () => {
  it('maps the rows by user id, drawing and current name only', async () => {
    mockRpc.mockResolvedValue({
      data: [
        { user_id: 'u-ana', display_name: 'Ana', avatar_id: 'helmet-red' },
        { user_id: 'u-c', display_name: null, avatar_id: null },
      ],
      error: null,
    });
    await expect(memberAvatars('veh_a')).resolves.toEqual({
      'u-ana': { avatarId: 'helmet-red', displayName: 'Ana' },
      'u-c': { avatarId: null, displayName: null },
    });
    expect(mockRpc).toHaveBeenCalledWith('member_avatars', { p_vehicle: 'veh_a' });
  });

  it('a cloud without sql/031 (function not found) → {}', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'Could not find the function carguy.member_avatars', code: 'PGRST202' } });
    await expect(memberAvatars('veh_a')).resolves.toEqual({});
  });

  it('not a member (forbidden) or offline (throws) → {}', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'forbidden', code: '42501' } });
    await expect(memberAvatars('veh_a')).resolves.toEqual({});
    mockRpc.mockRejectedValueOnce(new TypeError('Network request failed'));
    await expect(memberAvatars('veh_a')).resolves.toEqual({});
  });

  it('signed out → {} without calling the cloud', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    await expect(memberAvatars('veh_a')).resolves.toEqual({});
    expect(mockRpc).not.toHaveBeenCalled();
  });
});
