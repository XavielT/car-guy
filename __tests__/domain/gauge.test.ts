/**
 * Gauge readings (IMP 01102026, ADR-51) — research 03 §2, §5 tests plus the
 * parsing edge cases the repo layer leans on.
 */
import {
  amberThreshold,
  eighthsToFrac,
  eighthsToRaw,
  fromFraction,
  hitTestSegment,
  reserveStep,
  resolutionL,
  snapPercent,
  stepsFor,
  toFraction,
  toGrid,
  validateGaugeCfg,
  type GaugeCfg,
} from '@/lib/domain/gauge';

const needle: GaugeCfg = { type: 'needle8' };
const nine: GaugeCfg = { type: 'segments', segments: 9 };
const pct: GaugeCfg = { type: 'percent' };

describe('research §5', () => {
  it('3/8 → 0.375 → toGrid(·, 9) = 3', () => {
    expect(toFraction('3/8', nine)).toBe(0.375);
    expect(toGrid(0.375, 9)).toBe(3);
  });
  it('hitTestSegment(0.47·W, W, 9) = 4', () => {
    expect(hitTestSegment(0.47 * 343, 343, 9)).toBe(4);
  });
  it('snapPercent(47) = 45', () => {
    expect(snapPercent(47)).toBe(45);
  });
  it('N = 2 or 21 rejected', () => {
    expect(validateGaugeCfg({ type: 'segments', segments: 2 })).toBeNull();
    expect(validateGaugeCfg({ type: 'segments', segments: 21 })).toBeNull();
    expect(validateGaugeCfg({ type: 'segments', segments: 3 })).not.toBeNull();
    expect(validateGaugeCfg({ type: 'segments', segments: 20 })).not.toBeNull();
  });
});

describe('validateGaugeCfg', () => {
  it('rejects unknown types, missing or fractional N, and bad reserve', () => {
    expect(validateGaugeCfg({ type: 'dial' as never })).toBeNull();
    expect(validateGaugeCfg({ type: 'segments' })).toBeNull();
    expect(validateGaugeCfg({ type: 'segments', segments: 8.5 })).toBeNull();
    expect(validateGaugeCfg({ ...nine, reserveAt: -1 })).toBeNull();
    expect(validateGaugeCfg({ ...nine, reserveAt: 9 })).toBeNull();
    expect(validateGaugeCfg({ ...nine, reserveAt: 0 })).not.toBeNull();
    expect(validateGaugeCfg({ ...nine, reserveAt: 1 })).not.toBeNull();
    expect(validateGaugeCfg(null)).toBeNull();
  });
  it('ignores segments on a needle', () => {
    expect(validateGaugeCfg({ type: 'needle8', segments: 99 })).not.toBeNull();
  });
});

describe('stepsFor / resolutionL / reserveStep', () => {
  it('G = 8, N, 20', () => {
    expect(stepsFor(needle)).toBe(8);
    expect(stepsFor(nine)).toBe(9);
    expect(stepsFor(pct)).toBe(20);
    expect(stepsFor({ type: 'segments', segments: 1 })).toBeNull();
  });
  it('C/16 for eighths, C/(2N) for squares, C/40 for percent', () => {
    expect(resolutionL(needle, 48)).toBe(3);
    expect(resolutionL(nine, 45)).toBe(2.5);
    expect(resolutionL(pct, 40)).toBe(1);
    expect(resolutionL(nine, 0)).toBeNull();
  });
  it('percent reserve is converted to 5 % steps', () => {
    expect(reserveStep({ type: 'percent', reserveAt: 10 })).toBe(2);
    expect(reserveStep({ ...nine, reserveAt: 1 })).toBe(1);
    expect(reserveStep(nine)).toBeNull();
  });
});

