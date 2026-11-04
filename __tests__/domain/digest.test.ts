import { DIGEST, inQuietHours, localHour, planDigests, type DigestCandidate } from '../../lib/domain/digest';

// 2026-11-15 15:00 UTC = 11:00 in Santo Domingo (UTC−4).
const NOW = '2026-11-15T15:00:00Z';
const days = (n: number) => new Date(Date.parse(NOW) - n * 86_400_000).toISOString();
const cand = (over: Partial<DigestCandidate> = {}): DigestCandidate => ({
  userId: 'u1', vehicleId: 'v1', lastActiveAt: days(2), lastDigestHash: null, lastDigestAt: null, hash: 'h1', worst: 'watch',
  prefs: { enabled: true, quietFrom: 22, quietTo: 7, tzOffsetMin: -240 }, ...over,
});
const plan = (c: DigestCandidate[], o: Partial<Parameters<typeof planDigests>[1]> = {}) => planDigests(c, { now: NOW, killSwitchOn: false, sentToday: 0, ...o });
const reason = (c: DigestCandidate, o = {}) => plan([c], o).skipped[0]?.reason ?? 'sent';

describe('quiet hours', () => {
  it('local hour follows the offset, across midnight too', () => {
    expect(localHour(Date.parse(NOW), -240)).toBe(11);
    expect(localHour(Date.parse('2026-11-15T02:30:00Z'), -240)).toBe(22);
    expect(localHour(Date.parse('2026-11-15T23:00:00Z'), 120)).toBe(1);
  });
  it('a window that wraps midnight', () => {
    expect(inQuietHours(23, 22, 7)).toBe(true);
    expect(inQuietHours(3, 22, 7)).toBe(true);
    expect(inQuietHours(7, 22, 7)).toBe(false);
    expect(inQuietHours(12, 22, 7)).toBe(false);
  });
  it('a same-day window, and no window', () => {
    expect(inQuietHours(13, 12, 14)).toBe(true);
    expect(inQuietHours(14, 12, 14)).toBe(false);
    expect(inQuietHours(3, 5, 5)).toBe(false);
  });
});

describe('planDigests', () => {
  it('sends a changed, active, opted-in car at a decent hour', () => {
    expect(plan([cand()]).selected).toHaveLength(1);
  });
  it.each([
    ['kill_switch', cand(), { killSwitchOn: true }],
    ['opted_out', cand({ prefs: { enabled: false, quietFrom: 22, quietTo: 7, tzOffsetMin: -240 } }), {}],
    ['inactive', cand({ lastActiveAt: days(31) }), {}],
    ['inactive', cand({ lastActiveAt: null }), {}],
    ['no_facts', cand({ worst: 'info' }), {}],
    ['unchanged', cand({ lastDigestHash: 'h1', lastDigestAt: days(20) }), {}],
    ['too_soon', cand({ lastDigestHash: 'old', lastDigestAt: days(3) }), {}],
    ['quiet_hours', cand({ prefs: { enabled: true, quietFrom: 9, quietTo: 13, tzOffsetMin: -240 } }), {}],
  ] as const)('skips with reason %s', (why, c, o) => {
    expect(reason(c, o)).toBe(why);
  });
  it('the 6-day gap is exclusive of day 7', () => {
    expect(reason(cand({ lastDigestHash: 'old', lastDigestAt: days(7) }))).toBe('sent');
  });
  it('the first failing reason wins (kill switch beats everything)', () => {
    expect(reason(cand({ worst: 'info', lastActiveAt: days(90) }), { killSwitchOn: true })).toBe('kill_switch');
  });
  it('the daily cap keeps the most urgent and defers the rest', () => {
    const list = [cand({ userId: 'a', worst: 'watch' }), cand({ userId: 'b', worst: 'act' }), cand({ userId: 'c', worst: 'watch' })];
    const r = plan(list, { dailyCap: 2, sentToday: 1 });
    expect(r.selected.map((c) => c.userId)).toEqual(['b']);
    expect(r.skipped.map((s) => [s.userId, s.reason])).toEqual([['a', 'daily_cap'], ['c', 'daily_cap']]);
  });
  it('a cap already used up sends nothing', () => {
    expect(plan([cand()], { sentToday: DIGEST.DAILY_CAP }).selected).toHaveLength(0);
  });
  it('does not mutate its input', () => {
    const list = [cand({ userId: 'a', worst: 'watch' }), cand({ userId: 'b', worst: 'act' })];
    plan(list);
    expect(list.map((c) => c.userId)).toEqual(['a', 'b']);
  });
});
