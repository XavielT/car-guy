import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { PermissionRow } from '@/components/permissions/PermissionRow';
import { T } from '@/components/T';
import { GhostButton } from '@/components/ui';
import { space } from '@/constants/theme';
import { isMissing } from '@/lib/permissions/map';
import { permissionsHere } from '@/lib/permissions/defs';
import { recheckPermissions, usePermissions } from '@/lib/permissions/store';
import { t } from '@/lib/i18n';
import { useTheme } from '@/lib/theme/useTheme';

/**
 * Permisos y acceso (IMP 16102026 ADR-59, SPEC-A, notes N2 and N3): one row per permission that exists on this
 * platform — what it is for, its state, and the button that fixes it. It re-reads whenever the app comes back (the
 * registry does), and "Revisar de nuevo" forces it. The same rows are the last step of the welcome.
 */
export default function PermisosScreen() {
  const { theme } = useTheme();
  const ids = permissionsHere();
  const states = usePermissions(ids);
  const [busy, setBusy] = useState(false);
  const missing = ids.filter((id) => states[id] && isMissing(states[id]!.status)).length;
  const recheck = useCallback(async () => {
    setBusy(true);
    await recheckPermissions(ids);
    setBusy(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <ScrollView style={{ backgroundColor: theme.bg.base }} contentContainerStyle={styles.pad}>
      <T face="eyebrow" style={{ color: theme.accent, fontSize: 11 }}>
        {t.permissions.eyebrow}
      </T>
      <T face="display" accessibilityRole="header" style={{ color: theme.text.primary, fontSize: 28, textTransform: 'uppercase' }}>
        {t.permissions.title}
      </T>
      <T face="body" style={{ color: theme.text.secondary, fontSize: 14, lineHeight: 20, marginVertical: space.md }}>
        {t.permissions.intro}
      </T>
      <T face="semibold" style={{ color: missing ? theme.statusText.proximo : theme.statusText.ok, fontSize: 14, marginBottom: space.md }}>
        {missing ? t.permissions.allMissing(missing) : t.permissions.allGood}
      </T>
      {ids.map((id) => (
        <PermissionRow key={id} id={id} />
      ))}
      <View style={{ marginTop: space.md }}>
        <GhostButton label={t.permissions.recheck} onPress={() => void recheck()} disabled={busy} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: space.gutter, paddingBottom: 48 },
});
