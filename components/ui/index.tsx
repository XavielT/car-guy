import { colors, radius, space } from '@/constants/theme';
import type { ReactNode } from 'react';
import { Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { T } from '../T';

export { EmptyState } from './EmptyState';
export { GaugeRing } from './GaugeRing';
export { OdometerHero, type Telltale } from './OdometerHero';
export { QuickActions, type QuickAction } from './QuickActions';
export { Sheet } from './Sheet';
export { StatusPill, type Status } from './StatusPill';
export { Surface } from './Surface';

/**
 * The buttons, chips and cards the Tu Combustible RD screens were written
 * against. Props are unchanged so those screens keep working untouched; only the
 * colours and radii moved onto the Car Guy tokens.
 *
 * These read the static `colors` alias rather than useTheme() on purpose. Every
 * screen that uses them still paints itself from the same alias, so making the
 * controls follow the system scheme would put light buttons on a dark screen.
 * PROMPT-06 restyles those screens and makes this set theme-aware in one go.
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
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.primary,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}>
      <T face="bold" style={styles.primaryLabel}>
        {label}
      </T>
    </Pressable>
  );
}

export function GhostButton({
  label,
  onPress,
  danger,
}: {
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.ghost, pressed && styles.pressed]}>
      <T face="semibold" style={[styles.ghostLabel, danger && { color: colors.danger }]}>
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
  return (
    <Pressable onPress={onPress} style={[styles.chip, selected && styles.chipOn]}>
      <T face="semibold" style={[styles.chipLabel, selected && styles.chipLabelOn]}>
        {label}
      </T>
    </Pressable>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  primary: {
    backgroundColor: colors.nozzle,
    borderRadius: radius.button,
    paddingVertical: space.lg,
    alignItems: 'center',
  },
  // colors.white maps to bg.raised, a near-black — the right ink for a label
  // sitting on the cyan accent.
  primaryLabel: { color: colors.white, fontSize: 16, letterSpacing: 0.3 },
  disabled: { opacity: 0.45 },
  pressed: { transform: [{ translateY: 1 }], opacity: 0.92 },
  ghost: {
    paddingVertical: space.md + 2,
    alignItems: 'center',
  },
  ghostLabel: { color: colors.muted, fontSize: 15 },
  chip: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.chip,
    marginRight: space.sm,
    marginBottom: space.sm,
  },
  chipOn: {
    backgroundColor: colors.led,
    borderColor: colors.led,
  },
  chipLabel: { color: colors.ink, fontSize: 13 },
  chipLabelOn: { color: colors.canopy },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.card,
    padding: space.lg,
    borderWidth: 1,
    borderColor: colors.line,
  },
});
