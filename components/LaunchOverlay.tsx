import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View, type DimensionValue } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, G, Path, Polygon } from 'react-native-svg';

import {
  arcAt,
  LAUNCH_FADE_MS,
  LAUNCH_FADE_START_MS,
  LAUNCH_TOTAL_MS,
  launchStartMs,
  lcdAt,
  needleAt,
  opacityAt,
  redLitAt,
  SPLASH_IMAGE_WIDTH_DP,
  SPLASH_WEB_SHORTEST_SIDE,
} from '@/lib/motion/launchSchedule';

/**
 * The animated launch (IMP 29092026 note 7, ADR-36): the splash gauge comes
 * alive — the needle sweeps 0 → 100, the arc fills behind it, the red end
 * segment lights at 85 %, the LCD counts 000 → 100 — then the overlay fades
 * and unmounts. Timing: lib/motion/launchSchedule.ts (one linear clock; every
 * layer is a pure function of it, on the UI thread).
 *
 * Handover: the native splash (app.json → assets/images/splash-rest.png) is
 * this component's first frame, pixel for pixel — same #121212, same artwork,
 * same box (SPLASH_IMAGE_WIDTH_DP, centred on the window). The root layout
 * mounts this above everything and `onLayout` calls SplashScreen.hide(): the
 * native view goes only after an identical frame is ready under it, so there
 * is no white frame and no double icon. The sweep starts two frames later, so
 * the first frame Android draws is still the rest frame.
 *
 * Geometry — measured from assets/images/splash-icon.png (1024 × 1024, PIL,
 * radial and angular pixel profiles), in that PNG's pixels; angles in degrees
 * clockwise from 3 o'clock (SVG convention):
 *   dial centre      (511.5, 495.5)
 *   arc              centreline r 320, stroke 64 (inner edge r 288, outer r 352),
 *                    from 150° (8 o'clock) through 240° to 30° (4 o'clock), round caps
 *                    — the same 240° dial as components/ui/ClusterHero.tsx
 *   track            #2A2A2A, the whole arc (visible in the PNG only as the
 *                    sliver where the amber's round cap meets the red)
 *   amber fill       #FFB300, 150° → 344.3° (t 0 → 0.810), round cap at both ends
 *   red end segment  #E10600, 350.2° → 30° (t 0.834 → 1), butt start, round end
 *   needle           #FF5F00 kite: tip r 268, tail r −70, half-width 23.5 at the
 *                    hub (18.4 at r 60, 6.1 at r 200); in the PNG it points at 12°
 *   hub              #FFB300 ring r 57 over the needle, #0E0E0E disc r 38
 *   LCD              3 seven-segment digits, #EDEDED with the last in #FF5F00, no
 *                    ghost segments; glyphs x 430–470 / 493–532 / 555–595,
 *                    y 662–748 — components/ui/LcdDigits' segment polygons at
 *                    2.53 px per unit, pitch 62.5 px
 *   unlit red        #58211F (#E10600 at 25 % over the track) — the rest frame only
 *
 * The rest frame (t = 0) is the PNG's artwork with the needle at 150°, the arc
 * empty on its track, the red segment unlit and the LCD at 000;
 * tools/render-splash-rest.py draws the native splash from these same numbers.
 *
 * Reduced motion: the final frame, the hold, the fade. Web: no native splash,
 * the overlay is the PWA's launch screen, sized at 0.42 × the shortest side.
 */

// —— Geometry (1024-unit box) ————————————————————————————————————————
const BOX = 1024;
const CX = 511.5;
const CY = 495.5;
const ARC_R = 320;
const ARC_W = 64;
const START = 150;
const SWEEP = 240;
const AMBER_END_T = (344.3 - START) / SWEEP;
const RED_START_T = (350.2 - START) / SWEEP;
const NEEDLE = '268,0 0,23.5 -70,0 0,-23.5';
/** Half-size of the needle layer: the tip plus a margin. */
const NR = 280;
const HUB_RING_R = 57;
const HUB_R = 38;

const COLOR = {
  bg: '#121212',
  track: '#2A2A2A',
  amber: '#FFB300',
  red: '#E10600',
  redUnlit: '#58211F',
  needle: '#FF5F00',
  hub: '#0E0E0E',
  lcd: '#EDEDED',
} as const;

