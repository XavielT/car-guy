import {
  arcAt,
  easeOutCubic,
  LAUNCH_BUDGET_MS,
  LAUNCH_FADE_MS,
  LAUNCH_FADE_START_MS,
  LAUNCH_HOLD_START_MS,
  LAUNCH_OVERSHOOT,
  LAUNCH_RED_AT,
  LAUNCH_SETTLE_MS,
  LAUNCH_SWEEP_MS,
  LAUNCH_TOTAL_MS,
  launchDurationMs,
  launchPhaseAt,
  launchStartMs,
  lcdAt,
  needleAt,
  opacityAt,
  redLightsAtMs,
  redLitAt,
  SPLASH_IMAGE_WIDTH_DP,
} from '@/lib/motion/launchSchedule';

describe('launch schedule (ADR-36)', () => {
  it('keeps the spec numbers for the motion and stays inside 1.2 s', () => {
    expect(LAUNCH_SWEEP_MS).toBe(700);
    expect(LAUNCH_SETTLE_MS).toBe(120);
    expect(LAUNCH_FADE_MS).toBe(250);
    expect(LAUNCH_TOTAL_MS).toBeLessThanOrEqual(LAUNCH_BUDGET_MS);
    expect(LAUNCH_BUDGET_MS).toBe(1200);
    expect(launchDurationMs(false)).toBe(LAUNCH_TOTAL_MS);
  });

  it('runs the phases in order', () => {
    expect(launchPhaseAt(0)).toBe('sweep');
    expect(launchPhaseAt(LAUNCH_SWEEP_MS - 1)).toBe('sweep');
    expect(launchPhaseAt(LAUNCH_SWEEP_MS)).toBe('settle');
    expect(launchPhaseAt(LAUNCH_HOLD_START_MS)).toBe('hold');
    expect(launchPhaseAt(LAUNCH_FADE_START_MS)).toBe('fade');
    expect(launchPhaseAt(LAUNCH_TOTAL_MS)).toBe('done');
  });

  it('starts at rest — the frame the native splash shows', () => {
    expect(needleAt(0)).toBe(0);
    expect(arcAt(0)).toBe(0);
    expect(lcdAt(0)).toBe(0);
    expect(redLitAt(0)).toBe(false);
    expect(opacityAt(0)).toBe(1);
  });

  it('sweeps with Easing.out(cubic), overshoots, then settles on exactly 100', () => {
    const half = LAUNCH_SWEEP_MS / 2;
    expect(needleAt(half)).toBeCloseTo(LAUNCH_OVERSHOOT * (1 - 0.5 ** 3), 6);
    expect(easeOutCubic(0.5)).toBeCloseTo(0.875, 6);
    // Fast first: more than half the dial in the first quarter of the sweep.
    expect(needleAt(LAUNCH_SWEEP_MS / 4)).toBeGreaterThan(0.5);
    expect(needleAt(LAUNCH_SWEEP_MS)).toBeCloseTo(LAUNCH_OVERSHOOT, 6);
    expect(needleAt(LAUNCH_HOLD_START_MS)).toBe(1);
    expect(needleAt(LAUNCH_TOTAL_MS)).toBe(1);
  });

  it('never moves backwards during the sweep', () => {
    let prev = -1;
    for (let t = 0; t <= LAUNCH_SWEEP_MS; t += 5) {
      const v = needleAt(t);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });

  it('keeps the arc and the LCD in step with the needle, capped at 100', () => {
    for (let t = 0; t <= LAUNCH_TOTAL_MS; t += 10) {
      expect(arcAt(t)).toBe(Math.min(1, needleAt(t)));
      expect(lcdAt(t)).toBe(Math.round(100 * arcAt(t)));
      expect(lcdAt(t)).toBeLessThanOrEqual(100);
    }
    expect(lcdAt(LAUNCH_SWEEP_MS)).toBe(100);
    expect(lcdAt(LAUNCH_FADE_START_MS)).toBe(100);
  });

  it('lights the red segment at 85 % and keeps it lit', () => {
    const at = redLightsAtMs();
    expect(at).toBeGreaterThan(0);
    expect(at).toBeLessThan(LAUNCH_SWEEP_MS);
    expect(needleAt(at)).toBeCloseTo(LAUNCH_RED_AT, 6);
    expect(redLitAt(at - 2)).toBe(false);
    expect(redLitAt(at + 1)).toBe(true);
    for (let t = at + 1; t <= LAUNCH_TOTAL_MS; t += 10) expect(redLitAt(t)).toBe(true);
  });

  it('fades linearly over the last 250 ms', () => {
    expect(opacityAt(LAUNCH_FADE_START_MS)).toBe(1);
    expect(opacityAt(LAUNCH_FADE_START_MS + LAUNCH_FADE_MS / 2)).toBeCloseTo(0.5, 6);
    expect(opacityAt(LAUNCH_TOTAL_MS)).toBe(0);
    expect(opacityAt(LAUNCH_TOTAL_MS + 100)).toBe(0);
  });

  it('reduced motion: final frame, then only the hold and the fade', () => {
    const start = launchStartMs(true);
    expect(needleAt(start)).toBe(1);
    expect(lcdAt(start)).toBe(100);
    expect(redLitAt(start)).toBe(true);
    expect(launchDurationMs(true)).toBe(LAUNCH_TOTAL_MS - LAUNCH_HOLD_START_MS);
    expect(launchStartMs(false)).toBe(0);
  });
});

describe('native splash handover', () => {
  it('app.json draws the splash artwork at the size the overlay matches', () => {
    const app = require('../../app.json') as { expo: { plugins: unknown[] } };
    const splash = app.expo.plugins.find((p) => Array.isArray(p) && p[0] === 'expo-splash-screen') as
      | [string, { imageWidth?: number; backgroundColor?: string; image?: string }]
      | undefined;
    expect(splash?.[1].imageWidth).toBe(SPLASH_IMAGE_WIDTH_DP);
    expect(splash?.[1].backgroundColor).toBe('#121212');
    expect(splash?.[1].image).toBe('./assets/images/splash-rest.png');
  });
});
