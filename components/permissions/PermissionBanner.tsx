import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { T } from '@/components/T';
import { GhostButton, Surface } from '@/components/ui';
import { space } from '@/constants/theme';
import { appliesHere } from '@/lib/permissions/defs';
import { isMissing } from '@/lib/permissions/map';
import { usePermissions } from '@/lib/permissions/store';
import type { PermissionId } from '@/lib/permissions/types';
import { t } from '@/lib/i18n';
import { useTheme } from '@/lib/theme/useTheme';

/**
 * "Falta algo" (IMP 16102026 ADR-59): lists the missing permissions among `ids` and sends to Permisos and acceso.
 * Nothing when everything that applies here is in order.
 */
export function PermissionBanner({ ids }: { ids: PermissionId[] }) {
  const router = useRouter();
  const { theme } = useTheme();
  const here = ids.filter((id) => appliesHere(id));
  const states = usePermissions(here);
  const missing = here.filter((id) => states[id] && isMissing(states[id]!.status));
  if (!missing.length) return null;
  return (
    <Surface padded style={styles.box}>
      <T face="semibold" style={{ color: theme.statusText.proximo, fontSize: 14 }}>
        {t.permissions.banner.title(missing.length)}
      </T>
      <T face="body" style={{ color: theme.text.secondary, fontSize: 13, lineHeight: 19 }}>
        {missing.map((id) => t.permissions.items[id].title).join(' · ')}
      </T>
      <View style={{ alignSelf: 'flex-start' }}>
        <GhostButton label={t.permissions.banner.open} onPress={() => router.push('/permisos' as never)} />
      </View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  box: { gap: space.xs, marginBottom: space.md },
});