// LcdDigits' segments (22 × 36 box), placed where the PNG has its digits.
const SEGMENTS: [string, string][] = [
  ['a', '4,1 18,1 15.5,3.5 6.5,3.5'],
  ['b', '19,2 19,17 16.5,15.5 16.5,4.5'],
  ['c', '19,19 19,34 16.5,31.5 16.5,20.5'],
  ['d', '4,35 18,35 15.5,32.5 6.5,32.5'],
  ['e', '3,19 3,34 5.5,31.5 5.5,20.5'],
  ['f', '3,2 3,17 5.5,15.5 5.5,4.5'],
  ['g', '4.5,18 6.5,16.7 15.5,16.7 17.5,18 15.5,19.3 6.5,19.3'],
];
const DIGIT_SEGMENTS = ['abcdef', 'bc', 'abged', 'abgcd', 'fgbc', 'afgcd', 'afgedc', 'abc', 'abcdefg', 'abcdfg'];
const LCD_SCALE = 86 / 34;
const LCD_X0 = 430 - 3 * LCD_SCALE;
const LCD_Y0 = 662 - 1 * LCD_SCALE;
const LCD_PITCH = 62.5;

function polar(t: number): { x: number; y: number } {
  const a = ((START + SWEEP * t) * Math.PI) / 180;
  return { x: CX + ARC_R * Math.cos(a), y: CY + ARC_R * Math.sin(a) };
}
function arcPath(t0: number, t1: number): string {
  const a = polar(t0);
  const b = polar(t1);
  const large = (t1 - t0) * SWEEP > 180 ? 1 : 0;
  return `M ${a.x} ${a.y} A ${ARC_R} ${ARC_R} 0 ${large} 1 ${b.x} ${b.y}`;
}
const TRACK_D = arcPath(0, 1);
const AMBER_D = arcPath(0, AMBER_END_T);
const RED_D = arcPath(RED_START_T, 1);
/** An arc's length is r·θ, so the fill is one dash of the amber path. */
const AMBER_LEN = (ARC_R * SWEEP * AMBER_END_T * Math.PI) / 180;

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedPolygon = Animated.createAnimatedComponent(Polygon);

// —— "The app is ready under it" ——————————————————————————————————————
// The shell calls markLaunchAppReady() once the database opened, so the fade
// reveals Inicio rather than the boot spinner. Capped: a slow open never
// holds the launch longer than APP_READY_CAP_MS past the hold.
const APP_READY_CAP_MS = 1500;
let appReady = false;
const appReadyWaiters = new Set<() => void>();

export function markLaunchAppReady(): void {
  if (appReady) return;
  appReady = true;
  for (const wake of appReadyWaiters) wake();
  appReadyWaiters.clear();
}

function whenAppReady(cb: () => void): () => void {
  if (appReady) {
    cb();
    return () => {};
  }
  let fired = false;
  const once = () => {
    if (fired) return;
    fired = true;
    appReadyWaiters.delete(once);
    clearTimeout(timer);
    cb();
  };
  const timer = setTimeout(once, APP_READY_CAP_MS);
  appReadyWaiters.add(once);
  return () => {
    fired = true;
    appReadyWaiters.delete(once);
    clearTimeout(timer);
  };
}

let ranThisProcess = false;

/** True once an overlay mounted in this JS context: later roots skip it. */
export function launchAlreadyRan(): boolean {
  return ranThisProcess;
}

/**
 * Whatever happens (fonts that never load, a frame callback that never comes),
 * the overlay is gone after this: a stuck launch frame over a working app is
 * worse than no animation.
 */
export const LAUNCH_SAFETY_MS = 4000;

