/**
 * The animated launch's timing (ADR-36, 03-screens.md "Splash overlay"), as
 * pure functions of the elapsed time — so one linear clock drives the needle,
 * the arc, the red segment, the LCD and the fade, they can never drift apart,
 * and the whole thing is testable without a renderer.
 *
 * Every function is a worklet: components/LaunchOverlay.tsx calls them on the
 * UI thread from `useAnimatedProps`. They import nothing, so jest runs them as
 * plain functions.
 *
 * The phases, back to back:
 *   sweep   0 → OVERSHOOT, Easing.out(cubic)  (the needle hits the stop…)
 *   settle  OVERSHOOT → 1                     (…and falls back onto 100)
 *   hold    final frame
 *   fade    opacity 1 → 0, then the overlay unmounts
 *
 * Budget: the spec asks for sweep 700 + settle 120 + hold 200 + fade 250 and
 * "total ≤ 1.2 s", which is 1 270 ms. The motion is what the eye reads, so the
 * sweep, the settle and the fade keep their numbers and the hold gives up 70 ms.
 */

export type LaunchPhase = 'sweep' | 'settle' | 'hold' | 'fade' | 'done';

export const LAUNCH_SWEEP_MS = 700;
export const LAUNCH_SETTLE_MS = 120;
export const LAUNCH_HOLD_MS = 130;
export const LAUNCH_FADE_MS = 250;
/** Hard ceiling for the whole launch (ADR-36). */
export const LAUNCH_BUDGET_MS = 1200;

/** How far past 100 the needle swings before it settles (fraction of the dial). */
export const LAUNCH_OVERSHOOT = 1.035;
/** The red end segment lights when the needle passes this fraction of the dial. */
export const LAUNCH_RED_AT = 0.85;

/** When the hold starts: the needle is at rest on 100 from here on. */
export const LAUNCH_HOLD_START_MS = LAUNCH_SWEEP_MS + LAUNCH_SETTLE_MS;
/** When the fade starts. */
export const LAUNCH_FADE_START_MS = LAUNCH_HOLD_START_MS + LAUNCH_HOLD_MS;
/** The end of the fade: the overlay can unmount. */
export const LAUNCH_TOTAL_MS = LAUNCH_FADE_START_MS + LAUNCH_FADE_MS;

/**
 * Where the clock starts. Reduced motion starts on the final frame — no sweep,
 * just the hold and the fade.
 */
export function launchStartMs(reducedMotion: boolean): number {
  'worklet';
  return reducedMotion ? LAUNCH_HOLD_START_MS : 0;
}

/** How long the launch lasts from its start (what the user waits). */
export function launchDurationMs(reducedMotion: boolean): number {
  'worklet';
  return LAUNCH_TOTAL_MS - launchStartMs(reducedMotion);
}

export function launchPhaseAt(ms: number): LaunchPhase {
  'worklet';
  if (ms < LAUNCH_SWEEP_MS) return 'sweep';
  if (ms < LAUNCH_HOLD_START_MS) return 'settle';
  if (ms < LAUNCH_FADE_START_MS) return 'hold';
  if (ms < LAUNCH_TOTAL_MS) return 'fade';
  return 'done';
}

function clamp01(x: number): number {
  'worklet';
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

/** Easing.out(Easing.cubic), written out so this file needs no Reanimated. */
export function easeOutCubic(x: number): number {
  'worklet';
  const u = 1 - clamp01(x);
  return 1 - u * u * u;
}

function easeInOutQuad(x: number): number {
  'worklet';
  const t = clamp01(x);
  return t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) * (-2 * t + 2)) / 2;
}

/**
 * The needle's position as a fraction of the dial: 0 at rest, up to
 * LAUNCH_OVERSHOOT at the end of the sweep, exactly 1 from the hold on.
 */
export function needleAt(ms: number): number {
  'worklet';
  if (ms <= 0) return 0;
  if (ms < LAUNCH_SWEEP_MS) return LAUNCH_OVERSHOOT * easeOutCubic(ms / LAUNCH_SWEEP_MS);
  if (ms < LAUNCH_HOLD_START_MS) {
    const k = easeInOutQuad((ms - LAUNCH_SWEEP_MS) / LAUNCH_SETTLE_MS);
    return LAUNCH_OVERSHOOT + (1 - LAUNCH_OVERSHOOT) * k;
  }
  return 1;
}

/** The arc fill, 0–1 of the dial: follows the needle, never past the end. */
export function arcAt(ms: number): number {
  'worklet';
  return clamp01(needleAt(ms));
}

/** The LCD reading, an integer 0–100 (the overshoot does not show 103). */
export function lcdAt(ms: number): number {
  'worklet';
  return Math.round(100 * arcAt(ms));
}

/** Whether the red end segment is lit. Once lit it stays lit. */
export function redLitAt(ms: number): boolean {
  'worklet';
  return ms >= LAUNCH_SWEEP_MS || needleAt(ms) >= LAUNCH_RED_AT;
}

/** The first millisecond at which the red segment is lit (for tests and docs). */
export function redLightsAtMs(): number {
  // Inverse of the sweep curve: OVERSHOOT · (1 − (1 − x)³) = RED_AT.
  const x = 1 - Math.cbrt(1 - LAUNCH_RED_AT / LAUNCH_OVERSHOOT);
  return x * LAUNCH_SWEEP_MS;
}

/** The overlay's opacity: 1 until the fade, then linear to 0. */
export function opacityAt(ms: number): number {
  'worklet';
  if (ms <= LAUNCH_FADE_START_MS) return 1;
  return 1 - clamp01((ms - LAUNCH_FADE_START_MS) / LAUNCH_FADE_MS);
}

/**
 * The native splash's `imageWidth` in app.json (dp on Android, pt on iOS): the
 * 1024-px artwork is drawn at this size, centred on the screen, and the
 * overlay draws its identical frame at the same size so the handover cannot
 * jump. 168 ≈ 0.42 × a 400-dp-wide phone (03-screens.md), and keeps every
 * painted pixel inside the 192-dp circle Android 12+ allows an icon without a
 * background (the artwork's farthest pixel is 0.36 × the box from its centre).
 * __tests__/motion/launchSchedule.test.ts checks app.json agrees.
 */
export const SPLASH_IMAGE_WIDTH_DP = 168;
/** On web there is no native splash to match: the box is this share of the shortest side. */
export const SPLASH_WEB_SHORTEST_SIDE = 0.42;
