/**
 * An x-core account from another app (Music Hub) does not get into Car Guy,
 * even with the right email and password (sql/018, Xaviel 2026-09-29).
 */
const mockStore = new Map<string, string>();
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: async (k: string) => mockStore.get(k) ?? null,
  setItem: async (k: string, v: string) => void mockStore.set(k, v),
  removeItem: async (k: string) => void mockStore.delete(k),
}));

const mockRpc = jest.fn();
const mockSignIn = jest.fn();
const mockSignOut = jest.fn(async () => ({ error: null }));
const mockReset = jest.fn(async (_email: string, _opts?: { redirectTo?: string }) => ({ error: null }));
jest.mock('@/lib/cloud/supabase', () => ({
  isCloudConfigured: true,
  getSupabase: () => ({ rpc: mockRpc, auth: { signInWithPassword: mockSignIn, signOut: mockSignOut, resetPasswordForEmail: mockReset } }),
}));
jest.mock('expo-linking', () => ({ createURL: (path: string) => `carguy://${path.replace(/^\//, '')}` }));

import { resetPassword, signIn } from '@/lib/cloud/auth';
import { checkMembership, isKnownMember } from '@/lib/cloud/membership';
import { getSupabase } from '@/lib/cloud/supabase';
import { es } from '@/lib/i18n/es';

beforeEach(() => {
  mockStore.clear();
  jest.clearAllMocks();
  mockSignIn.mockResolvedValue({ data: { user: { id: 'u1' }, session: {} }, error: null });
});

describe('signIn', () => {
  it('a Car Guy account signs in and is remembered for offline launches', async () => {
    mockRpc.mockResolvedValue({ data: true, error: null });
    await expect(signIn('a@b.com', 'secret123')).resolves.toEqual({ ok: true });
    expect(mockRpc).toHaveBeenCalledWith('is_app_user');
    expect(mockSignOut).not.toHaveBeenCalled();
    await expect(isKnownMember('u1')).resolves.toBe(true);
  });

  it('an account from another app is signed straight back out, with a sentence saying why', async () => {
    mockRpc.mockResolvedValue({ data: false, error: null });
    await expect(signIn('mh@b.com', 'secret123')).resolves.toEqual({ ok: false, message: es.account.errors.otherApp });
    expect(mockSignOut).toHaveBeenCalled();
    await expect(isKnownMember('u1')).resolves.toBe(false);
  });

  it('an unanswered check does not let the session in either', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'Failed to fetch' } });
    await expect(signIn('a@b.com', 'secret123')).resolves.toEqual({ ok: false, message: es.account.errors.network });
    expect(mockSignOut).toHaveBeenCalled();
  });
});

it('concurrent checks for the same account share one request', async () => {
  mockRpc.mockResolvedValue({ data: true, error: null });
  const s = getSupabase()!;
  await Promise.all([checkMembership(s, 'u2'), checkMembership(s, 'u2')]);
  expect(mockRpc).toHaveBeenCalledTimes(1);
});

it('the reset link comes back to Car Guy, not to x-core\'s Site URL (Music Hub)', async () => {
  await resetPassword(' a@b.com ');
  expect(mockReset).toHaveBeenCalledWith('a@b.com', { redirectTo: 'carguy://nueva-contrasena' });
});
