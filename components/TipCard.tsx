import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { T } from '@/components/T';
import { palette, radius, space } from '@/constants/theme';
import { FEATURE_ONBOARDING_V2 } from '@/lib/flagsV8';
import { t } from '@/lib/i18n';
import { dismissTip, useTip, type TipId } from '@/lib/onboarding/tips';
import { useTheme } from '@/lib/theme/useTheme';

/**
 * A first-visit tip (research 02 §3.3): inline at the top of a screen, one or
 * two lines and "Entendido". No overlay and nothing measured, so it works the
 * same on web. Dismissed ids go to the `tips_seen` setting.
 */
export function TipCard({ id, dark, style }: { id: TipId; /** Always-dark screens (Modo conducir). */ dark?: boolean; style?: StyleProp<ViewStyle> }) {
  const { theme: current } = useTheme();
  const theme = dark ? palette.dark : current;
  const visible = useTip(id);
  if (!FEATURE_ONBOARDING_V2 || !visible) return null;

  return (
    <View
      accessibilityRole="summary"
      style={[styles.card, { backgroundColor: theme.bg.surface, borderColor: theme.line, borderLeftColor: theme.accent }, style]}>
      <Ionicons name="bulb-outline" size={20} color={theme.accent} style={styles.icon} />
      <View style={{ flex: 1 }}>
        <T face="eyebrow" style={{ color: theme.accent, fontSize: 11 }}>
          {t.welcome.tips.eyebrow}
        </T>
        <T face="body" style={[styles.body, { color: theme.text.primary }]}>
          {t.welcome.tips[id]}
        </T>
        <Pressable
          onPress={() => void dismissTip(id)}
          accessibilityRole="button"
          accessibilityLabel={t.welcome.tips.dismissA11y}
          hitSlop={8}
          style={styles.dismiss}>
          <T face="semibold" style={{ color: theme.accent, fontSize: 14 }}>
            {t.welcome.tips.dismiss}
          </T>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: space.md,
    padding: space.md,
    borderWidth: 1,
    borderLeftWidth: 3,
    borderRadius: radius.button,
    marginBottom: space.md,
  },
  icon: { marginTop: 2 },
  body: { fontSize: 14, lineHeight: 20, marginTop: 2 },
  dismiss: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
});
