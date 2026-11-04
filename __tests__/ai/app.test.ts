/**
 * IMP 03112026 SPEC-A §A5: the app side of the AI gateway: status → what a button does, error codes → messages,
 * the admin limits parser. Pure; no network. (The server side is __tests__/ai/gateway.test.ts + local-rls 042.)
 */
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

import { callAi, mapFetchFailure, readAiResponse } from '@/lib/ai/client';
import { AiError, CAPPED_CODES, SERVER_CODES, isServerCode, type AiErrorCode } from '@/lib/ai/codes';
import {
  AI_CONFIG_KEYS,
  DEFAULT_AI_CONFIG,
  configFromRows,
  fieldsFromConfig,
  parseAmount,
  parseLimits,
  usd,
} from '@/lib/ai/limits';
import { deriveAiStatus, voiceAvailable, type StatusInput, type StatusResponse } from '@/lib/ai/status';
import { en } from '@/lib/i18n/en';
import { es } from '@/lib/i18n/es';

const resp = (patch: Partial<StatusResponse> = {}): StatusResponse => ({
  ok: true,
  signed_in: true,
  enabled: true,
  configured: true,
  consent: true,
  stt_configured: true,
  refusal: null,
  remainingToday: { hour: 30, dayUsd: 0.5 },
  ...patch,
});
const input = (patch: Partial<StatusInput> = {}): StatusInput => ({ cloudConfigured: true, signedIn: true, response: resp(), failure: null, ...patch });

describe('deriveAiStatus — what an AI button does', () => {
  it('available when everything is on', () => {
    expect(deriveAiStatus(input())).toBe('available');
  });
  it('a build without the cloud cannot use AI', () => {
    expect(deriveAiStatus(input({ cloudConfigured: false }))).toBe('not_configured');
  });
  it('signed out asks for an account (and still reports a global off switch first)', () => {
    expect(deriveAiStatus(input({ signedIn: false, response: resp({ signed_in: false }) }))).toBe('needs_account');
    expect(deriveAiStatus(input({ signedIn: false, response: null }))).toBe('needs_account');
    expect(deriveAiStatus(input({ signedIn: false, response: resp({ signed_in: false, enabled: false }) }))).toBe('disabled');
  });
  it('signed in but not answered yet is loading', () => {
    expect(deriveAiStatus(input({ response: null }))).toBe('loading');
  });
  it('no network is offline; any other failure is "not available here"', () => {
    expect(deriveAiStatus(input({ response: null, failure: 'offline' }))).toBe('offline');
    expect(deriveAiStatus(input({ response: null, failure: 'error' }))).toBe('not_configured');
  });
  it('the kill switch wins over consent', () => {
    expect(deriveAiStatus(input({ response: resp({ enabled: false, consent: false }) }))).toBe('disabled');
  });
  it('no provider key on the server = not configured', () => {
    expect(deriveAiStatus(input({ response: resp({ configured: false }) }))).toBe('not_configured');
  });
  it('no consent asks for consent', () => {
    expect(deriveAiStatus(input({ response: resp({ consent: false }) }))).toBe('needs_consent');
  });
  it.each(['rate_user', 'cap_user_day', 'cap_global_day'])('refusal %s means capped', (refusal) => {
    expect(deriveAiStatus(input({ response: resp({ refusal }) }))).toBe('capped');
  });
  it('an unknown refusal string does not block the button', () => {
    expect(deriveAiStatus(input({ response: resp({ refusal: 'whatever' }) }))).toBe('available');
  });
  it('voice needs the speech key as well', () => {
    expect(voiceAvailable('available', resp({ stt_configured: true }))).toBe(true);
    expect(voiceAvailable('available', resp({ stt_configured: false }))).toBe(false);
    expect(voiceAvailable('needs_consent', resp())).toBe(false);
    expect(voiceAvailable('available', null)).toBe(false);
  });
});

/** Runs a call that must fail and returns its AiError (a success is a test failure). */
const asAiError = (p: Promise<unknown>) =>
  p.then(
    () => {
      throw new Error('expected an AiError');
    },
    (x: unknown) => x as AiError,
  );
const readFail = (res: Response) => asAiError(readAiResponse(res));
const callFail = (f: jest.Mock) => asAiError(callAi('cg-ai-read', {}, f as unknown as typeof fetch));

