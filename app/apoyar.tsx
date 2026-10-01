import { useEffect, useState } from 'react';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';

import { T } from '@/components/T';
import { PrimaryButton, Surface } from '@/components/ui';
import { space } from '@/constants/theme';
import { readSupportConfig, type SupportConfig } from '@/lib/cloud/appConfig';
import { PRO_USD } from '@/lib/domain/usage';
import { monthLabel } from '@/lib/format';
import { t } from '@/lib/i18n';
import { useTheme } from '@/lib/theme/useTheme';

/**
 * Más → Apoyar Car Guy (IMP 01102026 Phase 4, note 4, ADR-53): why it costs anything, what it costs this
 * month (the admin meter publishes it), how to support (links the admin set; bank details otherwise;
 * "Pronto" when nothing is set), and an opt-in thanks list. No tracking, no ads, never a popup.
 */
export default function ApoyarScreen() {
  const { theme } = useTheme();
  const [cfg, setCfg] = useState<SupportConfig | null>(null);
  useEffect(() => {
    void readSupportConfig().then(setCfg);
  }, []);
  const text = cfg?.text;

  return (
    <ScrollView style={{ backgroundColor: theme.bg.base }} contentContainerStyle={styles.pad}>
      <T face="eyebrow" style={{ color: theme.accent, fontSize: 11 }}>
        {t.support.eyebrow}
      </T>
      <T face="display" accessibilityRole="header" style={{ color: theme.text.primary, fontSize: 28, textTransform: 'uppercase', marginBottom: space.md }}>
        {t.support.title}
      </T>
      <T face="body" style={[styles.p, { color: theme.text.secondary }]}>
        {t.support.why}
      </T>

      {text ? (
        <Surface padded style={{ gap: 6, marginBottom: space.lg }}>
          <T face="semibold" style={{ color: theme.text.primary, fontSize: 15, lineHeight: 21 }}>
            {t.support.costNow(text.cost_usd)}
          </T>
          <T face="body" style={{ color: theme.text.secondary, fontSize: 14, lineHeight: 20 }}>
            {text.pro_eta === 'reached'
              ? t.support.proReached(text.pro_usd ?? PRO_USD)
              : text.pro_eta
                ? t.support.proEta(text.pro_usd ?? PRO_USD, monthLabel(text.pro_eta))
                : t.support.proFar}
          </T>
          <T face="mono" style={{ color: theme.text.muted, fontSize: 11 }}>
            {t.support.updated(monthLabel(text.month))}
          </T>
        </Surface>
      ) : null}

      <T face="eyebrow" style={[styles.h, { color: theme.text.muted }]}>
        {t.support.links}
      </T>
      {cfg?.links.length ? (
        <View style={{ gap: space.sm, marginBottom: space.md }}>
          {cfg.links.map((l) => (
            <PrimaryButton key={l.url} label={l.label} onPress={() => void Linking.openURL(l.url)} />
          ))}
        </View>
      ) : null}
      {cfg?.bank ? (
        <Surface padded style={{ marginBottom: space.md }}>
          <T face="eyebrow" style={{ color: theme.text.muted, fontSize: 11, marginBottom: 4 }}>
            {t.support.bank}
          </T>
          <T face="mono" selectable style={{ color: theme.text.primary, fontSize: 13, lineHeight: 20 }}>
            {cfg.bank}
          </T>
        </Surface>
      ) : null}
      {!cfg?.links.length && !cfg?.bank ? (
        <T face="body" style={[styles.p, { color: theme.text.muted }]}>
          {t.support.soon}
        </T>
      ) : null}
      <T face="body" style={[styles.p, { color: theme.text.muted, fontSize: 13 }]}>
        {t.support.nothingChanges}
      </T>

      <T face="eyebrow" style={[styles.h, { color: theme.text.muted }]}>
        {t.support.thanks}
      </T>
      {cfg?.thanks.length ? (
        <>
          <T face="body" style={{ color: theme.text.muted, fontSize: 13, marginBottom: space.sm }}>
            {t.support.thanksCaption}
          </T>
          <T face="semibold" style={{ color: theme.text.primary, fontSize: 15, lineHeight: 24 }}>
            {cfg.thanks.join(' · ')}
          </T>
        </>
      ) : (
        <T face="body" style={{ color: theme.text.muted, fontSize: 13 }}>
          {t.support.thanksAsk}
        </T>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: space.gutter, paddingBottom: 48 },
  p: { fontSize: 14, lineHeight: 21, marginBottom: space.md },
  h: { fontSize: 11, marginTop: space.md, marginBottom: space.sm },
});
