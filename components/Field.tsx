import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { fonts, radius, space } from '@/constants/theme';
import { useTheme } from '@/lib/theme/useTheme';
import { T } from './T';

/** Numeric keyboards get the mono face: every number in JetBrains Mono. */
const NUMERIC = new Set(['number-pad', 'decimal-pad', 'numeric', 'phone-pad']);

export function Field({
  label,
  hint,
  error,
  style,
  ...rest
}: TextInputProps & { label: string; hint?: string; error?: string }) {
  const { theme } = useTheme();
  const numeric = rest.keyboardType != null && NUMERIC.has(rest.keyboardType);

  return (
    <View style={styles.wrap}>
      <T face="eyebrow" style={[styles.label, { color: theme.text.secondary }]}>
        {label}
      </T>
      <TextInput
        placeholderTextColor={theme.text.muted}
        accessibilityLabel={label}
        style={[
          styles.input,
          {
            backgroundColor: theme.bg.raised,
            borderColor: error ? theme.danger : theme.line,
            color: theme.text.primary,
          },
          numeric && styles.numeric,
          style,
        ]}
        {...rest}
      />
      {error ? (
        <T face="body" style={[styles.hint, { color: theme.dangerText }]}>
          {error}
        </T>
      ) : hint ? (
        <T face="body" style={[styles.hint, { color: theme.text.secondary }]}>
          {hint}
        </T>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: space.md + 2 },
  label: { fontSize: 12, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderRadius: radius.input,
    paddingHorizontal: space.md + 2,
    paddingVertical: space.md,
    minHeight: 48,
    fontSize: 16,
    fontFamily: fonts.body,
  },
  numeric: { fontFamily: fonts.mono, fontSize: 16 },
  hint: { fontSize: 13, marginTop: 6, lineHeight: 17 },
});
