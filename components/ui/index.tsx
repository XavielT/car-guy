import type { ReactNode } from 'react';
import { Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { radius, space } from '@/constants/theme';
import { useTheme } from '@/lib/theme/useTheme';
import { T } from '../T';

export { EmptyState } from './EmptyState';
export { GaugeRing } from './GaugeRing';
export { OdometerHero, type Telltale } from './OdometerHero';
export { QuickActions, type QuickAction } from './QuickActions';
export { RecordRow, type RecordKind } from './RecordRow';
export { Sheet } from './Sheet';
export { StatusPill, type Status, type Tone } from './StatusPill';
export { Surface } from './Surface';

/**
 * A card is a Surface. The two were separate while the Tu Combustible RD screens
 * painted themselves from the static `colors` alias: a themed card on a screen
 * whose background came from the alias would have been white-on-black in light
 * mode. PROMPT-06 moved every one of those screens onto useTheme(), so the
 * distinction had nothing left to protect and `Card` is now the old name for
 * the same component.
 */
export { Surface as Card } from './Surface';

/**
 * The buttons and chips the Tu Combustible RD screens were written against.
 * Props are unchanged — the migration of the legacy screens was a matter of
 * their own styles, never of these call sites — but the colours now come from
 * useTheme() instead of the static alias, so they follow the active scheme.
 *
 * Touch targets: 52 px for the buttons, 40 px plus 4 px of hitSlop on each edge
 * for the chips, which is 48 px of reachable target around a pill that would
 * look wrong at 44 px of actual height.
 */

export function PrimaryButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { theme } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) }}
      style={({ pressed }) => [
        styles.primary,
        { backgroundColor: pressed && !disabled ? theme.accentPressed : theme.accent },
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}>
      <T face="semibold" style={[styles.primaryLabel, { color: theme.accentInk }]}>
        {label}
      </T>
    </Pressable>
  );
}

export function GhostButton({
  label,
  onPress,
  danger,
  disabled,
}: {
  label: string;
  onPress: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  const { theme } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) }}
      style={({ pressed }) => [styles.ghost, pressed && styles.pressed, disabled && { opacity: 0.4 }]}>
      <T face="semibold" style={[styles.ghostLabel, { color: danger ? theme.danger : theme.text.secondary }]}>
        {label}
      </T>
    </Pressable>
  );
}

export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
}) {
  const { theme } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: Boolean(selected) }}
      hitSlop={{ top: 4, bottom: 4 }}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? theme.accent : theme.bg.raised,
          borderColor: selected ? theme.accent : theme.line,
        },
      ]}>
      <T
        face="semibold"
        style={[styles.chipLabel, { color: selected ? theme.accentInk : theme.text.secondary }]}>
        {label}
      </T>
    </Pressable>
  );
}

/**
 * A screen's section break: an optional eyebrow over a title, with the spacing
 * the six screens that were each declaring their own `styles.sec` had agreed on
 * by accident. Promoting it means a change to that rhythm happens once.
 */
