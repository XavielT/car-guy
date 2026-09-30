import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

import { radius, space } from '@/constants/theme';
import { useTheme } from '@/lib/theme/useTheme';
import { T } from '../T';

/**
 * A form field that opens a picker instead of a keyboard: the label above, the
 * chosen value (or a placeholder) in a box that looks like `Field`, a chevron.
 * The picker itself is whatever sheet the caller opens in `onPress`.
 */
export function PickerField({
  label,
  value,
  placeholder,
  onPress,
  hint,
  disabled,
}: {
  label: string;
  value: string | null | undefined;
  placeholder: string;
  onPress: () => void;
  hint?: string;
  disabled?: boolean;
}) {
  const { theme } = useTheme();
  const empty = !value;

  return (
    <View style={styles.wrap}>
      <T face="eyebrow" style={[styles.label, { color: theme.text.secondary }]}>
        {label}
      </T>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value || placeholder}`}
        accessibilityState={{ disabled: Boolean(disabled) }}
        style={[
          styles.box,
          { backgroundColor: theme.bg.raised, borderColor: theme.line, opacity: disabled ? 0.5 : 1 },
        ]}>
        <T face="body" numberOfLines={1} style={[styles.value, { color: empty ? theme.text.muted : theme.text.primary }]}>
          {value || placeholder}
        </T>
        <Ionicons name="chevron-down" size={18} color={theme.text.muted} />
      </Pressable>
      {hint ? (
        <T face="body" style={[styles.hint, { color: theme.text.secondary }]}>
          {hint}
        </T>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: space.md + 2, flex: 1 },
  label: { fontSize: 12, marginBottom: 6 },
  box: {
    borderWidth: 1,
    borderRadius: radius.input,
    paddingHorizontal: space.md + 2,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  value: { flex: 1, fontSize: 16 },
  hint: { fontSize: 13, marginTop: 6, lineHeight: 17 },
});
