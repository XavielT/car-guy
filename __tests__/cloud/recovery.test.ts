/**
 * The password-reset link (app/nueva-contrasena.tsx) and who may use it.
 */
import { parseRecoveryUrl } from '@/lib/cloud/recovery';

jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: async () => null, setItem: async () => {}, removeItem: async () => {} }));

describe('parseRecoveryUrl', () => {
  it('reads the session from the fragment (implicit flow, app and web)', () => {
    for (const base of ['carguy://nueva-contrasena', 'https://car-guy.vercel.app/nueva-contrasena']) {
      expect(parseRecoveryUrl(`${base}#access_token=AT&expires_in=3600&refresh_token=RT&token_type=bearer&type=recovery`)).toEqual({
        kind: 'tokens',
        accessToken: 'AT',
        refreshToken: 'RT',
      });
    }
  });

  it('reads the pairs from the query string too', () => {
    expect(parseRecoveryUrl('carguy://nueva-contrasena?access_token=AT&refresh_token=RT')).toMatchObject({ kind: 'tokens' });
  });

  it('an expired or used link is an error, not a session', () => {
    expect(
      parseRecoveryUrl('https://car-guy.vercel.app/nueva-contrasena#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid'),
    ).toEqual({ kind: 'error', code: 'otp_expired' });
  });

  it('no link, or a link without both tokens, is nothing', () => {
    expect(parseRecoveryUrl(null)).toEqual({ kind: 'none' });
    expect(parseRecoveryUrl('carguy://nueva-contrasena')).toEqual({ kind: 'none' });
    expect(parseRecoveryUrl('carguy://nueva-contrasena#access_token=AT')).toEqual({ kind: 'none' });
  });
});
