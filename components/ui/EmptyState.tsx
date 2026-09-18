import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

import { radius, space } from '@/constants/theme';
import { useTheme } from '@/lib/theme/useTheme';
import { T } from '../T';

/**
 * Icon, one sentence, one way forward. Never two CTAs: an empty screen is not a
 * place to make a decision.
 */
export function EmptyState({
  icon = 'car-outline',
  message,
  actionLabel,
  onAction,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const { theme } = useTheme();

  return (
    <View style={styles.wrap}>
      <View style={[styles.badge, { backgroundColor: theme.bg.raised }]}>
        <Ionicons name={icon} size={26} color={theme.text.muted} />
      </View>
      <T face="body" style={[styles.message, { color: theme.text.secondary }]}>
        {message}
      </T>
      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.action,
            { backgroundColor: pressed ? theme.accentPressed : theme.accent },
          ]}>
          <T face="semibold" style={[styles.actionLabel, { color: theme.accentInk }]}>
            {actionLabel}
          </T>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: space.xxxl, paddingHorizontal: space.xl },
  badge: {
    width: 56,
    height: 56,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.lg,
  },
  message: { fontSize: 15, textAlign: 'center', lineHeight: 22, maxWidth: 320 },
  action: {
    marginTop: space.xl,
    paddingHorizontal: space.xxl,
    paddingVertical: space.md,
    borderRadius: radius.button,
  },
  actionLabel: { fontSize: 15 },
});
