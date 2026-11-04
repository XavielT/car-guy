import { AGREE, DEFAULT_CALIBRATION, displayFactor, factorInRange, parseCalibration, proposeOdoFactor, proposeSpeedFactor, ratioOf, roundFactor, steadySample } from '@/lib/trips/calibration';

describe('speed factor (SPEC-I §I2)', () => {
  it('needs 3 usable samples; below that there is no proposal', () => {
    expect(proposeSpeedFactor([])).toBeNull();
    expect(proposeSpeedFactor([{ dashKmh: 62, gpsKmh: 60 }, { dashKmh: 83, gpsKmh: 80 }])).toBeNull();
    // A sample at walking pace is not usable (the dash is not meaningful there).
    expect(proposeSpeedFactor([{ dashKmh: 62, gpsKmh: 60 }, { dashKmh: 83, gpsKmh: 80 }, { dashKmh: 12, gpsKmh: 10 }])).toBeNull();
  });
  it('the dash reads 4 % high: the median factor is ~1.04 and says so in percent', () => {
    const p = proposeSpeedFactor([{ dashKmh: 62.4, gpsKmh: 60 }, { dashKmh: 83.2, gpsKmh: 80 }, { dashKmh: 104, gpsKmh: 100 }])!;
    expect(p.factor).toBeCloseTo(1.04, 3);
    expect(p.percent).toBeCloseTo(4, 1);
    expect(p.n).toBe(3);
    expect(p.agrees).toBe(true);
  });
  it('the MEDIAN is used: one typo among the samples cannot drag the factor', () => {
    const p = proposeSpeedFactor([{ dashKmh: 62.4, gpsKmh: 60 }, { dashKmh: 83.2, gpsKmh: 80 }, { dashKmh: 104, gpsKmh: 100 }, { dashKmh: 140, gpsKmh: 100 }])!;
    expect(p.factor).toBeLessThan(1.1);
    expect(p.agrees).toBe(false);
  });
  it('samples that disagree are flagged, not hidden', () => {
    const p = proposeSpeedFactor([{ dashKmh: 61, gpsKmh: 60 }, { dashKmh: 88, gpsKmh: 80 }, { dashKmh: 104, gpsKmh: 100 }])!;
    expect(p.spread).toBeGreaterThan(AGREE * 2);
    expect(p.agrees).toBe(false);
  });
  it('range and rounding', () => {
    expect(factorInRange(1.04)).toBe(true);
    expect(factorInRange(0.79)).toBe(false);
    expect(factorInRange(1.21)).toBe(false);
    expect(factorInRange(Number.NaN)).toBe(false);
    expect(roundFactor(1.04166)).toBe(1.042);
    expect(ratioOf({ dashKmh: 0, gpsKmh: 60 })).toBeNull();
    expect(ratioOf({ dashKmh: 62, gpsKmh: Number.NaN })).toBeNull();
  });
});

describe('steadySample (the 10 steady seconds)', () => {
  const stream = (kmh: (i: number) => number, n = 12) => Array.from({ length: n }, (_, i) => ({ t: i * 1000, kmh: kmh(i) }));
  it('a steady 80 km/h for 11 s is a sample, averaged', () => {
    const r = steadySample(stream((i) => 80 + (i % 2) * 0.6));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.gpsKmh).toBeCloseTo(80.3, 0);
  });
  it('says why not: too short, too slow, still changing', () => {
    expect(steadySample(stream(() => 80, 4))).toEqual({ ok: false, reason: 'short' });
    expect(steadySample([])).toEqual({ ok: false, reason: 'short' });
    expect(steadySample(stream(() => 20))).toEqual({ ok: false, reason: 'slow' });
    expect(steadySample(stream((i) => 60 + i * 1.5))).toEqual({ ok: false, reason: 'varying' });
    // A slow drift is a trend even when each step is small.
    expect(steadySample(stream((i) => 60 + i * 0.35))).toEqual({ ok: false, reason: 'varying' });
  });
  it('a steady car whose GPS speed wobbles ±2 km/h (no Doppler) is still steady: the test is trend + scatter, not range', () => {
    const wobble = [1.8, -1.4, 0.6, -2, 1.2, -0.3, 1.9, -1.7, 0.4, -0.8, 1.5, -1.1];
    const r = steadySample(stream((i) => 90 + wobble[i % wobble.length]));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.gpsKmh).toBeCloseTo(90, 0);
  });
  it('wild scatter is not steady even with no trend', () => {
    expect(steadySample(stream((i) => 90 + (i % 2 ? 6 : -6)))).toEqual({ ok: false, reason: 'varying' });
  });
});

describe('odometer factor', () => {
  it('needs 3 intervals of ≥ 100 km; shorter ones do not count', () => {
    expect(proposeOdoFactor([{ gpsKm: 300, odoKm: 306 }, { gpsKm: 250, odoKm: 255 }])).toBeNull();
    expect(proposeOdoFactor([{ gpsKm: 300, odoKm: 306 }, { gpsKm: 250, odoKm: 255 }, { gpsKm: 60, odoKm: 70 }])).toBeNull();
  });
  it('the dash odometer 2 % above the GPS: factor 1.02', () => {
    expect(proposeOdoFactor([{ gpsKm: 300, odoKm: 306 }, { gpsKm: 250, odoKm: 255 }, { gpsKm: 400, odoKm: 408 }])).toEqual({ factor: 1.02, n: 3 });
  });
  it('an absurd ratio (a wrong reading, not physics) is not proposed', () => {
    expect(proposeOdoFactor([{ gpsKm: 300, odoKm: 450 }, { gpsKm: 250, odoKm: 380 }, { gpsKm: 400, odoKm: 600 }])).toBeNull();
  });
});

describe('what is shown', () => {
  it('GPS truth by default; the factor only when the person chose "como mi tablero"', () => {
    expect(displayFactor(DEFAULT_CALIBRATION)).toBe(1);
    expect(displayFactor({ speedFactor: 1.04, show: 'gps' })).toBe(1);
    expect(displayFactor({ speedFactor: 1.04, show: 'dash' })).toBe(1.04);
    expect(displayFactor(null)).toBe(1);
  });
  it('an unusable stored factor never distorts the display', () => {
    expect(displayFactor({ speedFactor: 3, show: 'dash' })).toBe(1);
    expect(displayFactor({ speedFactor: Number.NaN, show: 'dash' })).toBe(1);
  });
  it('parseCalibration is defensive', () => {
    expect(parseCalibration(null)).toEqual(DEFAULT_CALIBRATION);
    expect(parseCalibration({ speedFactor: 'x', odoFactor: 9, show: 'banana' })).toEqual(DEFAULT_CALIBRATION);
    expect(parseCalibration({ speedFactor: 1.05, odoFactor: 1.02, show: 'dash' })).toEqual({ speedFactor: 1.05, odoFactor: 1.02, show: 'dash' });
  });
});
