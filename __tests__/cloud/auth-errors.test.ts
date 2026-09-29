/**
 * Supabase auth errors → what the person sees, in Spanish.
 *
 * The mapping matches on message text (supabase-js gives no stable codes for
 * most auth errors), so these are the messages x-core actually returns; a
 * supabase-js upgrade that rewords one shows up here rather than as a raw
 * English error on a phone.
 */
import { translateAuthError } from '@/lib/cloud/auth';
import { es } from '@/lib/i18n/es';

jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: async () => null, setItem: async () => {}, removeItem: async () => {} }));

const e = es.account.errors;

describe('translateAuthError', () => {
  it.each([
    ['Invalid login credentials', e.invalidCredentials],
    ['User already registered', e.userExists],
    ['A user with this email address has already been registered', e.userExists],
    ['Password should be at least 8 characters.', e.weakPassword],
    ['weak password', e.weakPassword],
    ['Unable to validate email address: invalid format', e.invalidEmail],
    ['Email rate limit exceeded', e.rateLimited],
    ['Too many requests', e.rateLimited],
    ['TypeError: Failed to fetch', e.network],
    ['Network request failed', e.network],
    ['Email not confirmed', e.emailNotConfirmed],
  ])('%s', (raw, expected) => {
    expect(translateAuthError(raw)).toBe(expected);
  });

  describe('invite-only (a server that is missing sql/001)', () => {
    const raw = 'Database error saving new user: Sign-ups are invite-only. Ask Xaviel for an invite link.';
    const g = globalThis as { __DEV__?: boolean };
    const dev = g.__DEV__;
    afterEach(() => {
      g.__DEV__ = dev;
    });

    it('tells a user only that accounts are closed (release build)', () => {
      g.__DEV__ = false;
      expect(translateAuthError(raw)).toBe(e.inviteOnly);
      expect(translateAuthError(raw)).not.toMatch(/sql|x-core/);
    });

    it('adds the developer hint in development / modo diagnóstico', () => {
      g.__DEV__ = true;
      expect(translateAuthError(raw)).toBe(`${e.inviteOnly}\n\n${es.dev.inviteOnly}`);
    });
  });

  it('never shows an unrecognised message raw', () => {
    expect(translateAuthError('Something new went wrong in GoTrue')).toBe(e.generic);
  });
});
