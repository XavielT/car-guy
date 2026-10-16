import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { T } from '@/components/T';
import { palette, space } from '@/constants/theme';
import { isMissing } from '@/lib/permissions/map';
import type { PermissionId, PermissionStatus } from '@/lib/permissions/types';
import { t } from '@/lib/i18n';

import { usePermissionRequest } from './usePermissionRequest';

const ink = palette.dark;

/** The chip's words for a state; null = nothing to say (granted, or the platform cannot do it and it is not worth a button). */
export function chipLabel(id: PermissionId, status: PermissionStatus): { label: string; a11y?: string } | null {
  const c = t.permissions.chip;
  const name = t.permissions.items[id].title;
  if (status === 'granted' || status === 'unknown') return null;
  if (status === 'unavailable') return id === 'location_foreground' ? { label: c.unavailable } : null;
  if (status === 'services_off') return { label: c.servicesOff };
  if (status === 'denied_blocked') return { label: id === 'location_foreground' ? c.blocked : c.genericBlocked(name) };
  return id === 'location_foreground' ? { label: c.location, a11y: c.locationA11y } : { label: c.generic(name) };
}

/**
 * A compact button for what is missing (IMP 16102026 ADR-59): over the map, in a bar, next to a function. A tap
 * explains (primer) and then asks, or shows how to turn it on. Renders nothing when there is nothing to fix — and,
 * with `dark`, it is always the dark palette (Modo conducir's sheet and map are dark whatever the app theme).
 */
export function PermissionChip({
  id,
  dark,
  style,
  onGranted,
}: {
  id: PermissionId;
  dark?: boolean;
  style?: StyleProp<ViewStyle>;
  onGranted?: () => void;
}) {
  const { ensure, sheet, status } = usePermissionRequest(id);
  const words = chipLabel(id, status);
  if (!words && !isMissing(status)) return <>{sheet}</>;
  const blocked = status === 'denied_blocked' || status === 'services_off';
  return (
    <>
      {words ? (
        <Pressable
          onPress={() => void ensure().then((ok) => ok && onGranted?.())}
          accessibilityRole="button"
          accessibilityLabel={words.a11y ?? words.label}
          disabled={status === 'unavailable'}
          hitSlop={8}
          style={[styles.chip, { borderColor: blocked ? ink.statusText.proximo : ink.accent, backgroundColor: dark === false ? undefined : 'rgba(18,18,18,0.92)' }, style]}>
          <T face="semibold" style={{ color: status === 'unavailable' ? ink.text.secondary : ink.accent, fontSize: 13 }}>
            {words.label}
          </T>
        </Pressable>
      ) : null}
      {sheet}
    </>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: 'center',
    maxWidth: '92%',
    minHeight: 44,
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: space.md,
    paddingVertical: 8,
  },
});
