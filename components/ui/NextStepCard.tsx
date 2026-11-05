import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

import { radius, space } from '@/constants/theme';
import { useTheme } from '@/lib/theme/useTheme';
import { T } from '../T';

/**
 * "Siguiente paso": one card, one button, one "Más tarde" (SPEC-K §K1). Hoy renders at most one of these; it is never a stack.
 * `tone` only colours the left edge: an overdue reminder is red, a nudge is the accent.
 */
export function NextStepCard({
  eyebrow,
  title,
  body,
  actionLabel,
  onAction,
  laterLabel,
  onLater,
  icon = 'arrow-forward-circle-outline',
  tone = 'accent',
}: {
  /** The card's name ("Siguiente paso"), from the dictionary. */
  eyebrow: string;
  title: string;
  body?: string;
  actionLabel: string;
  onAction: () => void;
  laterLabel?: string;
  onLater?: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  tone?: 'accent' | 'warn' | 'urgent';
}) {
  const { theme } = useTheme();
  const edge = tone === 'urgent' ? theme.status.vencido : tone === 'warn' ? theme.status.proximo : theme.accent;
  return (
    <View accessibilityRole="summary" style={[styles.card, { backgroundColor: theme.bg.surface, borderColor: theme.lineStrong, borderLeftColor: edge }]}>
      <View style={styles.head}>
        <Ionicons name={icon} size={22} color={edge} />
        <View style={{ flex: 1 }}>
          <T face="eyebrow" style={{ color: theme.text.muted, fontSize: 11 }}>
            {eyebrow}
          </T>
          <T face="semibold" style={{ color: theme.text.primary, fontSize: 17, lineHeight: 22, marginTop: 2 }}>
            {title}
          </T>
          {body ? (
            <T face="body" style={{ color: theme.text.secondary, fontSize: 13, lineHeight: 19, marginTop: 2 }}>
              {body}
            </T>
          ) : null}
        </View>
      </View>
      <View style={styles.actions}>
        <Pressable
          onPress={onAction}
          accessibilityRole="button"
          style={({ pressed }) => [styles.primary, { backgroundColor: pressed ? theme.accentPressed : theme.accentFill }]}>
          <T face="semibold" style={{ color: theme.accentFillInk, fontSize: 15 }}>
            {actionLabel}
          </T>
        </Pressable>
        {laterLabel && onLater ? (
          <Pressable onPress={onLater} accessibilityRole="button" hitSlop={4} style={styles.later}>
            <T face="semibold" style={{ color: theme.text.secondary, fontSize: 14 }}>
              {laterLabel}
            </T>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderLeftWidth: 4, borderRadius: radius.card, padding: space.md, marginBottom: space.md },
  head: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.md },
  primary: { minHeight: 48, paddingHorizontal: space.lg, borderRadius: radius.button, alignItems: 'center', justifyContent: 'center' },
  later: { minHeight: 48, paddingHorizontal: space.md, alignItems: 'center', justifyContent: 'center' },
});
