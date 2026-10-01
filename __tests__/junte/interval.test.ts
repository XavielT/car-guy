import {
  firstOverCap,
  liveIntervalMs,
  liveIntervalS,
  messagesPerSecond,
  REALTIME_MSG_CAP_PER_S,
  sendsPerSecond,
} from '@/lib/junte/interval';

describe('liveIntervalS', () => {
  it('is 4 s for small groups', () => {
    for (const n of [0, 1, 2, 5, 10, 15]) expect(liveIntervalS(n)).toBe(4);
  });

  it('grows as n² / 60 past 15 members (research §3.5 figures)', () => {
    expect(liveIntervalS(16)).toBeCloseTo(256 / 60, 6);
    expect(liveIntervalS(20)).toBeCloseTo(6.67, 2);
    expect(liveIntervalS(30)).toBe(15);
    expect(liveIntervalS(60)).toBe(60);
  });

  it('never shrinks as the group grows', () => {
    for (let n = 2; n <= 200; n++) expect(liveIntervalS(n)).toBeGreaterThanOrEqual(liveIntervalS(n - 1));
  });

  it('has a millisecond twin for timers', () => {
    expect(liveIntervalMs(1)).toBe(4000);
    expect(liveIntervalMs(20)).toBe(6667);
    expect(liveIntervalMs(30)).toBe(15000);
  });
});

describe('rates', () => {
  it('sends are n / T; counted messages add one delivery per recipient', () => {
    expect(sendsPerSecond(10, 4)).toBe(2.5);
    expect(messagesPerSecond(10, 4)).toBe(25);
    // The case ADR-57 exists for: 20 cars at a fixed 4 s is exactly the Free cap.
    expect(messagesPerSecond(20, 4)).toBe(REALTIME_MSG_CAP_PER_S);
    expect(messagesPerSecond(20, liveIntervalS(20))).toBeCloseTo(60, 6);
  });

  it('stays at or under 100 msg/s for every n from 1 to 200', () => {
    for (let n = 1; n <= 200; n++) {
      const t = liveIntervalS(n);
      expect(sendsPerSecond(n, t)).toBeLessThanOrEqual(100);
      expect(messagesPerSecond(n, t)).toBeLessThanOrEqual(100);
    }
    expect(firstOverCap(200)).toBeNull();
  });

  it('firstOverCap finds a broken cap', () => {
    expect(firstOverCap(200, 50)).toBe(15); // 15² / 4 = 56.25
  });
});
