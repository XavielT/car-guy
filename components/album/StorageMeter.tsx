import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { T } from '@/components/T';
import { radius, space } from '@/constants/theme';
import { useSession } from '@/lib/cloud/auth';
import { backedUpCount } from '@/lib/db/albumQueries';
import { formatBytes } from '@/lib/domain/album';
import { FEATURE_SYNC } from '@/lib/flags';
import { t } from '@/lib/i18n';
import { meterLevel, readStorageMeter, type StorageMeter as Meter } from '@/lib/sync/storageMeter';
import { useTheme } from '@/lib/theme/useTheme';

/**
 * The cloud photo meter (Album artboard, bottom): "146 fotos respaldadas en tu
 * cuenta · 42 MB de 300 MB" with a bar. Amber at 90 %, red and a plain-Spanish
 * explanation at 100 % — uploads pause, the phone keeps every photo.
 * Signed out it says where the photos live instead.
 */
export function StorageMeter({ vehicleId, style }: { vehicleId?: string; style?: StyleProp<ViewStyle> }) {
  const { theme } = useTheme();
  const { session } = useSession();
  const [meter, setMeter] = useState<Meter | null>(null);
  const [backed, setBacked] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    void readStorageMeter().then((m) => !cancelled && setMeter(m));
    if (vehicleId) void backedUpCount(vehicleId).then((n) => !cancelled && setBacked(n));
    return () => {
      cancelled = true;
    };
  }, [vehicleId, session]);

  const signedIn = FEATURE_SYNC && Boolean(session);
  const level = meter ? meterLevel(meter) : 'ok';
  const ratio = meter?.quotaBytes ? Math.min(1, meter.usedBytes / meter.quotaBytes) : 0;
  const barColor = level === 'full' ? theme.redline : level === 'warn' ? theme.accentFill : theme.statusText.ok;

  return (
    <View
      accessible
      accessibilityLabel={signedIn && meter?.quotaBytes ? `${t.album.storageOf(formatBytes(meter.usedBytes), formatBytes(meter.quotaBytes))}` : t.album.storageLocal}
      style={[styles.box, { backgroundColor: theme.bg.surface, borderColor: level === 'full' ? theme.redline : theme.lineStrong }, style]}>
      <Ionicons name={signedIn ? 'cloud-done-outline' : 'phone-portrait-outline'} size={20} color={theme.text.secondary} />
      <View style={{ flex: 1 }}>
        {signedIn ? (
          <>
            {backed != null ? (
              <T face="semibold" style={{ color: theme.text.primary, fontSize: 13 }}>
                {t.album.storageBacked(backed)}
              </T>
            ) : null}
            {meter?.quotaBytes ? (
              <T face="mono" style={{ color: theme.text.muted, fontSize: 11 }}>
                {t.album.storageOf(formatBytes(meter.usedBytes), formatBytes(meter.quotaBytes))}
              </T>
            ) : null}
            {level !== 'ok' ? (
              <T face="body" style={{ color: level === 'full' ? theme.dangerText : theme.statusText.urgente, fontSize: 12, marginTop: 2 }}>
                {level === 'full' ? t.album.storageFull : t.album.storageWarn}
              </T>
            ) : null}
          </>
        ) : (
          <T face="body" style={{ color: theme.text.secondary, fontSize: 13 }}>
            {t.album.storageLocal}
          </T>
        )}
      </View>
      {signedIn && meter?.quotaBytes ? (
        <View style={[styles.track, { backgroundColor: theme.lineStrong }]}>
          <View style={[styles.fill, { width: `${Math.round(ratio * 100)}%`, backgroundColor: barColor }]} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderWidth: 1, borderRadius: radius.button, padding: space.md },
  track: { width: 60, height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
});