describe('client — responses and failures become typed codes', () => {
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

  it('returns the body of an ok answer', async () => {
    expect(await readAiResponse<{ x: number }>(json({ ok: true, x: 1 }))).toEqual({ ok: true, x: 1 });
  });
  it('maps every server error_code through unchanged', async () => {
    for (const code of SERVER_CODES) {
      const e = await readFail(json({ ok: false, error_code: code }, 400));
      expect(e).toBeInstanceOf(AiError);
      expect(e.code).toBe(code);
    }
  });
  it('an unknown code or a non-JSON 5xx becomes provider_error / internal, never provider text', async () => {
    expect((await readFail(json({ ok: false, error_code: 'made_up' }, 400))).code).toBe('internal');
    expect((await readFail(new Response('<html>Bad gateway SECRET</html>', { status: 502 }))).code).toBe('provider_error');
    const e = await readFail(new Response('<html>Bad gateway SECRET</html>', { status: 502 }));
    expect(e.message).not.toContain('SECRET');
  });
  it('a 200 with ok:false is still an error', async () => {
    expect((await readFail(json({ ok: false, error_code: 'unreadable' }))).code).toBe('unreadable');
  });
  it('fetch failures: abort/timeout → timeout, anything else → offline', () => {
    expect(mapFetchFailure(Object.assign(new Error('x'), { name: 'AbortError' })).code).toBe('timeout');
    expect(mapFetchFailure(Object.assign(new Error('x'), { name: 'TimeoutError' })).code).toBe('timeout');
    expect(mapFetchFailure(new TypeError('Network request failed')).code).toBe('offline');
    const already = new AiError('cap_user_day');
    expect(mapFetchFailure(already)).toBe(already);
  });
  it('without the cloud in the build, callAi fails as offline and never calls fetch', async () => {
    const f = jest.fn();
    const e = await callFail(f);
    expect(e.code).toBe('offline');
    expect(f).not.toHaveBeenCalled();
  });
  it('isServerCode accepts only the contract codes; capped codes are a subset', () => {
    expect(isServerCode('rate_user')).toBe(true);
    expect(isServerCode('offline')).toBe(false);
    expect(isServerCode(42)).toBe(false);
    for (const c of CAPPED_CODES) expect(isServerCode(c)).toBe(true);
  });
});

describe('messages — every code has words in both languages, never the code itself', () => {
  const all: AiErrorCode[] = [...SERVER_CODES, 'offline', 'timeout', 'needs_account'];
  it.each(all)('%s has an es and an en message', (code) => {
    const e = (es.ai.errors as Record<string, string>)[code];
    const n = (en.ai.errors as Record<string, string>)[code];
    expect(e).toBeTruthy();
    expect(n).toBeTruthy();
    expect(e).not.toBe(code);
    expect(n).not.toBe(code);
  });
  it('every state has a message and the manual path is named where it matters', () => {
    for (const s of ['loading', 'available', 'needs_account', 'needs_consent', 'offline', 'capped', 'disabled', 'not_configured'] as const) {
      expect(es.ai.status[s].length).toBeGreaterThan(5);
      expect(en.ai.status[s].length).toBeGreaterThan(5);
    }
    expect(es.ai.status.offline).toMatch(/a mano/);
    expect(en.ai.status.offline).toMatch(/by hand/);
  });
  it('the consent text says what is sent, who processes it, what is kept and how to withdraw', () => {
    const c = es.ai.consent;
    expect([c.sentTitle, c.processorsTitle, c.keptTitle, c.withdrawTitle].every(Boolean)).toBe(true);
    expect(c.processors.join(' ')).toMatch(/Anthropic/);
    expect(c.kept).toMatch(/No guardamos/);
  });
});

describe('limits.ts — the admin brakes', () => {
  it('parseAmount accepts comma or point, rejects blank/negative/garbage', () => {
    expect(parseAmount('0,5')).toBe(0.5);
    expect(parseAmount(' 12 ')).toBe(12);
    expect(parseAmount('0')).toBe(0);
    for (const bad of ['', '-1', 'abc', '1.2.3', '1e3', '∞', ' ']) expect(parseAmount(bad)).toBeNull();
  });
  it('parseLimits: counts are whole numbers, dollars may be decimals, any bad field saves nothing', () => {
    expect(parseLimits({ userHour: '30', userDayUsd: '0,50', globalDayUsd: '5', placesUserDay: '20' })).toEqual({
      userHour: 30,
      userDayUsd: 0.5,
      globalDayUsd: 5,
      placesUserDay: 20,
    });
    expect(parseLimits({ userHour: '2.5', userDayUsd: '1', globalDayUsd: '1', placesUserDay: '1' })).toBeNull();
    expect(parseLimits({ userHour: '1', userDayUsd: '', globalDayUsd: '1', placesUserDay: '1' })).toBeNull();
    expect(parseLimits({ userHour: '0', userDayUsd: '0', globalDayUsd: '0', placesUserDay: '0' })).not.toBeNull(); // 0 = stop
  });
  it('configFromRows fills defaults for missing or malformed keys', () => {
    expect(configFromRows(null)).toEqual(DEFAULT_AI_CONFIG);
    const c = configFromRows({ [AI_CONFIG_KEYS.enabled]: false, [AI_CONFIG_KEYS.userHour]: 5, [AI_CONFIG_KEYS.userDayUsd]: 'x', [AI_CONFIG_KEYS.globalDayUsd]: -3 });
    expect(c).toEqual({ ...DEFAULT_AI_CONFIG, enabled: false, userHour: 5 });
  });
  it('fieldsFromConfig round-trips through parseLimits', () => {
    expect(parseLimits(fieldsFromConfig(DEFAULT_AI_CONFIG))).toEqual({
      userHour: 30,
      userDayUsd: 0.5,
      globalDayUsd: 5,
      placesUserDay: 20,
    });
  });
  it('usd() tolerates numeric strings from Postgres', () => {
    expect(usd('0.410000')).toBe(0.41);
    expect(usd('nope')).toBe(0);
  });
  it('the config keys are the sql/042 ones plus the sql/044 feature list', () => {
    expect(Object.values(AI_CONFIG_KEYS).sort()).toEqual(
      ['ai_cap_global_day_usd', 'ai_cap_user_day_usd', 'ai_enabled', 'ai_features_off', 'ai_limit_places_user_day', 'ai_limit_user_hour'].sort(),
    );
  });
});
