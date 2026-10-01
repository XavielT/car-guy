import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Linking, StyleSheet, View, type TextStyle } from 'react-native';

import { T } from '@/components/T';
import { space } from '@/constants/theme';
import { inAppHref, legalRoute } from '@/lib/legal';
import { inlineText, parseMarkdown, safeHref, type Inline } from '@/lib/legal/markdown';
import { useTheme } from '@/lib/theme/useTheme';

/**
 * A legal text (content/legal/*.md) drawn with the app's type — the same blocks the public page
 * renders as HTML (lib/legal/markdown.ts), so Más → Legal and /terminos never say different things.
 * Links to the other texts open in-app; web and mail links leave the app.
 */
export function LegalMarkdown({ markdown }: { markdown: string }) {
  const { theme } = useTheme();
  const router = useRouter();
  const blocks = useMemo(() => parseMarkdown(markdown), [markdown]);

  const follow = (href: string) => {
    const target = inAppHref(href);
    if (target.kind === 'doc') router.push(legalRoute(target.doc) as never);
    else if (target.kind === 'route') router.push(target.path as never);
    else void Linking.openURL(target.url);
  };

  const inline = (nodes: readonly Inline[], key = 'n'): React.ReactNode[] =>
    nodes.map((n, i) => {
      const k = `${key}.${i}`;
      switch (n.type) {
        case 'text':
          return n.text;
        case 'code':
          return (
            <T key={k} face="mono" style={{ fontSize: 14 }}>
              {n.text}
            </T>
          );
        case 'strong':
          return (
            <T key={k} face="semibold" style={{ color: theme.text.primary }}>
              {inline(n.children, k)}
            </T>
          );
        case 'em':
          return (
            <T key={k} face="medium" style={{ fontStyle: 'italic' }}>
              {inline(n.children, k)}
            </T>
          );
        case 'link': {
          const href = safeHref(n.href);
          if (!href) return <T key={k}>{inline(n.children, k)}</T>;
          return (
            <T
              key={k}
              face="semibold"
              accessibilityRole="link"
              onPress={() => follow(href)}
              style={{ color: theme.accent, textDecorationLine: 'underline' }}>
              {inline(n.children, k)}
            </T>
          );
        }
      }
    });

  const para: TextStyle = { color: theme.text.secondary, fontSize: 15, lineHeight: 23 };

  return (
    <View>
      {blocks.map((b, i) => {
        const key = `b${i}`;
        switch (b.type) {
          case 'heading':
            return b.level === 1 ? (
              <T key={key} face="display" accessibilityRole="header" style={[styles.h1, { color: theme.text.primary }]}>
                {inlineText(b.children)}
              </T>
            ) : (
              <T
                key={key}
                face={b.level === 2 ? 'title' : 'semibold'}
                accessibilityRole="header"
                style={[b.level === 2 ? styles.h2 : styles.h3, { color: b.level === 2 ? theme.accent : theme.text.primary }]}>
                {inlineText(b.children)}
              </T>
            );
          case 'paragraph':
            return (
              <T key={key} face="body" style={[para, styles.block]}>
                {inline(b.children, key)}
              </T>
            );
          case 'quote':
            return (
              <View key={key} style={[styles.quote, { backgroundColor: theme.bg.surface, borderLeftColor: theme.accent }]}>
                <T face="body" style={[para, { color: theme.text.primary }]}>
                  {inline(b.children, key)}
                </T>
              </View>
            );
          case 'rule':
            return <View key={key} style={[styles.rule, { backgroundColor: theme.line }]} />;
          case 'list':
            return (
              <View key={key} style={styles.block}>
                {b.items.map((item, j) => (
                  <View key={`${key}.${j}`} style={styles.item}>
                    {b.ordered ? (
                      <T face="monoBold" style={[styles.marker, { color: theme.accent }]}>
                        {`${j + 1}.`}
                      </T>
                    ) : (
                      <View style={[styles.dot, { backgroundColor: theme.accent }]} />
                    )}
                    <T face="body" style={[para, { flex: 1 }]}>
                      {inline(item, `${key}.${j}`)}
                    </T>
                  </View>
                ))}
              </View>
            );
        }
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  h1: { fontSize: 26, lineHeight: 30, textTransform: 'uppercase', marginBottom: space.sm },
  h2: { fontSize: 18, letterSpacing: 0.6, textTransform: 'uppercase', marginTop: space.xl, marginBottom: space.sm },
  h3: { fontSize: 16, marginTop: space.lg, marginBottom: space.xs },
  block: { marginBottom: space.md },
  quote: { borderLeftWidth: 4, borderRadius: 6, padding: space.md, marginVertical: space.md },
  rule: { height: 1, marginVertical: space.lg },
  item: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, marginBottom: space.xs },
  dot: { width: 6, height: 6, borderRadius: 3, marginTop: 9 },
  marker: { fontSize: 14, lineHeight: 23, minWidth: 18 },
});
