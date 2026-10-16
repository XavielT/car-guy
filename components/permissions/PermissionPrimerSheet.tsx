import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { T } from '@/components/T';
import { GhostButton, PrimaryButton, Sheet } from '@/components/ui';
import { space } from '@/constants/theme';
import { defOf } from '@/lib/permissions/defs';
import type { PermissionId } from '@/lib/permissions/types';
import { t } from '@/lib/i18n';
import { useTheme } from '@/lib/theme/useTheme';

/**
 * The explanation before the system dialog (IMP 16102026 ADR-59, SPEC-A principle 1). On an iPhone a "No permitir"
 * cannot be asked again from the page, so this is the one chance to say why. "Permitir" shows the system dialog (or
 * Android's settings page); "Ahora no" asks nothing — the function that needed it explains what is missing instead.
 */
export function PermissionPrimerSheet({
  id,
  visible,
  onAllow,
  onNotNow,
}: {
  id: PermissionId;
  visible: boolean;
  onAllow: () => void;
  onNotNow: () => void;
}) {
  const { theme } = useTheme();
  const item = t.permissions.items[id];
  return (
    <Sheet visible={visible} onClose={onNotNow} title={item.primerTitle}>
      <View style={styles.row}>
        <Ionicons name={defOf(id).icon as never} size={28} color={theme.accent} />
        <T face="body" style={[styles.body, { color: theme.text.primary }]}>
          {item.primerBody}
        </T>
      </View>
      {id === 'location_background' ? (
        <View style={styles.steps}>
          {t.permissions.backgroundSteps.map((step, i) => (
            <T key={step} face="body" style={{ color: theme.text.secondary, fontSize: 14, lineHeight: 21 }}>
              {i + 1}. {step}
            </T>
          ))}
        </View>
      ) : null}
      {id === 'battery_unrestricted' ? (
        <T face="body" style={{ color: theme.text.secondary, fontSize: 13, lineHeight: 19, marginBottom: space.sm }}>
          {t.permissions.batteryNote}
        </T>
      ) : null}
      <View style={styles.actions}>
        <PrimaryButton label={item.primerAllow} onPress={onAllow} />
        <GhostButton label={t.permissions.actions.notNow} onPress={onNotNow} />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start', marginBottom: space.md },
  body: { flex: 1, fontSize: 15, lineHeight: 22 },
  steps: { gap: space.xs, marginBottom: space.md },
  actions: { gap: space.sm, marginTop: space.sm },
});
