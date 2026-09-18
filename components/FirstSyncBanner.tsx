import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { T } from '@/components/T';
import { radius, space } from '@/constants/theme';
import { FEATURE_SYNC } from '@/lib/flags';
import { es } from '@/lib/i18n/es';
import { useSync } from '@/lib/sync/useSync';
import { useTheme } from '@/lib/theme/useTheme';

/**
 * "Sincronizando tu garaje…" — the one sync the user is waiting on.
 *
 * Only the first sync after signing in gets a banner. Every later sync is
 * background work reported by the pill on Más, because a driver who logs a
 * fill-up does not need to be told the network is busy.
 *
 * Deliberately *not* a modal. The first pull on a phone with years of history
 * can take a while, and the copy promises the app stays usable — a sheet that
 * blocked the screen would make that a lie. It also cannot be dismissed: there
 * is nothing to decide, and it leaves on its own.
 */
export function FirstSyncBanner() {
  const { status } = useSync();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  if (!FEATURE_SYNC) return null;
  if (status.state !== 'running' || status.reason !== 'first-login') return null;

  return (
    <View
      pointerEvents="none"
      accessibilityRole="alert"
      style={[
        styles.wrap,
        { bottom: insets.bottom + space.xl, backgroundColor: theme.bg.raised, borderColor: theme.line },
      ]}>
      <ActivityIndicator color={theme.accent} />
      <View style={{ flex: 1 }}>
        <T face="semibold" style={{ color: theme.text.primary, fontSize: 14 }}>
          {es.sync.firstLoginTitle}
        </T>
        <T face="body" style={{ color: theme.text.secondary, fontSize: 12, marginTop: 2, lineHeight: 17 }}>
          {es.sync.firstLoginBody}
        </T>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: space.lg,
    right: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
