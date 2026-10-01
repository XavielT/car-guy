import { Stack, useRouter } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { T } from '@/components/T';
import { NavRow, SectionHeader, Surface } from '@/components/ui';
import { space } from '@/constants/theme';
import { dateLabel } from '@/lib/format';
import { t } from '@/lib/i18n';
import { LEGAL_DATE, LEGAL_VERSION, latestAcceptance, legalRoute } from '@/lib/legal';
import { useLegalAcceptance } from '@/lib/legal/acceptance';
import { useTheme } from '@/lib/theme/useTheme';

/** Más → Legal (03-screens.md Phase 6): Términos · Privacidad · Eliminar mi cuenta · Licencias. */
export default function LegalIndex() {
  const router = useRouter();
  const { theme } = useTheme();
  const { rows } = useLegalAcceptance();
  const accepted = rows ? latestAcceptance(rows) : null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg.base }} edges={['bottom']}>
      <Stack.Screen options={{ headerShown: true, title: t.legalUi.title }} />
      <ScrollView contentContainerStyle={styles.pad}>
        <T face="body" style={{ color: theme.text.secondary, fontSize: 14, lineHeight: 20 }}>
          {t.legalUi.intro}
        </T>
        <T face="mono" style={{ color: theme.text.muted, fontSize: 12, marginTop: space.xs, marginBottom: space.lg }}>
          {[t.legalUi.versionLine(LEGAL_VERSION, dateLabel(LEGAL_DATE)), accepted?.version === LEGAL_VERSION ? t.legalUi.acceptedLine(dateLabel(accepted.acceptedAt)) : t.legalUi.notAccepted].join(' · ')}
        </T>
        <NavRow label={t.legalUi.terms} onPress={() => router.push(legalRoute('terminos') as never)} />
        <NavRow label={t.legalUi.privacy} onPress={() => router.push(legalRoute('privacidad') as never)} />
        <NavRow
          label={t.legalUi.deleteAccount}
          caption={t.legalUi.deleteAccountCaption}
          onPress={() => router.push(legalRoute('eliminar-cuenta') as never)}
        />
        <SectionHeader title={t.legalUi.licenses} />
        <Surface>
          <T face="body" style={{ color: theme.text.secondary, fontSize: 13, lineHeight: 19 }}>
            {t.legalUi.licensesBody}
          </T>
        </Surface>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: space.gutter, paddingBottom: 48 },
});
