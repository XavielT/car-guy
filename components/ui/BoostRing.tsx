import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Line, Text as SvgText } from 'react-native-svg';

import { fonts } from '@/constants/theme';
import { useTheme } from '@/lib/theme/useTheme';
import { T } from '../T';

/**
 * A boost gauge (05-design-jdm.md §3) — the re-skin of GaugeRing, same API:
 * a 270° ring with the gap at the bottom, 0/25/50/75/100 around it, the value
 * in Michroma and a label under the hub ("CHEQUEO").
 *
 * Amber only, by default: completion is not dangerous, so no redline gradient
 * here (anti-pattern: "redline gradient on non-dangerous metrics"). A caller
 * can still pass `color` when the ring reports a verdict, and `peak` for a red
 * peak-hold tick.
 *
 * Drawn as a stroked circle so the fill is one dash length — no trigonometry
 * per frame while `animate` sweeps it.
 */
const SWEEP = 270;
const GAP_START = 135; // degrees clockwise from +x, i.e. bottom-left

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export function BoostRing({
  progress,
  size = 120,
  strokeWidth,
  value,
  label,
  color,
  animate = false,
  peak,
  scale,
}: {
  /** 0–1. Values outside are clamped. */
  progress: number;
  size?: number;
  strokeWidth?: number;
  value?: string;
  label?: string;
  color?: string;
  /** Sweep up from empty on mount and on every change. */
  animate?: boolean;
  /** 0–1: a red peak-hold tick. */
  peak?: number;
  /** Show 0/25/50/75/100. Defaults to on from 100 px up. */
  scale?: boolean;
}) {
  const { theme } = useTheme();
  const clamped = clamp(progress);
  const stroke = strokeWidth ?? Math.max(6, Math.round(size * 0.1));
  const showScale = scale ?? size >= 100;

  const r = (size - stroke) / 2 - (showScale ? size * 0.09 : 0);
  const c = size / 2;
  const circumference = 2 * Math.PI * r;
  const sweepLength = circumference * (SWEEP / 360);
  const fill = color ?? theme.accentFill;

  // Reduced motion gets the final state straight away.
  const reduced = useReducedMotion();
  const shown = useSharedValue(animate && !reduced ? 0 : clamped);
  useEffect(() => {
    shown.value =
      animate && !reduced ? withTiming(clamped, { duration: 900, easing: Easing.out(Easing.cubic) }) : clamped;
  }, [animate, reduced, clamped, shown]);
  const fillProps = useAnimatedProps(() => ({
    strokeDasharray: `${sweepLength * shown.value} ${circumference}`,
  }));

  const polar = (t: number, radiusAt: number) => {
    const a = ((GAP_START + SWEEP * t) * Math.PI) / 180;
    return { x: c + radiusAt * Math.cos(a), y: c + radiusAt * Math.sin(a) };
  };

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle
          cx={c}
          cy={c}
          r={r}
          stroke={theme.lineStrong}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${sweepLength} ${circumference}`}
          transform={`rotate(${GAP_START} ${c} ${c})`}
        />
        <AnimatedCircle
          cx={c}
          cy={c}
          r={r}
          stroke={fill}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          animatedProps={fillProps}
          transform={`rotate(${GAP_START} ${c} ${c})`}
        />
        {showScale
          ? [0, 25, 50, 75, 100].map((n) => {
              const p = polar(n / 100, r + stroke / 2 + size * 0.06);
              return (
                <SvgText
                  key={n}
                  x={p.x}
                  y={p.y + size * 0.03}
                  fontSize={size * 0.075}
                  fontFamily={fonts.title}
                  fill={theme.text.muted}
                  textAnchor="middle">
                  {String(n)}
                </SvgText>
              );
            })
          : null}
        {peak != null
          ? (() => {
              const a = polar(clamp(peak), r - stroke / 2 - 2);
              const b = polar(clamp(peak), r + stroke / 2 + 2);
              return <Line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={theme.redline} strokeWidth={3} />;
            })()
          : null}
      </Svg>
      {value || label ? (
        <View style={styles.center} pointerEvents="none">
          {value ? (
            <T face="badge" style={[styles.value, { color: theme.text.primary, fontSize: size * 0.16 }]}>
              {value}
            </T>
          ) : null}
          {label ? (
            <T face="eyebrow" style={[styles.label, { color: theme.text.secondary, fontSize: Math.max(10, size * 0.08) }]}>
              {label}
            </T>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const clamp = (n: number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));

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
  value: { textAlign: 'center', letterSpacing: 0 },
  label: { marginTop: 4, textAlign: 'center' },
});
