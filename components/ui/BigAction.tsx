import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

import { radius, space } from '@/constants/theme';
import { useTheme } from '@/lib/theme/useTheme';
import { T } from '../T';

export type BigActionDef = { id: string; label: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void };

/** The height of a big action (SPEC-K §K7: ≥ 56 px). */
export const BIG_ACTION_MIN = 64;

/**
 * One of the (at most four) large buttons on Hoy: verb + object, an icon, a target well above 56 px. `primary` is the single filled one;
 * the others are outlined so a screen never has two buttons shouting at once.
 */
export function BigAction({ label, icon, onPress, primary }: Omit<BigActionDef, 'id'> & { primary?: boolean }) {
  const { theme } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.tile,
        {
          backgroundColor: primary ? (pressed ? theme.accentPressed : theme.accentFill) : theme.bg.surface,
          borderColor: primary ? theme.accentFill : theme.lineStrong,
          opacity: pressed ? 0.9 : 1,
        },
      ]}>
      <Ionicons name={icon} size={24} color={primary ? theme.accentFillInk : theme.accent} />
      <View style={{ flex: 1 }}>
        <T face="semibold" numberOfLines={2} style={{ color: primary ? theme.accentFillInk : theme.text.primary, fontSize: 15, lineHeight: 19 }}>
          {label}
        </T>
      </View>
    </Pressable>
  );
}

/** The grid of big actions: two per row, never more than four (`actions` is cut here so no screen can exceed it). */
export function BigActions({ actions, primaryId }: { actions: BigActionDef[]; primaryId?: string }) {
  return (
    <View style={styles.grid}>
      {actions.slice(0, 4).map((a) => (
        <View key={a.id} style={styles.cell}>
          <BigAction label={a.label} icon={a.icon} onPress={a.onPress} primary={a.id === primaryId} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.md },
  cell: { flexBasis: '47%', flexGrow: 1 },
  tile: {
    minHeight: BIG_ACTION_MIN,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    borderWidth: 1,
    borderRadius: radius.card,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
});
