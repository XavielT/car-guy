import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';

import { palette, radius } from '@/constants/theme';
import { es } from '@/lib/i18n/es';
import { useBlink, useLampTest } from '@/lib/motion/gaugeSweep';
import type { Status } from './StatusPill';

/**
 * A strip of telltales (05-design-jdm.md §2): lamps that are visibly *there*
 * when off, lit in their status colour with a small glow when on. Vencido
 * blinks at 1 Hz for 10 s and then stays lit; the whole strip does a 500 ms lamp
 * test with the cold-start gauge sweep. Every lamp says what it is and its
 * state to a screen reader ("Aceite: próximo").
 *
 * Always the dark palette: like the cluster it sits in, it is an instrument,
 * and stays a dark panel in light mode (05-design-jdm.md "Light").
 */
const theme = palette.dark;
export type LampIcon =
  | 'oil'
  | 'coolant'
  | 'tire'
  | 'battery'
  | 'brake'
  | 'document'
  | 'fuel'
  | 'wrench'
  | 'checklist';

export type Lamp = {
  icon: LampIcon;
  /** 'off' = nothing pending for this system. */
  status: Status | 'off';
  label: string;
  onPress?: () => void;
};

// 24 px, 1.7 stroke, drawn for this component. Paths only — no fills — so the
// "off" state is the same drawing in a dim colour.
const ICONS: Record<LampIcon, { d: string; dots?: [number, number][] }> = {
  oil: { d: 'M3 14h9l5-4 4 1-3 3-5 4H6a3 3 0 0 1-3-3z M8 10V8h3 M8 8h-2', dots: [[19.5, 18.5]] },
  coolant: {
    d: 'M11 4a1 1 0 0 1 2 0v8.8a3 3 0 1 1-2 0z M14.5 6h2 M14.5 9h2 M3 20c1.5 0 1.5-1 3-1s1.5 1 3 1 1.5-1 3-1 1.5 1 3 1 1.5-1 3-1 1.5 1 3 1',
  },
  tire: { d: 'M6.3 18.5a8 8 0 1 1 11.4 0 M6 18.5h12 M12 7.5v5.5', dots: [[12, 15.6]] },
  battery: { d: 'M3 8h18v10H3z M7 5.5V8 M17 5.5V8 M6 13h3 M15 13h3 M16.5 11.5v3' },
  brake: {
    d: 'M12 6.5V13 M4.2 6.5a10 10 0 0 0 0 11 M19.8 6.5a10 10 0 0 1 0 11 M12 18.5a6.5 6.5 0 1 1 0-13 6.5 6.5 0 0 1 0 13z',
    dots: [[12, 15.5]],
  },
  document: { d: 'M7 3h7l4 4v14H7z M14 3v4h4 M9.5 12h5 M9.5 15.5h5' },
  fuel: { d: 'M4 20V5a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v15 M3 20h11 M6 8h5 M13 9h2l2 2v6a1.5 1.5 0 0 0 3 0V9l-3-3' },
  wrench: { d: 'M14.5 4.5a4.5 4.5 0 0 0-5.3 5.9L3.5 16.1l4.4 4.4 5.7-5.7a4.5 4.5 0 0 0 5.9-5.3l-2.7 2.7-2.9-.8-.8-2.9z' },
  checklist: { d: 'M10 6h10 M10 12h10 M10 18h10 M4 6l1.2 1.2L7.6 4.8 M4 12l1.2 1.2 2.4-2.4 M4 18l1.2 1.2 2.4-2.4' },
};

const STATE_LABEL: Record<Lamp['status'], string> = {
  off: es.telltale.off,
  ok: es.telltale.ok,
  proximo: es.telltale.proximo,
  urgente: es.telltale.urgente,
  vencido: es.telltale.vencido,
};

export function TelltaleRow({ lamps }: { lamps: Lamp[] }) {
  const testing = useLampTest();

  return (
    <View
      accessibilityRole="summary"
      style={[styles.row, { backgroundColor: theme.bg.surface, borderColor: theme.lineStrong }]}>
      {lamps.map((lamp) => (
        <LampView key={`${lamp.icon}:${lamp.label}`} lamp={lamp} testing={testing} />
      ))}
    </View>
  );
}

function LampView({ lamp, testing }: { lamp: Lamp; testing: boolean }) {
  const on = lamp.status !== 'off' && lamp.status !== 'ok';
  const color = testing
    ? lamp.status === 'off' || lamp.status === 'ok'
      ? theme.accentFill
      : theme.status[lamp.status]
    : on
      ? theme.status[lamp.status as Status]
      : theme.telltaleOff.icon;
  const lit = testing || on;

  const blink = useBlink(!testing && lamp.status === 'vencido');
  const blinkStyle = useAnimatedStyle(() => ({ opacity: blink.value }));
  const icon = ICONS[lamp.icon];

  const body = (
    <Animated.View
      style={[
        styles.lamp,
        { backgroundColor: theme.telltaleOff.lamp },
        lit && glow(color),
        blinkStyle,
      ]}>
      <Svg width={20} height={20} viewBox="0 0 24 24">
        <Path d={icon.d} stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        {icon.dots?.map(([x, y]) => <Circle key={`${x}${y}`} cx={x} cy={y} r={1.1} fill={color} />)}
      </Svg>
    </Animated.View>
  );

  const a11y = `${lamp.label}: ${STATE_LABEL[lamp.status]}`;
  return lamp.onPress ? (
    <Pressable onPress={lamp.onPress} accessibilityRole="button" accessibilityLabel={a11y} hitSlop={6}>
      {body}
    </Pressable>
  ) : (
    <View accessible accessibilityLabel={a11y}>
      {body}
    </View>
  );
}

/** A 6 px halo: box-shadow on web and iOS; Android has no coloured shadow, so a tint. */
function glow(color: string) {
  if (Platform.OS === 'web') return { boxShadow: `0 0 6px ${color}` } as object;
  if (Platform.OS === 'android') return { backgroundColor: `${color}2E` };
  return { shadowColor: color, shadowOpacity: 0.9, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } };
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    // 8 lamps × 36 + 7 × 6 + 2 × 6 = 342: fits a 360 px card without wrapping.
    gap: 6,
    padding: 6,
    borderRadius: radius.input,
    borderWidth: 1,
    alignSelf: 'center',
  },
  lamp: {
    width: 36,
    height: 24,
    borderRadius: radius.lamp,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
