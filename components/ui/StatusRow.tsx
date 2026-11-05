import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

import { radius, space } from '@/constants/theme';
import { useTheme } from '@/lib/theme/useTheme';
import { T } from '../T';

export type StatusTone = 'ok' | 'proximo' | 'vencido' | 'neutral';

/**
 * A big row with ONE line of status ("Marbete: vence en 12 días") and a chevron (SPEC-K §K7). Mi carro is a short list of these,
 * not a wall of widgets. The status line is the whole point: a row without one is a NavRow.
 */
export function StatusRow({
  label,
  status,
  tone = 'neutral',
  icon,
  onPress,
}: {
  label: string;
  status?: string;
  tone?: StatusTone;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  const color = tone === 'neutral' ? theme.text.muted : theme.statusText[tone];
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={status ? `${label}. ${status}` : label}
      style={({ pressed }) => [styles.row, { backgroundColor: theme.bg.surface, borderColor: theme.line, opacity: pressed ? 0.88 : 1 }]}>
      {icon ? <Ionicons name={icon} size={22} color={theme.accent} /> : null}
      <View style={{ flex: 1 }}>
        <T face="semibold" style={{ color: theme.text.primary, fontSize: 15 }}>
          {label}
        </T>
        {status ? (
          <T face="body" numberOfLines={2} style={{ color, fontSize: 13, marginTop: 1 }}>
            {status}
          </T>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={theme.text.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: space.md, borderWidth: 1, borderRadius: radius.card, paddingHorizontal: space.md, paddingVertical: space.sm, marginBottom: space.sm },
});
