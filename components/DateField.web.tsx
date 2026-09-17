import { StyleSheet, View } from 'react-native';

import { colors, fonts, radius, space } from '@/constants/theme';
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
  return (
    <View style={styles.wrap}>
      <T face="semibold" style={styles.label}>
        {label}
      </T>
      <input
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        style={{
          backgroundColor: colors.white,
          borderWidth: 1,
          borderStyle: 'solid',
          borderColor: colors.line,
          borderRadius: radius.input,
          padding: `${space.md + 2}px`,
          fontSize: 16,
          color: colors.ink,
          fontFamily: fonts.body,
          // The browser's own calendar glyph is black on a dark field otherwise.
          colorScheme: 'dark',
          width: '100%',
          boxSizing: 'border-box',
        }}
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
  hint: { color: colors.muted, fontSize: 12, marginTop: 6 },
});
