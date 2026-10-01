import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LegalMarkdown } from '@/components/legal/LegalMarkdown';
import { T } from '@/components/T';
import { EmptyState, GhostButton, PrimaryButton } from '@/components/ui';
import { space } from '@/constants/theme';
import { useSession } from '@/lib/cloud/auth';
import { dateLabel } from '@/lib/format';
import { t, useLanguage } from '@/lib/i18n';
import { LEGAL_DOC_IDS, latestAcceptance, legalMarkdown, type LegalDocId } from '@/lib/legal';
import { recordAcceptance, useLegalAcceptance } from '@/lib/legal/acceptance';
import { titleOf } from '@/lib/legal/markdown';
import { useTheme } from '@/lib/theme/useTheme';

const SITE = 'https://car-guy.vercel.app';

/**
 * Más → Legal → one text (ADR-47): the bundled Markdown (lib/legal/content.generated.ts, built from
 * content/legal/*.md — the same source as the public page), in the app's language; the text states its version.
 * Terms and privacy carry "Acepto" until the current version is accepted; the deletion text leads
 * to Cuenta → Eliminar cuenta when signed in.
 */
export default function LegalDocScreen() {
  const { doc: raw } = useLocalSearchParams<{ doc: string }>();
  const { theme } = useTheme();
  const router = useRouter();
  const { resolved } = useLanguage();
  const { session } = useSession();
  const { rows, needs } = useLegalAcceptance();
  const doc = (LEGAL_DOC_IDS as readonly string[]).includes(raw ?? '') ? (raw as LegalDocId) : null;

  if (!doc) {
    return (
      <View style={[styles.centre, { backgroundColor: theme.bg.base }]}>
        <Stack.Screen options={{ headerShown: true, title: t.legalUi.title }} />
        <EmptyState icon="document-text-outline" message={t.legalUi.notFound} />
      </View>
    );
  }

  const markdown = legalMarkdown(doc, resolved);
  const accepted = rows ? latestAcceptance(rows) : null;
  const acceptable = doc !== 'eliminar-cuenta';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg.base }} edges={['bottom']}>
      <Stack.Screen options={{ headerShown: true, title: titleOf(markdown) }} />
      <ScrollView contentContainerStyle={styles.pad}>
        <LegalMarkdown markdown={markdown} />

        <View style={[styles.rule, { backgroundColor: theme.line }]} />
        {acceptable ? (
          needs ? (
            <PrimaryButton label={t.legalUi.accept} onPress={() => void recordAcceptance()} />
          ) : accepted ? (
            <T face="body" style={{ color: theme.statusText.ok, fontSize: 13 }}>
              {t.legalUi.acceptedLine(dateLabel(accepted.acceptedAt))}
            </T>
          ) : null
        ) : session ? (
          <PrimaryButton label={t.deleteAccount.entry} onPress={() => router.push('/borrar-cuenta')} />
        ) : null}
        <GhostButton
          label={t.legalUi.openWeb}
          onPress={() => void Linking.openURL(`${SITE}/${doc}${resolved === 'en' ? '?lang=en' : ''}`)}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: space.gutter, paddingBottom: 48 },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.gutter },
  rule: { height: 1, marginVertical: space.lg },
});
