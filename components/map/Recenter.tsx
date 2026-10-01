import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet } from 'react-native';

import { t } from '@/lib/i18n';

/** The drive map's re-centre button (both halves): shown after the person pans. */
export function Recenter({ onPress, bottom = 0 }: { onPress: () => void; /** Covered by overlays at the bottom, px. */ bottom?: number }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={t.trips.mapRecenter} style={({ pressed }) => [styles.recenter, { bottom: bottom + 24, opacity: pressed ? 0.8 : 1 }]}>
      <Ionicons name="locate" size={22} color="#FFFFFF" />
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
