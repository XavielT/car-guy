import { colors, fonts, radius, space } from '@/constants/theme';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { T } from './T';

export function Field({
  label,
  hint,
  ...rest
}: TextInputProps & { label: string; hint?: string }) {
  return (
    <View style={styles.wrap}>
      <T face="semibold" style={styles.label}>
        {label}
      </T>
      <TextInput
        placeholderTextColor={colors.muted}
        style={styles.input}
        {...rest}
      />
      {hint ? (
        <T face="body" style={styles.hint}>
          {hint}
        </T>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: space.md + 2 },
  label: { color: colors.ink, fontSize: 13, marginBottom: 6 },
  input: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.input,
    paddingHorizontal: space.md + 2,
    paddingVertical: space.md,
    fontSize: 16,
    color: colors.ink,
    fontFamily: fonts.body,
  },
  hint: { color: colors.muted, fontSize: 12, marginTop: 6 },
});
