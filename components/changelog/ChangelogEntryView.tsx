import { StyleSheet, View } from 'react-native';

import { T } from '@/components/T';
import { space } from '@/constants/theme';
import type { ChangelogEntry } from '@/lib/changelog/parse';
import { useTheme } from '@/lib/theme/useTheme';

/**
 * One version's notes: its intro, then each section (eyebrow title + bullets).
 * Shared by the Novedades sheet and /versiones. The header (version, date) is
 * the caller's, since the two draw it differently.
 */
export function ChangelogEntryView({ entry }: { entry: ChangelogEntry }) {
  const { theme } = useTheme();
  return (
    <View>
      {entry.intro.map((p, i) => (
        <Inline key={`i${i}`} text={p} style={[styles.para, { color: theme.text.secondary }]} />
      ))}
      {entry.sections.map((section, s) => (
        <View key={`s${s}`} style={s > 0 || entry.intro.length ? styles.section : undefined}>
          {section.title ? (
            <T face="eyebrow" accessibilityRole="header" style={[styles.eyebrow, { color: theme.accent }]}>
              {section.title}
            </T>
          ) : null}
          {section.intro.map((p, i) => (
            <Inline key={`p${i}`} text={p} style={[styles.para, { color: theme.text.secondary }]} />
          ))}
          {section.items.map((item, i) => (
            <View key={`b${i}`} style={styles.item}>
              <View style={[styles.dot, { backgroundColor: theme.accent }]} />
              <Inline text={item} style={[styles.itemText, { color: theme.text.primary }]} />
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const INLINE = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g;

/** CHANGELOG's inline markdown: **bold**, `code`, *emphasis* (links are already plain text). */
function Inline({ text, style }: { text: string; style: object[] }) {
  const { theme } = useTheme();
  const parts = text.split(INLINE).filter(Boolean);
  return (
    <T face="body" style={style}>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <T key={i} face="semibold" style={{ color: theme.text.primary }}>
              {part.slice(2, -2)}
            </T>
          );
        }
        if (part.startsWith('`') && part.endsWith('`')) {
          return (
            <T key={i} face="mono" style={{ fontSize: 13 }}>
              {part.slice(1, -1)}
            </T>
          );
        }
        if (part.length > 2 && part.startsWith('*') && part.endsWith('*')) {
          return (
            <T key={i} face="medium" style={{ fontStyle: 'italic' }}>
              {part.slice(1, -1)}
            </T>
          );
        }
        return part;
      })}
    </T>
  );
}

const styles = StyleSheet.create({
  para: { fontSize: 14, lineHeight: 21, marginBottom: space.sm },
  section: { marginTop: space.md },
  eyebrow: { fontSize: 12, marginBottom: space.sm },
  item: { flexDirection: 'row', gap: space.sm, marginBottom: space.sm, alignItems: 'flex-start' },
  dot: { width: 5, height: 5, borderRadius: 3, marginTop: 8 },
  itemText: { flex: 1, fontSize: 14, lineHeight: 21 },
});
