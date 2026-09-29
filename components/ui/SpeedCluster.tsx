import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useId, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Polygon, Stop, Text as SvgText } from 'react-native-svg';

import { fonts, palette, radius, space } from '@/constants/theme';
import { es } from '@/lib/i18n/es';
import { getLiveTrip, gpsNow, subscribeLiveTrip, useLiveTrip } from '@/lib/trips/liveStore';
import { T } from '../T';
import { LcdDigits } from './LcdDigits';

/**
 * The cluster in speed mode (IMP 29092026 Phase 5A, ADR-31): the same 240° dial
 * as ClusterHero, scaled 0–200 km/h with a mark every 20, the red arc from the
 * vehicle's limit_kmh, and a needle that follows the GPS speed. The LCD shows
 * the trip — tap to cycle km · tiempo · media · máx. Telltales: GPS (good /
 * weak / none), REC blinking at 1 Hz (the only loop allowed on the screen; it
 * stops with the trip) and PASAJERO.
 *
 * The needle is a shared value fed straight from the live store's listener, so
 * a fix moves it without re-rendering React; the numbers re-render once per fix.
 */

const START = 150;
const SWEEP = 240;
const MAX_KMH = 200;
const AnimatedView = Animated.View;
const ink = palette.dark;

type LcdMode = 'km' | 'time' | 'avg' | 'max';
const MODES: LcdMode[] = ['km', 'time', 'avg', 'max'];

