import { StyleSheet, View } from 'react-native';

import { fonts, radius, space } from '@/constants/theme';
import { useTheme } from '@/lib/theme/useTheme';
import { T } from './T';

/**
 * The web half of ADR-12. A native `<input type="date">` beats every JS date
 * picker here: it is keyboard-accessible, localised by the browser, and already
 * speaks `YYYY-MM-DD` — the exact format the rest of the app stores.
 *
 * Rendered through `createElement` rather than JSX because react-native-web has
 * no `<input>`; `dom` elements are passed straight through by the renderer.
 */
export function DateField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  hint?: string;
}) {
  const { theme, scheme } = useTheme();

  return (
    <View style={styles.wrap}>
      <T face="semibold" style={[styles.label, { color: theme.text.primary }]}>
        {label}
      </T>
      <input
        type="date"
        value={value}
        aria-label={label}
        onChange={(event) => onChange(event.target.value)}
        style={{
          backgroundColor: theme.bg.raised,
          borderWidth: 1,
          borderStyle: 'solid',
          borderColor: theme.line,
          borderRadius: radius.input,
          padding: `${space.md + 2}px`,
          minHeight: 48,
          fontSize: 16,
          color: theme.text.primary,
          fontFamily: fonts.body,
          // Tells the browser which way round to paint its own calendar glyph
          // and picker chrome. Hard-coded to dark it was a black icon on a dark
          // field in light mode, and vice versa.
          colorScheme: scheme,
          width: '100%',
          boxSizing: 'border-box',
        }}
      />
      {hint ? (
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
  hint: { fontSize: 12, marginTop: 6, lineHeight: 17 },
});
