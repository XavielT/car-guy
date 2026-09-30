import { useRouter } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/tabs';
import { useEffect, useState } from 'react';
import { Keyboard, Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';

import { T } from '@/components/T';
import { fonts, palette } from '@/constants/theme';
import { t } from '@/lib/i18n';
import { useTheme } from '@/lib/theme/useTheme';
import { useLiveTrip } from '@/lib/trips/liveStore';
import { CENTRE, centreState, tabSlots } from './state';

/** The disc (03-screens.md "Phase 4"): 64 px, raised 18 px above the bar. */
const DISC = 64;
const RAISE = 18;
const BAR = 68;
const PAD_TOP = 8;
/**
 * The band above the bar that holds the raised part of the disc. The disc stays
 * inside the bar's own bounds (Android does not hit-test children drawn outside
 * their parent), so the whole disc takes the tap; the band is the screen's
 * background colour, so it reads as the bottom of the screen.
 */
const BAND = RAISE + 4;

/**
 * Car Guy's tab bar (IMP 30092026 Phase 4, note 17, ADR-43): Inicio · Garaje ·
 * CONDUCIR · Historial · Más. The centre disc opens Modo conducir; while a trip
 * records it wears an amber ring pulsing at 1 Hz and a tiny REC. Same on web.
 */
export function CarGuyTabBar({ state, descriptors, navigation, insets }: BottomTabBarProps) {
  const { theme } = useTheme();
  const router = useRouter();
  const live = useLiveTrip();
  const reduced = useReducedMotion();
  const centre = centreState(live != null, reduced);
  const keyboard = useKeyboardShown();

  // tabBarHideOnKeyboard, as the stock bar did (Android resizes over it).
  if (keyboard) return null;

  const byName = new Map(state.routes.map((r, i) => [r.name, { route: r, index: i }]));
  const slots = tabSlots(state.routes.map((r) => r.name));

  return (
    <View style={{ backgroundColor: theme.bg.base, paddingTop: BAND }}>
      <View
        style={[
          styles.bar,
          {
            backgroundColor: theme.bg.surface,
            borderTopColor: theme.lineStrong,
            height: BAR + insets.bottom,
            paddingBottom: 10 + insets.bottom,
            paddingLeft: insets.left,
            paddingRight: insets.right,
          },
        ]}>
        {slots.map((name) => {
          if (name === CENTRE) {
            return (
              <CentreButton
                key={name}
                ring={centre.ring}
                showRec={centre.showRec}
                label={t.drive[centre.labelKey]}
                onPress={() => router.push('/conducir')}
              />
            );
          }
          const entry = byName.get(name);
          if (!entry) return null;
          const { route, index } = entry;
          const { options } = descriptors[route.key];
          const focused = state.index === index;
          const color = focused ? theme.accent : theme.text.muted;
          const label = typeof options.title === 'string' ? options.title : route.name;
          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
          };
          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
              style={styles.tab}>
              {options.tabBarIcon?.({ focused, color, size: 24 })}
              <T face="title" numberOfLines={1} style={[styles.label, { color }]}>
                {label}
              </T>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function CentreButton({
  ring,
  showRec,
  label,
  onPress,
}: {
  ring: 'none' | 'pulse' | 'static';
  showRec: boolean;
  label: string;
  onPress: () => void;
}) {
  const { theme } = useTheme();

  // The amber ring's 1 Hz pulse: runs only while a trip records, stops with it.
  const pulse = useSharedValue(1);
  useEffect(() => {
    if (ring !== 'pulse') {
      cancelAnimation(pulse);
      pulse.value = 1;
      return;
    }
    pulse.value = 1;
    pulse.value = withRepeat(withTiming(0.3, { duration: 500 }), -1, true);
    return () => cancelAnimation(pulse);
  }, [ring, pulse]);
  const ringStyle = useAnimatedStyle(() => ({ opacity: pulse.value, transform: [{ scale: 1 + (1 - pulse.value) * 0.08 }] }));

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.centre, pressed && { opacity: 0.9 }]}>
      <View style={styles.discWrap}>
        {ring !== 'none' ? (
          <Animated.View
            pointerEvents="none"
            style={[styles.ring, { borderColor: palette.dark.accent }, ring === 'pulse' ? ringStyle : null]}
          />
        ) : null}
        <View style={[styles.disc, { backgroundColor: palette.dark.redline, borderColor: theme.bg.base }]}>
          <Svg width={30} height={30} viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth={2}>
            <Path d="M4 16a8 8 0 1 1 16 0" strokeLinecap="round" />
            <Path d="M12 16l5-7" strokeLinecap="round" />
            <Circle cx={12} cy={16} r={1.5} fill="#FFFFFF" />
          </Svg>
        </View>
        {showRec ? (
          <View style={[styles.rec, { backgroundColor: theme.bg.base, borderColor: theme.lineStrong }]}>
            <View style={[styles.recDot, { backgroundColor: palette.dark.redline }]} />
            <T face="eyebrow" style={{ color: theme.redlineText, fontSize: 8, letterSpacing: 1.2, lineHeight: 11 }}>
              REC
            </T>
          </View>
        ) : null}
      </View>
      <T face="title" numberOfLines={1} style={[styles.label, { color: theme.text.primary }]}>
        {t.tabs.conducir}
      </T>
    </Pressable>
  );
}

function useKeyboardShown(): boolean {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const a = Keyboard.addListener('keyboardDidShow', () => setShown(true));
    const b = Keyboard.addListener('keyboardDidHide', () => setShown(false));
    return () => {
      a.remove();
      b.remove();
    };
  }, []);
  return shown;
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'flex-start', borderTopWidth: 1, paddingTop: PAD_TOP },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'flex-start', gap: 4, minHeight: 48, paddingTop: 2 },
  // Saira's tall caps clip at the default line height on web; give them room.
  label: { fontFamily: fonts.title, fontSize: 11, lineHeight: 15, letterSpacing: 0.9, textTransform: 'uppercase' },
  // The wrap is 4 px larger than the disc on every side (the amber ring): the disc's top sits RAISE above the bar.
  centre: { width: 96, alignItems: 'center', marginTop: -(RAISE + PAD_TOP + 4) },
  discWrap: { width: DISC + 8, height: DISC + 8, alignItems: 'center', justifyContent: 'center', marginBottom: -2 },
  ring: { position: 'absolute', width: DISC + 8, height: DISC + 8, borderRadius: (DISC + 8) / 2, borderWidth: 3 },
  disc: {
    width: DISC,
    height: DISC,
    borderRadius: DISC / 2,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 8px 18px rgba(0, 0, 0, 0.6)',
  },
  rec: {
    position: 'absolute',
    bottom: -2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 5,
    borderRadius: 6,
    borderWidth: 1,
  },
  recDot: { width: 5, height: 5, borderRadius: 2.5 },
});
