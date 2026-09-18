import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { T } from '@/components/T';
import { Surface } from '@/components/ui';
import { radius, space } from '@/constants/theme';
import { es } from '@/lib/i18n/es';
import { useTheme } from '@/lib/theme/useTheme';

/**
 * The guide — and specifically the overheating section, which is the reason
 * this application exists.
 *
 * The copy lives in `es.guide` (PROMPT-06 moved it there with everything else).
 * A paragraph arrives as segments so the emphasis inside it survives the move;
 * `strong` segments take the block's emphasis colour.
 */
type Segment = { readonly text: string; readonly strong?: boolean };

const SECTIONS = [
  es.guide.signs,
  es.guide.ifItOverheats,
  es.guide.whyCoolant,
  es.guide.whyHere,
  es.guide.fluids,
  es.guide.tyres,
  es.guide.lightsBrakes,
  es.guide.diesel,
  es.guide.motorcycle,
] as const;

export default function GuiaScreen() {
  const { theme } = useTheme();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg.base }} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.pad}>
        <T face="display" style={[styles.h, { color: theme.text.primary }]}>
          {es.guide.title}
        </T>

        <View
          style={[
            styles.highlight,
            { backgroundColor: theme.statusBg.urgente, borderColor: theme.status.urgente },
          ]}>
          <T face="title" style={[styles.sectionTitle, { color: theme.status.urgente }]}>
            {es.guide.overheating.title}
          </T>
          <Paragraph
            segments={es.guide.overheating.body}
            color={theme.text.primary}
            emphasis={theme.status.urgente}
          />
        </View>

        {SECTIONS.map((section) => (
          <View key={section.title} style={styles.section}>
            <T face="title" style={[styles.sectionTitle, { color: theme.text.primary }]}>
              {section.title}
            </T>
            {'bullets' in section
              ? section.bullets.map((line) => (
                  <T
                    key={line}
                    face="body"
                    style={[styles.body, { color: theme.text.secondary, marginBottom: 6 }]}>
                    {'·  '}
                    {line}
                  </T>
                ))
              : (
                  <Paragraph
                    segments={section.body}
                    color={theme.text.secondary}
                    emphasis={theme.text.primary}
                  />
                )}
          </View>
        ))}

        <Surface style={{ marginTop: space.xl }}>
          <T face="body" style={{ color: theme.text.muted, fontSize: 12, lineHeight: 18 }}>
            {es.guide.source}
          </T>
        </Surface>
      </ScrollView>
    </SafeAreaView>
  );
}

function Paragraph({
  segments,
  color,
  emphasis,
}: {
  segments: readonly Segment[];
  color: string;
  emphasis: string;
}) {
  return (
    <T face="body" style={[styles.body, { color }]}>
      {segments.map((segment, index) =>
        segment.strong ? (
          <T key={index} face="semibold" style={{ color: emphasis }}>
            {segment.text}
          </T>
        ) : (
          segment.text
        ),
      )}
    </T>
  );
}

const styles = StyleSheet.create({
  pad: { padding: space.gutter, paddingBottom: 48 },
  h: { fontSize: 30, marginBottom: space.lg },
  section: { marginBottom: space.xl },
  sectionTitle: { fontSize: 19, marginBottom: space.sm },
  body: { fontSize: 15, lineHeight: 23 },
  highlight: {
    borderWidth: 1,
    borderRadius: radius.card,
    padding: space.lg,
    marginBottom: space.xl,
  },
});
