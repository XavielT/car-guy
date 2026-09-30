import { useIsFocused } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { StyleSheet, View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { radius, space } from '@/constants/theme';
import { t } from '@/lib/i18n';
import { useTheme } from '@/lib/theme/useTheme';

/**
 * Skeletons (IMP 30092026 note 4, ADR-40): the outline of a screen while its
 * data loads, in the theme's raised tone.
 *
 * One clock per skeleton root, shared by every block through context, so the
 * blocks sweep in step and a screen runs one animation loop, not twenty. The
 * loop is the design system's one loader exception to "no idle animation": it
 * exists only while a skeleton is mounted, only on the focused screen (a
 * stacked screen underneath stays still — ADR-40 perf rule), and not at all
 * under reduced motion, where blocks are a static tone.
 *
 * Every screen has a twin `<Name>Skeleton` built from these blocks with the
 * screen's own paddings and card heights, shown through useDelayedLoading so
 * a fast local read never flashes it (hooks/useDelayedLoading.ts).
 */

const Clock = createContext<SharedValue<number> | null>(null);

const SWEEP_MS = 1200;

/** The root of a screen's skeleton: accessibility, the shared clock, and the screen padding. */
export function Skeleton({ children, style, padded = true }: { children: ReactNode; style?: StyleProp<ViewStyle>; padded?: boolean }) {
  const { theme } = useTheme();
  const reduced = useReducedMotion();
  const focused = useIsFocused();
  const clock = useSharedValue(0);

  useEffect(() => {
    if (reduced || !focused) {
      cancelAnimation(clock);
      return;
    }
    clock.value = 0;
    clock.value = withRepeat(withTiming(1, { duration: SWEEP_MS, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(clock);
  }, [clock, reduced, focused]);

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={t.common.loading}
      accessibilityState={{ busy: true }}
      aria-busy
      style={[{ flex: 1, backgroundColor: theme.bg.base }, padded && styles.pad, style]}>
      <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={{ flex: 1 }}>
        <Clock.Provider value={reduced ? null : clock}>{children}</Clock.Provider>
      </View>
    </View>
  );
}

type BlockProps = { w?: DimensionValue; h: number; r?: number; style?: StyleProp<ViewStyle> };

/** A rounded block. The building brick of every twin. */
function Rect({ w = '100%', h, r = radius.tag, style }: BlockProps) {
  const { theme, scheme } = useTheme();
  const clock = useContext(Clock);
  const width = useSharedValue(0);
  const band = useAnimatedStyle(() => {
    if (!clock) return { opacity: 0 };
    const x = interpolate(clock.value, [0, 1], [-width.value, width.value]);
    return { opacity: 1, transform: [{ translateX: x }] };
  });
  const shine = scheme === 'dark' ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.65)';
  return (
    <View
      onLayout={(e) => {
        width.set(e.nativeEvent.layout.width);
      }}
      style={[{ width: w, height: h, borderRadius: r, backgroundColor: theme.bg.raised, overflow: 'hidden' }, style]}>
      <Animated.View style={[StyleSheet.absoluteFill, band]} pointerEvents="none">
        <LinearGradient colors={['transparent', shine, 'transparent']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
      </Animated.View>
    </View>
  );
}

function Circle({ size, style }: { size: number; style?: StyleProp<ViewStyle> }) {
  return <Rect w={size} h={size} r={size / 2} style={style} />;
}

/** Text lines: `n` bars, the last one shorter, at a body line height. */
function Lines({ n = 3, lastWidth = '60%', lineHeight = 14, gap = 8, style }: { n?: number; lastWidth?: DimensionValue; lineHeight?: number; gap?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ gap }, style]}>
      {Array.from({ length: n }, (_, i) => (
        <Rect key={i} h={lineHeight} w={i === n - 1 && n > 1 ? lastWidth : '100%'} r={radius.lamp} />
      ))}
    </View>
  );
}

/** A card outline: the Surface's radius and a height. Children lay out inside it. */
function Card({ h, children, style }: { h?: number; children?: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { theme } = useTheme();
  if (!children) return <Rect h={h ?? 96} r={radius.card} style={[{ marginBottom: space.md }, style]} />;
  return (
    <View style={[{ borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.line, padding: space.md, marginBottom: space.md, minHeight: h, gap: space.sm }, style]}>
      {children}
    </View>
  );
}

/** A list row: optional leading circle, two lines, optional trailing amount. */
function Row({ leading = true, trailing = true }: { leading?: boolean; trailing?: boolean }) {
  return (
    <View style={styles.row}>
      {leading ? <Circle size={36} /> : null}
      <View style={{ flex: 1, gap: 6 }}>
        <Rect h={14} w="70%" />
        <Rect h={12} w="45%" />
      </View>
      {trailing ? <Rect h={14} w={64} /> : null}
    </View>
  );
}

/** A screen title block: eyebrow + big title, the ScreenTitle's footprint. */
function Title() {
  return (
    <View style={{ gap: 8, marginBottom: space.lg }}>
      <Rect h={10} w={90} />
      <Rect h={28} w="55%" />
    </View>
  );
}

/** A row of KPI tiles. */
function Tiles({ n = 2, h = 72 }: { n?: number; h?: number }) {
  return (
    <View style={[styles.tiles, { marginBottom: space.md }]}>
      {Array.from({ length: n }, (_, i) => (
        <Rect key={i} h={h} r={radius.card} style={{ flex: 1 }} />
      ))}
    </View>
  );
}

/** Field outlines for a form that loads its initial values. */
function Fields({ n = 4 }: { n?: number }) {
  return (
    <View style={{ gap: space.md }}>
      {Array.from({ length: n }, (_, i) => (
        <View key={i} style={{ gap: 6 }}>
          <Rect h={10} w={80} />
          <Rect h={48} r={radius.input} />
        </View>
      ))}
    </View>
  );
}

Skeleton.Rect = Rect;
Skeleton.Circle = Circle;
Skeleton.Lines = Lines;
Skeleton.Card = Card;
Skeleton.Row = Row;
Skeleton.Title = Title;
Skeleton.Tiles = Tiles;
Skeleton.Fields = Fields;

/** The generic twins, for the many list and detail screens that share a shape. */
export function ListSkeleton({ rows = 8, title = true }: { rows?: number; title?: boolean }) {
  return (
    <Skeleton>
      {title ? <Skeleton.Title /> : null}
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton.Row key={i} />
      ))}
    </Skeleton>
  );
}

export function DetailSkeleton() {
  return (
    <Skeleton>
      <Skeleton.Title />
      <Skeleton.Tiles n={2} />
      <Skeleton.Card>
        <Skeleton.Lines n={4} />
      </Skeleton.Card>
      <Skeleton.Card h={120} />
    </Skeleton>
  );
}

export function FormSkeleton({ fields = 5 }: { fields?: number }) {
  return (
    <Skeleton>
      <Skeleton.Title />
      <Skeleton.Fields n={fields} />
    </Skeleton>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: space.gutter, paddingTop: space.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm, marginBottom: space.xs },
  tiles: { flexDirection: 'row', gap: space.md },
});
