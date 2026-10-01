import { Pressable, StyleSheet, View } from 'react-native';

import { T } from '@/components/T';
import { radius, space } from '@/constants/theme';
import { Alert } from '@/lib/alert';
import { recalibrateVehicle } from '@/lib/db/gaugeOps';
import type { Vehicle } from '@/lib/db/types';
import { stepsFor } from '@/lib/domain/gauge';
import { parseCalibration } from '@/lib/domain/gaugeCalibration';
import { formatFrac, gaugeCfgOf, isLearned } from '@/lib/domain/gaugeVehicle';
import { fromLiters } from '@/lib/domain/units';
import { t } from '@/lib/i18n';
import { useTheme } from '@/lib/theme/useTheme';

/**
 * Ficha → Medidor (IMP 01102026 Phase 3, 02-screens): what this car's gauge means in fuel — the learned table
 * with its bands, how many full tanks taught it, and "Reiniciar calibración". Nothing for GNV or a car
 * without a tank (calibration needs the capacity).
 */
export function GaugeCalibrationCard({ vehicle, onChanged }: { vehicle: Vehicle; onChanged: () => void }) {
  const { theme } = useTheme();
  if (vehicle.defaultFuelType === 'gnv' || !(vehicle.tankVolume && vehicle.tankVolume > 0)) return null;
  const cfg = gaugeCfgOf(vehicle);
  const G = stepsFor(cfg) ?? 8;
  const cal = parseCalibration(vehicle.gaugeCalibration);
  const learned = isLearned(cal) && cal.grid.length === G + 1;
  const C = vehicle.tankVolume;
  const unit = vehicle.volumeUnit ?? 'gal';
  const shown = (l: number) => {
    const v = fromLiters(l, unit);
    return unit === 'l' ? String(Math.round(v)) : v.toFixed(1);
  };
  const unitLabel = unit === 'l' ? 'L' : 'gal';
  // Every step, top first; a percent gauge every 10 %.
  const ks = Array.from({ length: G + 1 }, (_, i) => G - i).filter((k) => cfg.type !== 'percent' || k % 2 === 0);

  const reset = () =>
    Alert.alert(t.gauge.resetTitle, t.gauge.resetBody, [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: t.gauge.reset,
        style: 'destructive',
        onPress: () => void recalibrateVehicle(vehicle.id, { resetAt: new Date().toISOString() }).then(onChanged),
      },
    ]);

  return (
    <View style={[styles.card, { backgroundColor: theme.bg.surface, borderColor: theme.lineStrong }]}>
      <View style={styles.head}>
        <T face="eyebrow" style={{ color: theme.text.muted, fontSize: 11, paddingVertical: 6 }}>
          {t.gauge.title} · {t.gauge.types[cfg.type]}
        </T>
        <T face="eyebrow" style={{ color: learned ? theme.statusText.ok : theme.text.muted, fontSize: 10 }}>
          {t.gauge.status[learned ? cal.status : 'linear']}
        </T>
      </View>
      <T face="body" style={{ color: theme.text.secondary, fontSize: 13, lineHeight: 18, marginBottom: space.sm }}>
        {learned ? t.gauge.learnedWith(cal.n_full) : t.gauge.linearNote}
      </T>
      <View style={[styles.row, { borderTopColor: theme.line }]}>
        <T face="eyebrow" style={[styles.colA, { color: theme.text.muted }]}>
          {t.gauge.tableReading}
        </T>
        <T face="eyebrow" style={[styles.colB, { color: theme.text.muted }]}>
          {t.gauge.tableAmount} ({unitLabel})
        </T>
      </View>
      {ks.map((k) => {
        const mid = learned ? cal.grid[k] : (C * k) / G;
        const band = learned ? cal.band[k] : null;
        return (
          <View key={k} style={[styles.row, { borderTopColor: theme.line }]}>
            <T face="mono" style={[styles.colA, { color: theme.text.primary }]}>
              {k === G ? 'F' : k === 0 ? 'E' : formatFrac(k / G, cfg)}
            </T>
            <T face="mono" style={[styles.colB, { color: learned ? theme.text.primary : theme.text.secondary }]}>
              {band != null && k < G ? `${shown(mid)} ± ${shown(band)}` : shown(mid)}
            </T>
          </View>
        );
      })}
      {learned || cal?.reset_at ? (
        <Pressable onPress={reset} accessibilityRole="button" style={[styles.reset, { borderColor: theme.lineStrong }]}>
          <T face="semibold" style={{ color: theme.dangerText, fontSize: 13 }}>
            {t.gauge.reset}
          </T>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.card, paddingHorizontal: space.md, paddingBottom: space.md, marginBottom: space.md },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  row: { flexDirection: 'row', paddingVertical: 6, borderTopWidth: StyleSheet.hairlineWidth },
  colA: { width: 72, fontSize: 13 },
  colB: { flex: 1, textAlign: 'right', fontSize: 13 },
  reset: { marginTop: space.md, alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: space.md, borderWidth: 1, borderRadius: radius.button },
});
