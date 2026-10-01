import { useState } from 'react';
import { View } from 'react-native';

import { T } from '@/components/T';
import { space } from '@/constants/theme';
import type { Vehicle } from '@/lib/db/types';
import { gaugeCfgOf, formatFrac, tankNow } from '@/lib/domain/gaugeVehicle';
import { fromLiters } from '@/lib/domain/units';
import { t } from '@/lib/i18n';
import { useTheme } from '@/lib/theme/useTheme';
import { agoShort } from '@/lib/trips/autoStatus';
import type { FillUp } from '@/lib/types';

/**
 * The hub's fuel row (IMP 01102026 Phase 3, research 03 §4): "Tanque: 4/9 ≈ 5.8 gal · ≈ 390 km (300–450) ·
 * hace 2 d" — the last reading minus the km driven since, always with its range. Nothing for GNV, a car
 * without a tank, or a last fill-up over 30 days old.
 */
export function TankLine({ vehicle, fillups, odometerKm }: { vehicle: Vehicle; fillups: FillUp[]; odometerKm: number | null }) {
  const { theme } = useTheme();
  // "Now" once per mount: the hub re-mounts on focus, which is as fresh as this line needs.
  const [now] = useState(() => Date.now());
  const tank = tankNow(vehicle, fillups, odometerKm, new Date(now));
  if (!tank) return null;
  const unit = vehicle.volumeUnit ?? 'gal';
  const shown = (l: number) => {
    const v = fromLiters(l, unit);
    return unit === 'l' ? String(Math.round(v)) : v.toFixed(1);
  };
  const cfg = gaugeCfgOf(vehicle);
  const reading = formatFrac(tank.stepNow / tank.steps, cfg);
  const parts = [
    `${t.gauge.tank}: ${reading} ${t.gauge.tankLiters(shown(tank.liters), unit === 'l' ? 'L' : 'gal')}`,
    tank.km != null && tank.kmBand ? t.gauge.tankKm(String(tank.km), String(tank.kmBand[0]), String(tank.kmBand[1])) : null,
    t.gauge.tankAgo(agoShort(now - new Date(tank.at).getTime())),
  ].filter(Boolean);
  const color = tank.telltale === 'red' ? theme.dangerText : tank.telltale === 'amber' ? theme.accent : theme.text.secondary;
  return (
    <View style={{ marginTop: space.sm }} accessible accessibilityLabel={parts.join(', ')}>
      <T face="mono" style={{ color, fontSize: 12, lineHeight: 17 }}>
        {parts.join(' · ')}
      </T>
    </View>
  );
}
