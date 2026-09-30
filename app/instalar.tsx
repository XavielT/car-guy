import { useEffect, useState } from 'react';
import { Linking, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { T } from '@/components/T';
import { GhostButton, PrimaryButton, Surface } from '@/components/ui';
import { space } from '@/constants/theme';
import { es } from '@/lib/i18n/es';
import { isAndroidBrowser, sizeLabel, STABLE_APK_URL, type ApkInfo } from '@/lib/release/apk';
import { useTheme } from '@/lib/theme/useTheme';

export const PORTFOLIO_URL = 'https://xaviel-web-v2.vercel.app';

/**
 * /instalar — Car Guy para Android from the web (IMP 29092026 Phase 7, note 17,
 * ADR-34). The button reads version and size from /api/apk and is a plain
 * link to the download (GitHub redirects cross-origin, so no fetch + blob);
 * if the API fails it still points at the stable releases/latest asset.
 * Inside the native app there is nothing to install.
 */
export default function InstalarScreen() {
  const { theme } = useTheme();
  const [apk, setApk] = useState<ApkInfo | null>(null);
  const native = Platform.OS !== 'web';
  const android = !native && isAndroidBrowser(globalThis.navigator as never);

  useEffect(() => {
    if (native) return;
    let live = true;
    fetch('/api/apk')
      .then((r) => (r.ok ? (r.json() as Promise<ApkInfo>) : null))
      .then((j) => live && j?.url && setApk(j))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [native]);

  if (native) {
    return (
      <View style={[styles.pad, { flex: 1, backgroundColor: theme.bg.base }]}>
        <T face="display" style={{ color: theme.text.primary, fontSize: 26, textTransform: 'uppercase' }}>
          {es.install.haveIt}
        </T>
        <T face="body" style={{ color: theme.text.secondary, fontSize: 14, marginTop: space.sm }}>
          {es.install.haveItBody}
        </T>
      </View>
    );
  }

  const size = sizeLabel(apk?.size ?? null);
  const label = apk ? es.install.download(apk.version, size) : es.install.downloadLatest;
  const url = apk?.url ?? STABLE_APK_URL;

  return (
    <ScrollView style={{ backgroundColor: theme.bg.base }} contentContainerStyle={styles.pad}>
      <T face="eyebrow" style={{ color: theme.accent, fontSize: 11 }}>
        {es.install.eyebrow}
      </T>
      <T face="display" accessibilityRole="header" style={{ color: theme.text.primary, fontSize: 28, textTransform: 'uppercase' }}>
        {es.install.title}
      </T>
      <T face="body" style={{ color: theme.text.secondary, fontSize: 14, lineHeight: 20, marginVertical: space.md }}>
        {es.install.intro}
      </T>

      <Surface padded style={{ gap: space.sm }}>
        <a href={url} rel="noopener" style={{ textDecoration: 'none' }} aria-label={label}>
          <View pointerEvents="none">
            <PrimaryButton label={label} onPress={() => undefined} />
          </View>
        </a>
        {!android ? (
          <T face="body" style={{ color: theme.text.muted, fontSize: 12, lineHeight: 17 }}>
            {es.install.notAndroid}
          </T>
        ) : null}
      </Surface>

      <T face="eyebrow" style={{ color: theme.text.muted, fontSize: 11, marginTop: space.lg, marginBottom: space.sm }}>
        {es.install.stepsTitle.toUpperCase()}
      </T>
      <Surface padded style={{ gap: space.md }}>
        {es.install.steps.map((s, i) => (
          <View key={s.title} style={{ gap: 2 }}>
            <T face="semibold" style={{ color: theme.text.primary, fontSize: 15 }}>
              {`${i + 1}. ${s.title}`}
            </T>
            <T face="body" style={{ color: theme.text.secondary, fontSize: 13, lineHeight: 19 }}>
              {s.body}
            </T>
          </View>
        ))}
        <T face="body" style={{ color: theme.text.muted, fontSize: 12, lineHeight: 17 }}>
          {es.install.updates}
        </T>
      </Surface>

      <T face="eyebrow" style={{ color: theme.text.muted, fontSize: 11, marginTop: space.lg, marginBottom: space.sm }}>
        {es.install.pwaTitle.toUpperCase()}
      </T>
      <Surface padded>
        <T face="body" style={{ color: theme.text.secondary, fontSize: 13, lineHeight: 19 }}>
          {es.install.pwaBody}
        </T>
      </Surface>

      <View style={{ marginTop: space.lg }}>
        <GhostButton label={es.install.portfolio} onPress={() => void Linking.openURL(PORTFOLIO_URL)} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: space.gutter, paddingBottom: 48 },
});
