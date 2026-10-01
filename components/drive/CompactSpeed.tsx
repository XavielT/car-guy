import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { T } from '@/components/T';
import { palette } from '@/constants/theme';
import { t } from '@/lib/i18n';
import { useLiveTrip } from '@/lib/trips/liveStore';

const ink = palette.dark;

/**
 * Modo conducir's compact cluster (ModoConducir mockup, 03-screens.md "Phase 4"):
 * the speed big, km · tiempo · máx small, over the map's top scrim. Wheelz's
 * live view leads with the number, not a dial (05-wheelz-firsthand.md: "top
 * speed big" on every drive) — so the dial stays on Inicio and this is text.
 * With no trip it shows 0 and the line is hidden.
 */
export function CompactSpeed({ scale = 1 }: { scale?: number }) {
  const trip = useLiveTrip();
  const [now, setNow] = useState(() => Date.now());

  // The clock for "min" — only while a trip records.
  useEffect(() => {
    if (!trip) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [trip]);

  const speed = Math.round(trip?.speedKmh ?? 0);
  const min = trip ? Math.max(0, Math.floor((now - trip.startedAt) / 60_000)) : 0;

  return (
    <View accessibilityRole="summary" accessibilityLabel={`${speed} km/h`}>
      <T face="eyebrow" style={{ color: ink.accent, fontSize: 11, letterSpacing: 2 }}>
        {t.drive.eyebrow.toUpperCase()}{' '}
        <T face="kana" style={{ color: ink.text.muted, fontSize: 10, letterSpacing: 0 }}>
          走行
        </T>
      </T>
      <View style={styles.speedRow}>
        <T face="display" style={{ color: ink.text.primary, fontSize: 72 * scale, lineHeight: 76 * scale }}>
          {speed}
        </T>
        <T face="medium" style={{ color: ink.text.muted, fontSize: 13, letterSpacing: 2 }}>
          KM/H
        </T>
      </View>
      {trip ? (
        <T face="mono" style={{ color: ink.text.secondary, fontSize: 12 }}>
          {t.drive.statsLine((trip.distanceM / 1000).toFixed(1), min, Math.round(trip.maxKmh))}
        </T>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  speedRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
});
