import { usePathname, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { T } from '@/components/T';
import { GhostButton, NavRow, PrimaryButton, Sheet } from '@/components/ui';
import { space } from '@/constants/theme';
import { useVersionSeen } from '@/lib/changelog/seen';
import { isUpdate, legalRoute, sheetAllowedOn } from '@/lib/legal';
import { dismissForSession, recordAcceptance, useLegalAcceptance } from '@/lib/legal/acceptance';
import { t } from '@/lib/i18n';
import { useTheme } from '@/lib/theme/useTheme';

/** How long a screen must stay put before the sheet opens (a first launch redirects to /bienvenida). */
const SETTLE_MS = 900;

/**
 * "Términos y privacidad" (ADR-47): once per LEGAL_VERSION, on the first launch after 2.4.0 and on
 * a new install, with the two texts and **Acepto** → a legal_acceptance row. It blocks nothing:
 * "Ahora no" (or the scrim) hides it until the next launch; only creating an account needs the
 * acceptance. Never over the Novedades sheet, the welcome flow or the legal screens. Mounted once,
 * in the root shell.
 */
export function LegalSheet() {
  const router = useRouter();
  const pathname = usePathname();
  const { theme } = useTheme();
  const { rows, needs, dismissed } = useLegalAcceptance();
  const { loaded, sheetOpen } = useVersionSeen();
  const allowed = sheetAllowedOn(pathname);
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    if (!allowed) return;
    const timer = setTimeout(() => setSettled(true), SETTLE_MS);
    return () => {
      clearTimeout(timer);
      setSettled(false);
    };
  }, [allowed, pathname]);

  const visible = Boolean(rows) && needs && !dismissed && loaded && !sheetOpen && allowed && settled;
  const updated = rows ? isUpdate(rows) : false;

  const open = (doc: 'terminos' | 'privacidad') => {
    // Reading is not refusing: the sheet comes back after the text unless they accept there.
    router.push(legalRoute(doc) as never);
  };

  return (
    <Sheet visible={visible} onClose={dismissForSession} title={updated ? t.legalUi.sheetUpdatedTitle : t.legalUi.sheetTitle}>
      <T face="body" style={[styles.body, { color: theme.text.secondary }]}>
        {updated ? t.legalUi.sheetUpdatedBody : t.legalUi.sheetBody}
      </T>
      <NavRow label={t.legalUi.terms} onPress={() => open('terminos')} />
      <NavRow label={t.legalUi.privacy} onPress={() => open('privacidad')} />
      <T face="body" style={[styles.hint, { color: theme.text.muted }]}>
        {t.legalUi.sheetHint}
      </T>
      <View style={styles.actions}>
        <PrimaryButton label={t.legalUi.accept} onPress={() => void recordAcceptance()} />
        <GhostButton label={t.legalUi.notNow} onPress={dismissForSession} />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { fontSize: 14, lineHeight: 21, marginBottom: space.md },
  hint: { fontSize: 12, marginTop: space.xs },
  actions: { marginTop: space.md, gap: space.xs },
});
