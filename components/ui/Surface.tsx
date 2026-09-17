import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { radius, space } from '@/constants/theme';
import { useTheme } from '@/lib/theme/useTheme';

/**
 * A card that follows the active colour scheme.
 *
 * The `Card` next to it in this folder reads the static dark alias, because the
 * Tu Combustible RD screens that use it paint themselves from the same alias and
 * would otherwise end up with light cards on a dark page. Screens built from
 * PROMPT-03 on are fully theme-aware and use this instead; when PROMPT-06
 * migrates the last legacy screen, `Card` becomes an alias for this and the
 * distinction disappears.
 */
export function Surface({
  children,
  style,
  padded = true,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
}) {
  const { theme } = useTheme();

  return (
    <View
      style={[
        styles.surface,
        {
          backgroundColor: theme.bg.surface,
          borderColor: theme.line,
          padding: padded ? space.lg : 0,
        },
        theme.cardShadow && styles.shadow,
        style,
      ]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  surface: { borderWidth: 1, borderRadius: radius.card },
  // Light only: in dark, depth comes from base → surface → raised.
  shadow: {
    shadowColor: '#0F172A',
    shadowOpacity: 0.06,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
});
