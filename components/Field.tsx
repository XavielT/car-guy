import { colors } from '@/constants/theme';
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
  wrap: { marginBottom: 14 },
  label: { color: colors.ink, fontSize: 13, marginBottom: 6 },
  input: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.ink,
    fontFamily: 'Figtree_400Regular',
  },
  hint: { color: colors.muted, fontSize: 12, marginTop: 6 },
});
