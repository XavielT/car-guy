import { appendSnapshot, FREE_LIMITS, HISTORY_MAX, limitEta, proNeeded, slopePerDay, supportTextFrom, usageLevel, type UsageSnapshot } from '@/lib/domain/usage';

const MB = 1024 * 1024;
const snap = (day: string, dbMb: number, stMb = 100, mau = 10): UsageSnapshot => ({ at: `${day}T12:00:00.000Z`, db_bytes: dbMb * MB, storage_bytes: stMb * MB, mau });

describe('history', () => {
  it('keeps one snapshot a day, oldest first, capped', () => {
    let h = appendSnapshot([], snap('2026-10-01', 100));
    h = appendSnapshot(h, snap('2026-10-01', 101));
    h = appendSnapshot(h, snap('2026-09-30', 99));
    expect(h.map((x) => x.db_bytes / MB)).toEqual([99, 101]);
    for (let i = 0; i < HISTORY_MAX + 10; i++) h = appendSnapshot(h, snap(new Date(Date.UTC(2027, 0, 1) + i * 86_400_000).toISOString().slice(0, 10), 100));
    expect(h).toHaveLength(HISTORY_MAX);
  });
});

describe('slope and eta', () => {
  const h = [snap('2026-09-01', 100, 200), snap('2026-09-11', 110, 250), snap('2026-09-21', 120, 300)];
  it('a least-squares slope per day', () => {
    expect(slopePerDay(h, 'db_bytes')! / MB).toBeCloseTo(1, 6);
    expect(slopePerDay(h, 'storage_bytes')! / MB).toBeCloseTo(5, 6);
    expect(slopePerDay([h[0]], 'db_bytes')).toBeNull();
  });
  it('the date a limit is reached at that slope', () => {
    // DB: 380 MB left at 1 MB/day → 380 days after 2026-09-21
    const eta = limitEta(h, 'db_bytes') as Date;
    expect(eta.toISOString().slice(0, 10)).toBe('2027-10-06');
    // storage: 724 MB left at 5 MB/day → ~145 days → mid Feb 2027, first
    const pro = proNeeded(h)!;
    expect(pro.metric).toBe('storage_bytes');
    expect((pro.when as Date).toISOString().slice(0, 7)).toBe('2027-02');
  });
  it('flat or shrinking: nothing in sight; over the limit: reached', () => {
    expect(limitEta([snap('2026-09-01', 100), snap('2026-09-30', 90)], 'db_bytes')).toBeNull();
    expect(limitEta([snap('2026-09-01', 600)], 'db_bytes')).toBe('reached');
    expect(proNeeded([snap('2026-09-01', 100), snap('2026-09-30', 100, 100)])).toBeNull();
  });
});

it('bar levels at 70 % and 90 %', () => {
  expect(usageLevel(0.69 * FREE_LIMITS.db_bytes, FREE_LIMITS.db_bytes)).toBe('ok');
  expect(usageLevel(0.7 * FREE_LIMITS.db_bytes, FREE_LIMITS.db_bytes)).toBe('amber');
  expect(usageLevel(0.95 * FREE_LIMITS.db_bytes, FREE_LIMITS.db_bytes)).toBe('red');
});

it('what Apoyar is told: free now, Pro in sight', () => {
  const h = [snap('2026-09-01', 100, 200), snap('2026-09-21', 120, 300)];
  expect(supportTextFrom(h, new Date('2026-10-01T00:00:00Z'))).toEqual({ month: '2026-10', cost_usd: 0, pro_usd: 25, pro_eta: '2027-02' });
  expect(supportTextFrom([snap('2026-09-01', 600)]).cost_usd).toBe(25);
});
