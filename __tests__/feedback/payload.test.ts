/**
 * What leaves the phone with a comment (PROMPT-06 item 4): the diagnostics,
 * route and sync state are redacted — no email, plate, VIN or token — while
 * the message and the optional email go exactly as the user typed them.
 */
import { buildPayload, validateDraft, type FeedbackContext } from '@/lib/feedback/payload';
import { redactText } from '@/lib/feedback/redact';

const JWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
const SESSION_EMAIL = 'xaviel@example.com';
const KNOWN_PLATE = 'G123456';
const VIN = 'JT2AE850000000001';

function context(over: Partial<FeedbackContext> = {}): FeedbackContext {
  return {
    appVersion: '2.2.0',
    build: '42',
    gitSha: '0123456789abcdef0123456789abcdef01234567',
    variant: 'test',
    platform: 'android',
    osVersion: 'Android 14 · API 34',
    device: 'Xiaomi Redmi Note 12',
    screen: `/vehiculo/veh_1?plate=${KNOWN_PLATE}&q=${SESSION_EMAIL}`,
    flags: { FEATURE_SYNC: true, FEATURE_FEEDBACK: true, FEATURE_GARAGE_V2: false },
    dbVersion: 6,
    sync: { signedIn: true, state: 'error', pending: 3, lastSyncAt: null, message: `Falló para ${SESSION_EMAIL} con Bearer ${JWT}` },
    diagnosticsMode: false,
    errors: [
      { at: '2026-09-29T10:00:00.000Z', where: 'sync', message: `AuthApiError: invalid token ${JWT}` },
      { at: '2026-09-29T10:00:01.000Z', where: 'share', message: `plate ${KNOWN_PLATE} vin ${VIN} other plate A700001` },
      { at: '2026-09-29T10:00:02.000Z', where: 'auth', message: `user ${SESSION_EMAIL} apikey=sb_publishable_abcDEF123456 refresh_token: abcdefgh1234` },
      { at: '2026-09-29T10:00:03.000Z', where: 'hash', message: 'key 9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08 and uuid 11111111-1111-4111-8111-111111111111' },
    ],
    secrets: [SESSION_EMAIL, KNOWN_PLATE, VIN],
    ...over,
  };
}

const draft = { kind: 'bug' as const, message: `  Se cerró al guardar la carga del ${KNOWN_PLATE}  `, email: ' yo@correo.do ' };

describe('buildPayload', () => {
  const payload = buildPayload({ id: 'id-1', deviceId: 'dev-1', draft, context: context() });
  // Everything the app filled in by itself.
  const automatic = JSON.stringify({ ...payload, message: undefined, email: undefined });

  it.each([
    ['session email', SESSION_EMAIL],
    ['any email', '@example.com'],
    ['the JWT', JWT],
    ['a JWT prefix', 'eyJhbGci'],
    ['a known plate', KNOWN_PLATE],
    ['an unknown plate', 'A700001'],
    ['a VIN', VIN],
    ['a supabase key', 'sb_publishable_'],
    ['a refresh token', 'abcdefgh1234'],
    ['a long hex key', '9f86d081884c7d65'],
  ])('carries no %s', (_label, needle) => {
    expect(automatic).not.toContain(needle);
  });

  it('keeps what makes the report useful', () => {
    expect(payload.diagnostics.git_sha).toBe('0123456789abcdef0123456789abcdef01234567');
    expect(payload.diagnostics.flags.FEATURE_FEEDBACK).toBe(true);
    expect(payload.diagnostics.db_version).toBe(6);
    expect(payload.diagnostics.errors).toHaveLength(4);
    expect(automatic).toContain('11111111-1111-4111-8111-111111111111');
    expect(automatic).toContain('AuthApiError');
    expect(payload.screen).toBe('/vehiculo/veh_1');
    expect(payload.device).toBe('Xiaomi Redmi Note 12');
    expect(payload.app_version).toBe('2.2.0');
  });

  it('sends the message and email as typed (trimmed), for their owner meant them', () => {
    expect(payload.message).toBe(`Se cerró al guardar la carga del ${KNOWN_PLATE}`);
    expect(payload.email).toBe('yo@correo.do');
    expect(buildPayload({ id: 'x', deviceId: 'd', draft: { ...draft, email: '' }, context: context() }).email).toBeNull();
  });

  it('keeps only the last 20 diagnostics entries', () => {
    const errors = Array.from({ length: 30 }, (_, i) => ({ at: new Date(i * 1000).toISOString(), where: `w${i}`, message: 'x' }));
    const p = buildPayload({ id: 'x', deviceId: 'd', draft, context: context({ errors }) });
    expect(p.diagnostics.errors).toHaveLength(20);
    expect(p.diagnostics.errors[0].where).toBe('w10');
  });
});

describe('redactText', () => {
  it('leaves ordinary text and long identifiers alone', () => {
    const text = 'ExpoSQLiteNativeModuleDatabaseErrorThing en /carga/nueva, 2.2.0, 16 cargas';
    expect(redactText(text)).toBe(text);
  });
});

describe('validateDraft', () => {
  it('checks kind, length and email', () => {
    expect(validateDraft({ kind: 'bug', message: 'hola' })).toBe('short');
    expect(validateDraft({ kind: 'idea', message: 'x'.repeat(4001) })).toBe('long');
    expect(validateDraft({ kind: 'otro', message: 'Una idea', email: 'no-es-email' })).toBe('email');
    expect(validateDraft({ kind: 'nope' as never, message: 'Una idea' })).toBe('kind');
    expect(validateDraft({ kind: 'bug', message: 'Se cerró', email: '' })).toBeNull();
  });
});
