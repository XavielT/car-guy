import { useId, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedProps, useAnimatedStyle } from 'react-native-reanimated';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Polygon, Stop, Text as SvgText } from 'react-native-svg';

import { fonts, palette, radius, space } from '@/constants/theme';
import type { ClusterReading } from '@/lib/domain/cluster';
import { km as formatKm } from '@/lib/format';
import { t } from '@/lib/i18n';
import { useGaugeSweep } from '@/lib/motion/gaugeSweep';
import { T } from '../T';
import { LcdDigits } from './LcdDigits';

/**
 * The home screen's instrument (05-design-jdm.md §1): a 240° tach, 8 to 4
 * o'clock (the spec says "7 → 5", which is 300°; the mockup's arc is ~230° and
 * symmetric, so 240° it is), a progress arc on the gauge gradient, a solid red wedge over the last
 * 10 %, a tapered needle, and the odometer as an LCD in the gap at the bottom.
 *
 * What the needle means: how much of the interval to the nearest due service
 * is used up (lib/domain/cluster.ts) — so "in the red" means exactly what it
 * does on a real tach. Always a dark panel, in light mode too: it is an
 * instrument, not a card.
 *
 * Performance: one SVG for the dial, drawn once per reading; the needle is a
 * separate layer whose rotation is the only thing Reanimated animates.
 */

const START = 150; // 8 o'clock, degrees clockwise from 3 o'clock
const SWEEP = 240;
const REDLINE_FROM = 0.9;
const MAJORS = 6;
const DIAL = ['0', '2', '4', '6', '8', '10'];

const AnimatedPath = Animated.createAnimatedComponent(Path);
const ink = palette.dark;

