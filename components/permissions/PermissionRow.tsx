import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { T } from '@/components/T';
import { Badge, GhostButton, PrimaryButton, Surface, type BadgeTone } from '@/components/ui';
import { space } from '@/constants/theme';
import { defOf } from '@/lib/permissions/defs';
import { canAskInApp, needsSettings } from '@/lib/permissions/map';
import { openPermissionSettings } from '@/lib/permissions/store';
import type { PermissionId, PermissionStatus } from '@/lib/permissions/types';
import { t } from '@/lib/i18n';
import { useTheme } from '@/lib/theme/useTheme';

import { usePermissionRequest } from './usePermissionRequest';

const TONE: Record<PermissionStatus, BadgeTone> = {
  granted: 'green',
  undetermined: 'amber',
  denied_can_ask: 'amber',
  denied_blocked: 'red',
  services_off: 'red',
  unavailable: 'outline',
  unknown: 'outline',
};

/** What the row's button says for a state (null = no button). Pure, for the tests. */
export function rowAction(id: PermissionId, status: PermissionStatus, detail?: string): 'allow' | 'how' | 'settings' | null {
  if (status === 'granted') return detail === 'approximate' ? 'settings' : null;
  if (status === 'unavailable') return null;
  if (id === 'location_background' && detail === 'needs_foreground') return null;
  if (status === 'unknown') return id === 'battery_unrestricted' || id === 'install_unknown_apps' ? 'settings' : null;
  if (needsSettings(status)) return 'how';
  return canAskInApp(status) ? 'allow' : null;
}

/** One line of the Permisos screen (and of the welcome's last step): icon, what for, state, and the one button. */
export function PermissionRow({ id }: { id: PermissionId }) {
  const { theme } = useTheme();
  const { ensure, sheet, status, detail } = usePermissionRequest(id);
  const item = t.permissions.items[id];
  const action = rowAction(id, status, detail);
  return (
    <Surface padded style={styles.row}>
      <View style={styles.top}>
        <Ionicons name={defOf(id).icon as never} size={22} color={theme.accent} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <T face="semibold" style={{ color: theme.text.primary, fontSize: 15 }}>
            {item.title}
          </T>
          <T face="body" style={{ color: theme.text.secondary, fontSize: 13, lineHeight: 18 }}>
            {item.why}
          </T>
        </View>
        <Badge label={t.permissions.states[status]} tone={TONE[status]} />
      </View>
      <T face="body" style={{ color: theme.text.muted, fontSize: 12 }}>
        {item.usedBy}
        {detail ? ` · ${t.permissions.details[detail as keyof typeof t.permissions.details]}` : ''}
      </T>
      {id === 'location_background' && detail === 'needs_foreground' ? (
        <T face="body" style={{ color: theme.statusText.proximo, fontSize: 12 }}>
          {t.permissions.foregroundFirst}
        </T>
      ) : null}
      {action === 'allow' ? <PrimaryButton label={t.permissions.actions.allow} onPress={() => void ensure()} /> : null}
      {action === 'how' ? <GhostButton label={t.permissions.actions.how} onPress={() => void ensure()} /> : null}
      {action === 'settings' ? <GhostButton label={t.permissions.actions.openSettings} onPress={() => void openPermissionSettings(id)} /> : null}
      {sheet}
    </Surface>
  );
}

const styles = StyleSheet.create({
  row: { gap: space.xs, marginBottom: space.sm },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
});
