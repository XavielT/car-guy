import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

import { T } from '@/components/T';
import { palette, space } from '@/constants/theme';
import { t } from '@/lib/i18n';

const ink = palette.dark;

/**
 * What the drive-mode map shows when no map style loads (offline, provider down) — IMP 16102026 M-8. It used to be a
 * black box with one line of text over it. Now the box says where you are (the coordinates, if there is a fix) and
 * has a "Reintentar" that checks the map again; the trip records either way.
 */
export function OfflineMap({
  me,
  onRetry,
}: {
  me?: { lat: number; lng: number } | null;
  onRetry: () => void;
}) {
  return (
    <View style={styles.box} accessibilityRole="summary">
      <Ionicons name="cloud-offline-outline" size={30} color={ink.text.muted} />
      {me ? (
        <T face="mono" style={styles.coords}>
          {t.drive.offlineHere(me.lat.toFixed(4), me.lng.toFixed(4))}
        </T>
      ) : null}
      <Pressable
        onPress={onRetry}
        accessibilityRole="button"
        accessibilityLabel={t.drive.offlineRetry}
        hitSlop={8}
        style={[styles.retry, { borderColor: ink.accent }]}>
        <T face="semibold" style={{ color: ink.accent, fontSize: 13 }}>
          {t.drive.offlineRetry}
        </T>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flex: 1, backgroundColor: '#0B0B0D', alignItems: 'center', justifyContent: 'center', gap: space.sm, paddingBottom: 140 },
  coords: { color: palette.dark.text.secondary, fontSize: 13 },
  retry: { borderWidth: 1, borderRadius: 14, paddingHorizontal: space.md, minHeight: 44, justifyContent: 'center' },
});
