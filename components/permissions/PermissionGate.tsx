import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { T } from '@/components/T';
import { Surface } from '@/components/ui';
import { space } from '@/constants/theme';
import type { PermissionId } from '@/lib/permissions/types';
import { usePermission } from '@/lib/permissions/store';
import { t } from '@/lib/i18n';
import { useTheme } from '@/lib/theme/useTheme';

import { PermissionChip } from './PermissionChip';

/**
 * Wraps a function that needs a permission (IMP 16102026 ADR-59): the children when it is there; otherwise the
 * `fallback`, or a card that says what the function needs it for and carries the button that fixes it. Nothing is
 * asked by merely mounting this — the button explains first.
 */
export function PermissionGate({
  id,
  children,
  fallback,
}: {
  id: PermissionId;
  children: ReactNode;
  /** Replaces the default card; render a `PermissionChip` in it if you still want the button. */
  fallback?: ReactNode;
}) {
  const { theme } = useTheme();
  const { status, loaded } = usePermission(id);
  if (!loaded) return null;
  if (status === 'granted' || status === 'unknown') return <>{children}</>;
  if (fallback !== undefined) return <>{fallback}</>;
  const item = t.permissions.items[id];
  return (
    <Surface padded style={styles.card}>
      <T face="semibold" style={{ color: theme.text.primary, fontSize: 15 }}>
        {item.title}
      </T>
      <T face="body" style={{ color: theme.text.secondary, fontSize: 14, lineHeight: 20 }}>
        {item.why}
      </T>
      <View style={styles.chip}>
        <PermissionChip id={id} />
      </View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.xs, marginBottom: space.md },
  chip: { alignItems: 'flex-start', marginTop: space.xs },
});
