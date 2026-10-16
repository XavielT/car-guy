import { Platform, StyleSheet, View } from 'react-native';

import { T } from '@/components/T';
import { GhostButton, PrimaryButton, Sheet } from '@/components/ui';
import { space } from '@/constants/theme';
import { t } from '@/lib/i18n';
import { currentPlatform as detectPlatform, isIosWeb } from '@/lib/platform/capabilities';
import { openPermissionSettings, recheckPermissions } from '@/lib/permissions/store';
import type { PermissionId, PermissionStatus } from '@/lib/permissions/types';
import { useTheme } from '@/lib/theme/useTheme';

/**
 * When the person has to change it themselves (IMP 16102026 N3): the exact way, and one button that works.
 * - Android: what to choose in Car Guy's settings + "Abrir ajustes" (the registry re-reads when the app returns).
 * - iPhone / web: a page cannot open iOS's or the browser's settings, so numbered steps + "Ya la activé", which reads
 *   the state again. (The iPhone wording is not verified on a real phone yet — PROGRESS → No verificado.)
 * - Location services off: the phone's switch, Android or not.
 */
export function PermissionStepsSheet({
  id,
  status,
  visible,
  onClose,
}: {
  id: PermissionId;
  status: PermissionStatus;
  visible: boolean;
  onClose: () => void;
}) {
  const { theme } = useTheme();
  const native = Platform.OS !== 'web';
  const item = t.permissions.items[id];
  const steps =
    status === 'services_off'
      ? t.permissions.steps.servicesOff
      : native
        ? [t.permissions.steps.androidSettings(item.title)]
        : isIosWeb(detectPlatform())
          ? t.permissions.steps.iphone
          : t.permissions.steps.web;

  return (
    <Sheet visible={visible} onClose={onClose} title={t.permissions.steps.title}>
      <T face="body" style={[styles.intro, { color: theme.text.secondary }]}>
        {t.permissions.steps.intro}
      </T>
      {steps.map((step, i) => (
        <T key={step} face="body" style={[styles.step, { color: theme.text.primary }]}>
          {steps.length > 1 ? `${i + 1}. ` : ''}
          {step}
        </T>
      ))}
      <View style={styles.actions}>
        {native ? (
          <PrimaryButton
            label={t.permissions.actions.openSettings}
            onPress={() => {
              void openPermissionSettings(id);
            }}
          />
        ) : null}
        <PrimaryButton
          label={t.permissions.actions.done}
          onPress={() => {
            onClose();
            void recheckPermissions([id]);
          }}
        />
        <GhostButton label={t.permissions.actions.close} onPress={onClose} />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  intro: { fontSize: 14, lineHeight: 21, marginBottom: space.sm },
  step: { fontSize: 15, lineHeight: 22, marginBottom: space.sm },
  actions: { gap: space.sm, marginTop: space.md },
});
