import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { T } from '@/components/T';
import { GhostButton, Sheet, Surface } from '@/components/ui';
import { space } from '@/constants/theme';
import { t } from '@/lib/i18n';
import { currentPlatform, isIosWeb } from '@/lib/platform/capabilities';
import { useTheme } from '@/lib/theme/useTheme';

/**
 * "En iPhone (web)…" (IMP 01102026 ADR-48, notes 2 and 7): on an iPhone the web app cannot record trips in the
 * background — Safari's rule — so it says so where trips are set up (Conducir, Viajes → Ajustes, the welcome's
 * permissions slide). Nothing anywhere else; `dark` for the always-dark drive screen.
 */
export function IosWebBanner({ dark }: { dark?: boolean }) {
  const { theme } = useTheme();
  const [why, setWhy] = useState(false);
  if (!isIosWeb(currentPlatform())) return null;
  const fg = dark ? '#F2F2F2' : theme.text.primary;
  const sub = dark ? 'rgba(242,242,242,0.75)' : theme.text.secondary;
  return (
    <Surface padded style={[styles.box, dark && { backgroundColor: 'rgba(18,18,18,0.92)' }]}>
      <T face="semibold" style={{ color: fg, fontSize: 14, lineHeight: 20 }}>
        {t.platform.iosTitle}
      </T>
      <T face="body" style={{ color: sub, fontSize: 13, lineHeight: 19 }}>
        {t.platform.iosBody}
      </T>
      <View style={{ alignSelf: 'flex-start' }}>
        <GhostButton label={t.platform.iosWhy} onPress={() => setWhy(true)} />
      </View>
      <Sheet visible={why} onClose={() => setWhy(false)} title={t.platform.iosWhyTitle}>
        {t.platform.iosWhyBody.map((p) => (
          <T key={p} face="body" style={{ color: theme.text.secondary, fontSize: 14, lineHeight: 21, marginBottom: space.sm }}>
            {p}
          </T>
        ))}
        <GhostButton label={t.common.close} onPress={() => setWhy(false)} />
      </Sheet>
    </Surface>
  );
}

const styles = StyleSheet.create({
  box: { gap: space.xs, marginBottom: space.md },
});
