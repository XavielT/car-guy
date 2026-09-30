import { LEGAL_VERSION, latestAcceptance, needsAcceptance, type LegalAcceptanceRow } from '@/lib/legal';

function acc(id: string, version: string, acceptedAt: string, over: Partial<LegalAcceptanceRow> = {}): LegalAcceptanceRow {
  return {
    id,
    version,
    acceptedAt,
    locale: 'es',
    platform: 'android',
    deviceId: 'redmi',
    createdAt: acceptedAt,
    updatedAt: acceptedAt,
    deletedAt: null,
    ...over,
  };
}

describe('legal acceptance', () => {
  it('ships a YYYY-MM version', () => {
    expect(LEGAL_VERSION).toMatch(/^\d{4}-\d{2}$/);
  });

  it('nothing accepted → needs acceptance', () => {
    expect(needsAcceptance([])).toBe(true);
    expect(latestAcceptance([])).toBeNull();
  });

  it('the current version accepted (on any device) → done', () => {
    expect(needsAcceptance([acc('a', LEGAL_VERSION, '2026-10-02T10:00:00Z', { platform: 'web', deviceId: 'web-1' })])).toBe(false);
  });

  it('only an older version → asked again', () => {
    expect(needsAcceptance([acc('a', '2026-01', '2026-01-10T10:00:00Z')])).toBe(true);
    expect(needsAcceptance([acc('a', '2026-01', '2026-01-10T10:00:00Z')], '2026-01')).toBe(false);
  });

  it('a tombstoned acceptance does not count', () => {
    const rows = [acc('a', LEGAL_VERSION, '2026-10-02T10:00:00Z', { deletedAt: '2026-10-03T00:00:00Z' })];
    expect(needsAcceptance(rows)).toBe(true);
    expect(latestAcceptance(rows)).toBeNull();
  });

  it('latestAcceptance is the newest live row by acceptedAt', () => {
    const rows = [
      acc('old', '2026-01', '2026-01-10T10:00:00Z'),
      acc('new', LEGAL_VERSION, '2026-10-02T10:00:00Z'),
      acc('gone', LEGAL_VERSION, '2026-10-05T10:00:00Z', { deletedAt: 'x' }),
    ];
    expect(latestAcceptance(rows)?.id).toBe('new');
  });
});
