import { StyleSheet, View } from 'react-native';

import { T } from '@/components/T';
import { palette } from '@/constants/theme';
import { LOW_CONFIDENCE } from '@/lib/ai/read';
import { t } from '@/lib/i18n';
import { useTheme } from '@/lib/theme/useTheme';

/**
 * The small "IA" mark next to a field the AI filled (IMP 03112026 SPEC-B §B2, ADR-67). An unsure read
 * (confidence < 0.6) also says "Revísalo". The mark lives only on the screen: editing the field clears it
 * (`withoutMark`), and it is never part of the saved record.
 */
export function AiFieldMark({ confidence }: { confidence: number | undefined }) {
  const { theme } = useTheme();
  if (confidence == null) return null;
  const unsure = confidence < LOW_CONFIDENCE;
  return (
    <View
      accessible
      accessibilityLabel={unsure ? `${t.ai.mark.ai}. ${t.ai.mark.check}` : t.ai.mark.filled}
      style={[styles.pill, { borderColor: unsure ? palette.dark.accent : theme.line, backgroundColor: theme.bg.raised }]}>
      <T face="monoBold" style={{ fontSize: 10, color: unsure ? theme.accent : theme.text.secondary }}>
        {unsure ? `${t.ai.mark.ai} · ${t.ai.mark.check}` : t.ai.mark.ai}
      </T>
    </View>
  );
}

/** The amber outline an unsure AI field gets; spread into the field's style. */
export function aiOutline(confidence: number | undefined, accent: string) {
  return confidence != null && confidence < LOW_CONFIDENCE ? { borderColor: accent, borderWidth: 2 } : null;
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginBottom: 4,
  },
});
