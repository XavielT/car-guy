import {
  isMarbeteWindowOpen,
  marbeteNudges,
  marbeteTier,
  marbeteWindowOpens,
  MARBETE_TIER_NEW,
  MARBETE_TIER_OLD,
  nextMarbeteDeadline,
  vidaUtil,
} from '@/lib/domain/legal-dr';

const iso = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12).toISOString();
const y = (s: string) => new Date(s).getFullYear();
const m = (s: string) => new Date(s).getMonth();
const d = (s: string) => new Date(s).getDate();

describe('nextMarbeteDeadline', () => {
  it('points at this January while it is still ahead', () => {
    expect(y(nextMarbeteDeadline(iso(2026, 1, 5)))).toBe(2026);
  });

  it('includes the deadline day itself — it is due today, not next year', () => {
    expect(y(nextMarbeteDeadline(iso(2026, 1, 31)))).toBe(2026);
  });

  it('rolls to next year once February arrives', () => {
    expect(y(nextMarbeteDeadline(iso(2026, 2, 1)))).toBe(2027);
    expect(y(nextMarbeteDeadline(iso(2026, 9, 18)))).toBe(2027);
  });

  it('always lands on 31 January', () => {
    const deadline = nextMarbeteDeadline(iso(2026, 9, 18));
    expect(m(deadline)).toBe(0);
    expect(d(deadline)).toBe(31);
  });
});

describe('marbeteWindowOpens', () => {
  it('opens in the October before the deadline', () => {
    const opens = marbeteWindowOpens(iso(2027, 1, 31));
    expect(y(opens)).toBe(2026);
    expect(m(opens)).toBe(9);
    expect(d(opens)).toBe(21);
  });
});

describe('isMarbeteWindowOpen', () => {
  it('is closed in the summer', () => {
    expect(isMarbeteWindowOpen(iso(2026, 7, 1))).toBe(false);
  });

  it('opens with the mid-October heads-up', () => {
    expect(isMarbeteWindowOpen(iso(2026, 10, 14))).toBe(false);
    expect(isMarbeteWindowOpen(iso(2026, 10, 15))).toBe(true);
  });

  it('stays open through the deadline and closes after', () => {
    expect(isMarbeteWindowOpen(iso(2027, 1, 31))).toBe(true);
    expect(isMarbeteWindowOpen(iso(2027, 2, 1))).toBe(false);
  });
});

describe('marbeteTier', () => {
  it('charges the higher tier for recent model years', () => {
    // Deadline is Jan 2027, so 2023 and newer pay RD$3,000.
    expect(marbeteTier(2023, iso(2026, 9, 18))).toBe(MARBETE_TIER_NEW);
    expect(marbeteTier(2026, iso(2026, 9, 18))).toBe(MARBETE_TIER_NEW);
  });

  it('charges the lower tier for older ones', () => {
    expect(marbeteTier(2022, iso(2026, 9, 18))).toBe(MARBETE_TIER_OLD);
    expect(marbeteTier(2015, iso(2026, 9, 18))).toBe(MARBETE_TIER_OLD);
  });

  it('shifts by one model year as the periods roll over', () => {
    // The same car drops into the cheaper tier the following period.
    expect(marbeteTier(2022, iso(2025, 9, 18))).toBe(MARBETE_TIER_NEW);
    expect(marbeteTier(2022, iso(2026, 9, 18))).toBe(MARBETE_TIER_OLD);
  });

  it('says nothing without a model year', () => {
    expect(marbeteTier(null, iso(2026, 9, 18))).toBeNull();
  });
});

describe('marbeteNudges', () => {
  it('escalates through January rather than firing once in October', () => {
    const nudges = marbeteNudges(iso(2026, 9, 18));
    expect(nudges.length).toBeGreaterThanOrEqual(6);
    // Deadline day is the last one and says there is no extension.
    expect(nudges.at(-1)!.message).toContain('Sin prórroga');
  });

  it('drops the ones that have already passed', () => {
    const late = marbeteNudges(iso(2027, 1, 26));
    expect(late).toHaveLength(1);
    expect(d(late[0].date)).toBe(31);
  });

  it('warns about the online closing date, which is not the deadline', () => {
    const nudges = marbeteNudges(iso(2026, 9, 18));
    const online = nudges.find((n) => n.message.includes('en línea'));
    expect(online).toBeTruthy();
    expect(d(online!.date)).toBe(18);
  });

  it('is in chronological order', () => {
    const dates = marbeteNudges(iso(2026, 9, 18)).map((n) => new Date(n.date).getTime());
    expect([...dates].sort((a, b) => a - b)).toEqual(dates);
  });
});

describe('vidaUtil', () => {
  it('uses the Ley 63-17 limit for the vehicle type', () => {
    expect(vidaUtil('motor', 2020, iso(2026, 9, 18)).limitYears).toBe(10);
    expect(vidaUtil('carro', 2020, iso(2026, 9, 18)).limitYears).toBe(15);
    expect(vidaUtil('camion', 2020, iso(2026, 9, 18)).limitYears).toBe(30);
  });

  it('works out the age and what is left', () => {
    const v = vidaUtil('carro', 2015, iso(2026, 9, 18));
    expect(v.age).toBe(11);
    expect(v.remainingYears).toBe(4);
  });

  it('goes negative for a vehicle past its limit, rather than clamping', () => {
    // The ITV is not enforcing this yet, so the honest number is the one to show.
    expect(vidaUtil('motor', 2010, iso(2026, 9, 18)).remainingYears).toBe(-6);
  });

  it('still reports the limit without a model year', () => {
    const v = vidaUtil('carro', null, iso(2026, 9, 18));
    expect(v.limitYears).toBe(15);
    expect(v.age).toBeNull();
  });
});
