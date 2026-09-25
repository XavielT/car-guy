import { useEffect, useState } from 'react';
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

  // When the first merge finishes, the banner stays a moment to say what it
  // did — "Se agregaron 2 vehículos desde la nube" — and then leaves.
  const done = status.state === 'idle' ? status.firstLogin : undefined;
  // Which result has already had its moment; state changes only in the timer.
  const [expired, setExpired] = useState<typeof done>(undefined);
  useEffect(() => {
    if (!done) return;
    const timer = setTimeout(() => setExpired(done), RESULT_MS);
    return () => clearTimeout(timer);
  }, [done]);
  const shown = done && expired !== done ? done : undefined;

  if (!FEATURE_SYNC) return null;
  const running = status.state === 'running' && status.reason === 'first-login';
  if (!running && !shown) return null;

  const title = running ? es.sync.firstLoginTitle : es.sync.firstLoginDoneTitle;
  const body = running
    ? es.sync.firstLoginBody
    : shown!.vehiclesAdded > 0
      ? es.sync.vehiclesAdded(shown!.vehiclesAdded)
      : es.sync.uploaded(shown!.pushed);

  return (
    <View
      pointerEvents="none"
      accessibilityRole="alert"
      style={[
        styles.wrap,
        { bottom: insets.bottom + space.xl, backgroundColor: theme.bg.raised, borderColor: theme.line },
      ]}>
      {running ? <ActivityIndicator color={theme.accent} /> : null}
      <View style={{ flex: 1 }}>
        <T face="semibold" style={{ color: theme.text.primary, fontSize: 14 }}>
          {title}
        </T>
        <T face="body" style={{ color: theme.text.secondary, fontSize: 12, marginTop: 2, lineHeight: 17 }}>
          {body}
        </T>
      </View>
    </View>
  );
}

const RESULT_MS = 6_000;

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