export function ClusterHero({
  odometerKm,
  reading,
  caption,
  size = 300,
  onPress,
  onPressOdometer,
  header,
  children,
}: {
  odometerKm: number | null;
  reading: ClusterReading | null;
  /** A line under the LCD, e.g. "Actualizado hoy". */
  caption?: string;
  size?: number;
  /** The dial → reminders. */
  onPress?: () => void;
  /** The LCD → update the odometer. */
  onPressOdometer?: () => void;
  header?: ReactNode;
  /** Under the dial: the telltale row, pills. */
  children?: ReactNode;
}) {
  // One gradient id per dial: with two clusters on a page, a shared id makes
  // url(#…) resolve to the other one's element and the arc vanishes on web.
  const gradientId = `gauge-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const stroke = Math.round(size * 0.045);
  const r = size / 2 - stroke - 4;
  const cx = size / 2;
  const cy = size / 2;
  // An arc's length is exactly r·θ, so the progress is one dash of that path.
  const sweepLen = (r * SWEEP * Math.PI) / 180;

  const progress = useGaugeSweep(reading?.progress ?? 0);
  const fillProps = useAnimatedProps(() => ({
    strokeDasharray: `${Math.max(0.001, sweepLen * progress.value)} ${sweepLen * 2}`,
  }));
  const needleStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${START + SWEEP * progress.value}deg` }],
  }));

  const polar = (t: number, radiusAt: number) => {
    const a = ((START + SWEEP * t) * Math.PI) / 180;
    return { x: cx + radiusAt * Math.cos(a), y: cy + radiusAt * Math.sin(a) };
  };
  /** The dial's arc from t0 to t1 (0–1 of the sweep), as a path — never rotated,
   *  so the gradient's left-to-right is the dial's low-to-high. */
  const arc = (t0: number, t1: number) => {
    const a = polar(t0, r);
    const b = polar(t1, r);
    const large = (t1 - t0) * SWEEP > 180 ? 1 : 0;
    return `M ${a.x} ${a.y} A ${r} ${r} 0 ${large} 1 ${b.x} ${b.y}`;
  };

  const ticks = [];
  for (let i = 0; i <= (MAJORS - 1) * 2; i++) {
    const t = i / ((MAJORS - 1) * 2);
    const major = i % 2 === 0;
    const a = polar(t, r - stroke / 2 - 4);
    const b = polar(t, r - stroke / 2 - (major ? 16 : 9));
    ticks.push(
      <Line
        key={i}
        x1={a.x}
        y1={a.y}
        x2={b.x}
        y2={b.y}
        stroke={t >= REDLINE_FROM ? ink.redline : ink.text.secondary}
        strokeWidth={major ? 2.5 : 1.5}
        strokeLinecap="round"
      />,
    );
  }

  const numerals = DIAL.map((label, i) => {
    const t = i / (MAJORS - 1);
    const p = polar(t, r - stroke / 2 - 30);
    return (
      <SvgText
        key={label}
        x={p.x}
        y={p.y + size * 0.022}
        fontSize={size * 0.062}
        fontFamily={fonts.title}
        fill={t >= REDLINE_FROM ? ink.redlineText : ink.text.primary}
        textAnchor="middle">
        {label}
      </SvgText>
    );
  });

  const nextLine = reading ? nextText(reading) : t.cluster.nothingDue;
  const needleLen = r - stroke / 2 - 6;
  const hub = size * 0.05;

  return (
    <View style={[styles.card, { backgroundColor: ink.bg.surface, borderColor: ink.lineStrong }]}>
      {header}
      <View style={{ width: size, height: size * 0.9, alignSelf: 'center' }}>
        {/* The dial and the LCD are sibling buttons: nesting them is invalid HTML on web. */}
        <Pressable
          onPress={onPress}
          disabled={!onPress}
          accessibilityRole={onPress ? 'button' : undefined}
          accessibilityLabel={t.cluster.a11y(odometerKm == null ? '—' : formatKm(odometerKm), nextLine)}
          style={StyleSheet.absoluteFill}
        />
        <Svg width={size} height={size} pointerEvents="none">
          <Defs>
            {/* Bottom-left → top-right, as in the mockup; user space so it ignores the dash. */}
            <LinearGradient id={gradientId} gradientUnits="userSpaceOnUse" x1={cx - r} y1={cy + r * 0.5} x2={cx + r} y2={cy - r * 0.3}>
              {ink.gaugeGradient.map((stop) => (
                <Stop key={stop.offset} offset={stop.offset} stopColor={stop.color} />
              ))}
            </LinearGradient>
          </Defs>
          {/* Track */}
          <Path d={arc(0, 1)} stroke={ink.lineStrong} strokeWidth={stroke} fill="none" />
          {/* Progress */}
          <AnimatedPath d={arc(0, 1)} stroke={`url(#${gradientId})`} strokeWidth={stroke} fill="none" animatedProps={fillProps} />
          {/* The redline wedge: always there, like on a tach. */}
          <Path d={arc(REDLINE_FROM, 1)} stroke={ink.redline} strokeWidth={stroke} fill="none" />
          {ticks}
          {numerals}
        </Svg>

        {/* Needle: its own layer, so a new reading re-renders nothing else. */}
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { width: size, height: size }, needleStyle]}>
          <Svg width={size} height={size}>
            <Polygon
              points={`${cx - hub * 0.6},${cy - 3.2} ${cx + needleLen},${cy - 0.8} ${cx + needleLen},${cy + 0.8} ${cx - hub * 0.6},${cy + 3.2}`}
              fill={ink.needle}
            />
          </Svg>
        </Animated.View>
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { width: size, height: size }]}>
          <Svg width={size} height={size}>
            <Circle cx={cx} cy={cy} r={hub} fill={ink.bg.well} stroke={ink.accent} strokeWidth={2} />
          </Svg>
        </View>

        <View style={[styles.lcdWrap, { top: cy + size * 0.12 }]} pointerEvents="box-none">
          <Pressable
            onPress={onPressOdometer}
            disabled={!onPressOdometer}
            accessibilityRole={onPressOdometer ? 'button' : undefined}
            accessibilityLabel={t.odometerSheet.title}
            style={[styles.lcd, { backgroundColor: ink.bg.well, borderColor: ink.lineStrong }]}>
            <LcdDigits value={odometerKm} height={size * 0.095} color={ink.text.primary} lastColor={ink.needle} />
          </Pressable>
          <T face="eyebrow" style={{ color: ink.text.muted, fontSize: 10, marginTop: 6 }}>
            {t.cluster.caption}
          </T>
        </View>
      </View>

      <View style={styles.nextRow}>
        <T face="eyebrow" style={{ color: ink.text.muted, fontSize: 11 }}>
          {t.cluster.next}
        </T>
        <T face="mono" numberOfLines={1} style={{ color: ink.text.primary, fontSize: 12, marginTop: 2 }}>
          {nextLine}
        </T>
        {caption ? (
          <T face="body" style={{ color: ink.text.muted, fontSize: 13, marginTop: 4 }}>
            {caption}
          </T>
        ) : null}
      </View>
      {children}
    </View>
  );
}

function nextText(reading: ClusterReading): string {
  const when = reading.predictedDueDate
    ? new Date(reading.predictedDueDate).toLocaleDateString('es-DO', { day: 'numeric', month: 'short' })
    : null;
  const left =
    'km' in reading.remaining
      ? reading.remaining.km >= 0
        ? t.cluster.kmLeft(formatKm(reading.remaining.km))
        : t.cluster.kmOver(formatKm(-reading.remaining.km))
      : reading.remaining.days >= 0
        ? t.cluster.daysLeft(reading.remaining.days)
        : t.cluster.daysOver(-reading.remaining.days);
  return t.cluster.nextLine(reading.title, left, when);
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.card,
    borderWidth: 1,
    paddingVertical: space.lg,
    paddingHorizontal: space.lg,
    marginBottom: space.lg,
    overflow: 'hidden',
  },
  lcdWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  lcd: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, borderWidth: 1 },
  nextRow: { alignItems: 'center', marginTop: space.sm },
});
