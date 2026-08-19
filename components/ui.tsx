import { colors } from '@/constants/theme';
import type { ReactNode } from 'react';
import { Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { T } from './T';

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
    <Pressable
      onPress={onPress}
      style={[styles.chip, selected && styles.chipOn]}>
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
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryLabel: { color: colors.white, fontSize: 16, letterSpacing: 0.3 },
  disabled: { opacity: 0.45 },
  pressed: { transform: [{ translateY: 1 }], opacity: 0.92 },
  ghost: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  ghostLabel: { color: colors.muted, fontSize: 15 },
  chip: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    marginRight: 8,
    marginBottom: 8,
  },
  chipOn: {
    backgroundColor: colors.canopy,
    borderColor: colors.canopy,
  },
  chipLabel: { color: colors.ink, fontSize: 13 },
  chipLabelOn: { color: colors.receipt },
  card: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.line,
  },
});