export function SectionHeader({
  title,
  caption,
  eyebrow,
  style,
}: {
  title: string;
  caption?: string;
  eyebrow?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { theme } = useTheme();

  return (
    <View style={[styles.sectionHeader, style]}>
      {eyebrow ? (
        <T face="medium" style={[styles.sectionEyebrow, { color: theme.text.muted }]}>
          {eyebrow.toUpperCase()}
        </T>
      ) : null}
      <T face="title" style={[styles.sectionTitle, { color: theme.text.primary }]}>
        {title}
      </T>
      {caption ? (
        <T face="body" style={[styles.sectionCaption, { color: theme.text.secondary }]}>
          {caption}
        </T>
      ) : null}
    </View>
  );
}

/**
 * Label on the left, value on the right in mono so a column of them lines up.
 * `big` is the one-number-that-matters variant used on detail screens.
 */
export function KeyValueRow({
  label,
  value,
  big,
  style,
}: {
  label: string;
  value: string;
  big?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { theme } = useTheme();

  return (
    <View style={[styles.kv, style]}>
      <T face="body" style={{ color: theme.text.muted, fontSize: 13 }}>
        {label}
      </T>
      <T face="monoBold" style={{ color: theme.text.primary, fontSize: big ? 20 : 14 }}>
        {value}
      </T>
    </View>
  );
}

/**
 * Two or more mutually exclusive options in one track. `accessibilityRole` is
 * tab/tablist rather than radio: that is what TalkBack and VoiceOver announce
 * most usefully for a control that swaps the content below it, and it is what
 * the identity spec asks for.
 */
export function Segmented<K extends string>({
  options,
  value,
  onChange,
  style,
}: {
  options: { key: K; label: string; color?: string }[];
  value: K;
  onChange: (next: K) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { theme } = useTheme();

  return (
    <View
      accessibilityRole="tablist"
      style={[styles.segmented, { backgroundColor: theme.bg.raised, borderColor: theme.line }, style]}>
      {options.map((option) => {
        const on = option.key === value;
        return (
          <Pressable
            key={option.key}
            onPress={() => onChange(option.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            style={[
              styles.segment,
              on && { backgroundColor: theme.bg.surface, borderColor: theme.line },
            ]}>
            {option.color ? (
              <View style={[styles.segmentDot, { backgroundColor: option.color, opacity: on ? 1 : 0.5 }]} />
            ) : null}
            <T
              face="semibold"
              numberOfLines={1}
              style={{ color: on ? theme.text.primary : theme.text.muted, fontSize: 13 }}>
              {option.label}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}

/** A tappable row that opens another screen. Used all over Más. */
export function NavRow({
  label,
  caption,
  onPress,
  trailing,
  danger,
}: {
  label: string;
  caption?: string;
  onPress: () => void;
  trailing?: ReactNode;
  danger?: boolean;
}) {
  const { theme } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.navRow,
        { borderColor: theme.line, backgroundColor: theme.bg.surface },
        pressed && { opacity: 0.85 },
      ]}>
      <View style={{ flex: 1 }}>
        <T face="semibold" style={{ color: danger ? theme.danger : theme.text.primary, fontSize: 15 }}>
          {label}
        </T>
        {caption ? (
          <T face="body" style={{ color: theme.text.secondary, fontSize: 13, marginTop: 3, lineHeight: 18 }}>
            {caption}
          </T>
        ) : null}
      </View>
      {trailing}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  primary: {
    borderRadius: radius.button,
    paddingVertical: space.lg,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryLabel: { fontSize: 16, letterSpacing: 0.3 },
  disabled: { opacity: 0.45 },
  pressed: { transform: [{ translateY: 1 }], opacity: 0.92 },
  ghost: {
    paddingVertical: space.md + 2,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostLabel: { fontSize: 15 },
  chip: {
    borderWidth: 1,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    // 44 is the platform minimum touch target (Apple HIG; Android asks 48dp).
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: radius.chip,
    marginRight: space.sm,
    marginBottom: space.sm,
  },
  chipLabel: { fontSize: 13 },
  sectionHeader: { marginTop: space.xxl + 4, marginBottom: space.md },
  sectionEyebrow: { fontSize: 11, letterSpacing: 0.9, marginBottom: 4 },
  sectionTitle: { fontSize: 21 },
  sectionCaption: { fontSize: 13, marginTop: 4, lineHeight: 19 },
  kv: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  segmented: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: radius.input,
    padding: 3,
    gap: 3,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 40,
    paddingHorizontal: space.sm,
    borderRadius: radius.input - 4,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  segmentDot: { width: 7, height: 7, borderRadius: 999 },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderWidth: 1,
    borderRadius: radius.input,
    paddingHorizontal: space.lg,
    paddingVertical: space.md + 2,
    minHeight: 56,
    marginBottom: space.sm,
  },
});
