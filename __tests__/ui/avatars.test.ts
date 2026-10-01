/**
 * Avatars + profile (IMP 30092026 Phase 6, note 10): the registry, the
 * photo → avatar → initials fallback, and the centred-square crop math.
 */
jest.mock('@/lib/cloud/supabase', () => ({ getSupabase: () => null, isCloudConfigured: false }));
jest.mock('@/lib/db/repos', () => ({ settings: { get: async (_k: string, f: unknown) => f, set: async () => {} } }));

import { AVATAR_ART } from '@/components/avatars';
import { AVATAR_IDS, avatarLabel, centerSquareCrop, initialsOf, isAvatarId, isFullFrame, resolveAvatar } from '@/lib/avatars';
import { __setLanguageForTests } from '@/lib/i18n';
import { en } from '@/lib/i18n/en';
import { es } from '@/lib/i18n/es';
import { cleanDisplayName, hasLocalProfile, pushFailed } from '@/lib/profile';

afterEach(() => __setLanguageForTests('es'));

describe('registry', () => {
  it('has 16 distinct ids, each with a drawing', () => {
    expect(AVATAR_IDS).toHaveLength(16);
    expect(new Set(AVATAR_IDS).size).toBe(16);
    expect(Object.keys(AVATAR_ART).sort()).toEqual([...AVATAR_IDS].sort());
    for (const id of AVATAR_IDS) expect(typeof AVATAR_ART[id]).toBe('function');
  });

  it('labels every id in both languages, and nothing else', () => {
    expect(Object.keys(es.profileUi.avatars).sort()).toEqual([...AVATAR_IDS].sort());
    expect(Object.keys(en.profileUi.avatars).sort()).toEqual([...AVATAR_IDS].sort());
    for (const id of AVATAR_IDS) {
      expect(es.profileUi.avatars[id].trim()).not.toBe('');
      expect(en.profileUi.avatars[id].trim()).not.toBe('');
      expect(es.profileUi.avatars[id]).not.toBe(en.profileUi.avatars[id]);
    }
  });

  it('reads the label in the current language at the moment of use', () => {
    __setLanguageForTests('es');
    expect(avatarLabel('checkered')).toBe(es.profileUi.avatars.checkered);
    __setLanguageForTests('en');
    expect(avatarLabel('checkered')).toBe(en.profileUi.avatars.checkered);
  });

  it('recognises only its own ids', () => {
    expect(isAvatarId('kanji_touge')).toBe(true);
    expect(isAvatarId('supra_mk4')).toBe(false);
    expect(isAvatarId(null)).toBe(false);
    expect(isAvatarId(7)).toBe(false);
  });
});

describe('fallback: photo → avatar → initials', () => {
  it('prefers the photo', () => {
    expect(resolveAvatar({ photoUri: 'file:///a.jpg', avatarId: 'wheel', name: 'Xaviel' })).toEqual({ kind: 'photo', uri: 'file:///a.jpg' });
  });

  it('skips a photo that failed to load', () => {
    expect(resolveAvatar({ photoUri: 'https://x/expired', avatarId: 'turbo', name: 'X', photoFailed: true })).toEqual({ kind: 'art', id: 'turbo' });
  });

  it('skips an empty photo uri', () => {
    expect(resolveAvatar({ photoUri: '  ', avatarId: 'turbo' })).toEqual({ kind: 'art', id: 'turbo' });
  });

  it('falls to initials for no avatar or an unknown one', () => {
    expect(resolveAvatar({ name: 'Xaviel Torres' })).toEqual({ kind: 'initials', text: 'XT' });
    expect(resolveAvatar({ avatarId: 'from_a_newer_build', name: 'ana' })).toEqual({ kind: 'initials', text: 'A' });
    expect(resolveAvatar({ photoUri: 'x', photoFailed: true, avatarId: null, name: null })).toEqual({ kind: 'initials', text: '?' });
  });

  it('takes initials from names and e-mails', () => {
    expect(initialsOf('Xaviel Torres Peña')).toBe('XT');
    expect(initialsOf('  josé  ')).toBe('J');
    expect(initialsOf('tecnologia@constructorasd.com')).toBe('T');
    expect(initialsOf('juan.perez@example.com')).toBe('J');
    expect(initialsOf('Ñoño 改')).toBe('Ñ改');
    expect(initialsOf('')).toBe('?');
    expect(initialsOf(undefined)).toBe('?');
    expect(initialsOf('— ·')).toBe('?');
  });
});

describe('centred square crop', () => {
  it('crops a landscape photo from the middle', () => {
    expect(centerSquareCrop(4000, 3000)).toEqual({ originX: 500, originY: 0, width: 3000, height: 3000 });
  });

  it('crops a portrait photo from the middle', () => {
    expect(centerSquareCrop(3000, 4000)).toEqual({ originX: 0, originY: 500, width: 3000, height: 3000 });
  });

  it('rounds odd differences down, in whole pixels', () => {
    expect(centerSquareCrop(1001, 600)).toEqual({ originX: 200, originY: 0, width: 600, height: 600 });
    expect(centerSquareCrop(640.7, 480.2)).toEqual({ originX: 80, originY: 0, width: 480, height: 480 });
  });

  it('leaves a square alone', () => {
    const crop = centerSquareCrop(512, 512)!;
    expect(crop).toEqual({ originX: 0, originY: 0, width: 512, height: 512 });
    expect(isFullFrame(crop, 512, 512)).toBe(true);
    expect(isFullFrame(centerSquareCrop(800, 600)!, 800, 600)).toBe(false);
  });

  it('refuses a missing size', () => {
    expect(centerSquareCrop(null, 100)).toBeNull();
    expect(centerSquareCrop(100, 0)).toBeNull();
    expect(centerSquareCrop(-5, 100)).toBeNull();
  });
});

describe('profile helpers', () => {
  it('cleans the display name', () => {
    expect(cleanDisplayName('  Xaviel   Torres ')).toBe('Xaviel Torres');
    expect(cleanDisplayName('   ')).toBeNull();
    expect(cleanDisplayName('x'.repeat(60))).toHaveLength(40);
  });

  it('knows when a phone has a profile of its own', () => {
    expect(hasLocalProfile({ avatarId: null, photoRelPath: null, displayName: null })).toBe(false);
    expect(hasLocalProfile({ avatarId: 'wheel', photoRelPath: null, displayName: null })).toBe(true);
    expect(hasLocalProfile({ avatarId: null, photoRelPath: 'avatar/a.jpg', displayName: null })).toBe(true);
  });

  it('only reports a failed upload for a signed-in account', () => {
    expect(pushFailed({ ok: true })).toBe(false);
    expect(pushFailed({ ok: false, reason: 'signed-out' })).toBe(false);
    expect(pushFailed({ ok: false, reason: 'not-configured' })).toBe(false);
    expect(pushFailed({ ok: false, reason: 'upload' })).toBe(true);
    expect(pushFailed({ ok: false, reason: 'offline' })).toBe(true);
  });
});
