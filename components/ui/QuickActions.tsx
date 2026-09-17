import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

import { radius, space } from '@/constants/theme';
import { useTheme } from '@/lib/theme/useTheme';
import { T } from '../T';

export type QuickAction = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
};

/**
 * The grid of large buttons on Inicio. Research turned up the same complaint
 * about every app of this kind — no way to add the thing you came to add — so
 * the home screen leads with the four verbs instead of hiding them in tabs.
 *
 * Two per row, which keeps the targets large on a phone and degrades to a tidy
 * 2×N for any number of actions.
 */
export function QuickActions({ actions }: { actions: QuickAction[] }) {
  const { theme } = useTheme();

  return (
    <View style={styles.grid}>
      {actions.map((action) => (
        <Pressable
          key={action.label}
          onPress={action.onPress}
          accessibilityRole="button"
          accessibilityLabel={action.label}
          style={({ pressed }) => [
            styles.tile,
            {
              backgroundColor: theme.bg.surface,
              borderColor: theme.line,
              opacity: pressed ? 0.85 : 1,
            },
          ]}>
          <Ionicons name={action.icon} size={22} color={theme.accent} />
          <T face="semibold" style={[styles.label, { color: theme.text.primary }]}>
            {action.label}
          </T>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.md,
  },
  tile: {
    // Two per row once the gap is taken out, whatever the screen width.
    flexBasis: '47%',
    flexGrow: 1,
    borderWidth: 1,
    borderRadius: radius.card,
    paddingVertical: space.xl,
    paddingHorizontal: space.lg,
    gap: space.sm,
  },
  label: { fontSize: 15 },
});
