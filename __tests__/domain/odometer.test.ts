import {
  currentOdometer,
  FALLBACK_KM_PER_DAY,
  kmPerDay,
  odometerWarning,
  type Reading,
} from '@/lib/domain/odometer';

const at = (day: number, km: number): Reading => ({
  occurredAt: new Date(2026, 5, day, 12).toISOString(),
  valueKm: km,
});

const TODAY = new Date(2026, 5, 30, 12).toISOString();

describe('currentOdometer', () => {
  it('is null with no readings', () => {
    expect(currentOdometer([])).toBeNull();
  });

  it('takes the highest value, not the newest', () => {
    // A mistyped final reading must not lower the vehicle's odometer.
    expect(currentOdometer([at(1, 50_000), at(2, 50_400), at(3, 5_040)])).toBe(50_400);
  });
});

describe('kmPerDay', () => {
  it('returns the median of a steady series', () => {
    const result = kmPerDay([at(1, 1000), at(2, 1040), at(3, 1080), at(4, 1120)], TODAY);
    expect(result.kmPerDay).toBe(40);
    expect(result.confidence).toBe('buena');
    expect(result.samples).toBe(3);
  });

  it('is not dragged by one long trip — the point of using the median', () => {
    const result = kmPerDay(
      [at(1, 1000), at(2, 1040), at(3, 1080), at(4, 1680), at(5, 1720)],
      TODAY,
    );
    // Rates are 40, 40, 600 (dropped, over the cap), 40.
    expect(result.kmPerDay).toBe(40);
  });

  it('ignores a reading that goes backwards', () => {
    const result = kmPerDay([at(1, 1000), at(2, 1040), at(3, 104), at(4, 1080)], TODAY);
    expect(result.kmPerDay).toBe(40);
    // The 104 pair is skipped on the way down and on the way back up.
    expect(result.samples).toBe(1);
  });

  it('ignores two readings on the same day', () => {
    const sameDay: Reading[] = [
      { occurredAt: new Date(2026, 5, 1, 9).toISOString(), valueKm: 1000 },
      { occurredAt: new Date(2026, 5, 1, 18).toISOString(), valueKm: 1030 },
      { occurredAt: new Date(2026, 5, 2, 12).toISOString(), valueKm: 1070 },
    ];
    const result = kmPerDay(sameDay, TODAY);
    expect(result.samples).toBe(1);
    expect(result.kmPerDay).toBe(40);
  });

  it('caps an implausible rate rather than believing it', () => {
    const result = kmPerDay([at(1, 1000), at(2, 9000)], TODAY);
    // 8000 km in a day is a typo; with nothing usable left it falls back.
    expect(result.kmPerDay).toBe(FALLBACK_KM_PER_DAY);
    expect(result.confidence).toBe('baja');
  });

  it('falls back with fewer than two usable readings', () => {
    expect(kmPerDay([], TODAY)).toEqual({
      kmPerDay: FALLBACK_KM_PER_DAY,
      confidence: 'baja',
      samples: 0,
    });
    expect(kmPerDay([at(1, 1000)], TODAY).confidence).toBe('baja');
  });

  it('marks the rate estimada when the newest reading is over 30 days old', () => {
    const old: Reading[] = [
      { occurredAt: new Date(2026, 2, 1, 12).toISOString(), valueKm: 1000 },
      { occurredAt: new Date(2026, 2, 2, 12).toISOString(), valueKm: 1040 },
    ];
    const result = kmPerDay(old, TODAY);
    expect(result.kmPerDay).toBe(40);
    expect(result.confidence).toBe('estimada');
  });

  it('still answers for a vehicle parked all season, using the last readings', () => {
    // Nothing inside the 90-day window, but there is history.
    const parked: Reading[] = [
      { occurredAt: new Date(2025, 0, 1, 12).toISOString(), valueKm: 1000 },
      { occurredAt: new Date(2025, 0, 11, 12).toISOString(), valueKm: 1200 },
    ];
    const result = kmPerDay(parked, TODAY);
    expect(result.kmPerDay).toBe(20);
    expect(result.confidence).toBe('estimada');
  });
});

describe('odometerWarning', () => {
  const readings = [at(1, 50_000), at(10, 51_000)];

  it('says nothing when the value is at or above the highest reading', () => {
    expect(odometerWarning(51_000, TODAY, readings)).toBeNull();
    expect(odometerWarning(52_000, TODAY, readings)).toBeNull();
  });

  it('warns — but does not block — on a lower value dated later', () => {
    const warning = odometerWarning(40_000, TODAY, readings);
    expect(warning).toContain('51,000 km');
    expect(warning).toContain('Puedes guardarlo igual');
  });

  it('stays quiet when the entry is dated before the highest reading', () => {
    // Backdating a record naturally has a lower odometer; that is not a mistake.
    const earlier = new Date(2026, 5, 5, 12).toISOString();
    expect(odometerWarning(50_400, earlier, readings)).toBeNull();
  });

  it('says nothing when there is no history yet', () => {
    expect(odometerWarning(10, TODAY, [])).toBeNull();
  });
});
