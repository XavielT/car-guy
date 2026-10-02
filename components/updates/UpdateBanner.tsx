import { useState } from 'react';
import { Platform, Pressable, View } from 'react-native';

import { T } from '@/components/T';
import { GhostButton, PrimaryButton, Surface } from '@/components/ui';
import { space } from '@/constants/theme';
import { Alert } from '@/lib/alert';
import { FEATURE_OTA } from '@/lib/flagsV10';
import { t } from '@/lib/i18n';
import { sizeLabel } from '@/lib/release/apk';
import { useTheme } from '@/lib/theme/useTheme';
import { downloadAndInstall } from '@/lib/updates/apk';
import { applyOta } from '@/lib/updates/ota';
import { setUpdateState, useUpdateState } from '@/lib/updates/store';

/**
 * Top of Inicio (IMP 01102026 Phase 4, 02-screens): "Actualización lista · Reiniciar" for an OTA, or "Nueva
 * versión X · NN MB · Descargar e instalar" for an APK, with progress. One card, never a popup; "Luego"
 * hides it until the next launch.
 */
export function UpdateBanner() {
  const { theme } = useTheme();
  const s = useUpdateState();
  const [hidden, setHidden] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  if (!FEATURE_OTA || Platform.OS === 'web' || hidden) return null;

  if (s.apk) {
    const apk = s.apk;
    const busy = s.progress != null;
    return (
      <Surface padded style={{ gap: space.xs, borderColor: theme.accent, borderWidth: 1 }}>
        <T face="title" style={{ color: theme.text.primary, fontSize: 15, textTransform: 'uppercase' }} accessibilityRole="header">
          {t.updates.apkAvailable(apk.version, sizeLabel(apk.size))}
        </T>
        {s.error ? (
          <T face="body" style={{ color: theme.dangerText, fontSize: 13, lineHeight: 18 }}>
            {t.updates.apkErrors[s.error as keyof typeof t.updates.apkErrors] ?? s.error}
          </T>
        ) : null}
        {busy ? (
          <View style={{ height: 6, borderRadius: 3, backgroundColor: theme.line, overflow: 'hidden', marginVertical: space.xs }}>
            <View style={{ width: `${Math.round((s.progress ?? 0) * 100)}%`, height: '100%', backgroundColor: theme.accentFill }} />
          </View>
        ) : null}
        <PrimaryButton
          label={busy ? t.updates.apkDownloading(Math.round((s.progress ?? 0) * 100)) : t.updates.apkInstall}
          disabled={busy}
          onPress={() => void downloadAndInstall(apk)}
        />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Pressable onPress={() => Alert.alert(t.updates.apkWhyTitle, t.updates.apkWhyBody)} accessibilityRole="button" hitSlop={8}>
            <T face="semibold" style={{ color: theme.accent, fontSize: 13 }}>
              {t.updates.apkWhy}
            </T>
          </Pressable>
          {!busy ? <GhostButton label={t.updates.later} onPress={() => setHidden(true)} /> : null}
        </View>
      </Surface>
    );
  }

  if (s.otaReady) {
    return (
      <Surface padded style={{ gap: space.xs, borderColor: theme.accent, borderWidth: 1 }}>
        <T face="title" style={{ color: theme.text.primary, fontSize: 15, textTransform: 'uppercase' }} accessibilityRole="header">
          {t.updates.otaReady}
        </T>
        {note ? (
          <T face="body" style={{ color: theme.text.secondary, fontSize: 13, lineHeight: 18 }}>
            {note}
          </T>
        ) : null}
        <PrimaryButton
          label={t.updates.otaRestart}
          onPress={() =>
            void applyOta().then((r) => {
              if (r === 'trip') setNote(t.updates.otaTrip);
              if (r === 'none') setUpdateState({ otaReady: false });
            })
          }
        />
      </Surface>
    );
  }
  return null;
}
