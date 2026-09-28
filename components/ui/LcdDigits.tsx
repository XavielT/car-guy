import { View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import Svg, { G, Polygon } from 'react-native-svg';

import { useFlicker } from '@/lib/motion/gaugeSweep';
import { useTheme } from '@/lib/theme/useTheme';

/**
 * An LCD odometer: 7-segment digits with the unlit segments still faintly
 * there (8 %), the way a real cluster's glass shows them.
 *
 * Each digit is a fixed 22×36 box, so columns never shift — Saira Condensed
 * has no tabular figures, and a proportional odometer that jumps as it counts
 * reads as broken. The last digit is in the needle colour, a nod to the AE86's
 * red tenths drum. A value change flickers the display for 80 ms.
 */

// Segment order: a (top), b (top right), c (bottom right), d (bottom), e (bottom left), f (top left), g (middle).
const SEGMENTS: Record<string, string> = {
  a: '4,1 18,1 15.5,3.5 6.5,3.5',
  b: '19,2 19,17 16.5,15.5 16.5,4.5',
  c: '19,19 19,34 16.5,31.5 16.5,20.5',
  d: '4,35 18,35 15.5,32.5 6.5,32.5',
  e: '3,19 3,34 5.5,31.5 5.5,20.5',
  f: '3,2 3,17 5.5,15.5 5.5,4.5',
  g: '4.5,18 6.5,16.7 15.5,16.7 17.5,18 15.5,19.3 6.5,19.3',
};

const DIGITS: Record<string, string> = {
  '0': 'abcdef',
  '1': 'bc',
  '2': 'abged',
  '3': 'abgcd',
  '4': 'fgbc',
  '5': 'afgcd',
  '6': 'afgedc',
  '7': 'abc',
  '8': 'abcdefg',
  '9': 'abcdfg',
  '-': 'g',
  ' ': '',
};

const BOX_W = 22;
const BOX_H = 36;
/** Extra space every three digits from the right, like a thousands gap. */
const GROUP_GAP = 6;

export function LcdDigits({
  value,
  minDigits = 6,
  height = 36,
  color,
  lastColor,
  ghost = 0.08,
  accessibilityLabel,
}: {
  /** A non-negative integer, or null for dashes. */
  value: number | null;
  minDigits?: number;
  /** Rendered digit height; width follows the 22:36 box. */
  height?: number;
  color?: string;
  lastColor?: string;
  ghost?: number;
  accessibilityLabel?: string;
}) {
  const { theme } = useTheme();
  const text =
    value == null || !Number.isFinite(value)
      ? '-'.repeat(minDigits)
      : String(Math.max(0, Math.round(value))).padStart(minDigits, '0');

  const flicker = useFlicker(text);
  const style = useAnimatedStyle(() => ({ opacity: flicker.value }));

  const on = color ?? theme.text.primary;
  const last = lastColor ?? theme.needle;
  const chars = text.split('');
  const gaps = Math.floor((chars.length - 1) / 3);
  const width = chars.length * BOX_W + gaps * GROUP_GAP;

  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel ?? (value == null ? '—' : String(Math.round(value)))}>
      <Animated.View style={style}>
        <Svg width={(width * height) / BOX_H} height={height} viewBox={`0 0 ${width} ${BOX_H}`}>
          {chars.map((char, i) => {
            const fromRight = chars.length - 1 - i;
            const x = i * BOX_W + (gaps - Math.floor(fromRight / 3)) * GROUP_GAP;
            const lit = DIGITS[char] ?? '';
            const fill = i === chars.length - 1 ? last : on;
            return (
              <G key={i} x={x}>
                {Object.entries(SEGMENTS).map(([seg, points]) => (
                  <Polygon
                    key={seg}
                    points={points}
                    fill={lit.includes(seg) ? fill : on}
                    opacity={lit.includes(seg) ? 1 : ghost}
                  />
                ))}
              </G>
            );
          })}
        </Svg>
      </Animated.View>
    </View>
  );
}