export function SpeedCluster({
  limitKmh = 120,
  size = 300,
  onStop,
}: {
  limitKmh?: number;
  size?: number;
  /** "Terminar viaje". */
  onStop?: () => void;
}) {
  const gradientId = `speed-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const trip = useLiveTrip();
  const reduced = useReducedMotion();
  const [mode, setMode] = useState<LcdMode>('km');
  const [now, setNow] = useState(() => Date.now());

  const stroke = Math.round(size * 0.045);
  const r = size / 2 - stroke - 4;
  const cx = size / 2;
  const cy = size / 2;
  const redFrom = Math.min(1, Math.max(0, limitKmh / MAX_KMH));

  // Needle: the listener writes the shared value; no React render per fix.
  const needle = useSharedValue(0);
  useEffect(() => {
    const update = () => {
      const t = getLiveTrip();
      const target = Math.min(1, (t?.speedKmh ?? 0) / MAX_KMH);
      needle.value = reduced ? target : withTiming(target, { duration: 400, easing: Easing.out(Easing.quad) });
    };
    update();
    return subscribeLiveTrip(update);
  }, [needle, reduced]);
  const needleStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${START + SWEEP * needle.value}deg` }] }));

  // REC at 1 Hz while recording — stopped on unmount (the trip ended).
  const rec = useSharedValue(1);
  useEffect(() => {
    if (reduced) return;
    rec.value = withRepeat(withTiming(0.25, { duration: 500 }), -1, true);
    return () => cancelAnimation(rec);
  }, [rec, reduced]);
  const recStyle = useAnimatedStyle(() => ({ opacity: rec.value }));

  // The clock for "tiempo" and for the GPS lamp going stale.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const polar = (t: number, at: number) => {
    const a = ((START + SWEEP * t) * Math.PI) / 180;
    return { x: cx + at * Math.cos(a), y: cy + at * Math.sin(a) };
  };
  const arc = (t0: number, t1: number) => {
    const a = polar(t0, r);
    const b = polar(t1, r);
    const large = (t1 - t0) * SWEEP > 180 ? 1 : 0;
    return `M ${a.x} ${a.y} A ${r} ${r} 0 ${large} 1 ${b.x} ${b.y}`;
  };

  const ticks = [];
  for (let kmh = 0; kmh <= MAX_KMH; kmh += 20) {
    const t = kmh / MAX_KMH;
    const major = kmh % 40 === 0;
    const a = polar(t, r - stroke / 2 - 4);
    const b = polar(t, r - stroke / 2 - (major ? 16 : 9));
    ticks.push(
      <Line key={kmh} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={t >= redFrom ? ink.redline : ink.text.secondary} strokeWidth={major ? 2.5 : 1.5} strokeLinecap="round" />,
    );
  }
  const numerals = [0, 40, 80, 120, 160, 200].map((kmh) => {
    const t = kmh / MAX_KMH;
    const p = polar(t, r - stroke / 2 - 30);
    return (
      <SvgText key={kmh} x={p.x} y={p.y + size * 0.022} fontSize={size * 0.055} fontFamily={fonts.title} fill={t >= redFrom ? ink.redlineText : ink.text.primary} textAnchor="middle">
        {kmh}
      </SvgText>
    );
  });

  const elapsedS = trip ? Math.max(0, Math.round((now - trip.startedAt) / 1000)) : 0;
  const avgKmh = trip && trip.movingS > 0 ? trip.distanceM / 1000 / (trip.movingS / 3600) : 0;
  const lcdValue =
    // Tenths of a km: the LCD's last digit is the red tenths drum, like a trip meter.
    mode === 'km'
      ? trip ? Math.round(trip.distanceM / 100) : 0
      : mode === 'time'
        ? Math.floor(elapsedS / 60)
        : mode === 'avg'
          ? Math.round(avgKmh)
          : Math.round(trip?.maxKmh ?? 0);
  const gps = trip ? gpsNow(trip, now) : 'none';
  const gpsColor = gps === 'good' ? ink.statusText.ok : gps === 'weak' ? ink.statusText.proximo : ink.text.disabled;
  const needleLen = r - stroke / 2 - 6;
  const hub = size * 0.05;

  return (
    <View style={[styles.card, { backgroundColor: ink.bg.surface, borderColor: ink.lineStrong }]}>
      <View style={{ width: size, height: size * 0.9, alignSelf: 'center' }}>
        <Svg width={size} height={size} pointerEvents="none">
          <Defs>
            <LinearGradient id={gradientId} gradientUnits="userSpaceOnUse" x1={cx - r} y1={cy + r * 0.5} x2={cx + r} y2={cy - r * 0.3}>
              {ink.gaugeGradient.map((stop) => (
                <Stop key={stop.offset} offset={stop.offset} stopColor={stop.color} />
              ))}
            </LinearGradient>
          </Defs>
          <Path d={arc(0, 1)} stroke={ink.lineStrong} strokeWidth={stroke} fill="none" />
          {redFrom < 1 ? <Path d={arc(redFrom, 1)} stroke={ink.redline} strokeWidth={stroke} fill="none" /> : null}
          {ticks}
          {numerals}
          <SvgText x={cx} y={cy - size * 0.16} fontSize={size * 0.045} fontFamily={fonts.title} fill={ink.text.muted} textAnchor="middle">
            KM/H
          </SvgText>
        </Svg>
        <AnimatedView pointerEvents="none" style={[StyleSheet.absoluteFill, { width: size, height: size }, needleStyle]}>
          <Svg width={size} height={size}>
            <Polygon
              points={`${cx - hub * 0.6},${cy - 3.2} ${cx + needleLen},${cy - 0.8} ${cx + needleLen},${cy + 0.8} ${cx - hub * 0.6},${cy + 3.2}`}
              fill={ink.needle}
            />
          </Svg>
        </AnimatedView>
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { width: size, height: size }]}>
          <Svg width={size} height={size}>
            <Circle cx={cx} cy={cy} r={hub} fill={ink.bg.well} stroke={ink.accent} strokeWidth={2} />
          </Svg>
        </View>

        <View style={[styles.lcdWrap, { top: cy + size * 0.12 }]} pointerEvents="box-none">
          <Pressable
            onPress={() => setMode((m) => MODES[(MODES.indexOf(m) + 1) % MODES.length])}
            accessibilityRole="button"
            accessibilityLabel={es.trips.lcdA11y(es.trips.lcd[mode], mode === 'km' ? (lcdValue / 10).toFixed(1) : String(lcdValue))}
            style={[styles.lcd, { backgroundColor: ink.bg.well, borderColor: ink.lineStrong }]}>
            <LcdDigits value={lcdValue} height={size * 0.095} color={ink.text.primary} lastColor={ink.needle} />
          </Pressable>
          <T face="eyebrow" style={{ color: ink.text.muted, fontSize: 10, marginTop: 6 }}>
            {es.trips.lcd[mode]}
          </T>
        </View>
      </View>

      <View style={styles.lamps}>
        <View style={styles.lamp} accessibilityLabel={es.trips.gps[gps]}>
          <Ionicons name="navigate" size={16} color={gpsColor} />
          <T face="eyebrow" style={{ color: gpsColor, fontSize: 10 }}>
            GPS
          </T>
        </View>
        <AnimatedView style={[styles.lamp, recStyle]} accessibilityLabel={es.trips.recording}>
          <View style={[styles.recDot, { backgroundColor: ink.redline }]} />
          <T face="eyebrow" style={{ color: ink.redlineText, fontSize: 10 }}>
            REC
          </T>
        </AnimatedView>
        {trip?.role === 'pasajero' ? (
          <View style={styles.lamp}>
            <Ionicons name="person" size={14} color={ink.text.secondary} />
            <T face="eyebrow" style={{ color: ink.text.secondary, fontSize: 10 }}>
              {es.trips.passenger}
            </T>
          </View>
        ) : null}
      </View>
      <T face="body" style={{ color: ink.text.muted, fontSize: 11, textAlign: 'center', marginTop: space.xs }}>
        {es.trips.gpsDisclaimer}
      </T>
      {onStop ? (
        <Pressable onPress={onStop} accessibilityRole="button" style={[styles.stop, { borderColor: ink.redline }]}>
          <T face="title" style={{ color: ink.redlineText, fontSize: 14, letterSpacing: 1 }}>
            {es.trips.stop}
          </T>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.card, borderWidth: 1, padding: space.lg, marginBottom: space.lg },
  lcdWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  lcd: { borderWidth: 1, borderRadius: radius.tag, paddingHorizontal: space.md, paddingVertical: space.sm, minHeight: 44, justifyContent: 'center' },
  lamps: { flexDirection: 'row', justifyContent: 'center', gap: space.lg, marginTop: space.sm },
  lamp: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 24 },
  recDot: { width: 8, height: 8, borderRadius: 4 },
  stop: { borderWidth: 1, borderRadius: radius.button, minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: space.md },
});
