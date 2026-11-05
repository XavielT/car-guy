/**
 * The profile photo must survive a second phone / a name save / a restored session (found 2026-11-05: a phone with no photo
 * erased the account's, and a phone already signed in never pulled it).
 */
const mockStore = new Map<string, unknown>();
const mockCalls = { removed: [] as string[][], uploaded: [] as string[], patches: [] as Record<string, unknown>[] };
let mockServerRow: Record<string, unknown> | null = null;

jest.mock('@/lib/db/repos', () => ({
  settings: {
    get: async (k: string, d: unknown) => (mockStore.has(k) ? mockStore.get(k) : d),
    set: async (k: string, v: unknown) => void mockStore.set(k, v),
  },
}));
jest.mock('@/lib/diagnostics', () => ({ recordError: jest.fn() }));
jest.mock('expo-image-picker', () => ({}));
jest.mock('@/lib/media/compress', () => ({ compressPhoto: jest.fn() }));
jest.mock('@/lib/media/crop', () => ({ cropToSquare: jest.fn() }));
jest.mock('react-native', () => ({ Platform: { OS: 'web' } }));
jest.mock('@/lib/cloud/supabase', () => ({
  getSupabase: () => ({
    auth: { getSession: async () => ({ data: { session: { user: { id: 'u1' } } } }) },
    storage: {
      from: () => ({
        upload: async (p: string) => (mockCalls.uploaded.push(p), { error: null }),
        remove: async (p: string[]) => (mockCalls.removed.push(p), { error: null }),
        download: async () => ({ data: new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' }), error: null }),
      }),
    },
    from: () => ({
      update: (patch: Record<string, unknown>) => ({ eq: async () => (mockCalls.patches.push(patch), { error: null }) }),
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: mockServerRow, error: null }) }) }),
    }),
  }),
}));

import { PROFILE_KEYS, pushProfile, reloadProfile, saveDisplayName, syncProfileOnSession, removePhoto } from '@/lib/profile';

// The node test environment has no FileReader (the app runs it in a browser on web): a minimal stand-in.
class FakeReader {
  result: string | null = null;
  error: Error | null = null;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  readAsDataURL(blob: Blob) {
    void blob.arrayBuffer().then((buf) => {
      this.result = `data:${blob.type};base64,${Buffer.from(buf).toString('base64')}`;
      this.onload?.();
    });
  }
}
(globalThis as unknown as { FileReader: unknown }).FileReader = FakeReader;

beforeEach(() => {
  mockStore.clear();
  mockCalls.removed = [];
  mockCalls.uploaded = [];
  mockCalls.patches = [];
  mockServerRow = null;
});

describe('profile photo sync', () => {
  it('saving a name on a phone with no photo does not erase the account photo', async () => {
    await saveDisplayName('Xaviel');
    expect(mockCalls.removed).toEqual([]);
    expect(mockCalls.patches).toHaveLength(1);
    expect(mockCalls.patches[0]).not.toHaveProperty('avatar_path');
    expect(mockCalls.patches[0]).not.toHaveProperty('avatar_id');
    expect(mockCalls.patches[0]).toMatchObject({ display_name: 'Xaviel' });
  });

  it('signing in with only a name keeps the server photo and then pulls it down', async () => {
    mockStore.set(PROFILE_KEYS.displayName, 'Xaviel');
    mockServerRow = { avatar_id: null, avatar_path: 'u1/avatar.jpg', display_name: 'Otro' };
    await syncProfileOnSession('u1');
    expect(mockCalls.removed).toEqual([]);
    expect(String(mockStore.get(PROFILE_KEYS.photo))).toMatch(/^data:image\/jpeg/);
    // The local name wins.
    expect(mockStore.get(PROFILE_KEYS.displayName)).toBe('Xaviel');
  });

  it('a restored session on an empty phone pulls photo and name once per run', async () => {
    mockServerRow = { avatar_id: null, avatar_path: 'u1/avatar.jpg', display_name: 'Xaviel' };
    await syncProfileOnSession('u9');
    expect(String(mockStore.get(PROFILE_KEYS.photo))).toMatch(/^data:image/);
    expect(mockStore.get(PROFILE_KEYS.displayName)).toBe('Xaviel');
    mockStore.delete(PROFILE_KEYS.photo);
    await syncProfileOnSession('u9');
    expect(mockStore.get(PROFILE_KEYS.photo)).toBeUndefined();
  });

  it('a drawing chosen on this phone is not replaced by the account photo', async () => {
    mockStore.set(PROFILE_KEYS.avatarId, 'wheel');
    mockServerRow = { avatar_id: null, avatar_path: 'u1/avatar.jpg', display_name: null };
    await syncProfileOnSession('u2');
    expect(mockStore.get(PROFILE_KEYS.photo)).toBeUndefined();
  });

  it('removing the photo on purpose does delete it from the account', async () => {
    await reloadProfile();
    await removePhoto();
    expect(mockCalls.removed).toEqual([['u1/avatar.jpg']]);
    expect(mockCalls.patches[0]).toMatchObject({ avatar_path: null, avatar_id: null });
  });

  it('a photo that cannot be read does not null the stored path', async () => {
    mockStore.set(PROFILE_KEYS.photo, 'data:image/jpeg;base64,AAAA');
    await reloadProfile();
    global.fetch = jest.fn(async () => ({ arrayBuffer: async () => new ArrayBuffer(3) })) as never;
    const r = await pushProfile('u1');
    expect(r.ok).toBe(true);
    expect(mockCalls.uploaded).toEqual(['u1/avatar.jpg']);
  });
});
