import { DRAFT_TTL_MS, draftAge, isFresh, worthKeeping } from '@/lib/forms/draft';

const NOW = Date.UTC(2026, 10, 6, 12);

describe('form drafts', () => {
  it('only text with substance is worth keeping', () => {
    expect(worthKeeping({ a: '', b: '   ' })).toBe(false);
    expect(worthKeeping({ a: '', b: '5' })).toBe(true);
    expect(worthKeeping({ a: null, b: undefined })).toBe(false);
  });

  it('an untouched default does not count as a draft', () => {
    expect(worthKeeping({ unit: 'gal' }, { unit: 'gal' })).toBe(false);
    expect(worthKeeping({ unit: 'gal', vol: '10' }, { unit: 'gal' })).toBe(true);
  });

  it('a draft lives a week, not more, and never from the future', () => {
    expect(isFresh({ at: NOW - 60_000, values: {} }, NOW)).toBe(true);
    expect(isFresh({ at: NOW - DRAFT_TTL_MS, values: {} }, NOW)).toBe(true);
    expect(isFresh({ at: NOW - DRAFT_TTL_MS - 1, values: {} }, NOW)).toBe(false);
    expect(isFresh({ at: NOW + 60_000, values: {} }, NOW)).toBe(false);
    expect(isFresh(null, NOW)).toBe(false);
  });

  it('words the age in the coarsest honest unit, one minute at least', () => {
    expect(draftAge(NOW - 5_000, NOW)).toEqual({ unit: 'minutes', n: 1 });
    expect(draftAge(NOW - 12 * 60_000, NOW)).toEqual({ unit: 'minutes', n: 12 });
    expect(draftAge(NOW - 3 * 3_600_000, NOW)).toEqual({ unit: 'hours', n: 3 });
    expect(draftAge(NOW - 2 * 86_400_000, NOW)).toEqual({ unit: 'days', n: 2 });
  });
});
