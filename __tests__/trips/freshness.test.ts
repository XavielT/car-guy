/** ADR-49: the dot is drawn only on fresh, precise fixes; auto detection never starts on a cached one. */
import { AUTO_START_MAX_AGE_MS, classifyFix, fixAgeMs, isFreshFix, startableFixes } from '../../lib/trips/freshness';

const NOW = 1_790_000_000_000;

describe('classifyFix', () => {
  it('good: ≤ 15 s and ≤ 50 m', () => {
    expect(classifyFix({ t: NOW - 3_000, acc: 8 }, NOW)).toBe('good');
    expect(classifyFix({ t: NOW - 15_000, acc: 50 }, NOW)).toBe('good');
    expect(isFreshFix({ t: NOW, acc: 12 }, NOW)).toBe(true);
  });
  it('stale: older than 15 s — the cached fix from this morning', () => {
    expect(classifyFix({ t: NOW - 15_001, acc: 5 }, NOW)).toBe('stale');
    expect(classifyFix({ t: NOW - 3 * 3_600_000, acc: 20 }, NOW)).toBe('stale');
  });
  it('stale: stamped well in the future (clock skew)', () => {
    expect(classifyFix({ t: NOW + 60_000, acc: 5 }, NOW)).toBe('stale');
    expect(classifyFix({ t: NOW + 2_000, acc: 5 }, NOW)).toBe('good');
  });
  it('coarse: recent but over 50 m, or accuracy unknown', () => {
    expect(classifyFix({ t: NOW - 1_000, acc: 420 }, NOW)).toBe('coarse');
    expect(classifyFix({ t: NOW - 1_000, acc: 51 }, NOW)).toBe('coarse');
    expect(classifyFix({ t: NOW - 1_000, acc: null }, NOW)).toBe('coarse');
    expect(isFreshFix({ t: NOW - 1_000, acc: null }, NOW)).toBe(false);
  });
});

describe('startableFixes (idle auto detection)', () => {
  it('keeps a deferred background batch (up to 90 s) and drops a cached last-known fix', () => {
    const batch = [
      { t: NOW - 2 * 3_600_000, acc: 15 }, // last-known from two hours ago
      { t: NOW - 60_000, acc: 10 }, // deferred 60 s — legit
      { t: NOW - 30_000, acc: 10 },
      { t: NOW - 1_000, acc: 10 },
    ];
    expect(startableFixes(batch, NOW).map((f) => f.t)).toEqual([NOW - 60_000, NOW - 30_000, NOW - 1_000]);
  });
  it('the edge: exactly 90 s stays, a millisecond more goes; the future goes', () => {
    expect(startableFixes([{ t: NOW - AUTO_START_MAX_AGE_MS, acc: 5 }], NOW)).toHaveLength(1);
    expect(startableFixes([{ t: NOW - AUTO_START_MAX_AGE_MS - 1, acc: 5 }], NOW)).toHaveLength(0);
    expect(startableFixes([{ t: NOW + 60_000, acc: 5 }], NOW)).toHaveLength(0);
  });
});

it('fixAgeMs: null without a fix, never negative', () => {
  expect(fixAgeMs(null, NOW)).toBeNull();
  expect(fixAgeMs({ t: NOW - 10_800_000, acc: 5 }, NOW)).toBe(10_800_000);
  expect(fixAgeMs({ t: NOW + 1_000, acc: 5 }, NOW)).toBe(0);
});
