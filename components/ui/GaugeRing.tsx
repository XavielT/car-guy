import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { useTheme } from '@/lib/theme/useTheme';
import { T } from '../T';

/**
 * The app mark as a progress control: a 270° sweep with the gap at the bottom,
 * used for inspection completion and streaks.
 *
 * Drawn as a stroked circle rather than an arc path so the fill is one dash
 * length — no trigonometry per frame when `animate` sweeps it.
 * The circle is rotated so its 0° (three o'clock) lands at the sweep's start,
 * bottom-left.
 */
const SWEEP = 270;
const GAP_START = 135; // degrees clockwise from +x, i.e. bottom-left

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export function GaugeRing({
  /** 0–1. Values outside are clamped. */
  progress,
  size = 120,
  strokeWidth = 10,
  /** Big number in the middle; omit for a bare ring. */
  value,
  label,
  color,
  animate = false,
}: {
  progress: number;
  size?: number;
  strokeWidth?: number;
  value?: string;
  label?: string;
  color?: string;
  /** Sweep up from empty on mount and on every change — the result screen's moment. */
  animate?: boolean;
}) {
  const { theme } = useTheme();
  const clamped = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const sweepLength = circumference * (SWEEP / 360);

  const stroke = color ?? theme.accent;

  // Reduced motion gets the final state straight away; the ring still says
  // the same thing, it just does not perform it.
  const reduced = useReducedMotion();
  const shown = useSharedValue(animate && !reduced ? 0 : clamped);
  useEffect(() => {
    shown.value = animate && !reduced
      ? withTiming(clamped, { duration: 900, easing: Easing.out(Easing.cubic) })
      : clamped;
  }, [animate, reduced, clamped, shown]);
  const fillProps = useAnimatedProps(() => ({
    strokeDasharray: `${sweepLength * shown.value} ${circumference}`,
  }));

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        {/* Track: the full 270° sweep. */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={theme.line}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${sweepLength} ${circumference}`}
          transform={`rotate(${GAP_START} ${size / 2} ${size / 2})`}
        />
        {/* Fill: the same sweep, cut to progress. */}
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          animatedProps={fillProps}
          transform={`rotate(${GAP_START} ${size / 2} ${size / 2})`}
        />
      </Svg>
      {value || label ? (
        <View style={styles.center} pointerEvents="none">
          {value ? (
            <T face="monoBold" style={[styles.value, { color: theme.text.primary, fontSize: size * 0.24 }]}>
              {value}
            </T>
          ) : null}
          {label ? (
            <T face="body" style={[styles.label, { color: theme.text.secondary }]}>
              {label}
            </T>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: { textAlign: 'center' },
  label: { fontSize: 12, marginTop: 2, textAlign: 'center' },
});
