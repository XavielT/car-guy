import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { PermissionChip } from '@/components/permissions/PermissionChip';
import { T } from '@/components/T';
import { palette, space } from '@/constants/theme';
import { agoText } from '@/lib/format';
import { t } from '@/lib/i18n';
import type { GpsNotice } from '@/lib/trips/gpsNotice';
import { refreshMyPosition } from '@/lib/trips/myPosition';

const ink = palette.dark;
/** How long "Buscando GPS…" waits before offering "Reintentar" (SPEC-A). */
const RETRY_AFTER_MS = 15_000;

/**
 * The position notice of Modo conducir, always something you can act on (IMP 16102026 M-1, M-2, M-5):
 *
 *  - the permission is not in order → the registry's `PermissionChip` (primer → system dialog, or the steps / the
 *    Android settings button; the dot appears by itself once it is granted);
 *  - the read failed → why (no signal / too slow) and "Reintentar";
 *  - the rest is a status line, and "Buscando GPS…" becomes a button after 15 s.
 *
 * The parent keys this component on the notice's kind, so the 15 s wait starts over whenever the kind changes.
 */
export function GpsNoticeButton({ notice, top }: { notice: Exclude<GpsNotice, null>; top: number }) {
  const [searchedLong, setSearchedLong] = useState(false);

  useEffect(() => {
    if (notice.kind !== 'searching') return;
    const id = setTimeout(() => setSearchedLong(true), RETRY_AFTER_MS);
    return () => clearTimeout(id);
  }, [notice.kind]);

  if (notice.kind === 'permission') {
    return (
      <View pointerEvents="box-none" style={[styles.slot, { top }]}>
        <PermissionChip id="location_foreground" dark onGranted={() => void refreshMyPosition()} />
      </View>
    );
  }

  let label: string;
  let onPress: (() => void) | null = null;
  switch (notice.kind) {
    case 'error':
      label = notice.reason === 'unavailable' ? t.drive.gpsErrorUnavailable : notice.reason === 'timeout' ? t.drive.gpsErrorTimeout : t.drive.gpsError;
      onPress = () => void refreshMyPosition();
      break;
    case 'approx':
      label = t.drive.gpsApprox(notice.acc == null ? null : Math.round(notice.acc));
      break;
    case 'stale':
      label = t.drive.lastPosition(agoText(notice.ageMs));
      break;
    case 'searching':
    default:
      label = searchedLong ? `${t.drive.gpsSearching} · ${t.drive.gpsRetry}` : t.drive.gpsSearching;
      if (searchedLong) onPress = () => void refreshMyPosition();
  }

  const body = (
    <T face={onPress ? 'semibold' : 'body'} style={{ color: onPress ? ink.accent : ink.text.secondary, fontSize: 13 }}>
      {label}
    </T>
  );
  return onPress ? (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={8} style={[styles.pill, { top, borderColor: ink.accent, minHeight: 44 }]}>
      {body}
    </Pressable>
  ) : (
    <View style={[styles.pill, { top, borderColor: ink.lineStrong }]} accessibilityLiveRegion="polite">
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  slot: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  pill: {
    position: 'absolute',
    alignSelf: 'center',
    maxWidth: '88%',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: space.md,
    paddingVertical: 8,
    justifyContent: 'center',
    backgroundColor: 'rgba(18,18,18,0.92)',
  },
});