describe('toFraction', () => {
  it('parses n/d on its own scale, whatever the vehicle has now', () => {
    expect(toFraction('4/9', nine)).toBeCloseTo(4 / 9, 10);
    expect(toFraction('4/9', needle)).toBeCloseTo(4 / 9, 10);
    expect(toFraction(' 8 / 8 ', needle)).toBe(1);
    expect(toFraction('0/9', nine)).toBe(0);
  });
  it('parses percent with or without a space and a decimal comma', () => {
    expect(toFraction('45%', pct)).toBe(0.45);
    expect(toFraction('45 %', pct)).toBe(0.45);
    expect(toFraction('47,5%', pct)).toBe(0.475);
    expect(toFraction('0%', pct)).toBe(0);
    expect(toFraction('100%', pct)).toBe(1);
  });
  it('reads a bare step against the vehicle grid', () => {
    expect(toFraction('4', nine)).toBeCloseTo(4 / 9, 10);
    expect(toFraction('6', needle)).toBe(0.75);
    expect(toFraction('45', pct)).toBe(0.45);
    expect(toFraction('10', nine)).toBeNull();
  });
  it('rejects out-of-range and junk', () => {
    expect(toFraction('10/9', nine)).toBeNull();
    expect(toFraction('1/2', nine)).toBeNull(); // no 2-square gauge
    expect(toFraction('1/21', nine)).toBeNull();
    expect(toFraction('101%', pct)).toBeNull();
    expect(toFraction('-1/9', nine)).toBeNull();
    expect(toFraction('', nine)).toBeNull();
    expect(toFraction('abc', nine)).toBeNull();
    expect(toFraction(null, nine)).toBeNull();
    expect(toFraction('4', { type: 'segments', segments: 30 })).toBeNull();
  });
});

describe('fromFraction', () => {
  it('snaps to the nearest step with its raw text', () => {
    expect(fromFraction(0.47, nine)).toEqual({ step: 4, frac: 4 / 9, raw: '4/9' });
    expect(fromFraction(0.375, needle)).toEqual({ step: 3, frac: 0.375, raw: '3/8' });
    expect(fromFraction(0.47, pct)).toEqual({ step: 9, frac: 0.45, raw: '45%' });
    expect(fromFraction(1, pct)).toEqual({ step: 20, frac: 1, raw: '100%' });
    expect(fromFraction(0, nine)).toEqual({ step: 0, frac: 0, raw: '0/9' });
  });
  it('round-trips with toFraction', () => {
    for (let k = 0; k <= 9; k++) {
      const r = fromFraction(k / 9, nine)!;
      expect(r.step).toBe(k);
      expect(toFraction(r.raw, nine)).toBeCloseTo(k / 9, 10);
    }
  });
  it('rejects out-of-range and bad configs', () => {
    expect(fromFraction(1.01, nine)).toBeNull();
    expect(fromFraction(-0.01, nine)).toBeNull();
    expect(fromFraction(NaN, nine)).toBeNull();
    expect(fromFraction(0.5, { type: 'segments', segments: 2 })).toBeNull();
  });
});

describe('eighths backfill', () => {
  it('frac = n/8 and raw "<n>/8"', () => {
    expect(eighthsToFrac(3)).toBe(0.375);
    expect(eighthsToRaw(3)).toBe('3/8');
    expect(eighthsToFrac(0)).toBe(0);
    expect(eighthsToRaw(8)).toBe('8/8');
  });
  it('null for missing or invalid eighths', () => {
    expect(eighthsToFrac(null)).toBeNull();
    expect(eighthsToRaw(undefined)).toBeNull();
    expect(eighthsToFrac(9)).toBeNull();
    expect(eighthsToFrac(2.5)).toBeNull();
  });
});

describe('picker maths', () => {
  it('hitTestSegment clamps to 0..N', () => {
    expect(hitTestSegment(-10, 300, 9)).toBe(0);
    expect(hitTestSegment(400, 300, 9)).toBe(9);
    expect(hitTestSegment(10, 0, 9)).toBeNull();
    expect(hitTestSegment(10, 300, 2)).toBeNull();
  });
  it('snapPercent clamps', () => {
    expect(snapPercent(-3)).toBe(0);
    expect(snapPercent(103)).toBe(100);
    expect(snapPercent(47.5)).toBe(50);
  });
  it('amber at ≤ 2 squares, ≤ 2/8, ≤ 20 %', () => {
    expect(amberThreshold(nine)).toBeCloseTo(2 / 9, 10);
    expect(amberThreshold(needle)).toBe(0.25);
    expect(amberThreshold(pct)).toBe(0.2);
  });
});
