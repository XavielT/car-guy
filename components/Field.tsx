import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { fonts, radius, space } from '@/constants/theme';
import { useTheme } from '@/lib/theme/useTheme';
import { T } from './T';

export function Field({
  label,
  hint,
  error,
  style,
  ...rest
}: TextInputProps & { label: string; hint?: string; error?: string }) {
  const { theme } = useTheme();

  return (
    <View style={styles.wrap}>
      <T face="semibold" style={[styles.label, { color: theme.text.primary }]}>
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
          style,
        ]}
        {...rest}
      />
      {error ? (
        <T face="body" style={[styles.hint, { color: theme.danger }]}>
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
  label: { fontSize: 13, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderRadius: radius.input,
    paddingHorizontal: space.md + 2,
    paddingVertical: space.md,
    minHeight: 48,
    fontSize: 16,
    fontFamily: fonts.body,
  },
  hint: { fontSize: 12, marginTop: 6, lineHeight: 17 },
});
