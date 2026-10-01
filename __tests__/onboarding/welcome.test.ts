/**
 * The welcome gate (PROMPT-06 step 2) and the first-visit tips' `tips_seen` list.
 */
import { dismissTip, getTipsSeen, isTipSeen, loadTips, parseTipsSeen, resetTips, withTipSeen, __resetTipsForTests } from '@/lib/onboarding/tips';
import {
  markOnboarded,
  ONBOARDED_KEY,
  ONBOARDING_VERSION,
  resolveWelcomeGate,
  welcomeDecision,
  __resetWelcomeForTests,
  type SettingsKV,
} from '@/lib/onboarding/welcome';

function memoryKV(initial: Record<string, unknown> = {}): SettingsKV & { data: Record<string, unknown> } {
  const data = { ...initial };
  return {
    data,
    async get<T>(key: string, fallback: T) {
      return (key in data ? data[key] : fallback) as T;
    },
    async set(key: string, value: unknown) {
      data[key] = value;
    },
  };
}

describe('welcomeDecision', () => {
  it('fresh install (no setting, no vehicles) → show', () => {
    expect(welcomeDecision(null, 0)).toBe('show');
  });
  it('upgrade from 2.3.x (no setting, vehicles) → mark, not shown', () => {
    expect(welcomeDecision(null, 2)).toBe('mark');
  });
  it('finished or skipped → done, with or without vehicles', () => {
    expect(welcomeDecision(ONBOARDING_VERSION, 0)).toBe('done');
    expect(welcomeDecision(ONBOARDING_VERSION, 3)).toBe('done');
  });
  it('a later welcome version shows again even with vehicles', () => {
    expect(welcomeDecision(ONBOARDING_VERSION - 1, 3)).toBe('show');
  });
});

describe('resolveWelcomeGate', () => {
  beforeEach(() => __resetWelcomeForTests());

  it('fresh install → welcome, nothing written', async () => {
    const kv = memoryKV();
    expect(await resolveWelcomeGate(0, kv)).toBe(true);
    expect(kv.data[ONBOARDED_KEY]).toBeUndefined();
  });

  it('existing vehicles → marked onboarded without showing', async () => {
    const kv = memoryKV();
    expect(await resolveWelcomeGate(1, kv)).toBe(false);
    expect(kv.data[ONBOARDED_KEY]).toBe(ONBOARDING_VERSION);
    // Next launch: the mark holds even if the garage is emptied.
    __resetWelcomeForTests();
    expect(await resolveWelcomeGate(0, kv)).toBe(false);
  });

  it('finished (or skipped) → not shown again', async () => {
    const kv = memoryKV();
    expect(await resolveWelcomeGate(0, kv)).toBe(true);
    await markOnboarded(kv);
    expect(kv.data[ONBOARDED_KEY]).toBe(ONBOARDING_VERSION);
    __resetWelcomeForTests();
    expect(await resolveWelcomeGate(0, kv)).toBe(false);
  });

  it('a garbage stored value counts as unset', async () => {
    expect(await resolveWelcomeGate(0, memoryKV({ [ONBOARDED_KEY]: 'yes' }))).toBe(true);
  });
});

describe('tips_seen', () => {
  beforeEach(() => __resetTipsForTests());

  it('parses only known ids, once each', () => {
    expect(parseTipsSeen(['trips', 'nope', 'trips', 3, 'drive'])).toEqual(['trips', 'drive']);
    expect(parseTipsSeen(null)).toEqual([]);
    expect(parseTipsSeen('trips')).toEqual([]);
  });

  it('adding is idempotent', () => {
    expect(withTipSeen(['trips'], 'trips')).toEqual(['trips']);
    expect(withTipSeen(['trips'], 'album')).toEqual(['trips', 'album']);
    expect(isTipSeen(['album'], 'album')).toBe(true);
    expect(isTipSeen(['album'], 'build')).toBe(false);
  });

  it('dismiss persists the list; reset empties it', async () => {
    const kv = memoryKV({ tips_seen: ['build'] });
    await loadTips(kv);
    expect(getTipsSeen()).toEqual(['build']);
    await dismissTip('events', kv);
    expect(kv.data.tips_seen).toEqual(['build', 'events']);
    await resetTips(kv);
    expect(kv.data.tips_seen).toEqual([]);
    expect(getTipsSeen()).toEqual([]);
  });
});