/** `onDone` should be stable (useCallback): a new one restarts the fade wait. */
export function LaunchOverlay({ ready, onDone }: { ready: boolean; onDone: () => void }) {
  useEffect(() => {
    ranThisProcess = true;
    const t = setTimeout(onDone, LAUNCH_SAFETY_MS);
    return () => clearTimeout(t);
  }, [onDone]);
  const reduced = useReducedMotion();
  // Always the rest frame on the first render: it is what the native splash
  // shows, and on web it is what the static HTML was rendered with.
  const clock = useSharedValue(0);
  const [laidOut, setLaidOut] = useState(false);
  const [held, setHeld] = useState(false);

  // Sweep (or, with reduced motion, jump to the final frame) up to the fade.
  useEffect(() => {
    if (!ready || !laidOut) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    // Two frames: the first frame Android draws after hide() is the rest frame.
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        const start = launchStartMs(reduced);
        const span = LAUNCH_FADE_START_MS - start;
        clock.value = start;
        // ReduceMotion.Never: under reduced motion this span is only the (still)
        // hold, and Reanimated would otherwise skip it and the fade.
        clock.value = withTiming(LAUNCH_FADE_START_MS, {
          duration: span,
          easing: Easing.linear,
          reduceMotion: ReduceMotion.Never,
        });
        timer = setTimeout(() => setHeld(true), span);
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      if (timer) clearTimeout(timer);
    };
  }, [ready, laidOut, reduced, clock]);

  // Fade once the hold is over and the app is there to be revealed.
  useEffect(() => {
    if (!held) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const cancel = whenAppReady(() => {
      // A fade is not motion: it runs under reduced motion too.
      clock.value = withTiming(LAUNCH_TOTAL_MS, {
        duration: LAUNCH_FADE_MS,
        easing: Easing.linear,
        reduceMotion: ReduceMotion.Never,
      });
      timer = setTimeout(onDone, LAUNCH_FADE_MS);
    });
    return () => {
      cancel();
      if (timer) clearTimeout(timer);
    };
  }, [held, clock, onDone]);

  const fadeStyle = useAnimatedStyle(() => ({ opacity: opacityAt(clock.value) }));
  const needleStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${START + SWEEP * needleAt(clock.value)}deg` }],
  }));
  const amberProps = useAnimatedProps(() => {
    const fill = Math.min(1, arcAt(clock.value) / AMBER_END_T);
    return {
      strokeDasharray: `${Math.max(0.001, AMBER_LEN * fill)} ${AMBER_LEN * 2}`,
      // A zero-length dash still draws its round cap: hide it at rest.
      strokeOpacity: fill > 0.001 ? 1 : 0,
    };
  });
  const redProps = useAnimatedProps(() => ({ strokeOpacity: redLitAt(clock.value) ? 1 : 0 }));

  // Native: the splash's own box. Web: 0.42 × the shortest side, in CSS, so the
  // server-rendered HTML and the first client render are the same markup.
  const box: DimensionValue =
    Platform.OS === 'web'
      ? (`${SPLASH_WEB_SHORTEST_SIDE * 100}vmin` as DimensionValue)
      : SPLASH_IMAGE_WIDTH_DP;

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.root, fadeStyle]}
      onLayout={() => {
        SplashScreen.hide();
        setLaidOut(true);
      }}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      aria-hidden>
      <View style={{ width: box, height: box }}>
        <Svg width="100%" height="100%" viewBox={`0 0 ${BOX} ${BOX}`}>
          <Path d={TRACK_D} stroke={COLOR.track} strokeWidth={ARC_W} strokeLinecap="round" fill="none" />
          <Path d={RED_D} stroke={COLOR.redUnlit} strokeWidth={ARC_W} strokeLinecap="round" fill="none" />
          <AnimatedPath
            d={RED_D}
            stroke={COLOR.red}
            strokeWidth={ARC_W}
            strokeLinecap="round"
            fill="none"
            strokeOpacity={0}
            animatedProps={redProps}
          />
          <AnimatedPath
            d={AMBER_D}
            stroke={COLOR.amber}
            strokeWidth={ARC_W}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`0.001 ${AMBER_LEN * 2}`}
            strokeOpacity={0}
            animatedProps={amberProps}
          />
          {[0, 1, 2].map((pos) => (
            <G key={pos} transform={`translate(${LCD_X0 + pos * LCD_PITCH} ${LCD_Y0}) scale(${LCD_SCALE})`}>
              {SEGMENTS.map(([seg, points]) => (
                <LcdSegment
                  key={seg}
                  clock={clock}
                  pos={pos}
                  seg={seg}
                  points={points}
                  color={pos === 2 ? COLOR.needle : COLOR.lcd}
                />
              ))}
            </G>
          ))}
        </Svg>
        <Animated.View style={[styles.needle, needleStyle]}>
          <Svg width="100%" height="100%" viewBox={`${-NR} ${-NR} ${2 * NR} ${2 * NR}`}>
            <Polygon points={NEEDLE} fill={COLOR.needle} />
            {/* The hub is round, so it can turn with the needle and stay on top of it. */}
            <Circle cx={0} cy={0} r={HUB_RING_R} fill={COLOR.amber} />
            <Circle cx={0} cy={0} r={HUB_R} fill={COLOR.hub} />
          </Svg>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

/** One segment of one LCD digit, lit from the clock on the UI thread. */
function LcdSegment({
  clock,
  pos,
  seg,
  points,
  color,
}: {
  clock: SharedValue<number>;
  pos: number;
  seg: string;
  points: string;
  color: string;
}) {
  // At rest the LCD reads 000.
  const litAtRest = DIGIT_SEGMENTS[0].includes(seg);
  const props = useAnimatedProps(() => {
    const value = lcdAt(clock.value);
    const digit = pos === 0 ? Math.floor(value / 100) % 10 : pos === 1 ? Math.floor(value / 10) % 10 : value % 10;
    return { fillOpacity: DIGIT_SEGMENTS[digit].indexOf(seg) >= 0 ? 1 : 0 };
  });
  return <AnimatedPolygon points={points} fill={color} fillOpacity={litAtRest ? 1 : 0} animatedProps={props} />;
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: COLOR.bg,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    elevation: 1000,
  },
  needle: {
    position: 'absolute',
    left: `${((CX - NR) / BOX) * 100}%`,
    top: `${((CY - NR) / BOX) * 100}%`,
    width: `${((2 * NR) / BOX) * 100}%`,
    height: `${((2 * NR) / BOX) * 100}%`,
  },
});
