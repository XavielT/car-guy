import { useEffect, useState } from 'react';
import {
  cancelAnimation,
  Easing,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

/**
 * The cluster's motion (ADR-16): one launch "gauge sweep" per cold start, a
 * short lamp test, the vencido blink and the LCD flicker. **Nothing loops
 * idle** — every animation here ends on its own — and reduced motion gets the
 * final state with no movement at all.
 *
 * "Once per cold start" is a module flag, i.e. memory only
 * (`gauge_sweep_done_session` in the data-model spec): it resets when the JS
 * runtime does, which is exactly a cold start, and never needs a write.
 */

let sweptThisSession = false;
let lampTestDone = false;
const listeners = new Set<() => void>();

/** For the tokens page: sweep every mounted cluster again, lamp test included. */
export function replayGaugeSweep(): void {
  sweptThisSession = false;
  lampTestDone = false;
  for (const listener of listeners) listener();
}

function useReplays(): number {
  const [replays, setReplays] = useState(0);
  useEffect(() => {
    const listener = () => setReplays((n) => n + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);
  return replays;
}

const SWEEP_UP_MS = 520;
const SWEEP_DOWN_MS = 620;
const SETTLE_MS = 380;
export const LAMP_TEST_MS = 500;

/**
 * A 0–1 value for a needle: 0 → 1 → `target` on the first mount of the
 * session, then a short ease to each new target.
 */
export function useGaugeSweep(target: number): SharedValue<number> {
  const reduced = useReducedMotion();
  const clamped = Math.max(0, Math.min(1, Number.isFinite(target) ? target : 0));
  const value = useSharedValue(reduced || sweptThisSession ? clamped : 0);
  const replays = useReplays();

  useEffect(() => {
    cancelAnimation(value);
    if (reduced) {
      value.value = clamped;
      return;
    }
    if (!sweptThisSession) {
      sweptThisSession = true;
      value.value = 0;
      value.value = withSequence(
        withTiming(1, { duration: SWEEP_UP_MS, easing: Easing.out(Easing.quad) }),
        withTiming(clamped, { duration: SWEEP_DOWN_MS, easing: Easing.inOut(Easing.cubic) }),
      );
      return;
    }
    value.value = withTiming(clamped, { duration: SETTLE_MS, easing: Easing.out(Easing.cubic) });
  }, [clamped, reduced, value, replays]);

  return value;
}

/**
 * The lamp test: every telltale lit for 500 ms while the needle sweeps, then
 * each goes to its real state. Once per session, like the sweep.
 */
export function useLampTest(): boolean {
  const reduced = useReducedMotion();
  const replays = useReplays();
  const [lit, setLit] = useState(false);

  useEffect(() => {
    if (reduced || lampTestDone) return;
    lampTestDone = true;
    setLit(true);
    const timer = setTimeout(() => setLit(false), LAMP_TEST_MS);
    return () => clearTimeout(timer);
  }, [reduced, replays]);

  return lit;
}

/**
 * Opacity for a vencido lamp: blinks at 1 Hz for 10 s and then stays lit.
 * `active` false, or reduced motion, means steady.
 */
export function useBlink(active: boolean): SharedValue<number> {
  const reduced = useReducedMotion();
  const opacity = useSharedValue(1);

  useEffect(() => {
    cancelAnimation(opacity);
    if (!active || reduced) {
      opacity.value = 1;
      return;
    }
    // One cycle = 1 s (≤ 1 Hz), ten cycles, then it ends lit.
    opacity.value = withDelay(
      LAMP_TEST_MS,
      withRepeat(
        withSequence(withTiming(0.25, { duration: 500 }), withTiming(1, { duration: 500 })),
        10,
        false,
      ),
    );
  }, [active, reduced, opacity]);

  return opacity;
}

/** The LCD's 80 ms flicker when a digit changes. */
export function useFlicker(key: string): SharedValue<number> {
  const reduced = useReducedMotion();
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (reduced) return;
    opacity.value = withSequence(withTiming(0.35, { duration: 40 }), withTiming(1, { duration: 40 }));
  }, [key, reduced, opacity]);

  return opacity;
}
