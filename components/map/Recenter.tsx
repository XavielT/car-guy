import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet } from 'react-native';

import { t } from '@/lib/i18n';

/** The drive map's re-centre button (both halves): shown after the person pans. */
export function Recenter({
  onPress,
  bottom = 0,
  disabled = false,
  active = false,
}: {
  onPress: () => void;
  /** Covered by overlays at the bottom, px. */
  bottom?: number;
  /** No position to centre on yet (M-13: the button is always there, and says so). */
  disabled?: boolean;
  /** The camera is already following you. */
  active?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={t.trips.mapRecenter}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [styles.recenter, { bottom: bottom + 64, opacity: disabled ? 0.45 : pressed ? 0.8 : 1 }, active && !disabled && { borderColor: '#FFB300' }]}>
      <Ionicons name={active ? 'navigate' : 'locate'} size={22} color={active && !disabled ? '#FFB300' : '#FFFFFF'} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  recenter: {
    position: 'absolute',
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(20,20,23,0.92)',
    borderWidth: 1,
    borderColor: '#2A2A30',
  },
});
