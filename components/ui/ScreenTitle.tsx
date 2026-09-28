import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { space } from '@/constants/theme';
import { useTheme } from '@/lib/theme/useTheme';
import { T } from '../T';

/**
 * The in-page title block (05-design-jdm.md "Typography"): an optional amber
 * eyebrow in Saira 400 tracked, the title in Saira 800 uppercase, an optional
 * body line under it. `kana` is one word from the ADR-16 list, drawn small and
 * muted next to the eyebrow (or the title when there is no eyebrow) — never on
 * its own and never more than one per block.
 *
 * Screens inside a stack already have a native header; they only use this when
 * the in-page title says something the header does not (the record's own name).
 */
export function ScreenTitle({
  title,
  eyebrow,
  kana,
  sub,
  size = 32,
  trailing,
  style,
}: {
  title: string;
  eyebrow?: string;
  kana?: string;
  sub?: string | null;
  size?: number;
  trailing?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { theme } = useTheme();
  const kanaMark = kana ? (
    <T face="kana" style={[styles.kana, { color: theme.text.muted }]}>
      {` ${kana}`}
    </T>
  ) : null;

  return (
    <View style={[styles.wrap, style]}>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          {eyebrow ? (
            <T face="eyebrow" style={{ color: theme.accent, fontSize: 11 }}>
              {eyebrow}
              {kanaMark}
            </T>
          ) : null}
          <T
            face="display"
            accessibilityRole="header"
            style={[styles.title, { color: theme.text.primary, fontSize: size, lineHeight: Math.round(size * 1.08) }]}>
            {title}
            {eyebrow ? null : kanaMark}
          </T>
        </View>
        {trailing}
      </View>
      {sub ? (
        <T face="body" style={[styles.sub, { color: theme.text.secondary }]}>
          {sub}
        </T>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: space.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  title: { textTransform: 'uppercase', letterSpacing: 0.3 },
  // Nested inside the title/eyebrow Text: no tracking, no uppercase, 10 px.
  kana: { fontSize: 10, letterSpacing: 0, textTransform: 'none' },
  sub: { fontSize: 14, lineHeight: 19, marginTop: 4 },
});
