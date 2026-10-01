import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/lib/theme/useTheme';
import { T } from '../T';

export type BadgeTone = 'red' | 'amber' | 'green' | 'outline';

/**
 * A Type R-style badge (05-design-jdm.md §5): 20 px, Michroma uppercase, one
 * per card at most. Red is the default and is a *fill* — the text on it is
 * white, never red on dark. Content like `4AGE 20V`, `SWAP`, `DAILY`, `EX`.
 */
export function Badge({
  label,
  tone = 'red',
  onPhoto = false,
  style,
}: {
  label: string;
  tone?: BadgeTone;
  /**
   * Drawn over a cover photo (IMP 01102026 note 15): the outline badge becomes a solid dark chip — a thin
   * outline over a busy photo could not be read. Filled tones are unchanged.
   */
  onPhoto?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { theme } = useTheme();
  const look = {
    red: { bg: theme.redline, fg: '#FFFFFF', border: 'rgba(255, 77, 69, 0.4)' },
    amber: { bg: theme.accentFill, fg: theme.accentFillInk, border: 'rgba(0, 0, 0, 0.15)' },
    green: { bg: theme.status.ok, fg: '#121212', border: 'rgba(0, 0, 0, 0.15)' },
    outline: onPhoto
      ? { bg: 'rgba(18, 18, 18, 0.85)', fg: '#F2F2F2', border: 'rgba(255, 255, 255, 0.22)' }
      : { bg: 'transparent', fg: theme.text.secondary, border: theme.lineStrong },
  }[tone];

  return (
    <View
      accessibilityRole="text"
      style={[styles.badge, { backgroundColor: look.bg, borderColor: look.border }, style]}>
      <T face="badge" numberOfLines={1} style={[styles.label, { color: look.fg }]}>
        {label}
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    height: 20,
    paddingHorizontal: 7,
    borderRadius: 3,
    borderWidth: 1,
    alignSelf: 'flex-start',
    justifyContent: 'center',
  },
  label: { fontSize: 10, lineHeight: 14 },
});
