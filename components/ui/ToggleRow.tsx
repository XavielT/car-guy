import { StyleSheet, Switch, View } from 'react-native';

import { palette, space } from '@/constants/theme';
import { useTheme } from '@/lib/theme/useTheme';
import { T } from '../T';

/**
 * A yes / no setting as a switch with its words (IMP 16102026 ADR-60): a boolean is not a choice between named
 * options, so it is never a picker. "¿Aceite sintético?", "Pasajero", "Recurrente", "Activado"…
 */
export function ToggleRow({
  label,
  value,
  onChange,
  hint,
  disabled,
  dark,
}: {
  label: string;
  value: boolean;
  onChange: (next: boolean) => void;
  hint?: string;
  disabled?: boolean;
  dark?: boolean;
}) {
  const { theme: appTheme } = useTheme();
  const theme = dark ? palette.dark : appTheme;
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <T face="semibold" style={{ color: theme.text.primary, fontSize: 15, flex: 1 }}>
          {label}
        </T>
        <Switch
          value={value}
          onValueChange={onChange}
          disabled={disabled}
          accessibilityLabel={label}
          trackColor={{ true: theme.accentFill, false: theme.lineStrong }}
        />
      </View>
      {hint ? (
        <T face="body" style={{ color: theme.text.secondary, fontSize: 13, lineHeight: 17, marginTop: 4 }}>
          {hint}
        </T>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: space.md, minHeight: 48, justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 48 },
});
